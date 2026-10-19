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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch } from '../../store';
import { setAuth } from '../../store/slices/authSlice';
import { setAuthToken } from '../../config/api';
import { socketService } from '../../services/socketService';
import { loginService } from '../../services/loginService';
import { theme } from '../../theme/tokens';

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
  const dispatch = useAppDispatch();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    // ── Bước 1: Validate form phía client (không cần gọi API) ───────────
    const validation = loginService.validate({ identifier, password });

    if (!validation.isValid) {
      setErrorMessage(
        validation.identifierError || validation.passwordError || 'Vui lòng kiểm tra lại thông tin.',
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // ── Bước 2: Gọi loginService → POST /api/login ──────────────────
      const data = await loginService.login({ identifier, password });

      if (data.success && data.token && data.user) {
        // ── Bước 3: Lưu token vào axios headers ─────────────────────
        setAuthToken(data.token);

        // ── Bước 4: Kết nối Socket.IO với user ID ───────────────────
        const userId = data.user._id || (data.user as any).id;
        if (userId) {
          socketService.connect(userId);
        }

        // ── Bước 5: Cập nhật Redux store với token + user ────────────
        dispatch(setAuth({ token: data.token, user: data.user }));

        // ── Bước 6: Callback chuyển màn hình theo role ───────────────
        if (onLoginSuccess) {
          onLoginSuccess(data.user.role || 'renter');
        }
      } else {
        setErrorMessage(data.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
      }
    } catch (err: any) {
      console.error('[LoginScreen] Lỗi đăng nhập:', err.message);
      if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else if (err.message === 'Network Error' || !err.response) {
        setErrorMessage('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và đảm bảo backend đang chạy.');
      } else {
        setErrorMessage('Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.rootContainer}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.screenWrapper}>
          {/* Back or Close button if navigated from guest flow */}
          {navigation?.canGoBack?.() && (
            <TouchableOpacity
              style={[styles.closeBtn, { top: Math.max(insets.top, 16) + 8 }]}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          )}

          {/* Logo & Header đặt ngoài khung */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="hardware-chip-outline" size={32} color="#ffffff" />
            </View>
            <Text style={styles.brandTitle}>TechShare</Text>
            <Text style={styles.brandSubtitle}>
              A platform for sharing and renting tech devices
            </Text>
          </View>

          {/* Khung viền riêng cho Form đăng nhập */}
          <View style={styles.cardFrame}>
            {/* Tiêu đề bên trong khung form */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Log In</Text>
              <Text style={styles.cardSubtitle}>Welcome back to the community</Text>
            </View>

            {/* Error alert box */}
            {errorMessage ? (
              <View style={styles.alertError}>
                <Ionicons name="alert-circle-outline" size={20} color={theme.colors.red} />
                <Text style={styles.alertErrorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Login form: Username/Email */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Username or email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={theme.colors.text.subtle}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.inputField}
                  placeholder="Enter username or email"
                  placeholderTextColor={theme.colors.text.subtle}
                  value={identifier}
                  onChangeText={(text) => {
                    setIdentifier(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Login form: Password */}
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
                  placeholder="Nhập mật khẩu"
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

            {/* Remember me & Forgot password */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberMeContainer}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxChecked,
                  ]}
                >
                  {rememberMe ? (
                    <Ionicons name="checkmark" size={14} color="#ffffff" />
                  ) : null}
                </View>
                <Text style={styles.rememberMeText}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (onNavigateToForgotPassword) onNavigateToForgotPassword();
                  else if (navigation?.navigate) navigation.navigate('ForgotPassword');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
              </TouchableOpacity>
            </View>

            {/* Sign In button */}
            <TouchableOpacity
              style={[styles.btnSubmit, loading && styles.btnSubmitDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <View style={styles.btnSubmitContent}>
                  <Text style={styles.btnSubmitText}>ĐĂNG NHẬP</Text>
                  <Ionicons name="arrow-forward" size={18} color="#ffffff" style={styles.btnArrowIcon} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Navigate to Register screen (nằm ngoài khung như trong ảnh) */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Chưa có tài khoản?</Text>
            <TouchableOpacity
              onPress={() => {
                if (onNavigateToRegister) onNavigateToRegister();
                else if (navigation?.navigate) navigation.navigate('Register');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.registerLink}>Đăng ký ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  screenWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardFrame: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 22,
    ...theme.shadows.card,
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: theme.colors.text.muted,
  },
  closeBtn: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...theme.shadows.card,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 13,
    color: theme.colors.text.muted,
    textAlign: 'center',
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
    marginBottom: 20,
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
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
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
  eyeButton: {
    padding: 6,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 20,
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
    color: '#ffffff',
    fontSize: 15,
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
    marginTop: 20,
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.text.muted,
  },
  registerLink: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.brand[600],
  },
});

export default LoginScreen;

