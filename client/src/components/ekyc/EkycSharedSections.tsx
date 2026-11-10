import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
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
 * Hiển thị hộp thoại chọn Camera hoặc Thư viện ảnh cho quy trình eKYC.
 */
export function promptEkycImagePicker({
  title,
  description,
  aspect,
  cameraType = ImagePicker.CameraType.back,
  onSelected,
}: PickEkycImageOptions) {
  const launchCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(STRINGS.EKYC.PERMISSION_TITLE, STRINGS.EKYC.CAMERA_PERMISSION_MSG);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect,
        quality: 0.65,
        cameraType,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        onSelected(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert(
        STRINGS.COMMON.ERROR,
        STRINGS.EKYC.CAMERA_ERROR_PREFIX + (err.message || STRINGS.EKYC.UNKNOWN_ERROR)
      );
    }
  };

  const launchGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(STRINGS.EKYC.PERMISSION_TITLE, STRINGS.EKYC.GALLERY_PERMISSION_MSG);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect,
        quality: 0.65,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        onSelected(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert(
        STRINGS.COMMON.ERROR,
        STRINGS.EKYC.GALLERY_ERROR_PREFIX + (err.message || STRINGS.EKYC.UNKNOWN_ERROR)
      );
    }
  };

  Alert.alert(title, description, [
    { text: STRINGS.EKYC.TAKE_PHOTO, onPress: launchCamera },
    { text: STRINGS.EKYC.CHOOSE_FROM_GALLERY, onPress: launchGallery },
    { text: STRINGS.COMMON.CANCEL, style: 'cancel' },
  ]);
}

export function EkycAddressWarningCard({ onUpdatePress }: { onUpdatePress: () => void }) {
  return (
    <View style={styles.addressWarningCard}>
      <Ionicons name="warning-outline" size={26} color={theme.colors.amber} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.warningTitle}>{STRINGS.EKYC.ADDRESS_WARNING_TITLE}</Text>
        <Text style={styles.warningSubtitle}>{STRINGS.EKYC.ADDRESS_WARNING_SUB}</Text>
        <TouchableOpacity style={styles.updateAddressButton} onPress={onUpdatePress}>
          <Ionicons name="location-outline" size={16} color={theme.colors.white} />
          <Text style={styles.updateAddressButtonText}>{STRINGS.EKYC.UPDATE_ADDRESS_NOW}</Text>
        </TouchableOpacity>
      </View>
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

      <View style={styles.fieldItem}>
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
  onPress,
}: EkycPhotoUploadFieldProps) {
  return (
    <View style={styles.fieldItem}>
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

export function EkycAddressModal({
  visible,
  value,
  saving,
  onChangeText,
  onCancel,
  onSave,
}: {
  visible: boolean;
  value: string;
  saving: boolean;
  onChangeText: (text: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Ionicons name="location" size={24} color={theme.colors.brand[500]} />
            <Text style={styles.modalTitle}>{STRINGS.EKYC.ADDRESS_MODAL_TITLE}</Text>
          </View>
          <Text style={styles.modalSubtitle}>{STRINGS.EKYC.ADDRESS_MODAL_SUB}</Text>

          <TextInput
            style={styles.addressModalInput}
            placeholder={STRINGS.EKYC.ADDRESS_MODAL_PLACEHOLDER}
            placeholderTextColor={theme.colors.text.subtle}
            value={value}
            onChangeText={onChangeText}
            multiline={true}
            numberOfLines={3}
          />

          <View style={styles.modalActionRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onCancel} disabled={saving}>
              <Text style={styles.modalCancelBtnText}>{STRINGS.EKYC.LATER}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSaveBtn} onPress={onSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text style={styles.modalSaveBtnText}>{STRINGS.EKYC.SAVE_ADDRESS}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  addressWarningCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.amberLight,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: theme.radii.md,
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
    backgroundColor: theme.colors.amber,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radii.sm,
    marginTop: 10,
  },
  updateAddressButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 5,
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
    color: theme.colors.blue,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
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
    color: theme.colors.text.primary,
    marginLeft: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: theme.colors.text.muted,
    marginTop: 6,
    lineHeight: 18,
  },
  addressModalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radii.md,
    padding: 12,
    fontSize: 14,
    color: theme.colors.text.primary,
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
    borderRadius: theme.radii.sm,
    marginRight: 10,
  },
  modalCancelBtnText: {
    color: theme.colors.text.muted,
    fontWeight: '600',
    fontSize: 14,
  },
  modalSaveBtn: {
    backgroundColor: theme.colors.brand[500],
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveBtnText: {
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
