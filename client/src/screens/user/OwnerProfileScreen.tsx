import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { userService } from '../../services/userService';
import { API_BASE_URL } from '../../config/api';
import { User } from '../../types';
import { colors } from '../../theme/colors';

export function OwnerProfileScreen({ ownerId, onBack, onMessage }: {
  ownerId: string; onBack: () => void; onMessage: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [owner, setOwner] = useState<(User & { deviceCount: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setOwner(null); setAvatarFailed(false);
    if (!/^[a-fA-F0-9]{24}$/.test(ownerId)) {
      setError('Invalid owner ID.'); setLoading(false); return;
    }
    userService.getOwnerProfile(ownerId).then(data => { if (active) setOwner(data); })
      .catch((requestError: unknown) => {
        if (!active) return;
        const status = (requestError as { response?: { status?: number } })?.response?.status;
        setError(status === 404 ? 'Owner not found.' : 'Unable to load owner profile. Please try again.');
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ownerId, retry]);
  const address = typeof owner?.address === 'string' ? owner.address : owner?.address?.fullAddress;
  const avatar = owner?.avatar?.startsWith('/')
    ? API_BASE_URL.replace(/\/api\/?$/, '') + owner.avatar : owner?.avatar;
  const stats = [
    { label: 'Devices', icon: 'cube-outline' as const, value: owner?.deviceCount ?? '—' },
    { label: 'Reviews', icon: 'chatbox-ellipses-outline' as const, value: owner?.totalReviews ?? '—' },
    { label: 'Rating', icon: 'star' as const, value: typeof owner?.rating === 'number' &&
      Number.isFinite(owner.rating) && (owner.totalReviews ?? 0) > 0 ? `${owner.rating.toFixed(1)} / 5` : 'Not rated' },
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
        <Text style={styles.headerTitle}>Owner profile</Text>
        <View style={styles.headerSpacer} />
      </View>
      {loading ? <ActivityIndicator style={styles.loading} color={colors.light.primary} /> : error ? (
        <View style={styles.panel}>
          <Text style={styles.body}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={() => setRetry(value => value + 1)}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : owner ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.profilePanel}>
            <View style={styles.cover} pointerEvents="none">
              <View style={styles.coverWaveLeft} /><View style={styles.coverWaveRight} />
            </View>
            <View style={styles.avatarWrap}>
              {avatar && !avatarFailed ? <Image source={{ uri: avatar }} style={styles.avatar} onError={() => setAvatarFailed(true)} />
                : <View style={[styles.avatar, styles.placeholder]}><Ionicons name="person" size={44} color={colors.light.primaryDark} /></View>}
              {owner.trust?.isVerified ? <View style={styles.avatarVerified}>
                <Ionicons name="shield-checkmark" size={27} color={colors.light.primaryHover} />
              </View> : null}
            </View>
            <Text style={styles.name}>{owner.name}</Text>
            {owner.trust?.isVerified ? <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={16} color={colors.light.primaryHover} />
              <Text style={styles.verified}>Verified owner</Text>
            </View> : null}
            {address ? <View style={styles.address}><Ionicons name="location" size={20} color={colors.light.textMuted} />
              <Text style={styles.body}>{address}</Text></View> : null}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.messageButton}
                onPress={onMessage} accessibilityRole="button" accessibilityLabel="Message owner">
                <Ionicons name="chatbubble-ellipses" size={18} color={colors.light.white} />
                <Text style={styles.messageText}>Message</Text>
              </TouchableOpacity>
              {address ? <TouchableOpacity style={styles.directionButton} accessibilityRole="button" accessibilityLabel="Directions to owner"
                onPress={openDirections}>
                <Ionicons name="navigate" size={18} color={colors.light.primaryDark} />
                <Text style={styles.directionText}>Directions</Text>
              </TouchableOpacity> : null}
            </View>
          </View>
          <View style={styles.panel}>
            <Text style={styles.heading}>About this owner</Text>
            {stats.map((stat, index) => (
              <View key={stat.label} style={styles.statRow}>
                <View style={[styles.statIcon, index === 1 && styles.reviewIcon, index === 2 && styles.ratingIcon]}>
                  <Ionicons name={stat.icon} size={21}
                    color={index === 2 ? colors.light.ratingStar : colors.light.primaryHover} />
                </View>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
              </View>
            ))}
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '800', color: colors.light.textPrimary },
  heading: { fontSize: 19, fontWeight: '800', color: colors.light.textPrimary, marginBottom: 4 },
  content: { paddingHorizontal: 12, paddingTop: 4, gap: 14 },
  profilePanel: { padding: 16, paddingTop: 22, gap: 14, borderRadius: 20, backgroundColor: colors.light.surface, overflow: 'hidden' },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, height: 112, backgroundColor: colors.light.primaryLight, overflow: 'hidden' },
  coverWaveLeft: { position: 'absolute', width: 300, height: 130, borderRadius: 150, backgroundColor: colors.light.primaryBg,
    left: -100, top: 35, transform: [{ rotate: '20deg' }] },
  coverWaveRight: { position: 'absolute', width: 260, height: 100, borderRadius: 130, backgroundColor: colors.light.surface,
    right: -70, top: -18, transform: [{ rotate: '15deg' }], opacity: 0.6 },
  panel: { padding: 18, gap: 8, borderRadius: 20, backgroundColor: colors.light.surface },
  avatarWrap: { alignSelf: 'center', padding: 4, backgroundColor: colors.light.surface, borderRadius: 64,
    shadowColor: colors.light.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  avatar: { width: 112, height: 112, borderRadius: 56 },
  avatarVerified: { position: 'absolute', right: 0, bottom: 3, padding: 2, borderRadius: 12, backgroundColor: colors.light.surface },
  placeholder: { backgroundColor: colors.light.primaryLight, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: colors.light.textPrimary, textAlign: 'center', paddingHorizontal: 8 },
  verifiedBadge: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'center', borderRadius: 20,
    backgroundColor: colors.light.primaryLight, paddingVertical: 7, paddingHorizontal: 12 },
  verified: { fontSize: 12, fontWeight: '700', color: colors.light.primaryDark },
  body: { fontSize: 14, lineHeight: 22, color: colors.light.textSecondary, flexShrink: 1 },
  address: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingHorizontal: 6, marginTop: 2 },
  actions: { borderTopWidth: 1, borderTopColor: colors.light.border, paddingTop: 14, flexDirection: 'row', gap: 8 },
  messageButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.light.primaryHover, padding: 12, borderRadius: 10 },
  messageText: { color: colors.light.white, fontSize: 13, fontWeight: '700' },
  directionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    flex: 1, borderWidth: 1, borderColor: colors.light.borderDefault, padding: 12, borderRadius: 10 },
  directionText: { fontSize: 13, fontWeight: '700', color: colors.light.primaryDark },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, backgroundColor: colors.light.background },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.primaryLight },
  reviewIcon: { backgroundColor: '#EAF4FD' },
  ratingIcon: { backgroundColor: colors.light.warningLight },
  statLabel: { flex: 1, fontSize: 13, color: colors.light.textSecondary },
  statValue: { fontSize: 14, fontWeight: '800', color: colors.light.textPrimary, flexShrink: 1 },
  loading: { marginTop: 40 },
  retry: { padding: 12, borderRadius: 10, backgroundColor: colors.light.primary, alignItems: 'center' },
  retryText: { color: colors.light.white, fontWeight: '600' },
});
