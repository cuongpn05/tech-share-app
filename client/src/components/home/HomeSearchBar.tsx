import React from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';

/**
 * ============================================================================
 * HomeSearchBar.tsx
 *
 * TRÁCH NHIỆM (RESPONSIBILITY):
 * Hiển thị thanh tìm kiếm thiết bị:
 * 1. Cho phép người dùng nhập từ khóa tìm kiếm (tên thiết bị, thương hiệu).
 * 2. Cung cấp nút xóa nhanh (Clear Button `X`) khi người dùng đã nhập chữ.
 * ============================================================================
 */

interface HomeSearchBarProps {
  /** Giá trị chuỗi tìm kiếm hiện tại */
  value: string;
  /** Hàm callback được gọi khi người dùng thay đổi văn bản */
  onChangeText: (text: string) => void;
  /** Hàm callback khi người dùng bấm nút xóa tìm kiếm */
  onClear: () => void;
  /** Chữ gợi ý hiển thị trong ô tìm kiếm */
  placeholder?: string;
}

export function HomeSearchBar({
  value,
  onChangeText,
  onClear,
  placeholder = STRINGS.HOME_SCREEN.SEARCH_PLACEHOLDER,
}: HomeSearchBarProps) {
  return (
    <View style={styles.searchContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={colors.light.textMuted} />

        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor={colors.light.textSecondary}
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel="Search devices"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {value.length > 0 ? (
          <TouchableOpacity
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            style={styles.clearButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={20} color={colors.light.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: 16,
    marginVertical: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.light.textPrimary,
    fontSize: 14,
  },
  clearButton: {
    padding: 6,
  },
});

