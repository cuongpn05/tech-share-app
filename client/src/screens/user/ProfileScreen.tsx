import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../store';
import { updateUser } from '../../store/slices/authSlice';
import { confirmAndLogout } from '../../services/logoutService';
import { userService } from '../../services/userService';
import { getEkycStatus } from '../../services/ekycService';
import {
  optimizeCloudinaryUrl,
  preloadCloudinaryConfig,
} from '../../services/cloudinaryUploadService';
import { theme } from '../../constants/theme';
import {
  ActionConfirmModal,
  ActionResultModal,
  ActionResultType,
  FeedbackSummaryItem,
} from '../../components/common/ActionFeedbackModals';
import { GuestPromptView } from '../../components/common/GuestPromptView';
import {
  ImageSourcePickerModal,
  ImageSourcePickerOptions,
} from '../../components/common/ImageSourcePickerModal';
import { STRINGS } from '../../constants/strings';
import { User } from '../../types';

export interface ProfileScreenProps {
  navigation?: any;
  onBack?: () => void;
  onNavigateToWishlist?: () => void;
}

export function ProfileScreen({ navigation, onBack, onNavigateToWishlist }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { isAuthenticated, user: authUser } = useAppSelector((state) => state.auth);

  // Local state - Chỉ giữ các thông tin cơ bản theo yêu cầu
  const [profile, setProfile] = useState<User>(() => ({
    _id: authUser?._id || 'guest',
    name: authUser?.name || '',
    email: authUser?.email || '',
    phone: authUser?.phone || '',
    address:
      typeof authUser?.address === 'string'
        ? authUser.address
        : authUser?.address?.fullAddress || '',
    avatar: authUser?.avatar || '',
    trust: authUser?.trust,
    trustScore: authUser?.trust?.score ?? authUser?.trustScore,
    rating: authUser?.rating,
    totalReviews: authUser?.totalReviews ?? authUser?.totalReview ?? 0,
  }));

  const [refreshing, setRefreshing] = useState(false);

  // Modal chỉnh sửa thông tin cơ bản
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editPhone, setEditPhone] = useState(profile.phone || '');
  const [editEmail, setEditEmail] = useState(profile.email || '');
  const [editAddress, setEditAddress] = useState(
    typeof profile.address === 'string'
      ? profile.address
      : profile.address?.fullAddress || ''
  );
  const [isSaving, setIsSaving] = useState(false);

  // Đồng bộ khi authUser trong Redux thay đổi
  useEffect(() => {
    if (authUser) {
      setProfile((prev) => ({
        ...prev,
        ...authUser,
        email: authUser.email || prev.email || '',
        address:
          typeof authUser.address === 'string'
            ? authUser.address
            : authUser.address?.fullAddress || '',
        avatar: authUser.avatar || '',
      }));
    }
  }, [authUser]);

  const [ekycStatusVerified, setEkycStatusVerified] = useState<boolean | null>(null);
  const [ownerEkycStatus, setOwnerEkycStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [addressPromptVisible, setAddressPromptVisible] = useState(false);
  const [editProfileError, setEditProfileError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPickerOptions, setAvatarPickerOptions] = useState<ImageSourcePickerOptions | null>(null);
  const [resultModal, setResultModal] = useState<{
    visible: boolean;
    type: ActionResultType;
    title: string;
    message: string;
    summaryItems?: FeedbackSummaryItem[];
  }>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });
  const editModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (editModalTimerRef.current) {
        clearTimeout(editModalTimerRef.current);
      }
      if (saveModalTimerRef.current) {
        clearTimeout(saveModalTimerRef.current);
      }
    };
  }, []);

  // Tải lại hồ sơ mới nhất từ API & cache sẵn config Cloudinary để upload 1-hop nhanh nhất
  const fetchFreshProfile = useCallback(async () => {
    preloadCloudinaryConfig();
    try {
      const data = await userService.getProfile();
      if (data?.user) {
        const resolvedRole = (data.account?.role || data.user.role) as User['role'];
        const resolvedTotalReviews = data.user.totalReviews ?? data.user.totalReview ?? 0;
        const resolvedTrustScore = data.user.trust?.score ?? data.user.trustScore;
        setProfile((prev) => ({
          ...prev,
          ...data.user,
          totalReviews: resolvedTotalReviews,
          trustScore: resolvedTrustScore,
          role: resolvedRole || prev.role,
          email: data.account?.email || data.user.email || prev.email,
        }));
        dispatch(
          updateUser({
            ...data.user,
            totalReviews: resolvedTotalReviews,
            trustScore: resolvedTrustScore,
            ...(resolvedRole ? { role: resolvedRole } : {}),
            email: data.account?.email || data.user.email,
          })
        );
      }
    } catch {
      // Bỏ qua lỗi kết nối và giữ state hiện tại
    }

    try {
      const ekycRes = await getEkycStatus();
      if (ekycRes.success && ekycRes.data) {
        setEkycStatusVerified(Boolean(ekycRes.data.isVerified));
        setOwnerEkycStatus(ekycRes.data.ownerEkycRequest?.status || 'none');
      }
    } catch {
      // Bỏ qua lỗi kết nối eKYC
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchFreshProfile();
      }
    }, [isAuthenticated, fetchFreshProfile])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFreshProfile();
    setRefreshing(false);
  }, [fetchFreshProfile]);

  // Mở modal sửa thông tin
  const openEditModal = () => {
    setEditName(profile.name);
    setEditPhone(profile.phone || '');
    setEditEmail(profile.email || '');
    setEditAddress(
      typeof profile.address === 'string'
        ? profile.address
        : profile.address?.fullAddress || ''
    );
    setEditProfileError('');
    setIsEditModalVisible(true);
  };

  // Save profile
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setEditProfileError(STRINGS.PROFILE_SCREEN.ALERT_NAME_REQUIRED);
      return;
    }

    setEditProfileError('');
    setIsSaving(true);
    try {
      await userService.updateProfile({
        name: editName.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
      });

      const updatedData: Partial<User> = {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        address: editAddress.trim(),
      };

      setProfile((prev) => ({
        ...prev,
        ...updatedData,
      }));
      dispatch(updateUser(updatedData));
      setIsEditModalVisible(false);

      const summary: FeedbackSummaryItem[] = [
        {
          icon: 'person-outline',
          label: STRINGS.PROFILE_SCREEN.SAVE_SUMMARY_NAME,
          value: editName.trim(),
        },
        ...(editPhone.trim()
          ? [
              {
                icon: 'call-outline' as const,
                label: STRINGS.PROFILE_SCREEN.SAVE_SUMMARY_PHONE,
                value: editPhone.trim(),
              },
            ]
          : []),
        ...(editAddress.trim()
          ? [
              {
                icon: 'location-outline' as const,
                label: STRINGS.PROFILE_SCREEN.SAVE_SUMMARY_ADDRESS,
                value: editAddress.trim(),
              },
            ]
          : []),
      ];

      if (saveModalTimerRef.current) {
        clearTimeout(saveModalTimerRef.current);
      }
      saveModalTimerRef.current = setTimeout(() => {
        setResultModal({
          visible: true,
          type: 'success',
          title: STRINGS.PROFILE_SCREEN.ALERT_SUCCESS_TITLE,
          message: STRINGS.PROFILE_SCREEN.ALERT_SUCCESS_MSG,
          summaryItems: summary,
        });
      }, 180);
    } catch (err: any) {
      setEditProfileError(
        err.response?.data?.message || STRINGS.PROFILE_SCREEN.ALERT_SAVE_ERROR_DEFAULT
      );
    } finally {
      setIsSaving(false);
    }
  };

  const avatarBeforeUploadRef = useRef<string | null | undefined>(profile.avatar);

  const handleUploadSelectedAvatar = useCallback(
    async (localUri: string) => {
      avatarBeforeUploadRef.current = profile.avatar;
      // Hiển thị preview cục bộ ngay lập tức (0ms) trong lúc tải lên Cloudinary ở nền
      setProfile((prev) => ({ ...prev, avatar: localUri }));
      try {
        setUploadingAvatar(true);
        const res = await userService.uploadAvatar(localUri);
        setProfile((prev) => ({ ...prev, avatar: res.avatar }));
        dispatch(updateUser({ avatar: res.avatar }));
        setResultModal({
          visible: true,
          type: 'success',
          title: STRINGS.PROFILE_SCREEN.AVATAR_UPLOAD_SUCCESS_TITLE,
          message: STRINGS.PROFILE_SCREEN.AVATAR_UPLOAD_SUCCESS_MSG,
          summaryItems: [
            {
              icon: 'image-outline',
              label: STRINGS.PROFILE_SCREEN.AVATAR_SUMMARY_ITEM,
              value: STRINGS.PROFILE_SCREEN.AVATAR_SUMMARY_VALUE,
            },
            {
              icon: 'checkmark-circle-outline',
              label: STRINGS.PROFILE_SCREEN.AVATAR_SUMMARY_STATUS,
              value: STRINGS.PROFILE_SCREEN.AVATAR_SUMMARY_STATUS_VALUE,
            },
          ],
        });
      } catch (err: any) {
        setProfile((prev) => ({ ...prev, avatar: avatarBeforeUploadRef.current || '' }));
        setResultModal({
          visible: true,
          type: 'error',
          title: STRINGS.PROFILE_SCREEN.AVATAR_UPLOAD_ERROR_TITLE,
          message:
            err?.response?.data?.message ||
            err?.message ||
            STRINGS.PROFILE_SCREEN.AVATAR_UPLOAD_ERROR_MSG,
        });
      } finally {
        setUploadingAvatar(false);
      }
    },
    [dispatch, profile.avatar]
  );

  const handleOpenAvatarPicker = useCallback(
    (fromEditModal = false) => {
      if (uploadingAvatar) return;

      const options: ImageSourcePickerOptions = {
        title: STRINGS.PROFILE_SCREEN.AVATAR_PICKER_TITLE,
        description: STRINGS.PROFILE_SCREEN.AVATAR_PICKER_DESC,
        aspect: [1, 1],
        cropShape: 'oval',
        quality: 0.45,
        cameraType: ImagePicker.CameraType.front,
        onSelected: (uri) => {
          handleUploadSelectedAvatar(uri);
        },
      };

      if (fromEditModal) {
        setIsEditModalVisible(false);
        if (editModalTimerRef.current) {
          clearTimeout(editModalTimerRef.current);
        }
        editModalTimerRef.current = setTimeout(() => {
          setAvatarPickerOptions(options);
        }, 180);
        return;
      }

      setAvatarPickerOptions(options);
    },
    [uploadingAvatar, handleUploadSelectedAvatar]
  );

  // Sign out
  const handleSignOut = () => {
    confirmAndLogout({
      dispatch,
      title: STRINGS.PROFILE_SCREEN.LOGOUT_ALERT_TITLE,
      message: STRINGS.PROFILE_SCREEN.LOGOUT_ALERT_MSG,
      confirmText: STRINGS.PROFILE_SCREEN.LOGOUT_BUTTON,
      cancelText: STRINGS.COMMON.CANCEL,
    });
  };

  const displayAddress =
    typeof profile.address === 'string'
      ? profile.address
      : profile.address?.fullAddress || '';

  const isUserVerified =
    ekycStatusVerified !== null
      ? ekycStatusVerified
      : Boolean(
          authUser?.role === 'admin' ||
          profile?.role === 'admin' ||
          (Boolean(authUser?.isVerified) && Boolean(profile?.isVerified))
        );

  // Navigate to eKYC verification
  const navigateWithAddressCheck = (routeName: 'EkycVerification' | 'OwnerEkycVerification') => {
    const rawAddress = (displayAddress || '').trim();

    if (!rawAddress) {
      setAddressPromptVisible(true);
      return;
    }

    if (navigation?.navigate) {
      navigation.navigate(routeName);
    }
  };

  const handleConfirmAddressPrompt = () => {
    setAddressPromptVisible(false);
    if (editModalTimerRef.current) {
      clearTimeout(editModalTimerRef.current);
    }
    editModalTimerRef.current = setTimeout(() => {
      openEditModal();
    }, 150);
  };

  const handleNavigateToEkyc = () => navigateWithAddressCheck('EkycVerification');
  const handleNavigateToOwnerEkyc = () => navigateWithAddressCheck('OwnerEkycVerification');

  const currentRole = profile?.role || authUser?.role || 'renter';
  const showOwnerEkycRow = Boolean(
    isUserVerified &&
      currentRole !== 'admin' &&
      (currentRole === 'renter' || ownerEkycStatus !== 'none' || currentRole === 'owner')
  );
  const effectiveOwnerStatus: 'none' | 'pending' | 'approved' | 'rejected' =
    currentRole === 'owner' ? 'approved' : ownerEkycStatus;

  const reviewCount = Number(profile.totalReviews ?? profile.totalReview ?? 0);
  const hasReviews = Number.isFinite(reviewCount) && reviewCount > 0;
  const ratingValue =
    typeof profile.rating === 'number' && Number.isFinite(profile.rating) && profile.rating > 0
      ? profile.rating
      : null;
  const hasDisplayableRating = hasReviews && ratingValue !== null;

  const resolvedTrustScore =
    typeof profile.trust?.score === 'number' && Number.isFinite(profile.trust.score)
      ? profile.trust.score
      : typeof profile.trustScore === 'number' && Number.isFinite(profile.trustScore)
      ? profile.trustScore
      : null;
  const hasDisplayableTrustScore = hasReviews && resolvedTrustScore !== null;

  if (!isAuthenticated) {
    return (
      <GuestPromptView
        icon="person-outline"
        title={STRINGS.PROFILE_SCREEN.GUEST_NAME}
        subtitle={STRINGS.PROFILE_SCREEN.GUEST_DESC}
        buttonText={STRINGS.PROFILE_SCREEN.LOGIN_SIGNUP_BUTTON}
        onLoginPress={() => navigation?.navigate('Login')}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* ─── Top Header Bar ─── */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop:
              Platform.OS === 'android'
                ? (StatusBar.currentHeight || 0) + 8
                : insets.top + 8,
          },
        ]}
      >
        {onBack ? (
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}

        <Text style={styles.headerTitle}>{STRINGS.PROFILE_SCREEN.HEADER_TITLE}</Text>

        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={openEditModal}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={22} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
          {/* ─── 1. AVATAR, NAME & RATING CARD ─── */}
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.avatarWrapper}
                onPress={() => handleOpenAvatarPicker(false)}
                disabled={uploadingAvatar}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={STRINGS.PROFILE_SCREEN.AVATAR_CHANGE_BTN}
              >
                {profile.avatar ? (
                  <Image
                    source={{ uri: optimizeCloudinaryUrl(profile.avatar, 300) }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={[styles.avatarImage, styles.avatarFallback]}>
                    <Ionicons name="person" size={44} color={theme.primary} />
                  </View>
                )}
                {uploadingAvatar && (
                  <View style={styles.avatarUploadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
                <View style={styles.cameraIconBadge}>
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              <Text style={styles.profileName}>{profile.name}</Text>

              {/* Star Rating & Trust Score */}
              <View style={styles.reputationRow}>
                <View
                  style={[
                    styles.reputationPill,
                    hasDisplayableRating ? styles.ratingPillActive : styles.reputationPillEmpty,
                  ]}
                >
                  <Ionicons
                    name={hasDisplayableRating ? 'star' : 'star-outline'}
                    size={14}
                    color={hasDisplayableRating ? theme.warning : theme.textMuted}
                  />
                  {hasDisplayableRating && ratingValue !== null ? (
                    <>
                      <Text style={styles.ratingNumber}>{ratingValue.toFixed(1)}</Text>
                      <Text style={styles.ratingCount}>
                        {STRINGS.PROFILE_SCREEN.REVIEWS_COUNT(reviewCount)}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.reputationEmptyText}>
                      {STRINGS.PROFILE_SCREEN.NO_RATING_YET}
                    </Text>
                  )}
                </View>

                <View
                  style={[
                    styles.reputationPill,
                    hasDisplayableTrustScore
                      ? styles.trustScorePillActive
                      : styles.reputationPillEmpty,
                  ]}
                >
                  <Ionicons
                    name={hasDisplayableTrustScore ? 'shield-checkmark' : 'shield-outline'}
                    size={14}
                    color={
                      hasDisplayableTrustScore ? theme.primaryDark : theme.textMuted
                    }
                  />
                  {hasDisplayableTrustScore && resolvedTrustScore !== null ? (
                    <Text style={styles.trustScoreText}>
                      {`${STRINGS.PROFILE_SCREEN.TRUST_SCORE_LABEL}: ${Math.round(
                        resolvedTrustScore
                      )}`}
                    </Text>
                  ) : (
                    <Text style={styles.reputationEmptyText}>
                      {STRINGS.PROFILE_SCREEN.NO_TRUST_SCORE_YET}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* ─── 2. CONTACT INFORMATION (PHONE, EMAIL, ADDRESS) ─── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{STRINGS.PROFILE_SCREEN.CONTACT_SECTION_TITLE}</Text>

              {/* PHONE */}
              <View style={styles.infoRow}>
                <View style={styles.infoIconCircle}>
                  <Ionicons name="call-outline" size={18} color={theme.primary} />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>{STRINGS.PROFILE_SCREEN.PHONE_LABEL}</Text>
                  <Text style={styles.infoValue}>
                    {profile.phone || STRINGS.PROFILE_SCREEN.NOT_UPDATED}
                  </Text>
                </View>
              </View>

              {/* EMAIL */}
              <View style={styles.infoRow}>
                <View style={styles.infoIconCircle}>
                  <Ionicons name="mail-outline" size={18} color={theme.primary} />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>{STRINGS.PROFILE_SCREEN.EMAIL_LABEL}</Text>
                  <Text style={styles.infoValue}>
                    {profile.email || STRINGS.PROFILE_SCREEN.NOT_UPDATED}
                  </Text>
                </View>
              </View>

              {/* ADDRESS */}
              <View style={[styles.infoRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <View style={styles.infoIconCircle}>
                  <Ionicons name="location-outline" size={18} color={theme.primary} />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>{STRINGS.PROFILE_SCREEN.ADDRESS_LABEL}</Text>
                  <Text style={styles.infoValue}>{displayAddress || STRINGS.PROFILE_SCREEN.NOT_UPDATED}</Text>
                </View>
              </View>
            </View>

            {/* ─── 3. IDENTITY VERIFICATION (eKYC) ─── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{STRINGS.PROFILE_SCREEN.EKYC_SECTION_TITLE}</Text>
              <TouchableOpacity
                style={styles.ekycRow}
                onPress={handleNavigateToEkyc}
                activeOpacity={0.7}
              >
                <View style={[styles.infoIconCircle, { backgroundColor: isUserVerified ? '#ECFDF5' : '#EEF2FF' }]}>
                  <Ionicons
                    name={isUserVerified ? 'shield-checkmark' : 'shield-outline'}
                    size={20}
                    color={isUserVerified ? '#10B981' : theme.primary}
                  />
                </View>
                <View style={styles.infoTextContainer}>
                  <View style={styles.ekycTitleRow}>
                    <Text style={styles.ekycTitle}>{STRINGS.PROFILE_SCREEN.EKYC_ROW_TITLE}</Text>
                    {isUserVerified ? (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                        <Text style={styles.verifiedBadgeText}>{STRINGS.PROFILE_SCREEN.VERIFIED_BADGE}</Text>
                      </View>
                    ) : (
                      <View style={styles.unverifiedBadge}>
                        <Text style={styles.unverifiedBadgeText}>{STRINGS.PROFILE_SCREEN.UNVERIFIED_BADGE}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.ekycDescText}>
                    {isUserVerified
                      ? STRINGS.PROFILE_SCREEN.EKYC_DESC_VERIFIED
                      : STRINGS.PROFILE_SCREEN.EKYC_DESC_UNVERIFIED}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </TouchableOpacity>

              {showOwnerEkycRow && (
                <TouchableOpacity
                  style={[styles.ekycRow, styles.ownerEkycRowDivider]}
                  onPress={handleNavigateToOwnerEkyc}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.infoIconCircle,
                      {
                        backgroundColor:
                          effectiveOwnerStatus === 'approved'
                            ? '#ECFDF5'
                            : effectiveOwnerStatus === 'rejected'
                            ? '#FEF2F2'
                            : '#F0FDFA',
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        effectiveOwnerStatus === 'approved'
                          ? 'ribbon'
                          : effectiveOwnerStatus === 'rejected'
                          ? 'alert-circle-outline'
                          : 'ribbon-outline'
                      }
                      size={20}
                      color={
                        effectiveOwnerStatus === 'approved'
                          ? '#10B981'
                          : effectiveOwnerStatus === 'rejected'
                          ? '#DC2626'
                          : theme.primary
                      }
                    />
                  </View>
                  <View style={styles.infoTextContainer}>
                    <View style={styles.ekycTitleRow}>
                      <Text style={styles.ekycTitle}>{STRINGS.PROFILE_SCREEN.OWNER_EKYC_ROW_TITLE}</Text>
                      {effectiveOwnerStatus === 'approved' ? (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                          <Text style={styles.verifiedBadgeText}>
                            {STRINGS.PROFILE_SCREEN.OWNER_EKYC_BADGE_VERIFIED}
                          </Text>
                        </View>
                      ) : effectiveOwnerStatus === 'pending' ? (
                        <View style={styles.pendingOwnerBadge}>
                          <Text style={styles.pendingOwnerBadgeText}>
                            {STRINGS.PROFILE_SCREEN.OWNER_EKYC_BADGE_PENDING}
                          </Text>
                        </View>
                      ) : effectiveOwnerStatus === 'rejected' ? (
                        <View style={styles.rejectedOwnerBadge}>
                          <Text style={styles.rejectedOwnerBadgeText}>
                            {STRINGS.PROFILE_SCREEN.OWNER_EKYC_BADGE_REJECTED}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.availableOwnerBadge}>
                          <Text style={styles.availableOwnerBadgeText}>
                            {STRINGS.PROFILE_SCREEN.OWNER_EKYC_BADGE_AVAILABLE}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.ekycDescText}>
                      {effectiveOwnerStatus === 'approved'
                        ? STRINGS.PROFILE_SCREEN.OWNER_EKYC_DESC_APPROVED
                        : effectiveOwnerStatus === 'pending'
                        ? STRINGS.PROFILE_SCREEN.OWNER_EKYC_DESC_PENDING
                        : effectiveOwnerStatus === 'rejected'
                        ? STRINGS.PROFILE_SCREEN.OWNER_EKYC_DESC_REJECTED
                        : STRINGS.PROFILE_SCREEN.OWNER_EKYC_DESC_AVAILABLE}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* ─── 4. WISHLIST ─── */}
            <TouchableOpacity
              style={styles.wishlistButton}
              onPress={() => {
                if (onNavigateToWishlist) {
                  onNavigateToWishlist();
                } else if (navigation?.navigate) {
                  navigation.navigate('Wishlist');
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.wishlistLeft}>
                <View style={styles.wishlistIconBox}>
                  <Ionicons name="heart" size={18} color={theme.danger} />
                </View>
                <Text style={styles.wishlistButtonText}>{STRINGS.PROFILE_SCREEN.WISHLIST_BUTTON}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            {/* ─── 6. ACTION BUTTONS ─── */}
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={openEditModal}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil-outline" size={18} color="#FFFFFF" />
              <Text style={styles.editProfileButtonText}>{STRINGS.PROFILE_SCREEN.EDIT_PROFILE_BUTTON}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={18} color={theme.danger} />
              <Text style={styles.signOutButtonText}>{STRINGS.PROFILE_SCREEN.LOGOUT_BUTTON}</Text>
            </TouchableOpacity>
      </ScrollView>

      {/* ─── EDIT PROFILE MODAL ─── */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { paddingBottom: insets.bottom + 20 },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{STRINGS.PROFILE_SCREEN.EDIT_MODAL_TITLE}</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {Boolean(editProfileError) && (
                <View style={styles.editErrorBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
                  <Text style={styles.editErrorText}>{editProfileError}</Text>
                </View>
              )}

              {/* Full Name */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>{STRINGS.PROFILE_SCREEN.FULL_NAME_LABEL}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editName}
                  onChangeText={(text) => {
                    setEditName(text);
                    if (editProfileError) setEditProfileError('');
                  }}
                  placeholder={STRINGS.PROFILE_SCREEN.FULL_NAME_PLACEHOLDER}
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              {/* Phone Number */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>{STRINGS.PROFILE_SCREEN.PHONE_LABEL}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder={STRINGS.PROFILE_SCREEN.PHONE_PLACEHOLDER}
                  placeholderTextColor={theme.textMuted}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Email */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>{STRINGS.PROFILE_SCREEN.EMAIL_LABEL}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder={STRINGS.PROFILE_SCREEN.EMAIL_PLACEHOLDER}
                  placeholderTextColor={theme.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Address */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>{STRINGS.PROFILE_SCREEN.ADDRESS_LABEL}</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalInputMultiline]}
                  value={editAddress}
                  onChangeText={setEditAddress}
                  placeholder={STRINGS.PROFILE_SCREEN.ADDRESS_PLACEHOLDER}
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Profile Photo Picker */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>{STRINGS.PROFILE_SCREEN.AVATAR_LABEL}</Text>
                <View style={styles.editAvatarRow}>
                  {profile.avatar ? (
                    <Image
                      source={{ uri: optimizeCloudinaryUrl(profile.avatar, 200) }}
                      style={styles.editAvatarPreview}
                    />
                  ) : (
                    <View style={[styles.editAvatarPreview, styles.avatarFallback]}>
                      <Ionicons name="person" size={22} color={theme.primary} />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.editAvatarChangeBtn}
                    onPress={() => handleOpenAvatarPicker(true)}
                    disabled={uploadingAvatar || isSaving}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera-outline" size={16} color={theme.primaryDark} />
                    <Text style={styles.editAvatarChangeBtnText}>
                      {STRINGS.PROFILE_SCREEN.AVATAR_CHANGE_BTN}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.modalSaveButton, isSaving && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" />
                    <Text style={styles.modalSaveButtonText}>
                      {STRINGS.PROFILE_SCREEN.SAVE_CHANGES_BUTTON}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── ADDRESS REQUIRED FOR EKYC MODAL ─── */}
      <ActionConfirmModal
        visible={addressPromptVisible}
        title={STRINGS.PROFILE_SCREEN.ADDRESS_REQUIRED_TITLE}
        message={STRINGS.PROFILE_SCREEN.ADDRESS_REQUIRED_MSG}
        icon="location-outline"
        tone="brand"
        summaryItems={[
          {
            icon: 'location-outline',
            label: STRINGS.PROFILE_SCREEN.ADDRESS_REQUIRED_SUMMARY_LABEL,
            value: STRINGS.PROFILE_SCREEN.ADDRESS_REQUIRED_SUMMARY_VALUE,
          },
        ]}
        noticeText={STRINGS.PROFILE_SCREEN.ADDRESS_REQUIRED_NOTICE}
        confirmText={STRINGS.PROFILE_SCREEN.UPDATE_NOW}
        cancelText={STRINGS.PROFILE_SCREEN.LATER}
        onCancel={() => setAddressPromptVisible(false)}
        onConfirm={handleConfirmAddressPrompt}
      />

      {/* ─── AVATAR PICKER MODAL (CAMERA / GALLERY) ─── */}
      <ImageSourcePickerModal
        options={avatarPickerOptions}
        onClose={() => setAvatarPickerOptions(null)}
        onError={(title, message) =>
          setResultModal({
            visible: true,
            type: 'error',
            title,
            message,
          })
        }
      />

      {/* ─── SAVE PROFILE / AVATAR RESULT MODAL ─── */}
      <ActionResultModal
        visible={resultModal.visible}
        type={resultModal.type}
        title={resultModal.title}
        message={resultModal.message}
        summaryItems={resultModal.summaryItems || []}
        buttonText={STRINGS.PROFILE_SCREEN.SAVE_DONE_BTN}
        onClose={() => setResultModal((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.h3,
    fontWeight: theme.typography.weights.bold,
    color: theme.textPrimary,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.slate[50],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },

  /* Card dùng chung */
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    ...theme.shadows.subtle,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
  },

  /* 1. Header Avatar Card */
  avatarWrapper: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: theme.spacing.sm,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: theme.primaryLight,
  },
  avatarFallback: {
    backgroundColor: theme.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: theme.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  reputationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  reputationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radii.full,
    borderWidth: 1,
  },
  ratingPillActive: {
    backgroundColor: theme.warningLight,
    borderColor: theme.warningLight,
  },
  trustScorePillActive: {
    backgroundColor: theme.primaryBg,
    borderColor: theme.primaryLight,
  },
  reputationPillEmpty: {
    backgroundColor: theme.colors.slate[50],
    borderColor: theme.borderDefault,
  },
  ratingNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.warning[600],
  },
  ratingCount: {
    fontSize: 12.5,
    color: theme.textSecondary,
  },
  trustScoreText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.primaryDark,
  },
  reputationEmptyText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: theme.textMuted,
  },

  /* 2. Thông tin liên hệ */
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.slate[100],
  },
  infoIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: theme.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textPrimary,
  },

  /* 4. Action Buttons */
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: theme.radii.md,
  },
  editProfileButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.danger[50],
    borderWidth: 1,
    borderColor: theme.colors.danger[500],
    paddingVertical: 14,
    borderRadius: theme.radii.md,
  },
  signOutButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.danger,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.card,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  editErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.danger[50],
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: theme.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: theme.spacing.sm + 4,
  },
  editErrorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: theme.danger,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  modalField: {
    marginBottom: theme.spacing.sm + 4,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: theme.colors.slate[50],
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: theme.textPrimary,
  },
  modalInputMultiline: {
    height: 60,
    textAlignVertical: 'top',
  },
  editAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.slate[50],
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editAvatarPreview: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: theme.primaryLight,
  },
  editAvatarChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.primaryBg,
    borderWidth: 1,
    borderColor: theme.primaryLight,
    borderRadius: theme.radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editAvatarChangeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primaryDark,
  },
  modalSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.primary,
    paddingVertical: 13,
    borderRadius: theme.radii.md,
    marginTop: theme.spacing.sm,
  },
  modalSaveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* eKYC Row Styles */
  ekycRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  ekycTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  ekycTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  ekycDescText: {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 16,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 3,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },
  unverifiedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  unverifiedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  ownerEkycRowDivider: {
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  availableOwnerBadge: {
    backgroundColor: '#E6F7F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  availableOwnerBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F766E',
  },
  pendingOwnerBadge: {
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  pendingOwnerBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  rejectedOwnerBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  rejectedOwnerBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B91C1C',
  },
  wishlistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radii.lg,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  wishlistLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wishlistIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishlistButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
});

export default ProfileScreen;
