import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';
import { bookingService, Booking } from '../../services/bookingService';
import { uploadImage } from '../../services/uploadService';

interface HandoverCameraModalProps {
  visible: boolean;
  booking: Booking | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface PhotoSlot {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const PHOTO_SLOTS: PhotoSlot[] = [
  {
    key: 'front',
    title: STRINGS.HANDOVER_CAMERA.SLOT_FRONT_TITLE,
    subtitle: STRINGS.HANDOVER_CAMERA.SLOT_FRONT_SUB,
    icon: 'phone-portrait-outline',
  },
  {
    key: 'back',
    title: STRINGS.HANDOVER_CAMERA.SLOT_BACK_TITLE,
    subtitle: STRINGS.HANDOVER_CAMERA.SLOT_BACK_SUB,
    icon: 'camera-reverse-outline',
  },
  {
    key: 'edges',
    title: STRINGS.HANDOVER_CAMERA.SLOT_EDGES_TITLE,
    subtitle: STRINGS.HANDOVER_CAMERA.SLOT_EDGES_SUB,
    icon: 'tablet-landscape-outline',
  },
  {
    key: 'accessories',
    title: STRINGS.HANDOVER_CAMERA.SLOT_ACC_TITLE,
    subtitle: STRINGS.HANDOVER_CAMERA.SLOT_ACC_SUB,
    icon: 'cube-outline',
  },
];

export function HandoverCameraModal({
  visible,
  booking,
  onClose,
  onSuccess,
}: HandoverCameraModalProps) {
  const [photos, setPhotos] = useState<string[]>(['', '', '', '']);
  const [conditionNotes, setConditionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);
  const [saveSuccessVisible, setSaveSuccessVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const existing =
      booking?.handoverPhotos?.beforeRental ||
      (booking as any)?.handover?.beforePhotos ||
      [];

    if (Array.isArray(existing) && existing.length > 0) {
      const initial = ['', '', '', ''];
      existing.forEach((url, i) => {
        if (i < 4) initial[i] = url;
      });
      setPhotos(initial);
    } else {
      setPhotos(['', '', '', '']);
    }

    const note =
      booking?.conditionNotes?.before ||
      (booking as any)?.handover?.beforeNote ||
      '';
    setConditionNotes(note);
  }, [booking, visible]);

  if (!booking) return null;

  const isLocked = booking.status !== 'approved';

  const handlePickImage = (index: number) => {
    if (isLocked) {
      setErrorMessage(STRINGS.HANDOVER_CAMERA.NOT_ALLOWED_ACTIVE);
      return;
    }
    setPickerSlotIndex(index);
  };

  const handleLaunchCamera = async () => {
    if (pickerSlotIndex === null) return;
    const targetIndex = pickerSlotIndex;
    setPickerSlotIndex(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage(STRINGS.HANDOVER_CAMERA.PERMISSION_ALERT_MSG);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        const updated = [...photos];
        updated[targetIndex] = result.assets[0].uri;
        setPhotos(updated);
      }
    } catch (err: any) {
      setErrorMessage(err.message || STRINGS.HANDOVER_CAMERA.ERROR_ALERT_MSG);
    }
  };

