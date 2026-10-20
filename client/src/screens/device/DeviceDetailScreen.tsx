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
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setDevice(null);
    setError(null);
    setNotFound(false);
    setSelectedImage(0);
    setFailedImages([]);
    setAvatarFailed(false);
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
        <View style={styles.headerSpacer} />
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
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
              {device.brand ? <View style={styles.brandBadge}>
                <Text style={styles.brandText} numberOfLines={1}>{device.brand}</Text>
              </View> : null}
            {images.length > 1 && (
              <View style={styles.photos}>
                {images.map((_, index) => (
                  <TouchableOpacity key={index} onPress={() => setSelectedImage(index)} accessibilityRole="button"
                    accessibilityLabel={`View photo ${index + 1}`} accessibilityState={{ selected: index === selectedImage }}
                    style={styles.photoButton} hitSlop={8}>
                    <View style={[styles.photoDot, index === selectedImage && styles.photoSelected]} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            </View>
            <View style={styles.section}>
              <Text style={styles.title}>{device.name || device.title || 'Name unavailable'}</Text>
              <View style={styles.summaryRow}>
                <View style={styles.badges}>
                  {device.category ? <View style={styles.badge}>
                    <Ionicons name={device.category === 'camera' ? 'camera-outline' : 'hardware-chip-outline'}
                      size={13} color={colors.light.primaryDark} />
                    <Text style={styles.badgeText}>{device.category}</Text>
                  </View> : null}
                  <View style={[styles.badge, device.status === 'available' && styles.availableBadge]}>
                    <Ionicons name={device.status === 'available' ? 'checkmark-circle' : 'time-outline'}
                      size={13} color={device.status === 'available' ? colors.light.success : colors.light.textSecondary} />
                    <Text style={styles.badgeText}>{device.status || 'Status unavailable'}</Text>
                  </View>
                </View>
                <Text style={styles.price}>{hasPrice ? `${price.toLocaleString('en-US')} VND / day` : 'Price unavailable'}</Text>
              </View>
              {typeof address === 'string' && address.trim() ? <View style={styles.addressRow}>
                <Ionicons name="location" size={14} color={colors.light.textMuted} />
                <Text style={styles.addressText}>{address}</Text>
              </View> : null}
            </View>
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <View style={styles.sectionIcon}><Ionicons name="document-text-outline" size={17} color={colors.light.primaryDark} /></View>
                <Text style={styles.sectionTitle}>Description</Text>
              </View>
              <Text style={styles.body}>{typeof device.description === 'string' && device.description.trim()
                ? device.description : 'No description available.'}</Text>
            </View>
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <View style={styles.sectionIcon}><Ionicons name="settings-outline" size={17} color={colors.light.primaryDark} /></View>
                <Text style={styles.sectionTitle}>Technical Specifications</Text>
              </View>
              {specs.length ? specs.map((row, index) => (
                <View key={index} style={styles.specRow}>
                  <Text style={styles.specLabel}>{row.label}</Text>
                  <Text style={styles.specValue}>{row.value}</Text>
                </View>
              )) : <Text style={styles.muted}>No specifications available.</Text>}
            </View>
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <View style={styles.sectionIcon}><Ionicons name="person-outline" size={17} color={colors.light.primaryDark} /></View>
                <Text style={styles.sectionTitle}>Owner</Text>
              </View>
              {owner && typeof owner.name === 'string' && owner.name.trim() ? (
                <View style={styles.ownerRow}>
                  {typeof owner.avatar === 'string' && owner.avatar.trim() && !avatarFailed ? (
                    <Image source={{ uri: imageUri(owner.avatar) }} style={styles.avatar} onError={() => setAvatarFailed(true)} />
                  ) : <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={22} color={colors.light.primaryDark} />
                  </View>}
                  <View style={styles.ownerInfo}>
                    <Text style={styles.ownerName}>{owner.name}</Text>
                    {typeof ownerAddress === 'string' && ownerAddress.trim() ? <View style={styles.addressRow}>
                      <Ionicons name="location" size={12} color={colors.light.textMuted} />
                      <Text style={styles.addressText}>{ownerAddress}</Text>
                    </View> : null}
                  </View>
                </View>
              ) : <Text style={styles.muted}>Owner information unavailable.</Text>}
            </View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity style={[styles.button, !canRent && styles.disabled]} disabled={!canRent}
              accessibilityRole="button" accessibilityLabel="Rent device" accessibilityState={{ disabled: !canRent }}
              onPress={() => onRent(device._id)}>
              <Ionicons name="calendar-outline" size={18} color={colors.light.white} />
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.light.surface, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 32 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.light.textPrimary },
  content: { paddingHorizontal: 10, paddingBottom: 12, gap: 8 },
  state: { flex: 1, padding: 24, gap: 16, alignItems: 'center', justifyContent: 'center' },
  album: { borderRadius: 16, backgroundColor: colors.light.border, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 1.85 },
  placeholder: { width: '100%', aspectRatio: 1.85, alignItems: 'center', justifyContent: 'center', gap: 8 },
  brandBadge: { position: 'absolute', top: 12, left: 12, maxWidth: '70%', paddingHorizontal: 12,
    paddingVertical: 5, backgroundColor: colors.light.surface, borderRadius: 14 },
  brandText: { fontSize: 11, fontWeight: '700', color: colors.light.textPrimary },
  photos: { position: 'absolute', bottom: 8, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  photoButton: { padding: 4 },
  photoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.light.textMuted },
  photoSelected: { backgroundColor: colors.light.primaryHover },
  section: { padding: 12, gap: 8, borderRadius: 16, backgroundColor: colors.light.surface },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: colors.light.textPrimary },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.primaryLight },
  sectionTitle: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.light.textPrimary },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.light.primaryLight,
    paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8 },
  availableBadge: { backgroundColor: colors.light.successLight },
  badgeText: { fontSize: 10, textTransform: 'capitalize', color: colors.light.primaryDark },
  price: { flexShrink: 1, fontSize: 16, fontWeight: '800', color: colors.light.primaryHover },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  addressText: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 16, color: colors.light.textSecondary },
  body: { fontSize: 12, lineHeight: 18, color: colors.light.textSecondary },
  muted: { fontSize: 12, lineHeight: 18, color: colors.light.textSecondary },
  specRow: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.light.border },
  specLabel: { flex: 1, fontSize: 11, lineHeight: 17, color: colors.light.textSecondary },
  specValue: { flex: 1.2, fontSize: 11, lineHeight: 17, color: colors.light.textPrimary },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.primaryLight },
  ownerInfo: { flex: 1, minWidth: 0, gap: 4 },
  ownerName: { fontSize: 12, lineHeight: 17, fontWeight: '700', color: colors.light.textPrimary },
  footer: { paddingHorizontal: 12, paddingTop: 8, backgroundColor: colors.light.surface, borderTopWidth: 1, borderColor: colors.light.border },
  button: { flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: colors.light.primaryHover,
    borderRadius: 12, padding: 14, alignItems: 'center' },
  buttonText: { color: colors.light.white, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
