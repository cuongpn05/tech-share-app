import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { userService } from '../../services/userService';
import { API_BASE_URL } from '../../config/api';
import { Device, User } from '../../types';
import { colors } from '../../theme/colors';

export function OwnerProfileScreen({
  ownerId,
  onBack,
  onMessage,
  onNavigateToDeviceDetail,
}: {
  ownerId: string;
  onBack: () => void;
  onMessage: () => void;
  onNavigateToDeviceDetail?: (deviceId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [owner, setOwner] = useState<(User & { deviceCount: number }) | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadingDevices(true);
    setError(null);
    setOwner(null);
    setDevices([]);
    setAvatarFailed(false);

    if (!/^[a-fA-F0-9]{24}$/.test(ownerId)) {
      setError('Invalid owner ID.');
      setLoading(false);
      setLoadingDevices(false);
      return;
    }

    // 1. Tải thông tin hồ sơ chủ sở hữu
    userService.getOwnerProfile(ownerId)
      .then(data => {
        if (active) setOwner(data);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        const status = (requestError as { response?: { status?: number } })?.response?.status;
        setError(status === 404 ? 'Owner not found.' : 'Unable to load owner profile. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // 2. Tải danh sách các thiết bị thuộc chủ sở hữu này
    userService.getOwnerDevices(ownerId)
      .then(data => {
        if (active && Array.isArray(data)) {
          setDevices(data);
        }
      })
      .catch(() => {
        // Lỗi lấy thiết bị giữ danh sách rỗng
      })
      .finally(() => {
        if (active) setLoadingDevices(false);
      });

    return () => {
      active = false;
    };
  }, [ownerId, retry]);

  const address = typeof owner?.address === 'string' ? owner.address : owner?.address?.fullAddress;
  const avatar = owner?.avatar?.startsWith('/')
    ? API_BASE_URL.replace(/\/api\/?$/, '') + owner.avatar
    : owner?.avatar;

  const stats = [
    { label: 'Devices', icon: 'cube-outline' as const, value: owner?.deviceCount ?? devices.length },
    { label: 'Reviews', icon: 'chatbox-ellipses-outline' as const, value: owner?.totalReviews ?? '—' },
    {
      label: 'Rating',
      icon: 'star' as const,
      value: typeof owner?.rating === 'number' && Number.isFinite(owner.rating) && (owner.totalReviews ?? 0) > 0
        ? `${owner.rating.toFixed(1)} / 5`
        : 'No ratings',
    },
  ];

  async function openDirections() {
    if (!address) return;
    try {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
    } catch {
      Alert.alert('Unable to open maps', 'Please try again.');
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back" onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color={colors.light.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Owner Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} color={colors.light.primary} />
      ) : error ? (
        <View style={styles.panel}>
          <Text style={styles.body}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={() => setRetry(value => value + 1)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : owner ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          {/* Thông tin hồ sơ chính */}
          <View style={styles.profilePanel}>
            <View style={styles.cover} pointerEvents="none">
              <View style={styles.coverWaveLeft} />
              <View style={styles.coverWaveRight} />
            </View>

            <View style={styles.avatarWrap}>
              {avatar && !avatarFailed ? (
                <Image source={{ uri: avatar }} style={styles.avatar} onError={() => setAvatarFailed(true)} />
              ) : (
                <View style={[styles.avatar, styles.placeholder]}>
                  <Ionicons name="person" size={44} color={colors.light.primaryDark} />
                </View>
              )}
              {owner.trust?.isVerified ? (
                <View style={styles.avatarVerified}>
                  <Ionicons name="shield-checkmark" size={27} color={colors.light.primaryHover} />
                </View>
              ) : null}
            </View>

            <Text style={styles.name}>{owner.name}</Text>

            {owner.trust?.isVerified ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={16} color={colors.light.primaryHover} />
                <Text style={styles.verified}>Verified Owner</Text>
              </View>
            ) : null}

            {address ? (
              <View style={styles.address}>
                <Ionicons name="location" size={18} color={colors.light.textMuted} />
                <Text style={styles.body}>{address}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.messageButton}
                onPress={onMessage}
                accessibilityRole="button"
                accessibilityLabel="Message owner"
              >
                <Ionicons name="chatbubble-ellipses" size={18} color={colors.light.white} />
                <Text style={styles.messageText}>Message</Text>
              </TouchableOpacity>

              {address ? (
                <TouchableOpacity
                  style={styles.directionButton}
                  accessibilityRole="button"
                  accessibilityLabel="Get directions on Google Maps"
                  onPress={openDirections}
                >
                  <Ionicons name="navigate" size={18} color={colors.light.primaryDark} />
                  <Text style={styles.directionText}>Directions</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Thống kê hoạt động */}
          <View style={styles.panel}>
            <Text style={styles.heading}>Reputation & Stats</Text>
            {stats.map((stat, index) => (
              <View key={stat.label} style={styles.statRow}>
                <View style={[styles.statIcon, index === 1 && styles.reviewIcon, index === 2 && styles.ratingIcon]}>
                  <Ionicons
                    name={stat.icon}
                    size={20}
                    color={index === 2 ? colors.light.ratingStar : colors.light.primaryHover}
                  />
                </View>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
              </View>
            ))}
          </View>

          {/* Danh sách các thiết bị của chủ sở hữu */}
          <View style={styles.panel}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.heading}>Rental Devices ({devices.length})</Text>
            </View>

            {loadingDevices ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={colors.light.primaryDark} />
                <Text style={styles.mutedText}>Loading devices...</Text>
              </View>
            ) : devices.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="cube-outline" size={36} color={colors.light.textMuted} />
                <Text style={styles.mutedText}>This owner has no devices available for rent.</Text>
              </View>
            ) : (
              <View style={styles.deviceList}>
                {devices.map((device) => {
                  const rate = device.pricePerDay ?? device.dailyRate;
                  const imgUrl = device.images?.[0];
                  const isAvailable = device.status === 'available';

                  return (
                    <TouchableOpacity
                      key={device._id}
                      style={styles.deviceCard}
                      onPress={() => onNavigateToDeviceDetail?.(device._id)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`View details of ${device.name || device.title}`}
                    >
                      {imgUrl ? (
                        <Image source={{ uri: imgUrl }} style={styles.cardThumb} />
                      ) : (
                        <View style={[styles.cardThumb, styles.cardThumbPlaceholder]}>
                          <Ionicons name="cube-outline" size={24} color={colors.light.textMuted} />
                        </View>
                      )}

                      <View style={styles.cardContent}>
                        <View style={styles.cardHeader}>
                          <Text style={styles.cardCategory} numberOfLines={1}>
                            {device.category?.toUpperCase() || 'DEVICE'}
                          </Text>
                          <View style={[styles.statusBadge, isAvailable ? styles.statusAvailable : styles.statusOther]}>
                            <Text style={[styles.statusText, isAvailable ? styles.statusAvailableText : styles.statusOtherText]}>
                              {isAvailable ? 'Available' : (device.status === 'rented' ? 'Rented' : 'Unavailable')}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {device.name || device.title}
                        </Text>

                        <View style={styles.cardFooter}>
                          <Text style={styles.cardPrice}>
                            {typeof rate === 'number' && Number.isFinite(rate)
                              ? `${rate.toLocaleString('en-US')} VND/day`
                              : 'Contact'}
                          </Text>
                          <View style={styles.viewDetailBtn}>
                            <Text style={styles.viewDetailText}>Details</Text>
                            <Ionicons name="chevron-forward" size={14} color={colors.light.primaryDark} />
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.light.surface, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 38 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.light.textPrimary },
  heading: { fontSize: 17, fontWeight: '800', color: colors.light.textPrimary },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  content: { paddingHorizontal: 14, paddingTop: 4, gap: 14 },
  profilePanel: { padding: 16, paddingTop: 22, gap: 12, borderRadius: 20, backgroundColor: colors.light.surface, overflow: 'hidden' },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, backgroundColor: colors.light.primaryLight, overflow: 'hidden' },
  coverWaveLeft: { position: 'absolute', width: 300, height: 130, borderRadius: 150, backgroundColor: colors.light.primaryBg, left: -100, top: 35, transform: [{ rotate: '20deg' }] },
  coverWaveRight: { position: 'absolute', width: 260, height: 100, borderRadius: 130, backgroundColor: colors.light.surface, right: -70, top: -18, transform: [{ rotate: '15deg' }], opacity: 0.6 },
  panel: { padding: 16, gap: 10, borderRadius: 20, backgroundColor: colors.light.surface },
  avatarWrap: { alignSelf: 'center', padding: 4, backgroundColor: colors.light.surface, borderRadius: 58, elevation: 3, shadowColor: colors.light.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarVerified: { position: 'absolute', right: 0, bottom: 2, padding: 2, borderRadius: 12, backgroundColor: colors.light.surface },
  placeholder: { backgroundColor: colors.light.primaryLight, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.light.textPrimary, textAlign: 'center', paddingHorizontal: 8 },
  verifiedBadge: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'center', borderRadius: 20, backgroundColor: colors.light.primaryLight, paddingVertical: 6, paddingHorizontal: 12 },
  verified: { fontSize: 12, fontWeight: '700', color: colors.light.primaryDark },
  body: { fontSize: 13, lineHeight: 20, color: colors.light.textSecondary, flexShrink: 1 },
  address: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', paddingHorizontal: 6 },
  actions: { borderTopWidth: 1, borderTopColor: colors.light.border, paddingTop: 14, flexDirection: 'row', gap: 10 },
  messageButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.light.primaryHover, padding: 12, borderRadius: 10 },
  messageText: { color: colors.light.white, fontSize: 13, fontWeight: '700' },
  directionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.light.borderDefault, padding: 12, borderRadius: 10 },
  directionText: { fontSize: 13, fontWeight: '700', color: colors.light.primaryDark },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, backgroundColor: colors.light.background },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.primaryLight },
  reviewIcon: { backgroundColor: '#EAF4FD' },
  ratingIcon: { backgroundColor: colors.light.warningLight },
  statLabel: { flex: 1, fontSize: 13, color: colors.light.textSecondary },
  statValue: { fontSize: 14, fontWeight: '800', color: colors.light.textPrimary, flexShrink: 1 },
  loading: { marginTop: 40 },
  loadingBox: { paddingVertical: 24, alignItems: 'center', gap: 8 },
  emptyBox: { paddingVertical: 28, alignItems: 'center', gap: 8 },
  mutedText: { fontSize: 13, color: colors.light.textSecondary, textAlign: 'center' },
  retry: { padding: 12, borderRadius: 10, backgroundColor: colors.light.primary, alignItems: 'center' },
  retryText: { color: colors.light.white, fontWeight: '600' },

  /* Device card styles */
  deviceList: { gap: 10 },
  deviceCard: { flexDirection: 'row', gap: 12, padding: 10, borderRadius: 14, backgroundColor: colors.light.background, borderWidth: 1, borderColor: colors.light.borderDefault },
  cardThumb: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#E2E8F0' },
  cardThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1, justifyContent: 'space-between' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardCategory: { fontSize: 10, fontWeight: '700', color: colors.light.textSecondary, letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusAvailable: { backgroundColor: '#DCFCE7' },
  statusOther: { backgroundColor: '#F1F5F9' },
  statusText: { fontSize: 10, fontWeight: '700' },
  statusAvailableText: { color: '#166534' },
  statusOtherText: { color: colors.light.textSecondary },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.light.textPrimary, lineHeight: 19 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardPrice: { fontSize: 13, fontWeight: '800', color: colors.light.primaryDark },
  viewDetailBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewDetailText: { fontSize: 12, fontWeight: '700', color: colors.light.primaryDark },
});
