/**
 * ============================================================
 *  ADMIN EKYC SUBMISSIONS LIST SCREEN
 *  client/src/screens/admin/AdminEkycListScreen.tsx
 * ============================================================
 *  Purpose:
 *   - Screen for Administrators (Admin) to review identity verification
 *     (eKYC) applications submitted to the collection `ekyc_requests`.
 *   - Features:
 *       + Filter by status: All / Pending / Approved / Rejected
 *       + Search by: Applicant Name, Email, ID Number, Phone
 *       + Inspect applicant profile and 2 ID card photos (Front / Back)
 *       + Fullscreen zoom image modal
 *       + Pagination & Pull-to-refresh
 *       + Approve & Reject actions with reason selection modal
 *   - Anti-hardcoding standard: All strings reference STRINGS.ADMIN_EKYC
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
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerActions, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { STRINGS } from '../../constants/strings';
import {
  getAdminEkycList,
  getAdminOwnerEkycList,
  approveAdminEkyc,
  approveAdminOwnerEkyc,
  rejectAdminEkyc,
  rejectAdminOwnerEkyc,
  AdminEkycItem,
  AdminEkycCounts,
} from '../../services/ekycService';

const S = STRINGS.ADMIN_EKYC;

export type AdminEkycCategory = 'renter' | 'owner';

export interface AdminEkycListScreenProps {
  navigation?: any;
  initialCategory?: AdminEkycCategory;
}

type EkycFilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

interface FilterTabOption {
  key: EkycFilterStatus;
  label: string;
  countKey: keyof AdminEkycCounts;
}

const FILTER_TABS: FilterTabOption[] = [
  { key: 'all',      label: S.TABS.ALL,      countKey: 'totalAll' },
  { key: 'pending',  label: S.TABS.PENDING,  countKey: 'totalPending' },
  { key: 'approved', label: S.TABS.APPROVED, countKey: 'totalApproved' },
  { key: 'rejected', label: S.TABS.REJECTED, countKey: 'totalRejected' },
];

const SEARCH_DEBOUNCE_MS = 350;
const PAGE_LIMIT = 15;

const DEFAULT_EKYC_REJECT_REASONS = S.REJECT_MODAL.DEFAULT_REASONS;

export function AdminEkycListScreen({
  navigation,
  initialCategory = 'renter',
}: AdminEkycListScreenProps) {
  const insets = useSafeAreaInsets();

  const [activeCategory, setActiveCategory] = useState<AdminEkycCategory>(initialCategory);
  const [renterPendingCount, setRenterPendingCount] = useState(0);
  const [ownerPendingCount, setOwnerPendingCount] = useState(0);

  // State: list & pagination
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

  // Fullscreen photo preview
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageTitle, setPreviewImageTitle] = useState<string>('');

  // Actions: Approve / Reject
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [submissionToReject, setSubmissionToReject] = useState<AdminEkycItem | null>(null);
  const [selectedRejectReason, setSelectedRejectReason] = useState<string>(DEFAULT_EKYC_REJECT_REASONS[0]);
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Debounce search query
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

  // ── 1. Fetch Submissions from Backend ───────────────────────
  const fetchSubmissions = useCallback(
    async (
      targetCategory: AdminEkycCategory,
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
        const listFn = targetCategory === 'owner' ? getAdminOwnerEkycList : getAdminEkycList;
        const otherListFn = targetCategory === 'owner' ? getAdminEkycList : getAdminOwnerEkycList;

        const [response, otherCountsRes] = await Promise.all([
          listFn({
            status: targetStatus,
            search: targetSearch,
            page: targetPage,
            limit: PAGE_LIMIT,
          }),
          targetPage === 1
            ? otherListFn({ limit: 1 }).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (response.success) {
          if (targetPage === 1) {
            setSubmissions(response.data || []);
          } else {
            setSubmissions((prev) => [...prev, ...(response.data || [])]);
          }
          if (response.counts) {
            setCounts(response.counts);
            if (targetCategory === 'owner') {
              setOwnerPendingCount(response.counts.totalPending || 0);
            } else {
              setRenterPendingCount(response.counts.totalPending || 0);
            }
          }
          if (otherCountsRes?.success && otherCountsRes.counts) {
            if (targetCategory === 'owner') {
              setRenterPendingCount(otherCountsRes.counts.totalPending || 0);
            } else {
              setOwnerPendingCount(otherCountsRes.counts.totalPending || 0);
            }
          }
          setHasNextPage(response.pagination?.hasNextPage ?? false);
          setPage(targetPage);
        } else {
          setErrorMessage(response.message || S.ALERTS.LOAD_ERROR_DEFAULT);
        }
      } catch (err: any) {
        console.error('[AdminEkycListScreen] Fetch Error:', err);
        setErrorMessage(
          err.response?.data?.message || S.ALERTS.NETWORK_ERROR
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  // Reload when category, tab or search changes
  useEffect(() => {
    fetchSubmissions(activeCategory, activeTab, debouncedSearch, 1, false);
  }, [activeCategory, activeTab, debouncedSearch, fetchSubmissions]);

  useFocusEffect(
    useCallback(() => {
      fetchSubmissions(activeCategory, activeTab, debouncedSearch, 1, true);
    }, [activeCategory, activeTab, debouncedSearch, fetchSubmissions])
  );

  // Switch category tab (Renter eKYC vs Owner Upgrade)
  const handleSelectCategory = (cat: AdminEkycCategory) => {
    if (cat === activeCategory) return;
    setActiveCategory(cat);
    setPage(1);
    setSubmissions([]);
  };

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    fetchSubmissions(activeCategory, activeTab, debouncedSearch, 1, true);
  }, [activeCategory, activeTab, debouncedSearch, fetchSubmissions]);

  // Load more on end reached
  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasNextPage) {
      fetchSubmissions(activeCategory, activeTab, debouncedSearch, page + 1, false);
    }
  }, [isLoadingMore, hasNextPage, activeCategory, activeTab, debouncedSearch, page, fetchSubmissions]);

  // View enlarged image
  const handleViewImage = (url: string, title: string) => {
    if (!url) return;
    setPreviewImageUrl(url);
    setPreviewImageTitle(title);
  };

  // ── Handle Approve Submission ───────────────────────────────
  const handleApprovePress = useCallback((item: AdminEkycItem) => {
    const isOwnerCategory = activeCategory === 'owner';
    Alert.alert(
      isOwnerCategory ? S.ALERTS.CONFIRM_APPROVE_OWNER_TITLE : S.ALERTS.CONFIRM_APPROVE_TITLE,
      (isOwnerCategory ? S.ALERTS.CONFIRM_APPROVE_OWNER_MSG : S.ALERTS.CONFIRM_APPROVE_MSG)(
        item.user.name,
        item.idCardNumber || S.CARD.ID_NUMBER_EMPTY
      ),
      [
        { text: S.ALERTS.CANCEL, style: 'cancel' },
        {
          text: isOwnerCategory ? S.ACTIONS.APPROVE_OWNER : S.ACTIONS.APPROVE,
          onPress: async () => {
            try {
              setActionLoadingId(item._id);
              const res = isOwnerCategory
                ? await approveAdminOwnerEkyc(item._id)
                : await approveAdminEkyc(item._id);
              if (res.success) {
                // Update local list
                if (activeTab === 'pending') {
                  setSubmissions((prev) => prev.filter((s) => s._id !== item._id));
                } else {
                  setSubmissions((prev) =>
                    prev.map((s) =>
                      s._id === item._id
                        ? { ...s, status: 'approved' as const, rejectReason: '' }
                        : s
                    )
                  );
                }

                // Update tab counters
                setCounts((prev) => ({
                  ...prev,
                  totalPending: item.status === 'pending' ? Math.max(0, prev.totalPending - 1) : prev.totalPending,
                  totalApproved: item.status !== 'approved' ? prev.totalApproved + 1 : prev.totalApproved,
                  totalRejected: item.status === 'rejected' ? Math.max(0, prev.totalRejected - 1) : prev.totalRejected,
                }));
                if (item.status === 'pending') {
                  if (isOwnerCategory) {
                    setOwnerPendingCount((c) => Math.max(0, c - 1));
                  } else {
                    setRenterPendingCount((c) => Math.max(0, c - 1));
                  }
                }

                Alert.alert(
                  S.ALERTS.APPROVE_SUCCESS_TITLE,
                  isOwnerCategory ? S.ALERTS.APPROVE_OWNER_SUCCESS_MSG : S.ALERTS.APPROVE_SUCCESS_MSG
                );
              } else {
                Alert.alert(S.ALERTS.ERROR_TITLE, res.message || S.ALERTS.APPROVE_ERROR_DEFAULT);
              }
            } catch (err: any) {
              console.error('[AdminEkycListScreen] Approve error:', err);
              Alert.alert(S.ALERTS.ERROR_TITLE, err.response?.data?.message || S.ALERTS.NETWORK_ERROR);
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  }, [activeCategory, activeTab]);

  // ── Open Reject Modal ───────────────────────────────────────
  const handleOpenRejectModal = useCallback((item: AdminEkycItem) => {
    setSubmissionToReject(item);
    setSelectedRejectReason(DEFAULT_EKYC_REJECT_REASONS[0]);
    setCustomRejectReason('');
    setRejectModalVisible(true);
  }, []);

  // ── Close Reject Modal ──────────────────────────────────────
  const handleCloseRejectModal = useCallback(() => {
    if (isSubmittingReject) return;
    setRejectModalVisible(false);
    setSubmissionToReject(null);
    setCustomRejectReason('');
  }, [isSubmittingReject]);

  // ── Confirm Reject Submission ───────────────────────────────
  const handleConfirmReject = useCallback(async () => {
    if (!submissionToReject) return;
    const finalReason = customRejectReason.trim() || selectedRejectReason;
    if (!finalReason) {
      Alert.alert(S.ALERTS.REASON_REQUIRED_TITLE, S.ALERTS.REASON_REQUIRED_MSG);
      return;
    }

    const isOwnerCategory = activeCategory === 'owner';

    try {
      setIsSubmittingReject(true);
      const res = isOwnerCategory
        ? await rejectAdminOwnerEkyc(submissionToReject._id, finalReason)
        : await rejectAdminEkyc(submissionToReject._id, finalReason);
      if (res.success) {
        if (activeTab === 'pending') {
          setSubmissions((prev) => prev.filter((s) => s._id !== submissionToReject._id));
        } else {
          setSubmissions((prev) =>
            prev.map((s) =>
              s._id === submissionToReject._id
                ? { ...s, status: 'rejected' as const, rejectReason: finalReason }
                : s
            )
          );
        }

        setCounts((prev) => ({
          ...prev,
          totalPending: submissionToReject.status === 'pending' ? Math.max(0, prev.totalPending - 1) : prev.totalPending,
          totalApproved: submissionToReject.status === 'approved' ? Math.max(0, prev.totalApproved - 1) : prev.totalApproved,
          totalRejected: submissionToReject.status !== 'rejected' ? prev.totalRejected + 1 : prev.totalRejected,
        }));
        if (submissionToReject.status === 'pending') {
          if (isOwnerCategory) {
            setOwnerPendingCount((c) => Math.max(0, c - 1));
          } else {
            setRenterPendingCount((c) => Math.max(0, c - 1));
          }
        }

        setRejectModalVisible(false);
        setSubmissionToReject(null);
        setCustomRejectReason('');
        Alert.alert(
          S.ALERTS.REJECT_SUCCESS_TITLE,
          isOwnerCategory ? S.ALERTS.REJECT_OWNER_SUCCESS_MSG : S.ALERTS.REJECT_SUCCESS_MSG
        );
      } else {
        Alert.alert(S.ALERTS.ERROR_TITLE, res.message || S.ALERTS.REJECT_ERROR_DEFAULT);
      }
    } catch (err: any) {
      console.error('[AdminEkycListScreen] Reject error:', err);
      Alert.alert(S.ALERTS.ERROR_TITLE, err.response?.data?.message || S.ALERTS.NETWORK_ERROR);
    } finally {
      setIsSubmittingReject(false);
    }
  }, [submissionToReject, customRejectReason, selectedRejectReason, activeCategory, activeTab]);

  // Format date helper
  const formatDate = (dateString?: string) => {
    if (!dateString) return S.CARD.DATE_UNKNOWN;
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // Status badge config
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: S.STATUS_BADGES.PENDING,
          bg: '#FEF3C7',
          text: '#B45309',
          icon: 'time-outline' as const,
        };
      case 'approved':
        return {
          label: S.STATUS_BADGES.APPROVED,
          bg: '#ECFDF5',
          text: '#047857',
          icon: 'checkmark-circle' as const,
        };
      case 'rejected':
        return {
          label: S.STATUS_BADGES.REJECTED,
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

  // ── 2. Render Card Component ────────────────────────────────
  const renderItem = ({ item }: { item: AdminEkycItem }) => {
    const badge = getStatusBadge(item.status);
    const u = item.user;
    const isOwnerCategory = activeCategory === 'owner';
    const selfieUrl = item.selfieWithIdUrl || item.selfieUrl || '';

    return (
      <View style={styles.card}>
        {/* Row 1: User avatar + Name + Status badge */}
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
              <View style={[styles.roleTag, isOwnerCategory && styles.roleTagOwnerUpgrade]}>
                <Text style={[styles.roleTagText, isOwnerCategory && styles.roleTagOwnerUpgradeText]}>
                  {isOwnerCategory ? S.CARD.ROLE_UPGRADE_OWNER : S.CARD.ROLE_RENTER}
                </Text>
              </View>
            </View>
            <Text style={styles.timeText}>
              {S.CARD.SUBMITTED_AT(formatDate(item.createdAt))}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Ionicons name={badge.icon} size={12} color={badge.text} style={{ marginRight: 3 }} />
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        {/* Row 2: Contact Info (Email, Phone, Address) */}
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

        {/* Row 3: National ID Number Box */}
        <View style={styles.idNumberBox}>
          <View style={styles.idNumberLeft}>
            <Ionicons name="barcode-outline" size={20} color={theme.colors.brand[500]} />
            <Text style={styles.idNumberLabel}>{S.CARD.ID_NUMBER_LABEL}</Text>
          </View>
          <Text style={styles.idNumberValue}>
            {item.idCardNumber || S.CARD.ID_NUMBER_EMPTY}
          </Text>
        </View>

        {/* Row 4: ID Card Photos (Front & Back + Portrait Holding CCCD for Owner Upgrade) */}
        <View style={styles.photosSection}>
          <Text style={styles.photosSectionTitle}>
            {isOwnerCategory ? S.CARD.OWNER_PHOTOS_TITLE : S.CARD.PHOTOS_TITLE}
          </Text>
          <View style={styles.photosRow}>
            {/* Front Photo */}
            <TouchableOpacity
              style={styles.photoBox}
              activeOpacity={0.8}
              onPress={() =>
                handleViewImage(
                  item.idCardFrontUrl,
                  S.CARD.IMAGE_TITLE(S.CARD.FRONT_PHOTO, u.name)
                )
              }
            >
              <Image source={{ uri: item.idCardFrontUrl }} style={styles.idCardImage} resizeMode="cover" />
              <View style={styles.photoLabelBar}>
                <Ionicons name="scan-outline" size={13} color="#FFFFFF" />
                <Text style={styles.photoLabelText}>{S.CARD.FRONT_PHOTO}</Text>
              </View>
              <View style={styles.zoomHintIcon}>
                <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* Back Photo */}
            <TouchableOpacity
              style={styles.photoBox}
              activeOpacity={0.8}
              onPress={() =>
                handleViewImage(
                  item.idCardBackUrl,
                  S.CARD.IMAGE_TITLE(S.CARD.BACK_PHOTO, u.name)
                )
              }
            >
              <Image source={{ uri: item.idCardBackUrl }} style={styles.idCardImage} resizeMode="cover" />
              <View style={styles.photoLabelBar}>
                <Ionicons name="scan-outline" size={13} color="#FFFFFF" />
                <Text style={styles.photoLabelText}>{S.CARD.BACK_PHOTO}</Text>
              </View>
              <View style={styles.zoomHintIcon}>
                <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>

          {isOwnerCategory && selfieUrl ? (
            <TouchableOpacity
              style={styles.selfiePhotoBox}
              activeOpacity={0.8}
              onPress={() =>
                handleViewImage(
                  selfieUrl,
                  S.CARD.IMAGE_TITLE(S.CARD.SELFIE_WITH_ID_PHOTO, u.name)
                )
              }
            >
              <Image source={{ uri: selfieUrl }} style={styles.idCardImage} resizeMode="cover" />
              <View style={styles.photoLabelBar}>
                <Ionicons name="person-circle-outline" size={14} color="#FFFFFF" />
                <Text style={styles.photoLabelText}>{S.CARD.SELFIE_WITH_ID_PHOTO}</Text>
              </View>
              <View style={styles.zoomHintIcon}>
                <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Rejection reason box if rejected */}
        {item.status === 'rejected' && item.rejectReason ? (
          <View style={styles.rejectReasonBox}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.rejectReasonText}>
              {S.CARD.REJECT_REASON_PREFIX(item.rejectReason)}
            </Text>
          </View>
        ) : null}

        {/* Row 5: Action Buttons (Approve / Reject) */}
        <View style={styles.cardActionsRow}>
          {/* Reject Button (when not rejected) */}
          {item.status !== 'rejected' && (
            <TouchableOpacity
              style={[
                styles.rejectButton,
                item.status === 'approved' && styles.reRejectButton,
              ]}
              activeOpacity={0.7}
              onPress={() => handleOpenRejectModal(item)}
              disabled={actionLoadingId === item._id}
              accessibilityRole="button"
              accessibilityLabel={S.ACTIONS.REJECT}
            >
              <Ionicons
                name="close-circle-outline"
                size={16}
                color="#DC2626"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.rejectButtonText}>
                {item.status === 'approved' ? S.ACTIONS.REVOKE_APPROVAL : S.ACTIONS.REJECT}
              </Text>
            </TouchableOpacity>
          )}

          {/* Approve Button (when not approved) */}
          {item.status !== 'approved' && (
            <TouchableOpacity
              style={[
                styles.approveButton,
                item.status === 'rejected' && styles.reApproveButton,
              ]}
              activeOpacity={0.7}
              onPress={() => handleApprovePress(item)}
              disabled={actionLoadingId === item._id}
              accessibilityRole="button"
              accessibilityLabel={isOwnerCategory ? S.ACTIONS.APPROVE_OWNER : S.ACTIONS.APPROVE}
            >
              {actionLoadingId === item._id ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color="#FFFFFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.approveButtonText}>
                    {isOwnerCategory
                      ? item.status === 'rejected'
                        ? S.ACTIONS.RE_APPROVE_OWNER
                        : S.ACTIONS.APPROVE_OWNER
                      : item.status === 'rejected'
                      ? S.ACTIONS.RE_APPROVE
                      : S.ACTIONS.APPROVE}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Identity Verified Badge when approved */}
          {item.status === 'approved' && (
            <View style={styles.approvedNoticeBadge}>
              <Ionicons name="checkmark-circle" size={15} color="#047857" style={{ marginRight: 5 }} />
              <Text style={styles.approvedNoticeText}>
                {isOwnerCategory ? S.ACTIONS.OWNER_UPGRADED_NOTICE : S.ACTIONS.VERIFIED_NOTICE}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ── 3. Empty State ──────────────────────────────────────────
  const renderEmptyComponent = () => {
    if (isLoading) return null;
    const isOwnerCategory = activeCategory === 'owner';
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="finger-print-outline" size={64} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>{S.EMPTY_STATES.TITLE}</Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery
            ? S.EMPTY_STATES.SEARCH_EMPTY(searchQuery)
            : activeTab === 'pending'
            ? isOwnerCategory
              ? S.EMPTY_STATES.OWNER_PENDING_EMPTY
              : S.EMPTY_STATES.PENDING_EMPTY
            : isOwnerCategory
            ? S.EMPTY_STATES.OWNER_ALL_EMPTY
            : S.EMPTY_STATES.ALL_EMPTY}
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
          <Text style={styles.headerTitle}>
            {activeCategory === 'owner' ? S.HEADER.OWNER_TITLE : S.HEADER.TITLE}
          </Text>
          <Text style={styles.headerSubtitle}>
            {counts.totalPending > 0
              ? S.HEADER.SUBTITLE_PENDING(counts.totalPending)
              : S.HEADER.SUBTITLE_ALL_CLEAR}
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

      {/* ─── CATEGORY TABS (RENTER EKYC vs OWNER UPGRADE) ─── */}
      <View style={styles.categorySwitcherWrap}>
        <TouchableOpacity
          style={[
            styles.categoryTabBtn,
            activeCategory === 'renter' && styles.categoryTabBtnActive,
          ]}
          onPress={() => handleSelectCategory('renter')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={15}
            color={activeCategory === 'renter' ? theme.colors.brand[600] : '#64748B'}
          />
          <Text
            style={[
              styles.categoryTabText,
              activeCategory === 'renter' && styles.categoryTabTextActive,
            ]}
          >
            {S.CATEGORY_TABS.RENTER}
          </Text>
          {renterPendingCount > 0 && (
            <View
              style={[
                styles.categoryBadge,
                activeCategory === 'renter' && styles.categoryBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryBadgeText,
                  activeCategory === 'renter' && styles.categoryBadgeTextActive,
                ]}
              >
                {renterPendingCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.categoryTabBtn,
            activeCategory === 'owner' && styles.categoryTabBtnActive,
          ]}
          onPress={() => handleSelectCategory('owner')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="ribbon-outline"
            size={15}
            color={activeCategory === 'owner' ? theme.colors.brand[600] : '#64748B'}
          />
          <Text
            style={[
              styles.categoryTabText,
              activeCategory === 'owner' && styles.categoryTabTextActive,
            ]}
          >
            {S.CATEGORY_TABS.OWNER}
          </Text>
          {ownerPendingCount > 0 && (
            <View
              style={[
                styles.categoryBadge,
                activeCategory === 'owner' && styles.categoryBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryBadgeText,
                  activeCategory === 'owner' && styles.categoryBadgeTextActive,
                ]}
              >
                {ownerPendingCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── SEARCH BAR ─── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={S.SEARCH.PLACEHOLDER}
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

      {/* ─── FILTER TABS ─── */}
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

      {/* ─── ERROR BANNER ─── */}
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* ─── SUBMISSIONS FLATLIST ─── */}
      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
          <Text style={styles.loadingText}>{S.EMPTY_STATES.LOADING}</Text>
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
                <Text style={styles.loadingMoreText}>{S.EMPTY_STATES.LOADING_MORE}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={renderEmptyComponent}
        />
      )}

      {/* ─── FULLSCREEN ID CARD IMAGE PREVIEW MODAL ─── */}
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

      {/* ─── REJECT EKYC REASON MODAL ─── */}
      <Modal
        visible={rejectModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseRejectModal}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={handleCloseRejectModal}
        >
          <TouchableOpacity
            style={styles.rejectModalCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <View style={styles.rejectModalHeader}>
              <View style={styles.rejectModalIconWrap}>
                <Ionicons name="close-circle" size={24} color="#DC2626" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.rejectModalTitle}>
                  {activeCategory === 'owner' ? S.REJECT_MODAL.OWNER_TITLE : S.REJECT_MODAL.TITLE}
                </Text>
                <Text style={styles.rejectModalSubTitle} numberOfLines={1}>
                  {S.REJECT_MODAL.USER_PREFIX(submissionToReject?.user?.name || S.CARD.DATE_UNKNOWN)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.rejectModalCloseBtn}
                onPress={handleCloseRejectModal}
                disabled={isSubmittingReject}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.rejectModalBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.rejectReasonGuide}>
                {S.REJECT_MODAL.GUIDE}
              </Text>

              {/* Preset Reason Options */}
              <View style={styles.reasonsList}>
                {DEFAULT_EKYC_REJECT_REASONS.map((reason, index) => {
                  const isSelected = selectedRejectReason === reason && !customRejectReason;
                  return (
                    <TouchableOpacity
                      key={`reject_reason_${index}`}
                      style={[
                        styles.reasonRadioItem,
                        isSelected && styles.reasonRadioItemSelected,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedRejectReason(reason);
                        setCustomRejectReason('');
                      }}
                    >
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                      <Text
                        style={[
                          styles.reasonRadioText,
                          isSelected && styles.reasonRadioTextActive,
                        ]}
                      >
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Reason Input */}
              <Text style={styles.customReasonLabel}>{S.REJECT_MODAL.CUSTOM_REASON_LABEL}</Text>
              <TextInput
                style={styles.customReasonInput}
                placeholder={S.REJECT_MODAL.CUSTOM_REASON_PLACEHOLDER}
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                value={customRejectReason}
                onChangeText={(text) => {
                  setCustomRejectReason(text);
                }}
                textAlignVertical="top"
                editable={!isSubmittingReject}
              />
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.rejectModalActions}>
              <TouchableOpacity
                style={styles.rejectModalCancelBtn}
                onPress={handleCloseRejectModal}
                disabled={isSubmittingReject}
              >
                <Text style={styles.rejectModalCancelText}>{S.REJECT_MODAL.CANCEL_BTN}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.rejectModalSubmitBtn,
                  isSubmittingReject && { opacity: 0.7 },
                ]}
                onPress={handleConfirmReject}
                disabled={isSubmittingReject}
              >
                {isSubmittingReject ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.rejectModalSubmitText}>{S.REJECT_MODAL.SUBMIT_BTN}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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

  // Category Switcher (Renter eKYC vs Owner Upgrade)
  categorySwitcherWrap: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  categoryTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 9999,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  categoryTabBtnActive: {
    backgroundColor: theme.colors.brand[100],
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryTabTextActive: {
    color: theme.colors.brand[600],
    fontWeight: '700',
  },
  categoryBadge: {
    backgroundColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  categoryBadgeActive: {
    backgroundColor: theme.colors.brand[500],
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  categoryBadgeTextActive: {
    color: '#FFFFFF',
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
  roleTagOwnerUpgrade: {
    backgroundColor: '#E6F7F7',
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
  },
  roleTagOwnerUpgradeText: {
    color: '#0F766E',
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
  selfiePhotoBox: {
    marginTop: 10,
    width: '100%',
    height: 170,
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

  // Action Buttons
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  reRejectButton: {
    flex: undefined,
    paddingHorizontal: 14,
  },
  rejectButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D9488',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  reApproveButton: {
    backgroundColor: '#059669',
  },
  approveButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  approvedNoticeBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  approvedNoticeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
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

  // Reject Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  rejectModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  rejectModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  rejectModalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  rejectModalSubTitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  rejectModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  rejectModalBody: {
    padding: 16,
  },
  rejectReasonGuide: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 18,
  },
  reasonsList: {
    gap: 8,
    marginBottom: 14,
  },
  reasonRadioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reasonRadioItemSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  radioCircleActive: {
    borderColor: '#DC2626',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  reasonRadioText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },
  reasonRadioTextActive: {
    color: '#B91C1C',
    fontWeight: '600',
  },
  customReasonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  customReasonInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 70,
  },
  rejectModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  rejectModalCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  rejectModalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  rejectModalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  rejectModalSubmitText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default AdminEkycListScreen;
