/**
 * ============================================================
 *  ADMIN EKYC SUBMISSIONS LIST SCREEN
 *  client/src/screens/admin/AdminEkycListScreen.tsx
 * ============================================================
 *  Mục đích:
 *   - Màn hình dành cho Quản trị viên (Admin) xem danh sách các đơn
 *     xác thực danh tính eKYC gửi lên từ collection `ekyc_requests`.
 *   - Hỗ trợ:
 *       + Lọc theo trạng thái: Tất cả / Chờ duyệt / Đã duyệt / Bị từ chối
 *       + Tìm kiếm theo: Tên người nộp, Email, Số CCCD, Số điện thoại
 *       + Xem thông tin hồ sơ và 2 ảnh CCCD (mặt trước / mặt sau)
 *       + Xem ảnh phóng to toàn màn hình để kiểm tra chi tiết
 *       + Phân trang & Pull-to-refresh
 *   - Lưu ý: Chỉ hiển thị danh sách (chưa bao gồm duyệt / từ chối).
 * ============================================================
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Image,
  ActivityIndicator,
  Modal,
  StatusBar,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import {
  getAdminEkycList,
  AdminEkycItem,
  AdminEkycCounts,
} from '../../services/ekycService';

export interface AdminEkycListScreenProps {
  navigation?: any;
}

type EkycFilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

interface FilterTabOption {
  key: EkycFilterStatus;
  label: string;
  countKey: keyof AdminEkycCounts;
}

const FILTER_TABS: FilterTabOption[] = [
  { key: 'all',      label: 'Tất cả',    countKey: 'totalAll' },
  { key: 'pending',  label: 'Chờ duyệt', countKey: 'totalPending' },
  { key: 'approved', label: 'Đã duyệt',  countKey: 'totalApproved' },
  { key: 'rejected', label: 'Từ chối',   countKey: 'totalRejected' },
];

const SEARCH_DEBOUNCE_MS = 350;
const PAGE_LIMIT = 15;

export function AdminEkycListScreen({ navigation }: AdminEkycListScreenProps) {
  const insets = useSafeAreaInsets();

  // State danh sách & phân trang
  const [submissions, setSubmissions] = useState<AdminEkycItem[]>([]);
  const [counts, setCounts] = useState<AdminEkycCounts>({
    totalAll: 0,
    totalPending: 0,
    totalApproved: 0,
    totalRejected: 0,
  });

  const [activeTab, setActiveTab] = useState<EkycFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal phóng to ảnh CCCD
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageTitle, setPreviewImageTitle] = useState<string>('');

  // Debounce tìm kiếm
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [searchQuery]);

  // ── 1. Tải danh sách đơn eKYC từ Backend ───────────────────
  const fetchSubmissions = useCallback(
    async (
      targetStatus: EkycFilterStatus,
      targetSearch: string,
      targetPage: number,
      isRefresh = false
    ) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else if (targetPage === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setErrorMessage(null);

      try {
        const response = await getAdminEkycList({
          status: targetStatus,
          search: targetSearch,
          page: targetPage,
          limit: PAGE_LIMIT,
        });

        if (response.success) {
          if (targetPage === 1) {
            setSubmissions(response.data || []);
          } else {
            setSubmissions((prev) => [...prev, ...(response.data || [])]);
          }
          if (response.counts) {
            setCounts(response.counts);
          }
          setHasNextPage(response.pagination?.hasNextPage ?? false);
          setPage(targetPage);
        } else {
          setErrorMessage(response.message || 'Không thể tải danh sách đơn eKYC.');
        }
      } catch (err: any) {
        console.error('[AdminEkycListScreen] Fetch Error:', err);
        setErrorMessage(
          err.response?.data?.message || 'Lỗi kết nối máy chủ khi lấy danh sách eKYC.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  // Tải lại dữ liệu khi tab hoặc search thay đổi
  useEffect(() => {
    fetchSubmissions(activeTab, debouncedSearch, 1, false);
  }, [activeTab, debouncedSearch, fetchSubmissions]);

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    fetchSubmissions(activeTab, debouncedSearch, 1, true);
  }, [activeTab, debouncedSearch, fetchSubmissions]);

  // Load more khi cuộn đến cuối
  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasNextPage) {
      fetchSubmissions(activeTab, debouncedSearch, page + 1, false);
    }
  }, [isLoadingMore, hasNextPage, activeTab, debouncedSearch, page, fetchSubmissions]);

  // Mở ảnh phóng to
  const handleViewImage = (url: string, title: string) => {
    if (!url) return;
    setPreviewImageUrl(url);
    setPreviewImageTitle(title);
  };

  // Định dạng ngày
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Chưa rõ';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // Badge màu sắc cho từng trạng thái
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Chờ duyệt',
          bg: '#FEF3C7',
          text: '#B45309',
          icon: 'time-outline' as const,
        };
      case 'approved':
        return {
          label: 'Đã duyệt',
          bg: '#ECFDF5',
          text: '#047857',
          icon: 'checkmark-circle' as const,
        };
      case 'rejected':
        return {
          label: 'Bị từ chối',
          bg: '#FEF2F2',
          text: '#B91C1C',
          icon: 'close-circle' as const,
        };
      default:
        return {
          label: status,
          bg: '#F1F5F9',
          text: '#64748B',
          icon: 'ellipse-outline' as const,
        };
    }
  };

  // ── 2. Render từng Card đơn eKYC ────────────────────────────
  const renderItem = ({ item }: { item: AdminEkycItem }) => {
    const badge = getStatusBadge(item.status);
    const u = item.user;

    return (
      <View style={styles.card}>
        {/* Hàng 1: User avatar + Tên + Badge trạng thái */}
        <View style={styles.cardTopRow}>
          <View style={styles.userAvatarContainer}>
            {u.avatar ? (
              <Image source={{ uri: u.avatar }} style={styles.userAvatar} />
            ) : (
              <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
                <Ionicons name="person" size={20} color={theme.colors.brand[500]} />
              </View>
            )}
          </View>

          <View style={styles.userMainInfo}>
            <View style={styles.userNameRow}>
              <Text style={styles.userNameText} numberOfLines={1}>
                {u.name}
              </Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>Renter</Text>
              </View>
            </View>
            <Text style={styles.timeText}>
              Nộp lúc: {formatDate(item.createdAt)}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Ionicons name={badge.icon} size={12} color={badge.text} style={{ marginRight: 3 }} />
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        {/* Hàng 2: Thông tin liên hệ cơ bản (Email, SĐT, Địa chỉ) */}
        <View style={styles.contactContainer}>
          <View style={styles.contactRow}>
            <Ionicons name="mail-outline" size={14} color="#64748B" />
            <Text style={styles.contactText} numberOfLines={1}>{u.email}</Text>
          </View>
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={14} color="#64748B" />
            <Text style={styles.contactText} numberOfLines={1}>{u.phone}</Text>
          </View>
          <View style={styles.contactRow}>
            <Ionicons name="location-outline" size={14} color="#64748B" />
            <Text style={styles.contactText} numberOfLines={2}>{u.address}</Text>
          </View>
        </View>

        {/* Hàng 3: Ô Số CCCD nổi bật */}
        <View style={styles.idNumberBox}>
          <View style={styles.idNumberLeft}>
            <Ionicons name="barcode-outline" size={20} color={theme.colors.brand[500]} />
            <Text style={styles.idNumberLabel}>Số CCCD / CMND:</Text>
          </View>
          <Text style={styles.idNumberValue}>{item.idCardNumber || 'Chưa cung cấp'}</Text>
        </View>

        {/* Hàng 4: 2 Khung ảnh CCCD (Mặt trước & Mặt sau) */}
        <View style={styles.photosSection}>
          <Text style={styles.photosSectionTitle}>Hình ảnh thẻ CCCD đã tải lên:</Text>
          <View style={styles.photosRow}>
            {/* Ảnh mặt trước */}
            <TouchableOpacity
              style={styles.photoBox}
              activeOpacity={0.8}
              onPress={() => handleViewImage(item.idCardFrontUrl, `CCCD Mặt trước - ${u.name}`)}
            >
              <Image source={{ uri: item.idCardFrontUrl }} style={styles.idCardImage} resizeMode="cover" />
              <View style={styles.photoLabelBar}>
                <Ionicons name="scan-outline" size={13} color="#FFFFFF" />
                <Text style={styles.photoLabelText}>Mặt trước</Text>
              </View>
              <View style={styles.zoomHintIcon}>
                <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* Ảnh mặt sau */}
            <TouchableOpacity
              style={styles.photoBox}
              activeOpacity={0.8}
              onPress={() => handleViewImage(item.idCardBackUrl, `CCCD Mặt sau - ${u.name}`)}
            >
              <Image source={{ uri: item.idCardBackUrl }} style={styles.idCardImage} resizeMode="cover" />
              <View style={styles.photoLabelBar}>
                <Ionicons name="scan-outline" size={13} color="#FFFFFF" />
                <Text style={styles.photoLabelText}>Mặt sau</Text>
              </View>
              <View style={styles.zoomHintIcon}>
                <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Lý do từ chối nếu có */}
        {item.status === 'rejected' && item.rejectReason ? (
          <View style={styles.rejectReasonBox}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.rejectReasonText}>
              Lý do từ chối: {item.rejectReason}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  // ── 3. Empty State ──────────────────────────────────────────
  const renderEmptyComponent = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="finger-print-outline" size={64} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>Không có đơn xác thực nào</Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery
            ? `Không tìm thấy kết quả phù hợp với từ khóa "${searchQuery}".`
            : activeTab === 'pending'
            ? 'Hiện tại không có đơn eKYC nào đang chờ duyệt.'
            : 'Chưa có dữ liệu đơn xác thực eKYC nào.'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ─── HEADER BAR ─── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.drawerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="menu-outline" size={26} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Duyệt hồ sơ eKYC</Text>
          <Text style={styles.headerSubtitle}>
            {counts.totalPending > 0
              ? `${counts.totalPending} đơn đang chờ xét duyệt`
              : 'Tất cả đơn đã được xử lý'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="refresh-outline" size={22} color={theme.colors.brand[500]} />
        </TouchableOpacity>
      </View>

      {/* ─── THANH TÌM KIẾM ─── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo tên, email, CCCD, SĐT..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─── BỘ LỌC TABS ─── */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const tabCount = counts[tab.countKey] || 0;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {tabCount}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ─── THÔNG BÁO LỖI NẾU CÓ ─── */}
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* ─── DANH SÁCH ĐƠN (FLATLIST) ─── */}
      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
          <Text style={styles.loadingText}>Đang tải danh sách hồ sơ eKYC...</Text>
        </View>
      ) : (
        <FlatList
          data={submissions}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.brand[500]]}
              tintColor={theme.colors.brand[500]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadingMoreBox}>
                <ActivityIndicator size="small" color={theme.colors.brand[500]} />
                <Text style={styles.loadingMoreText}>Đang tải thêm...</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={renderEmptyComponent}
        />
      )}

      {/* ─── MODAL PHÓNG TO ẢNH CCCD FULL SCREEN ─── */}
      <Modal
        visible={Boolean(previewImageUrl)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.imageViewerBackdrop}>
          <View style={[styles.imageViewerHeader, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.imageViewerTitle} numberOfLines={1}>
              {previewImageTitle}
            </Text>
            <TouchableOpacity
              style={styles.imageViewerCloseBtn}
              onPress={() => setPreviewImageUrl(null)}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.imageViewerBody}>
            {previewImageUrl ? (
              <Image
                source={{ uri: previewImageUrl }}
                style={styles.imageViewerFull}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  drawerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },

  // Filter Tabs
  tabsWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabButtonActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabBadge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 10,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    fontSize: 13,
    color: '#DC2626',
    marginLeft: 6,
    flex: 1,
  },

  // Center Loading
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
  },

  // List
  listContent: {
    padding: 16,
  },
  loadingMoreBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 13,
    color: '#64748B',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatarContainer: {
    marginRight: 10,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userAvatarPlaceholder: {
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMainInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 6,
  },
  roleTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
  },
  timeText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Contact
  contactContainer: {
    marginTop: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    gap: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },

  // ID Number Box
  idNumberBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  idNumberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  idNumberLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  idNumberValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.5,
  },

  // Photos
  photosSection: {
    marginTop: 12,
  },
  photosSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  photosRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoBox: {
    flex: 1,
    height: 110,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  idCardImage: {
    width: '100%',
    height: '100%',
  },
  photoLabelBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  photoLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  zoomHintIcon: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Reject reason
  rejectReasonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    gap: 6,
  },
  rejectReasonText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
    fontWeight: '500',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  // Image Viewer Modal
  imageViewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
  },
  imageViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  imageViewerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 12,
  },
  imageViewerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  imageViewerFull: {
    width: '100%',
    height: '100%',
  },
});

export default AdminEkycListScreen;
