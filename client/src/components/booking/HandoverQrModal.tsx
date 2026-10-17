import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';
import { Booking } from '../../services/bookingService';

interface HandoverQrModalProps {
  visible: boolean;
  booking: Booking | null;
  onClose: () => void;
}

export function HandoverQrModal({ visible, booking, onClose }: HandoverQrModalProps) {
  if (!booking) return null;

  const device = booking.deviceId || {};
  const deviceName = device.name || device.title || 'Device';
  const qrCodeValue = JSON.stringify({
    type: 'TECHSHARE_HANDOVER',
    bookingId: booking._id,
    bookingCode: booking.bookingCode,
    qrToken: booking.qrToken || `TSQR-${booking.bookingCode}`,
  });

  const handleCopyCode = () => {
    Alert.alert(
      STRINGS.HANDOVER_QR.ALERT_TITLE,
      `#${booking.bookingCode}\n\n${STRINGS.HANDOVER_QR.ALERT_TOKEN_PREFIX}${booking.qrToken || 'None'}`
    );
  };

  const QRCodeComponent: any = QRCode;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e: any) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="qr-code" size={20} color={colors.light.primary} />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.modalTitle}>{STRINGS.HANDOVER_QR.TITLE}</Text>
              <Text style={styles.modalSubtitle}>{STRINGS.HANDOVER_QR.SUBTITLE}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Status Badge */}
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{STRINGS.HANDOVER_QR.STATUS_READY}</Text>
          </View>

          {/* QR Code Frame */}
          <View style={styles.qrContainer}>
            <View style={styles.qrInnerBox}>
              <QRCodeComponent
                value={qrCodeValue}
                size={210}
                color={colors.light.textPrimary}
                backgroundColor={colors.light.white}
              />
            </View>
          </View>

          {/* Booking Info Box */}
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{STRINGS.HANDOVER_QR.BOOKING_CODE_LABEL}</Text>
              <TouchableOpacity onPress={handleCopyCode} style={styles.copyRow}>
                <Text style={styles.bookingCodeText}>#{booking.bookingCode}</Text>
                <Ionicons name="copy-outline" size={14} color={colors.light.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{STRINGS.HANDOVER_QR.DEVICE_LABEL}</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {deviceName}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{STRINGS.HANDOVER_QR.DURATION_LABEL}</Text>
              <Text style={styles.infoValue}>
                {STRINGS.HANDOVER_QR.DURATION_DAYS(booking.totalDays)}
              </Text>
            </View>
          </View>

          {/* Safety Hint */}
          <View style={styles.hintBox}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.light.success} />
            <Text style={styles.hintText}>
              {STRINGS.HANDOVER_QR.HINT_TEXT}
            </Text>
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>{STRINGS.HANDOVER_QR.CLOSE}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.light.card,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.light.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.light.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.light.successLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.light.success,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.light.success,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.success,
  },
  qrContainer: {
    backgroundColor: colors.light.background,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  qrInnerBox: {
    padding: 10,
    backgroundColor: colors.light.white,
    borderRadius: 12,
  },
  infoBox: {
    width: '100%',
    backgroundColor: colors.light.background,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: colors.light.textSecondary,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookingCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.primary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textPrimary,
    maxWidth: '65%',
  },
  hintBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.light.successLight,
    padding: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    color: colors.light.success,
    lineHeight: 17,
  },
  doneBtn: {
    width: '100%',
    backgroundColor: colors.light.primary,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.white,
  },
});
