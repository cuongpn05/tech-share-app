import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DeviceCategory } from '../../types';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';

export interface CategoryItem {
  id: DeviceCategory | 'all';
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const CATEGORIES: CategoryItem[] = [
  {
    id: 'all',
    name: STRINGS.CATEGORIES.ALL,
    icon: 'apps-outline',
  },
  {
    id: 'smartphone',
    name: STRINGS.CATEGORIES.SMARTPHONES,
    icon: 'phone-portrait-outline',
  },
  {
    id: 'laptop',
    name: STRINGS.CATEGORIES.LAPTOPS,
    icon: 'laptop-outline',
  },
  {
    id: 'camera',
    name: STRINGS.CATEGORIES.CAMERAS,
    icon: 'camera-outline',
  },
  {
    id: 'drone',
    name: STRINGS.CATEGORIES.DRONES,
    icon: 'airplane-outline',
  },
  {
    id: 'audio',
    name: STRINGS.CATEGORIES.AUDIO,
    icon: 'headset-outline',
  },
  {
    id: 'tablet',
    name: 'Tablets',
    icon: 'tablet-portrait-outline',
  },
  {
    id: 'accessory',
    name: STRINGS.CATEGORIES.ACCESSORIES,
    icon: 'hardware-chip-outline',
  },
];

interface CategoryBarProps {
  selectedCategory: DeviceCategory | 'all';
  onSelectCategory: (category: DeviceCategory | 'all') => void;
}

export function CategoryBar({ selectedCategory, onSelectCategory }: CategoryBarProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {CATEGORIES.map(cat => {
          const isActive = selectedCategory === cat.id;

          return (
            <TouchableOpacity
              key={cat.id}
              accessibilityRole="button"
              accessibilityLabel={cat.name}
              accessibilityState={{ selected: isActive }}
              style={[styles.categoryItem, isActive && styles.categoryItemActive]}
              onPress={() => onSelectCategory(cat.id)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.iconCircle,
                  isActive ? styles.iconCircleActive : styles.iconCircleInactive,
                ]}
              >
                <Ionicons
                  name={cat.icon}
                  size={20}
                  color={isActive ? '#FFFFFF' : colors.light.primary}
                />
              </View>
              <Text
                style={[styles.categoryName, isActive && styles.categoryNameActive]}
                numberOfLines={1}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
    alignItems: 'center',
  },
  categoryItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    minWidth: 76,
  },
  categoryItemActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primaryDark,
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconCircleInactive: {
    backgroundColor: colors.light.primaryLight,
  },
  iconCircleActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  categoryNameActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
