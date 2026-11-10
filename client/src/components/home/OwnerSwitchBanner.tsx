import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';

/**
 * ============================================================================
 * OwnerSwitchBanner.tsx
 *
 * TRÁCH NHIỆM (RESPONSIBILITY):
 * Hiển thị banner chuyển đổi nhanh sang màn hình Quản lý của Chủ máy (Owner Dashboard)
 * dành riêng cho những tài khoản có vai trò Chủ thiết bị.
 * ============================================================================
 */

interface OwnerSwitchBannerProps {
  /** Có hiển thị banner này hay không */
  visible: boolean;
  /** Hàm callback điều hướng sang Owner Dashboard */
  onPress?: () => void;
}

export function OwnerSwitchBanner({ visible, onPress }: OwnerSwitchBannerProps) {
  if (!visible) return null;

  return (
    <TouchableOpacity
      style={styles.ownerSwitchBanner}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Switch to Owner Dashboard"
    >
      <View style={styles.ownerSwitchLeft}>
        <View style={styles.ownerSwitchIconBox}>
          <Ionicons name="briefcase" size={14} color={colors.light.primary} />
        </View>
        <Text style={styles.ownerSwitchText}>
          {STRINGS.HOME_SCREEN.OWNER_SWITCH_PREFIX}
          <Text style={styles.ownerSwitchTextBold}>
            {STRINGS.HOME_SCREEN.OWNER_SWITCH_BOLD}
          </Text>
        </Text>
      </View>

      <View style={styles.ownerSwitchCta}>
        <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  ownerSwitchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.light.primaryLight,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ownerSwitchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  ownerSwitchIconBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.light.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerSwitchText: {
    fontSize: 12,
    color: colors.light.primaryDark,
  },
  ownerSwitchTextBold: {
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
  ownerSwitchCta: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

