import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '../../store';
import { theme } from '../../constants/theme';
import { STRINGS } from '../../constants/strings';
import { API_BASE_URL } from '../../config/api';
import { deviceService } from '../../services/deviceService';
import { devicePostService } from '../../services/devicePostService';
import { DeviceStatusToggle } from '../../components/device/DeviceStatusToggle';
import { OwnerAvailabilityModal } from '../../components/OwnerAvailabilityModal';
import type {
  BlockedDate,
  Device,
  ManagedDeviceStatus,
} from '../../types';

const FALLBACK_DEVICE_IMAGE =
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600';

const resolveImageUri = (image?: string) => {
  if (!image?.trim()) return FALLBACK_DEVICE_IMAGE;
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith('/')) {
    const origin = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${origin}${image}`;
  }
  return image;
};

interface MyDevicesScreenProps {
  onBack: () => void;
}

export function MyDevicesScreen({ onBack }: MyDevicesScreenProps) {
  const insets = useSafeAreaInsets();
  const token = useAppSelector((state) => state.auth.token);
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20,
  );
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [updatingDeviceId, setUpdatingDeviceId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const loadDevices = useCallback(async () => {
    if (!token) {
      setDevices([]);
      setLoadError(STRINGS.MY_DEVICES.ERROR_DEFAULT);
      return;
    }
    setIsLoading(true);
    setLoadError('');
    try {
      setDevices(await devicePostService.getMyDevices(token));
    } catch (error) {
      console.error('[MyDevicesScreen] Could not load owner devices:', error);
      setLoadError(STRINGS.MY_DEVICES.ERROR_DEFAULT);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadDevices();
    }, [loadDevices]),
  );

  const handleStatusChange = async (
    deviceId: string,
    newStatus: ManagedDeviceStatus,
  ) => {
    if (!token) {
      Alert.alert(
        STRINGS.MY_DEVICES.ERROR_TITLE,
        STRINGS.MY_DEVICES.ERROR_DEFAULT,
      );
      return;
    }
    setUpdatingDeviceId(deviceId);
    try {
      await deviceService.updateDeviceStatus(token, deviceId, newStatus);
      setDevices((current) =>
        current.map((device) =>
          device._id === deviceId ? { ...device, status: newStatus } : device,
        ),
      );
    } catch (error) {
      console.error('[MyDevicesScreen] Could not update device status:', error);
      Alert.alert(
        STRINGS.COMMON.ERROR,
        STRINGS.OWNER_DASHBOARD.DEVICE_STATUS_UPDATE_ERROR,
      );
    } finally {
      setUpdatingDeviceId(null);
    }
  };

  const handleUpdateBlockedDates = async (
    deviceId: string,
    blockedDates: BlockedDate[],
  ) => {
    if (!token) throw new Error('Authentication is required to update availability.');
    await deviceService.updateBlockDate(token, deviceId, blockedDates);
  };

  const openAvailability = (device: Device) => {
    setSelectedDevice(device);
    setModalVisible(true);
  };

  const renderDevice = ({ item }: { item: Device }) => (
    <View style={styles.card}>
      <Image
        source={{ uri: resolveImageUri(item.images[0]) }}
        style={styles.deviceImage}
        resizeMode="cover"
        accessibilityLabel={item.title}
        onError={() =>
          console.warn('[MyDevicesScreen] Device image failed to load', item._id)
        }
      />
      <View style={styles.cardContent}>
        <Text style={styles.deviceTitle}>{item.title}</Text>
        <Text style={styles.category}>{item.category}</Text>
        <Text style={styles.price}>
          {item.dailyRate.toLocaleString('vi-VN')} {STRINGS.COMMON.CURRENCY_SUFFIX}
          <Text style={styles.priceUnit}>{STRINGS.MY_DEVICES.PRICE_UNIT}</Text>
        </Text>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.viewsCount ?? 0}</Text>
            <Text style={styles.statLabel}>{STRINGS.MY_DEVICES.RENTALS_LABEL}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.ratingValue}>
              <Ionicons name="star" size={18} color={theme.warning} />
              <Text style={styles.statValue}>{item.rating}</Text>
            </View>
            <Text style={styles.statLabel}>{STRINGS.MY_DEVICES.RATING_LABEL}</Text>
          </View>
        </View>

        <Text style={styles.statusLabel}>
          {STRINGS.MY_DEVICES.DEVICE_STATUS_LABEL}
        </Text>
        {item.status === 'rented' ? (
          <Text style={styles.rentedStatus}>
            {STRINGS.OWNER_DASHBOARD.FLEET_STATUS_RENTED}
          </Text>
        ) : (
          <DeviceStatusToggle
            status={item.status}
            disabled={updatingDeviceId !== null}
            onChange={(status) => handleStatusChange(item._id, status)}
          />
        )}
        <TouchableOpacity
          onPress={() => openAvailability(item)}
          style={styles.availabilityButton}
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={18} color={theme.primary} />
          <Text style={styles.availabilityButtonText}>
            {STRINGS.MY_DEVICES.MANAGE_AVAILABILITY}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset + theme.spacing.sm }]}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={STRINGS.MY_DEVICES.BACK_ACCESSIBILITY_LABEL}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.heading}>
          <Text style={styles.title} accessibilityRole="header">
            {STRINGS.MY_DEVICES.TITLE}
          </Text>
          <Text style={styles.subtitle}>{STRINGS.MY_DEVICES.SUBTITLE}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.feedbackState} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.emptyDescription}>{STRINGS.MY_DEVICES.LOADING}</Text>
        </View>
      ) : loadError ? (
        <View style={styles.feedbackState} accessibilityRole="alert">
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={theme.danger}
          />
          <Text style={styles.emptyTitle}>{STRINGS.MY_DEVICES.ERROR_TITLE}</Text>
          <Text style={styles.errorDescription}>{loadError}</Text>
          <TouchableOpacity
            onPress={loadDevices}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>{STRINGS.COMMON.RETRY}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(device) => device._id}
          contentContainerStyle={[
            styles.listContent,
            devices.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={renderDevice}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name="cube-outline"
                size={48}
                color={theme.textSecondary}
              />
              <Text style={styles.emptyTitle}>{STRINGS.MY_DEVICES.EMPTY_TITLE}</Text>
              <Text style={styles.emptyDescription}>
                {STRINGS.MY_DEVICES.EMPTY_DESC}
              </Text>
            </View>
          }
        />
      )}

      <OwnerAvailabilityModal
        visible={modalVisible}
        deviceName={selectedDevice?.title ?? ''}
        deviceId={selectedDevice?._id ?? ''}
        onClose={() => setModalVisible(false)}
        onUpdateBlockedDates={handleUpdateBlockedDates}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm + 4,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { flex: 1 },
  title: {
    fontSize: theme.typography.sizes.h2 + 4,
    fontWeight: theme.typography.weights.bold,
    color: theme.textPrimary,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.textSecondary,
    marginTop: theme.spacing.xs,
  },
  listContent: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.background,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: theme.spacing.md,
    ...theme.shadows.card,
  },
  deviceImage: {
    width: '100%',
    aspectRatio: 1.8,
    maxHeight: 300,
    backgroundColor: theme.border,
    borderTopLeftRadius: theme.radii.lg - 1,
    borderTopRightRadius: theme.radii.lg - 1,
  },
  cardContent: { padding: theme.spacing.md },
  deviceTitle: {
    fontSize: theme.typography.sizes.title + 2,
    fontWeight: theme.typography.weights.bold,
    color: theme.textPrimary,
  },
  category: {
    fontSize: theme.typography.sizes.body,
    color: theme.textSecondary,
    marginTop: theme.spacing.xs,
    textTransform: 'capitalize',
  },
  price: {
    fontSize: theme.typography.sizes.title + 2,
    fontWeight: theme.typography.weights.bold,
    color: theme.primary,
    marginTop: theme.spacing.md,
  },
  priceUnit: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.normal,
    color: theme.textSecondary,
  },
  stats: {
    flexDirection: 'row',
    paddingVertical: theme.spacing.md,
    marginVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.border,
  },
  statItem: { flex: 1, alignItems: 'center', gap: theme.spacing.xs },
  statValue: {
    fontSize: theme.typography.sizes.title + 2,
    fontWeight: theme.typography.weights.bold,
    color: theme.textPrimary,
  },
  statLabel: { fontSize: theme.typography.sizes.bodySm, color: theme.textSecondary },
  statDivider: { width: 1, backgroundColor: theme.border },
  ratingValue: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  statusLabel: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  rentedStatus: {
    minHeight: 48,
    textAlignVertical: 'center',
    color: theme.textSecondary,
    fontWeight: theme.typography.weights.semibold,
  },
  availabilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  availabilityButtonText: {
    color: theme.primary,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
  },
  emptyList: { flexGrow: 1 },
  feedbackState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  errorDescription: {
    fontSize: theme.typography.sizes.base,
    color: theme.danger,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.title + 2,
    fontWeight: theme.typography.weights.bold,
    color: theme.textPrimary,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: theme.typography.sizes.base,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.primary,
    borderRadius: theme.radii.md,
  },
  retryText: {
    color: theme.white,
    fontWeight: theme.typography.weights.bold,
  },
});