  const handleLaunchLibrary = async () => {
    if (pickerSlotIndex === null) return;
    const targetIndex = pickerSlotIndex;
    setPickerSlotIndex(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage(STRINGS.HANDOVER_CAMERA.PERMISSION_LIB_MSG);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        const updated = [...photos];
        updated[targetIndex] = result.assets[0].uri;
        setPhotos(updated);
      }
    } catch (err: any) {
      setErrorMessage(err.message || STRINGS.HANDOVER_CAMERA.ERROR_ALERT_MSG);
    }
  };

  const handleRemovePhoto = (index: number) => {
    if (isLocked) return;
    const updated = [...photos];
    updated[index] = '';
    setPhotos(updated);
  };

  const handleSave = async () => {
    if (isLocked) {
      setErrorMessage(STRINGS.HANDOVER_CAMERA.NOT_ALLOWED_ACTIVE);
      return;
    }

    const validPhotos = photos.filter((p: string) => Boolean(p && p.trim()));
    if (validPhotos.length === 0) {
      setErrorMessage(STRINGS.HANDOVER_CAMERA.MISSING_PHOTOS_MSG);
      return;
    }

    try {
      setSubmitting(true);

      // Upload photos from device to Cloudinary to obtain https://res.cloudinary.com/... URLs
      const uploadedPhotos = await Promise.all(
        validPhotos.map(async (photoUri, i) => {
          if (photoUri.startsWith('http://') || photoUri.startsWith('https://')) {
            return photoUri;
          }
          return await uploadImage(photoUri, `handover-${booking._id}-${i}`);
        })
      );

      await bookingService.updateBeforeRentalPhotos(
        booking._id,
        uploadedPhotos,
        conditionNotes.trim()
      );
      setSaveSuccessVisible(true);
    } catch (err: any) {
      console.error('Error saving handover photos:', err);
      setErrorMessage(err.response?.data?.message || STRINGS.HANDOVER_CAMERA.ERROR_ALERT_MSG);
    } finally {
      setSubmitting(false);
    }
  };

  const countTaken = photos.filter(Boolean).length;
  const progressPercent = Math.round((countTaken / 4) * 100);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Top Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="camera" size={22} color={colors.light.primary} />
              </View>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.title} numberOfLines={1}>{STRINGS.HANDOVER_CAMERA.TITLE}</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  Order #{booking.bookingCode} • {STRINGS.HANDOVER_CAMERA.SUBTITLE}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={submitting}>
              <Ionicons name="close" size={20} color={colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Locked Notice Banner if order is active/completed */}
          {isLocked && (
            <View style={styles.lockedNoticeBox}>
              <Ionicons name="lock-closed" size={16} color={colors.light.warning} />
              <Text style={styles.lockedNoticeText}>
                {STRINGS.HANDOVER_CAMERA.NOT_ALLOWED_ACTIVE}
              </Text>
            </View>
          )}

          {/* Progress Row */}
          <View style={styles.progressContainer}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressText}>
                {STRINGS.HANDOVER_CAMERA.CAPTURED_LABEL(countTaken, 4)}
              </Text>
              <View style={styles.percentBadge}>
                <Text style={styles.percentBadgeText}>{progressPercent}%</Text>
              </View>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* 4 Photo Slots Grid */}
            <View style={styles.slotsGrid}>
              {PHOTO_SLOTS.map((slot, index) => {
                const photoUri = photos[index];
                return (
                  <View key={slot.key} style={styles.slotItem}>
                    {photoUri ? (
                      <TouchableOpacity
                        style={styles.photoFilledCard}
                        onPress={() => setPreviewPhoto(photoUri)}
                        activeOpacity={0.9}
                      >
                        <Image source={{ uri: photoUri }} style={styles.photoPreview} />

                        {/* Top Overlay Badge */}
                        <View style={styles.photoTag}>
                          <Ionicons name="checkmark-circle" size={12} color={colors.light.primary} />
                          <Text style={styles.photoTagText} numberOfLines={1}>
                            {slot.title}
                          </Text>
                        </View>

                        {/* Action buttons (only if not locked) */}
                        {!isLocked && (
                          <View style={styles.photoActionRow}>
                            <TouchableOpacity
                              style={styles.retakePhotoBtn}
                              onPress={() => handlePickImage(index)}
                              activeOpacity={0.75}
                            >
                              <Ionicons name="camera-reverse-outline" size={14} color={colors.light.white} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.removePhotoBtn}
                              onPress={() => handleRemovePhoto(index)}
                              activeOpacity={0.75}
                            >
                              <Ionicons name="trash-outline" size={14} color={colors.light.white} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.slotEmptyCard, isLocked && styles.slotDisabled]}
                        onPress={() => handlePickImage(index)}
                        activeOpacity={0.75}
                        disabled={isLocked}
                      >
                        <View style={styles.emptyIconBox}>
                          <Ionicons name={slot.icon} size={24} color={colors.light.primary} />
                        </View>
                        <Text style={styles.slotTitleText}>{slot.title}</Text>
                        <Text style={styles.slotSubText} numberOfLines={2}>
                          {slot.subtitle}
                        </Text>
                        <View style={styles.addBadge}>
                          <Ionicons name="camera-outline" size={12} color={colors.light.primaryDark} />
                          <Text style={styles.addBadgeText}>
                            {STRINGS.HANDOVER_CAMERA.TAKE_PHOTO_BADGE}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Condition Notes Input */}
            <View style={styles.notesContainer}>
              <View style={styles.notesHeaderRow}>
                <Ionicons name="document-text-outline" size={16} color={colors.light.primaryDark} />
                <Text style={styles.notesLabel}>{STRINGS.HANDOVER_CAMERA.NOTES_LABEL}</Text>
              </View>
              <TextInput
                style={[styles.notesInput, isLocked && styles.inputDisabled]}
                placeholder={STRINGS.HANDOVER_CAMERA.NOTES_PLACEHOLDER}
                placeholderTextColor={colors.light.textMuted}
                multiline
                numberOfLines={3}
                value={conditionNotes}
                onChangeText={setConditionNotes}
                editable={!isLocked}
              />
            </View>

            {/* Safety & Deposit Advice Card */}
            <View style={styles.adviceBox}>
              <View style={styles.adviceIconWrap}>
                <Ionicons name="shield-checkmark" size={18} color={colors.light.primaryDark} />
              </View>
              <Text style={styles.adviceText}>{STRINGS.HANDOVER_CAMERA.ADVICE_TEXT}</Text>
            </View>
          </ScrollView>

          {/* Bottom Action Bar */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelBtnText}>{STRINGS.HANDOVER_CAMERA.SKIP}</Text>
            </TouchableOpacity>

            {!isLocked ? (
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  (submitting || countTaken === 0) && styles.saveBtnDisabled,
                ]}
                onPress={handleSave}
                disabled={submitting || countTaken === 0}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.light.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-done-circle" size={18} color={colors.light.white} />
                    <Text style={styles.saveBtnText}>{STRINGS.HANDOVER_CAMERA.SAVE_RECORD_BTN}</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.lockedBtn}>
                <Ionicons name="lock-closed" size={16} color={colors.light.textMuted} />
                <Text style={styles.lockedBtnText}>Record Locked</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── CUSTOM PHOTO PICKER DIALOG (REPLACES NATIVE ALERT) ── */}
        {pickerSlotIndex !== null && (
          <View style={styles.dialogBackdrop}>
            <View style={styles.dialogCard}>
              <View style={styles.pickerIconCircle}>
                <Ionicons name="camera" size={28} color={colors.light.primary} />
              </View>

              <Text style={styles.dialogTitle}>{STRINGS.HANDOVER_CAMERA.PICK_ALERT_TITLE}</Text>
              <Text style={styles.dialogSubtitle}>
                {pickerSlotIndex !== null && PHOTO_SLOTS[pickerSlotIndex]
                  ? `${PHOTO_SLOTS[pickerSlotIndex].title} — Choose capture method:`
                  : STRINGS.HANDOVER_CAMERA.PICK_ALERT_MSG}
              </Text>

              <View style={styles.pickerOptionsWrap}>
                {/* Option 1: Camera */}
                <TouchableOpacity
                  style={styles.pickerOptionCard}
                  onPress={handleLaunchCamera}
                  activeOpacity={0.8}
                >
                  <View style={styles.pickerOptionIconCircle}>
                    <Ionicons name="camera" size={22} color={colors.light.primary} />
                  </View>
                  <View style={styles.pickerOptionTextWrap}>
                    <Text style={styles.pickerOptionTitle}>
                      {STRINGS.HANDOVER_CAMERA.TAKE_PHOTO_BTN}
                    </Text>
                    <Text style={styles.pickerOptionDesc}>
                      Take photos directly with camera
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.light.textMuted} />
                </TouchableOpacity>

                {/* Option 2: Gallery */}
                <TouchableOpacity
                  style={styles.pickerOptionCard}
                  onPress={handleLaunchLibrary}
                  activeOpacity={0.8}
                >
                  <View style={styles.pickerOptionIconCircle}>
                    <Ionicons name="images" size={22} color={colors.light.primary} />
                  </View>
                  <View style={styles.pickerOptionTextWrap}>
                    <Text style={styles.pickerOptionTitle}>
                      {STRINGS.HANDOVER_CAMERA.CHOOSE_LIBRARY_BTN}
                    </Text>
                    <Text style={styles.pickerOptionDesc}>
                      Select an image from device gallery
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.light.textMuted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.pickerCancelBtn}
                onPress={() => setPickerSlotIndex(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.pickerCancelBtnText}>{STRINGS.HANDOVER_CAMERA.CANCEL}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── CUSTOM SAVE SUCCESS DIALOG ── */}
        {saveSuccessVisible && (
          <View style={styles.dialogBackdrop}>
            <View style={styles.dialogCard}>
              <View style={styles.successIconCircle}>
                <Ionicons name="shield-checkmark" size={32} color={colors.light.primary} />
              </View>

              <Text style={styles.dialogTitle}>{STRINGS.HANDOVER_CAMERA.SUCCESS_ALERT_TITLE}</Text>
              <Text style={styles.dialogSubtitle}>{STRINGS.HANDOVER_CAMERA.SUCCESS_ALERT_MSG}</Text>

              <TouchableOpacity
                style={styles.dialogCtaBtn}
                onPress={() => {
                  setSaveSuccessVisible(false);
                  onSuccess();
                  onClose();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.dialogCtaBtnText}>Awesome</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── CUSTOM ALERT / ERROR DIALOG ── */}
        {Boolean(errorMessage) && (
          <View style={styles.dialogBackdrop}>
            <View style={styles.dialogCard}>
              <View style={[styles.successIconCircle, { backgroundColor: colors.light.dangerLight }]}>
                <Ionicons name="alert-circle" size={32} color={colors.light.danger} />
              </View>

              <Text style={styles.dialogTitle}>{STRINGS.HANDOVER_CAMERA.ERROR_ALERT_TITLE}</Text>
              <Text style={styles.dialogSubtitle}>{errorMessage}</Text>

              <TouchableOpacity
                style={[styles.dialogCtaBtn, { backgroundColor: colors.light.textPrimary }]}
                onPress={() => setErrorMessage(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.dialogCtaBtnText}>{STRINGS.COMMON.OK}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Full Photo Preview Modal */}
      {previewPhoto && (
        <Modal
          visible={Boolean(previewPhoto)}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewPhoto(null)}
        >
          <View style={styles.previewBackdrop}>
            <TouchableOpacity
              style={styles.previewCloseBtn}
              onPress={() => setPreviewPhoto(null)}
            >
              <Ionicons name="close" size={24} color={colors.light.white} />
            </TouchableOpacity>
            <Image
              source={{ uri: previewPhoto }}
              style={styles.fullPreviewImage}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.light.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.light.borderDefault,
    alignSelf: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.light.textPrimary,
  },
  orderBadge: {
    backgroundColor: colors.light.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  orderBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.textSecondary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.light.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.light.warningLight,
    borderWidth: 1,
    borderColor: colors.light.warning,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  lockedNoticeText: {
    flex: 1,
    fontSize: 12,
    color: colors.light.textPrimary,
    lineHeight: 16,
  },
  progressContainer: {
    marginBottom: 14,
    backgroundColor: colors.light.background,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  percentBadge: {
    backgroundColor: colors.light.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  percentBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.light.primaryDark,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.light.borderDefault,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.light.primary,
    borderRadius: 3,
  },
  scrollBody: {
    paddingBottom: 16,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  slotItem: {
    width: '48%',
    aspectRatio: 1.05,
  },
  slotEmptyCard: {
    flex: 1,
    backgroundColor: colors.light.background,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.light.borderDefault,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  slotDisabled: {
    opacity: 0.6,
  },
  emptyIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  slotTitleText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.light.textPrimary,
    textAlign: 'center',
  },
  slotSubText: {
    fontSize: 10,
    color: colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 14,
  },
  addBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.light.primaryLight,
    borderWidth: 1,
    borderColor: colors.light.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    marginTop: 8,
  },
  addBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
  photoFilledCard: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.light.textPrimary,
    borderWidth: 1.5,
    borderColor: colors.light.primary,
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 9999,
  },
  photoTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.light.white,
    maxWidth: 90,
  },
  photoActionRow: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    gap: 6,
  },
  retakePhotoBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesContainer: {
    marginBottom: 14,
    backgroundColor: colors.light.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  notesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  notesInput: {
    backgroundColor: colors.light.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 12,
    fontSize: 13,
    color: colors.light.textPrimary,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    opacity: 0.7,
  },
  adviceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.light.primaryBg,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.light.primaryLight,
  },
  adviceIconWrap: {
    marginTop: 1,
  },
  adviceText: {
    flex: 1,
    fontSize: 12,
    color: colors.light.primaryDark,
    lineHeight: 18,
    fontWeight: '500',
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.light.borderSubtle,
    backgroundColor: colors.light.card,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textSecondary,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: colors.light.primary,
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.light.white,
    letterSpacing: 0.3,
  },
  lockedBtn: {
    flex: 2,
    flexDirection: 'row',
    height: 48,
    borderRadius: 9999,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  lockedBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textMuted,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 24,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fullPreviewImage: {
    width: '90%',
    height: '80%',
  },
  dialogBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
    elevation: 30,
  },
  dialogCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  pickerIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  dialogTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.light.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  dialogSubtitle: {
    fontSize: 13,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  pickerOptionsWrap: {
    width: '100%',
    gap: 10,
    marginBottom: 16,
  },
  pickerOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  pickerOptionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptionTextWrap: {
    flex: 1,
  },
  pickerOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 2,
  },
  pickerOptionDesc: {
    fontSize: 11,
    color: colors.light.textSecondary,
  },
  pickerCancelBtn: {
    width: '100%',
    height: 44,
    borderRadius: 9999,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textSecondary,
  },
  successIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dialogCtaBtn: {
    width: '100%',
    height: 48,
    borderRadius: 9999,
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  dialogCtaBtnText: {
    color: colors.light.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
