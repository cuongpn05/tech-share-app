import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../store';
import { clearAuth, updateUser } from '../../store/slices/authSlice';
import { userService } from '../../services/userService';
import { getEkycStatus } from '../../services/ekycService';
import { theme } from '../../constants/theme';
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
    referralCode: authUser?.referralCode || '',
    rating: authUser?.rating ?? 5.0,
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
  const [editAvatar, setEditAvatar] = useState(profile.avatar || '');
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

  // Tải lại hồ sơ mới nhất từ API
  const fetchFreshProfile = useCallback(async () => {
    try {
      const data = await userService.getProfile();
      if (data?.user) {
        setProfile((prev) => ({
          ...prev,
          ...data.user,
          email: data.account?.email || data.user.email || prev.email,
        }));
        dispatch(
          updateUser({
            ...data.user,
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
    setEditAvatar(profile.avatar || '');
    setIsEditModalVisible(true);
  };

  // Save profile
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert(
        STRINGS.PROFILE_SCREEN.ALERT_NOTICE_TITLE,
        STRINGS.PROFILE_SCREEN.ALERT_NAME_REQUIRED
      );
      return;
    }

    setIsSaving(true);
    try {
      const res = await userService.updateProfile({
        name: editName.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
        avatar: editAvatar.trim(),
      });

      const updatedData: Partial<User> = {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        address: editAddress.trim(),
        avatar: editAvatar.trim(),
      };

      setProfile((prev) => ({
        ...prev,
        ...updatedData,
      }));
      dispatch(updateUser(updatedData));
      setIsEditModalVisible(false);
      Alert.alert(
        STRINGS.PROFILE_SCREEN.ALERT_SUCCESS_TITLE,
        STRINGS.PROFILE_SCREEN.ALERT_SUCCESS_MSG
      );
    } catch (err: any) {
      Alert.alert(
        STRINGS.PROFILE_SCREEN.ALERT_ERROR_TITLE,
        err.response?.data?.message || STRINGS.PROFILE_SCREEN.ALERT_SAVE_ERROR_DEFAULT
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Copy referral code
  const handleCopyReferral = () => {
    if (!profile.referralCode) {
      Alert.alert(
        STRINGS.PROFILE_SCREEN.REFERRAL_COPIED_ALERT_TITLE,
        STRINGS.PROFILE_SCREEN.REFERRAL_NONE_ALERT_MSG
      );
      return;
    }
    Alert.alert(
      STRINGS.PROFILE_SCREEN.REFERRAL_COPIED_ALERT_TITLE,
      STRINGS.PROFILE_SCREEN.REFERRAL_COPIED_ALERT_MSG(profile.referralCode)
    );
  };

  // Sign out
  const handleSignOut = () => {
    Alert.alert(
      STRINGS.PROFILE_SCREEN.LOGOUT_ALERT_TITLE,
      STRINGS.PROFILE_SCREEN.LOGOUT_ALERT_MSG,
      [
        { text: STRINGS.COMMON.CANCEL, style: 'cancel' },
        {
          text: STRINGS.PROFILE_SCREEN.LOGOUT_BUTTON,
          style: 'destructive',
          onPress: () => dispatch(clearAuth()),
        },
      ]
    );
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
  const handleNavigateToEkyc = () => {
    const rawAddress = (displayAddress || '').trim();

    if (!rawAddress) {
      Alert.alert(
        STRINGS.PROFILE_SCREEN.ADDRESS_REQUIRED_TITLE,
        STRINGS.PROFILE_SCREEN.ADDRESS_REQUIRED_MSG,
        [
          { text: STRINGS.PROFILE_SCREEN.LATER, style: 'cancel' },
          { text: STRINGS.PROFILE_SCREEN.UPDATE_NOW, onPress: openEditModal },
        ]
      );
      return;
    }

    if (navigation?.navigate) {
      navigation.navigate('EkycVerification');
    }
  };

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

        {isAuthenticated ? (
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={openEditModal}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={22} color={theme.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
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
        {!isAuthenticated ? (
          /* ─── GUEST STATE ─── */
          <View style={styles.card}>
            <View style={styles.avatarWrapper}>
              <View style={[styles.avatarImage, styles.avatarFallback]}>
                <Ionicons name="person-outline" size={44} color={theme.primary} />
              </View>
            </View>
            <Text style={styles.profileName}>{STRINGS.PROFILE_SCREEN.GUEST_NAME}</Text>
            <Text style={styles.guestDescText}>
              {STRINGS.PROFILE_SCREEN.GUEST_DESC}
            </Text>
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => navigation?.navigate('Login')}
              activeOpacity={0.8}
            >
              <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
              <Text style={styles.editProfileButtonText}>
                {STRINGS.PROFILE_SCREEN.LOGIN_SIGNUP_BUTTON}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ─── 1. AVATAR, NAME & RATING CARD ─── */}
            <View style={styles.card}>
              <View style={styles.avatarWrapper}>
                {profile.avatar ? (
                  <Image source={{ uri: profile.avatar }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarImage, styles.avatarFallback]}>
                    <Ionicons name="person" size={44} color={theme.primary} />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.cameraIconBadge}
                  onPress={openEditModal}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.profileName}>{profile.name}</Text>

              {/* Star Rating */}
              <View style={styles.ratingBox}>
                <Ionicons name="star" size={15} color="#F59E0B" />
                <Text style={styles.ratingNumber}>
                  {profile.rating?.toFixed(1) || '5.0'}
                </Text>
                <Text style={styles.ratingCount}>
                  {STRINGS.PROFILE_SCREEN.REVIEWS_COUNT(profile.totalReviews || 0)}
                </Text>
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
            </View>

            {/* ─── 4. REFERRAL CODE ─── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{STRINGS.PROFILE_SCREEN.REFERRAL_SECTION_TITLE}</Text>
              <View style={styles.referralContainer}>
                <View style={styles.referralTextWrapper}>
                  <Ionicons name="gift-outline" size={20} color={theme.primary} />
                  <Text style={styles.referralCode}>
                    {profile.referralCode || STRINGS.PROFILE_SCREEN.NO_REFERRAL_CODE}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={handleCopyReferral}
                  activeOpacity={0.8}
                >
                  <Ionicons name="copy-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.copyButtonText}>{STRINGS.PROFILE_SCREEN.COPY_BUTTON}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ─── 5. WISHLIST ─── */}
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
          </>
        )}
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
              {/* Full Name */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>{STRINGS.PROFILE_SCREEN.FULL_NAME_LABEL}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editName}
                  onChangeText={setEditName}
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

              {/* Avatar URL */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>{STRINGS.PROFILE_SCREEN.AVATAR_LABEL}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editAvatar}
                  onChangeText={setEditAvatar}
                  placeholder={STRINGS.PROFILE_SCREEN.AVATAR_PLACEHOLDER}
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                />
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
  guestDescText: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  ratingNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
  ratingCount: {
    fontSize: 13,
    color: theme.textSecondary,
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

  /* 3. Mã giới thiệu */
  referralContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.primaryBg,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.primaryLight,
  },
  referralTextWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  referralCode: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.primaryDark,
    letterSpacing: 1.5,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radii.sm,
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
