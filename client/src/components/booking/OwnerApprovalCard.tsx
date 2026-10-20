import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { OWNER_STRINGS } from '../../constants/ownerStrings';
import { Booking } from '../../services/bookingService';

interface OwnerApprovalCardProps {
  booking: Booking;
  onApprove: (booking: Booking) => void;
  onReject: (booking: Booking) => void;
  onChat?: (booking: Booking) => void;
  onViewDetails?: (booking: Booking) => void;
  isProcessing?: boolean;
}

export const OwnerApprovalCard: React.FC<OwnerApprovalCardProps> = ({
  booking,
  onApprove,
  onReject,
  onChat,
  onViewDetails,
  isProcessing = false,
}) => {
  const strings = OWNER_STRINGS.PENDING_REQUESTS;
  const renter = booking.renterId || {};
  const device = booking.deviceId || {};

  const renterName = renter.name || renter.username || 'Khách hàng';
  const renterAvatar = renter.avatar;
  const isVerified = Boolean(renter.trust?.isVerified || renter.isVerified);
  const trustScore = renter.trust?.score ?? renter.trustScore ?? 100;
  const rating = renter.rating ? Number(renter.rating).toFixed(1) : '5.0';
  const reviewsCount = renter.totalReviews ?? 0;

  const deviceName = device.name || 'Thiết bị';
  const deviceBrand = device.brand || '';
  const deviceImage =
    (Array.isArray(device.images) && device.images.length > 0 ? device.images[0] : null) ||
    device.image ||
    '';

  const pricePerDay =
    booking.pricePerDayAtBooking ||
    (booking as any).pricing?.pricePerDayAtBooking ||
    device.pricePerDay ||
    0;

  const rentalFee =
    booking.rentalFee ||
    (booking as any).pricing?.rentalFee ||
    0;

  const depositFee =
    booking.depositFee ||
    (booking as any).pricing?.depositFee ||
    device.depositAmount ||
    0;

  const totalAmount =
    booking.totalAmount ||
    (booking as any).pricing?.totalAmount ||
    rentalFee + depositFee;

  const formatVND = (num: number) => {
    return (num || 0).toLocaleString('vi-VN') + ' đ';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const startFormatted = formatDate(booking.startDate);
  const endFormatted = formatDate(booking.endDate);
  const totalDays = booking.totalDays || 1;

  const deliveryMethod =
    booking.deliveryMethod ||
    (booking as any).delivery?.method ||
    'pickup';

  const deliveryAddress =
    booking.deliveryAddress ||
    (booking as any).delivery?.address ||
    '';

  const isPending = booking.status === 'pending';
  const isApproved = booking.status === 'approved';
  const isRejected = booking.status === 'rejected';

  return (
    <View style={styles.cardContainer}>
      {/* 1. Header: Booking Code & Status Pill */}
      <View style={styles.cardHeader}>
        <View style={styles.codeRow}>
          <View style={styles.codeIconBox}>
            <Ionicons name="receipt-outline" size={15} color={theme.colors.brand[500]} />
          </View>
          <Text style={styles.bookingCodeText}>#{booking.bookingCode || booking._id?.slice(-8)}</Text>
        </View>

        <View
          style={[
            styles.statusPill,
            isPending && styles.statusPending,
            isApproved && styles.statusApproved,
            isRejected && styles.statusRejected,
          ]}
        >
          <Ionicons
            name={isPending ? 'time-outline' : isApproved ? 'checkmark-circle-outline' : 'close-circle-outline'}
            size={13}
            color={isPending ? '#D97706' : isApproved ? '#059669' : '#DC2626'}
          />
          <Text
            style={[
              styles.statusText,
              isPending && styles.textPending,
              isApproved && styles.textApproved,
              isRejected && styles.textRejected,
            ]}
          >
            {isPending ? 'Chờ duyệt' : isApproved ? 'Đã duyệt' : 'Đã từ chối'}
          </Text>
        </View>
      </View>

      {/* 2. Customer Profile Section */}
      <View style={styles.renterSection}>
        <View style={styles.renterAvatarWrap}>
          {renterAvatar ? (
            <Image source={{ uri: renterAvatar }} style={styles.renterAvatar} />
          ) : (
            <View style={[styles.renterAvatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={20} color={theme.colors.brand[500]} />
            </View>
          )}
          {isVerified && (
            <View style={styles.verifiedDot}>
              <Ionicons name="shield-checkmark" size={10} color="#FFFFFF" />
            </View>
          )}
        </View>

        <View style={styles.renterDetails}>
          <View style={styles.renterNameRow}>
            <Text style={styles.renterName} numberOfLines={1}>
              {renterName}
            </Text>
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#059669" />
                <Text style={styles.verifiedBadgeText}>eKYC</Text>
              </View>
            )}
          </View>

          <View style={styles.reputationRow}>
            <View style={styles.reputationItem}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.reputationText}>
                {rating} ({reviewsCount})
              </Text>
            </View>

            <View style={styles.reputationDivider} />

            <View style={styles.reputationItem}>
              <Ionicons name="shield-outline" size={12} color="#059669" />
              <Text style={[styles.reputationText, { color: '#059669', fontWeight: '700' }]}>
                Trust: {trustScore}
              </Text>
            </View>
          </View>
        </View>

        {/* Chat Button with Renter */}
        {onChat && (
          <TouchableOpacity
            style={styles.chatIconButton}
            onPress={() => onChat(booking)}
            activeOpacity={0.7}
            accessibilityLabel={strings.CHAT_BUTTON}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.brand[600]} />
          </TouchableOpacity>
        )}
      </View>

      {/* 3. Device Info Section */}
      <View style={styles.deviceCard}>
        {deviceImage ? (
          <Image source={{ uri: deviceImage }} style={styles.deviceImage} />
        ) : (
          <View style={[styles.deviceImage, styles.deviceImagePlaceholder]}>
            <Ionicons name="hardware-chip-outline" size={22} color={theme.colors.text.muted} />
          </View>
        )}

        <View style={styles.deviceDetails}>
          {deviceBrand ? <Text style={styles.deviceBrand}>{deviceBrand.toUpperCase()}</Text> : null}
          <Text style={styles.deviceName} numberOfLines={2}>
            {deviceName}
          </Text>
          <Text style={styles.deviceRateText}>
            {formatVND(pricePerDay)} <Text style={styles.perDaySub}>{strings.DAILY_RATE}</Text>
          </Text>
        </View>
      </View>

      {/* 4. Rental Logistics: Dates & Delivery */}
      <View style={styles.logisticsContainer}>
        {/* Schedule */}
        <View style={styles.logisticRow}>
          <Ionicons name="calendar-outline" size={16} color="#64748B" />
          <Text style={styles.logisticLabel}>{strings.RENTAL_PERIOD}:</Text>
          <Text style={styles.logisticValue}>
            {startFormatted} ➔ {endFormatted} ({totalDays} {strings.DAYS_UNIT})
          </Text>
        </View>

        {/* Delivery Method */}
        <View style={styles.logisticRow}>
          <Ionicons
            name={deliveryMethod === 'delivery' ? 'bicycle-outline' : 'storefront-outline'}
            size={16}
            color="#64748B"
          />
          <Text style={styles.logisticLabel}>Giao nhận:</Text>
          <Text style={styles.logisticValue} numberOfLines={1}>
            {deliveryMethod === 'delivery' ? strings.DELIVERY : strings.PICKUP}
            {deliveryAddress ? ` (${deliveryAddress})` : ''}
          </Text>
        </View>
      </View>

      {/* 5. Financial Summary Row */}
      <View style={styles.financialRow}>
        <View style={styles.financialCol}>
          <Text style={styles.financialSmallLabel}>{strings.RENTAL_FEE}</Text>
          <Text style={styles.financialSmallValue}>{formatVND(rentalFee)}</Text>
        </View>

        <View style={styles.financialVerticalSep} />

        <View style={styles.financialCol}>
          <Text style={styles.financialSmallLabel}>{strings.DEPOSIT}</Text>
          <Text style={styles.financialSmallValue}>{formatVND(depositFee)}</Text>
        </View>

        <View style={styles.financialVerticalSep} />

        <View style={[styles.financialCol, { alignItems: 'flex-end' }]}>
          <Text style={styles.financialTotalLabel}>{strings.TOTAL_PRICE}</Text>
          <Text style={styles.financialTotalValue}>{formatVND(totalAmount)}</Text>
        </View>
      </View>

      {/* 6. Action Buttons for Owner */}
      {isPending && (
        <View style={styles.actionRow}>
          {/* Decline Button */}
          <TouchableOpacity
            style={styles.declineButton}
            onPress={() => onReject(booking)}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={17} color="#DC2626" />
            <Text style={styles.declineButtonText}>{strings.REJECT_BUTTON}</Text>
          </TouchableOpacity>

          {/* Approve Button */}
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => onApprove(booking)}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.approveButtonText}>{strings.APPROVE_BUTTON}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Status note if rejected */}
      {isRejected && booking.rejectReason ? (
        <View style={styles.rejectedReasonBox}>
          <Ionicons name="information-circle-outline" size={15} color="#DC2626" />
          <Text style={styles.rejectedReasonText}>
            Lý do từ chối: {booking.rejectReason}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...theme.shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#E6F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bookingCodeText: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    letterSpacing: 0.5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusApproved: {
    backgroundColor: '#DCFCE7',
  },
  statusRejected: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.bold,
  },
  textPending: {
    color: '#D97706',
  },
  textApproved: {
    color: '#059669',
  },
  textRejected: {
    color: '#DC2626',
  },
  renterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  renterAvatarWrap: {
    position: 'relative',
  },
  renterAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F7F7',
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  renterDetails: {
    flex: 1,
    marginLeft: 12,
  },
  renterNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  renterName: {
    fontSize: 15,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
    gap: 3,
  },
  verifiedBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
  reputationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  reputationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  reputationText: {
    fontSize: 12,
    color: theme.colors.text.muted,
    fontWeight: '500',
  },
  reputationDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  chatIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    marginTop: 10,
  },
  deviceImage: {
    width: 58,
    height: 58,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  deviceImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceDetails: {
    flex: 1,
    marginLeft: 12,
  },
  deviceBrand: {
    fontSize: 10.5,
    fontWeight: '700',
    color: theme.colors.brand[600],
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  deviceName: {
    fontSize: 13.5,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    lineHeight: 18,
  },
  deviceRateText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.brand[700],
    marginTop: 3,
  },
  perDaySub: {
    fontSize: 11,
    color: theme.colors.text.muted,
    fontWeight: 'normal',
  },
  logisticsContainer: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 4,
    gap: 6,
  },
  logisticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logisticLabel: {
    fontSize: 12.5,
    color: theme.colors.text.muted,
    fontWeight: '500',
  },
  logisticValue: {
    fontSize: 12.5,
    color: theme.colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  financialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  financialCol: {
    flex: 1,
  },
  financialSmallLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  financialSmallValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginTop: 2,
  },
  financialVerticalSep: {
    width: 1,
    height: 24,
    backgroundColor: '#CCFBF1',
    marginHorizontal: 8,
  },
  financialTotalLabel: {
    fontSize: 11,
    color: theme.colors.brand[700],
    fontWeight: '700',
  },
  financialTotalValue: {
    fontSize: 15,
    fontWeight: theme.typography.fontWeight.bold,
    color: '#0D9488',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 6,
  },
  declineButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  approveButton: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#0D9488',
    gap: 6,
    ...theme.shadows.card,
  },
  approveButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rejectedReasonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    gap: 6,
  },
  rejectedReasonText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
  },
});

export default OwnerApprovalCard;
