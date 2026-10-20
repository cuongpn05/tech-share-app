import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Image,
  Platform,
  StatusBar,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { ADMIN_STRINGS } from '../../constants/adminStrings';
import { adminService } from '../../services/adminService';
import {
  DeviceModerationItem,
  ModerationFilterStatus,
  ModerationTabCounts,
} from '../../types';
import { DeviceModerationListSkeleton } from '../../components/common/ShimmerPlaceholders';

export interface DeviceModerationListScreenProps {
  navigation?: any;
  onSelectDevice?: (device: DeviceModerationItem) => void;
}

const SEARCH_DEBOUNCE_MS = 350;
const MODERATION_PAGE_LIMIT = 10;

interface FilterTabOption {
  key: ModerationFilterStatus;
  label: string;
  countKey: keyof ModerationTabCounts;
}

const FILTER_TABS: FilterTabOption[] = [
  {
    key: 'pending',
    label: ADMIN_STRINGS.MODERATION.TABS.PENDING,
    countKey: 'totalPending',
  },
  {
    key: 'approved',
    label: ADMIN_STRINGS.MODERATION.TABS.APPROVED,
    countKey: 'totalApproved',
  },
  {
    key: 'rejected',
    label: ADMIN_STRINGS.MODERATION.TABS.REJECTED,
    countKey: 'totalRejected',
  },
];

