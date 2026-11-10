import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../theme/tokens';
import { STRINGS } from '../../constants/strings';
import { EkycProfile } from '../../services/ekycService';

export interface PickEkycImageOptions {
  title: string;
  description: string;
  aspect: [number, number];
  cameraType?: ImagePicker.CameraType;
  onSelected: (uri: string) => void;
}

/**
 * Modal chọn nguồn ảnh (Chụp ảnh mới / Chọn từ thư viện) đồng bộ chuẩn Soft-UI cho cả Renter & Owner eKYC.
 */
export function EkycImagePickerModal({
  options,
  onClose,
  onError,
}: {
  options: PickEkycImageOptions | null;
  onClose: () => void;
  onError: (title: string, message: string) => void;
}) {
  const launchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (launchTimerRef.current) {
        clearTimeout(launchTimerRef.current);
      }
    };
  }, []);

  const launchCamera = async (opts: PickEkycImageOptions) => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        onError(STRINGS.EKYC.PERMISSION_TITLE, STRINGS.EKYC.CAMERA_PERMISSION_MSG);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: opts.aspect,
        quality: 0.65,
        cameraType: opts.cameraType ?? ImagePicker.CameraType.back,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        opts.onSelected(result.assets[0].uri);
      }
    } catch (err: any) {
      onError(
        STRINGS.COMMON.ERROR,
        STRINGS.EKYC.CAMERA_ERROR_PREFIX + (err.message || STRINGS.EKYC.UNKNOWN_ERROR)
      );
    }
  };

  const launchGallery = async (opts: PickEkycImageOptions) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        onError(STRINGS.EKYC.PERMISSION_TITLE, STRINGS.EKYC.GALLERY_PERMISSION_MSG);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: opts.aspect,
        quality: 0.65,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        opts.onSelected(result.assets[0].uri);
      }
    } catch (err: any) {
      onError(
        STRINGS.COMMON.ERROR,
        STRINGS.EKYC.GALLERY_ERROR_PREFIX + (err.message || STRINGS.EKYC.UNKNOWN_ERROR)
      );
    }
  };

  const handleSelectSource = (source: 'camera' | 'gallery') => {
    if (!options) return;
    const currentOptions = options;
    onClose();

    if (launchTimerRef.current) {
      clearTimeout(launchTimerRef.current);
    }
    // Đợi modal đóng hoàn toàn rồi mới bật Camera/Thư viện ảnh để tránh xung đột native controller trên iOS
    launchTimerRef.current = setTimeout(() => {
      if (source === 'camera') {
        launchCamera(currentOptions);
      } else {
        launchGallery(currentOptions);
      }
    }, 180);
  };

  return (
    <Modal
      visible={Boolean(options)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={styles.modalContent} accessibilityRole="alert">
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color={theme.colors.text.muted} />
          </TouchableOpacity>

          <View style={styles.modalIconOuterRing}>
            <View style={styles.modalIconInnerCircle}>
              <Ionicons name="camera-outline" size={26} color={theme.colors.white} />
            </View>
          </View>

          <Text style={styles.modalTitle}>{options?.title || ''}</Text>
          <Text style={styles.modalSubtitle}>{options?.description || ''}</Text>

          <View style={styles.pickerOptionsList}>
            <TouchableOpacity
              style={styles.pickerOptionCard}
              onPress={() => handleSelectSource('camera')}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <View style={styles.pickerOptionIconWrap}>
                <Ionicons name="camera-outline" size={20} color={theme.colors.brand[600]} />
              </View>
              <View style={styles.pickerOptionTextWrap}>
                <Text style={styles.pickerOptionTitle}>{STRINGS.EKYC.TAKE_PHOTO}</Text>
                <Text style={styles.pickerOptionDesc}>{STRINGS.EKYC.TAKE_PHOTO_DESC}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.text.subtle} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickerOptionCard}
              onPress={() => handleSelectSource('gallery')}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <View style={styles.pickerOptionIconWrap}>
                <Ionicons name="images-outline" size={20} color={theme.colors.brand[600]} />
              </View>
              <View style={styles.pickerOptionTextWrap}>
                <Text style={styles.pickerOptionTitle}>{STRINGS.EKYC.CHOOSE_FROM_GALLERY}</Text>
                <Text style={styles.pickerOptionDesc}>{STRINGS.EKYC.CHOOSE_FROM_GALLERY_DESC}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.text.subtle} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.pickerCancelBtn}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={styles.modalCancelBtnText}>{STRINGS.COMMON.CANCEL}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export type EkycStatusBannerVariant = 'approved' | 'pending' | 'rejected' | 'intro' | 'locked';

