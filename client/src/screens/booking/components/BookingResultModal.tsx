import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';

interface Props {
  visible: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
  onClose: () => void;
}

const BookingResultModal = ({
  visible,
  type,
  title,
  message,
  onClose,
}: Props) => {
  const isSuccess = type === 'success';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Ionicons
            name={isSuccess ? 'checkmark-circle' : 'close-circle'}
            size={65}
            color={isSuccess ? colors.light.primary : colors.light.error}
          />

          <Text style={styles.title}>{title}</Text>

          <Text style={styles.message}>{message}</Text>

          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: isSuccess ? colors.light.primary : colors.light.error,
              },
            ]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>OK</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
};

export default BookingResultModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    backgroundColor: colors.light.white,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 15,
    color: colors.light.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 25,
    lineHeight: 22,
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.light.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
