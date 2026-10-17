import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { ADMIN_STRINGS } from '../../constants/adminStrings';
import { adminService } from '../../services/adminService';
import {
  DeviceModerationDetailItem,
  DeviceModerationItem,
} from '../../types';

export interface DeviceModerationDetailScreenProps {
  route?: any;
  navigation?: any;
  deviceId?: string;
  initialDevice?: DeviceModerationItem;
  onBack?: () => void;
  onDeviceUpdated?: (updatedDevice: DeviceModerationDetailItem) => void;
}

const GALLERY_IMAGE_HEIGHT = 260;
const THUMBNAIL_SIZE = 58;

export const DeviceModerationDetailScreen: React.FC<DeviceModerationDetailScreenProps> = ({
  route,
  navigation,
  deviceId: propDeviceId,
  initialDevice: propInitialDevice,
  onBack,
  onDeviceUpdated,
}) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );

  const targetDeviceId =
    propDeviceId ||
    route?.params?.deviceId ||
    route?.params?.device?._id ||
    route?.params?.device?.id ||
    '';

  const [device, setDevice] = useState<DeviceModerationDetailItem | null>(
    (propInitialDevice as DeviceModerationDetailItem) ||
      route?.params?.device ||
      null
  );
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(!device?.description);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Trạng thái thao tác Duyệt / Từ chối
  const [isApproving, setIsApproving] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedRejectReason, setSelectedRejectReason] = useState<string>(
    ADMIN_STRINGS.MODERATION.ACTIONS.DEFAULT_REASONS[0]
  );
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Tải chi tiết thiết bị từ Database qua API
  const fetchDeviceDetail = useCallback(async (isPullRefresh = false) => {
    if (!targetDeviceId) return;

    if (isPullRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const data = await adminService.getDeviceDetail(targetDeviceId);
      setDevice(data);
      if (onDeviceUpdated) {
        onDeviceUpdated(data);
      }
    } catch (error: any) {
      console.error('[DeviceModerationDetail] Fetch Error:', error);
      const status = error?.response?.status;
      if (status === 403) {
        setErrorMessage(ADMIN_STRINGS.MODERATION.ERRORS.FORBIDDEN);
      } else {
        setErrorMessage(ADMIN_STRINGS.MODERATION.ERRORS.LOAD_FAILED);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [targetDeviceId, onDeviceUpdated]);

  useEffect(() => {
    fetchDeviceDetail();
  }, [fetchDeviceDetail]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    if (navigation?.navigate) {
      navigation.navigate('DeviceModerationList');
      return;
    }
  };

  // Định dạng tiền tệ VND
  const formatCurrency = (amount?: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount || 0);
  };

  // Định dạng ngày
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  // Dịch tình trạng máy
  const getConditionText = (condition?: string) => {
    switch (condition) {
      case 'new99':
        return ADMIN_STRINGS.MODERATION.DETAIL.CONDITIONS.NEW99;
      case 'used95':
        return ADMIN_STRINGS.MODERATION.DETAIL.CONDITIONS.USED95;
      case 'scratched':
        return ADMIN_STRINGS.MODERATION.DETAIL.CONDITIONS.SCRATCHED;
      default:
        return condition || ADMIN_STRINGS.MODERATION.DETAIL.CONDITIONS.NEW99;
    }
  };

  // Style badge trạng thái
  const getStatusBadgeConfig = (status?: string) => {
    switch (status) {
      case 'approved':
        return {
          label: ADMIN_STRINGS.MODERATION.STATUS_LABELS.APPROVED,
          bg: theme.colors.greenLight,
          textColor: theme.colors.green,
          icon: 'checkmark-circle' as const,
        };
      case 'rejected':
        return {
          label: ADMIN_STRINGS.MODERATION.STATUS_LABELS.REJECTED,
          bg: theme.colors.redLight,
          textColor: theme.colors.red,
          icon: 'close-circle' as const,
        };
      case 'pending':
      default:
        return {
          label: ADMIN_STRINGS.MODERATION.STATUS_LABELS.PENDING,
          bg: theme.colors.amberLight,
          textColor: theme.colors.amber,
          icon: 'time' as const,
        };
    }
  };

  // Xử lý Phê duyệt thiết bị
  const handleApprove = () => {
    if (!device) return;
    Alert.alert(
      ADMIN_STRINGS.MODERATION.ACTIONS.CONFIRM_APPROVE_TITLE,
      `${ADMIN_STRINGS.MODERATION.ACTIONS.CONFIRM_APPROVE_MSG}\n\n"${device.name}"`,
      [
        {
          text: ADMIN_STRINGS.MODERATION.ACTIONS.CANCEL,
          style: 'cancel',
        },
        {
          text: ADMIN_STRINGS.MODERATION.ACTIONS.APPROVE,
          style: 'default',
          onPress: async () => {
            try {
              setIsApproving(true);
              await adminService.approveDevice(device._id);

              const updated: DeviceModerationDetailItem = {
                ...device,
                moderationStatus: 'approved',
                rejectReason: '',
              };
              setDevice(updated);
              if (onDeviceUpdated) {
                onDeviceUpdated(updated);
              }
              Alert.alert(
                ADMIN_STRINGS.MODERATION.ACTIONS.CONFIRM_APPROVE_TITLE,
                ADMIN_STRINGS.MODERATION.DETAIL.ACTIONS.APPROVE_SUCCESS
              );
            } catch (error: any) {
              console.error('[DeviceModerationDetail] Approve Error:', error);
              Alert.alert(
                ADMIN_STRINGS.MODERATION.ERRORS.TITLE,
                error?.response?.data?.message ||
                  ADMIN_STRINGS.MODERATION.ERRORS.APPROVE_FAILED
              );
            } finally {
              setIsApproving(false);
            }
          },
        },
      ]
    );
  };

  // Mở modal từ chối
  const handleOpenRejectModal = () => {
    setSelectedRejectReason(ADMIN_STRINGS.MODERATION.ACTIONS.DEFAULT_REASONS[0]);
    setCustomRejectReason('');
    setRejectModalVisible(true);
  };

  // Xác nhận từ chối
  const handleConfirmReject = async () => {
    if (!device) return;
    const finalReason = customRejectReason.trim() || selectedRejectReason;

    try {
      setIsSubmittingReject(true);
      await adminService.rejectDevice(device._id, finalReason);

      const updated: DeviceModerationDetailItem = {
        ...device,
        moderationStatus: 'rejected',
        rejectReason: finalReason,
      };
      setDevice(updated);
      if (onDeviceUpdated) {
        onDeviceUpdated(updated);
      }
      setRejectModalVisible(false);
      setCustomRejectReason('');
      Alert.alert(
        ADMIN_STRINGS.MODERATION.ACTIONS.REJECT,
        ADMIN_STRINGS.MODERATION.DETAIL.ACTIONS.REJECT_SUCCESS
      );
    } catch (error: any) {
      console.error('[DeviceModerationDetail] Reject Error:', error);
      Alert.alert(
        ADMIN_STRINGS.MODERATION.ERRORS.TITLE,
        error?.response?.data?.message ||
          ADMIN_STRINGS.MODERATION.ERRORS.REJECT_FAILED
      );
    } finally {
      setIsSubmittingReject(false);
    }
  };

  const imagesList = device?.images && device.images.length > 0 ? device.images : [];
  const currentImageUri = imagesList[selectedImageIndex] || device?.thumbnail || '';
  const statusBadge = getStatusBadgeConfig(device?.moderationStatus);
  const specsEntries = device?.specs ? Object.entries(device.specs) : [];
  const accessoriesList = device?.accessories || [];

  const isPending = device?.moderationStatus === 'pending';
  const isApproved = device?.moderationStatus === 'approved';
  const isRejected = device?.moderationStatus === 'rejected';

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* 1. Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={ADMIN_STRINGS.MODERATION.DETAIL.BACK_BUTTON}
          style={styles.headerButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={theme.colors.text.primary}
          />
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>
            {ADMIN_STRINGS.MODERATION.DETAIL.HEADER_TITLE}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {device?.name || ADMIN_STRINGS.MODERATION.DETAIL.HEADER_SUBTITLE}
          </Text>
        </View>

        {device && (
          <View
            style={[
              styles.statusHeaderBadge,
              { backgroundColor: statusBadge.bg },
            ]}
          >
            <Ionicons
              name={statusBadge.icon}
              size={12}
              color={statusBadge.textColor}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.statusHeaderBadgeText,
                { color: statusBadge.textColor },
              ]}
            >
              {statusBadge.label}
            </Text>
          </View>
        )}
      </View>

      {/* 2. Nội dung chi tiết */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
          <Text style={styles.loadingText}>
            {ADMIN_STRINGS.MODERATION.DETAIL.LOADING}
          </Text>
        </View>
      ) : errorMessage && !device ? (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={52}
            color={theme.colors.red}
            style={{ marginBottom: 12 }}
          />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchDeviceDetail(true)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="refresh-outline"
              size={16}
              color={theme.colors.surface}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.retryButtonText}>
              {ADMIN_STRINGS.MODERATION.ERRORS.RETRY}
            </Text>
          </TouchableOpacity>
        </View>
      ) : device ? (
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* A. Hero Image Gallery */}
          <View style={styles.galleryCard}>
            <View style={styles.mainImageWrapper}>
              {currentImageUri ? (
                <Image
                  source={{ uri: currentImageUri }}
                  style={styles.mainImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.noImagePlaceholder}>
                  <Ionicons
                    name="image-outline"
                    size={48}
                    color={theme.colors.text.subtle}
                  />
                  <Text style={styles.noImageText}>
                    {ADMIN_STRINGS.MODERATION.DETAIL.LABELS.NO_IMAGES}
                  </Text>
                </View>
              )}

              {/* Tag số ảnh */}
              {imagesList.length > 0 && (
                <View style={styles.imageIndexTag}>
                  <Ionicons
                    name="images-outline"
                    size={12}
                    color={theme.colors.white}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.imageIndexText}>
                    {selectedImageIndex + 1}/{imagesList.length}
                  </Text>
                </View>
              )}
            </View>

            {/* Strip ảnh thu nhỏ */}
            {imagesList.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailStrip}
              >
                {imagesList.map((imgUri, index) => {
                  const isSelected = selectedImageIndex === index;
                  return (
                    <TouchableOpacity
                      key={`gallery_thumb_${index}`}
                      style={[
                        styles.thumbnailItem,
                        isSelected && styles.thumbnailItemSelected,
                      ]}
                      onPress={() => setSelectedImageIndex(index)}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{ uri: imgUri }}
                        style={styles.thumbnailImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* B. Thông tin kiểm duyệt cảnh báo (nếu bị từ chối) */}
          {device.moderationStatus === 'rejected' && device.rejectReason && (
            <View style={styles.rejectNoticeCard}>
              <View style={styles.rejectNoticeHeader}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={theme.colors.red}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.rejectNoticeTitle}>
                  {ADMIN_STRINGS.MODERATION.DETAIL.SECTIONS.REJECT_INFO}
                </Text>
              </View>
              <Text style={styles.rejectNoticeContent}>
                {device.rejectReason}
              </Text>
            </View>
          )}

          {/* C. Thẻ Thông tin Cốt lõi & Giá cả */}
          <View style={styles.card}>
            <View style={styles.metaRow}>
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>{device.brand}</Text>
              </View>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>
                  {device.category}
                </Text>
              </View>
              {device.yearOfManufacture ? (
                <Text style={styles.yearText}>
                  {ADMIN_STRINGS.MODERATION.DETAIL.LABELS.YEAR}: {device.yearOfManufacture}
                </Text>
              ) : null}
            </View>

            <Text style={styles.deviceName}>{device.name}</Text>

            <View style={styles.divider} />

            <View style={styles.pricingRow}>
              <View style={styles.pricingCol}>
                <Text style={styles.pricingLabel}>
                  {ADMIN_STRINGS.MODERATION.DETAIL.LABELS.PRICE_PER_DAY}
                </Text>
                <Text style={styles.pricingValue}>
                  {formatCurrency(device.pricePerDay)}
                  <Text style={styles.pricingUnit}>
                    {' '}{ADMIN_STRINGS.MODERATION.LABELS.PRICE_UNIT}
                  </Text>
                </Text>
              </View>

              <View style={styles.pricingDivider} />

              <View style={styles.pricingCol}>
                <Text style={styles.pricingLabel}>
                  {ADMIN_STRINGS.MODERATION.DETAIL.LABELS.DEPOSIT_AMOUNT}
                </Text>
                <Text style={styles.depositValue}>
                  {formatCurrency(device.depositAmount)}
                  <Text style={styles.pricingUnit}> đ</Text>
                </Text>
              </View>
            </View>

            <View style={styles.infoMetaList}>
              <View style={styles.infoMetaItem}>
                <Ionicons
                  name="shield-outline"
                  size={15}
                  color={theme.colors.text.secondary}
                  style={styles.infoMetaIcon}
                />
                <Text style={styles.infoMetaLabel}>
                  {ADMIN_STRINGS.MODERATION.DETAIL.LABELS.CONDITION}:
                </Text>
                <Text style={styles.infoMetaValue}>
                  {getConditionText(device.condition)}
                </Text>
              </View>

              <View style={styles.infoMetaItem}>
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={theme.colors.text.secondary}
                  style={styles.infoMetaIcon}
                />
                <Text style={styles.infoMetaLabel}>
                  {ADMIN_STRINGS.MODERATION.DETAIL.LABELS.POSTED_DATE}:
                </Text>
                <Text style={styles.infoMetaValue}>
                  {formatDate(device.createdAt)}
                </Text>
              </View>
            </View>
          </View>

          {/* D. Thông số kỹ thuật (UC-A04: Technical Specs) */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons
                name="hardware-chip-outline"
                size={18}
                color={theme.colors.brand[500]}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.sectionTitle}>
                {ADMIN_STRINGS.MODERATION.DETAIL.SECTIONS.SPECS}
              </Text>
            </View>

            {specsEntries.length > 0 ? (
              <View style={styles.specsList}>
                {specsEntries.map(([key, val], idx) => (
                  <View
                    key={`spec_${key}_${idx}`}
                    style={[
                      styles.specRow,
                      idx === specsEntries.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <Text style={styles.specKey}>{key}</Text>
                    <Text style={styles.specVal}>{String(val)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyFieldText}>
                {ADMIN_STRINGS.MODERATION.DETAIL.LABELS.NO_SPECS}
              </Text>
            )}
          </View>

          {/* E. Phụ kiện đi kèm */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons
                name="briefcase-outline"
                size={18}
                color={theme.colors.brand[500]}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.sectionTitle}>
                {ADMIN_STRINGS.MODERATION.DETAIL.SECTIONS.ACCESSORIES}
              </Text>
            </View>

            {accessoriesList.length > 0 ? (
              <View style={styles.accessoriesWrap}>
                {accessoriesList.map((item, idx) => (
                  <View key={`acc_${idx}`} style={styles.accessoryChip}>
                    <Ionicons
                      name="checkmark"
                      size={13}
                      color={theme.colors.brand[700]}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.accessoryText}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyFieldText}>
                {ADMIN_STRINGS.MODERATION.DETAIL.LABELS.NO_ACCESSORIES}
              </Text>
            )}
          </View>

          {/* F. Mô tả chi tiết */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons
                name="document-text-outline"
                size={18}
                color={theme.colors.brand[500]}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.sectionTitle}>
                {ADMIN_STRINGS.MODERATION.DETAIL.SECTIONS.DESCRIPTION}
              </Text>
            </View>

            <Text style={styles.descriptionText}>
              {device.description || ADMIN_STRINGS.MODERATION.DETAIL.LABELS.NO_DESCRIPTION}
            </Text>
          </View>

          {/* G. Địa chỉ & Vị trí bàn giao */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons
                name="location-outline"
                size={18}
                color={theme.colors.brand[500]}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.sectionTitle}>
                {ADMIN_STRINGS.MODERATION.DETAIL.SECTIONS.LOCATION}
              </Text>
            </View>

            <View style={styles.locationBox}>
              <Ionicons
                name="pin"
                size={20}
                color={theme.colors.red}
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <Text style={styles.locationText}>
                {device.addressText || device.location?.addressText || ADMIN_STRINGS.MODERATION.DETAIL.LABELS.NO_DESCRIPTION}
              </Text>
            </View>
          </View>

          {/* H. Thông tin Chủ máy & Độ tin cậy */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons
                name="person-circle-outline"
                size={18}
                color={theme.colors.brand[500]}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.sectionTitle}>
                {ADMIN_STRINGS.MODERATION.DETAIL.SECTIONS.OWNER}
              </Text>
            </View>

            <View style={styles.ownerProfileRow}>
              <View style={styles.ownerAvatarBox}>
                {device.owner?.avatar ? (
                  <Image
                    source={{ uri: device.owner.avatar }}
                    style={styles.ownerAvatar}
                  />
                ) : (
                  <Ionicons
                    name="person"
                    size={28}
                    color={theme.colors.text.subtle}
                  />
                )}
              </View>

              <View style={styles.ownerProfileInfo}>
                <View style={styles.ownerNameRow}>
                  <Text style={styles.ownerNameTitle} numberOfLines={1}>
                    {device.owner?.name || ADMIN_STRINGS.MODERATION.LABELS.OWNER}
                  </Text>
                  {device.owner?.isVerified && (
                    <Ionicons
                      name="checkmark-circle"
                      size={15}
                      color={theme.colors.blue}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </View>

                <View style={styles.ownerBadgesRow}>
                  <View style={styles.trustScoreBadge}>
                    <Ionicons
                      name="shield-checkmark"
                      size={11}
                      color={theme.colors.brand[700]}
                      style={{ marginRight: 3 }}
                    />
                    <Text style={styles.trustScoreText}>
                      {ADMIN_STRINGS.MODERATION.DETAIL.LABELS.TRUST_SCORE}: {device.owner?.trustScore ?? 100}
                    </Text>
                  </View>

                  <Text style={styles.verificationStatusText}>
                    {device.owner?.isVerified
                      ? ADMIN_STRINGS.MODERATION.DETAIL.LABELS.VERIFIED_OWNER
                      : ADMIN_STRINGS.MODERATION.DETAIL.LABELS.UNVERIFIED_OWNER}
                  </Text>
                </View>
              </View>
            </View>

            {/* Thông tin liên hệ của chủ máy cho Admin đối soát */}
            <View style={styles.ownerContactList}>
              {device.owner?.phone ? (
                <View style={styles.ownerContactItem}>
                  <Ionicons
                    name="call-outline"
                    size={14}
                    color={theme.colors.text.secondary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.ownerContactText}>
                    {device.owner.phone}
                  </Text>
                </View>
              ) : null}

              {device.owner?.email ? (
                <View style={styles.ownerContactItem}>
                  <Ionicons
                    name="mail-outline"
                    size={14}
                    color={theme.colors.text.secondary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.ownerContactText}>
                    {device.owner.email}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Đệm đáy để không bị thanh Action Bar che khuất */}
          <View style={{ height: 80 }} />
        </ScrollView>
      ) : null}

      {/* 3. Thanh thao tác cố định ở đáy theo từng trạng thái kiểm duyệt */}
      {device && (
        <View style={[styles.bottomActionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {isPending ? (
            <>
              {/* Trạng thái CHỜ DUYỆT: Nút Từ chối bên trái + Nút Phê duyệt bên phải */}
              <TouchableOpacity
                style={styles.actionRejectBtn}
                onPress={handleOpenRejectModal}
                disabled={isApproving}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={ADMIN_STRINGS.MODERATION.DETAIL.ACTIONS.REJECT_NOW}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={18}
                  color={theme.colors.red}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.actionRejectBtnText}>
                  {ADMIN_STRINGS.MODERATION.DETAIL.ACTIONS.REJECT_NOW}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionApproveBtn}
                onPress={handleApprove}
                disabled={isApproving}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={ADMIN_STRINGS.MODERATION.DETAIL.ACTIONS.APPROVE_NOW}
              >
                {isApproving ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color={theme.colors.white}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.actionApproveBtnText}>
                      {ADMIN_STRINGS.MODERATION.DETAIL.ACTIONS.APPROVE_NOW}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : isApproved ? (
            <>
              {/* Trạng thái ĐÃ DUYỆT: Huy hiệu Đã phê duyệt bên trái + Nút Gỡ bài bên phải */}
              <View style={styles.statusBadgeApprovedWrap}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={theme.colors.green}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.statusBadgeApprovedText}>
                  {ADMIN_STRINGS.MODERATION.DETAIL.ACTIONS.ALREADY_APPROVED}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.actionRevokeBtn}
                onPress={handleOpenRejectModal}
                disabled={isApproving}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={ADMIN_STRINGS.MODERATION.DETAIL.ACTIONS.REVOKE_NOW}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color={theme.colors.red}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.actionRevokeBtnText}>
                  {ADMIN_STRINGS.MODERATION.DETAIL.ACTIONS.REVOKE_NOW}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Trạng thái ĐÃ TỪ CHỐI: Huy hiệu Đã từ chối bên trái + Nút Duyệt lại bên phải */}
              <View style={styles.statusBadgeRejectedWrap}>
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={theme.colors.red}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.statusBadgeRejectedText}>
                  {ADMIN_STRINGS.MODERATION.DETAIL.ACTIONS.ALREADY_REJECTED}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.actionReApproveBtn}
                onPress={handleApprove}
                disabled={isApproving}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={ADMIN_STRINGS.MODERATION.DETAIL.ACTIONS.RE_APPROVE_NOW}
              >
                {isApproving ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={16}
                      color={theme.colors.white}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.actionReApproveBtnText}>
                      {ADMIN_STRINGS.MODERATION.DETAIL.ACTIONS.RE_APPROVE_NOW}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* 4. Modal chọn lý do từ chối thiết bị */}
      <Modal
        visible={rejectModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setRejectModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={styles.modalIconBox}>
                <Ionicons
                  name="alert-circle"
                  size={20}
                  color={theme.colors.red}
                />
              </View>
              <View style={styles.modalTitleCol}>
                <Text style={styles.modalTitle}>
                  {ADMIN_STRINGS.MODERATION.ACTIONS.REJECT_MODAL_TITLE}
                </Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {device?.name}
                </Text>
              </View>
            </View>

            <Text style={styles.modalSectionLabel}>
              {ADMIN_STRINGS.MODERATION.ACTIONS.REJECT_MODAL_SUBTITLE}
            </Text>

            {/* Danh sách lý do từ chối chuẩn */}
            <View style={styles.reasonList}>
              {ADMIN_STRINGS.MODERATION.ACTIONS.DEFAULT_REASONS.map(
                (reason, index) => {
                  const isSelected =
                    selectedRejectReason === reason && !customRejectReason;
                  return (
                    <TouchableOpacity
                      key={`detail_reject_reason_${index}`}
                      style={[
                        styles.reasonChip,
                        isSelected && styles.reasonChipSelected,
                      ]}
                      onPress={() => {
                        setSelectedRejectReason(reason);
                        setCustomRejectReason('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={
                          isSelected ? 'radio-button-on' : 'radio-button-off'
                        }
                        size={16}
                        color={
                          isSelected
                            ? theme.colors.red
                            : theme.colors.text.subtle
                        }
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={[
                          styles.reasonChipText,
                          isSelected && styles.reasonChipTextSelected,
                        ]}
                      >
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>

            {/* Ô nhập lý do chi tiết */}
            <TextInput
              style={styles.customReasonInput}
              placeholder={
                ADMIN_STRINGS.MODERATION.ACTIONS.REJECT_REASON_PLACEHOLDER
              }
              placeholderTextColor={theme.colors.text.subtle}
              value={customRejectReason}
              onChangeText={setCustomRejectReason}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setRejectModalVisible(false)}
                disabled={isSubmittingReject}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>
                  {ADMIN_STRINGS.MODERATION.ACTIONS.CANCEL}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleConfirmReject}
                disabled={isSubmittingReject}
                activeOpacity={0.7}
              >
                {isSubmittingReject ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {ADMIN_STRINGS.MODERATION.ACTIONS.CONFIRM_REJECT}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.divider,
  },
  headerButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
  },
  headerTitleCol: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  headerTitle: {
    color: theme.colors.text.primary,
    fontSize: 17,
    fontWeight: theme.typography.fontWeight.bold,
  },
  headerSubtitle: {
    color: theme.colors.text.muted,
    fontSize: 12,
    marginTop: 1,
  },
  statusHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radii.full,
  },
  statusHeaderBadgeText: {
    fontSize: 11,
    fontWeight: theme.typography.fontWeight.bold,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.brand[500],
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radii.md,
  },
  retryButtonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    gap: 12,
  },
  galleryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border.divider,
    ...theme.shadows.card,
  },
  mainImageWrapper: {
    width: '100%',
    height: GALLERY_IMAGE_HEIGHT,
    backgroundColor: theme.colors.surfaceMuted,
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  noImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.subtle,
    marginTop: 8,
  },
  imageIndexTag: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.overlay,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radii.full,
  },
  imageIndexText: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: theme.typography.fontWeight.bold,
  },
  thumbnailStrip: {
    padding: 10,
    gap: 8,
  },
  thumbnailItem: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: theme.colors.surfaceMuted,
  },
  thumbnailItemSelected: {
    borderColor: theme.colors.brand[500],
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  rejectNoticeCard: {
    backgroundColor: theme.colors.redLight,
    borderWidth: 1,
    borderColor: theme.colors.redBorder,
    borderRadius: theme.radii.lg,
    padding: 14,
  },
  rejectNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  rejectNoticeTitle: {
    fontSize: 13,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.red,
  },
  rejectNoticeContent: {
    fontSize: 12.5,
    color: theme.colors.text.primary,
    lineHeight: 18,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border.divider,
    ...theme.shadows.card,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  brandBadge: {
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radii.sm,
  },
  brandBadgeText: {
    fontSize: 11,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.secondary,
  },
  categoryBadge: {
    backgroundColor: theme.colors.brand[100],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radii.sm,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.brand[700],
  },
  yearText: {
    fontSize: 11.5,
    color: theme.colors.text.muted,
    marginLeft: 'auto',
  },
  deviceName: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border.divider,
    marginVertical: 12,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.md,
    padding: 12,
    marginBottom: 12,
  },
  pricingCol: {
    flex: 1,
  },
  pricingDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.colors.border.light,
    marginHorizontal: 12,
  },
  pricingLabel: {
    fontSize: 11,
    color: theme.colors.text.muted,
    marginBottom: 2,
  },
  pricingValue: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.brand[700],
  },
  depositValue: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.amber,
  },
  pricingUnit: {
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.normal,
    color: theme.colors.text.muted,
  },
  infoMetaList: {
    gap: 8,
  },
  infoMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoMetaIcon: {
    marginRight: 6,
  },
  infoMetaLabel: {
    fontSize: 12.5,
    color: theme.colors.text.muted,
    marginRight: 6,
  },
  infoMetaValue: {
    fontSize: 12.5,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  specsList: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.divider,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.divider,
  },
  specKey: {
    fontSize: 12.5,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  specVal: {
    fontSize: 12.5,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  emptyFieldText: {
    fontSize: 12.5,
    color: theme.colors.text.muted,
    fontStyle: 'italic',
  },
  accessoriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accessoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.brand[50],
    borderWidth: 1,
    borderColor: theme.colors.brand[200],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radii.full,
  },
  accessoryText: {
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.brand[800],
  },
  descriptionText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.background,
    padding: 10,
    borderRadius: theme.radii.md,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.text.primary,
    lineHeight: 18,
  },
  ownerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownerAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ownerAvatar: {
    width: '100%',
    height: '100%',
  },
  ownerProfileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  ownerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ownerNameTitle: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  ownerBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trustScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.brand[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
  },
  trustScoreText: {
    fontSize: 10.5,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.brand[700],
  },
  verificationStatusText: {
    fontSize: 11,
    color: theme.colors.text.muted,
  },
  ownerContactList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.divider,
    gap: 6,
  },
  ownerContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownerContactText: {
    fontSize: 12.5,
    color: theme.colors.text.secondary,
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.divider,
    gap: 12,
    ...theme.shadows.cardHover,
  },
  actionRejectBtn: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.redLight,
    borderWidth: 1,
    borderColor: theme.colors.redBorder,
    borderRadius: theme.radii.md,
  },
  actionRejectBtnText: {
    fontSize: 13,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.red,
  },
  actionApproveBtn: {
    flex: 1.5,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.green,
    borderRadius: theme.radii.md,
  },
  actionApproveBtnText: {
    fontSize: 13,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.white,
  },
  statusBadgeApprovedWrap: {
    flex: 1.2,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.greenLight,
    borderRadius: theme.radii.md,
    paddingHorizontal: 10,
  },
  statusBadgeApprovedText: {
    fontSize: 12.5,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.green,
  },
  actionRevokeBtn: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.redLight,
    borderWidth: 1,
    borderColor: theme.colors.redBorder,
    borderRadius: theme.radii.md,
  },
  actionRevokeBtnText: {
    fontSize: 12.5,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.red,
  },
  statusBadgeRejectedWrap: {
    flex: 1.2,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.redLight,
    borderRadius: theme.radii.md,
    paddingHorizontal: 10,
  },
  statusBadgeRejectedText: {
    fontSize: 12.5,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.red,
  },
  actionReApproveBtn: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.green,
    borderRadius: theme.radii.md,
  },
  actionReApproveBtnText: {
    fontSize: 12.5,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.white,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlay,
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    ...theme.shadows.cardHover,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: theme.colors.border.light,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.redLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalTitleCol: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.colors.text.muted,
    marginTop: 1,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    marginBottom: 10,
  },
  reasonList: {
    gap: 8,
    marginBottom: 12,
  },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  reasonChipSelected: {
    backgroundColor: theme.colors.redLight,
    borderColor: theme.colors.redBorder,
  },
  reasonChipText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  reasonChipTextSelected: {
    color: theme.colors.red,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: theme.radii.md,
    padding: 10,
    fontSize: 12.5,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.surfaceMuted,
    textAlignVertical: 'top',
    height: 68,
    marginBottom: 14,
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    backgroundColor: theme.colors.surface,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.secondary,
  },
  modalConfirmButton: {
    flex: 1.5,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.red,
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.white,
  },
});

export default DeviceModerationDetailScreen;
