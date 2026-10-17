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
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập để gửi hình ảnh.');
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
      Alert.alert('Lỗi', err.message || 'Không thể chọn hình ảnh');
    }
  };

  const handleShareLocation = async () => {
    setShowActionModal(false);
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền vị trí', 'Vui lòng cấp quyền vị trí để chia sẻ tọa độ hiện tại.');
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
      Alert.alert('Lỗi', 'Không thể lấy vị trí hiện tại');
    } finally {
      setIsLocating(false);
    }
  };

  const canSend = Boolean(inputText.trim()) && !isSending;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {/* Nút dấu cộng mở Modal đính kèm */}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => setShowActionModal(true)}
        disabled={isSending || isLocating}
        activeOpacity={0.7}
      >
        {isLocating ? (
          <ActivityIndicator size="small" color={theme.colors.brand[500]} />
        ) : (
          <Ionicons name="add" size={22} color="#475569" />
        )}
      </TouchableOpacity>

      {/* Ô nhập tin nhắn */}
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.textInput}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor="#94A3B8"
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
      </View>

      {/* Nút gửi */}
      <TouchableOpacity
        style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
        onPress={handleSend}
        disabled={!canSend}
        activeOpacity={0.8}
      >
        {isSending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name="send" size={16} color="#FFFFFF" />
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
            <Text style={styles.modalTitle}>Tùy chọn đính kèm</Text>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => handlePickImage(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="images-outline" size={22} color={theme.colors.brand[500]} />
              <Text style={styles.optionText}>Chọn ảnh từ thư viện</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => handlePickImage(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={22} color="#D97706" />
              <Text style={styles.optionText}>Chụp ảnh mới</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={handleShareLocation}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={22} color="#16A34A" />
              <Text style={styles.optionText}>Chia sẻ vị trí hiện tại</Text>
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
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 40,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14.5,
    color: '#0F172A',
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
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
    color: '#1E293B',
  },
});

export default ChatInputBar;
