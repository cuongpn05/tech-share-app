import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';

interface AiGenerateButtonProps {
  onPress: () => void;
  loading: boolean;
}

export default function AiGenerateButton({
  onPress,
  loading,
}: AiGenerateButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      style={{
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 10,
        backgroundColor: colors.light.primary,
      }}
    >
      {loading ? (
        <ActivityIndicator color={colors.light.white} />
      ) : (
        <Text style={{ color: colors.light.white, fontWeight: '600' }}>
          ✨ Generate with AI
        </Text>
      )}
    </TouchableOpacity>
  );
}
