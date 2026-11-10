import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
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
  onChat?: () => void;
}

const getStatusMeta = (status?: string) => {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending',
        icon: 'time-outline' as const,
        color: theme.colors.amber,
        bgColor: theme.colors.amberLight,
      };
    case 'approved':
      return {
        label: 'Approved',
        icon: 'checkmark-circle-outline' as const,
        color: theme.colors.brand[600],
        bgColor: theme.colors.brand[50],
      };
    case 'active':
      return {
        label: 'Active',
        icon: 'play-circle-outline' as const,
        color: theme.colors.blue,
        bgColor: theme.colors.blueLight,
      };
    case 'completed':
      return {
        label: 'Completed',
        icon: 'checkmark-done-circle-outline' as const,
        color: theme.colors.green,
        bgColor: theme.colors.greenLight,
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        icon: 'close-circle-outline' as const,
        color: theme.colors.red,
        bgColor: theme.colors.redLight,
      };
    case 'rejected':
      return {
        label: 'Declined',
        icon: 'close-circle-outline' as const,
        color: theme.colors.red,
        bgColor: theme.colors.redLight,
      };
    default:
      return {
        label: status || 'Pending',
        icon: 'time-outline' as const,
        color: theme.colors.text.secondary,
        bgColor: theme.colors.surfaceMuted,
      };
  }
};

const formatShortDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

