import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { OWNER_STRINGS } from '../../constants/ownerStrings';
import { Booking } from '../../services/bookingService';

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
  const strings = OWNER_STRINGS.PENDING_REQUESTS;
  const renter = booking.renterId || {};
  const device = booking.deviceId || {};

  const renterName = renter.name || renter.username || strings.DEFAULT_RENTER_NAME;
  const renterAvatar = renter.avatar;
  const isVerified = Boolean(renter.trust?.isVerified || renter.isVerified);

  const deviceName = device.name || device.title || strings.DEFAULT_DEVICE_NAME;
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

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  const startDateStr = formatShortDate(booking.startDate);
  const endDateStr = formatShortDate(booking.endDate);
  const dateDisplay =
    startDateStr && endDateStr
      ? `${startDateStr} - ${endDateStr} (${totalDays} ${strings.DAYS_UNIT})`
      : `${totalDays} ${strings.DAYS_UNIT}`;

  const formattedRentalPrice = `${(rentalFee || 0).toLocaleString('en-US')} ${strings.CURRENCY_SUFFIX}`;

  const getStatusMeta = (status?: string) => {
    switch (status) {
      case 'pending':
        return {
          label: strings.STATUS_PENDING,
          icon: 'time-outline' as const,
          color: theme.colors.amber,
          bgColor: theme.colors.amberLight,
        };
      case 'approved':
        return {
          label: strings.STATUS_APPROVED,
          icon: 'checkmark-circle-outline' as const,
          color: theme.colors.brand[600],
          bgColor: theme.colors.brand[50],
        };
      case 'active':
        return {
          label: strings.STATUS_ACTIVE,
          icon: 'play-circle-outline' as const,
          color: theme.colors.blue,
          bgColor: theme.colors.blueLight,
        };
      case 'completed':
        return {
          label: strings.STATUS_COMPLETED,
          icon: 'checkmark-done-circle-outline' as const,
          color: theme.colors.green,
          bgColor: theme.colors.greenLight,
        };
      case 'cancelled':
        return {
          label: strings.STATUS_CANCELLED,
          icon: 'close-circle-outline' as const,
          color: theme.colors.red,
          bgColor: theme.colors.redLight,
        };
      case 'disputed':
        return {
          label: strings.STATUS_DISPUTED,
          icon: 'warning-outline' as const,
          color: theme.colors.red,
          bgColor: theme.colors.redLight,
        };
      case 'rejected':
      default:
        return {
          label: strings.STATUS_REJECTED,
          icon: 'close-circle-outline' as const,
          color: theme.colors.red,
          bgColor: theme.colors.redLight,
        };
    }
  };

  const statusMeta = getStatusMeta(booking.status);

  const handleCardPress = () => {
    if (onPress) {
      onPress(booking);
    } else if (onViewDetails) {
      onViewDetails(booking);
    } else {
      navigation.navigate('BookingRequestDetail', { bookingId: booking._id });
    }
  };

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={handleCardPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      {/* Hàng 1 (Header thẻ): Mã đơn hàng bên trái & Badge trạng thái bên phải */}
      <View style={styles.headerRow}>
        <View style={styles.codeContainer}>
          <Ionicons name="receipt-outline" size={13} color={theme.colors.text.subtle} />
          <Text style={styles.bookingCodeText}>
            #{booking.bookingCode || booking._id?.slice(-8)}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusMeta.bgColor },
          ]}
        >
          <Ionicons
            name={statusMeta.icon}
            size={12}
            color={statusMeta.color}
          />
          <Text
            style={[
              styles.statusBadgeText,
              { color: statusMeta.color },
            ]}
          >
            {statusMeta.label}
          </Text>
        </View>
      </View>

      {/* Hàng 2 (Khối nội dung chính - 2 cột ngang: Thumbnail + Tóm tắt) */}
      <View style={styles.mainContentRow}>
        {/* Cột trái: Ảnh thumbnail máy vuông 72x72 bo góc 10px */}
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

        {/* Cột phải: Thông tin tóm tắt (Tên máy, Thời gian, Tiền thuê) */}
        <View style={styles.summaryContainer}>
          {/* Dòng 1: Tên thiết bị (in đậm, fontSize 15, numberOfLines 1) */}
          <Text style={styles.deviceNameText} numberOfLines={1}>
            {deviceName}
          </Text>

          {/* Dòng 2: Thời gian: Icon lịch nhỏ + "21/10 - 22/10 (1 ngày)" */}
          <View style={styles.dateRow}>
            <Ionicons
              name="calendar-outline"
              size={13}
              color={theme.colors.text.muted}
            />
            <Text style={styles.dateText}>{dateDisplay}</Text>
          </View>

          {/* Dòng 3: Tiền thuê: "Tiền thuê: 380.000 đ" (số tiền in đậm, màu primary) */}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{strings.RENTAL_PRICE_LABEL} </Text>
            <Text style={styles.priceValue}>{formattedRentalPrice}</Text>
          </View>
        </View>
      </View>

      {/* Hàng 3 (Footer tóm tắt & Khách thuê) */}
      <View style={styles.footerRow}>
        {/* Bên trái: Avatar nhỏ (24x24) + Tên khách + Icon Tích xanh nếu isVerified */}
        <View style={styles.renterContainer}>
          {renterAvatar ? (
            <Image source={{ uri: renterAvatar }} style={styles.renterAvatar} />
          ) : (
            <View style={styles.renterAvatarPlaceholder}>
              <Ionicons name="person" size={12} color={theme.colors.text.subtle} />
            </View>
          )}
          <Text style={styles.renterNameText} numberOfLines={1}>
            {renterName}
          </Text>
          {isVerified && (
            <Ionicons
              name="checkmark-circle"
              size={13}
              color={theme.colors.green}
              style={styles.verifiedCheckmark}
            />
          )}
        </View>

        {/* Bên phải: Nút thao tác nhanh theo trạng thái, Chat nhanh và Icon chevron-forward */}
        <View style={styles.footerActions}>
          {booking.status === 'pending' && (onApprove || onReject) && (
            <View style={styles.inlineActionGroup}>
              {onReject && (
                <TouchableOpacity
                  style={styles.rejectActionBtn}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onReject(booking);
                  }}
                  disabled={isProcessing}
                  activeOpacity={0.75}
                >
                  <Text style={styles.rejectActionText}>{strings.REJECT_BUTTON}</Text>
                </TouchableOpacity>
              )}
              {onApprove && (
                <TouchableOpacity
                  style={styles.approveActionBtn}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onApprove(booking);
                  }}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle" size={14} color={theme.colors.white} />
                  <Text style={styles.approveActionText}>{strings.APPROVE_BUTTON}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {booking.status === 'approved' && onHandover && (
            <TouchableOpacity
              style={styles.handoverActionBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                onHandover(booking);
              }}
              disabled={isProcessing}
              activeOpacity={0.8}
            >
              <Ionicons name="play-circle" size={14} color={theme.colors.white} />
              <Text style={styles.approveActionText}>{strings.HANDOVER_BUTTON}</Text>
            </TouchableOpacity>
          )}

          {booking.status === 'active' && (onTakeReturnPhotos || onComplete) && (
            <View style={styles.inlineActionGroup}>
              {onTakeReturnPhotos && (
                <TouchableOpacity
                  style={styles.chatIconButton}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onTakeReturnPhotos(booking);
                  }}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera-outline" size={15} color={theme.colors.brand[600]} />
                </TouchableOpacity>
              )}
              {onComplete && (
                <TouchableOpacity
                  style={styles.completeActionBtn}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onComplete(booking);
                  }}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-done-circle" size={14} color={theme.colors.white} />
                  <Text style={styles.approveActionText}>{strings.COMPLETE_BUTTON}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {booking.status === 'completed' && (
            booking.isRenterReviewed ? (
              <View style={styles.reviewedRenterPill}>
                <Ionicons name="checkmark-circle" size={13} color={theme.colors.green} />
                <Text style={styles.reviewedRenterPillText}>{strings.RENTER_REVIEWED_BADGE}</Text>
              </View>
            ) : onReviewRenter ? (
              <TouchableOpacity
                style={styles.reviewRenterBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onReviewRenter(booking);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="star" size={13} color={theme.colors.white} />
                <Text style={styles.reviewRenterBtnText}>{strings.REVIEW_RENTER_BUTTON}</Text>
              </TouchableOpacity>
            ) : null
          )}

          {onChat && (
            <TouchableOpacity
              style={styles.chatIconButton}
              onPress={(e) => {
                e.stopPropagation?.();
                onChat(booking);
              }}
              activeOpacity={0.7}
              accessibilityLabel={strings.CHAT_BUTTON}
              accessibilityRole="button"
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={15}
                color={theme.colors.brand[600]}
              />
            </TouchableOpacity>
          )}
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.colors.text.subtle}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

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
  statusBadgePending: {
    backgroundColor: theme.colors.amberLight,
  },
  statusBadgeApproved: {
    backgroundColor: theme.colors.greenLight,
  },
  statusBadgeRejected: {
    backgroundColor: theme.colors.redLight,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  statusTextPending: {
    color: theme.colors.amber,
  },
  statusTextApproved: {
    color: theme.colors.green,
  },
  statusTextRejected: {
    color: theme.colors.red,
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
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.divider,
  },
  renterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  renterAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceMuted,
  },
  renterAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  renterNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginLeft: 7,
    maxWidth: 180,
  },
  verifiedCheckmark: {
    marginLeft: 4,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rejectActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.colors.redLight,
    borderWidth: 1,
    borderColor: theme.colors.redBorder,
  },
  rejectActionText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.colors.red,
  },
  approveActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.colors.brand[600],
  },
  handoverActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.colors.blue,
  },
  completeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.colors.green,
  },
  approveActionText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.colors.white,
  },
  reviewRenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.colors.amber,
  },
  reviewRenterBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.colors.white,
  },
  reviewedRenterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: theme.colors.greenLight,
  },
  reviewedRenterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.green,
  },
  chatIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.brand[50],
    borderWidth: 1,
    borderColor: theme.colors.brand[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
});
