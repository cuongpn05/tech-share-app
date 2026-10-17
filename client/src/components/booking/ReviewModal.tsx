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
      Alert.alert(STRINGS.REVIEW_MODAL.INCOMPLETE_ALERT_TITLE, STRINGS.REVIEW_MODAL.INCOMPLETE_ALERT_MSG);
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

      Alert.alert(
        STRINGS.REVIEW_MODAL.SUCCESS_ALERT_TITLE,
        STRINGS.REVIEW_MODAL.SUCCESS_ALERT_MSG,
        [
          {
            text: STRINGS.REVIEW_MODAL.ALERT_BUTTON_AWESOME,
            onPress: () => {
              onClose();
              onSuccess();
            },
          },
        ]
      );
    } catch (error: any) {
      const msg = error.response?.data?.message || STRINGS.REVIEW_MODAL.ERROR_DEFAULT;
      Alert.alert(STRINGS.COMMON.ERROR, msg);
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
              <Ionicons name="close" size={24} color={colors.light.textSecondary} />
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

            {/* ── SECTION 1: ĐÁNH GIÁ SẢN PHẨM / THIẾT BỊ ── */}
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

            {/* ── SECTION 2: ĐÁNH GIÁ DỊCH VỤ CỦA CHỦ MÁY ── */}
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.light.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.light.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.light.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.light.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: 16,
  },
  deviceThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
    marginBottom: 14,
  },
  ownerSection: {
    borderColor: colors.light.primaryLight,
    backgroundColor: colors.light.primaryBg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.light.textSecondary,
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 6,
  },
  starTouch: {
    padding: 4,
  },
  ratingTextLabel: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.warning,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
  tagChipActive: {
    backgroundColor: colors.light.primaryLight,
    borderColor: colors.light.primary,
  },
  tagText: {
    fontSize: 12,
    color: colors.light.textSecondary,
  },
  tagTextActive: {
    color: colors.light.primaryDark,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: colors.light.textPrimary,
    backgroundColor: colors.light.surface,
    textAlignVertical: 'top',
    minHeight: 65,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.surface,
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
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.primary,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.white,
  },
});
