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
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../../store';
import { theme } from '../../theme/tokens';
import {
  getEkycStatus,
  uploadEkycPhoto,
  submitEkycRequest,
  EkycProfile,
  EkycRequestData,
  OwnerEkycRequestData,
} from '../../services/ekycService';
import { userService } from '../../services/userService';
import { STRINGS } from '../../constants/strings';
import {
  EkycConfirmModal,
  EkycModalSummaryItem,
  EkycResultModal,
} from '../../components/ekyc/EkycFeedbackModals';
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
  });

  const [isVerified, setIsVerified] = useState(false);
  const [ekycRequest, setEkycRequest] = useState<EkycRequestData | null>(null);
  const [ownerEkycRequest, setOwnerEkycRequest] = useState<OwnerEkycRequestData | null>(null);

  const [idCardNumber, setIdCardNumber] = useState('');
  const [frontImageUri, setFrontImageUri] = useState<string | null>(null);
  const [backImageUri, setBackImageUri] = useState<string | null>(null);

  const [frontCloudUrl, setFrontCloudUrl] = useState<string | null>(null);
  const [backCloudUrl, setBackCloudUrl] = useState<string | null>(null);

  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);

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
      const res = await getEkycStatus();
      if (res.success && res.data) {
        setIsVerified(res.data.isVerified);
        setProfile(res.data.profile);
        setAddressInput(res.data.profile.address || '');
        setOwnerEkycRequest(res.data.ownerEkycRequest || null);

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

  const hasAddress = Boolean(profile.address && profile.address.trim().length > 0);

  const uploadSlotBackground = async (
    slot: 'front' | 'back',
    localUri: string
  ): Promise<string | null> => {
    if (!localUri) return null;
    const setCloud = slot === 'front' ? setFrontCloudUrl : setBackCloudUrl;
    const setUploading = slot === 'front' ? setUploadingFront : setUploadingBack;
    const prefix = slot === 'front' ? 'cccd-front' : 'cccd-back';

    if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
      setCloud(localUri);
      return localUri;
    }

    try {
      setUploading(true);
      const url = await uploadEkycPhoto(localUri, prefix);
      setCloud(url);
      return url;
    } catch (err: any) {
      console.warn(`[Ekyc] Upload ${slot} error:`, err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSelectedUri = (slot: 'front' | 'back', uri: string) => {
    if (slot === 'front') {
      setFrontImageUri(uri);
      setFrontCloudUrl(null);
    } else {
      setBackImageUri(uri);
      setBackCloudUrl(null);
    }
    uploadSlotBackground(slot, uri);
  };

  const handlePickImage = (type: 'front' | 'back') => {
    setPickerOptions({
      title: STRINGS.EKYC.PICK_IMAGE_TITLE,
      description:
        type === 'front' ? STRINGS.EKYC.PICK_IMAGE_FRONT_DESC : STRINGS.EKYC.PICK_IMAGE_BACK_DESC,
      aspect: [85, 54],
      onSelected: (uri) => handleSelectedUri(type, uri),
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
      await userService.updateProfile({
        address: addressInput.trim(),
      });

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

    setConfirmSubmitVisible(true);
  };

  const handleConfirmSubmit = async () => {
    const cleanId = idCardNumber.trim();
    if (!frontImageUri || !backImageUri) return;

    try {
      setSubmitting(true);

      const [uploadedFrontUrl, uploadedBackUrl] = await Promise.all([
        frontCloudUrl ? Promise.resolve(frontCloudUrl) : uploadSlotBackground('front', frontImageUri),
        backCloudUrl ? Promise.resolve(backCloudUrl) : uploadSlotBackground('back', backImageUri),
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

      const response = await submitEkycRequest({
        idCardNumber: cleanId,
        idCardFrontUrl: uploadedFrontUrl,
        idCardBackUrl: uploadedBackUrl,
      });

      setConfirmSubmitVisible(false);

      if (response.success) {
        fetchStatus();
        setResultModal({
          visible: true,
          type: 'success',
          title: STRINGS.EKYC.SUBMIT_SUCCESS_TITLE,
          message: STRINGS.EKYC.SUBMIT_SUCCESS_MSG,
          shouldNavigateBack: true,
          summaryItems: [
            {
              icon: 'shield-checkmark-outline',
              label: STRINGS.EKYC.SUMMARY_TYPE_LABEL,
              value: STRINGS.EKYC.SUMMARY_TYPE_RENTER,
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
          title: STRINGS.EKYC.SUBMIT_FAIL_TITLE,
          message: response.message || STRINGS.EKYC.DEFAULT_ERROR,
        });
      }
    } catch (err: any) {
      setConfirmSubmitVisible(false);
      const msg = err.response?.data?.message || err.message || STRINGS.EKYC.NETWORK_ERROR;
      setResultModal({
        visible: true,
        type: 'error',
        title: STRINGS.EKYC.VERIFICATION_ERROR_TITLE,
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
        <Text style={styles.loadingText}>{STRINGS.EKYC.LOADING_TEXT}</Text>
      </View>
    );
  }

  const isApproved = Boolean(
    ekycRequest?.status === 'approved' || (isVerified && authUser?.role === 'admin')
  );
  const isPending = ekycRequest?.status === 'pending';
  const isRejected = ekycRequest?.status === 'rejected';
  const isEditable = !isApproved && !isPending;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.surface} />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{STRINGS.EKYC.HEADER_TITLE}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {isApproved ? (
          <>
            <EkycStatusBanner
              variant="approved"
              title={STRINGS.EKYC.VERIFIED_BANNER_TITLE}
              subtitle={STRINGS.EKYC.VERIFIED_BANNER_SUB}
            />

            {(profile.role || authUser?.role) === 'renter' && (
              <View style={styles.ownerUpgradeCard}>
                <View style={styles.ownerUpgradeHeader}>
                  <View style={styles.ownerUpgradeIconWrap}>
                    <Ionicons name="ribbon-outline" size={22} color={theme.colors.brand[500]} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.ownerUpgradeTitle}>
                      {STRINGS.EKYC.OWNER_UPGRADE_CARD_TITLE}
                    </Text>
                    <Text style={styles.ownerUpgradeDesc}>
                      {ownerEkycRequest?.status === 'pending'
                        ? STRINGS.EKYC.OWNER_UPGRADE_CARD_DESC_PENDING
                        : ownerEkycRequest?.status === 'rejected'
                        ? STRINGS.EKYC.OWNER_UPGRADE_CARD_DESC_REJECTED
                        : STRINGS.EKYC.OWNER_UPGRADE_CARD_DESC_NEW}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.ownerUpgradeBtn}
                  onPress={() => navigation?.navigate?.('OwnerEkycVerification')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="arrow-up-circle-outline" size={18} color={theme.colors.white} />
                  <Text style={styles.ownerUpgradeBtnText}>
                    {ownerEkycRequest?.status === 'pending'
                      ? STRINGS.EKYC.OWNER_UPGRADE_CTA_PENDING
                      : ownerEkycRequest?.status === 'rejected'
                      ? STRINGS.EKYC.OWNER_UPGRADE_CTA_REJECTED
                      : STRINGS.EKYC.OWNER_UPGRADE_CTA_NEW}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : isPending ? (
          <EkycStatusBanner
            variant="pending"
            title={STRINGS.EKYC.PENDING_BANNER_TITLE}
            subtitle={STRINGS.EKYC.PENDING_BANNER_SUB}
          />
        ) : isRejected ? (
          <EkycStatusBanner
            variant="rejected"
            title={STRINGS.EKYC.REJECTED_BANNER_TITLE}
            subtitle={
              ekycRequest?.rejectReason
                ? `${STRINGS.EKYC.REJECTED_REASON_PREFIX}${ekycRequest.rejectReason}`
                : STRINGS.EKYC.REJECTED_DEFAULT_REASON
            }
          />
        ) : (
          <EkycStatusBanner
            variant="intro"
            icon="shield-checkmark"
            title={STRINGS.EKYC.INTRO_TITLE}
            subtitle={STRINGS.EKYC.INTRO_SUB}
          />
        )}

        {!hasAddress && (
          <EkycAddressWarningCard onUpdatePress={() => setShowAddressModal(true)} />
        )}

        <EkycProfileReadOnlyCard
          profile={profile}
          hasAddress={hasAddress}
          onAddAddressPress={() => setShowAddressModal(true)}
        />

        <EkycFormSectionCard
          title={STRINGS.EKYC.SECTION_ID_CARD_TITLE}
          subtitle={STRINGS.EKYC.SECTION_ID_CARD_SUB}
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
            onPress={() => handlePickImage('front')}
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
            isLast={true}
            onPress={() => handlePickImage('back')}
          />
        </EkycFormSectionCard>

        {isEditable && (
          <EkycSubmitButton
            label={
              isRejected ? STRINGS.EKYC.SUBMIT_BUTTON_RESUBMIT : STRINGS.EKYC.SUBMIT_BUTTON_NEW
            }
            loadingLabel={
              uploadingFront || uploadingBack
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
        title={STRINGS.EKYC.CONFIRM_SUBMIT_TITLE}
        message={STRINGS.EKYC.CONFIRM_SUBMIT_MSG}
        icon="shield-checkmark-outline"
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
            icon: 'card-outline',
            label: STRINGS.EKYC.SUMMARY_TYPE_LABEL,
            value: STRINGS.EKYC.SUMMARY_TYPE_RENTER,
          },
        ]}
        noticeText={STRINGS.EKYC.CONFIRM_SUBMIT_NOTICE}
        confirmText={STRINGS.EKYC.CONFIRM_SUBMIT_BTN}
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
  ownerUpgradeCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.brand[200],
    borderRadius: theme.radii.lg,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  ownerUpgradeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ownerUpgradeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.brand[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerUpgradeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  ownerUpgradeDesc: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 3,
    lineHeight: 18,
  },
  ownerUpgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand[500],
    borderRadius: theme.radii.md,
    paddingVertical: 12,
    marginTop: 12,
    gap: 6,
  },
  ownerUpgradeBtnText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default EkycVerificationScreen;
