/**
 * ============================================================
 *  EKYC VERIFICATION SCREEN
 *  client/src/screens/user/EkycVerificationScreen.tsx
 * ============================================================
 *  Mục đích:
 *   - Màn hình định danh điện tử (eKYC) dành cho Renter.
 *   - Hiển thị thông tin hồ sơ chỉ đọc (Tên, Email, SĐT, Địa chỉ).
 *   - Kiểm tra điều kiện tiên quyết: Yêu cầu cập nhật địa chỉ trước khi xác thực.
 *   - 3 trường renter cần hoàn thành:
 *       1. Số Căn cước công dân (CCCD)
 *       2. Ảnh CCCD mặt trước (tải lên Cloudinary)
 *       3. Ảnh CCCD mặt sau (tải lên Cloudinary)
 *   - Lưu đơn vào collection `ekyc_requests` với status: 'pending'.
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppSelector } from '../../store';
import { theme } from '../../theme/tokens';
import {
  getEkycStatus,
  uploadEkycPhoto,
  submitEkycRequest,
  EkycProfile,
  EkycRequestData,
} from '../../services/ekycService';
import { userService } from '../../services/userService';

export interface EkycVerificationScreenProps {
  navigation?: any;
  onBack?: () => void;
  onSuccess?: () => void;
}

export function EkycVerificationScreen({
  navigation,
  onBack,
  onSuccess,
}: EkycVerificationScreenProps) {
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAppSelector((state) => state.auth);

  // Trạng thái tải trang
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Thông tin người dùng (Read-only)
  const [profile, setProfile] = useState<EkycProfile>({
    _id: authUser?._id || '',
    name: authUser?.name || '',
    email: authUser?.email || '',
    phone: authUser?.phone || '',
    address:
      typeof authUser?.address === 'string'
        ? authUser.address
        : authUser?.address?.fullAddress || '',
    avatar: authUser?.avatar || null,
  });

  const [isVerified, setIsVerified] = useState(false);
  const [ekycRequest, setEkycRequest] = useState<EkycRequestData | null>(null);

  // 3 trường renter cần hoàn thành
  const [idCardNumber, setIdCardNumber] = useState('');
  const [frontImageUri, setFrontImageUri] = useState<string | null>(null);
  const [backImageUri, setBackImageUri] = useState<string | null>(null);

  // Cloudinary URLs sau khi upload
  const [frontCloudUrl, setFrontCloudUrl] = useState<string | null>(null);
  const [backCloudUrl, setBackCloudUrl] = useState<string | null>(null);

  // Uploading state cho từng ảnh
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);

  // Modal cập nhật địa chỉ khi chưa có địa chỉ
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  // ── 1. Tải trạng thái eKYC ban đầu ─────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getEkycStatus();
      if (res.success && res.data) {
        setIsVerified(res.data.isVerified);
        setProfile(res.data.profile);
        setAddressInput(res.data.profile.address || '');

        if (res.data.ekycRequest) {
          setEkycRequest(res.data.ekycRequest);
          setIdCardNumber(res.data.ekycRequest.idCardNumber || '');
          setFrontImageUri(res.data.ekycRequest.idCardFrontUrl || null);
          setBackImageUri(res.data.ekycRequest.idCardBackUrl || null);
          setFrontCloudUrl(res.data.ekycRequest.idCardFrontUrl || null);
          setBackCloudUrl(res.data.ekycRequest.idCardBackUrl || null);
        }
      }
    } catch (err: any) {
      console.warn('[EkycScreen] Lỗi tải trạng thái:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Kiểm tra đã có địa chỉ hay chưa
  const hasAddress = Boolean(profile.address && profile.address.trim().length > 0);

  // ── 2. Hàm tải ảnh nền (Background Pre-upload) ─────────────
  const uploadFrontBackground = async (localUri: string): Promise<string | null> => {
    if (!localUri) return null;
    if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
      setFrontCloudUrl(localUri);
      return localUri;
    }
    try {
      setUploadingFront(true);
      const url = await uploadEkycPhoto(localUri, 'cccd-front');
      setFrontCloudUrl(url);
      return url;
    } catch (err: any) {
      console.warn('[Ekyc] Upload ảnh trước lỗi:', err);
      return null;
    } finally {
      setUploadingFront(false);
    }
  };

  const uploadBackBackground = async (localUri: string): Promise<string | null> => {
    if (!localUri) return null;
    if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
      setBackCloudUrl(localUri);
      return localUri;
    }
    try {
      setUploadingBack(true);
      const url = await uploadEkycPhoto(localUri, 'cccd-back');
      setBackCloudUrl(url);
      return url;
    } catch (err: any) {
      console.warn('[Ekyc] Upload ảnh sau lỗi:', err);
      return null;
    } finally {
      setUploadingBack(false);
    }
  };

  const handleSelectFront = (uri: string) => {
    setFrontImageUri(uri);
    setFrontCloudUrl(null);
    uploadFrontBackground(uri);
  };

  const handleSelectBack = (uri: string) => {
    setBackImageUri(uri);
    setBackCloudUrl(null);
    uploadBackBackground(uri);
  };

  // ── 3. Xử lý chọn ảnh CCCD (Camera hoặc Thư viện) ───────────
  const handlePickImage = (type: 'front' | 'back') => {
    Alert.alert(
      'Chọn ảnh CCCD/CMND',
      type === 'front' ? 'Vui lòng cung cấp ảnh mặt trước rõ nét' : 'Vui lòng cung cấp ảnh mặt sau rõ nét',
      [
        {
          text: 'Chụp ảnh mới',
          onPress: () => openCamera(type),
        },
        {
          text: 'Chọn từ thư viện',
          onPress: () => openGallery(type),
        },
        { text: 'Hủy', style: 'cancel' },
      ]
    );
  };

  const openCamera = async (type: 'front' | 'back') => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền máy ảnh trong Cài đặt để chụp CCCD.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [85, 54], // Tỉ lệ thẻ CCCD chuẩn ISO/IEC 7810
        quality: 0.65,    // Nén chất lượng 0.65 giúp giảm 90% dung lượng, upload siêu nhanh
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const selectedUri = result.assets[0].uri;
        if (type === 'front') handleSelectFront(selectedUri);
        else handleSelectBack(selectedUri);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không thể mở máy ảnh: ' + (err.message || 'Lỗi không xác định'));
    }
  };

  const openGallery = async (type: 'front' | 'back') => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền thư viện ảnh trong Cài đặt để chọn ảnh.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [85, 54],
        quality: 0.65,    // Nén chất lượng 0.65 giúp giảm 90% dung lượng, upload siêu nhanh
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const selectedUri = result.assets[0].uri;
        if (type === 'front') handleSelectFront(selectedUri);
        else handleSelectBack(selectedUri);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không thể mở thư viện ảnh: ' + (err.message || 'Lỗi không xác định'));
    }
  };

  // ── 3. Lưu địa chỉ nếu người dùng chưa cập nhật ────────────
  const handleSaveAddress = async () => {
    if (!addressInput.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập địa chỉ cụ thể của bạn.');
      return;
    }

    try {
      setSavingAddress(true);
      await userService.updateProfile({
        address: addressInput.trim(),
      });

      setProfile((prev) => ({ ...prev, address: addressInput.trim() }));
      setShowAddressModal(false);
      Alert.alert('Thành công', 'Đã cập nhật địa chỉ! Bạn có thể tiếp tục xác thực eKYC.');
    } catch (err: any) {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể lưu địa chỉ.');
    } finally {
      setSavingAddress(false);
    }
  };

  // ── 4. Nộp đơn xác thực eKYC ────────────────────────────────
  const handleSubmit = async () => {
    // Kiểm tra địa chỉ
    if (!hasAddress) {
      Alert.alert(
        'Yêu cầu cập nhật địa chỉ',
        'Bạn phải cập nhật địa chỉ liên hệ trong hồ sơ trước khi tiến hành xác thực eKYC.',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Cập nhật ngay', onPress: () => setShowAddressModal(true) },
        ]
      );
      return;
    }

    // Kiểm tra số CCCD
    const cleanId = idCardNumber.trim();
    if (!cleanId) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập Số Căn cước công dân (CCCD).');
      return;
    }
    if (!/^\d{9,12}$/.test(cleanId)) {
      Alert.alert('Số CCCD không hợp lệ', 'Số CCCD/CMND phải bao gồm từ 9 đến 12 chữ số.');
      return;
    }

    // Kiểm tra ảnh mặt trước
    if (!frontImageUri) {
      Alert.alert('Thiếu ảnh', 'Vui lòng chụp hoặc tải lên ảnh mặt trước CCCD.');
      return;
    }

    // Kiểm tra ảnh mặt sau
    if (!backImageUri) {
      Alert.alert('Thiếu ảnh', 'Vui lòng chụp hoặc tải lên ảnh mặt sau CCCD.');
      return;
    }

    try {
      setSubmitting(true);

      // Bước 4: Tải song song cả 2 ảnh nếu chưa hoàn thành tải lên nền
      let uploadedFrontUrl = frontCloudUrl;
      let uploadedBackUrl = backCloudUrl;

      if (!uploadedFrontUrl || !uploadedBackUrl) {
        const uploadPromises: [Promise<string | null>, Promise<string | null>] = [
          uploadedFrontUrl
            ? Promise.resolve(uploadedFrontUrl)
            : uploadFrontBackground(frontImageUri),
          uploadedBackUrl
            ? Promise.resolve(uploadedBackUrl)
            : uploadBackBackground(backImageUri),
        ];

        // Tải song song 2 ảnh cùng lúc (giảm 50% thời gian)
        const [resFront, resBack] = await Promise.all(uploadPromises);
        uploadedFrontUrl = resFront;
        uploadedBackUrl = resBack;
      }

      if (!uploadedFrontUrl) {
        Alert.alert('Lỗi tải ảnh', 'Không thể tải lên ảnh mặt trước CCCD. Vui lòng kiểm tra kết nối mạng và thử lại.');
        return;
      }

      if (!uploadedBackUrl) {
        Alert.alert('Lỗi tải ảnh', 'Không thể tải lên ảnh mặt sau CCCD. Vui lòng kiểm tra kết nối mạng và thử lại.');
        return;
      }

      // Bước 5: Gửi đơn lên server lưu vào collection ekyc_requests (cực nhanh, chỉ vài chục ms)
      const response = await submitEkycRequest({
        idCardNumber: cleanId,
        idCardFrontUrl: uploadedFrontUrl,
        idCardBackUrl: uploadedBackUrl,
      });

      if (response.success) {
        Alert.alert(
          'Gửi đơn thành công! 🎉',
          'Đơn xác thực danh tính (eKYC) của bạn đã được ghi nhận vào hệ thống. Quản trị viên sẽ kiểm tra và xét duyệt hồ sơ trong thời gian sớm nhất.',
          [
            {
              text: 'Đã hiểu',
              onPress: () => {
                if (onSuccess) onSuccess();
                else if (navigation?.goBack) navigation.goBack();
                else if (onBack) onBack();
              },
            },
          ]
        );
        fetchStatus();
      } else {
        Alert.alert('Không thể gửi đơn', response.message || 'Vui lòng thử lại sau.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Lỗi kết nối khi gửi đơn eKYC.';
      Alert.alert('Lỗi xác thực', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (onBack) onBack();
    else if (navigation?.goBack) navigation.goBack();
  };

  // ── 5. Render Loading ──────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.brand[500]} />
        <Text style={styles.loadingText}>Đang tải thông tin xác thực...</Text>
      </View>
    );
  }

  const isPending = ekycRequest?.status === 'pending';
  const isRejected = ekycRequest?.status === 'rejected';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ─── HEADER ─── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Xác thực danh tính (eKYC)</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── BANNER TRẠNG THÁI HIỆN TẠI ─── */}
        {isVerified ? (
          <View style={styles.verifiedBanner}>
            <Ionicons name="checkmark-circle" size={32} color="#10B981" />
            <View style={styles.bannerTextContainer}>
              <Text style={styles.verifiedBannerTitle}>Tài khoản đã xác thực</Text>
              <Text style={styles.verifiedBannerSubtitle}>
                Hồ sơ của bạn đã hoàn tất eKYC. Bạn có thể tự do đặt thuê các thiết bị công nghệ trên TechShare.
              </Text>
            </View>
          </View>
        ) : isPending ? (
          <View style={styles.pendingBanner}>
            <Ionicons name="time-outline" size={30} color="#3B82F6" />
            <View style={styles.bannerTextContainer}>
              <Text style={styles.pendingBannerTitle}>Đang chờ Ban Quản Trị xét duyệt</Text>
              <Text style={styles.pendingBannerSubtitle}>
                Đơn xác thực của bạn đã được gửi thành công. Chúng tôi đang kiểm tra ảnh CCCD và sẽ cập nhật kết quả sớm.
              </Text>
            </View>
          </View>
        ) : isRejected ? (
          <View style={styles.rejectedBanner}>
            <Ionicons name="alert-circle-outline" size={30} color="#EF4444" />
            <View style={styles.bannerTextContainer}>
              <Text style={styles.rejectedBannerTitle}>Hồ sơ bị từ chối</Text>
              <Text style={styles.rejectedBannerSubtitle}>
                {ekycRequest?.rejectReason
                  ? `Lý do: ${ekycRequest.rejectReason}`
                  : 'Ảnh CCCD chưa rõ hoặc thông tin không khớp. Vui lòng kiểm tra và gửi lại.'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.introCard}>
            <Ionicons name="shield-checkmark" size={28} color={theme.colors.brand[500]} />
            <View style={styles.bannerTextContainer}>
              <Text style={styles.introTitle}>Bảo mật danh tính người thuê</Text>
              <Text style={styles.introSubtitle}>
                Xác thực thông tin CCCD giúp đảm bảo sự an tâm cho Chủ thiết bị và mở khóa quyền đặt thuê thiết bị.
              </Text>
            </View>
          </View>
        )}

        {/* ─── CẢNH BÁO NẾU CHƯA CẬP NHẬT ĐỊA CHỈ ─── */}
        {!hasAddress && (
          <View style={styles.addressWarningCard}>
            <Ionicons name="warning-outline" size={26} color="#F59E0B" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.warningTitle}>Chưa có địa chỉ liên hệ</Text>
              <Text style={styles.warningSubtitle}>
                Theo quy định, bạn cần cập nhật địa chỉ trong hồ sơ trước khi tiến hành xác thực eKYC.
              </Text>
              <TouchableOpacity
                style={styles.updateAddressButton}
                onPress={() => setShowAddressModal(true)}
              >
                <Ionicons name="location-outline" size={16} color="#FFFFFF" />
                <Text style={styles.updateAddressButtonText}>Cập nhật địa chỉ ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ─── PHẦN 1: THÔNG TIN TÀI KHOẢN (READ-ONLY) ─── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="person-circle-outline" size={20} color={theme.colors.brand[500]} />
            <Text style={styles.sectionTitle}>Thông tin cá nhân (Hồ sơ)</Text>
            <View style={styles.readOnlyBadge}>
              <Ionicons name="lock-closed" size={11} color="#64748B" />
              <Text style={styles.readOnlyText}>Chỉ đọc</Text>
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>
            Thông tin này được lấy từ hồ sơ tài khoản của bạn và không thể chỉnh sửa tại bước này.
          </Text>

          {/* Họ và tên */}
          <View style={styles.fieldItem}>
            <Text style={styles.fieldLabel}>Họ và tên</Text>
            <View style={[styles.fieldBox, styles.fieldBoxDisabled]}>
              <Ionicons name="person-outline" size={16} color="#64748B" />
              <Text style={styles.fieldValueText}>{profile.name || 'Chưa cập nhật'}</Text>
            </View>
          </View>

          {/* Email */}
          <View style={styles.fieldItem}>
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={[styles.fieldBox, styles.fieldBoxDisabled]}>
              <Ionicons name="mail-outline" size={16} color="#64748B" />
              <Text style={styles.fieldValueText}>{profile.email || 'Chưa cập nhật'}</Text>
            </View>
          </View>

          {/* Số điện thoại */}
          <View style={styles.fieldItem}>
            <Text style={styles.fieldLabel}>Số điện thoại</Text>
            <View style={[styles.fieldBox, styles.fieldBoxDisabled]}>
              <Ionicons name="call-outline" size={16} color="#64748B" />
              <Text style={styles.fieldValueText}>{profile.phone || 'Chưa cập nhật'}</Text>
            </View>
          </View>

          {/* Địa chỉ */}
          <View style={styles.fieldItem}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Địa chỉ</Text>
              {!hasAddress && (
                <TouchableOpacity onPress={() => setShowAddressModal(true)}>
                  <Text style={styles.fieldActionText}>+ Thêm địa chỉ</Text>
                </TouchableOpacity>
              )}
            </View>
            <View
              style={[
                styles.fieldBox,
                styles.fieldBoxDisabled,
                !hasAddress && styles.fieldBoxAlert,
              ]}
            >
              <Ionicons
                name="location-outline"
                size={16}
                color={hasAddress ? '#64748B' : '#EF4444'}
              />
              <Text
                style={[
                  styles.fieldValueText,
                  !hasAddress && { color: '#EF4444', fontWeight: '500' },
                ]}
              >
                {hasAddress ? profile.address : 'Chưa cập nhật (Bắt buộc phải có địa chỉ)'}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── PHẦN 2: 3 TRƯỜNG RENTER CẦN HOÀN THÀNH ─── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="card-outline" size={20} color={theme.colors.brand[500]} />
            <Text style={styles.sectionTitle}>Thông tin xác thực CCCD</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Vui lòng điền đúng số CCCD và chụp ảnh rõ nét cả 2 mặt của thẻ để hồ sơ được xét duyệt nhanh nhất.
          </Text>

          {/* 1. SỐ CCCD */}
          <View style={styles.fieldItem}>
            <Text style={styles.fieldLabel}>1. Số Căn cước công dân (CCCD) *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="barcode-outline" size={20} color={theme.colors.brand[500]} />
              <TextInput
                style={styles.textInput}
                placeholder="Nhập 12 chữ số trên thẻ CCCD"
                placeholderTextColor="#94A3B8"
                value={idCardNumber}
                onChangeText={setIdCardNumber}
                keyboardType="number-pad"
                maxLength={12}
                editable={!isVerified && !isPending}
              />
            </View>
          </View>

          {/* 2. ẢNH CCCD MẶT TRƯỚC */}
          <View style={styles.fieldItem}>
            <Text style={styles.fieldLabel}>2. Ảnh CCCD mặt trước *</Text>
            {frontImageUri ? (
              <View style={styles.imagePreviewWrapper}>
                <Image source={{ uri: frontImageUri }} style={styles.imagePreview} />
                {frontCloudUrl && !uploadingFront && (
                  <View style={styles.cloudReadyBadge}>
                    <Ionicons name="cloud-done" size={14} color="#10B981" />
                    <Text style={styles.cloudReadyBadgeText}>Đã tải lên Cloud</Text>
                  </View>
                )}
                {!isVerified && !isPending && (
                  <TouchableOpacity
                    style={styles.changeImageButton}
                    onPress={() => handlePickImage('front')}
                  >
                    <Ionicons name="camera-reverse-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.changeImageButtonText}>Đổi ảnh khác</Text>
                  </TouchableOpacity>
                )}
                {uploadingFront && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.uploadingOverlayText}>Đang tải lên Cloudinary...</Text>
                  </View>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.uploadBox, (!hasAddress || isVerified || isPending) && styles.uploadBoxDisabled]}
                onPress={() => handlePickImage('front')}
                disabled={!hasAddress || isVerified || isPending}
              >
                <View style={styles.uploadIconCircle}>
                  <Ionicons name="cloud-upload-outline" size={26} color={theme.colors.brand[500]} />
                </View>
                <Text style={styles.uploadBoxTitle}>Tải ảnh mặt trước CCCD</Text>
                <Text style={styles.uploadBoxDesc}>Chụp ảnh rõ 4 góc, đủ sáng, không bị mờ</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 3. ẢNH CCCD MẶT SAU */}
          <View style={styles.fieldItem}>
            <Text style={styles.fieldLabel}>3. Ảnh CCCD mặt sau *</Text>
            {backImageUri ? (
              <View style={styles.imagePreviewWrapper}>
                <Image source={{ uri: backImageUri }} style={styles.imagePreview} />
                {backCloudUrl && !uploadingBack && (
                  <View style={styles.cloudReadyBadge}>
                    <Ionicons name="cloud-done" size={14} color="#10B981" />
                    <Text style={styles.cloudReadyBadgeText}>Đã tải lên Cloud</Text>
                  </View>
                )}
                {!isVerified && !isPending && (
                  <TouchableOpacity
                    style={styles.changeImageButton}
                    onPress={() => handlePickImage('back')}
                  >
                    <Ionicons name="camera-reverse-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.changeImageButtonText}>Đổi ảnh khác</Text>
                  </TouchableOpacity>
                )}
                {uploadingBack && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.uploadingOverlayText}>Đang tải lên Cloudinary...</Text>
                  </View>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.uploadBox, (!hasAddress || isVerified || isPending) && styles.uploadBoxDisabled]}
                onPress={() => handlePickImage('back')}
                disabled={!hasAddress || isVerified || isPending}
              >
                <View style={styles.uploadIconCircle}>
                  <Ionicons name="cloud-upload-outline" size={26} color={theme.colors.brand[500]} />
                </View>
                <Text style={styles.uploadBoxTitle}>Tải ảnh mặt sau CCCD</Text>
                <Text style={styles.uploadBoxDesc}>Rõ vân tay, ngày cấp và mã vạch</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ─── NÚT GỬI HỒ SƠ ─── */}
        {!isVerified && !isPending && (
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!hasAddress || submitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!hasAddress || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <View style={styles.submittingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.submitButtonText}>
                  {uploadingFront || uploadingBack ? 'Đang tải ảnh lên Cloudinary...' : 'Đang gửi hồ sơ...'}
                </Text>
              </View>
            ) : (
              <View style={styles.submittingRow}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>
                  {isRejected ? 'Gửi lại hồ sơ xác thực' : 'Gửi đơn xác thực eKYC'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ─── MODAL CẬP NHẬT ĐỊA CHỈ ─── */}
      <Modal
        visible={showAddressModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="location" size={24} color={theme.colors.brand[500]} />
              <Text style={styles.modalTitle}>Cập nhật địa chỉ liên hệ</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Để xác thực eKYC thành công, vui lòng cung cấp địa chỉ nơi ở hoặc địa chỉ thường trú của bạn.
            </Text>

            <TextInput
              style={styles.addressModalInput}
              placeholder="Ví dụ: Số 123 Đường Nguyễn Trãi, Quận 1, TP. Hồ Chí Minh"
              placeholderTextColor="#94A3B8"
              value={addressInput}
              onChangeText={setAddressInput}
              multiline={true}
              numberOfLines={3}
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddressModal(false)}
                disabled={savingAddress}
              >
                <Text style={styles.modalCancelBtnText}>Để sau</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveAddress}
                disabled={savingAddress}
              >
                {savingAddress ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Lưu địa chỉ</Text>
                )}
              </TouchableOpacity>
            </View>
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
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 16,
  },

  // Banners
  verifiedBanner: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  verifiedBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
  },
  verifiedBannerSubtitle: {
    fontSize: 13,
    color: '#047857',
    marginTop: 3,
    lineHeight: 18,
  },
  pendingBanner: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  pendingBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E40AF',
  },
  pendingBannerSubtitle: {
    fontSize: 13,
    color: '#1D4ED8',
    marginTop: 3,
    lineHeight: 18,
  },
  rejectedBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  rejectedBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B',
  },
  rejectedBannerSubtitle: {
    fontSize: 13,
    color: '#B91C1C',
    marginTop: 3,
    lineHeight: 18,
  },
  introCard: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  introTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  introSubtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 3,
    lineHeight: 18,
  },
  bannerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },

  // Warning card
  addressWarningCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  warningSubtitle: {
    fontSize: 13,
    color: '#B45309',
    marginTop: 3,
    lineHeight: 18,
  },
  updateAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 10,
  },
  updateAddressButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 5,
  },

  // Sections
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 8,
    flex: 1,
  },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  readOnlyText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginLeft: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 17,
  },

  // Fields
  fieldItem: {
    marginBottom: 12,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  fieldActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  fieldBoxDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  fieldBoxAlert: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  fieldValueText: {
    fontSize: 14,
    color: '#1E293B',
    marginLeft: 8,
    flex: 1,
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    paddingVertical: 10,
    marginLeft: 8,
    fontWeight: '600',
  },

  // Image Upload Box
  uploadBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#94A3B8',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBoxDisabled: {
    opacity: 0.5,
  },
  uploadIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  uploadBoxDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  // Image Preview
  imagePreviewWrapper: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  changeImageButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  changeImageButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingOverlayText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  cloudReadyBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cloudReadyBadgeText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
  },

  // Submit button
  submitButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 420,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 18,
  },
  addressModalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    marginTop: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  modalCancelBtnText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
  modalSaveBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default EkycVerificationScreen;