const BANNER_CONFIG: Record<
  EkycStatusBannerVariant,
  {
    bg: string;
    border: string;
    iconColor: string;
    titleColor: string;
    subtitleColor: string;
    defaultIcon: keyof typeof Ionicons.glyphMap;
  }
> = {
  approved: {
    bg: theme.colors.greenLight,
    border: '#A7F3D0',
    iconColor: theme.colors.green,
    titleColor: '#065F46',
    subtitleColor: '#047857',
    defaultIcon: 'checkmark-circle',
  },
  pending: {
    bg: theme.colors.blueLight,
    border: '#BFDBFE',
    iconColor: theme.colors.blue,
    titleColor: '#1E40AF',
    subtitleColor: '#1D4ED8',
    defaultIcon: 'time-outline',
  },
  rejected: {
    bg: theme.colors.redLight,
    border: theme.colors.redBorder,
    iconColor: theme.colors.red,
    titleColor: '#991B1B',
    subtitleColor: '#B91C1C',
    defaultIcon: 'alert-circle-outline',
  },
  intro: {
    bg: theme.colors.brand[50],
    border: theme.colors.brand[200],
    iconColor: theme.colors.brand[500],
    titleColor: theme.colors.text.primary,
    subtitleColor: theme.colors.text.secondary,
    defaultIcon: 'shield-checkmark',
  },
  locked: {
    bg: theme.colors.amberLight,
    border: '#FDE68A',
    iconColor: theme.colors.amber,
    titleColor: '#92400E',
    subtitleColor: '#B45309',
    defaultIcon: 'lock-closed-outline',
  },
};

