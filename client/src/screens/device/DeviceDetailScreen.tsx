import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deviceService } from '../../services/deviceService';
import { API_BASE_URL } from '../../config/api';
import { Device } from '../../types';
import { colors } from '../../theme/colors';

interface DeviceDetailScreenProps {
  deviceId: string;
  onBack: () => void;
  onRent: (deviceId: string) => void;
}

function specLabel(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().split(/\s+/);
  return words.map(word => ['cpu', 'gpu', 'ram', 'ssd', 'usb', 'os'].includes(word.toLowerCase())
    ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function specValue(value: unknown): string {
  if (typeof value === 'string') {
    const text = value.trim();
    return ['null', 'undefined', '[object object]'].includes(text.toLowerCase()) ? '' : text;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return '';
}

function imageUri(value: string): string {
  return value.startsWith('/') ? API_BASE_URL.replace(/\/api\/?$/, '') + value : value;
}

export function DeviceDetailScreen({ deviceId, onBack, onRent }: DeviceDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedImage, setSelectedImage] = useState(0);
  const [failedImages, setFailedImages] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    setDevice(null);
    setError(null);
    setNotFound(false);
    setSelectedImage(0);
    setFailedImages([]);
    setLoading(true);
    if (!/^[a-fA-F0-9]{24}$/.test(deviceId)) {
      setError('Invalid device ID.');
      setLoading(false);
      return;
    }
    deviceService.getDeviceById(deviceId, { throwOnError: true })
      .then(data => {
        if (!active) return;
        if (data) setDevice(data);
        else setNotFound(true);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        const status = (requestError as { response?: { status?: number } })?.response?.status;
        if (status === 404) setNotFound(true);
        else setError(status === 400 ? 'Invalid device ID.' : 'Unable to load this device. Please try again.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [deviceId, retry]);

  const images = Array.isArray(device?.images)
    ? device.images.filter((value): value is string => typeof value === 'string' && !!value.trim()).map(value => imageUri(value.trim()))
    : [];
  const currentImage = images[selectedImage];
  const specs = device?.specs && typeof device.specs === 'object' && !Array.isArray(device.specs)
    ? Object.entries(device.specs).map(([key, value]) => ({ label: specLabel(key), value: specValue(value) }))
      .filter(row => row.label && row.value) : [];
  const ownerValue = device?.ownerId ?? device?.owner;
  const owner = ownerValue && typeof ownerValue === 'object' ? ownerValue : null;
  const ownerAddress = typeof owner?.address === 'string' ? owner.address : owner?.address?.fullAddress;
  const price = device?.pricePerDay ?? device?.dailyRate;
  const hasPrice = typeof price === 'number' && Number.isFinite(price) && price >= 0;
  const canRent = device?.status === 'available' && hasPrice;
  const address = device?.location?.addressText || device?.location?.address || device?.addressText;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.light.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Device details</Text>
      </View>
      {loading ? (
        <View style={styles.state}><ActivityIndicator color={colors.light.primary} /><Text>Loading device...</Text></View>
      ) : error || notFound || !device ? (
        <View style={styles.state}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.light.textSecondary} />
          <Text style={styles.title}>{notFound ? 'Device not found' : error || 'Device not found'}</Text>
          {error && !error.includes('Invalid') && (
            <TouchableOpacity style={styles.button} onPress={() => setRetry(value => value + 1)} accessibilityRole="button">
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.album}>
              {currentImage && !failedImages.includes(currentImage) ? (
                <Image source={{ uri: currentImage }} style={styles.image} resizeMode="contain"
                  accessibilityLabel={`Device photo ${selectedImage + 1}`}
                  onError={() => setFailedImages(previous => [...previous, currentImage])} />
              ) : (
                <View style={styles.placeholder}>
                  <Ionicons name="image-outline" size={48} color={colors.light.textSecondary} />
                  <Text style={styles.muted}>Image unavailable</Text>
                </View>
              )}
            </View>
            {images.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
                {images.map((_, index) => (
                  <TouchableOpacity key={index} onPress={() => setSelectedImage(index)} accessibilityRole="button"
                    accessibilityLabel={`View photo ${index + 1}`} accessibilityState={{ selected: index === selectedImage }}
                    style={[styles.photoButton, index === selectedImage && styles.photoSelected]}>
                    <Text style={styles.muted}>Photo {index + 1}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.section}>
              <Text style={styles.title}>{device.name || device.title || 'Name unavailable'}</Text>
              <View style={styles.badges}>
                {device.category ? <Text style={styles.badge}>{device.category}</Text> : null}
                <Text style={styles.badge}>{device.status || 'Status unavailable'}</Text>
              </View>
              <Text style={styles.price}>{hasPrice ? `${price.toLocaleString('en-US')} VND / day` : 'Price unavailable'}</Text>
              {typeof address === 'string' && address.trim() ? <Text style={styles.muted}>{address}</Text> : null}
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.body}>{typeof device.description === 'string' && device.description.trim()
                ? device.description : 'No description available.'}</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Technical Specifications</Text>
              {specs.length ? specs.map((row, index) => (
                <View key={index} style={styles.specRow}>
                  <Text style={styles.specLabel}>{row.label}</Text>
                  <Text style={styles.specValue}>{row.value}</Text>
                </View>
              )) : <Text style={styles.muted}>No specifications available.</Text>}
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Owner</Text>
              {owner && typeof owner.name === 'string' && owner.name.trim() ? (
                <>
                  <Text style={styles.body}>{owner.name}</Text>
                  {typeof ownerAddress === 'string' && ownerAddress.trim() ? <Text style={styles.muted}>{ownerAddress}</Text> : null}
                </>
              ) : <Text style={styles.muted}>Owner information unavailable.</Text>}
            </View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity style={[styles.button, !canRent && styles.disabled]} disabled={!canRent}
              accessibilityRole="button" accessibilityLabel="Rent device" accessibilityState={{ disabled: !canRent }}
              onPress={() => onRent(device._id)}>
              <Text style={styles.buttonText}>{canRent ? 'Rent device' : 'Currently unavailable'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  back: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.light.textPrimary },
  content: { padding: 16, gap: 16, paddingBottom: 24 },
  state: { flex: 1, padding: 24, gap: 16, alignItems: 'center', justifyContent: 'center' },
  album: { borderRadius: 16, backgroundColor: colors.light.surface, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 4 / 3 },
  placeholder: { width: '100%', aspectRatio: 4 / 3, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photos: { gap: 8 },
  photoButton: { padding: 10, borderWidth: 1, borderColor: colors.light.border, borderRadius: 8 },
  photoSelected: { borderColor: colors.light.primary, backgroundColor: colors.light.primaryLight },
  section: { padding: 16, gap: 12, borderRadius: 16, backgroundColor: colors.light.surface },
  title: { fontSize: 22, fontWeight: '700', color: colors.light.textPrimary },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.light.textPrimary },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { color: colors.light.primary, backgroundColor: colors.light.primaryLight, padding: 8, borderRadius: 8 },
  price: { fontSize: 21, fontWeight: '700', color: colors.light.primary },
  body: { fontSize: 15, lineHeight: 23, color: colors.light.textPrimary },
  muted: { fontSize: 14, lineHeight: 21, color: colors.light.textSecondary },
  specRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.light.border },
  specLabel: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.light.textSecondary },
  specValue: { flex: 1.4, fontSize: 14, lineHeight: 21, color: colors.light.textPrimary },
  footer: { padding: 16, backgroundColor: colors.light.surface, borderTopWidth: 1, borderColor: colors.light.border },
  button: { backgroundColor: colors.light.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonText: { color: colors.light.white, fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