export const DeviceModerationListScreen: React.FC<DeviceModerationListScreenProps> = ({
  navigation,
  onSelectDevice,
}) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );

  const [activeTab, setActiveTab] = useState<ModerationFilterStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [devices, setDevices] = useState<DeviceModerationItem[]>([]);
  const [counts, setCounts] = useState<ModerationTabCounts>({
    totalPending: 0,
    totalApproved: 0,
    totalRejected: 0,
    totalAll: 0,
  });
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Trạng thái xử lý Action Duyệt / Từ chối
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [deviceToReject, setDeviceToReject] = useState<DeviceModerationItem | null>(null);
  const [selectedRejectReason, setSelectedRejectReason] = useState<string>(
    ADMIN_STRINGS.MODERATION.ACTIONS.DEFAULT_REASONS[0]
  );
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Debounce tìm kiếm
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Tải danh sách thiết bị kiểm duyệt từ Backend API
  const fetchModerationDevices = useCallback(
    async (
      targetStatus: ModerationFilterStatus,
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
        const response = await adminService.getModerationDevices({
          status: targetStatus,
          search: targetSearch,
          page: targetPage,
          limit: MODERATION_PAGE_LIMIT,
        });

        if (targetPage === 1) {
          setDevices(response.devices);
        } else {
          setDevices((prev) => [...prev, ...response.devices]);
        }

        setCounts(response.counts);
        setHasNextPage(response.pagination.hasNextPage);
        setPage(targetPage);
      } catch (error: any) {
        console.error('[DeviceModerationListScreen] Fetch Error:', error);
        const status = error?.response?.status;
        if (status === 403) {
          setErrorMessage(ADMIN_STRINGS.MODERATION.ERRORS.FORBIDDEN);
        } else {
          setErrorMessage(ADMIN_STRINGS.MODERATION.ERRORS.LOAD_FAILED);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  // Trigger load lại khi đổi tab hoặc thay đổi search query
  useEffect(() => {
    fetchModerationDevices(activeTab, debouncedSearch, 1);
  }, [activeTab, debouncedSearch, fetchModerationDevices]);

  // Tự động cập nhật danh sách khi quay lại màn hình
  useFocusEffect(
    useCallback(() => {
      fetchModerationDevices(activeTab, debouncedSearch, 1);
    }, [activeTab, debouncedSearch, fetchModerationDevices])
  );

  // Pull-to-refresh
  const handleRefresh = useCallback(() => {
    fetchModerationDevices(activeTab, debouncedSearch, 1, true);
  }, [activeTab, debouncedSearch, fetchModerationDevices]);

  // Load more khi cuộn xuống cuối danh sách
  const handleLoadMore = useCallback(() => {
    if (!isLoading && !isLoadingMore && hasNextPage) {
      fetchModerationDevices(activeTab, debouncedSearch, page + 1);
    }
  }, [isLoading, isLoadingMore, hasNextPage, activeTab, debouncedSearch, page, fetchModerationDevices]);

  // Nhấn vào thẻ thiết bị: Xem chi tiết kiểm duyệt (UC-A04)
  const handlePressCard = useCallback(
    (item: DeviceModerationItem) => {
      if (onSelectDevice) {
        onSelectDevice(item);
      } else if (navigation?.navigate) {
        navigation.navigate('DeviceModerationDetail', {
          deviceId: item._id,
          device: item,
        });
      }
    },
    [onSelectDevice, navigation]
  );

  // Xử lý phê duyệt thiết bị nhanh trên thẻ
  const handleApprovePress = useCallback(
    (item: DeviceModerationItem) => {
      Alert.alert(
        ADMIN_STRINGS.MODERATION.ACTIONS.CONFIRM_APPROVE_TITLE,
        `${ADMIN_STRINGS.MODERATION.ACTIONS.CONFIRM_APPROVE_MSG}\n\n"${item.name}"`,
        [
          {
            text: ADMIN_STRINGS.MODERATION.ACTIONS.CANCEL,
            style: 'cancel',
          },
          {
            text: ADMIN_STRINGS.MODERATION.ACTIONS.APPROVE,
            style: 'default',
            onPress: async () => {
              try {
                setActionLoadingId(item._id);
                await adminService.approveDevice(item._id);

                // Cập nhật danh sách thiết bị
                if (activeTab === 'pending') {
                  setDevices((prev) => prev.filter((d) => d._id !== item._id));
                } else {
                  setDevices((prev) =>
                    prev.map((d) =>
                      d._id === item._id
                        ? { ...d, moderationStatus: 'approved' as const }
                        : d
                    )
                  );
                }

                // Cập nhật số lượng trên các tab
                setCounts((prev) => ({
                  ...prev,
                  totalPending: Math.max(0, prev.totalPending - 1),
                  totalApproved: prev.totalApproved + 1,
                }));
              } catch (error: any) {
                console.error('[DeviceModeration] Approve Error:', error);
                Alert.alert(
                  ADMIN_STRINGS.MODERATION.ERRORS.TITLE,
                  error?.response?.data?.message ||
                    ADMIN_STRINGS.MODERATION.ERRORS.APPROVE_FAILED
                );
              } finally {
                setActionLoadingId(null);
              }
            },
          },
        ]
      );
    },
    [activeTab]
  );

  // Mở modal từ chối thiết bị
  const handleOpenRejectModal = useCallback((item: DeviceModerationItem) => {
    setDeviceToReject(item);
    setSelectedRejectReason(ADMIN_STRINGS.MODERATION.ACTIONS.DEFAULT_REASONS[0]);
    setCustomRejectReason('');
    setRejectModalVisible(true);
  }, []);

  // Đóng modal từ chối
  const handleCloseRejectModal = useCallback(() => {
    if (isSubmittingReject) return;
    setRejectModalVisible(false);
    setDeviceToReject(null);
    setCustomRejectReason('');
  }, [isSubmittingReject]);

  // Xác nhận từ chối thiết bị
  const handleConfirmReject = useCallback(async () => {
    if (!deviceToReject) return;
    const finalReason = customRejectReason.trim() || selectedRejectReason;

    try {
      setIsSubmittingReject(true);
      await adminService.rejectDevice(deviceToReject._id, finalReason);

      // Cập nhật danh sách thiết bị
      if (activeTab === 'pending') {
        setDevices((prev) => prev.filter((d) => d._id !== deviceToReject._id));
      } else {
        setDevices((prev) =>
          prev.map((d) =>
            d._id === deviceToReject._id
              ? {
                  ...d,
                  moderationStatus: 'rejected' as const,
                  rejectReason: finalReason,
                }
              : d
          )
        );
      }

      // Cập nhật số lượng trên các tab
      setCounts((prev) => ({
        ...prev,
        totalPending: Math.max(0, prev.totalPending - 1),
        totalRejected: prev.totalRejected + 1,
      }));

      setRejectModalVisible(false);
      setDeviceToReject(null);
      setCustomRejectReason('');
    } catch (error: any) {
      console.error('[DeviceModeration] Reject Error:', error);
      Alert.alert(
        ADMIN_STRINGS.MODERATION.ERRORS.TITLE,
        error?.response?.data?.message ||
          ADMIN_STRINGS.MODERATION.ERRORS.REJECT_FAILED
      );
    } finally {
      setIsSubmittingReject(false);
    }
  }, [deviceToReject, customRejectReason, selectedRejectReason, activeTab]);

  // Định dạng tiền tệ VND chuẩn
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount || 0);
  };

  // Định dạng ngày đăng
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  // Style và icon cho từng trạng thái kiểm duyệt
  const getStatusBadgeConfig = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          label: ADMIN_STRINGS.MODERATION.STATUS_LABELS.APPROVED,
          bg: theme.colors.greenLight,
          textColor: theme.colors.green,
          icon: 'checkmark-circle' as const,
        };
      case 'rejected':
        return {
          label: ADMIN_STRINGS.MODERATION.STATUS_LABELS.REJECTED,
          bg: theme.colors.redLight,
          textColor: theme.colors.red,
          icon: 'close-circle' as const,
        };
      case 'pending':
      default:
        return {
          label: ADMIN_STRINGS.MODERATION.STATUS_LABELS.PENDING,
          bg: theme.colors.amberLight,
          textColor: theme.colors.amber,
          icon: 'time' as const,
        };
    }
  };

  // Text thông báo rỗng theo từng tab
  const emptyText = useMemo(() => {
    if (debouncedSearch) {
      return ADMIN_STRINGS.MODERATION.EMPTY_STATES.ALL;
    }
    switch (activeTab) {
      case 'pending':
        return ADMIN_STRINGS.MODERATION.EMPTY_STATES.PENDING;
      case 'approved':
        return ADMIN_STRINGS.MODERATION.EMPTY_STATES.APPROVED;
      case 'rejected':
        return ADMIN_STRINGS.MODERATION.EMPTY_STATES.REJECTED;
      default:
        return ADMIN_STRINGS.MODERATION.EMPTY_STATES.ALL;
    }
  }, [activeTab, debouncedSearch]);

  // Render từng thẻ thiết bị kiểm duyệt (Summary Card chuẩn Mobile UX)
  const renderDeviceCard = ({ item }: { item: DeviceModerationItem }) => {
    const badge = getStatusBadgeConfig(item.moderationStatus);
    const isPending = item.moderationStatus === 'pending';
    const isActionLoading = actionLoadingId === item._id;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => handlePressCard(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name} - ${badge.label}`}
      >
        {/* Phần thông tin rút gọn: thumbnail 64x64 và thông tin cốt lõi */}
        <View style={styles.cardInfoRow}>
          {/* 1. Thumbnail thu nhỏ (64x64, bo góc 10px) */}
          <View style={styles.thumbnailContainer}>
            {item.thumbnail ? (
              <Image
                source={{ uri: item.thumbnail }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Ionicons
                  name="hardware-chip-outline"
                  size={24}
                  color={theme.colors.text.subtle}
                />
              </View>
            )}
          </View>

          {/* 2. Cột nội dung chính */}
          <View style={styles.cardBody}>
            {/* Hàng 1 (Top Meta): Tên Hãng / Danh mục bên trái, Badge Trạng thái bên phải */}
            <View style={styles.cardTopRow}>
              <Text style={styles.brandText} numberOfLines={1}>
                {item.brand}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <Ionicons
                  name={badge.icon}
                  size={11}
                  color={badge.textColor}
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.statusBadgeText, { color: badge.textColor }]}>
                  {badge.label}
                </Text>
              </View>
            </View>

            {/* Hàng 2 (Tiêu đề): Tên thiết bị 1 dòng */}
            <Text style={styles.deviceName} numberOfLines={1} ellipsizeMode="tail">
              {item.name}
            </Text>

            {/* Hàng 3 (Meta tóm tắt): Giá thuê ngày bên trái, Tên chủ máy + tích xanh bên phải */}
            <View style={styles.cardBottomRow}>
              <Text style={styles.priceValue}>
                {formatCurrency(item.pricePerDay)}
                <Text style={styles.priceUnit}>
                  {' '}{ADMIN_STRINGS.MODERATION.LABELS.PRICE_UNIT}
                </Text>
              </Text>

              <View style={styles.ownerWrap}>
                <Text style={styles.ownerName} numberOfLines={1} ellipsizeMode="tail">
                  {item.owner?.name || ADMIN_STRINGS.MODERATION.LABELS.OWNER}
                </Text>
                {item.owner?.isVerified && (
                  <Ionicons
                    name="checkmark-circle"
                    size={12}
                    color={theme.colors.blue}
                    style={styles.verifiedIcon}
                  />
                )}
              </View>
            </View>
          </View>
        </View>

        {/* 3. Hàng nút action Duyệt / Từ chối (Nút từ chối bên TRÁI, nút duyệt bên PHẢI) */}
        {isPending && (
          <View style={styles.cardActionsRow}>
            {/* Nút Từ chối bên TRÁI */}
            <TouchableOpacity
              style={styles.rejectButton}
              activeOpacity={0.7}
              onPress={() => handleOpenRejectModal(item)}
              disabled={isActionLoading}
              accessibilityRole="button"
              accessibilityLabel={ADMIN_STRINGS.MODERATION.ACTIONS.REJECT}
            >
              <Ionicons
                name="close-circle-outline"
                size={15}
                color={theme.colors.red}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.rejectButtonText}>
                {ADMIN_STRINGS.MODERATION.ACTIONS.REJECT}
              </Text>
            </TouchableOpacity>

            {/* Nút Duyệt bên PHẢI */}
            <TouchableOpacity
              style={styles.approveButton}
              activeOpacity={0.7}
              onPress={() => handleApprovePress(item)}
              disabled={isActionLoading}
              accessibilityRole="button"
              accessibilityLabel={ADMIN_STRINGS.MODERATION.ACTIONS.APPROVE}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={15}
                    color={theme.colors.white}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.approveButtonText}>
                    {ADMIN_STRINGS.MODERATION.ACTIONS.APPROVE}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* 1. Header chuẩn theo Dashboard KPI */}
      <View style={styles.header}>
        {/* Nút mở Menu Sidebar bên TRÁI thay cho nút Back */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={ADMIN_STRINGS.MODERATION.ACCESSIBILITY.MENU_BUTTON}
          style={styles.headerButton}
          onPress={() => {
            if (navigation?.openDrawer) {
              navigation.openDrawer();
            } else if (navigation?.getParent?.()?.openDrawer) {
              navigation.getParent().openDrawer();
            } else if (navigation?.dispatch) {
              navigation.dispatch(DrawerActions.openDrawer());
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="menu-outline"
            size={24}
            color={theme.colors.text.primary}
          />
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>
            {ADMIN_STRINGS.MODERATION.HEADER_TITLE}
          </Text>
          <Text style={styles.headerSubtitle}>
            {ADMIN_STRINGS.MODERATION.HEADER_SUBTITLE}
          </Text>
        </View>
      </View>

      {/* 2. Thanh tìm kiếm nhanh */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search-outline"
            size={18}
            color={theme.colors.text.muted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={ADMIN_STRINGS.MODERATION.SEARCH_PLACEHOLDER}
            placeholderTextColor={theme.colors.text.subtle}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="never"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
              accessibilityLabel={ADMIN_STRINGS.MODERATION.ACCESSIBILITY.SEARCH_CLEAR}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.colors.text.subtle}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3. Thanh chuyển Tab lọc trạng thái (Scrollable Filter Tabs) */}
      <View style={styles.tabScrollWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = counts[tab.countKey] || 0;

            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.tabBadge,
                    isActive && styles.tabBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      isActive && styles.tabBadgeTextActive,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Thân danh sách */}
      {isLoading ? (
        <DeviceModerationListSkeleton count={4} />
      ) : errorMessage ? (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={theme.colors.red}
            style={{ marginBottom: 12 }}
          />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRefresh}
            activeOpacity={0.8}
          >
            <Ionicons
              name="refresh-outline"
              size={16}
              color={theme.colors.surface}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.retryButtonText}>
              {ADMIN_STRINGS.MODERATION.ERRORS.RETRY}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item._id || item.id}
          renderItem={renderDeviceCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.brand[500]]}
              tintColor={theme.colors.brand[500]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={36}
                  color={theme.colors.brand[500]}
                />
              </View>
              <Text style={styles.emptyTitle}>{emptyText}</Text>
              <Text style={styles.emptySubtitle}>
                {ADMIN_STRINGS.MODERATION.EMPTY_STATES.SUBTITLE}
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator
                  size="small"
                  color={theme.colors.brand[500]}
                />
              </View>
            ) : undefined
          }
        />
      )}

      {/* 5. Modal chọn lý do từ chối thiết bị */}
      <Modal
        visible={rejectModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseRejectModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={handleCloseRejectModal}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={styles.modalIconBox}>
                <Ionicons
                  name="alert-circle"
                  size={20}
                  color={theme.colors.red}
                />
              </View>
              <View style={styles.modalTitleCol}>
                <Text style={styles.modalTitle}>
                  {ADMIN_STRINGS.MODERATION.ACTIONS.REJECT_MODAL_TITLE}
                </Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {deviceToReject?.name}
                </Text>
              </View>
            </View>

            <Text style={styles.modalSectionLabel}>
              {ADMIN_STRINGS.MODERATION.ACTIONS.REJECT_MODAL_SUBTITLE}
            </Text>

            {/* Danh sách lý do từ chối mẫu */}
            <View style={styles.reasonList}>
              {ADMIN_STRINGS.MODERATION.ACTIONS.DEFAULT_REASONS.map(
                (reason, index) => {
                  const isSelected =
                    selectedRejectReason === reason && !customRejectReason;
                  return (
                    <TouchableOpacity
                      key={`reject_reason_${index}`}
                      style={[
                        styles.reasonChip,
                        isSelected && styles.reasonChipSelected,
                      ]}
                      onPress={() => {
                        setSelectedRejectReason(reason);
                        setCustomRejectReason('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={
                          isSelected ? 'radio-button-on' : 'radio-button-off'
                        }
                        size={16}
                        color={
                          isSelected
                            ? theme.colors.red
                            : theme.colors.text.subtle
                        }
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={[
                          styles.reasonChipText,
                          isSelected && styles.reasonChipTextSelected,
                        ]}
                      >
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>

            {/* Ô nhập lý do chi tiết nếu muốn */}
            <TextInput
              style={styles.customReasonInput}
              placeholder={
                ADMIN_STRINGS.MODERATION.ACTIONS.REJECT_REASON_PLACEHOLDER
              }
              placeholderTextColor={theme.colors.text.subtle}
              value={customRejectReason}
              onChangeText={setCustomRejectReason}
              multiline
              numberOfLines={3}
            />

            {/* Nút thao tác: Hủy bên trái, Xác nhận bên phải */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={handleCloseRejectModal}
                disabled={isSubmittingReject}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>
                  {ADMIN_STRINGS.MODERATION.ACTIONS.CANCEL}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleConfirmReject}
                disabled={isSubmittingReject}
                activeOpacity={0.7}
              >
                {isSubmittingReject ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {ADMIN_STRINGS.MODERATION.ACTIONS.CONFIRM_REJECT}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
  },
  headerButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
  },
  headerTitleCol: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  headerTitle: {
    color: theme.colors.text.primary,
    fontSize: 19,
    fontWeight: theme.typography.fontWeight.bold,
  },
  headerSubtitle: {
    color: theme.colors.text.muted,
    fontSize: 12.5,
    marginTop: 2,
  },
  searchSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    paddingHorizontal: theme.spacing.md,
    height: 42,
    ...theme.shadows.card,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.primary,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  tabScrollWrapper: {
    marginBottom: theme.spacing.xs,
  },
  tabScrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
    gap: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  tabItemActive: {
    backgroundColor: theme.colors.brand[100],
    borderColor: theme.colors.brand[500],
  },
  tabLabel: {
    fontSize: 12.5,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    marginRight: 6,
  },
  tabLabelActive: {
    color: theme.colors.brand[700],
    fontWeight: theme.typography.fontWeight.bold,
  },
  tabBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceMuted,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeActive: {
    backgroundColor: theme.colors.brand[500],
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.muted,
  },
  tabBadgeTextActive: {
    color: theme.colors.white,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing['2xl'],
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border.divider,
    ...theme.shadows.card,
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceMuted,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
    height: 64,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandText: {
    fontSize: 11,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.muted,
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.fontWeight.bold,
  },
  deviceName: {
    fontSize: 13.5,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    lineHeight: 18,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceValue: {
    fontSize: 13,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  priceUnit: {
    fontSize: 10.5,
    fontWeight: theme.typography.fontWeight.normal,
    color: theme.colors.text.muted,
  },
  ownerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginLeft: 8,
  },
  ownerName: {
    fontSize: 11,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    flexShrink: 1,
  },
  verifiedIcon: {
    marginLeft: 3,
    flexShrink: 0,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.divider,
    gap: 8,
  },
  rejectButton: {
    flex: 1,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.redLight,
    borderWidth: 1,
    borderColor: theme.colors.redBorder,
    borderRadius: theme.radii.sm,
  },
  rejectButtonText: {
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.red,
  },
  approveButton: {
    flex: 1,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.green,
    borderRadius: theme.radii.sm,
  },
  approveButtonText: {
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.white,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  emptySubtitle: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.muted,
    textAlign: 'center',
    maxWidth: 260,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.brand[500],
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radii.md,
  },
  retryButtonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  footerLoader: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlay,
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    ...theme.shadows.cardHover,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: theme.colors.border.light,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.redLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalTitleCol: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.colors.text.muted,
    marginTop: 1,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    marginBottom: 10,
  },
  reasonList: {
    gap: 8,
    marginBottom: 12,
  },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  reasonChipSelected: {
    backgroundColor: theme.colors.redLight,
    borderColor: theme.colors.redBorder,
  },
  reasonChipText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  reasonChipTextSelected: {
    color: theme.colors.red,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: theme.radii.md,
    padding: 10,
    fontSize: 12.5,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.surfaceMuted,
    textAlignVertical: 'top',
    height: 68,
    marginBottom: 14,
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    backgroundColor: theme.colors.surface,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.secondary,
  },
  modalConfirmButton: {
    flex: 1.5,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.red,
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.white,
  },
});

export default DeviceModerationListScreen;
