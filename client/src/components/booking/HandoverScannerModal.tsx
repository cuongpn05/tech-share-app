import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Animated,
  Easing,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { colors } from '../../theme/colors';
import { Booking, bookingService } from '../../services/bookingService';

interface HandoverScannerModalProps {
  bookingId: string;
  onClose: () => void;
  onSuccess: (booking: Booking) => void;
}

type ScanStatus =
  | 'idle'
  | 'scanning'
  | 'detected'
  | 'verifying'
  | 'success'
  | 'error';

interface ScanError {
  type: string;
  message: string;
}

export function HandoverScannerModal({
  bookingId,
  onClose,
  onSuccess,
}: HandoverScannerModalProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [permission, requestPermission, getPermission] = useCameraPermissions();

  const [scanStatus, setScanStatus] = useState<ScanStatus>('scanning');
  const [error, setError] = useState<ScanError | null>(null);
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  const locked = useRef(false);
  const mounted = useRef(true);
  const scanAnim = useRef(new Animated.Value(0)).current;

  // Responsive scan frame dimension (240px to 280px)
  const frameSize = Math.max(230, Math.min(Math.round(width * 0.68), 280));

  // Handle AppState (pause camera when app goes to background)
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      const isActive = state === 'active';
      setForeground(isActive);
      if (isActive) {
        void getPermission();
      }
    });

    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [getPermission]);

  // Start / stop animated scan line
  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;

    if (scanStatus === 'scanning' && foreground && !error && !busy) {
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: frameSize - 6,
            duration: 2200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      animLoop.start();
    } else {
      scanAnim.setValue(0);
    }

    return () => {
      if (animLoop) {
        animLoop.stop();
      }
    };
  }, [scanStatus, foreground, error, busy, frameSize, scanAnim]);

  // Core scan handler
  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (locked.current || busy) return;
      locked.current = true;
      setScanStatus('detected');

      try {
        let payload: any;
        try {
          payload = JSON.parse(data);
        } catch {
          throw {
            type: 'INVALID_FORMAT',
            message: 'This is not a valid TechShare QR code.',
          };
        }

        if (
          !payload ||
          payload.type !== 'TECHSHARE_HANDOVER' ||
          typeof payload.qrToken !== 'string' ||
          !/^[a-f\d]{64}$/.test(payload.qrToken)
        ) {
          throw {
            type: 'INVALID_HANDOVER',
            message: 'This is not a valid handover verification QR code.',
          };
        }

        if (payload.bookingId !== bookingId) {
          throw {
            type: 'MISMATCH_BOOKING',
            message:
              'This QR belongs to another booking. Please scan the QR code for this specific order.',
          };
        }

        setBusy(true);
        setScanStatus('verifying');

        // Server verification via existing backend endpoint
        const updatedBooking = await bookingService.verifyHandoverQr({
          bookingId,
          qrToken: payload.qrToken,
        });

        if (!mounted.current) return;
        setScanStatus('success');

        Alert.alert(
          'Handover Confirmed 🎉',
          'The device handover has been verified successfully. The rental is now active.',
          [
            {
              text: 'OK',
              onPress: () => {
                onSuccess(updatedBooking);
              },
            },
          ]
        );
      } catch (err: any) {
        if (!mounted.current) return;

        let errType = 'UNKNOWN';
        let message = 'Unable to verify handover. Please retry.';

        if (err?.type) {
          errType = err.type;
          message = err.message;
        } else if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          const serverMsg = err.response?.data?.message;

          if (
            status === 409 ||
            (serverMsg && serverMsg.toLowerCase().includes('expired'))
          ) {
            errType = 'EXPIRED_QR';
            message =
              'The QR code has expired. Please ask the renter to refresh their QR code.';
          } else if (status === 403) {
            errType = 'UNAUTHORIZED';
            message = 'Only the booking owner is authorized to verify handover.';
          } else if (status === 429) {
            errType = 'RATE_LIMITED';
            message = 'Too many attempts. Please wait a minute before retrying.';
          } else if (serverMsg) {
            message = serverMsg;
          } else {
            message =
              'Network error. Please check your connection and retry.';
          }
        } else if (err instanceof Error) {
          message = err.message;
        }

        setError({ type: errType, message });
        setScanStatus('error');
      } finally {
        if (mounted.current) {
          setBusy(false);
        }
      }
    },
    [bookingId, busy, onSuccess]
  );

  // Retry action
  const handleRetry = () => {
    setError(null);
    setScanStatus('scanning');
    locked.current = false;
  };

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const isScanningActive =
    foreground &&
    permission?.granted &&
    !error &&
    !busy &&
    scanStatus !== 'success';

  return (
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.light.textPrimary} />

      <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerCloseBtn}
            onPress={handleClose}
            disabled={busy}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Close scanner"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={22} color={colors.light.white} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Scan Handover QR</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Scan the renter's QR code to confirm device handover
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {/* Body content based on permission & camera state */}
        {!permission?.granted ? (
          <View style={styles.permissionContainer}>
            <View style={styles.permissionIconWrap}>
              <Ionicons name="camera-outline" size={48} color={colors.light.primary} />
            </View>
            <Text style={styles.permissionTitle}>Camera Access Required</Text>
            <Text style={styles.permissionDesc}>
              TechShare needs permission to use your camera in order to scan and verify the
              renter's handover QR code.
            </Text>

            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={() => {
                if (permission?.canAskAgain === false) {
                  void Linking.openSettings();
                } else {
                  void requestPermission();
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionButtonText}>
                {permission?.canAskAgain === false
                  ? 'Open Settings'
                  : 'Grant Camera Access'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelLinkButton}
              onPress={handleClose}
            >
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.scannerWrapper}>
            {/* Camera View Area */}
            <View style={styles.cameraBox}>
              {foreground && (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  enableTorch={torch}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={isScanningActive ? handleBarcodeScanned : undefined}
                  onCameraReady={() => setCameraReady(true)}
                  onMountError={() =>
                    setError({
                      type: 'CAMERA_UNAVAILABLE',
                      message:
                        'Camera unavailable. Please close other camera apps and retry.',
                    })
                  }
                />
              )}

              {/* Viewfinder Overlay with Darkened Surrounding and Cutout */}
              <View style={styles.overlayContainer} pointerEvents="none">
                {/* Top overlay */}
                <View style={styles.overlayShade} />

                {/* Middle row containing Left shade, Cutout, Right shade */}
                <View style={[styles.middleRow, { height: frameSize }]}>
                  <View style={styles.overlayShade} />

                  <View style={[styles.cutoutFrame, { width: frameSize, height: frameSize }]}>
                    {/* 4 Teal Corner Indicators */}
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />

                    {/* Animated Scan Line */}
                    {isScanningActive && (
                      <Animated.View
                        style={[
                          styles.scanLaser,
                          {
                            width: frameSize - 16,
                            transform: [{ translateY: scanAnim }],
                          },
                        ]}
                      />
                    )}

                    {/* Verification in Progress State inside Frame */}
                    {busy && (
                      <View style={styles.verifyingOverlay}>
                        <ActivityIndicator size="large" color={colors.light.primary} />
                        <Text style={styles.verifyingText}>Verifying Handover...</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.overlayShade} />
                </View>

                {/* Bottom overlay */}
                <View style={styles.overlayShade} />
              </View>
            </View>

            {/* Scanning Guidance & Status Panel */}
            <View style={styles.controlsSection}>
              {/* Guidance / Status Card */}
              {error ? (
                <View style={styles.errorAlertCard}>
                  <Ionicons name="alert-circle" size={20} color={colors.light.error} />
                  <Text style={styles.errorAlertText}>{error.message}</Text>
                </View>
              ) : (
                <View style={styles.guidanceWrap}>
                  <Text style={styles.guidanceTitle}>
                    Position the QR code inside the frame
                  </Text>
                  <View style={styles.statusIndicatorRow}>
                    <View
                      style={[
                        styles.statusDot,
                        busy && styles.statusDotBusy,
                        scanStatus === 'success' && styles.statusDotSuccess,
                      ]}
                    />
                    <Text style={styles.statusIndicatorText}>
                      {busy
                        ? 'Verifying with server...'
                        : scanStatus === 'detected'
                        ? 'QR detected, processing...'
                        : scanStatus === 'success'
                        ? 'Handover verified successfully!'
                        : 'Looking for QR code...'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Retry button if in error state */}
              {error && (
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRetry}
                  activeOpacity={0.85}
                  accessibilityLabel="Retry scanning"
                  accessibilityRole="button"
                >
                  <Ionicons name="refresh-outline" size={16} color={colors.light.white} />
                  <Text style={styles.retryButtonText}>Retry Scan</Text>
                </TouchableOpacity>
              )}

              {/* Flashlight Control Toggle */}
              <TouchableOpacity
                style={[
                  styles.torchButton,
                  torch && styles.torchButtonActive,
                  busy && styles.buttonDisabled,
                ]}
                onPress={() => setTorch((prev) => !prev)}
                disabled={busy}
                activeOpacity={0.8}
                accessibilityLabel={torch ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
                accessibilityRole="button"
              >
                <Ionicons
                  name={torch ? 'flash' : 'flash-outline'}
                  size={18}
                  color={torch ? colors.light.warning : colors.light.white}
                />
                <Text
                  style={[
                    styles.torchButtonText,
                    torch && styles.torchButtonTextActive,
                  ]}
                >
                  {torch ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom Action: Cancel / Close */}
        <View
          style={[
            styles.bottomActionWrap,
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <TouchableOpacity
            style={styles.cancelScanBtn}
            onPress={handleClose}
            disabled={busy}
            activeOpacity={0.8}
            accessibilityLabel="Cancel Scanning"
            accessibilityRole="button"
          >
            <Text style={styles.cancelScanBtnText}>Cancel Scanning</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.textPrimary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.white,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  headerSpacer: {
    width: 36,
  },
  scannerWrapper: {
    flex: 1,
    flexDirection: 'column',
  },
  cameraBox: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill,
  },
  overlayShade: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  middleRow: {
    flexDirection: 'row',
    width: '100%',
  },
  cutoutFrame: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: colors.light.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  scanLaser: {
    position: 'absolute',
    left: 8,
    height: 2,
    backgroundColor: colors.light.primary,
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  verifyingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 12,
  },
  verifyingText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.white,
  },
  controlsSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  guidanceWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
  guidanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.white,
    textAlign: 'center',
    marginBottom: 6,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.light.primary,
  },
  statusDotBusy: {
    backgroundColor: colors.light.warning,
  },
  statusDotSuccess: {
    backgroundColor: colors.light.success,
  },
  statusIndicatorText: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  errorAlertCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 12,
    color: colors.light.dangerLight,
    lineHeight: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.light.primary,
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 12,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.white,
  },
  torchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
  },
  torchButtonActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: colors.light.warning,
  },
  torchButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.white,
  },
  torchButtonTextActive: {
    color: colors.light.warning,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  bottomActionWrap: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  cancelScanBtn: {
    width: '100%',
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelScanBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.borderDefault,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permissionIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(103, 190, 195, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(103, 190, 195, 0.3)',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.light.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 14,
    color: colors.light.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  primaryActionButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  primaryActionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.white,
  },
  cancelLinkButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelLinkText: {
    fontSize: 14,
    color: colors.light.textMuted,
  },
});
