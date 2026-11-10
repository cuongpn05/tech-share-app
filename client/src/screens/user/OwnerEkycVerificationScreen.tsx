/**
 * ============================================================
 *  OWNER UPGRADE EKYC VERIFICATION SCREEN
 *  client/src/screens/user/OwnerEkycVerificationScreen.tsx
 * ============================================================
 *  Mục đích:
 *   - Dành cho Renter ĐÃ XÁC THỰC gửi thêm đơn eKYC nâng cấp lên Owner.
 *   - Bao gồm toàn bộ thông tin giống eKYC Renter (Hồ sơ read-only, Số CCCD,
 *     Ảnh CCCD 2 mặt) và bổ sung Ảnh chân dung cầm CCCD.
 *   - Lưu đơn vào collection `owner_ekyc_requests`.
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppSelector } from '../../store';
import { theme } from '../../theme/tokens';
import {
  getOwnerEkycStatus,
  uploadEkycPhoto,
  submitOwnerEkycRequest,
  EkycProfile,
  OwnerEkycRequestData,
} from '../../services/ekycService';
import { userService } from '../../services/userService';
import { STRINGS } from '../../constants/strings';
import {
  EkycAddressModal,
  EkycAddressWarningCard,
  EkycPhotoUploadField,
  EkycProfileReadOnlyCard,
  promptEkycImagePicker,
} from '../../components/ekyc/EkycSharedSections';

export interface OwnerEkycVerificationScreenProps {
  navigation?: any;
  onBack?: () => void;
  onSuccess?: () => void;
}

type PhotoSlot = 'front' | 'back' | 'selfie';

export function OwnerEkycVerificationScreen({
  navigation,
  onBack,
  onSuccess,
}: OwnerEkycVerificationScreenProps) {
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAppSelector((state) => state.auth);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
    role: authUser?.role || 'renter',
  });

  const [isRenterVerified, setIsRenterVerified] = useState(false);
  const [isOwner, setIsOwner] = useState(authUser?.role === 'owner');
  const [ownerEkycRequest, setOwnerEkycRequest] = useState<OwnerEkycRequestData | null>(null);

  // 4 trường dữ liệu cho đơn Owner eKYC: Số CCCD + CCCD 2 mặt + Ảnh chân dung cầm CCCD
  const [idCardNumber, setIdCardNumber] = useState('');
  const [frontImageUri, setFrontImageUri] = useState<string | null>(null);
  const [backImageUri, setBackImageUri] = useState<string | null>(null);
  const [selfieImageUri, setSelfieImageUri] = useState<string | null>(null);

  const [frontCloudUrl, setFrontCloudUrl] = useState<string | null>(null);
  const [backCloudUrl, setBackCloudUrl] = useState<string | null>(null);
  const [selfieCloudUrl, setSelfieCloudUrl] = useState<string | null>(null);

  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getOwnerEkycStatus();
      if (res.success && res.data) {
        setProfile(res.data.profile);
        setAddressInput(res.data.profile.address || '');
        setIsRenterVerified(Boolean(res.data.isRenterVerified));
        setIsOwner(Boolean(res.data.isOwner));

        const existingOwnerReq = res.data.ownerEkycRequest;
        setOwnerEkycRequest(existingOwnerReq);

        if (existingOwnerReq) {
          setIdCardNumber(existingOwnerReq.idCardNumber || '');
          setFrontImageUri(existingOwnerReq.idCardFrontUrl || null);
          setBackImageUri(existingOwnerReq.idCardBackUrl || null);
          setSelfieImageUri(existingOwnerReq.selfieWithIdUrl || null);
          setFrontCloudUrl(existingOwnerReq.idCardFrontUrl || null);
          setBackCloudUrl(existingOwnerReq.idCardBackUrl || null);
          setSelfieCloudUrl(existingOwnerReq.selfieWithIdUrl || null);
        } else if (res.data.renterEkyc?.idCardNumber) {
          setIdCardNumber(res.data.renterEkyc.idCardNumber);
        }
      }
    } catch (err) {
      console.warn('[OwnerEkycScreen] Lỗi tải trạng thái:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const hasAddress = Boolean(profile.address && profile.address.trim().length > 0);
  const isApproved = Boolean(isOwner || ownerEkycRequest?.status === 'approved');
  const isPending = ownerEkycRequest?.status === 'pending';
  const isRejected = ownerEkycRequest?.status === 'rejected';
  const isEditable = isRenterVerified && !isApproved && !isPending;

  const uploadSlotBackground = async (slot: PhotoSlot, localUri: string): Promise<string | null> => {
    if (!localUri) return null;
    const setCloud =
      slot === 'front' ? setFrontCloudUrl : slot === 'back' ? setBackCloudUrl : setSelfieCloudUrl;
    const setUploading =
      slot === 'front' ? setUploadingFront : slot === 'back' ? setUploadingBack : setUploadingSelfie;
    const prefix =
      slot === 'front' ? 'owner-cccd-front' : slot === 'back' ? 'owner-cccd-back' : 'owner-selfie-cccd';

    if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
      setCloud(localUri);
      return localUri;
    }

    try {
      setUploading(true);
      const url = await uploadEkycPhoto(localUri, prefix);
      setCloud(url);
      return url;
    } catch (err) {
      console.warn(`[OwnerEkyc] Upload ${slot} error:`, err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSelectedUri = (slot: PhotoSlot, uri: string) => {
    if (slot === 'front') {
      setFrontImageUri(uri);
      setFrontCloudUrl(null);
    } else if (slot === 'back') {
      setBackImageUri(uri);
      setBackCloudUrl(null);
    } else {
      setSelfieImageUri(uri);
      setSelfieCloudUrl(null);
    }
    uploadSlotBackground(slot, uri);
  };

  const handlePickPhoto = (slot: PhotoSlot) => {
    if (slot === 'selfie') {
      promptEkycImagePicker({
        title: STRINGS.OWNER_EKYC.PICK_SELFIE_TITLE,
        description: STRINGS.OWNER_EKYC.PICK_SELFIE_DESC,
        aspect: [3, 4],
        cameraType: ImagePicker.CameraType.front,
        onSelected: (uri) => handleSelectedUri('selfie', uri),
      });
      return;
    }

    promptEkycImagePicker({
      title: STRINGS.EKYC.PICK_IMAGE_TITLE,
      description:
        slot === 'front' ? STRINGS.EKYC.PICK_IMAGE_FRONT_DESC : STRINGS.EKYC.PICK_IMAGE_BACK_DESC,
      aspect: [85, 54],
      onSelected: (uri) => handleSelectedUri(slot, uri),
    });
  };

  const handleSaveAddress = async () => {
    if (!addressInput.trim()) {
      Alert.alert(STRINGS.EKYC.ADDRESS_WARNING_TITLE, STRINGS.EKYC.ADDRESS_EMPTY_ALERT);
      return;
    }

    try {
      setSavingAddress(true);
      await userService.updateProfile({ address: addressInput.trim() });
      setProfile((prev) => ({ ...prev, address: addressInput.trim() }));
      setShowAddressModal(false);
      Alert.alert(STRINGS.COMMON.SUCCESS, STRINGS.EKYC.ADDRESS_SAVE_SUCCESS);
    } catch (err: any) {
      Alert.alert(
        STRINGS.COMMON.ERROR,
        err.response?.data?.message || STRINGS.EKYC.ADDRESS_SAVE_ERROR
      );
    } finally {
      setSavingAddress(false);
    }
  };

  const handleSubmit = async () => {
    if (!isRenterVerified) {
      Alert.alert(
        STRINGS.OWNER_EKYC.RENTER_REQUIRED_TITLE,
        STRINGS.OWNER_EKYC.RENTER_REQUIRED_SUB
      );
      return;
    }

    if (!hasAddress) {
      Alert.alert(
        STRINGS.EKYC.ADDRESS_REQUIRED_ALERT_TITLE,
        STRINGS.EKYC.ADDRESS_REQUIRED_ALERT_MSG,
        [
          { text: STRINGS.COMMON.CANCEL, style: 'cancel' },
          { text: STRINGS.EKYC.UPDATE_ADDRESS_NOW, onPress: () => setShowAddressModal(true) },
        ]
      );
      return;
    }

    const cleanId = idCardNumber.trim();
    if (!cleanId) {
      Alert.alert(STRINGS.EKYC.MISSING_INFO_TITLE, STRINGS.EKYC.ID_NUMBER_REQUIRED);
      return;
    }
    if (!/^\d{9,12}$/.test(cleanId)) {
      Alert.alert(STRINGS.EKYC.INVALID_ID_NUMBER_TITLE, STRINGS.EKYC.INVALID_ID_NUMBER_MSG);
      return;
    }

    if (!frontImageUri) {
      Alert.alert(STRINGS.EKYC.MISSING_PHOTO_TITLE, STRINGS.EKYC.FRONT_PHOTO_REQUIRED);
      return;
    }
    if (!backImageUri) {
      Alert.alert(STRINGS.EKYC.MISSING_PHOTO_TITLE, STRINGS.EKYC.BACK_PHOTO_REQUIRED);
      return;
    }
    if (!selfieImageUri) {
      Alert.alert(STRINGS.EKYC.MISSING_PHOTO_TITLE, STRINGS.OWNER_EKYC.SELFIE_PHOTO_REQUIRED);
      return;
    }

    try {
      setSubmitting(true);

      const [uploadedFrontUrl, uploadedBackUrl, uploadedSelfieUrl] = await Promise.all([
        frontCloudUrl ? Promise.resolve(frontCloudUrl) : uploadSlotBackground('front', frontImageUri),
        backCloudUrl ? Promise.resolve(backCloudUrl) : uploadSlotBackground('back', backImageUri),
        selfieCloudUrl ? Promise.resolve(selfieCloudUrl) : uploadSlotBackground('selfie', selfieImageUri),
      ]);

      if (!uploadedFrontUrl) {
        Alert.alert(STRINGS.EKYC.UPLOAD_ERROR_TITLE, STRINGS.EKYC.UPLOAD_FRONT_ERROR);
        return;
      }
      if (!uploadedBackUrl) {
        Alert.alert(STRINGS.EKYC.UPLOAD_ERROR_TITLE, STRINGS.EKYC.UPLOAD_BACK_ERROR);
        return;
      }
      if (!uploadedSelfieUrl) {
        Alert.alert(STRINGS.EKYC.UPLOAD_ERROR_TITLE, STRINGS.OWNER_EKYC.UPLOAD_SELFIE_ERROR);
        return;
      }

      const response = await submitOwnerEkycRequest({
        idCardNumber: cleanId,
        idCardFrontUrl: uploadedFrontUrl,
        idCardBackUrl: uploadedBackUrl,
        selfieWithIdUrl: uploadedSelfieUrl,
      });

      if (response.success) {
        Alert.alert(
          STRINGS.OWNER_EKYC.SUBMIT_SUCCESS_TITLE,
          STRINGS.OWNER_EKYC.SUBMIT_SUCCESS_MSG,
          [
            {
              text: STRINGS.OWNER_EKYC.SUBMIT_SUCCESS_ACK,
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
        Alert.alert(
          STRINGS.OWNER_EKYC.SUBMIT_FAIL_TITLE,
          response.message || STRINGS.EKYC.DEFAULT_ERROR
        );
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || STRINGS.OWNER_EKYC.NETWORK_ERROR;
      Alert.alert(STRINGS.OWNER_EKYC.VERIFICATION_ERROR_TITLE, msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (onBack) onBack();
    else if (navigation?.goBack) navigation.goBack();
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.brand[500]} />
        <Text style={styles.loadingText}>{STRINGS.OWNER_EKYC.LOADING_TEXT}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.surface} />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{STRINGS.OWNER_EKYC.HEADER_TITLE}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {!isRenterVerified ? (
          <View style={styles.lockedCard}>
            <Ionicons name="lock-closed-outline" size={30} color={theme.colors.amber} />
            <View style={styles.bannerTextContainer}>
              <Text style={styles.lockedTitle}>{STRINGS.OWNER_EKYC.RENTER_REQUIRED_TITLE}</Text>
              <Text style={styles.lockedSubtitle}>{STRINGS.OWNER_EKYC.RENTER_REQUIRED_SUB}</Text>
              <TouchableOpacity
                style={styles.goRenterBtn}
                onPress={() => navigation?.navigate?.('EkycVerification')}
              >
                <Text style={styles.goRenterBtnText}>{STRINGS.OWNER_EKYC.GO_TO_RENTER_EKYC}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : isApproved ? (
          <View style={styles.verifiedBanner}>
            <Ionicons name="checkmark-circle" size={32} color={theme.colors.green} />
            <View style={styles.bannerTextContainer}>
              <Text style={styles.verifiedBannerTitle}>
                {STRINGS.OWNER_EKYC.APPROVED_BANNER_TITLE}
              </Text>
              <Text style={styles.verifiedBannerSubtitle}>
                {STRINGS.OWNER_EKYC.APPROVED_BANNER_SUB}
              </Text>
            </View>
          </View>
        ) : isPending ? (
          <View style={styles.pendingBanner}>
            <Ionicons name="time-outline" size={30} color={theme.colors.blue} />
            <View style={styles.bannerTextContainer}>
              <Text style={styles.pendingBannerTitle}>
                {STRINGS.OWNER_EKYC.PENDING_BANNER_TITLE}
              </Text>
              <Text style={styles.pendingBannerSubtitle}>
                {STRINGS.OWNER_EKYC.PENDING_BANNER_SUB}
              </Text>
            </View>
          </View>
        ) : isRejected ? (
          <View style={styles.rejectedBanner}>
            <Ionicons name="alert-circle-outline" size={30} color={theme.colors.red} />
            <View style={styles.bannerTextContainer}>
              <Text style={styles.rejectedBannerTitle}>
                {STRINGS.OWNER_EKYC.REJECTED_BANNER_TITLE}
              </Text>
              <Text style={styles.rejectedBannerSubtitle}>
                {ownerEkycRequest?.rejectReason
                  ? `${STRINGS.OWNER_EKYC.REJECTED_REASON_PREFIX}${ownerEkycRequest.rejectReason}`
                  : STRINGS.OWNER_EKYC.REJECTED_DEFAULT_REASON}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.introCard}>
            <Ionicons name="ribbon-outline" size={28} color={theme.colors.brand[500]} />
            <View style={styles.bannerTextContainer}>
              <Text style={styles.introTitle}>{STRINGS.OWNER_EKYC.INTRO_TITLE}</Text>
              <Text style={styles.introSubtitle}>{STRINGS.OWNER_EKYC.INTRO_SUB}</Text>
            </View>
          </View>
        )}

        {isRenterVerified && !hasAddress && (
          <EkycAddressWarningCard onUpdatePress={() => setShowAddressModal(true)} />
        )}

        {/* Phần 1: Thông tin cá nhân (giống eKYC Renter, read-only) */}
        <EkycProfileReadOnlyCard
          profile={profile}
          hasAddress={hasAddress}
          onAddAddressPress={() => setShowAddressModal(true)}
        />

        {/* Phần 2: Số CCCD + Ảnh CCCD 2 mặt + Ảnh chân dung cầm CCCD */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="card-outline" size={20} color={theme.colors.brand[500]} />
            <Text style={styles.sectionTitle}>{STRINGS.OWNER_EKYC.SECTION_FORM_TITLE}</Text>
          </View>
          <Text style={styles.sectionSubtitle}>{STRINGS.OWNER_EKYC.SECTION_FORM_SUB}</Text>

          {/* 1. Số CCCD */}
          <View style={styles.fieldItem}>
            <Text style={styles.fieldLabel}>{STRINGS.EKYC.ID_NUMBER_LABEL}</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="barcode-outline" size={20} color={theme.colors.brand[500]} />
              <TextInput
                style={styles.textInput}
                placeholder={STRINGS.EKYC.ID_NUMBER_PLACEHOLDER}
                placeholderTextColor={theme.colors.text.subtle}
                value={idCardNumber}
                onChangeText={setIdCardNumber}
                keyboardType="number-pad"
                maxLength={12}
                editable={isEditable}
              />
            </View>
          </View>

          {/* 2. Ảnh CCCD mặt trước */}
          <EkycPhotoUploadField
            label={STRINGS.EKYC.FRONT_PHOTO_LABEL}
            uploadTitle={STRINGS.EKYC.UPLOAD_FRONT_TITLE}
            uploadDesc={STRINGS.EKYC.UPLOAD_FRONT_DESC}
            imageUri={frontImageUri}
            cloudUrl={frontCloudUrl}
            uploading={uploadingFront}
            disabled={!hasAddress || !isEditable}
            editable={isEditable}
            onPress={() => handlePickPhoto('front')}
          />

          {/* 3. Ảnh CCCD mặt sau */}
          <EkycPhotoUploadField
            label={STRINGS.EKYC.BACK_PHOTO_LABEL}
            uploadTitle={STRINGS.EKYC.UPLOAD_BACK_TITLE}
            uploadDesc={STRINGS.EKYC.UPLOAD_BACK_DESC}
            imageUri={backImageUri}
            cloudUrl={backCloudUrl}
            uploading={uploadingBack}
            disabled={!hasAddress || !isEditable}
            editable={isEditable}
            onPress={() => handlePickPhoto('back')}
          />

          {/* 4. Ảnh chân dung cầm CCCD */}
          <EkycPhotoUploadField
            label={STRINGS.OWNER_EKYC.SELFIE_WITH_ID_LABEL}
            uploadTitle={STRINGS.OWNER_EKYC.UPLOAD_SELFIE_TITLE}
            uploadDesc={STRINGS.OWNER_EKYC.UPLOAD_SELFIE_DESC}
            imageUri={selfieImageUri}
            cloudUrl={selfieCloudUrl}
            uploading={uploadingSelfie}
            disabled={!hasAddress || !isEditable}
            editable={isEditable}
            iconName="person-circle-outline"
            previewHeight={230}
            onPress={() => handlePickPhoto('selfie')}
          />
        </View>

        {isEditable && (
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
                <ActivityIndicator size="small" color={theme.colors.white} />
                <Text style={styles.submitButtonText}>
                  {uploadingFront || uploadingBack || uploadingSelfie
                    ? STRINGS.EKYC.SUBMITTING_UPLOADING
                    : STRINGS.EKYC.SUBMITTING_REQUEST}
                </Text>
              </View>
            ) : (
              <View style={styles.submittingRow}>
                <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.white} />
                <Text style={styles.submitButtonText}>
                  {isRejected
                    ? STRINGS.OWNER_EKYC.SUBMIT_BUTTON_RESUBMIT
                    : STRINGS.OWNER_EKYC.SUBMIT_BUTTON_NEW}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <EkycAddressModal
        visible={showAddressModal}
        value={addressInput}
        saving={savingAddress}
        onChangeText={setAddressInput}
        onCancel={() => setShowAddressModal(false)}
        onSave={handleSaveAddress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.text.muted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
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
    color: theme.colors.text.primary,
  },
  scrollContent: {
    padding: 16,
  },
  bannerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  lockedCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.amberLight,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: theme.radii.md,
    padding: 14,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  lockedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  lockedSubtitle: {
    fontSize: 13,
    color: '#B45309',
    marginTop: 3,
    lineHeight: 18,
  },
  goRenterBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.amber,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radii.sm,
  },
  goRenterBtnText: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  verifiedBanner: {
    flexDirection: 'row',
    backgroundColor: theme.colors.greenLight,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: theme.radii.md,
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
    backgroundColor: theme.colors.blueLight,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: theme.radii.md,
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
    backgroundColor: theme.colors.redLight,
    borderWidth: 1,
    borderColor: theme.colors.redBorder,
    borderRadius: theme.radii.md,
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
    backgroundColor: theme.colors.brand[50],
    borderWidth: 1,
    borderColor: theme.colors.brand[200],
    borderRadius: theme.radii.md,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  introTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  introSubtitle: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 3,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    ...theme.shadows.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: theme.colors.text.muted,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 17,
  },
  fieldItem: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radii.md,
    paddingHorizontal: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text.primary,
    paddingVertical: 10,
    marginLeft: 8,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: theme.colors.brand[500],
    borderRadius: theme.radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...theme.shadows.cardHover,
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.text.subtle,
    shadowOpacity: 0,
    elevation: 0,
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default OwnerEkycVerificationScreen;

