import React, { useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../theme/colors';

const MAX_IMAGES = 8;

type ImageUploadGridProps = {
  images: string[];
  onChangeImages: (images: string[]) => void;
};

export function ImageUploadGrid({ images, onChangeImages }: ImageUploadGridProps) {
  const [isPickingImage, setIsPickingImage] = useState(false);

  const takePhoto = async () => {
    try {
      setIsPickingImage(true);
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission required', 'Allow camera access in your device settings to take a photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        onChangeImages([...images, result.assets[0].uri]);
      }
    } catch (error: unknown) {
      console.error('[ImageUploadGrid] Cannot take photo:', error);
      Alert.alert('Camera error', error instanceof Error ? error.message : 'Could not open the camera.');
    } finally {
      setIsPickingImage(false);
    }
  };

  const pickFromGallery = async () => {
    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) return;

    try {
      setIsPickingImage(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Gallery permission required', 'Allow photo library access in your device settings to choose photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });
      if (!result.canceled) {
        const selected = result.assets.slice(0, remainingSlots).map((asset) => asset.uri);
        if (selected.length) onChangeImages([...images, ...selected]);
      }
    } catch (error: unknown) {
      console.error('[ImageUploadGrid] Cannot select photos:', error);
      Alert.alert('Gallery error', error instanceof Error ? error.message : 'Could not open the photo library.');
    } finally {
      setIsPickingImage(false);
    }
  };

  const showPickerOptions = () => {
    if (images.length >= MAX_IMAGES || isPickingImage) return;
    Alert.alert('Add device photos', 'Choose where to get your photo.', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Gallery', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.helpText}>Add up to {MAX_IMAGES} photos</Text>
        <Text style={styles.imageCount}>{images.length}/{MAX_IMAGES}</Text>
      </View>
      <View style={styles.grid}>
        {images.map((uri, index) => (
          <View key={`${uri}-${index}`} style={styles.imageTile}>
            <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              style={styles.removeButton}
              onPress={() => onChangeImages(images.filter((image) => image !== uri))}
            >
              <Ionicons name="close" size={16} color={colors.light.white} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.addButton, (images.length >= MAX_IMAGES || isPickingImage) && styles.disabled]}
          onPress={showPickerOptions}
          disabled={images.length >= MAX_IMAGES || isPickingImage}
          activeOpacity={0.75}
        >
          <Ionicons
            name={isPickingImage ? 'hourglass-outline' : 'add'}
            size={28}
            color={images.length < MAX_IMAGES ? colors.light.primary : colors.light.textMuted}
          />
          <Text style={styles.addButtonText}>{isPickingImage ? 'Loading' : 'Add image'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  helpText: { color: colors.light.textSecondary, fontSize: 12 },
  imageCount: { color: colors.light.textPrimary, fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageTile: { width: '31.5%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.light.background },
  preview: { width: '100%', height: '100%' },
  removeButton: {
    position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  addButton: {
    width: '31.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.light.primary,
    borderRadius: 12, backgroundColor: colors.light.primaryBg,
  },
  disabled: { borderColor: colors.light.borderDefault, backgroundColor: colors.light.background },
  addButtonText: { marginTop: 4, color: colors.light.textSecondary, fontSize: 11, fontWeight: '600' },
});
