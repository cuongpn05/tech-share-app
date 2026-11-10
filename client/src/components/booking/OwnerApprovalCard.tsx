import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { theme } from '../../theme';
import { Booking, hasRequiredReturnPhotos } from '../../services/bookingService';

export interface OwnerApprovalCardProps {
  booking: Booking;
  onPress?: (booking: Booking) => void;
  onChat?: (booking: Booking) => void;
  onApprove?: (booking: Booking) => void;
  onReject?: (booking: Booking) => void;
  onHandover?: (booking: Booking) => void;
  onComplete?: (booking: Booking) => void;
  onTakeReturnPhotos?: (booking: Booking) => void;
  onReviewRenter?: (booking: Booking) => void;
  onViewDetails?: (booking: Booking) => void;
  isProcessing?: boolean;
}

export const OwnerApprovalCard: React.FC<OwnerApprovalCardProps> = ({
  booking,
  onPress,
  onChat,
  onApprove,
  onReject,
  onHandover,
  onComplete,
  onTakeReturnPhotos,
  onReviewRenter,
  onViewDetails,
  isProcessing = false,
}) => {
  const navigation = useNavigation<any>();
  const renter = booking.renterId || {};
  const device = booking.deviceId || {};

  const renterName = renter.name || renter.username || 'Customer';
  const renterAvatar = renter.avatar;
  const isVerified = Boolean(renter.trust?.isVerified || renter.isVerified);

  const deviceName = device.name || device.title || 'Tech Device';
  const deviceImage =
    (Array.isArray(device.images) && device.images.length > 0 ? device.images[0] : null) ||
    device.image ||
    '';

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

  const rentalFee =
    booking.rentalFee ||
    (booking as any).pricing?.rentalFee ||
    booking.totalAmount ||
    (booking as any).pricing?.totalAmount ||
    (booking.pricePerDayAtBooking || device.pricePerDay || 0) * totalDays;

  // Format dates: e.g. "13 Nov – 14 Nov 2026 · 2 days"
  const formatRentalDates = (startStr?: string, endStr?: string, days = 1) => {
    const durationSuffix = `${days} ${days === 1 ? 'day' : 'days'}`;
    if (!startStr) return durationSuffix;
    try {
      const s = new Date(startStr);
      if (isNaN(s.getTime())) return durationSuffix;

      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      const sDay = s.getDate();
      const sMonth = months[s.getMonth()];

      if (!endStr) return `${sDay} ${sMonth} · ${durationSuffix}`;
      const e = new Date(endStr);
      if (isNaN(e.getTime())) return `${sDay} ${sMonth} · ${durationSuffix}`;

      const eDay = e.getDate();
      const eMonth = months[e.getMonth()];
      const year = e.getFullYear();

      if (sMonth === eMonth) {
        return `${sDay} – ${eDay} ${eMonth} ${year} · ${durationSuffix}`;
      }
      return `${sDay} ${sMonth} – ${eDay} ${eMonth} ${year} · ${durationSuffix}`;
    } catch {
      return durationSuffix;
    }
  };

  const datesDisplay = formatRentalDates(booking.startDate, booking.endDate, totalDays);
  const formattedRentalFee = `${Number(rentalFee || 0).toLocaleString('en-US')} VND`;
  const bookingCodeDisplay = `#${booking.bookingCode || booking._id?.slice(-8).toUpperCase()}`;

  // Status Badge Configuration
  const getStatusMeta = (status?: string) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Pending',
          icon: 'time-outline' as const,
          color: colors.light.warning,
          bgColor: colors.light.warningLight,
          borderColor: colors.light.warningLight,
        };
      case 'approved':
        return {
          label: 'Approved',
          icon: 'checkmark-circle-outline' as const,
          color: colors.light.primaryDark,
          bgColor: colors.light.primaryLight,
          borderColor: theme.colors.brand[300],
        };
      case 'active':
        return {
          label: 'Active',
          icon: 'play-circle-outline' as const,
          color: theme.colors.blue,
          bgColor: theme.colors.blueLight,
          borderColor: theme.colors.blueLight,
        };
      case 'completed':
        return {
          label: 'Completed',
          icon: 'checkmark-done-circle-outline' as const,
          color: colors.light.success,
          bgColor: colors.light.successLight,
          borderColor: colors.light.successLight,
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          icon: 'close-circle-outline' as const,
          color: colors.light.textSecondary,
          bgColor: colors.light.borderSubtle,
          borderColor: colors.light.borderDefault,
        };
      case 'rejected':
        return {
          label: 'Declined',
          icon: 'close-circle-outline' as const,
          color: colors.light.error,
          bgColor: colors.light.dangerLight,
          borderColor: colors.light.dangerLight,
        };
      case 'disputed':
        return {
          label: 'Disputed',
          icon: 'warning-outline' as const,
          color: colors.light.error,
          bgColor: colors.light.dangerLight,
          borderColor: colors.light.dangerLight,
        };
      default:
        return {
          label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown',
          icon: 'information-circle-outline' as const,
          color: colors.light.textSecondary,
          bgColor: colors.light.borderSubtle,
          borderColor: colors.light.borderDefault,
        };
    }
  };

  const statusMeta = getStatusMeta(booking.status);
  const returnPhotosReady = hasRequiredReturnPhotos(booking);

  const handleCardPress = () => {
    if (onPress) {
      onPress(booking);
    } else if (onViewDetails) {
      onViewDetails(booking);
    } else {
      navigation.navigate('BookingRequestDetail', { bookingId: booking._id });
    }
  };

  const handleChatPress = (e: any) => {
    e.stopPropagation?.();
    if (onChat) {
      onChat(booking);
    } else {
      navigation.navigate('ChatDetail', { bookingId: booking._id });
    }
  };

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={handleCardPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`Booking ${bookingCodeDisplay}, ${deviceName}, status ${statusMeta.label}`}
    >
      {/* 1. Header: Booking Code & Status Badge */}
      <View style={styles.headerRow}>
        <View style={styles.codeWrap}>
          <Text style={styles.bookingCodeText}>{bookingCodeDisplay}</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: statusMeta.bgColor,
              borderColor: statusMeta.borderColor,
            },
          ]}
        >
          <Ionicons name={statusMeta.icon} size={13} color={statusMeta.color} />
          <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      {/* 2. Device Information (Thumbnail + Summary) */}
      <View style={styles.deviceSectionRow}>
        <View style={styles.thumbnailWrap}>
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
                color={colors.light.textMuted}
              />
            </View>
          )}
        </View>

        <View style={styles.deviceDetailsCol}>
          <Text style={styles.deviceNameText} numberOfLines={1}>
            {deviceName}
          </Text>

          <View style={styles.metaRow}>
            <Ionicons
              name="calendar-outline"
              size={13}
              color={colors.light.textSecondary}
            />
            <Text style={styles.datesText} numberOfLines={1}>
              {datesDisplay}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Rental fee: </Text>
            <Text style={styles.priceValue}>{formattedRentalFee}</Text>
          </View>
        </View>
      </View>

      {/* 3. Subtle Divider */}
      <View style={styles.divider} />

      {/* 4. Renter Information Row */}
      <View style={styles.renterRow}>
        <View style={styles.renterProfileCol}>
          {renterAvatar ? (
            <Image source={{ uri: renterAvatar }} style={styles.renterAvatar} />
          ) : (
            <View style={styles.renterAvatarPlaceholder}>
              <Ionicons name="person" size={13} color={colors.light.textSecondary} />
            </View>
          )}
          <Text style={styles.renterNameText} numberOfLines={1}>
            {renterName}
          </Text>
          {isVerified && (
            <Ionicons
              name="checkmark-circle"
              size={14}
              color={colors.light.success}
              style={styles.verifiedIcon}
            />
          )}
        </View>

        <View style={styles.renterActionsCol}>
          {/* Compact Chat Button */}
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={handleChatPress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Chat with ${renterName}`}
            accessibilityRole="button"
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={15}
              color={colors.light.textSecondary}
            />
          </TouchableOpacity>

          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.light.textMuted}
            style={styles.chevronIcon}
          />
        </View>
      </View>

      {/* 5. Booking Actions Section */}
      {/* Pending status: Decline (neutral secondary 38%) + Approve (primary 62%) */}
      {booking.status === 'pending' && (onApprove || onReject) && (
        <View style={styles.actionRow}>
          {onReject && (
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                onReject(booking);
              }}
              disabled={isProcessing}
              activeOpacity={0.75}
              accessibilityLabel="Decline booking request"
              accessibilityRole="button"
            >
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
          )}

          {onApprove && (
            <TouchableOpacity
              style={[styles.approveBtn, isProcessing && styles.btnDisabled]}
              onPress={(e) => {
                e.stopPropagation?.();
                onApprove(booking);
              }}
              disabled={isProcessing}
              activeOpacity={0.85}
              accessibilityLabel="Approve booking request"
              accessibilityRole="button"
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.light.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color={colors.light.white} />
                  <Text style={styles.approveBtnText}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Approved status: Scan Handover QR */}
      {booking.status === 'approved' && onHandover && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.fullWidthActionBtn, isProcessing && styles.btnDisabled]}
            onPress={(e) => {
              e.stopPropagation?.();
              onHandover(booking);
            }}
            disabled={isProcessing}
            activeOpacity={0.85}
            accessibilityLabel="Scan Handover QR"
            accessibilityRole="button"
          >
            <Ionicons name="qr-code-outline" size={16} color={colors.light.white} />
            <Text style={styles.fullWidthActionBtnText}>Scan Handover QR</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Active status: Take return photos / Complete rental */}
      {booking.status === 'active' && (onTakeReturnPhotos || onComplete) && (
        <View style={styles.actionRow}>
          {onTakeReturnPhotos && (
            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                onTakeReturnPhotos(booking);
              }}
              disabled={isProcessing}
              activeOpacity={0.75}
              accessibilityLabel="Take return inspection photos"
              accessibilityRole="button"
            >
              <Ionicons name="camera-outline" size={16} color={colors.light.primaryDark} />
              <Text style={styles.secondaryActionBtnText}>Inspection Photos</Text>
            </TouchableOpacity>
          )}

          {onComplete && (
            <TouchableOpacity
              style={[
                styles.primaryActionBtn,
                (isProcessing || !returnPhotosReady) && styles.btnDisabled,
              ]}
              onPress={(e) => {
                e.stopPropagation?.();
                onComplete(booking);
              }}
              disabled={isProcessing || !returnPhotosReady}
              activeOpacity={0.85}
              accessibilityLabel="Complete rental"
              accessibilityRole="button"
            >
              <Ionicons
                name="checkmark-done-circle"
                size={16}
                color={colors.light.white}
              />
              <Text style={styles.primaryActionBtnText}>Complete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Completed status: Renter review action / Reviewed badge */}
      {booking.status === 'completed' && (
        <View style={styles.statusFooterWrap}>
          {booking.isRenterReviewed ? (
            <View style={styles.reviewedBadge}>
              <Ionicons name="checkmark-circle" size={13} color={colors.light.success} />
              <Text style={styles.reviewedBadgeText}>Reviewed Renter</Text>
            </View>
          ) : onReviewRenter ? (
            <TouchableOpacity
              style={styles.reviewBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                onReviewRenter(booking);
              }}
              activeOpacity={0.8}
              accessibilityLabel="Review renter"
              accessibilityRole="button"
            >
              <Ionicons name="star-outline" size={14} color={colors.light.warning} />
              <Text style={styles.reviewBtnText}>Review Renter</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.light.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  codeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textPrimary,
    letterSpacing: 0.2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  deviceSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailWrap: {
    width: 68,
    height: 68,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
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
  deviceDetailsCol: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  deviceNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  datesText: {
    fontSize: 12.5,
    color: colors.light.textSecondary,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceLabel: {
    fontSize: 12.5,
    color: colors.light.textSecondary,
  },
  priceValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
  divider: {
    height: 1,
    backgroundColor: colors.light.borderSubtle,
    marginVertical: 12,
  },
  renterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  renterProfileCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  renterAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.light.background,
  },
  renterAvatarPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
  },
  renterNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginLeft: 8,
    maxWidth: 180,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  renterActionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronIcon: {
    marginLeft: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  // Critical Decline button: Subtle neutral secondary button (38% width)
  declineBtn: {
    flex: 0.38,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  // Critical Approve button: Solid TechShare primary (62% width)
  approveBtn: {
    flex: 0.62,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  approveBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.light.white,
  },
  fullWidthActionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fullWidthActionBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.light.white,
  },
  secondaryActionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.light.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.brand[300],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryActionBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.light.primaryDark,
  },
  primaryActionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryActionBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.light.white,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  statusFooterWrap: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  reviewedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.light.successLight,
  },
  reviewedBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.light.success,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.light.warningLight,
    borderWidth: 1,
    borderColor: colors.light.warningLight,
  },
  reviewBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.warning,
  },
});
