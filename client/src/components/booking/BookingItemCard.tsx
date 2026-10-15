import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';
import { RentalCountdownTimer } from './RentalCountdownTimer';
import { Booking } from '../../services/bookingService';

export interface BookingItemCardProps {
  booking: Booking;
  onPress: () => void;
  onCancel?: () => void;
  onExtend?: () => void;
  onReview?: () => void;
  onReRent?: () => void;
}

const STATUS_CONFIG = {
  pending: { label: STRINGS.BOOKING_DETAIL.STATUS.pending, color: colors.light.warning, icon: 'time-outline' },
  approved: { label: STRINGS.BOOKING_DETAIL.STATUS.approved, color: colors.light.primary, icon: 'checkmark-circle-outline' },
  active: { label: STRINGS.BOOKING_DETAIL.STATUS.active, color: colors.light.primary, icon: 'play-circle-outline' },
  completed: { label: STRINGS.BOOKING_DETAIL.STATUS.completed, color: colors.light.success, icon: 'star-outline' },
  cancelled: { label: STRINGS.BOOKING_DETAIL.STATUS.cancelled, color: colors.light.error, icon: 'close-circle-outline' },
  rejected: { label: STRINGS.BOOKING_DETAIL.STATUS.rejected, color: colors.light.error, icon: 'close-circle-outline' },
};