export function BookingItemCard({
  booking,
  onPress,
  onCancel,
  onExtend,
  onReview,
  onReRent,
  onChat,
}: BookingItemCardProps) {
  const statusMeta = getStatusMeta(booking.status);
  const device = booking.deviceId || {};
  const deviceName = device.name || device.title || 'Device';
  const deviceImage =
    (Array.isArray(device.images) && device.images.length > 0 ? device.images[0] : null) ||
    device.image ||
    'https://via.placeholder.com/150';

  const owner =
    booking.ownerId?._id || booking.ownerId?.name
      ? booking.ownerId
      : (device as any)?.ownerId || {};
  const ownerName = owner.name || owner.username || 'Device Owner';
  const ownerAvatar = owner.avatar;
  const isOwnerVerified = Boolean(owner.isVerified || owner.trust?.isVerified);

  const isActive = booking.status === 'active';
  const isPendingExtension = booking.extensionRequest?.status === 'pending';
  const isApprovedExtension = booking.extensionRequest?.status === 'approved';

  const totalAmount =
    booking.totalAmount ||
    booking.rentalFee ||
    (booking as any).pricing?.totalAmount ||
    0;

  const totalDays =
    booking.totalDays ||
    (booking.startDate && booking.endDate
      ? Math.max(
          1,
          Math.ceil(
            (new Date(booking.endDate).getTime() - new Date(booking.startDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 1);

  const formatDurationText = () => {
    if (!booking.startDate || !booking.endDate) {
      return `${totalDays} ${totalDays === 1 ? 'day' : 'days'}`;
    }
    const diffMs = Math.abs(new Date(booking.endDate).getTime() - new Date(booking.startDate).getTime());
    const totalHours = Math.round(diffMs / (1000 * 60 * 60));
    if (totalHours < 24) {
      return `${totalHours}h`;
    }
    const days = Math.round(totalHours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };

  const startDateStr = formatShortDate(booking.startDate);
  const endDateStr = formatShortDate(booking.endDate);
  const dateDisplay =
    startDateStr && endDateStr
      ? `${startDateStr} - ${endDateStr} (${formatDurationText()})`
      : `${formatDurationText()}`;

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      {/* 1. Header: Mã đơn hàng bên trái & Badge trạng thái bên phải */}
      <View style={styles.headerRow}>
        <View style={styles.codeContainer}>
          <Ionicons name="receipt-outline" size={13} color={theme.colors.text.subtle} />
          <Text style={styles.bookingCodeText}>
            #{booking.bookingCode || booking._id?.slice(-8)}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusMeta.bgColor }]}>
          <Ionicons name={statusMeta.icon} size={12} color={statusMeta.color} />
          <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      {/* 2. Main Content Row: 2 cột Thumbnail (72x72) + Thông tin tóm tắt */}
      <View style={styles.mainContentRow}>
        <View style={styles.thumbnailContainer}>
          {deviceImage ? (
            <Image
              source={{ uri: deviceImage }}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons
                name="hardware-chip-outline"
                size={26}
                color={theme.colors.text.subtle}
              />
            </View>
          )}
        </View>

        <View style={styles.summaryContainer}>
          <Text style={styles.deviceNameText} numberOfLines={1}>
            {deviceName}
          </Text>

          <View style={styles.dateRow}>
            <Ionicons
              name="calendar-outline"
              size={13}
              color={theme.colors.text.muted}
            />
            <Text style={styles.dateText}>{dateDisplay}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Total: </Text>
            <Text style={styles.priceValue}>
              {totalAmount.toLocaleString('en-US')} VND
            </Text>
          </View>
        </View>
      </View>

      {/* 3. Compact Active Countdown Timer */}
      {isActive && (
        <View style={styles.activeTimerWrap}>
          <RentalCountdownTimer
            startDate={booking.startDate}
            endDate={booking.endDate}
            compact={true}
          />
        </View>
      )}

      {/* Extension status indicator */}
      {isPendingExtension && (
        <View style={styles.extensionPendingTag}>
          <Ionicons name="hourglass-outline" size={12} color={theme.colors.amber} />
          <Text style={styles.extensionPendingText}>
            Extension requested (+{booking.extensionRequest?.requestedDays || 0}d)
          </Text>
        </View>
      )}

      {isApprovedExtension && (
        <View style={styles.extensionApprovedTag}>
          <Ionicons name="checkmark-circle-outline" size={12} color={theme.colors.green} />
          <Text style={styles.extensionApprovedText}>
            Extension approved (+{booking.extensionRequest?.requestedDays || 0}d)
          </Text>
        </View>
      )}

      {/* 4. Footer: Chủ thiết bị & Nút thao tác nhanh */}
      <View style={styles.footerRow}>
        <View style={styles.ownerContainer}>
          {ownerAvatar ? (
            <Image source={{ uri: ownerAvatar }} style={styles.ownerAvatar} />
          ) : (
            <View style={styles.ownerAvatarPlaceholder}>
              <Ionicons name="storefront-outline" size={11} color={theme.colors.text.subtle} />
            </View>
          )}
          <Text style={styles.ownerNameText} numberOfLines={1}>
            {ownerName}
          </Text>
          {isOwnerVerified && (
            <Ionicons
              name="checkmark-circle"
              size={12}
              color={theme.colors.green}
              style={{ marginLeft: 3 }}
            />
          )}
        </View>

        <View style={styles.footerActions}>
          {onChat && (
            <TouchableOpacity
              style={styles.chatIconButton}
              onPress={(e) => {
                e.stopPropagation?.();
                onChat();
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={theme.colors.brand[600]} />
            </TouchableOpacity>
          )}

          {booking.status === 'pending' && onCancel && (
            <TouchableOpacity
              style={styles.cancelActionBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                onCancel();
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.cancelActionText}>{STRINGS.BOOKING_ITEM_CARD.CANCEL_BOOKING || 'Cancel'}</Text>
            </TouchableOpacity>
          )}

          {isActive && onExtend && (
            <TouchableOpacity
              style={[styles.extendActionBtn, isPendingExtension && styles.actionBtnDisabled]}
              onPress={(e) => {
                e.stopPropagation?.();
                onExtend();
              }}
              disabled={isPendingExtension}
              activeOpacity={0.8}
            >
              <Ionicons
                name="calendar-outline"
                size={12}
                color={isPendingExtension ? theme.colors.text.subtle : theme.colors.brand[600]}
              />
              <Text style={[styles.extendActionText, isPendingExtension && styles.actionTextDisabled]}>
                {isPendingExtension ? 'Pending' : 'Extend'}
              </Text>
            </TouchableOpacity>
          )}

          {booking.status === 'completed' && (
            booking.isReviewed ? (
              <View style={styles.inlineActionGroup}>
                <View style={styles.reviewedBadge}>
                  <Ionicons name="checkmark-done" size={12} color={theme.colors.green} />
                  <Text style={styles.reviewedBadgeText}>Reviewed</Text>
                </View>
                {onReRent && (
                  <TouchableOpacity
                    style={styles.reRentActionBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      onReRent();
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="repeat" size={12} color={theme.colors.white} />
                    <Text style={styles.reRentActionText}>Rent Again</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : onReview ? (
              <TouchableOpacity
                style={styles.reviewActionBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onReview();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="star" size={12} color={theme.colors.amber} />
                <Text style={styles.reviewActionText}>Review</Text>
              </TouchableOpacity>
            ) : null
          )}

          <Ionicons
            name="chevron-forward"
            size={16}
            color={theme.colors.text.subtle}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bookingCodeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.subtle,
    letterSpacing: 0.2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: theme.radii.full,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  mainContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  thumbnailContainer: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border.divider,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryContainer: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 14,
  },
  deviceNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
    lineHeight: 20,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 5,
  },
  dateText: {
    fontSize: 12.5,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  priceLabel: {
    fontSize: 12.5,
    color: theme.colors.text.muted,
    fontWeight: '400',
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.brand[600],
  },
  activeTimerWrap: {
    marginBottom: 8,
  },
  extensionPendingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.amberLight,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  extensionPendingText: {
    fontSize: 11.5,
    color: theme.colors.amber,
    fontWeight: '600',
  },
  extensionApprovedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.greenLight,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  extensionApprovedText: {
    fontSize: 11.5,
    color: theme.colors.green,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.divider,
  },
  ownerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  ownerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.surfaceMuted,
  },
  ownerAvatarPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerNameText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginLeft: 6,
    maxWidth: 130,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: theme.colors.redLight,
    borderWidth: 1,
    borderColor: theme.colors.redBorder,
  },
  cancelActionText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.colors.red,
  },
  extendActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: theme.colors.brand[50],
    borderWidth: 1,
    borderColor: theme.colors.brand[200],
  },
  extendActionText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.colors.brand[600],
  },
  actionBtnDisabled: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border.light,
  },
  actionTextDisabled: {
    color: theme.colors.text.subtle,
  },
  reviewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: theme.colors.amberLight,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  reviewActionText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.colors.amber,
  },
  reviewedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: theme.colors.greenLight,
  },
  reviewedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.green,
  },
  reRentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: theme.colors.brand[600],
  },
  reRentActionText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.colors.white,
  },
});