export function EkycStatusBanner({
  variant,
  title,
  subtitle,
  icon,
  actionText,
  onActionPress,
}: {
  variant: EkycStatusBannerVariant;
  title: string;
  subtitle: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionText?: string;
  onActionPress?: () => void;
}) {
  const cfg = BANNER_CONFIG[variant];

  return (
    <View
      style={[
        styles.bannerCard,
        { backgroundColor: cfg.bg, borderColor: cfg.border },
        variant === 'locked' && styles.bannerCardTopAligned,
      ]}
    >
      <Ionicons name={icon || cfg.defaultIcon} size={30} color={cfg.iconColor} />
      <View style={styles.bannerTextContainer}>
        <Text style={[styles.bannerTitle, { color: cfg.titleColor }]}>{title}</Text>
        <Text style={[styles.bannerSubtitle, { color: cfg.subtitleColor }]}>{subtitle}</Text>
        {actionText && onActionPress ? (
          <TouchableOpacity style={styles.bannerActionBtn} onPress={onActionPress}>
            <Text style={styles.bannerActionBtnText}>{actionText}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function EkycAddressWarningCard({ onUpdatePress }: { onUpdatePress: () => void }) {
  return (
    <View style={styles.addressWarningCard}>
      <View style={styles.addressWarningHeader}>
        <View style={styles.addressWarningIconWrap}>
          <Ionicons name="location-outline" size={20} color={theme.colors.brand[500]} />
        </View>
        <View style={styles.addressWarningTextWrap}>
          <Text style={styles.warningTitle}>{STRINGS.EKYC.ADDRESS_WARNING_TITLE}</Text>
          <Text style={styles.warningSubtitle}>{STRINGS.EKYC.ADDRESS_WARNING_SUB}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.updateAddressButton}
        onPress={onUpdatePress}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Ionicons name="create-outline" size={16} color={theme.colors.white} />
        <Text style={styles.updateAddressButtonText}>{STRINGS.EKYC.UPDATE_ADDRESS_NOW}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function EkycProfileReadOnlyCard({
  profile,
  hasAddress,
  onAddAddressPress,
}: {
  profile: EkycProfile;
  hasAddress: boolean;
  onAddAddressPress: () => void;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <Ionicons name="person-circle-outline" size={20} color={theme.colors.brand[500]} />
        <Text style={styles.sectionTitle}>{STRINGS.EKYC.SECTION_PROFILE_TITLE}</Text>
        <View style={styles.readOnlyBadge}>
          <Ionicons name="lock-closed" size={11} color={theme.colors.text.muted} />
          <Text style={styles.readOnlyText}>{STRINGS.EKYC.READ_ONLY_BADGE}</Text>
        </View>
      </View>
      <Text style={styles.sectionSubtitle}>{STRINGS.EKYC.SECTION_PROFILE_SUB}</Text>

      <View style={styles.fieldItem}>
        <Text style={styles.fieldLabel}>{STRINGS.EKYC.FULL_NAME_LABEL}</Text>
        <View style={[styles.fieldBox, styles.fieldBoxDisabled]}>
          <Ionicons name="person-outline" size={16} color={theme.colors.text.muted} />
          <Text style={styles.fieldValueText}>{profile.name || STRINGS.EKYC.NOT_UPDATED}</Text>
        </View>
      </View>

      <View style={styles.fieldItem}>
        <Text style={styles.fieldLabel}>{STRINGS.EKYC.EMAIL_LABEL}</Text>
        <View style={[styles.fieldBox, styles.fieldBoxDisabled]}>
          <Ionicons name="mail-outline" size={16} color={theme.colors.text.muted} />
          <Text style={styles.fieldValueText}>{profile.email || STRINGS.EKYC.NOT_UPDATED}</Text>
        </View>
      </View>

      <View style={styles.fieldItem}>
        <Text style={styles.fieldLabel}>{STRINGS.EKYC.PHONE_LABEL}</Text>
        <View style={[styles.fieldBox, styles.fieldBoxDisabled]}>
          <Ionicons name="call-outline" size={16} color={theme.colors.text.muted} />
          <Text style={styles.fieldValueText}>{profile.phone || STRINGS.EKYC.NOT_UPDATED}</Text>
        </View>
      </View>

      <View style={[styles.fieldItem, styles.fieldItemLast]}>
        <View style={styles.fieldLabelRow}>
          <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>{STRINGS.EKYC.ADDRESS_LABEL}</Text>
          {!hasAddress && (
            <TouchableOpacity onPress={onAddAddressPress}>
              <Text style={styles.fieldActionText}>{STRINGS.EKYC.ADD_ADDRESS_ACTION}</Text>
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
            color={hasAddress ? theme.colors.text.muted : theme.colors.red}
          />
          <Text
            style={[
              styles.fieldValueText,
              !hasAddress && { color: theme.colors.red, fontWeight: '500' },
            ]}
          >
            {hasAddress ? profile.address : STRINGS.EKYC.ADDRESS_REQUIRED_ERROR}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function EkycFormSectionCard({
  title,
  subtitle,
  icon = 'card-outline',
  children,
}: {
  title: string;
  subtitle: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <Ionicons name={icon} size={20} color={theme.colors.brand[500]} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      {children}
    </View>
  );
}

export function EkycIdNumberField({
  value,
  editable,
  onChangeText,
}: {
  value: string;
  editable: boolean;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={styles.fieldItem}>
      <Text style={styles.fieldLabel}>{STRINGS.EKYC.ID_NUMBER_LABEL}</Text>
      <View style={[styles.inputContainer, !editable && styles.fieldBoxDisabled]}>
        <Ionicons name="barcode-outline" size={20} color={theme.colors.brand[500]} />
        <TextInput
          style={styles.textInput}
          placeholder={STRINGS.EKYC.ID_NUMBER_PLACEHOLDER}
          placeholderTextColor={theme.colors.text.subtle}
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          maxLength={12}
          editable={editable}
        />
      </View>
    </View>
  );
}

export interface EkycPhotoUploadFieldProps {
  label: string;
  uploadTitle: string;
  uploadDesc: string;
  imageUri: string | null;
  cloudUrl: string | null;
  uploading: boolean;
  disabled: boolean;
  editable: boolean;
  iconName?: keyof typeof Ionicons.glyphMap;
  previewHeight?: number;
  isLast?: boolean;
  onPress: () => void;
}

export function EkycPhotoUploadField({
  label,
  uploadTitle,
  uploadDesc,
  imageUri,
  cloudUrl,
  uploading,
  disabled,
  editable,
  iconName = 'cloud-upload-outline',
  previewHeight = 180,
  isLast = false,
  onPress,
}: EkycPhotoUploadFieldProps) {
  return (
    <View style={[styles.fieldItem, isLast && styles.fieldItemLast]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {imageUri ? (
        <View style={styles.imagePreviewWrapper}>
          <Image
            source={{ uri: imageUri }}
            style={[styles.imagePreview, { height: previewHeight }]}
          />
          {cloudUrl && !uploading && (
            <View style={styles.cloudReadyBadge}>
              <Ionicons name="cloud-done" size={14} color={theme.colors.green} />
              <Text style={styles.cloudReadyBadgeText}>{STRINGS.EKYC.CLOUD_UPLOADED}</Text>
            </View>
          )}
          {editable && (
            <TouchableOpacity style={styles.changeImageButton} onPress={onPress}>
              <Ionicons name="camera-reverse-outline" size={16} color={theme.colors.white} />
              <Text style={styles.changeImageButtonText}>{STRINGS.EKYC.CHANGE_PHOTO}</Text>
            </TouchableOpacity>
          )}
          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="small" color={theme.colors.white} />
              <Text style={styles.uploadingOverlayText}>{STRINGS.EKYC.UPLOADING_CLOUD}</Text>
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.uploadBox, disabled && styles.uploadBoxDisabled]}
          onPress={onPress}
          disabled={disabled}
        >
          <View style={styles.uploadIconCircle}>
            <Ionicons name={iconName} size={26} color={theme.colors.brand[500]} />
          </View>
          <Text style={styles.uploadBoxTitle}>{uploadTitle}</Text>
          <Text style={styles.uploadBoxDesc}>{uploadDesc}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function EkycSubmitButton({
  label,
  loadingLabel,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  loadingLabel: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.submitButton, disabled && styles.submitButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <View style={styles.submittingRow}>
          <ActivityIndicator size="small" color={theme.colors.white} />
          <Text style={styles.submitButtonText}>{loadingLabel}</Text>
        </View>
      ) : (
        <View style={styles.submittingRow}>
          <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.white} />
          <Text style={styles.submitButtonText}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function EkycAddressModal({
  visible,
  value,
  saving,
  errorText,
  onChangeText,
  onCancel,
  onSave,
}: {
  visible: boolean;
  value: string;
  saving: boolean;
  errorText?: string;
  onChangeText: (text: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!saving) onCancel();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            if (!saving) onCancel();
          }}
        >
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={styles.modalContent} accessibilityRole="alert">
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={onCancel}
            disabled={saving}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color={theme.colors.text.muted} />
          </TouchableOpacity>

          <View style={styles.modalIconOuterRing}>
            <View style={styles.modalIconInnerCircle}>
              <Ionicons name="location-outline" size={26} color={theme.colors.white} />
            </View>
          </View>

          <Text style={styles.modalTitle}>{STRINGS.EKYC.ADDRESS_MODAL_TITLE}</Text>
          <Text style={styles.modalSubtitle}>{STRINGS.EKYC.ADDRESS_MODAL_SUB}</Text>

          <View style={styles.addressInputWrap}>
            <TextInput
              style={[styles.addressModalInput, Boolean(errorText) && styles.addressModalInputError]}
              placeholder={STRINGS.EKYC.ADDRESS_MODAL_PLACEHOLDER}
              placeholderTextColor={theme.colors.text.subtle}
              value={value}
              onChangeText={onChangeText}
              multiline
              numberOfLines={3}
              editable={!saving}
            />
            {Boolean(errorText) && <Text style={styles.addressModalError}>{errorText}</Text>}
          </View>

          <View style={styles.modalActionRow}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={onCancel}
              disabled={saving}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.modalCancelBtnText}>{STRINGS.EKYC.LATER}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, saving && styles.modalSaveBtnDisabled]}
              onPress={onSave}
              disabled={saving}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text style={styles.modalSaveBtnText}>{STRINGS.EKYC.SAVE_ADDRESS}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bannerCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: theme.radii.lg,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  bannerCardTopAligned: {
    alignItems: 'flex-start',
  },
  bannerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  bannerSubtitle: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  bannerActionBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.brand[500],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radii.md,
  },
  bannerActionBtnText: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  addressWarningCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.brand[200],
    borderRadius: theme.radii.lg,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  addressWarningHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressWarningIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.brand[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressWarningTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  warningSubtitle: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 3,
    lineHeight: 18,
  },
  updateAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand[500],
    paddingVertical: 11,
    borderRadius: theme.radii.md,
    marginTop: 12,
    gap: 6,
  },
  updateAddressButtonText: {
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 13.5,
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
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  readOnlyText: {
    fontSize: 11,
    color: theme.colors.text.muted,
    fontWeight: '600',
    marginLeft: 4,
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
  fieldItemLast: {
    marginBottom: 0,
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
    color: theme.colors.text.secondary,
    marginBottom: 6,
  },
  fieldActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.brand[600],
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    backgroundColor: theme.colors.surface,
  },
  fieldBoxDisabled: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border.light,
  },
  fieldBoxAlert: {
    borderColor: theme.colors.redBorder,
    backgroundColor: theme.colors.redLight,
  },
  fieldValueText: {
    fontSize: 14,
    color: theme.colors.text.primary,
    marginLeft: 8,
    flex: 1,
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
  uploadBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.text.subtle,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.md,
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
    backgroundColor: theme.colors.brand[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  uploadBoxDesc: {
    fontSize: 12,
    color: theme.colors.text.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  imagePreviewWrapper: {
    position: 'relative',
    borderRadius: theme.radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  imagePreview: {
    width: '100%',
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
    borderRadius: theme.radii.sm,
  },
  changeImageButtonText: {
    color: theme.colors.white,
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
    color: theme.colors.white,
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
    backgroundColor: theme.colors.greenLight,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 4,
  },
  cloudReadyBadgeText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii['2xl'],
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.divider,
    ...theme.shadows.cardHover,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  modalIconOuterRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.brand[100],
    borderWidth: 3,
    borderColor: theme.colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalIconInnerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13.5,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  addressInputWrap: {
    width: '100%',
    marginBottom: 18,
  },
  addressModalInput: {
    width: '100%',
    backgroundColor: theme.colors.background,
    borderWidth: 1.5,
    borderColor: theme.colors.border.light,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.text.primary,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  addressModalInputError: {
    borderColor: theme.colors.red,
    backgroundColor: theme.colors.redLight,
  },
  addressModalError: {
    fontSize: 12,
    color: theme.colors.red,
    marginTop: 6,
    fontWeight: '500',
  },
  modalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    color: theme.colors.text.secondary,
    fontWeight: '600',
    fontSize: 14,
  },
  modalSaveBtn: {
    flex: 1,
    height: 46,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.brand[500],
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  modalSaveBtnDisabled: {
    opacity: 0.7,
  },
  modalSaveBtnText: {
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  pickerOptionsList: {
    width: '100%',
    gap: 10,
    marginBottom: 14,
  },
  pickerOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.brand[50],
    borderWidth: 1,
    borderColor: theme.colors.brand[100],
    borderRadius: theme.radii.lg,
    padding: 13,
    gap: 12,
  },
  pickerOptionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptionTextWrap: {
    flex: 1,
  },
  pickerOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  pickerOptionDesc: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  pickerCancelBtn: {
    width: '100%',
    height: 46,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