export function BookingItemCard({
  booking,
  onPress,
  onCancel,
  onExtend,
  onReview,
  onReRent,
}: BookingItemCardProps) {
  const statusConfig = STATUS_CONFIG[booking.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const deviceName = booking.deviceId?.name || 'Device';
  const deviceImage = booking.deviceId?.images?.[0] || 'https://via.placeholder.com/150';
  const isActive = booking.status === 'active';
  const isPendingExtension = booking.extensionRequest?.status === 'pending';
  const isApprovedExtension = booking.extensionRequest?.status === 'approved';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="receipt-outline" size={16} color={colors.light.textSecondary} />
          <Text style={styles.bookingCode}>#{booking.bookingCode}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
          <Ionicons name={statusConfig.icon as any} size={14} color={statusConfig.color} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        </View>
      </View>

      {/* Body: Image & Info */}
      <View style={styles.body}>
        <Image source={{ uri: deviceImage }} style={styles.image} />
        <View style={styles.info}>
          <Text style={styles.deviceName} numberOfLines={2}>
            {deviceName}
          </Text>
          <Text style={styles.dateText}>
            {STRINGS.BOOKING_ITEM_CARD.FROM_PREFIX}{new Date(booking.startDate).toLocaleDateString('en-US')}
          </Text>
          <Text style={styles.dateText}>
            {STRINGS.BOOKING_ITEM_CARD.TO_PREFIX}{new Date(booking.endDate).toLocaleDateString('en-US')} ({booking.totalDays} {booking.totalDays === 1 ? STRINGS.BOOKING_ITEM_CARD.DAY_UNIT : STRINGS.BOOKING_ITEM_CARD.DAYS_UNIT})
          </Text>
        </View>
      </View>

      {/* Countdown Timer for active rentals */}
      {isActive && (
        <View style={styles.timerWrapper}>
          <RentalCountdownTimer endDate={booking.endDate} />
        </View>
      )}

      {/* Extension status indicator */}
      {isPendingExtension && (
        <View style={styles.extensionPendingTag}>
          <Ionicons name="hourglass" size={14} color={colors.light.warning} />
          <Text style={styles.extensionPendingText}>
            {STRINGS.BOOKING_ITEM_CARD.EXTENSION_PENDING_TAG(
              booking.extensionRequest?.requestedDays || 0,
              booking.extensionRequest?.additionalFee?.toLocaleString('en-US') || '0'
            )}
          </Text>
        </View>
      )}

      {isApprovedExtension && (
        <View style={styles.extensionApprovedTag}>
          <Ionicons name="checkmark-circle" size={14} color={colors.light.success} />
          <Text style={styles.extensionApprovedText}>
            {STRINGS.BOOKING_ITEM_CARD.EXTENSION_APPROVED_TAG(
              booking.extensionRequest?.requestedDays || 0
            )}
          </Text>
        </View>
      )}

      {/* Footer Total */}
      <View style={styles.footer}>
        <Text style={styles.totalLabel}>{STRINGS.BOOKING_ITEM_CARD.TOTAL_LABEL}</Text>
        <Text style={styles.totalAmount}>
          {booking.totalAmount?.toLocaleString('en-US')} VND
        </Text>
      </View>

      {/* Action Row */}
      {(booking.status === 'pending' || isActive || booking.status === 'completed') && (
        <View style={styles.actionRow}>
          {booking.status === 'pending' && onCancel && (
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Ionicons name="close-circle-outline" size={15} color={colors.light.error} />
              <Text style={styles.cancelButtonText}>{STRINGS.BOOKING_ITEM_CARD.CANCEL_BOOKING}</Text>
            </TouchableOpacity>
          )}

          {isActive && onExtend && (
            <TouchableOpacity
              style={[
                styles.extendButton,
                isPendingExtension && styles.extendButtonDisabled,
              ]}
              onPress={onExtend}
              disabled={isPendingExtension}
            >
              <Ionicons
                name={isPendingExtension ? 'time-outline' : 'calendar-outline'}
                size={15}
                color={isPendingExtension ? colors.light.textSecondary : colors.light.primary}
              />
              <Text
                style={[
                  styles.extendButtonText,
                  isPendingExtension && styles.extendButtonTextDisabled,
                ]}
              >
                {isPendingExtension ? STRINGS.BOOKING_ITEM_CARD.EXTENSION_PENDING : STRINGS.BOOKING_ITEM_CARD.EXTEND_RENTAL}
              </Text>
            </TouchableOpacity>
          )}

          {booking.status === 'completed' && (
            booking.isReviewed ? (
              <View style={styles.completedActions}>
                <View style={styles.reviewedBadge}>
                  <Ionicons name="checkmark-done-circle" size={15} color={colors.light.success} />
                  <Text style={styles.reviewedBadgeText}>{STRINGS.BOOKING_ITEM_CARD.REVIEWED}</Text>
                </View>
                {onReRent && (
                  <TouchableOpacity style={styles.reRentButton} onPress={onReRent} activeOpacity={0.8}>
                    <Ionicons name="repeat" size={15} color={colors.light.white} />
                    <Text style={styles.reRentButtonText}>{STRINGS.BOOKING_ITEM_CARD.RENT_AGAIN}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : onReview ? (
              <TouchableOpacity style={styles.reviewButton} onPress={onReview}>
                <Ionicons name="star" size={14} color={colors.light.white} />
                <Text style={styles.reviewButtonText}>{STRINGS.BOOKING_ITEM_CARD.REVIEW_SERVICE}</Text>
              </TouchableOpacity>
            ) : null
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bookingCode: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  body: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  image: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.light.background,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 6,
  },
  dateText: {
    fontSize: 12,
    color: colors.light.textSecondary,
    marginBottom: 2,
  },
  timerWrapper: {
    marginTop: 4,
    marginBottom: 4,
  },
  extensionPendingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.light.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  extensionPendingText: {
    fontSize: 12,
    color: colors.light.warning,
    fontWeight: '600',
    flex: 1,
  },
  extensionApprovedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.light.successLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  extensionApprovedText: {
    fontSize: 12,
    color: colors.light.success,
    fontWeight: '600',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.light.borderSubtle,
    paddingTop: 10,
    marginTop: 6,
  },
  totalLabel: {
    fontSize: 13,
    color: colors.light.textSecondary,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.light.primaryDark,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.light.borderSubtle,
    paddingTop: 10,
    marginTop: 10,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.light.error,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.error,
  },
  extendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.light.primary,
    backgroundColor: colors.light.primaryLight,
  },
  extendButtonDisabled: {
    borderColor: colors.light.borderDefault,
    backgroundColor: colors.light.surface,
  },
  extendButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.primary,
  },
  extendButtonTextDisabled: {
    color: colors.light.textSecondary,
    fontWeight: '600',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.light.warning,
  },
  reviewButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.white,
  },
  reviewedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.light.successLight,
  },
  reviewedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.success,
  },
  completedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reRentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.light.primary,
  },
  reRentButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.white,
  },
});
