import React, { useEffect, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../theme/tokens';
import { STRINGS } from '../../constants/strings';

export interface ImageSourcePickerOptions {
  title: string;
  description: string;
  aspect: [number, number];
  cameraType?: ImagePicker.CameraType;
  quality?: number;
  cropShape?: ImagePicker.CropShape;
  onSelected: (uri: string) => void;
}

/**
 * Modal chọn nguồn ảnh (Chụp ảnh mới / Chọn từ thư viện) đồng bộ chuẩn Soft-UI
 * dùng chung cho eKYC và đổi Avatar trong Profile.
 */
export function ImageSourcePickerModal({
  options,
  onClose,
  onError,
}: {
  options: ImageSourcePickerOptions | null;
  onClose: () => void;
  onError: (title: string, message: string) => void;
}) {
  const launchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (launchTimerRef.current) {
        clearTimeout(launchTimerRef.current);
      }
    };
  }, []);

  const launchCamera = async (opts: ImageSourcePickerOptions) => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        onError(STRINGS.EKYC.PERMISSION_TITLE, STRINGS.EKYC.CAMERA_PERMISSION_MSG);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: opts.aspect,
        shape: opts.cropShape,
        quality: opts.quality ?? 0.5,
        exif: false,
        base64: false,
        cameraType: opts.cameraType ?? ImagePicker.CameraType.back,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        opts.onSelected(result.assets[0].uri);
      }
    } catch (err: any) {
      onError(
        STRINGS.COMMON.ERROR,
        STRINGS.EKYC.CAMERA_ERROR_PREFIX + (err.message || STRINGS.EKYC.UNKNOWN_ERROR)
      );
    }
  };

  const launchGallery = async (opts: ImageSourcePickerOptions) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        onError(STRINGS.EKYC.PERMISSION_TITLE, STRINGS.EKYC.GALLERY_PERMISSION_MSG);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: opts.aspect,
        shape: opts.cropShape,
        quality: opts.quality ?? 0.5,
        exif: false,
        base64: false,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        opts.onSelected(result.assets[0].uri);
      }
    } catch (err: any) {
      onError(
        STRINGS.COMMON.ERROR,
        STRINGS.EKYC.GALLERY_ERROR_PREFIX + (err.message || STRINGS.EKYC.UNKNOWN_ERROR)
      );
    }
  };

  const handleSelectSource = (source: 'camera' | 'gallery') => {
    if (!options) return;
    const currentOptions = options;
    onClose();

    if (launchTimerRef.current) {
      clearTimeout(launchTimerRef.current);
    }
    // Đợi modal đóng hoàn toàn rồi mới bật Camera/Thư viện ảnh để tránh xung đột native controller trên iOS
    launchTimerRef.current = setTimeout(() => {
      if (source === 'camera') {
        launchCamera(currentOptions);
      } else {
        launchGallery(currentOptions);
      }
    }, 180);
  };

  return (
    <Modal
      visible={Boolean(options)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={styles.card} accessibilityRole="alert">
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color={theme.colors.text.muted} />
          </TouchableOpacity>

          <View style={styles.iconOuterRing}>
            <View style={styles.iconInnerCircle}>
              <Ionicons name="camera-outline" size={26} color={theme.colors.white} />
            </View>
          </View>

          <Text style={styles.title}>{options?.title || ''}</Text>
          <Text style={styles.subtitle}>{options?.description || ''}</Text>

          <View style={styles.optionsList}>
            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => handleSelectSource('camera')}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <View style={styles.optionIconWrap}>
                <Ionicons name="camera-outline" size={20} color={theme.colors.brand[600]} />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>{STRINGS.EKYC.TAKE_PHOTO}</Text>
                <Text style={styles.optionDesc}>{STRINGS.EKYC.TAKE_PHOTO_DESC}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.text.subtle} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => handleSelectSource('gallery')}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <View style={styles.optionIconWrap}>
                <Ionicons name="images-outline" size={20} color={theme.colors.brand[600]} />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>{STRINGS.EKYC.CHOOSE_FROM_GALLERY}</Text>
                <Text style={styles.optionDesc}>{STRINGS.EKYC.CHOOSE_FROM_GALLERY_DESC}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.text.subtle} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={styles.cancelBtnText}>{STRINGS.COMMON.CANCEL}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii['2xl'],
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.divider,
    ...theme.shadows.cardHover,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  iconOuterRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.brand[100],
    borderWidth: 3,
    borderColor: theme.colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconInnerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  optionsList: {
    width: '100%',
    gap: 10,
    marginBottom: 14,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.brand[50],
    borderWidth: 1,
    borderColor: theme.colors.brand[100],
    borderRadius: theme.radii.lg,
    padding: 13,
    gap: 12,
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  optionDesc: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  cancelBtn: {
    width: '100%',
    height: 46,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: theme.colors.text.secondary,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default ImageSourcePickerModal;

