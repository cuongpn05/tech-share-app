import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';
import { Booking } from '../../services/bookingService';
import { reviewService } from '../../services/reviewService';

interface ReviewModalProps {
  visible: boolean;
  onClose: () => void;
  booking: Booking | null;
  onSuccess: () => void;
}

export function ReviewModal({ visible, onClose, booking, onSuccess }: ReviewModalProps) {
  const [deviceRating, setDeviceRating] = useState(5);
  const [deviceComment, setDeviceComment] = useState('');
  const [ownerRating, setOwnerRating] = useState(5);
  const [ownerFeedback, setOwnerFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deviceName = booking?.deviceId?.name || STRINGS.REVIEW_MODAL.DEFAULT_DEVICE_NAME;
  const deviceImage = booking?.deviceId?.images?.[0] || 'https://via.placeholder.com/150';
  const ownerName = booking?.ownerId?.name || STRINGS.REVIEW_MODAL.DEFAULT_OWNER_NAME;

  const toggleDeviceTag = (tag: string) => {
    if (deviceComment.includes(tag)) {
      setDeviceComment(
        deviceComment
          .replace(tag, '')
          .replace(/,\s*,/g, ',')
          .trim()
      );
    } else {
      setDeviceComment((prev: string) => (prev ? `${prev}, ${tag}` : tag));
    }
  };

  const toggleOwnerTag = (tag: string) => {
    if (ownerFeedback.includes(tag)) {
      setOwnerFeedback(
        ownerFeedback
          .replace(tag, '')
          .replace(/,\s*,/g, ',')
          .trim()
      );
    } else {
      setOwnerFeedback((prev: string) => (prev ? `${prev}, ${tag}` : tag));
    }
  };

  const handleSubmit = async () => {
    if (!booking) return;

    if (!deviceComment.trim()) {
      setErrorMessage(STRINGS.REVIEW_MODAL.INCOMPLETE_ALERT_MSG);
      return;
    }

    try {
      setLoading(true);
      await reviewService.createReview({
        bookingId: booking._id,
        rating: deviceRating,
        comment: deviceComment.trim(),
        ownerRating,
        ownerFeedback: ownerFeedback.trim(),
      });

      setShowSuccessModal(true);
    } catch (error: any) {
      const msg = error.response?.data?.message || STRINGS.REVIEW_MODAL.ERROR_DEFAULT;
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!booking) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetContainer}>
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Ionicons name="star" size={20} color={colors.light.warning} />
              </View>
              <View>
                <Text style={styles.title}>{STRINGS.REVIEW_MODAL.TITLE}</Text>
                <Text style={styles.subtitle}>{STRINGS.REVIEW_MODAL.ORDER_PREFIX}{booking.bookingCode}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Device Info Card */}
            <View style={styles.deviceCard}>
              <Image source={{ uri: deviceImage }} style={styles.deviceThumb} />
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName} numberOfLines={2}>
                  {deviceName}
                </Text>
                <Text style={styles.ownerText}>
                  {STRINGS.REVIEW_MODAL.OWNER_PREFIX}<Text style={{ fontWeight: '700' }}>{ownerName}</Text>
                </Text>
              </View>
            </View>

            {/* ── SECTION 1: DEVICE REVIEW & RATINGS ── */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="hardware-chip-outline" size={18} color={colors.light.primary} />
                <Text style={styles.sectionTitle}>{STRINGS.REVIEW_MODAL.DEVICE_SECTION_TITLE}</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                {STRINGS.REVIEW_MODAL.DEVICE_SECTION_SUBTITLE}
              </Text>

              {/* Star selector */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setDeviceRating(star)}
                    activeOpacity={0.7}
                    style={styles.starTouch}
                  >
                    <Ionicons
                      name={star <= deviceRating ? 'star' : 'star-outline'}
                      size={32}
                      color={star <= deviceRating ? colors.light.warning : colors.light.borderDefault}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.ratingTextLabel}>{STRINGS.REVIEW_MODAL.RATING_LABELS[deviceRating]}</Text>

              {/* Quick tags */}
              <View style={styles.tagsContainer}>
                {STRINGS.REVIEW_MODAL.DEVICE_TAGS.map((tag) => {
                  const isSelected = deviceComment.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tagChip, isSelected && styles.tagChipActive]}
                      onPress={() => toggleDeviceTag(tag)}
                    >
                      <Text style={[styles.tagText, isSelected && styles.tagTextActive]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Device comment input */}
              <TextInput
                style={styles.textInput}
                placeholder={STRINGS.REVIEW_MODAL.DEVICE_COMMENT_PLACEHOLDER}
                placeholderTextColor={colors.light.textSecondary}
                value={deviceComment}
                onChangeText={setDeviceComment}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* ── SECTION 2: OWNER SERVICE REVIEW ── */}
            <View style={[styles.section, styles.ownerSection]}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="person-circle-outline" size={18} color={colors.light.primaryDark} />
                <Text style={[styles.sectionTitle, { color: colors.light.primaryDark }]}>
                  {STRINGS.REVIEW_MODAL.OWNER_SECTION_TITLE}
                </Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                {STRINGS.REVIEW_MODAL.OWNER_SECTION_SUBTITLE}
              </Text>

              {/* Star selector for owner */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setOwnerRating(star)}
                    activeOpacity={0.7}
                    style={styles.starTouch}
                  >
                    <Ionicons
                      name={star <= ownerRating ? 'star' : 'star-outline'}
                      size={28}
                      color={star <= ownerRating ? colors.light.primaryDark : colors.light.borderDefault}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.ratingTextLabel, { color: colors.light.primaryDark }]}>
                {STRINGS.REVIEW_MODAL.OWNER_RATING_LABELS[ownerRating]}
              </Text>

              {/* Quick tags for owner */}
              <View style={styles.tagsContainer}>
                {STRINGS.REVIEW_MODAL.OWNER_TAGS.map((tag) => {
                  const isSelected = ownerFeedback.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.tagChip,
                        isSelected && { backgroundColor: colors.light.primaryLight, borderColor: colors.light.primary },
                      ]}
                      onPress={() => toggleOwnerTag(tag)}
                    >
                      <Text
                        style={[
                          styles.tagText,
                          isSelected && { color: colors.light.primaryDark, fontWeight: '700' },
                        ]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Owner feedback input */}
              <TextInput
                style={styles.textInput}
                placeholder={STRINGS.REVIEW_MODAL.OWNER_FEEDBACK_PLACEHOLDER}
                placeholderTextColor={colors.light.textSecondary}
                value={ownerFeedback}
                onChangeText={setOwnerFeedback}
                multiline
                numberOfLines={2}
              />
            </View>
          </ScrollView>

          {/* Action Row */}
          <View style={styles.footerActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelBtnText}>{STRINGS.REVIEW_MODAL.SKIP}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.light.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={colors.light.white} />
                  <Text style={styles.submitBtnText}>{STRINGS.REVIEW_MODAL.SUBMIT}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── CUSTOM SUCCESS POPUP DIALOG ── */}
        {showSuccessModal && (
          <View style={styles.dialogBackdrop}>
            <View style={styles.dialogCard}>
              <View style={styles.successIconCircle}>
                <Ionicons name="sparkles" size={32} color={colors.light.primary} />
              </View>

              <Text style={styles.dialogTitle}>{STRINGS.REVIEW_MODAL.SUCCESS_ALERT_TITLE}</Text>
              <Text style={styles.dialogMessage}>{STRINGS.REVIEW_MODAL.SUCCESS_ALERT_MSG}</Text>

              <TouchableOpacity
                style={styles.dialogCtaBtn}
                onPress={() => {
                  setShowSuccessModal(false);
                  onClose();
                  onSuccess();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.dialogCtaBtnText}>{STRINGS.REVIEW_MODAL.ALERT_BUTTON_AWESOME}</Text>
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

              <Text style={styles.dialogTitle}>{STRINGS.REVIEW_MODAL.INCOMPLETE_ALERT_TITLE}</Text>
              <Text style={styles.dialogMessage}>{errorMessage}</Text>

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
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.light.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingTop: 8,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.light.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.light.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.light.background,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: 16,
  },
  deviceThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.light.borderDefault,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 4,
  },
  ownerText: {
    fontSize: 12,
    color: colors.light.textSecondary,
  },
  section: {
    backgroundColor: colors.light.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  ownerSection: {
    borderColor: colors.light.primaryLight,
    backgroundColor: colors.light.primaryBg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.light.textSecondary,
    marginBottom: 14,
    lineHeight: 16,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 8,
    paddingVertical: 4,
  },
  starTouch: {
    padding: 4,
  },
  ratingTextLabel: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: colors.light.warning,
    marginBottom: 14,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.background,
  },
  tagChipActive: {
    backgroundColor: colors.light.primaryLight,
    borderColor: colors.light.primary,
  },
  tagText: {
    fontSize: 12,
    color: colors.light.textSecondary,
    fontWeight: '500',
  },
  tagTextActive: {
    color: colors.light.primaryDark,
    fontWeight: '700',
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: colors.light.textPrimary,
    backgroundColor: colors.light.background,
    textAlignVertical: 'top',
    minHeight: 70,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1,
    borderTopColor: colors.light.borderSubtle,
    backgroundColor: colors.light.surface,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textSecondary,
  },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.primary,
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.light.white,
    letterSpacing: 0.3,
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
    elevation: 24,
  },
  dialogCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 24,
    padding: 26,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
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
  dialogTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.light.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  dialogMessage: {
    fontSize: 14,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
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
