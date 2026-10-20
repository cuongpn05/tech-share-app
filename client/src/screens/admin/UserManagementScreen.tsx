/**
 * ============================================================
 *  USER MANAGEMENT SCREEN
 *  client/src/screens/admin/UserManagementScreen.tsx
 * ============================================================
 *  Màn hình quản lý thành viên dành cho Admin Dashboard.
 *  Tính năng:
 *   - Hiển thị danh sách user (role: renter & owner, loại admin)
 *   - Tìm kiếm theo tên / email / username (debounce 400ms)
 *   - Lọc theo role (Tất cả / Người thuê / Chủ sở hữu)
 *   - Lọc theo trạng thái (Tất cả / Đang hoạt động / Đã khóa)
 *   - Phân trang (Load more khi scroll)
 *   - Pull-to-refresh
 * ============================================================
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import {
  fetchUsersList,
  MemberUser,
  Pagination,
} from '../../services/userManagementService';

type RoleFilter   = '' | 'renter' | 'owner';
type StatusFilter = '' | 'active' | 'inactive';

export interface UserManagementScreenProps {
  navigation?: any;
}

// ─────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────

const ROLE_TABS: { label: string; value: RoleFilter }[] = [
  { label: 'Tất cả',      value: '' },
  { label: 'Người thuê',  value: 'renter' },
  { label: 'Chủ sở hữu', value: 'owner' },
];

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'Tất cả',    value: '' },
  { label: 'Hoạt động', value: 'active' },
  { label: 'Đã khóa',   value: 'inactive' },
];

const PAGE_LIMIT = 20;

// ─────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = (name || '').trim().split(' ').filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '—'; }
}

// ─────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────

const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const isOwner = role === 'owner';
  return (
    <View style={[styles.badge, isOwner ? styles.badgeOwner : styles.badgeRenter]}>
      <Ionicons name={isOwner ? 'key-outline' : 'person-outline'} size={10} color={isOwner ? '#7C3AED' : '#0EA5E9'} />
      <Text style={[styles.badgeText, isOwner ? styles.badgeTextOwner : styles.badgeTextRenter]}>
        {isOwner ? 'Owner' : 'Renter'}
      </Text>
    </View>
  );
};

const UserAvatar: React.FC<{ avatar: string | null; name: string }> = ({ avatar, name }) =>
  avatar ? (
    <Image source={{ uri: avatar }} style={styles.avatarImg} />
  ) : (
    <View style={styles.avatarPlaceholder}>
      <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
    </View>
  );

const UserListItem: React.FC<{ item: MemberUser }> = ({ item }) => (
  <View style={styles.userCard}>
    {/* Avatar + status dot */}
    <View style={styles.avatarWrapper}>
      <UserAvatar avatar={item.avatar} name={item.name} />
      <View style={[styles.statusDot, { backgroundColor: item.isActive ? '#10B981' : '#EF4444' }]} />
    </View>

    {/* Info */}
    <View style={styles.userInfo}>
      <View style={styles.userTopRow}>
        <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
        <RoleBadge role={item.role} />
      </View>
      <Text style={styles.userEmail} numberOfLines={1}>@{item.username}  ·  {item.email}</Text>
      <View style={styles.userMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="star" size={11} color="#F59E0B" />
          <Text style={styles.metaText}>{item.rating.toFixed(1)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="shield-checkmark-outline" size={11} color={item.isVerified ? '#10B981' : '#94A3B8'} />
          <Text style={[styles.metaText, { color: item.isVerified ? '#10B981' : '#94A3B8' }]}>
            {item.isVerified ? 'Verified' : 'Unverified'}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={11} color={theme.colors.text.muted} />
          <Text style={styles.metaText}>{formatDate(item.joinedAt)}</Text>
        </View>
      </View>
    </View>

    {/* Wallet */}
    <View style={styles.walletBadge}>
      <Text style={styles.walletAmount}>{item.walletBalance.toLocaleString('vi-VN')}</Text>
      <Text style={styles.walletLabel}>VND</Text>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────
//  Main Screen
// ─────────────────────────────────────────────────────────

export function UserManagementScreen({ navigation }: UserManagementScreenProps) {
  const insets = useSafeAreaInsets();

  const [search,         setSearch]         = useState('');
  const [roleFilter,     setRoleFilter]     = useState<RoleFilter>('');
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [users,       setUsers]       = useState<MemberUser[]>([]);
  const [pagination,  setPagination]  = useState<Pagination | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [search]);

  // ── Fetch ──────────────────────────────────────────────

  const fetchUsers = useCallback(async (page: number, append: boolean) => {
    try {
      if (page === 1 && !append) { setLoading(true); setUsers([]); }
      else setLoadingMore(true);
      setError(null);

      const response = await fetchUsersList({
        page,
        limit: PAGE_LIMIT,
        search: debouncedSearch,
        role: roleFilter,
        status: statusFilter,
      });

      if (response.success) {
        const newData = response.data || [];
        setUsers(prev => append ? [...prev, ...newData] : newData);
        setPagination(response.pagination || null);
      } else {
        setError(response.message || 'Không thể tải danh sách.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Lỗi kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => { fetchUsers(1, false); }, [fetchUsers]);

  const handleRefresh = useCallback(() => { setRefreshing(true); fetchUsers(1, false); }, [fetchUsers]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && pagination?.hasNext) fetchUsers((pagination.page || 1) + 1, true);
  }, [loadingMore, pagination, fetchUsers]);

  // ── Render ─────────────────────────────────────────────

  const totalCount = pagination?.total ?? 0;

  const renderEmpty = () => loading ? null : (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={56} color={theme.colors.text.muted} />
      <Text style={styles.emptyTitle}>Không tìm thấy thành viên</Text>
      <Text style={styles.emptySubtitle}>
        {debouncedSearch ? `Không có kết quả cho "${debouncedSearch}"` : 'Chưa có thành viên nào phù hợp với bộ lọc.'}
      </Text>
    </View>
  );

  const renderFooter = () => !loadingMore ? null : (
    <View style={styles.loadMoreIndicator}>
      <ActivityIndicator size="small" color={theme.colors.brand[500]} />
      <Text style={styles.loadMoreText}>Đang tải thêm...</Text>
    </View>
  );

  const topPad = insets.top + (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.openDrawer?.() ?? navigation?.goBack?.()} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu-outline" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Quản lý thành viên</Text>
          <Text style={styles.headerSub}>
            {loading ? 'Đang tải...' : `${totalCount.toLocaleString('vi-VN')} thành viên`}
          </Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="refresh-outline" size={22} color={theme.colors.brand[500]} />
        </TouchableOpacity>
      </View>

      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={theme.colors.text.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo tên, email, username..."
            placeholderTextColor={theme.colors.text.subtle}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={theme.colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* FILTER: ROLE */}
      <View style={styles.filtersRow}>
        <Ionicons name="people-circle-outline" size={16} color={theme.colors.text.muted} style={{ marginRight: 6 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
          {ROLE_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.value}
              style={[styles.filterTab, roleFilter === tab.value && styles.filterTabActive]}
              onPress={() => setRoleFilter(tab.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterTabText, roleFilter === tab.value && styles.filterTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* FILTER: STATUS */}
      <View style={styles.filtersRow}>
        <Ionicons name="shield-outline" size={16} color={theme.colors.text.muted} style={{ marginRight: 6 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
          {STATUS_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.value}
              style={[styles.filterTab, statusFilter === tab.value && styles.filterTabActive]}
              onPress={() => setStatusFilter(tab.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterTabText, statusFilter === tab.value && styles.filterTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ERROR */}
      {error && !loading && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={theme.colors.red} />
          <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
          <TouchableOpacity onPress={handleRefresh}>
            <Text style={styles.errorRetry}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LOADING INITIAL */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
          <Text style={styles.loadingText}>Đang tải danh sách thành viên...</Text>
        </View>
      )}

      {/* LIST */}
      {!loading && (
        <FlatList
          data={users}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <UserListItem item={item} />}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.brand[500]}
              colors={[theme.colors.brand[500]]}
            />
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container       : { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header          : { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 10 },
  headerBtn       : { padding: 4 },
  headerCenter    : { flex: 1 },
  headerTitle     : { fontSize: 17, fontWeight: '700', color: theme.colors.text.primary },
  headerSub       : { fontSize: 12, color: theme.colors.text.muted, marginTop: 2 },

  // Search
  searchContainer : { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  searchBar       : { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 12, height: 42 },
  searchInput     : { flex: 1, fontSize: 14, color: theme.colors.text.primary, height: '100%' },

  // Filter tabs
  filtersRow      : { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingVertical: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  filterTab       : { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: 'transparent' },
  filterTabActive : { backgroundColor: '#EFF6FF', borderColor: theme.colors.brand[400] },
  filterTabText   : { fontSize: 12, fontWeight: '600', color: theme.colors.text.muted },
  filterTabTextActive: { color: theme.colors.brand[600] },

  // Error
  errorBanner     : { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', marginHorizontal: 16, marginTop: 12, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderLeftWidth: 4, borderLeftColor: theme.colors.red },
  errorText       : { flex: 1, fontSize: 13, color: theme.colors.red },
  errorRetry      : { fontSize: 13, fontWeight: '700', color: theme.colors.brand[600] },

  // Loading
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60, gap: 12 },
  loadingText     : { fontSize: 14, color: theme.colors.text.muted },

  // List
  listContent     : { paddingHorizontal: 16, paddingTop: 12 },

  // User card
  userCard        : { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9', gap: 12 },
  avatarWrapper   : { position: 'relative' },
  avatarImg       : { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2E8F0' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  avatarInitials  : { fontSize: 15, fontWeight: '700', color: theme.colors.brand[600] },
  statusDot       : { position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: '#FFFFFF' },

  userInfo        : { flex: 1, gap: 3 },
  userTopRow      : { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName        : { fontSize: 14, fontWeight: '700', color: theme.colors.text.primary, flex: 1 },
  userEmail       : { fontSize: 12, color: theme.colors.text.muted },
  userMeta        : { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  metaItem        : { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText        : { fontSize: 11, color: theme.colors.text.muted, fontWeight: '500' },

  // Badge
  badge           : { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, gap: 3 },
  badgeRenter     : { backgroundColor: '#E0F2FE' },
  badgeOwner      : { backgroundColor: '#EDE9FE' },
  badgeText       : { fontSize: 10, fontWeight: '700' },
  badgeTextRenter : { color: '#0284C7' },
  badgeTextOwner  : { color: '#7C3AED' },

  // Wallet
  walletBadge     : { alignItems: 'flex-end', minWidth: 56 },
  walletAmount    : { fontSize: 12, fontWeight: '700', color: '#10B981' },
  walletLabel     : { fontSize: 9, color: theme.colors.text.muted, fontWeight: '500' },

  // Empty
  emptyContainer  : { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 12 },
  emptyTitle      : { fontSize: 16, fontWeight: '700', color: theme.colors.text.primary, textAlign: 'center' },
  emptySubtitle   : { fontSize: 13, color: theme.colors.text.muted, textAlign: 'center', lineHeight: 20 },

  // Load more
  loadMoreIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  loadMoreText     : { fontSize: 13, color: theme.colors.text.muted },
});

export default UserManagementScreen;
