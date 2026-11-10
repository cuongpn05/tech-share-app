import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { STRINGS } from '../../constants/strings';

const DEFAULT_QUICK_MESSAGES = STRINGS.CHAT.QUICK_MESSAGES;

interface QuickMessageBarProps {
  onSelectTemplate: (template: string) => void;
  templates?: readonly string[];
  disabled?: boolean;
}

export const QuickMessageBar: React.FC<QuickMessageBarProps> = ({
  onSelectTemplate,
  templates = DEFAULT_QUICK_MESSAGES,
  disabled = false,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {templates.map((tpl, index) => (
          <TouchableOpacity
            key={`tpl-${index}`}
            style={[styles.pill, disabled && { opacity: 0.5 }]}
            onPress={() => onSelectTemplate(tpl)}
            disabled={disabled}
            activeOpacity={0.75}
          >
            <Ionicons
              name="flash"
              size={12}
              color={theme.colors.brand[600]}
              style={styles.flashIcon}
            />
            <Text style={styles.pillText} numberOfLines={1}>
              {tpl}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.brand[100],
    borderWidth: 1,
    borderColor: theme.colors.brand[200],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  flashIcon: {
    marginRight: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.brand[700],
  },
});

export default QuickMessageBar;
