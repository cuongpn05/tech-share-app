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
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch } from '../../store';
import { setAuth } from '../../store/slices/authSlice';
import { apiClient, setAuthToken } from '../../config/api';
import { socketService } from '../../services/socketService';
import { theme } from '../../theme/tokens';

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
    const trimmedUsername = username.trim();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedUsername || !trimmedName || !trimmedEmail || !trimmedPhone || !password) {
      setErrorMessage('Vui lòng điền đầy đủ tất cả các trường thông tin.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Mật khẩu phải có độ dài ít nhất 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu và xác nhận mật khẩu không trùng khớp.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiClient.post('/auth/register/send-otp', {
        username: trimmedUsername,
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        password,
      });

      if (response.data?.success) {
        setStep('otp');
        setCountdown(60);
        setCanResend(false);
        setOtp('');
      } else {
        setErrorMessage(response.data?.message || 'Không thể gửi mã OTP. Vui lòng thử lại.');
      }
    } catch (err: any) {
      console.error('Send OTP error:', err.response?.data || err.message);
      if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else if (err.message === 'Network Error' || !err.response) {
        setErrorMessage('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng.');
      } else {
        setErrorMessage('Đã xảy ra lỗi khi đăng ký. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Xử lý xác nhận OTP bước 2
  const handleVerifyOtp = async () => {
    const trimmedOtp = otp.trim();
    if (trimmedOtp.length !== 6) {
      setErrorMessage('Vui lòng nhập đúng và đủ mã OTP 6 chữ số.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiClient.post('/auth/register/verify-otp', {
        email: email.trim(),
        otp: trimmedOtp,
      });

      if (response.data?.success && response.data?.token && response.data?.user) {
        const { token, user } = response.data;
        setAuthToken(token);

        const userId = user._id || (user as any).id;
        if (userId) {
          socketService.connect(userId);
        }

        dispatch(setAuth({ token, user }));

        // Tự động chuyển thẳng về trang Home, không hiển thị bất kỳ cửa sổ thông báo nào
        if (onRegisterSuccess) {
          onRegisterSuccess(user.role || 'renter');
        } else if (navigation?.navigate) {
          navigation.navigate('Home');
        }
      } else {
        setErrorMessage(response.data?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
      }
    } catch (err: any) {
      console.error('Verify OTP error:', err.response?.data || err.message);
      if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else {
        setErrorMessage('Lỗi xác thực mã OTP. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Gửi lại mã OTP
  const handleResendOtp = async () => {
    if (!canResend || loading) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiClient.post('/auth/register/resend-otp', {
        email: email.trim(),
      });

      if (response.data?.success) {
        setCountdown(60);
        setCanResend(false);
        setOtp('');
        Alert.alert('Thành công', 'Mã OTP mới đã được gửi vào email của bạn.');
      } else {
        setErrorMessage(response.data?.message || 'Không thể gửi lại mã OTP.');
      }
    } catch (err: any) {
      if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else {
        setErrorMessage('Lỗi gửi lại mã OTP. Vui lòng thử lại.');
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.screenWrapper}>
          {/* Nút quay lại/đóng */}
          {navigation?.canGoBack?.() && (
            <TouchableOpacity
              style={[styles.closeBtn, { top: Math.max(insets.top, 16) + 4 }]}
              onPress={() => {
                if (step === 'otp') {
                  setStep('form');
                  setErrorMessage(null);
                } else {
                  navigation.goBack();
                }
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={step === 'otp' ? 'arrow-back' : 'close'}
                size={24}
                color={theme.colors.text.secondary}
              />
            </TouchableOpacity>
          )}

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: Math.max(insets.top, 20) + 12, paddingBottom: Math.max(insets.bottom, 20) + 20 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header: Logo & Tên ứng dụng */}
            <View style={styles.header}>
              <View style={styles.logoBadge}>
                <Ionicons name="hardware-chip-outline" size={30} color="#ffffff" />
              </View>
              <Text style={styles.brandTitle}>TechShare</Text>
              <Text style={styles.brandSubtitle}>
                Nền tảng chia sẻ và thuê thiết bị công nghệ hàng đầu
              </Text>
            </View>

            {/* Khung viền Form đăng ký / OTP */}
            <View style={styles.cardFrame}>
              {step === 'form' ? (
                <>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Đăng ký tài khoản</Text>
                    <Text style={styles.cardSubtitle}>Điền thông tin bên dưới để bắt đầu</Text>
                  </View>

                  {/* Thông báo lỗi */}
                  {errorMessage ? (
                    <View style={styles.alertError}>
                      <Ionicons name="alert-circle-outline" size={20} color={theme.colors.red} />
                      <Text style={styles.alertErrorText}>{errorMessage}</Text>
                    </View>
                  ) : null}

                  {/* Username */}
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Tên đăng nhập</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="person-outline"
                        size={18}
                        color={theme.colors.text.subtle}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.inputField}
                        placeholder="Ví dụ: username123"
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

                  {/* Họ và tên */}
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Họ và tên</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="id-card-outline"
                        size={18}
                        color={theme.colors.text.subtle}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.inputField}
                        placeholder="Ví dụ: Nguyễn Văn A"
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
                    <Text style={styles.inputLabel}>Email</Text>
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

                  {/* Số điện thoại */}
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Số điện thoại</Text>
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

                  {/* Mật khẩu */}
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Mật khẩu</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color={theme.colors.text.subtle}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.inputField}
                        placeholder="Tối thiểu 6 ký tự"
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

                  {/* Xác nhận mật khẩu */}
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Xác nhận mật khẩu</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={18}
                        color={theme.colors.text.subtle}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.inputField}
                        placeholder="Nhập lại mật khẩu"
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

                  {/* Nút gửi OTP */}
                  <TouchableOpacity
                    style={[styles.btnSubmit, loading && styles.btnSubmitDisabled]}
                    onPress={handleSendOtp}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <View style={styles.btnSubmitContent}>
                        <Text style={styles.btnSubmitText}>TIẾP TỤC & NHẬN OTP</Text>
                        <Ionicons name="arrow-forward" size={18} color="#ffffff" style={styles.btnArrowIcon} />
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                /* Bước 2: Nhập OTP xác thực */
                <>
                  <View style={styles.otpHeader}>
                    <View style={styles.otpIconBadge}>
                      <Ionicons name="mail-unread-outline" size={32} color={theme.colors.brand[500]} />
                    </View>
                    <Text style={styles.cardTitle}>Xác thực Email</Text>
                    <Text style={styles.otpInstruction}>
                      Chúng tôi đã gửi mã xác thực 6 chữ số đến email:
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
                      <Text style={styles.changeEmailText}>Thay đổi thông tin</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Thông báo lỗi */}
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
                        // Chỉ cho phép nhập số, tối đa 6 chữ số
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

                  {/* Đếm ngược gửi lại OTP */}
                  <View style={styles.resendRow}>
                    {canResend ? (
                      <TouchableOpacity onPress={handleResendOtp} disabled={loading} activeOpacity={0.7}>
                        <Text style={styles.resendActiveText}>Gửi lại mã OTP</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.resendTimerText}>
                        Gửi lại mã sau <Text style={styles.countdownNumber}>{countdown}s</Text>
                      </Text>
                    )}
                  </View>

                  {/* Nút xác nhận đăng ký */}
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
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <View style={styles.btnSubmitContent}>
                        <Text style={styles.btnSubmitText}>XÁC NHẬN ĐĂNG KÝ</Text>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" style={styles.btnArrowIcon} />
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Footer chuyển sang đăng nhập */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Đã có tài khoản?</Text>
              <TouchableOpacity onPress={handleBackToLogin} activeOpacity={0.7}>
                <Text style={styles.loginLink}>Đăng nhập ngay</Text>
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
    backgroundColor: '#F8FAFC',
  },
  screenWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
    flexGrow: 1,
  },
  closeBtn: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBadge: {
    width: 56,
    height: 56,
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
    maxWidth: 320,
  },
  cardFrame: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    ...theme.shadows.card,
  },
  cardHeader: {
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: theme.colors.text.muted,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#ffffff',
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
    backgroundColor: '#F0FAF9',
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
