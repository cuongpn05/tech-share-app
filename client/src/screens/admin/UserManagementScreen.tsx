/**
 * ============================================================
 *  USER MANAGEMENT SCREEN
 *  client/src/screens/admin/UserManagementScreen.tsx
 * ============================================================
 *  Admin Dashboard member management screen.
 *  Features:
 *   - Member list display (renters & owners)
 *   - Real-time search by name / email / username (debounce 400ms)
 *   - Role filter (All / Renters / Owners)
 *   - Status filter (All / Active / Locked)
 *   - Lock / Unlock user account with reason & real-time session kick-out
 *   - Pagination & Pull-to-refresh
 *   - 100% localized via STRINGS.ADMIN_USER_MANAGEMENT
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
  Modal,
  Alert,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import {
  fetchUsersList,
  toggleUserStatus,
  MemberUser,
  Pagination,
} from '../../services/userManagementService';
import { STRINGS } from '../../constants/strings';

const S = STRINGS.ADMIN_USER_MANAGEMENT;

type RoleFilter   = '' | 'renter' | 'owner';
type StatusFilter = '' | 'active' | 'inactive';

export interface UserManagementScreenProps {
  navigation?: any;
}

// ─────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────

const ROLE_TABS = S.ROLE_TABS as readonly { label: string; value: RoleFilter }[];
const STATUS_TABS = S.STATUS_TABS as readonly { label: string; value: StatusFilter }[];

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
  if (!iso) return S.CARD.DATE_UNKNOWN;
  try {
    return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return S.CARD.DATE_UNKNOWN;
  }
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
        {isOwner ? S.CARD.ROLE_OWNER : S.CARD.ROLE_RENTER}
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

interface UserListItemProps {
  item: MemberUser;
  onLockPress: (user: MemberUser) => void;
  onUnlockPress: (user: MemberUser) => void;
}

const UserListItem: React.FC<UserListItemProps> = ({ item, onLockPress, onUnlockPress }) => (
  <View style={[styles.userCard, !item.isActive && styles.userCardLocked]}>
    {/* Upper Section */}
    <View style={styles.cardMainRow}>
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
              {item.isVerified ? S.STATUS_LABELS.VERIFIED : S.STATUS_LABELS.UNVERIFIED}
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
        <Text style={styles.walletAmount}>{item.walletBalance.toLocaleString('en-US')}</Text>
        <Text style={styles.walletLabel}>{S.CARD.CURRENCY}</Text>
      </View>
    </View>

    {/* Locked Reason Warning Banner */}
    {!item.isActive && (
      <View style={styles.lockReasonBanner}>
        <Ionicons name="alert-circle" size={14} color="#DC2626" />
        <Text style={styles.lockReasonText} numberOfLines={2}>
          {S.CARD.LOCK_REASON_PREFIX(item.lockReason || 'Policy violation')}
        </Text>
      </View>
    )}

    {/* Card Action Footer */}
    <View style={styles.cardActionRow}>
      <View style={styles.statusIndicatorRow}>
        <View style={[styles.miniStatusDot, { backgroundColor: item.isActive ? '#10B981' : '#EF4444' }]} />
        <Text style={[styles.miniStatusText, { color: item.isActive ? '#059669' : '#DC2626' }]}>
          {item.isActive ? S.STATUS_LABELS.ACTIVE : S.STATUS_LABELS.LOCKED}
        </Text>
      </View>

      {item.isActive ? (
        <TouchableOpacity
          style={styles.actionBtnLock}
          onPress={() => onLockPress(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="lock-closed-outline" size={13} color="#DC2626" />
          <Text style={styles.actionBtnLockText}>{S.CARD.ACTION_LOCK}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.actionBtnUnlock}
          onPress={() => onUnlockPress(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="lock-open-outline" size={13} color="#16A34A" />
          <Text style={styles.actionBtnUnlockText}>{S.CARD.ACTION_UNLOCK}</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────
//  Main Screen
// ─────────────────────────────────────────────────────────

export function UserManagementScreen({ navigation }: UserManagementScreenProps) {
  const insets = useSafeAreaInsets();
  const internalNav = useNavigation<any>();
  const nav = navigation || internalNav;

  const handleOpenDrawer = useCallback(() => {
    try {
      if (nav?.dispatch) {
        nav.dispatch(DrawerActions.openDrawer());
      } else if (nav?.openDrawer) {
        nav.openDrawer();
      } else if (nav?.getParent?.()?.dispatch) {
        nav.getParent().dispatch(DrawerActions.openDrawer());
      } else if (nav?.getParent?.()?.openDrawer) {
        nav.getParent().openDrawer();
      }
    } catch (e) {
      console.warn('[UserManagement] Drawer open failed:', e);
    }
  }, [nav]);

  const [search,          setSearch]          = useState('');
  const [roleFilter,      setRoleFilter]      = useState<RoleFilter>('');
  const [statusFilter,    setStatusFilter]    = useState<StatusFilter>('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [users,       setUsers]       = useState<MemberUser[]>([]);
  const [pagination,  setPagination]  = useState<Pagination | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Lock Modal State
  const [lockModalVisible,    setLockModalVisible]    = useState(false);
  const [selectedUserForLock, setSelectedUserForLock] = useState<MemberUser | null>(null);
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>(S.LOCK_MODAL.PRESET_REASONS[0]);
  const [customLockReason,    setCustomLockReason]    = useState<string>('');
  const [submittingLock,      setSubmittingLock]      = useState(false);

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
        setError(response.message || S.ALERTS.LOAD_ERROR);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || S.ALERTS.NETWORK_ERROR);
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

  // ── Lock & Unlock Handlers ─────────────────────────────

  const handleOpenLockModal = useCallback((user: MemberUser) => {
    setSelectedUserForLock(user);
    setSelectedPresetReason(S.LOCK_MODAL.PRESET_REASONS[0]);
    setCustomLockReason('');
    setLockModalVisible(true);
  }, []);

  const handleConfirmLock = async () => {
    if (!selectedUserForLock) return;

    const finalReason = customLockReason.trim() || selectedPresetReason;
    if (!finalReason) {
      Alert.alert(S.ALERTS.REASON_REQUIRED_TITLE, S.ALERTS.REASON_REQUIRED_MSG);
      return;
    }

    try {
      setSubmittingLock(true);
      const res = await toggleUserStatus(selectedUserForLock._id, false, finalReason);

      if (res.success) {
        const targetUserId = selectedUserForLock._id;
        const targetName = selectedUserForLock.name;

        // Update local user list state immediately
        setUsers(prev => prev.map(u => u._id === targetUserId ? {
          ...u,
          isActive: false,
          lockReason: finalReason,
          lockedAt: new Date().toISOString(),
        } : u));

        setLockModalVisible(false);
        setSelectedUserForLock(null);
        Alert.alert(S.ALERTS.LOCK_SUCCESS_TITLE, S.ALERTS.LOCK_SUCCESS_MSG(targetName));
      } else {
        Alert.alert(S.ALERTS.ERROR_TITLE, res.message || S.ALERTS.ACTION_ERROR);
      }
    } catch (err: any) {
      Alert.alert(S.ALERTS.ERROR_TITLE, err.response?.data?.message || err.message || S.ALERTS.ACTION_ERROR);
    } finally {
      setSubmittingLock(false);
    }
  };

  const handleConfirmUnlock = useCallback((user: MemberUser) => {
    Alert.alert(
      S.UNLOCK_ALERT.TITLE,
      S.UNLOCK_ALERT.MSG(user.name),
      [
        { text: S.UNLOCK_ALERT.CANCEL, style: 'cancel' },
        {
          text: S.UNLOCK_ALERT.CONFIRM,
          style: 'default',
          onPress: async () => {
            try {
              const res = await toggleUserStatus(user._id, true);
              if (res.success) {
                // Update local user list state immediately
                setUsers(prev => prev.map(u => u._id === user._id ? {
                  ...u,
                  isActive: true,
                  lockReason: undefined,
                  lockedAt: undefined,
                } : u));

                Alert.alert(S.ALERTS.UNLOCK_SUCCESS_TITLE, S.ALERTS.UNLOCK_SUCCESS_MSG(user.name));
              } else {
                Alert.alert(S.ALERTS.ERROR_TITLE, res.message || S.ALERTS.ACTION_ERROR);
              }
            } catch (err: any) {
              Alert.alert(S.ALERTS.ERROR_TITLE, err.response?.data?.message || err.message || S.ALERTS.ACTION_ERROR);
            }
          },
        },
      ]
    );
  }, []);

  // ── Render ─────────────────────────────────────────────

  const totalCount = pagination?.total ?? 0;

  const renderEmpty = () => loading ? null : (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={56} color={theme.colors.text.muted} />
      <Text style={styles.emptyTitle}>{S.EMPTY_STATES.TITLE}</Text>
      <Text style={styles.emptySubtitle}>
        {debouncedSearch ? S.EMPTY_STATES.SEARCH_EMPTY(debouncedSearch) : S.EMPTY_STATES.FILTER_EMPTY}
      </Text>
    </View>
  );

  const renderFooter = () => !loadingMore ? null : (
    <View style={styles.loadMoreIndicator}>
      <ActivityIndicator size="small" color={theme.colors.brand[500]} />
      <Text style={styles.loadMoreText}>{S.EMPTY_STATES.LOADING_MORE}</Text>
    </View>
  );

  const topPad = insets.top + (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleOpenDrawer}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Open navigation menu"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="menu-outline" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{S.HEADER.TITLE}</Text>
          <Text style={styles.headerSub}>
            {loading ? S.HEADER.LOADING : S.HEADER.SUBTITLE(totalCount)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleRefresh}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={22} color={theme.colors.brand[500]} />
        </TouchableOpacity>
      </View>

      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={theme.colors.text.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={S.SEARCH.PLACEHOLDER}
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
            <Text style={styles.errorRetry}>{S.ALERTS.RETRY}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LOADING INITIAL */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
          <Text style={styles.loadingText}>{S.HEADER.LOADING}</Text>
        </View>
      )}

      {/* LIST */}
      {!loading && (
        <FlatList
          data={users}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <UserListItem
              item={item}
              onLockPress={handleOpenLockModal}
              onUnlockPress={handleConfirmUnlock}
            />
          )}
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
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {/* LOCK ACCOUNT MODAL */}
      <Modal
        visible={lockModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!submittingLock) setLockModalVisible(false); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderTitleRow}>
                    <Ionicons name="lock-closed" size={20} color="#DC2626" />
                    <Text style={styles.modalTitle}>{S.LOCK_MODAL.TITLE}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setLockModalVisible(false)}
                    disabled={submittingLock}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={22} color={theme.colors.text.muted} />
                  </TouchableOpacity>
                </View>

                {/* Target User Banner */}
                {selectedUserForLock && (
                  <View style={styles.modalUserBanner}>
                    <Ionicons name="person-circle-outline" size={28} color="#DC2626" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalUserName} numberOfLines={1}>{selectedUserForLock.name}</Text>
                      <Text style={styles.modalUserSub} numberOfLines={1}>
                        @{selectedUserForLock.username}  ·  {selectedUserForLock.email}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Guide Description */}
                <Text style={styles.modalGuideText}>{S.LOCK_MODAL.GUIDE}</Text>

                {/* Preset Reasons (Radio buttons) */}
                <ScrollView style={styles.presetList} showsVerticalScrollIndicator={false}>
                  {S.LOCK_MODAL.PRESET_REASONS.map((reason, index) => {
                    const isSelected = selectedPresetReason === reason && !customLockReason.trim();
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.radioItem, isSelected && styles.radioItemSelected]}
                        onPress={() => {
                          setSelectedPresetReason(reason);
                          setCustomLockReason('');
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                          {isSelected && <View style={styles.radioInnerDot} />}
                        </View>
                        <Text style={[styles.radioLabel, isSelected && styles.radioLabelSelected]}>
                          {reason}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Custom Reason Input */}
                <View style={styles.customReasonContainer}>
                  <Text style={styles.customReasonLabel}>{S.LOCK_MODAL.CUSTOM_REASON_LABEL}</Text>
                  <TextInput
                    style={styles.customReasonInput}
                    placeholder={S.LOCK_MODAL.CUSTOM_REASON_PLACEHOLDER}
                    placeholderTextColor={theme.colors.text.subtle}
                    value={customLockReason}
                    onChangeText={setCustomLockReason}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    editable={!submittingLock}
                  />
                </View>

                {/* Footer Buttons */}
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setLockModalVisible(false)}
                    disabled={submittingLock}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalCancelBtnText}>{S.LOCK_MODAL.CANCEL_BTN}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalConfirmBtn, submittingLock && styles.btnDisabled]}
                    onPress={handleConfirmLock}
                    disabled={submittingLock}
                    activeOpacity={0.8}
                  >
                    {submittingLock ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
                        <Text style={styles.modalConfirmBtnText}>{S.LOCK_MODAL.CONFIRM_BTN}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
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
  headerBtn       : { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
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
  userCard        : { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9', gap: 10 },
  userCardLocked  : { borderColor: '#FECACA', backgroundColor: '#FFFDFD' },
  cardMainRow     : { flexDirection: 'row', alignItems: 'center', gap: 12 },

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

  // Lock Reason Banner
  lockReasonBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5' },
  lockReasonText  : { flex: 1, fontSize: 11, color: '#B91C1C', fontWeight: '500' },

  // Card Action Footer
  cardActionRow   : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8, marginTop: 2 },
  statusIndicatorRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniStatusDot   : { width: 6, height: 6, borderRadius: 3 },
  miniStatusText  : { fontSize: 11, fontWeight: '600' },

  actionBtnLock   : { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  actionBtnLockText: { fontSize: 11, fontWeight: '700', color: '#DC2626' },

  actionBtnUnlock : { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  actionBtnUnlockText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },

  // Empty
  emptyContainer  : { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 12 },
  emptyTitle      : { fontSize: 16, fontWeight: '700', color: theme.colors.text.primary, textAlign: 'center' },
  emptySubtitle   : { fontSize: 13, color: theme.colors.text.muted, textAlign: 'center', lineHeight: 20 },

  // Load more
  loadMoreIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  loadMoreText     : { fontSize: 13, color: theme.colors.text.muted },

  // ── Modal Styles ─────────────────────────────────────────
  modalOverlay    : { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.65)' },
  modalBackdrop   : { width: '100%', paddingHorizontal: 20, alignItems: 'center' },
  modalCard       : { width: '100%', maxWidth: 440, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 10, maxHeight: '88%' },

  modalHeader     : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle      : { fontSize: 16, fontWeight: '700', color: '#0F172A' },

  modalUserBanner : { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA', marginBottom: 12 },
  modalUserName   : { fontSize: 13, fontWeight: '700', color: '#991B1B' },
  modalUserSub    : { fontSize: 11, color: '#B91C1C', marginTop: 1 },

  modalGuideText  : { fontSize: 12, color: theme.colors.text.muted, marginBottom: 10, lineHeight: 17 },

  presetList      : { maxHeight: 180, marginBottom: 12 },
  radioItem       : { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, marginBottom: 4, backgroundColor: '#F8FAFC' },
  radioItemSelected: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  radioCircle     : { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: '#94A3B8', alignItems: 'center', justifyContent: 'center' },
  radioCircleSelected: { borderColor: '#DC2626' },
  radioInnerDot   : { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' },
  radioLabel      : { fontSize: 12, color: theme.colors.text.primary, flex: 1 },
  radioLabelSelected: { color: '#991B1B', fontWeight: '600' },

  customReasonContainer: { marginBottom: 16 },
  customReasonLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.text.secondary, marginBottom: 6 },
  customReasonInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 10, fontSize: 12, color: theme.colors.text.primary, minHeight: 64 },

  modalFooter     : { flexDirection: 'row', gap: 10 },
  modalCancelBtn  : { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  modalCancelBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.text.secondary },
  modalConfirmBtn : { flex: 1.5, paddingVertical: 11, borderRadius: 10, backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  modalConfirmBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled     : { opacity: 0.6 },
});

export default UserManagementScreen;
