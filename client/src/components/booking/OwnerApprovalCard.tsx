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
  onViewDetails?: (booking: Booking) => void;
  isProcessing?: boolean;
}

export const OwnerApprovalCard: React.FC<OwnerApprovalCardProps> = ({
  booking,
  onPress,
  onChat,
  onViewDetails,
}) => {
  const navigation = useNavigation<any>();
  const strings = OWNER_STRINGS.PENDING_REQUESTS;
  const renter = booking.renterId || {};
  const device = booking.deviceId || {};

  const renterName = renter.name || renter.username || strings.DEFAULT_RENTER_NAME;
  const renterAvatar = renter.avatar;
  const isVerified = Boolean(renter.trust?.isVerified || renter.isVerified);

  const deviceName = device.name || strings.DEFAULT_DEVICE_NAME;
  const deviceImage =
    (Array.isArray(device.images) && device.images.length > 0 ? device.images[0] : null) ||
    device.image ||
    '';

  const totalDays = booking.totalDays || 1;
  const rentalFee =
    booking.rentalFee ||
    (booking as any).pricing?.rentalFee ||
    ((booking.pricePerDayAtBooking || device.pricePerDay || 0) * totalDays);

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

  const formattedRentalPrice = `${(rentalFee || 0).toLocaleString('vi-VN')} ${strings.CURRENCY_SUFFIX}`;

  const isPending = booking.status === 'pending';
  const isApproved = booking.status === 'approved';
  const isRejected = booking.status === 'rejected';

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
            isPending && styles.statusBadgePending,
            isApproved && styles.statusBadgeApproved,
            isRejected && styles.statusBadgeRejected,
          ]}
        >
          <Ionicons
            name={
              isPending
                ? 'time-outline'
                : isApproved
                ? 'checkmark-circle-outline'
                : 'close-circle-outline'
            }
            size={12}
            color={
              isPending
                ? theme.colors.amber
                : isApproved
                ? theme.colors.green
                : theme.colors.red
            }
          />
          <Text
            style={[
              styles.statusBadgeText,
              isPending && styles.statusTextPending,
              isApproved && styles.statusTextApproved,
              isRejected && styles.statusTextRejected,
            ]}
          >
            {isPending
              ? strings.STATUS_PENDING
              : isApproved
              ? strings.STATUS_APPROVED
              : strings.STATUS_REJECTED}
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

        {/* Bên phải: Nút icon Chat nhanh (32x32) và Icon chevron-forward */}
        <View style={styles.footerActions}>
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
