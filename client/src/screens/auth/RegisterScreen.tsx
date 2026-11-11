import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch } from '../../store';
import { setAuth } from '../../store/slices/authSlice';
import { setAuthToken } from '../../config/api';
import { socketService } from '../../services/socketService';
import { registerService } from '../../services/registerService';
import { theme } from '../../theme/tokens';

const registerBackground = require('../../../assets/images/login-background.png');

export interface RegisterScreenProps {
  navigation?: any;
  onNavigateToLogin?: () => void;
  onRegisterSuccess?: (role: string) => void;
}

export function RegisterScreen({
  navigation,
  onNavigateToLogin,
  onRegisterSuccess,
}: RegisterScreenProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const canGoBack = navigation?.canGoBack?.();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 16);
  const heroHeight = Math.max(224, Math.round(height * 0.36));
  const dispatch = useAppDispatch();

  // Step 1: Điền thông tin đăng ký | Step 2: Nhập mã OTP xác thực
  const [step, setStep] = useState<'form' | 'otp'>('form');

  // Form states
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP state
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Loading & Error states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Countdown timer cho OTP
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (step === 'otp' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, countdown]);

  // Xử lý gửi OTP bước 1
  const handleSendOtp = async () => {
    // ── Bước 1: Validate form phía client (không cần gọi API) ──
    const validation = registerService.validate({
      username,
      name,
      email,
      phone,
      password,
      confirmPassword,
    });

    if (!validation.isValid) {
      setErrorMessage(
        validation.usernameError ||
        validation.nameError ||
        validation.emailError ||
        validation.phoneError ||
        validation.passwordError ||
        validation.confirmPwError ||
        'Please review the required information.'
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // ── Step 2: Send OTP via registerService → POST /api/register/send-otp ──
      const data = await registerService.sendOtp({
        username: username.trim(),
        name    : name.trim(),
        email   : email.trim(),
        phone   : phone.trim(),
        password,
      });

      if (data.success) {
        setStep('otp');
        setCountdown(60);
        setCanResend(false);
        setOtp('');
      } else {
        setErrorMessage(data.message || 'Unable to send OTP. Please try again.');
      }
    } catch (err: any) {
      console.error('[RegisterScreen] Send OTP error:', err.response?.data || err.message);
      if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else if (err.message === 'Network Error' || !err.response) {
        setErrorMessage('Unable to connect to the server. Please check your internet connection.');
      } else {
        setErrorMessage('An error occurred during registration. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async () => {
    const trimmedOtp = otp.trim();
    if (trimmedOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // ── Verify OTP via registerService → POST /api/register/verify-otp ──
      const data = await registerService.verifyOtp({
        email: email.trim(),
        otp  : trimmedOtp,
      });

      if (data.success && data.token && data.user) {
        // Save token to axios headers
        setAuthToken(data.token);

        // Connect Socket.IO
        const userId = data.user._id || (data.user as any).id;
        if (userId) {
          socketService.connect(userId);
        }

        // Update Redux store
        dispatch(setAuth({ token: data.token, user: data.user }));

        // Role-based navigation
        if (onRegisterSuccess) {
          onRegisterSuccess(data.user.role || 'renter');
        } else if (navigation?.navigate) {
          navigation.navigate('Home');
        }
      } else {
        setErrorMessage(data.message || 'Invalid or expired OTP code.');
      }
    } catch (err: any) {
      console.error('[RegisterScreen] Verify OTP error:', err.response?.data || err.message);
      if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else {
        setErrorMessage('Error verifying OTP code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (!canResend || loading) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      // ── Resend OTP via registerService → POST /api/register/resend-otp ──
      const data = await registerService.resendOtp(email.trim());

      if (data.success) {
        setCountdown(60);
        setCanResend(false);
        setOtp('');
        Alert.alert('Success', 'A new OTP code has been sent to your email.');
      } else {
        setErrorMessage(data.message || 'Unable to resend OTP code.');
      }
    } catch (err: any) {
      if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else {
        setErrorMessage('Error resending OTP code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    if (onNavigateToLogin) {
      onNavigateToLogin();
    } else if (navigation?.navigate) {
      navigation.navigate('Login');
    } else if (navigation?.canGoBack?.()) {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.rootContainer}
    >
      <Image source={registerBackground} style={styles.screenBackground} resizeMode="stretch" accessible={false} />
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.screenWrapper}>
          {/* Nút quay lại/đóng */}
          {canGoBack && (
            <TouchableOpacity
              style={[styles.closeBtn, { top: topInset + 6 }]}
              onPress={() => {
                if (step === 'otp') {
                  setStep('form');
                  setErrorMessage(null);
                } else {
                  navigation.goBack();
                }
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={step === 'otp' ? 'Back to registration form' : 'Close'}
            >
              <Ionicons
                name={step === 'otp' ? 'arrow-back' : 'close'}
                size={20}
                color={theme.colors.text.primary}
              />
            </TouchableOpacity>
          )}

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, theme.spacing.md) },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.header, {
              minHeight: heroHeight,
              paddingTop: topInset + (canGoBack ? 48 : 14),
            }]}>
              <View style={styles.headerCopy}>
                <View style={styles.brandRow}>
                  <View style={styles.logoBadge}>
                    <Ionicons name="hardware-chip-outline" size={16} color={theme.colors.white} />
                  </View>
                  <Text style={styles.brandTitle}>TechShare</Text>
                </View>
                <Text accessibilityRole="header" style={styles.cardTitle}>
                  {step === 'form' ? 'Create Account' : 'Email Verification'}
                </Text>
                {step === 'form' && (
                  <Text style={styles.cardSubtitle}>Enter your details.</Text>
                )}
              </View>
            </View>

            <View style={styles.formContainer}>
              {step === 'form' ? (
                <>
                  {/* Error Alert */}
                  {errorMessage ? (
                    <View style={styles.alertError}>
                      <Ionicons name="alert-circle-outline" size={20} color={theme.colors.red} />
                      <Text style={styles.alertErrorText}>{errorMessage}</Text>
                    </View>
                  ) : null}

                  {/* Username */}
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Username</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="person-outline"
                        size={18}
                        color={theme.colors.text.subtle}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.inputField}
                        placeholder="e.g. username123"
                        placeholderTextColor={theme.colors.text.subtle}
                        value={username}
                        onChangeText={(text) => {
                          setUsername(text);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>

                  {/* Full Name */}
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="id-card-outline"
                        size={18}
                        color={theme.colors.text.subtle}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.inputField}
                        placeholder="e.g. John Doe"
                        placeholderTextColor={theme.colors.text.subtle}
                        value={name}
                        onChangeText={(text) => {
                          setName(text);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        autoCorrect={false}
                      />
                    </View>
                  </View>

                  {/* Email */}
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="mail-outline"
                        size={18}
                        color={theme.colors.text.subtle}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.inputField}
                        placeholder="name@example.com"
                        placeholderTextColor={theme.colors.text.subtle}
                        value={email}
                        onChangeText={(text) => {
                          setEmail(text);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>

                  {/* Phone */}
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="call-outline"
                        size={18}
                        color={theme.colors.text.subtle}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.inputField}
                        placeholder="0901234567"
                        placeholderTextColor={theme.colors.text.subtle}
                        value={phone}
                        onChangeText={(text) => {
                          setPhone(text);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>

                  {/* Password */}
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color={theme.colors.text.subtle}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.inputField}
                        placeholder="At least 6 characters"
                        placeholderTextColor={theme.colors.text.subtle}
                        value={password}
                        onChangeText={(text) => {
                          setPassword(text);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeButton}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color={theme.colors.text.muted}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Confirm Password */}
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Confirm Password</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={18}
                        color={theme.colors.text.subtle}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.inputField}
                        placeholder="Re-enter password"
                        placeholderTextColor={theme.colors.text.subtle}
                        value={confirmPassword}
                        onChangeText={(text) => {
                          setConfirmPassword(text);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={styles.eyeButton}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color={theme.colors.text.muted}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Send OTP Button */}
                  <TouchableOpacity
                    style={[styles.btnSubmit, loading && styles.btnSubmitDisabled]}
                    onPress={handleSendOtp}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color={theme.colors.white} size="small" />
                    ) : (
                      <View style={styles.btnSubmitContent}>
                        <Text style={styles.btnSubmitText}>CONTINUE & GET OTP</Text>
                        <Ionicons name="arrow-forward" size={18} color={theme.colors.white} style={styles.btnArrowIcon} />
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                /* Step 2: OTP Verification */
                <>
                  <View style={styles.otpHeader}>
                    <View style={styles.otpIconBadge}>
                      <Ionicons name="mail-unread-outline" size={32} color={theme.colors.brand[500]} />
                    </View>
                    <Text style={styles.otpInstruction}>
                      We sent a 6-digit verification code to:
                    </Text>
                    <Text style={styles.otpEmailHighlight}>{email.trim()}</Text>

                    <TouchableOpacity
                      onPress={() => {
                        setStep('form');
                        setErrorMessage(null);
                      }}
                      style={styles.changeEmailBtn}
                    >
                      <Ionicons name="pencil-outline" size={14} color={theme.colors.brand[600]} />
                      <Text style={styles.changeEmailText}>Change Information</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Error banner */}
                  {errorMessage ? (
                    <View style={styles.alertError}>
                      <Ionicons name="alert-circle-outline" size={20} color={theme.colors.red} />
                      <Text style={styles.alertErrorText}>{errorMessage}</Text>
                    </View>
                  ) : null}

                  {/* Input OTP */}
                  <View style={styles.otpInputWrapper}>
                    <TextInput
                      style={styles.otpInputField}
                      placeholder="• • • • • •"
                      placeholderTextColor={theme.colors.text.subtle}
                      value={otp}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
                        setOtp(cleaned);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                      textAlign="center"
                    />
                  </View>

                  {/* Resend OTP countdown */}
                  <View style={styles.resendRow}>
                    {canResend ? (
                      <TouchableOpacity onPress={handleResendOtp} disabled={loading} activeOpacity={0.7}>
                        <Text style={styles.resendActiveText}>Resend OTP</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.resendTimerText}>
                        Resend code in <Text style={styles.countdownNumber}>{countdown}s</Text>
                      </Text>
                    )}
                  </View>

                  {/* Confirm Registration Button */}
                  <TouchableOpacity
                    style={[
                      styles.btnSubmit,
                      (loading || otp.trim().length !== 6) && styles.btnSubmitDisabled,
                    ]}
                    onPress={handleVerifyOtp}
                    disabled={loading || otp.trim().length !== 6}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color={theme.colors.white} size="small" />
                    ) : (
                      <View style={styles.btnSubmitContent}>
                        <Text style={styles.btnSubmitText}>CONFIRM REGISTRATION</Text>
                        <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.white} style={styles.btnArrowIcon} />
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Footer navigate to Login */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity onPress={handleBackToLogin} activeOpacity={0.7}>
                <Text style={styles.loginLink}>Log in now</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: theme.colors.brand[50],
  },
  screenBackground: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  screenWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    left: theme.spacing.lg,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  header: {
    width: '100%',
    maxWidth: 420,
    justifyContent: 'center',
    paddingBottom: theme.spacing.sm,
  },
  headerCopy: {
    maxWidth: '72%',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm + theme.spacing.xs,
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  formContainer: {
    width: '100%',
    maxWidth: 420,
    paddingTop: theme.spacing.md,
  },
  cardTitle: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  cardSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
  },
  alertError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.redLight,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.red,
    borderRadius: theme.radii.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 8,
  },
  alertErrorText: {
    flex: 1,
    color: theme.colors.red,
    fontSize: 13,
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text.primary,
    height: '100%',
  },
  eyeButton: {
    padding: 6,
  },
  btnSubmit: {
    height: 48,
    backgroundColor: theme.colors.brand[500],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...theme.shadows.card,
  },
  btnSubmitDisabled: {
    opacity: 0.65,
  },
  btnSubmitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSubmitText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  btnArrowIcon: {
    marginLeft: 6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.text.muted,
  },
  loginLink: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.brand[600],
  },
  otpHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  otpIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  otpInstruction: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 6,
  },
  otpEmailHighlight: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.brand[700],
    marginTop: 4,
  },
  changeEmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  changeEmailText: {
    fontSize: 12,
    color: theme.colors.brand[600],
    fontWeight: '600',
  },
  otpInputWrapper: {
    marginVertical: 14,
    alignItems: 'center',
  },
  otpInputField: {
    width: '100%',
    height: 56,
    borderWidth: 2,
    borderColor: theme.colors.brand[400],
    borderRadius: 14,
    backgroundColor: theme.colors.brand[50],
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 10,
    color: theme.colors.brand[800],
    paddingHorizontal: 16,
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  resendTimerText: {
    fontSize: 13,
    color: theme.colors.text.muted,
  },
  countdownNumber: {
    fontWeight: '700',
    color: theme.colors.brand[600],
  },
  resendActiveText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.brand[600],
    textDecorationLine: 'underline',
  },
});
