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
import { useAppDispatch, useAppSelector } from '../../store';
import { clearAuth, updateUser } from '../../store/slices/authSlice';
import { userService } from '../../services/userService';
import { theme } from '../../constants/theme';
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
  }, [dispatch]);

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

  // Lưu thông tin
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập họ và tên.');
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
      Alert.alert('Thành công', 'Đã cập nhật thông tin cá nhân.');
    } catch (err: any) {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể lưu thay đổi.');
    } finally {
      setIsSaving(false);
    }
  };

  // Sao chép mã giới thiệu
  const handleCopyReferral = () => {
    if (!profile.referralCode) {
      Alert.alert('Mã giới thiệu', 'Tài khoản chưa có mã giới thiệu.');
      return;
    }
    Alert.alert(
      'Mã giới thiệu',
      `Đã sao chép mã: ${profile.referralCode}`
    );
  };

  // Đăng xuất
  const handleSignOut = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => dispatch(clearAuth()),
      },
    ]);
  };

  const displayAddress =
    typeof profile.address === 'string'
      ? profile.address
      : profile.address?.fullAddress || '';

  const isUserVerified = Boolean(
    authUser?.isVerified ||
    (authUser as any)?.trust?.isVerified ||
    (profile as any)?.isVerified ||
    (profile as any)?.trust?.isVerified
  );

  // Điều hướng xác thực eKYC
  const handleNavigateToEkyc = () => {
    const rawAddress = (displayAddress || '').trim();

    if (!rawAddress) {
      Alert.alert(
        'Yêu cầu cập nhật địa chỉ',
        'Theo quy định, bạn cần cập nhật địa chỉ liên hệ trong hồ sơ trước khi tiến hành xác thực danh tính (eKYC).',
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Cập nhật ngay', onPress: openEditModal },
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

        <Text style={styles.headerTitle}>Hồ sơ cá nhân</Text>

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
          /* ─── GIAO DIỆN KHÁCH CHƯA ĐĂNG NHẬP ─── */
          <View style={styles.card}>
            <View style={styles.avatarWrapper}>
              <View style={[styles.avatarImage, styles.avatarFallback]}>
                <Ionicons name="person-outline" size={44} color={theme.primary} />
              </View>
            </View>
            <Text style={styles.profileName}>Khách (Guest)</Text>
            <Text style={styles.guestDescText}>
              Bạn đang duyệt TechShare với vai trò Khách. Đăng nhập để sử dụng đầy đủ các tính năng đặt thuê thiết bị và quản lý đơn hàng.
            </Text>
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => navigation?.navigate('Login')}
              activeOpacity={0.8}
            >
              <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
              <Text style={styles.editProfileButtonText}>Đăng nhập / Tạo tài khoản</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ─── 1. THẺ AVATAR & TÊN & ĐÁNH GIÁ ─── */}
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

          {/* Đánh giá sao */}
          <View style={styles.ratingBox}>
            <Ionicons name="star" size={15} color="#F59E0B" />
            <Text style={styles.ratingNumber}>
              {profile.rating?.toFixed(1) || '5.0'}
            </Text>
            <Text style={styles.ratingCount}>
              ({profile.totalReviews || 0} đánh giá)
            </Text>
          </View>
        </View>

        {/* ─── 2. THÔNG TIN CƠ BẢN (SĐT, EMAIL, ĐỊA CHỈ) ─── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thông tin liên hệ</Text>

          {/* SĐT */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconCircle}>
              <Ionicons name="call-outline" size={18} color={theme.primary} />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Số điện thoại</Text>
              <Text style={styles.infoValue}>
                {profile.phone || 'Chưa cập nhật'}
              </Text>
            </View>
          </View>

          {/* EMAIL */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconCircle}>
              <Ionicons name="mail-outline" size={18} color={theme.primary} />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>
                {profile.email || 'Chưa cập nhật'}
              </Text>
            </View>
          </View>

          {/* ĐỊA CHỈ */}
          <View style={[styles.infoRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <View style={styles.infoIconCircle}>
              <Ionicons name="location-outline" size={18} color={theme.primary} />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Địa chỉ</Text>
              <Text style={styles.infoValue}>{displayAddress || 'Chưa cập nhật'}</Text>
            </View>
          </View>
        </View>

        {/* ─── 3. ĐỊNH DANH ĐIỆN TỬ (eKYC) ─── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Xác thực danh tính</Text>
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
                <Text style={styles.ekycTitle}>Xác thực eKYC (CCCD)</Text>
                {isUserVerified ? (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                    <Text style={styles.verifiedBadgeText}>Đã xác thực</Text>
                  </View>
                ) : (
                  <View style={styles.unverifiedBadge}>
                    <Text style={styles.unverifiedBadgeText}>Chưa xác thực</Text>
                  </View>
                )}
              </View>
              <Text style={styles.ekycDescText}>
                {isUserVerified
                  ? 'Tài khoản đã hoàn tất xác thực CCCD, đủ điều kiện thuê thiết bị.'
                  : 'Xác thực CCCD để mở khóa quyền đặt thuê thiết bị trên TechShare.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ─── 4. MÃ GIỚI THIỆU (REFERRAL CODE) ─── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mã giới thiệu</Text>
          <View style={styles.referralContainer}>
            <View style={styles.referralTextWrapper}>
              <Ionicons name="gift-outline" size={20} color={theme.primary} />
              <Text style={styles.referralCode}>
                {profile.referralCode || 'Chưa có'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyReferral}
              activeOpacity={0.8}
            >
              <Ionicons name="copy-outline" size={15} color="#FFFFFF" />
              <Text style={styles.copyButtonText}>Sao chép</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── 3.5 DANH SÁCH YÊU THÍCH (WISHLIST) ─── */}
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
            <Text style={styles.wishlistButtonText}>Danh sách Yêu thích</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </TouchableOpacity>

        {/* ─── 4. NÚT CHỈNH SỬA & ĐĂNG XUẤT ─── */}
        <TouchableOpacity
          style={styles.editProfileButton}
          onPress={openEditModal}
          activeOpacity={0.8}
        >
          <Ionicons name="pencil-outline" size={18} color="#FFFFFF" />
          <Text style={styles.editProfileButtonText}>Chỉnh sửa thông tin</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color={theme.danger} />
          <Text style={styles.signOutButtonText}>Đăng xuất</Text>
        </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* ─── MODAL CHỈNH SỬA THÔNG TIN ─── */}
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
              <Text style={styles.modalTitle}>Chỉnh sửa thông tin</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Họ và tên */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Họ và tên *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nhập họ và tên..."
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              {/* SĐT */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Số điện thoại</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Nhập số điện thoại..."
                  placeholderTextColor={theme.textMuted}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Email */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Email</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="Nhập email..."
                  placeholderTextColor={theme.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Địa chỉ */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Địa chỉ</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalInputMultiline]}
                  value={editAddress}
                  onChangeText={setEditAddress}
                  placeholder="Nhập địa chỉ của bạn..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Đường dẫn Avatar */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Link ảnh đại diện (URL)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editAvatar}
                  onChangeText={setEditAvatar}
                  placeholder="https://..."
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                />
              </View>

              {/* Nút lưu */}
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
                    <Text style={styles.modalSaveButtonText}>Lưu thay đổi</Text>
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
