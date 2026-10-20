/**
 * HeaderActions.tsx
 * Cụm nút Tin nhắn + Thông báo đặt tại headerRight của các màn hình chính.
 * Tuân thủ 100% Design Tokens từ src/constants/theme.ts (theme-skill.md).
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { notificationService } from '../../services/notificationService';

interface HeaderActionsProps {
  /** Số tin nhắn chưa đọc — hiện chấm đỏ nếu > 0 */
  unreadMessages?: number;
  /** Số thông báo chưa đọc — hiện số đếm nếu > 0 */
  unreadNotifications?: number;
  onPressWishlist?: () => void;
  onPressChat?: () => void;
  onPressNotifications?: () => void;
}

export function HeaderActions({
  unreadMessages = 0,
  unreadNotifications: propUnreadNotifications,
  onPressWishlist,
  onPressChat,
  onPressNotifications,
}: HeaderActionsProps) {
  const [internalUnread, setInternalUnread] = useState(
    notificationService.getUnreadCountCached()
  );

  useEffect(() => {
    const unsub = notificationService.onUnreadCountChange((count) => {
      setInternalUnread(count);
    });
    return unsub;
  }, []);

  const effectiveUnread =
    propUnreadNotifications !== undefined
      ? propUnreadNotifications
      : internalUnread;

  const notifScale = useRef(new Animated.Value(1)).current;
  const prevUnreadRef = useRef(effectiveUnread);

  // Hiệu ứng nhảy số khi có thông báo mới (số lượng tăng lên)
  useEffect(() => {
    if (effectiveUnread > prevUnreadRef.current) {
      Animated.sequence([
        Animated.timing(notifScale, {
          toValue: 1.45,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.spring(notifScale, {
          toValue: 1,
          friction: 4,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevUnreadRef.current = effectiveUnread;
  }, [effectiveUnread, notifScale]);

  return (
    <View style={styles.container}>
      {/* Nút Yêu thích (Wishlist) */}
      {(
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onPressWishlist}
          disabled={!onPressWishlist}
          accessibilityState={{ disabled: !onPressWishlist }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="heart-outline"
            size={22}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
      )}

      {/* Nút Tin nhắn */}
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onPressChat}
          disabled={!onPressChat}
          accessibilityState={{ disabled: !onPressChat }}
        accessibilityRole="button"
        accessibilityLabel="Chat"
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={22}
          color={theme.textPrimary}
        />
        {unreadMessages > 0 && <View style={styles.dotBadge} />}
      </TouchableOpacity>

      {/* Nút Thông báo — Badge hiển thị số lượng và nhảy số khi có thông báo */}
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onPressNotifications}
          disabled={!onPressNotifications}
          accessibilityState={{ disabled: !onPressNotifications }}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="notifications-outline"
          size={22}
          color={theme.textPrimary}
        />
        {effectiveUnread > 0 && (
          <Animated.View
            style={[
              styles.badge,
              {
                transform: [{ scale: notifScale }],
              },
            ]}
          >
            <Text style={styles.badgeText}>
              {effectiveUnread > 99 ? '99+' : String(effectiveUnread)}
            </Text>
          </Animated.View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,          // 8px spacing token
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.slate[50], // nền nhạt từ slate-50 token
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  /** Chấm đỏ tin nhắn */
  dotBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.danger[500],
    borderWidth: 1.5,
    borderColor: theme.card,
  },
  /** Badge số lượng thông báo nhảy số — tông đỏ danger nổi bật */
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF', // viền trắng tách biệt icon
    zIndex: 99,
    elevation: 5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },
});
