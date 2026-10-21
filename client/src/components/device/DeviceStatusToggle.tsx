import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { STRINGS } from '../../constants/strings';
import { theme } from '../../constants/theme';
import type { ManagedDeviceStatus } from '../../types';

interface DeviceStatusToggleProps {
  status: ManagedDeviceStatus;
  onChange: (status: ManagedDeviceStatus) => void;
  disabled?: boolean;
}

const STATUS_OPTIONS: {
  value: ManagedDeviceStatus;
  label: string;
  color: string;
}[] = [
  { value: 'available', label: STRINGS.DEVICE_STATUS.AVAILABLE, color: theme.success },
  { value: 'maintenance', label: STRINGS.DEVICE_STATUS.MAINTENANCE, color: theme.warning },
  { value: 'hidden', label: STRINGS.DEVICE_STATUS.HIDDEN, color: theme.textSecondary },
];

export function DeviceStatusToggle({
  status,
  onChange,
  disabled = false,
}: DeviceStatusToggleProps) {
  return (
    <View
      style={styles.container}
      accessibilityRole="radiogroup"
      accessibilityLabel={STRINGS.DEVICE_STATUS.LABEL_GROUP}
    >
      {STATUS_OPTIONS.map((option) => {
        const selected = status === option.value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              selected && {
                backgroundColor: option.color,
                borderColor: option.color,
              },
              pressed && !disabled && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              numberOfLines={1}
              style={[
                styles.label,
                selected && styles.selectedLabel,
                selected &&
                  option.value === 'maintenance' &&
                  styles.maintenanceLabel,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  option: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    maxWidth: '100%',
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.semibold,
    textAlign: 'center',
    color: theme.textSecondary,
  },
  selectedLabel: {
    color: theme.white,
    fontWeight: theme.typography.weights.bold,
  },
  maintenanceLabel: {
    color: theme.textPrimary,
  },
});
