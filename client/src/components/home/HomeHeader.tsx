import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HeaderActions } from '../navigation/HeaderActions';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';

/**
 * ============================================================================
 * HomeHeader.tsx
 *
 * TRÁCH NHIỆM (RESPONSIBILITY):
 * Hiển thị thanh tiêu đề trên cùng của HomeScreen:
 * 1. Logo ứng dụng & Tên thương hiệu "TechShare".
 * 2. Các nút chức năng người dùng (Tin nhắn, Thông báo, Yêu thích nếu đã đăng nhập;
 *    hoặc nút "Login" nếu là khách vãng lai).
 * ============================================================================
 */

interface HomeHeaderProps {
  /** Khoảng cách an toàn phía trên (tránh tai thỏ/status bar) */
  topInset: number;
  /** Trạng thái đăng nhập của người dùng */
  isAuthenticated: boolean;
  /** Số lượng tin nhắn chưa đọc */
  unreadMessages?: number;
  /** Số lượng thông báo chưa đọc */
  unreadNotifications?: number;
  /** Điều hướng sang danh sách yêu thích */
  onNavigateToWishlist?: () => void;
  /** Điều hướng sang hộp thư chat */
  onNavigateToChat?: () => void;
  /** Điều hướng sang màn hình thông báo */
  onNavigateToNotifications?: () => void;
  /** Điều hướng sang màn hình đăng nhập */
  onNavigateToLogin?: () => void;
}

export function HomeHeader({
  topInset,
  isAuthenticated,
  unreadMessages = 0,
  unreadNotifications,
  onNavigateToWishlist,
  onNavigateToChat,
  onNavigateToNotifications,
  onNavigateToLogin,
}: HomeHeaderProps) {
  return (
    <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
      {/* 1. Logo và tên thương hiệu */}
      <View style={styles.brandContainer}>
        <View style={styles.logoBadge}>
          <Ionicons name="hardware-chip" size={18} color={colors.light.white} />
        </View>

        <Text style={styles.brandTitle}>
          {STRINGS.HOME_SCREEN.BRAND_TITLE_PREFIX}
          <Text style={styles.brandTitleAccent}>{STRINGS.HOME_SCREEN.BRAND_TITLE_SUFFIX}</Text>
        </Text>
      </View>

      {/* 2. ACTIONS: Chat, Thông báo, Yêu thích HOẶC Nút Đăng nhập */}
      {isAuthenticated ? (
        <HeaderActions
          unreadMessages={unreadMessages}
          unreadNotifications={unreadNotifications}
          onPressWishlist={onNavigateToWishlist}
          onPressChat={onNavigateToChat}
          onPressNotifications={onNavigateToNotifications}
        />
      ) : (
        <TouchableOpacity
          style={styles.headerLoginButton}
          onPress={onNavigateToLogin}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Login"
        >
          <Ionicons name="log-in-outline" size={16} color={colors.light.white} style={styles.headerLoginIcon} />
          <Text style={styles.headerLoginText}>Login</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.light.black,
    letterSpacing: 0.5,
  },
  brandTitleAccent: {
    color: colors.light.primary,
  },
  headerLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  headerLoginIcon: {
    marginRight: 4,
  },
  headerLoginText: {
    color: colors.light.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

