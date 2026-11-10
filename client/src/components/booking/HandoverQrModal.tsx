import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { bookingService, Booking } from '../../services/bookingService';

interface HandoverQrModalProps {
  visible: boolean;
  booking: Booking | null;
  onClose: () => void;
}

export function HandoverQrModal({ visible, booking, onClose }: HandoverQrModalProps) {
  const { width, height } = useWindowDimensions();
  const [token, setToken] = useState<{ payload: string; expiresAt: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [generation, setGeneration] = useState(0);

  // Fetch handover token when modal opens or on refresh
  useEffect(() => {
    let cancelled = false;
    if (visible && booking?.status === 'approved') {
      setLoading(true);
      setError('');
      bookingService
        .getHandoverToken(booking._id)
        .then((value) => {
          if (!cancelled) {
            setToken(value);
            setNow(Date.now());
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError('Unable to generate QR. Please refresh and retry.');
            setLoading(false);
          }
        });
    } else {
      setToken(null);
      setError('');
      setLoading(false);
    }

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [visible, booking?._id, booking?.status, generation]);

  // Real-time status sync via Socket.IO
  useEffect(() => {
    return bookingService.onBookingsUpdated(() => {
      if (!visible || !booking) return;
      bookingService
        .getBookingById(booking._id)
        .then((updated) => {
          if (updated.status !== 'approved') {
            setToken(null);
            onClose();
          }
        })
        .catch(() => setToken(null));
    });
  }, [visible, booking?._id, onClose]);

  if (!booking || booking.status !== 'approved') return null;

  const device = booking.deviceId || {};
  const deviceName = device.name || device.title || 'Tech Device';
  const bookingCode = booking.bookingCode || booking._id.slice(-8).toUpperCase();
  const totalDays = booking.totalDays || 1;

  // Calculate remaining seconds
  const seconds = token
    ? Math.max(0, Math.ceil((Date.parse(token.expiresAt) - now) / 1000))
    : 0;
  const isExpired = !!token && seconds === 0;
  const isExpiringSoon = seconds > 0 && seconds <= 60;

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  };

  const handleCopyCode = () => {
    Alert.alert('Booking Code', `#${bookingCode}`);
  };

  const handleRefresh = () => {
    setGeneration((prev) => prev + 1);
  };

  // Responsive QR code dimension (bounds: 190px - 230px)
  const qrSize = Math.max(190, Math.min(Math.round(width * 0.54), 230));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouchArea} onPress={onClose} />

        <View
          style={[
            styles.modalCard,
            { maxHeight: Math.min(Math.round(height * 0.88), 700) },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerIconWrapper}>
              <Ionicons name="qr-code" size={20} color={colors.light.primary} />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.modalTitle}>Handover QR Code</Text>
              <Text style={styles.modalSubtitle}>Show this code to the device owner</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Close Handover QR Modal"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Verification Status Badge */}
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusBadgeText}>Ready for Handover</Text>
            </View>

            {/* QR Code Presentation Card */}
            <View style={styles.qrCard}>
              <View style={[styles.qrQuietZone, { width: qrSize + 28, height: qrSize + 28 }]}>
                {loading ? (
                  <View style={styles.qrStateBox}>
                    <ActivityIndicator size="large" color={colors.light.primary} />
                    <Text style={styles.qrStateText}>Generating secure QR...</Text>
                  </View>
                ) : error ? (
                  <View style={styles.qrStateBox}>
                    <Ionicons name="alert-circle-outline" size={36} color={colors.light.error} />
                    <Text style={styles.qrErrorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
                      <Ionicons name="refresh-outline" size={14} color={colors.light.primary} />
                      <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : isExpired ? (
                  <View style={styles.qrStateBox}>
                    <Ionicons name="time-outline" size={38} color={colors.light.warning} />
                    <Text style={styles.qrExpiredText}>QR Code Expired</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
                      <Ionicons name="refresh-outline" size={14} color={colors.light.primary} />
                      <Text style={styles.retryBtnText}>Refresh QR Code</Text>
                    </TouchableOpacity>
                  </View>
                ) : token && seconds > 0 ? (
                  <QRCode
                    value={token.payload}
                    size={qrSize}
                    color={colors.light.textPrimary}
                    backgroundColor={colors.light.white}
                  />
                ) : null}
              </View>

              {/* Countdown / Expiry Line */}
              {token && seconds > 0 && (
                <View style={styles.timerRow}>
                  <View
                    style={[
                      styles.timerBadge,
                      isExpiringSoon && styles.timerBadgeWarning,
                    ]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={isExpiringSoon ? colors.light.warning : colors.light.textSecondary}
                    />
                    <Text
                      style={[
                        styles.timerText,
                        isExpiringSoon && styles.timerTextWarning,
                      ]}
                    >
                      Expires in {formatCountdown(seconds)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.refreshIconBtn}
                    onPress={handleRefresh}
                    accessibilityLabel="Refresh QR Code"
                    accessibilityRole="button"
                  >
                    <Ionicons name="refresh" size={14} color={colors.light.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Booking Information Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Booking Code</Text>
                <TouchableOpacity
                  onPress={handleCopyCode}
                  style={styles.codePill}
                  activeOpacity={0.7}
                  accessibilityLabel={`Copy booking code ${bookingCode}`}
                  accessibilityRole="button"
                >
                  <Text style={styles.bookingCodeText}>#{bookingCode}</Text>
                  <Ionicons name="copy-outline" size={13} color={colors.light.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Device</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {deviceName}
                </Text>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Rental Duration</Text>
                <Text style={styles.infoValue}>
                  {totalDays} {totalDays === 1 ? 'day' : 'days'}
                </Text>
              </View>
            </View>

            {/* Guidance Instruction Banner */}
            <View style={styles.instructionBanner}>
              <Ionicons name="shield-checkmark" size={18} color={colors.light.primary} />
              <Text style={styles.instructionText}>
                Ask the owner to scan this QR code to confirm the handover.
              </Text>
            </View>
          </ScrollView>

          {/* Bottom Action Button */}
          <View style={styles.footerWrap}>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={onClose}
              activeOpacity={0.85}
              accessibilityLabel="Done"
              accessibilityRole="button"
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  backdropTouchArea: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.light.card,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  headerIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextCol: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.light.textPrimary,
    letterSpacing: -0.2,
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
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.primaryBg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.light.primaryLight,
    marginBottom: 16,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.light.primary,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.primaryDark,
    letterSpacing: 0.2,
  },
  qrCard: {
    backgroundColor: colors.light.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  qrQuietZone: {
    backgroundColor: colors.light.white,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
  },
  qrStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  qrStateText: {
    fontSize: 13,
    color: colors.light.textSecondary,
    marginTop: 6,
  },
  qrErrorText: {
    fontSize: 12,
    color: colors.light.error,
    textAlign: 'center',
    marginTop: 4,
  },
  qrExpiredText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.warning,
    marginTop: 4,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.light.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    marginTop: 6,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.primary,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.light.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  timerBadgeWarning: {
    backgroundColor: colors.light.warningLight,
    borderColor: colors.light.warning,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  timerTextWarning: {
    color: colors.light.warning,
  },
  refreshIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    width: '100%',
    backgroundColor: colors.light.background,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.light.borderSubtle,
    marginVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.light.textSecondary,
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.light.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  bookingCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.primaryDark,
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textPrimary,
    maxWidth: '65%',
  },
  instructionBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.light.primaryBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.primaryLight,
    marginBottom: 8,
  },
  instructionText: {
    flex: 1,
    fontSize: 12,
    color: colors.light.primaryDark,
    lineHeight: 17,
  },
  footerWrap: {
    width: '100%',
    paddingTop: 10,
  },
  doneBtn: {
    width: '100%',
    backgroundColor: colors.light.primary,
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.white,
    letterSpacing: 0.2,
  },
});
