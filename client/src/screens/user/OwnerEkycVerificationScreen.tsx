/**
 * ============================================================
 *  OWNER UPGRADE EKYC VERIFICATION SCREEN
 *  client/src/screens/user/OwnerEkycVerificationScreen.tsx
 * ============================================================
 *  Mục đích:
 *   - Dành cho Renter ĐÃ XÁC THỰC gửi thêm đơn eKYC nâng cấp lên Owner.
 *   - Sử dụng cùng bộ thẻ UI đồng bộ với Renter eKYC và bổ sung thêm
 *     Ảnh chân dung cầm CCCD.
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
  ActivityIndicator,
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
  EkycFormSectionCard,
  EkycIdNumberField,
  EkycPhotoUploadField,
  EkycProfileReadOnlyCard,
  EkycStatusBanner,
  EkycSubmitButton,
  EkycImagePickerModal,
  PickEkycImageOptions,
} from '../../components/ekyc/EkycSharedSections';
import {
  EkycConfirmModal,
  EkycModalSummaryItem,
  EkycResultModal,
} from '../../components/ekyc/EkycFeedbackModals';

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
  const [addressError, setAddressError] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  const [pickerOptions, setPickerOptions] = useState<PickEkycImageOptions | null>(null);
  const [confirmSubmitVisible, setConfirmSubmitVisible] = useState(false);
  const [resultModal, setResultModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    summaryItems?: EkycModalSummaryItem[];
    shouldNavigateBack?: boolean;
  }>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

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
      setPickerOptions({
        title: STRINGS.OWNER_EKYC.PICK_SELFIE_TITLE,
        description: STRINGS.OWNER_EKYC.PICK_SELFIE_DESC,
        aspect: [3, 4],
        cameraType: ImagePicker.CameraType.front,
        onSelected: (uri) => handleSelectedUri('selfie', uri),
      });
      return;
    }

    setPickerOptions({
      title: STRINGS.EKYC.PICK_IMAGE_TITLE,
      description:
        slot === 'front' ? STRINGS.EKYC.PICK_IMAGE_FRONT_DESC : STRINGS.EKYC.PICK_IMAGE_BACK_DESC,
      aspect: [85, 54],
      onSelected: (uri) => handleSelectedUri(slot, uri),
    });
  };

  const handleSaveAddress = async () => {
    if (!addressInput.trim()) {
      setAddressError(STRINGS.EKYC.ADDRESS_EMPTY_ALERT);
      return;
    }

    try {
      setAddressError('');
      setSavingAddress(true);
      await userService.updateProfile({ address: addressInput.trim() });
      setProfile((prev) => ({ ...prev, address: addressInput.trim() }));
      setShowAddressModal(false);
      setResultModal({
        visible: true,
        type: 'success',
        title: STRINGS.COMMON.SUCCESS,
        message: STRINGS.EKYC.ADDRESS_SAVE_SUCCESS,
      });
    } catch (err: any) {
      setShowAddressModal(false);
      setResultModal({
        visible: true,
        type: 'error',
        title: STRINGS.COMMON.ERROR,
        message: err.response?.data?.message || STRINGS.EKYC.ADDRESS_SAVE_ERROR,
      });
    } finally {
      setSavingAddress(false);
    }
  };

  const handleSubmit = () => {
    if (!isRenterVerified) {
      setResultModal({
        visible: true,
        type: 'warning',
        title: STRINGS.OWNER_EKYC.RENTER_REQUIRED_TITLE,
        message: STRINGS.OWNER_EKYC.RENTER_REQUIRED_SUB,
      });
      return;
    }

    if (!hasAddress) {
      setShowAddressModal(true);
      return;
    }

    const cleanId = idCardNumber.trim();
    if (!cleanId) {
      setResultModal({
        visible: true,
        type: 'error',
        title: STRINGS.EKYC.MISSING_INFO_TITLE,
        message: STRINGS.EKYC.ID_NUMBER_REQUIRED,
      });
      return;
    }
    if (!/^\d{9,12}$/.test(cleanId)) {
      setResultModal({
        visible: true,
        type: 'error',
        title: STRINGS.EKYC.INVALID_ID_NUMBER_TITLE,
        message: STRINGS.EKYC.INVALID_ID_NUMBER_MSG,
      });
      return;
    }

    if (!frontImageUri) {
      setResultModal({
        visible: true,
        type: 'error',
        title: STRINGS.EKYC.MISSING_PHOTO_TITLE,
        message: STRINGS.EKYC.FRONT_PHOTO_REQUIRED,
      });
      return;
    }
    if (!backImageUri) {
      setResultModal({
        visible: true,
        type: 'error',
        title: STRINGS.EKYC.MISSING_PHOTO_TITLE,
        message: STRINGS.EKYC.BACK_PHOTO_REQUIRED,
      });
      return;
    }
    if (!selfieImageUri) {
      setResultModal({
        visible: true,
        type: 'error',
        title: STRINGS.EKYC.MISSING_PHOTO_TITLE,
        message: STRINGS.OWNER_EKYC.SELFIE_PHOTO_REQUIRED,
      });
      return;
    }

    setConfirmSubmitVisible(true);
  };

  const handleConfirmSubmit = async () => {
    const cleanId = idCardNumber.trim();
    if (!frontImageUri || !backImageUri || !selfieImageUri) return;

    try {
      setSubmitting(true);

      const [uploadedFrontUrl, uploadedBackUrl, uploadedSelfieUrl] = await Promise.all([
        frontCloudUrl ? Promise.resolve(frontCloudUrl) : uploadSlotBackground('front', frontImageUri),
        backCloudUrl ? Promise.resolve(backCloudUrl) : uploadSlotBackground('back', backImageUri),
        selfieCloudUrl ? Promise.resolve(selfieCloudUrl) : uploadSlotBackground('selfie', selfieImageUri),
      ]);

      if (!uploadedFrontUrl) {
        setConfirmSubmitVisible(false);
        setResultModal({
          visible: true,
          type: 'error',
          title: STRINGS.EKYC.UPLOAD_ERROR_TITLE,
          message: STRINGS.EKYC.UPLOAD_FRONT_ERROR,
        });
        return;
      }
      if (!uploadedBackUrl) {
        setConfirmSubmitVisible(false);
        setResultModal({
          visible: true,
          type: 'error',
          title: STRINGS.EKYC.UPLOAD_ERROR_TITLE,
          message: STRINGS.EKYC.UPLOAD_BACK_ERROR,
        });
        return;
      }
      if (!uploadedSelfieUrl) {
        setConfirmSubmitVisible(false);
        setResultModal({
          visible: true,
          type: 'error',
          title: STRINGS.EKYC.UPLOAD_ERROR_TITLE,
          message: STRINGS.OWNER_EKYC.UPLOAD_SELFIE_ERROR,
        });
        return;
      }

      const response = await submitOwnerEkycRequest({
        idCardNumber: cleanId,
        idCardFrontUrl: uploadedFrontUrl,
        idCardBackUrl: uploadedBackUrl,
        selfieWithIdUrl: uploadedSelfieUrl,
      });

      setConfirmSubmitVisible(false);

      if (response.success) {
        fetchStatus();
        setResultModal({
          visible: true,
          type: 'success',
          title: STRINGS.OWNER_EKYC.SUBMIT_SUCCESS_TITLE,
          message: STRINGS.OWNER_EKYC.SUBMIT_SUCCESS_MSG,
          shouldNavigateBack: true,
          summaryItems: [
            {
              icon: 'ribbon-outline',
              label: STRINGS.EKYC.SUMMARY_TYPE_LABEL,
              value: STRINGS.OWNER_EKYC.SUMMARY_TYPE_OWNER,
            },
            {
              icon: 'barcode-outline',
              label: STRINGS.EKYC.SUMMARY_ID_NUMBER_LABEL,
              value: cleanId,
            },
            {
              icon: 'time-outline',
              label: STRINGS.EKYC.SUMMARY_STATUS_LABEL,
              value: STRINGS.EKYC.SUMMARY_STATUS_PENDING,
            },
          ],
        });
      } else {
        setResultModal({
          visible: true,
          type: 'error',
          title: STRINGS.OWNER_EKYC.SUBMIT_FAIL_TITLE,
          message: response.message || STRINGS.EKYC.DEFAULT_ERROR,
        });
      }
    } catch (err: any) {
      setConfirmSubmitVisible(false);
      const msg = err.response?.data?.message || err.message || STRINGS.OWNER_EKYC.NETWORK_ERROR;
      setResultModal({
        visible: true,
        type: 'error',
        title: STRINGS.OWNER_EKYC.VERIFICATION_ERROR_TITLE,
        message: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseResultModal = () => {
    const shouldNavigateBack = resultModal.shouldNavigateBack;
    setResultModal((prev) => ({ ...prev, visible: false, shouldNavigateBack: false }));
    if (shouldNavigateBack) {
      if (onSuccess) onSuccess();
      else if (navigation?.goBack) navigation.goBack();
      else if (onBack) onBack();
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
          <EkycStatusBanner
            variant="locked"
            title={STRINGS.OWNER_EKYC.RENTER_REQUIRED_TITLE}
            subtitle={STRINGS.OWNER_EKYC.RENTER_REQUIRED_SUB}
            actionText={STRINGS.OWNER_EKYC.GO_TO_RENTER_EKYC}
            onActionPress={() => navigation?.navigate?.('EkycVerification')}
          />
        ) : isApproved ? (
          <EkycStatusBanner
            variant="approved"
            title={STRINGS.OWNER_EKYC.APPROVED_BANNER_TITLE}
            subtitle={STRINGS.OWNER_EKYC.APPROVED_BANNER_SUB}
          />
        ) : isPending ? (
          <EkycStatusBanner
            variant="pending"
            title={STRINGS.OWNER_EKYC.PENDING_BANNER_TITLE}
            subtitle={STRINGS.OWNER_EKYC.PENDING_BANNER_SUB}
          />
        ) : isRejected ? (
          <EkycStatusBanner
            variant="rejected"
            title={STRINGS.OWNER_EKYC.REJECTED_BANNER_TITLE}
            subtitle={
              ownerEkycRequest?.rejectReason
                ? `${STRINGS.OWNER_EKYC.REJECTED_REASON_PREFIX}${ownerEkycRequest.rejectReason}`
                : STRINGS.OWNER_EKYC.REJECTED_DEFAULT_REASON
            }
          />
        ) : (
          <EkycStatusBanner
            variant="intro"
            icon="ribbon-outline"
            title={STRINGS.OWNER_EKYC.INTRO_TITLE}
            subtitle={STRINGS.OWNER_EKYC.INTRO_SUB}
          />
        )}

        {isRenterVerified && !hasAddress && (
          <EkycAddressWarningCard onUpdatePress={() => setShowAddressModal(true)} />
        )}

        <EkycProfileReadOnlyCard
          profile={profile}
          hasAddress={hasAddress}
          onAddAddressPress={() => setShowAddressModal(true)}
        />

        <EkycFormSectionCard
          title={STRINGS.OWNER_EKYC.SECTION_FORM_TITLE}
          subtitle={STRINGS.OWNER_EKYC.SECTION_FORM_SUB}
        >
          <EkycIdNumberField
            value={idCardNumber}
            editable={isEditable}
            onChangeText={setIdCardNumber}
          />

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
            isLast={true}
            onPress={() => handlePickPhoto('selfie')}
          />
        </EkycFormSectionCard>

        {isEditable && (
          <EkycSubmitButton
            label={
              isRejected
                ? STRINGS.OWNER_EKYC.SUBMIT_BUTTON_RESUBMIT
                : STRINGS.OWNER_EKYC.SUBMIT_BUTTON_NEW
            }
            loadingLabel={
              uploadingFront || uploadingBack || uploadingSelfie
                ? STRINGS.EKYC.SUBMITTING_UPLOADING
                : STRINGS.EKYC.SUBMITTING_REQUEST
            }
            loading={submitting}
            disabled={!hasAddress || submitting}
            onPress={handleSubmit}
          />
        )}
      </ScrollView>

      <EkycAddressModal
        visible={showAddressModal}
        value={addressInput}
        saving={savingAddress}
        errorText={addressError}
        onChangeText={(text) => {
          setAddressInput(text);
          if (addressError) setAddressError('');
        }}
        onCancel={() => {
          setAddressError('');
          setShowAddressModal(false);
        }}
        onSave={handleSaveAddress}
      />

      <EkycImagePickerModal
        options={pickerOptions}
        onClose={() => setPickerOptions(null)}
        onError={(title, message) =>
          setResultModal({
            visible: true,
            type: 'error',
            title,
            message,
          })
        }
      />

      <EkycConfirmModal
        visible={confirmSubmitVisible}
        title={STRINGS.OWNER_EKYC.CONFIRM_SUBMIT_TITLE}
        message={STRINGS.OWNER_EKYC.CONFIRM_SUBMIT_MSG}
        icon="ribbon-outline"
        tone="brand"
        summaryItems={[
          {
            icon: 'person-outline',
            label: STRINGS.EKYC.SUMMARY_APPLICANT_LABEL,
            value: profile.name || STRINGS.EKYC.NOT_UPDATED,
          },
          {
            icon: 'barcode-outline',
            label: STRINGS.EKYC.SUMMARY_ID_NUMBER_LABEL,
            value: idCardNumber.trim(),
          },
          {
            icon: 'ribbon-outline',
            label: STRINGS.OWNER_EKYC.SUMMARY_UPGRADE_LABEL,
            value: STRINGS.OWNER_EKYC.SUMMARY_UPGRADE_VALUE,
          },
        ]}
        noticeText={STRINGS.OWNER_EKYC.CONFIRM_SUBMIT_NOTICE}
        confirmText={STRINGS.OWNER_EKYC.CONFIRM_SUBMIT_BTN}
        cancelText={STRINGS.COMMON.CANCEL}
        loading={submitting}
        onCancel={() => {
          if (!submitting) setConfirmSubmitVisible(false);
        }}
        onConfirm={handleConfirmSubmit}
      />

      <EkycResultModal
        visible={resultModal.visible}
        type={resultModal.type}
        title={resultModal.title}
        message={resultModal.message}
        summaryItems={resultModal.summaryItems}
        onClose={handleCloseResultModal}
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
});

export default OwnerEkycVerificationScreen;
