import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch } from '../../store';
import { setAuth } from '../../store/slices/authSlice';
import { apiClient, setAuthToken } from '../../config/api';
import { socketService } from '../../services/socketService';
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
  const dispatch = useAppDispatch();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    const finalIdentifier = identifier.trim();
    const finalPassword = password;

    if (!finalIdentifier) {
      setErrorMessage('Please enter your username or email.');
      return;
    }

    if (!finalPassword) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiClient.post('/auth/login', {
        identifier: finalIdentifier,
        password: finalPassword,
      });

      if (response.data?.success && response.data?.token && response.data?.user) {
        const { token, user } = response.data;
        setAuthToken(token);
        dispatch(setAuth({ token, user }));
        // Workflow 1: Kết nối Socket.IO và gia nhập room định danh cá nhân user_{userId}
        const userId = user._id || (user as any).id;
        if (userId) {
          socketService.connect(userId);
        }
        if (onLoginSuccess) {
          onLoginSuccess(user.role || 'renter');
        }
      } else {
        setErrorMessage(response.data?.message || 'Login failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Login error:', err.message, 'Target URL:', `${apiClient.defaults.baseURL}/auth/login`);
      if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else if (err.message === 'Network Error' || !err.response) {
        setErrorMessage('Cannot connect to server. Please check your network connection and make sure the backend API is running.');
      } else {
        setErrorMessage('An error occurred during login. Please try again.');
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardContainer}>
          {/* Logo & Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="hardware-chip-outline" size={32} color="#ffffff" />
            </View>
            <Text style={styles.brandTitle}>TechShare</Text>
            <Text style={styles.brandSubtitle}>
              Smart Technology Equipment Rental Platform
            </Text>
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
            <Text style={styles.inputLabel}>Username or Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="person-outline"
                size={18}
                color={theme.colors.text.subtle}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.inputField}
                placeholder="e.g. renter1 or email@techshare.vn"
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
                placeholder="Enter your password"
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
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
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
              <Text style={styles.btnSubmitText}>SIGN IN</Text>
            )}
          </TouchableOpacity>

          {/* Navigate to Register screen */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity
              onPress={() => {
                if (onNavigateToRegister) onNavigateToRegister();
                else if (navigation?.navigate) navigation.navigate('Register');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.registerLink}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii['2xl'],
    paddingVertical: 36,
    paddingHorizontal: 28,
    ...theme.shadows.card,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...theme.shadows.card,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 6,
  },
  brandSubtitle: {
    fontSize: 14,
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
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: theme.radii.md,
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
    marginBottom: 24,
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
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  btnSubmitDisabled: {
    opacity: 0.65,
  },
  btnSubmitText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
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

