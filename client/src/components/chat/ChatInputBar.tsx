import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Text,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { theme } from '../../theme/tokens';
import { LocationData } from '../../types';

interface ChatInputBarProps {
  onSendText: (text: string) => void;
  onSendImage: (uri: string, fileName?: string, mimeType?: string) => void;
  onSendLocation: (location: LocationData) => void;
  isSending?: boolean;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSendText,
  onSendImage,
  onSendLocation,
  isSending = false,
}) => {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [showActionModal, setShowActionModal] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const isSubmittingRef = useRef(false);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setInputText('');
    try {
      onSendText(trimmed);
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 500);
    }
  };

  const handlePickImage = async (fromCamera = false) => {
    setShowActionModal(false);
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permissions Required', 'Please grant permissions to send images.');
        return;
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
          });

      if (!result.canceled && result.assets[0]?.uri) {
        const asset = result.assets[0];
        onSendImage(
          asset.uri,
          asset.fileName || `chat-${Date.now()}.jpg`,
          asset.mimeType || 'image/jpeg'
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to pick image');
    }
  };

  const handleShareLocation = async () => {
    setShowActionModal(false);
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission', 'Please grant location permission to share your current location.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      let address = '';

      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocode?.[0]) {
          const g = geocode[0];
          address = [g.name, g.street, g.subregion || g.district, g.city]
            .filter(Boolean)
            .join(', ');
        }
      } catch {}

      onSendLocation({ latitude, longitude, address });
    } catch (err: any) {
      Alert.alert('Error', 'Failed to get current location');
    } finally {
      setIsLocating(false);
    }
  };

  const canSend = Boolean(inputText.trim()) && !isSending;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {/* Plus button to open action sheet */}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => setShowActionModal(true)}
        disabled={isSending || isLocating}
        activeOpacity={0.7}
      >
        {isLocating ? (
          <ActivityIndicator size="small" color={theme.colors.brand[500]} />
        ) : (
          <Ionicons name="add" size={22} color={theme.colors.text.secondary} />
        )}
      </TouchableOpacity>

      {/* Input box */}
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor={theme.colors.text.subtle}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
      </View>

      {/* Send button */}
      <TouchableOpacity
        style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
        onPress={handleSend}
        disabled={!canSend}
        activeOpacity={0.8}
      >
        {isSending ? (
          <ActivityIndicator size="small" color={theme.colors.white} />
        ) : (
          <Ionicons name="send" size={16} color={theme.colors.white} />
        )}
      </TouchableOpacity>

      {/* Action Sheet Modal */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowActionModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Attachment Options</Text>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => handlePickImage(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="images-outline" size={22} color={theme.colors.brand[500]} />
              <Text style={styles.optionText}>Photo Library</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => handlePickImage(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={22} color={theme.colors.warning} />
              <Text style={styles.optionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={handleShareLocation}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={22} color={theme.colors.success} />
              <Text style={styles.optionText}>Share Current Location</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
    gap: 8,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 40,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14.5,
    color: theme.colors.text.primary,
    maxHeight: 90,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
});

export default ChatInputBar;
