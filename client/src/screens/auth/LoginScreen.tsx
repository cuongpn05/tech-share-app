import React, { useState } from 'react';
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
  StyleSheet,
  Image,
  ScrollView,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch } from '../../store';
import { setAuth } from '../../store/slices/authSlice';
import { setAuthToken } from '../../config/api';
import { socketService } from '../../services/socketService';
import { loginService } from '../../services/loginService';
import { ActionResultModal } from '../../components/common/ActionFeedbackModals';
import { STRINGS } from '../../constants/strings';
import { theme } from '../../theme/tokens';

const loginBackground = require('../../../assets/images/login-background.png');

export interface LoginScreenProps {
  navigation?: any;
  onNavigateToRegister?: () => void;
  onNavigateToForgotPassword?: () => void;
  onLoginSuccess?: (role: string) => void;
}

export function LoginScreen({
  navigation,
  onNavigateToRegister,
  onNavigateToForgotPassword,
  onLoginSuccess,
}: LoginScreenProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const dispatch = useAppDispatch();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockedReason, setLockedReason] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'identifier' | 'password' | null>(null);

  // The product artwork occupies roughly the top 36% of the portrait background.
  const heroHeight = Math.max(224, Math.round(height * 0.36));

  const handleLogin = async () => {
    const validation = loginService.validate({ identifier, password });

    if (!validation.isValid) {
      setErrorMessage(
        validation.identifierError || validation.passwordError || 'Please check your login credentials.'
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const data = await loginService.login({ identifier, password });

      if (data.success && data.token && data.user) {
        setAuthToken(data.token);

        const userId = data.user._id || (data.user as any).id;
        if (userId) {
          socketService.connect(userId);
        }

        dispatch(setAuth({ token: data.token, user: data.user }));

        if (onLoginSuccess) {
          onLoginSuccess(data.user.role || 'renter');
        }
      } else {
        setErrorMessage(data.message || 'Login failed. Please try again.');
      }
    } catch (err: any) {
      console.error('[LoginScreen] Login error:', err.message);
      if (err?.response?.status === 403 && err?.response?.data?.code === 'ACCOUNT_LOCKED') {
        Keyboard.dismiss();
        setErrorMessage(null);
        setLockedReason(
          err.response.data.lockReason || STRINGS.AUTH_LOCKED.DEFAULT_REASON
        );
      } else if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else if (err.message === 'Network Error' || !err.response) {
        setErrorMessage('Unable to connect to server. Please check your network and make sure backend is running.');
      } else {
        setErrorMessage('An error occurred during login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.rootContainer}>
      <Image source={loginBackground} style={styles.screenBackground} resizeMode="stretch" accessible={false} />
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* 1. HERO SECTION */}
            <View style={[styles.heroSection, { minHeight: heroHeight }]}>
              {/* Back / Close button if canGoBack */}
              {navigation?.canGoBack?.() ? (
                <TouchableOpacity
                  style={[
                    styles.backButton,
                    {
                      top:
                        Math.max(
                          insets.top,
                          Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 16
                        ) + 6,
                    },
                  ]}
                  onPress={() => navigation.goBack()}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel="Back"
                  accessibilityRole="button"
                >
                  <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
                </TouchableOpacity>
              ) : null}

              {/* Hero Content Overlay (Left-aligned, leaving right side for product photography) */}
              <View
                style={[
                  styles.heroContent,
                  {
                    paddingTop:
                      Math.max(
                        insets.top,
                        Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 16
                      ) + (navigation?.canGoBack?.() ? 36 : 14),
                  },
                ]}
              >
                {/* Brand Row: Logo + TechShare */}
                <View style={styles.brandRow}>
                  <View style={styles.logoBadge}>
                    <Ionicons name="hardware-chip-outline" size={16} color={theme.colors.white} />
                  </View>
                  <Text style={styles.brandName}>{STRINGS.AUTH.APP_NAME}</Text>
                </View>

                {/* Main Heading: Welcome back */}
                <Text style={styles.welcomeHeading}>{STRINGS.AUTH.WELCOME_BACK}</Text>
                <Text style={styles.welcomeSubtitle}>{STRINGS.AUTH.LOGIN_DESC}</Text>
              </View>
            </View>

            {/* 2. LOGIN FORM */}
            <View style={styles.formContainer}>
              {/* Error banner */}
              {errorMessage ? (
                <View style={styles.alertError}>
                  <Ionicons name="alert-circle-outline" size={18} color={theme.colors.red} />
                  <Text style={styles.alertErrorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Email / Username field */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>{STRINGS.AUTH.IDENTIFIER_LABEL}</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focusedField === 'identifier' && styles.inputWrapperFocused,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color={
                      focusedField === 'identifier'
                        ? theme.colors.brand[500]
                        : theme.colors.text.subtle
                    }
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.inputField}
                    placeholder={STRINGS.AUTH.IDENTIFIER_PLACEHOLDER}
                    placeholderTextColor={theme.colors.text.subtle}
                    value={identifier}
                    onChangeText={(text) => {
                      setIdentifier(text);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onFocus={() => setFocusedField('identifier')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Password field */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>{STRINGS.AUTH.PASSWORD_LABEL}</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focusedField === 'password' && styles.inputWrapperFocused,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={
                      focusedField === 'password'
                        ? theme.colors.brand[500]
                        : theme.colors.text.subtle
                    }
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.inputField}
                    placeholder={STRINGS.AUTH.PASSWORD_PLACEHOLDER}
                    placeholderTextColor={theme.colors.text.subtle}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.colors.text.muted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Remember Me & Forgot Password */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberMeContainer}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe ? (
                      <Ionicons name="checkmark" size={12} color={theme.colors.white} />
                    ) : null}
                  </View>
                  <Text style={styles.rememberMeText}>{STRINGS.AUTH.REMEMBER_ME}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (onNavigateToForgotPassword) onNavigateToForgotPassword();
                    else if (navigation?.navigate) navigation.navigate('ForgotPassword');
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.forgotPasswordText}>{STRINGS.AUTH.FORGOT_PASSWORD}</Text>
                </TouchableOpacity>
              </View>

              {/* Log In Button */}
              <TouchableOpacity
                style={[styles.btnSubmit, loading && styles.btnSubmitDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.white} size="small" />
                ) : (
                  <Text style={styles.btnSubmitText}>{STRINGS.AUTH.LOGIN_BTN}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* 3. SIGN UP FOOTER */}
            <View
              style={[
                styles.footerContainer,
                { paddingBottom: Math.max(insets.bottom, theme.spacing.md) },
              ]}
            >
              <Text style={styles.footerText}>
                {STRINGS.AUTH.NO_ACCOUNT_PROMPT}
                <Text
                  style={styles.registerLink}
                  onPress={() => {
                    if (onNavigateToRegister) onNavigateToRegister();
                    else if (navigation?.navigate) navigation.navigate('Register');
                  }}
                >
                  {STRINGS.AUTH.SIGN_UP_LINK}
                </Text>
              </Text>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Account locked modal */}
      <ActionResultModal
        visible={Boolean(lockedReason)}
        type="locked"
        title={STRINGS.AUTH_LOCKED.ALERT_TITLE}
        message={STRINGS.AUTH_LOCKED.LOGIN_LOCKED_MSG}
        summaryItems={
          lockedReason
            ? [
                {
                  icon: 'alert-circle-outline',
                  label: STRINGS.AUTH_LOCKED.REASON_LABEL,
                  value: lockedReason,
                },
                {
                  icon: 'lock-closed-outline',
                  label: STRINGS.AUTH_LOCKED.STATUS_LABEL,
                  value: STRINGS.AUTH_LOCKED.STATUS_VALUE,
                },
              ]
            : []
        }
        buttonText={STRINGS.AUTH_LOCKED.ACK_BTN}
        onClose={() => setLockedReason(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: theme.colors.brand[50],
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    width: '100%',
    position: 'relative',
  },
  screenBackground: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  heroContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    maxWidth: '68%',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
    letterSpacing: -0.2,
  },
  welcomeHeading: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text.primary,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    lineHeight: 18,
  },
  formContainer: {
    paddingHorizontal: 24,
    paddingTop: theme.spacing.md,
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
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 7,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  inputWrapperFocused: {
    borderColor: theme.colors.brand[500],
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
  eyeButton: {
    padding: 6,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 22,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.brand[500],
    borderColor: theme.colors.brand[500],
  },
  rememberMeText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  forgotPasswordText: {
    fontSize: 13,
    color: theme.colors.brand[600],
    fontWeight: '600',
  },
  btnSubmit: {
    height: 48,
    backgroundColor: theme.colors.brand[500],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSubmitDisabled: {
    opacity: 0.65,
  },
  btnSubmitText: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.text.muted,
  },
  registerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.brand[600],
  },
});

export default LoginScreen;
