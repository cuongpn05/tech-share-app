/**
 * ============================================================
 *  FORGOT PASSWORD SCREEN  –  client/src/screens/auth/ForgotPasswordScreen.tsx
 * ============================================================
 *  Màn hình phục hồi / đặt lại mật khẩu của ứng dụng TechShare.
 *  Gồm 3 bước trực quan:
 *   - Bước 1: Nhập Username hoặc Email để tìm tài khoản & gửi OTP
 *   - Bước 2: Nhập mã OTP 6 số nhận từ Gmail & xác thực
 *   - Bước 3: Đặt mật khẩu mới & xác nhận mật khẩu
 *   - Bước 4: Hoàn tất, thông báo thành công và chuyển về Đăng nhập
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
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
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { forgotService } from '../../services/forgotService';
import { STRINGS } from '../../constants/strings';
import { theme } from '../../theme/tokens';

export interface ForgotPasswordScreenProps {
  navigation?: any;
  onNavigateToLogin?: () => void;
}

type Step = 'find_account' | 'verify_otp' | 'reset_password' | 'success';

export function ForgotPasswordScreen({
  navigation,
  onNavigateToLogin,
}: ForgotPasswordScreenProps) {
  const insets = useSafeAreaInsets();

  // ── States ──────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<Step>('find_account');

  // Step 1: Identifier
  const [identifier, setIdentifier] = useState('');

  // Step 2: OTP
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Step 3: Password
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // ── Countdown timer cho OTP ─────────────────────────────
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (currentStep === 'verify_otp' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [currentStep, countdown]);

  const handleGoToLogin = () => {
    if (onNavigateToLogin) {
      onNavigateToLogin();
    } else if (navigation?.navigate) {
      navigation.navigate('Login');
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  // ─────────────────────────────────────────────────────────
  //  Bước 1: Tìm tài khoản & Gửi OTP
  // ─────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const validation = forgotService.validateStep1(identifier);
    if (!validation.isValid) {
      setErrorMessage(validation.error);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await forgotService.sendOtp(identifier);
      if (res.success) {
        setEmail(res.email);
        setMaskedEmail(res.maskedEmail || res.email);
        setCountdown(60);
        setCanResend(false);
        setCurrentStep('verify_otp');
        setSuccessInfo(res.message);
      } else {
        setErrorMessage(res.message || STRINGS.FORGOT_PASSWORD.ERRORS.SEND_OTP_FAILED);
      }
    } catch (err: any) {
      console.error('[ForgotPasswordScreen] Error sending OTP:', err);
      if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else if (err.message === 'Network Error' || !err.response) {
        setErrorMessage(STRINGS.FORGOT_PASSWORD.ERRORS.NETWORK_ERROR);
      } else {
        setErrorMessage(STRINGS.FORGOT_PASSWORD.ERRORS.FIND_ACCOUNT_ERROR);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  //  Bước 2: Xác thực mã OTP
  // ─────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const validation = forgotService.validateStep2(otp);
    if (!validation.isValid) {
      setErrorMessage(validation.error);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await forgotService.verifyOtp(email, otp);
      if (res.success && res.resetToken) {
        setResetToken(res.resetToken);
        setCurrentStep('reset_password');
        setSuccessInfo(STRINGS.FORGOT_PASSWORD.STEP_2.SUCCESS_VERIFIED);
      } else {
        setErrorMessage(res.message || STRINGS.FORGOT_PASSWORD.ERRORS.INVALID_OTP_CODE);
      }
    } catch (err: any) {
      console.error('[ForgotPasswordScreen] Error verifying OTP:', err);
      if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else {
        setErrorMessage(STRINGS.FORGOT_PASSWORD.ERRORS.OTP_EXPIRED_OR_INVALID);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  //  Phụ: Gửi lại mã OTP
  // ─────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (!canResend || loading) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await forgotService.resendOtp(email);
      if (res.success) {
        setCountdown(60);
        setCanResend(false);
        setSuccessInfo(res.message || STRINGS.FORGOT_PASSWORD.STEP_2.SUCCESS_RESEND);
      } else {
        setErrorMessage(res.message || STRINGS.FORGOT_PASSWORD.ERRORS.RESEND_FAILED);
      }
    } catch (err: any) {
      console.error('[ForgotPasswordScreen] Error resending OTP:', err);
      setErrorMessage(err.response?.data?.message || STRINGS.FORGOT_PASSWORD.ERRORS.RESEND_ERROR);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  //  Bước 3: Đặt lại mật khẩu mới
  // ─────────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    const validation = forgotService.validateStep3(newPassword, confirmPassword);
    if (!validation.isValid) {
      setErrorMessage(validation.passwordError || validation.confirmError);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await forgotService.resetPassword({
        email,
        resetToken,
        newPassword,
        confirmPassword,
      });

      if (res.success) {
        setCurrentStep('success');
      } else {
        setErrorMessage(res.message || STRINGS.FORGOT_PASSWORD.ERRORS.RESET_PASSWORD_FAILED);
      }
    } catch (err: any) {
      console.error('[ForgotPasswordScreen] Error resetting password:', err);
      if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else {
        setErrorMessage(STRINGS.FORGOT_PASSWORD.ERRORS.RESET_PASSWORD_SERVER_ERROR);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  //  Header bar / Navigation back button
  // ─────────────────────────────────────────────────────────
  const handleBackPress = () => {
    setErrorMessage(null);
    setSuccessInfo(null);
    if (currentStep === 'verify_otp') {
      setCurrentStep('find_account');
    } else if (currentStep === 'reset_password') {
      setCurrentStep('verify_otp');
    } else {
      handleGoToLogin();
    }
  };

  // ─────────────────────────────────────────────────────────
  //  Render Bước 1: Tìm tài khoản
  // ─────────────────────────────────────────────────────────
  const renderFindAccount = () => (
    <View style={styles.cardFrame}>
      <View style={styles.iconCircle}>
        <Ionicons name="key-outline" size={32} color={theme.colors.brand[500]} />
      </View>
      <Text style={styles.cardTitle}>{STRINGS.FORGOT_PASSWORD.STEP_1.TITLE}</Text>
      <Text style={styles.cardSubtitle}>
        {STRINGS.FORGOT_PASSWORD.STEP_1.SUBTITLE}
      </Text>

      {/* Alert Error */}
      {errorMessage ? (
        <View style={styles.alertError}>
          <Ionicons name="alert-circle-outline" size={18} color={theme.colors.red} />
          <Text style={styles.alertErrorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>{STRINGS.FORGOT_PASSWORD.STEP_1.INPUT_LABEL}</Text>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="person-outline"
            size={18}
            color={theme.colors.text.subtle}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.inputField}
            placeholder={STRINGS.FORGOT_PASSWORD.STEP_1.INPUT_PLACEHOLDER}
            placeholderTextColor={theme.colors.text.subtle}
            value={identifier}
            onChangeText={(txt) => {
              setIdentifier(txt);
              if (errorMessage) setErrorMessage(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.btnSubmit, loading && styles.btnSubmitDisabled]}
        onPress={handleSendOtp}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <View style={styles.btnContent}>
            <Text style={styles.btnSubmitText}>{STRINGS.FORGOT_PASSWORD.STEP_1.BTN_CONTINUE}</Text>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" style={styles.btnArrowIcon} />
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backToLoginButton}
        onPress={handleGoToLogin}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={16} color={theme.colors.brand[600]} />
        <Text style={styles.backToLoginText}>{STRINGS.FORGOT_PASSWORD.STEP_1.BACK_TO_LOGIN}</Text>
      </TouchableOpacity>
    </View>
  );

  // ─────────────────────────────────────────────────────────
  //  Render Bước 2: Xác thực mã OTP
  // ─────────────────────────────────────────────────────────
  const renderVerifyOtp = () => (
    <View style={styles.cardFrame}>
      <View style={styles.iconCircle}>
        <Ionicons name="mail-unread-outline" size={32} color={theme.colors.brand[500]} />
      </View>
      <Text style={styles.cardTitle}>{STRINGS.FORGOT_PASSWORD.STEP_2.TITLE}</Text>
      <Text style={styles.cardSubtitle}>
        {STRINGS.FORGOT_PASSWORD.STEP_2.SUBTITLE}
      </Text>
      <Text style={styles.emailHighlight}>{maskedEmail || email}</Text>

      {/* Alert Error / Success */}
      {errorMessage ? (
        <View style={styles.alertError}>
          <Ionicons name="alert-circle-outline" size={18} color={theme.colors.red} />
          <Text style={styles.alertErrorText}>{errorMessage}</Text>
        </View>
      ) : successInfo ? (
        <View style={styles.alertSuccess}>
          <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.green} />
          <Text style={styles.alertSuccessText}>{successInfo}</Text>
        </View>
      ) : null}

      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>{STRINGS.FORGOT_PASSWORD.STEP_2.INPUT_LABEL}</Text>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={theme.colors.text.subtle}
            style={styles.inputIcon}
          />
          <TextInput
            style={[styles.inputField, styles.otpInput]}
            placeholder={STRINGS.FORGOT_PASSWORD.STEP_2.INPUT_PLACEHOLDER}
            placeholderTextColor={theme.colors.text.subtle}
            value={otp}
            onChangeText={(txt) => {
              setOtp(txt.replace(/[^0-9]/g, ''));
              if (errorMessage) setErrorMessage(null);
            }}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
        </View>
      </View>

      {/* Resend OTP */}
      <View style={styles.resendContainer}>
        {canResend ? (
          <TouchableOpacity onPress={handleResendOtp} disabled={loading} activeOpacity={0.7}>
            <Text style={styles.resendActiveText}>{STRINGS.FORGOT_PASSWORD.STEP_2.RESEND_ACTIVE}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.resendTimerText}>
            {STRINGS.FORGOT_PASSWORD.STEP_2.RESEND_COUNTDOWN_PREFIX}
            <Text style={styles.resendCountdown}>{countdown}s</Text>
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.btnSubmit, loading && styles.btnSubmitDisabled]}
        onPress={handleVerifyOtp}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <View style={styles.btnContent}>
            <Text style={styles.btnSubmitText}>{STRINGS.FORGOT_PASSWORD.STEP_2.BTN_VERIFY}</Text>
            <Ionicons name="checkmark" size={18} color="#ffffff" style={styles.btnArrowIcon} />
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backToLoginButton}
        onPress={() => setCurrentStep('find_account')}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={16} color={theme.colors.brand[600]} />
        <Text style={styles.backToLoginText}>{STRINGS.FORGOT_PASSWORD.STEP_2.USE_DIFFERENT_ACCOUNT}</Text>
      </TouchableOpacity>
    </View>
  );

  // ─────────────────────────────────────────────────────────
  //  Render Bước 3: Đặt mật khẩu mới
  // ─────────────────────────────────────────────────────────
  const renderResetPassword = () => (
    <View style={styles.cardFrame}>
      <View style={styles.iconCircle}>
        <Ionicons name="lock-closed-outline" size={32} color={theme.colors.brand[500]} />
      </View>
      <Text style={styles.cardTitle}>{STRINGS.FORGOT_PASSWORD.STEP_3.TITLE}</Text>
      <Text style={styles.cardSubtitle}>
        {STRINGS.FORGOT_PASSWORD.STEP_3.SUBTITLE}
      </Text>

      {/* Alert Error / Success */}
      {errorMessage ? (
        <View style={styles.alertError}>
          <Ionicons name="alert-circle-outline" size={18} color={theme.colors.red} />
          <Text style={styles.alertErrorText}>{errorMessage}</Text>
        </View>
      ) : successInfo ? (
        <View style={styles.alertSuccess}>
          <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.green} />
          <Text style={styles.alertSuccessText}>{successInfo}</Text>
        </View>
      ) : null}

      {/* Mật khẩu mới */}
      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>{STRINGS.FORGOT_PASSWORD.STEP_3.NEW_PASSWORD_LABEL}</Text>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={theme.colors.text.subtle}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.inputField}
            placeholder={STRINGS.FORGOT_PASSWORD.STEP_3.NEW_PASSWORD_PLACEHOLDER}
            placeholderTextColor={theme.colors.text.subtle}
            value={newPassword}
            onChangeText={(txt) => {
              setNewPassword(txt);
              if (errorMessage) setErrorMessage(null);
            }}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity
            onPress={() => setShowNewPassword(!showNewPassword)}
            style={styles.eyeButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.colors.text.muted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Xác nhận mật khẩu mới */}
      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>{STRINGS.FORGOT_PASSWORD.STEP_3.CONFIRM_PASSWORD_LABEL}</Text>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={theme.colors.text.subtle}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.inputField}
            placeholder={STRINGS.FORGOT_PASSWORD.STEP_3.CONFIRM_PASSWORD_PLACEHOLDER}
            placeholderTextColor={theme.colors.text.subtle}
            value={confirmPassword}
            onChangeText={(txt) => {
              setConfirmPassword(txt);
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

      <TouchableOpacity
        style={[styles.btnSubmit, loading && styles.btnSubmitDisabled]}
        onPress={handleResetPassword}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <View style={styles.btnContent}>
            <Text style={styles.btnSubmitText}>{STRINGS.FORGOT_PASSWORD.STEP_3.BTN_RESET}</Text>
            <Ionicons name="checkmark-done" size={18} color="#ffffff" style={styles.btnArrowIcon} />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  // ─────────────────────────────────────────────────────────
  //  Render Bước 4: Thành công
  // ─────────────────────────────────────────────────────────
  const renderSuccess = () => (
    <View style={styles.cardFrame}>
      <View style={[styles.iconCircle, styles.successIconCircle]}>
        <Ionicons name="checkmark-done-circle" size={48} color={theme.colors.green} />
      </View>
      <Text style={styles.cardTitle}>{STRINGS.FORGOT_PASSWORD.SUCCESS.TITLE}</Text>
      <Text style={styles.cardSubtitle}>
        {STRINGS.FORGOT_PASSWORD.SUCCESS.SUBTITLE}
      </Text>

      <TouchableOpacity
        style={[styles.btnSubmit, { marginTop: 24 }]}
        onPress={handleGoToLogin}
        activeOpacity={0.85}
      >
        <View style={styles.btnContent}>
          <Text style={styles.btnSubmitText}>{STRINGS.FORGOT_PASSWORD.SUCCESS.BTN_LOGIN_NOW}</Text>
          <Ionicons name="log-in-outline" size={20} color="#ffffff" style={styles.btnArrowIcon} />
        </View>
      </TouchableOpacity>
    </View>
  );

  // ─────────────────────────────────────────────────────────
  //  Thanh trạng thái tiến độ 3 bước
  // ─────────────────────────────────────────────────────────
  const renderProgressBar = () => {
    if (currentStep === 'success') return null;

    const stepIndex =
      currentStep === 'find_account' ? 1 : currentStep === 'verify_otp' ? 2 : 3;

    return (
      <View style={styles.progressContainer}>
        {/* Step 1 */}
        <View style={styles.stepItem}>
          <View
            style={[
              styles.stepBadge,
              stepIndex >= 1 ? styles.stepBadgeActive : styles.stepBadgeInactive,
            ]}
          >
            <Text
              style={[
                styles.stepBadgeText,
                stepIndex >= 1 ? styles.stepTextActive : styles.stepTextInactive,
              ]}
            >
              1
            </Text>
          </View>
          <Text style={styles.stepLabel}>{STRINGS.FORGOT_PASSWORD.STEPS.ACCOUNT}</Text>
        </View>

        {/* Line 1 */}
        <View
          style={[
            styles.stepLine,
            stepIndex >= 2 ? styles.stepLineActive : styles.stepLineInactive,
          ]}
        />

        {/* Step 2 */}
        <View style={styles.stepItem}>
          <View
            style={[
              styles.stepBadge,
              stepIndex >= 2 ? styles.stepBadgeActive : styles.stepBadgeInactive,
            ]}
          >
            <Text
              style={[
                styles.stepBadgeText,
                stepIndex >= 2 ? styles.stepTextActive : styles.stepTextInactive,
              ]}
            >
              2
            </Text>
          </View>
          <Text style={styles.stepLabel}>{STRINGS.FORGOT_PASSWORD.STEPS.VERIFY_OTP}</Text>
        </View>

        {/* Line 2 */}
        <View
          style={[
            styles.stepLine,
            stepIndex >= 3 ? styles.stepLineActive : styles.stepLineInactive,
          ]}
        />

        {/* Step 3 */}
        <View style={styles.stepItem}>
          <View
            style={[
              styles.stepBadge,
              stepIndex >= 3 ? styles.stepBadgeActive : styles.stepBadgeInactive,
            ]}
          >
            <Text
              style={[
                styles.stepBadgeText,
                stepIndex >= 3 ? styles.stepTextActive : styles.stepTextInactive,
              ]}
            >
              3
            </Text>
          </View>
          <Text style={styles.stepLabel}>{STRINGS.FORGOT_PASSWORD.STEPS.NEW_PASSWORD}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.rootContainer}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.screenWrapper}>
          {/* Nút quay lại */}
          {currentStep !== 'success' && (
            <TouchableOpacity
              style={[styles.closeBtn, { top: Math.max(insets.top, 16) + 8 }]}
              onPress={handleBackPress}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          )}

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: Math.max(insets.top, 20) + 40, paddingBottom: insets.bottom + 24 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header branding */}
            <View style={styles.header}>
              <View style={styles.logoBadge}>
                <Ionicons name="hardware-chip-outline" size={30} color="#ffffff" />
              </View>
              <Text style={styles.brandTitle}>{STRINGS.FORGOT_PASSWORD.BRAND_TITLE}</Text>
              <Text style={styles.brandSubtitle}>
                {STRINGS.FORGOT_PASSWORD.BRAND_SUBTITLE}
              </Text>
            </View>

            {/* Thanh tiến độ */}
            {renderProgressBar()}

            {/* Nội dung từng bước */}
            {currentStep === 'find_account' && renderFindAccount()}
            {currentStep === 'verify_otp' && renderVerifyOtp()}
            {currentStep === 'reset_password' && renderResetPassword()}
            {currentStep === 'success' && renderSuccess()}
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  screenWrapper: {
    flex: 1,
  },
  closeBtn: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: theme.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...theme.shadows.card,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text.primary,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: theme.colors.text.muted,
    marginTop: 4,
  },

  // Progress Bar
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepBadgeActive: {
    backgroundColor: theme.colors.brand[500],
  },
  stepBadgeInactive: {
    backgroundColor: theme.colors.border.light,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepTextActive: {
    color: '#ffffff',
  },
  stepTextInactive: {
    color: theme.colors.text.subtle,
  },
  stepLabel: {
    fontSize: 11,
    color: theme.colors.text.muted,
    fontWeight: '500',
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    marginBottom: 16,
  },
  stepLineActive: {
    backgroundColor: theme.colors.brand[500],
  },
  stepLineInactive: {
    backgroundColor: theme.colors.border.light,
  },

  // Form Card
  cardFrame: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    ...theme.shadows.card,
    alignItems: 'stretch',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  successIconCircle: {
    backgroundColor: theme.colors.greenLight,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  emailHighlight: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.brand[600],
    textAlign: 'center',
    marginBottom: 16,
  },

  // Alerts
  alertError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.redLight,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.red,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  alertErrorText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.red,
    lineHeight: 18,
  },
  alertSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.greenLight,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.green,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  alertSuccessText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.green,
    lineHeight: 18,
  },

  // Form Inputs
  formGroup: {
    marginBottom: 16,
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text.primary,
    height: '100%',
  },
  otpInput: {
    letterSpacing: 6,
    fontSize: 18,
    fontWeight: '700',
  },
  eyeButton: {
    padding: 8,
  },

  // Resend
  resendContainer: {
    alignItems: 'center',
    marginBottom: 18,
  },
  resendActiveText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.brand[600],
  },
  resendTimerText: {
    fontSize: 13,
    color: theme.colors.text.muted,
  },
  resendCountdown: {
    fontWeight: '700',
    color: theme.colors.brand[600],
  },

  // Submit Button
  btnSubmit: {
    backgroundColor: theme.colors.brand[500],
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...theme.shadows.card,
  },
  btnSubmitDisabled: {
    opacity: 0.7,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSubmitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  btnArrowIcon: {
    marginLeft: 8,
  },

  // Back to Login Link
  backToLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 6,
    gap: 6,
  },
  backToLoginText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.brand[600],
  },
});

export default ForgotPasswordScreen;
