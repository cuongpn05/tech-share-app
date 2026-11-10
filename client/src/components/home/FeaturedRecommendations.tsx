import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Device } from '../../types';
import { colors } from '../../theme/colors';
import { resolveImageUri, getDeviceImageUrl } from '../device/DeviceCard';

/**
 * ============================================================================
 * FeaturedRecommendations.tsx
 *
 * TRÁCH NHIỆM (RESPONSIBILITY):
 * Hiển thị danh sách ngang (horizontal carousel) các thiết bị công nghệ nổi bật:
 * - Lấy các thiết bị có điểm đánh giá trung bình (ratingAvg) cao nhất hệ thống.
 * - Cho phép người dùng lướt ngang khám phá nhanh và bấm vào để xem chi tiết.
 * ============================================================================
 */

interface FeaturedRecommendationsProps {
  /** Danh sách thiết bị được đề xuất */
  devices: Device[];
  /** Hàm callback khi người dùng bấm vào một thiết bị đề xuất */
  onSelectDevice?: (deviceId: string) => void;
}

export function FeaturedRecommendations({
  devices,
  onSelectDevice,
}: FeaturedRecommendationsProps) {
  if (!devices || devices.length === 0) return null;

  return (
    <View style={styles.recommendedSection}>
      {/* TIÊU ĐỀ SECTION */}
      <View style={styles.recommendedHeader}>
        <View style={styles.recommendedHeaderTitleRow}>
          <Ionicons name="flame" size={18} color="#F59E0B" />
          <Text style={styles.recommendedTitle}>Featured Recommendations</Text>
        </View>
        <Text style={styles.recommendedSubtitle}>Top-rated tech available for rent</Text>
      </View>

      {/* DANH SÁCH THẺ VUỐT NGANG */}
      <FlatList
        horizontal
        data={devices}
        keyExtractor={(item) => `rec-${item._id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recommendedListContent}
        renderItem={({ item }) => {
          const imgUri = resolveImageUri(getDeviceImageUrl(item));
          const reviewCount = item.stats?.ratingCount ?? item.reviewCount ?? 0;
          const rawRating = item.stats?.ratingAvg ?? item.rating ?? 0;
          const rating = Number.isFinite(rawRating) ? rawRating.toFixed(1) : '0.0';
          const price = (item.pricePerDay ?? item.dailyRate ?? 0).toLocaleString('en-US');

          return (
            <TouchableOpacity
              style={styles.recCard}
              onPress={() => onSelectDevice?.(item._id)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={item.name}
            >
              {/* Ảnh thiết bị */}
              {imgUri ? (
                <Image source={{ uri: imgUri }} style={styles.recCardImage} resizeMode="cover" />
              ) : (
                <View style={[styles.recCardImage, styles.recCardImagePlaceholder]}>
                  <Ionicons name="image-outline" size={24} color={colors.light.textMuted} />
                </View>
              )}

              {/* Huy hiệu điểm đánh giá sao */}
              <View style={styles.recCardRatingBadge}>
                <Ionicons name="star" size={11} color="#F59E0B" />
                <Text style={styles.recCardRatingText}>{rating}</Text>
              </View>

              {/* Thông tin tên & giá */}
              <View style={styles.recCardBody}>
                <Text style={styles.recCardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.recCardPrice}>
                  {price} VND
                  <Text style={styles.recCardPerDay}>/day</Text>
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  recommendedSection: {
    marginTop: 8,
    marginBottom: 12,
  },
  recommendedHeader: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  recommendedHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recommendedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  recommendedSubtitle: {
    fontSize: 11.5,
    color: colors.light.textSecondary,
    marginTop: 1,
  },
  recommendedListContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  recCard: {
    width: 140,
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  recCardImage: {
    width: '100%',
    height: 90,
    backgroundColor: colors.light.border,
  },
  recCardImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  recCardRatingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
  },
  recCardRatingText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  recCardBody: {
    padding: 8,
  },
  recCardName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginBottom: 3,
  },
  recCardPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primary,
  },
  recCardPerDay: {
    fontSize: 10,
    fontWeight: '400',
    color: colors.light.textSecondary,
  },
});

