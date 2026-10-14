import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageUploadGrid } from '../../components/device/ImageUploadGrid';
import { STRINGS } from '../../constants/strings';
import { devicePostService } from '../../services/devicePostService';
import { useAppSelector } from '../../store';
import { colors } from '../../theme/colors';
import type { Device } from '../../types';
import { SpecsInputForm } from './SpecsInputForm';
import type { Specification } from './SpecsInputForm';

type PostDeviceScreenProps = {
  accessToken?: string;
  navigation?: {
    goBack?: () => void;
    openDrawer?: () => void;
  };
};

type DeviceLocation = {
  latitude: number;
  longitude: number;
};

const categories = ['Smartphone', 'Laptop', 'Camera', 'Drone', 'Audio', 'Gaming', 'Accessory'];

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
    </View>
  );
}

export function PostDeviceScreen({ accessToken: suppliedAccessToken = '', navigation }: PostDeviceScreenProps) {
  const sessionAccessToken = useAppSelector((state) => state.auth.token);
  const accessToken = suppliedAccessToken || sessionAccessToken || '';
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20);
  const [deviceLocation, setDeviceLocation] = useState<DeviceLocation | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [category, setCategory] = useState('Smartphone');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [addressText, setAddressText] = useState('');
  const [description, setDescription] = useState('');
  const [showCategories, setShowCategories] = useState(false);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [specificationsValid, setSpecificationsValid] = useState(true);
  const [validateSignal, setValidateSignal] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [devicesError, setDevicesError] = useState('');

  useEffect(() => {
    let isCurrent = true;

    const loadDevices = async () => {
      if (!accessToken.trim()) {
        setDevices([]);
        setIsLoadingDevices(false);
        setDevicesError(STRINGS.POST_DEVICE.ERR_LOGIN_REQUIRED);
        return;
      }

      setIsLoadingDevices(true);
      setDevices([]);
      setDevicesError('');
      try {
        const ownerDevices = await devicePostService.getMyDevices(accessToken);
        if (isCurrent) setDevices(ownerDevices);
      } catch (error: unknown) {
        console.error('[PostDeviceScreen] Cannot load owner devices:', error);
        if (isCurrent) setDevicesError(STRINGS.POST_DEVICE.DEVICES_LOAD_ERROR);
      } finally {
        if (isCurrent) setIsLoadingDevices(false);
      }
    };

    void loadDevices();
    return () => {
      isCurrent = false;
    };
  }, [accessToken]);

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    setLocationError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationError(STRINGS.POST_DEVICE.LOCATION_DENIED);
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        setLocationError(STRINGS.POST_DEVICE.LOCATION_ENABLE);
        return;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setDeviceLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    } catch (error: unknown) {
      console.error('[PostDeviceScreen] Cannot get current location:', error);
      setLocationError(error instanceof Error ? error.message : STRINGS.POST_DEVICE.LOCATION_ERROR);
    } finally {
      setIsGettingLocation(false);
    }
  };


  
  const handlePublish = async () => {
    setSubmitted(true);
    setValidateSignal((signal) => signal + 1);
    setPublishError('');

    const pricePerDay = Number(price);
    const deposit = Number(depositAmount);
    if (!deviceName.trim()) {
      setPublishError(STRINGS.POST_DEVICE.ERR_NAME_REQUIRED);
      return;
    }
    if (!brand.trim()) {
      setPublishError(STRINGS.POST_DEVICE.ERR_BRAND_REQUIRED);
      return;
    }
    if (!addressText.trim()) {
      setPublishError(STRINGS.POST_DEVICE.ERR_ADDRESS_FIELD);
      return;
    }
    if (!description.trim()) {
      setPublishError(STRINGS.POST_DEVICE.ERR_DESCRIPTION_REQUIRED);
      return;
    }
    if (!price.trim()) {
      setPublishError(STRINGS.POST_DEVICE.ERR_PRICE_REQUIRED);
      return;
    }
    if (!depositAmount.trim()) {
      setPublishError(STRINGS.POST_DEVICE.ERR_DEPOSIT_REQUIRED);
      return;
    }
    if (!Number.isFinite(pricePerDay) || pricePerDay <= 0 || !Number.isFinite(deposit) || deposit <= 0) {
      setPublishError(STRINGS.POST_DEVICE.ERR_NUMERIC_PRICE_DEPOSIT);
      return;
    }
    if (
      !specificationsValid ||
      specifications.some((item) => !item.name.trim() || !item.value.trim())
    ) {
      setPublishError(STRINGS.POST_DEVICE.ERR_COMPLETE_SPECS);
      return;
    }
    if (!deviceLocation) {
      setPublishError(STRINGS.POST_DEVICE.ERR_LOCATION_REQUIRED);
      return;
    }
    if (!accessToken.trim()) {
      setPublishError(STRINGS.POST_DEVICE.ERR_LOGIN_REQUIRED);
      return;
    }
    if (photoUris.length === 0) {
      setPublishError(STRINGS.POST_DEVICE.ERR_ADD_PHOTO);
      return;
    }

    setIsPublishing(true);
    Keyboard.dismiss();
    try {
      const images = await Promise.all(
        photoUris.map((uri, index) => devicePostService.uploadDeviceImage(accessToken, uri, index)),
      );
      const specs = Object.fromEntries(
        specifications
          .filter((item) => item.name.trim() && item.value.trim())
          .map((item) => [item.name.trim(), item.value.trim()]),
      );
      await devicePostService.createDevice(accessToken, {
        name: deviceName.trim(),
        brand: brand.trim(),
        category: category.toLowerCase(),
        description: description.trim(),
        images,
        specs,
        pricePerDay,
        depositAmount: deposit,
        location: {
          type: 'Point',
          coordinates: [deviceLocation.longitude, deviceLocation.latitude],
        },
        addressText: addressText.trim(),
      });
      try {
        setDevices(await devicePostService.getMyDevices(accessToken));
        setDevicesError('');
      } catch (error: unknown) {
        console.error('[PostDeviceScreen] Cannot refresh owner devices:', error);
        setDevicesError(STRINGS.POST_DEVICE.DEVICES_LOAD_ERROR);
      }

      Alert.alert(
        STRINGS.POST_DEVICE.SUCCESS_PUBLISHED_TITLE,
        STRINGS.POST_DEVICE.SUCCESS_PUBLISHED_MSG,
        [{ text: STRINGS.POST_DEVICE.DONE, onPress: navigation?.goBack }],
      );
    } catch (error: unknown) {
      console.error('[PostDeviceScreen] Cannot publish device:', error);
      const serverMessage = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      setPublishError(
        typeof serverMessage === 'string'
          ? serverMessage
          : error instanceof Error
            ? error.message
            : STRINGS.POST_DEVICE.ERR_PUBLISH_DEFAULT,
      );
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={STRINGS.POST_DEVICE.ACCESSIBILITY_MENU}
            style={styles.headerButton}
            onPress={navigation?.openDrawer}
          >
            <Ionicons name="menu-outline" size={24} color={colors.light.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>{STRINGS.POST_DEVICE.HEADER_TITLE}</Text>
            <Text style={styles.headerSubtitle}>{STRINGS.POST_DEVICE.HEADER_SUBTITLE}</Text>
          </View>
        </View>
        <Ionicons name="information-circle-outline" size={22} color={colors.light.textSecondary} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <Text style={styles.introTitle}>{STRINGS.POST_DEVICE.INTRO_TITLE}</Text>
          <Text style={styles.introText}>{STRINGS.POST_DEVICE.INTRO_TEXT}</Text>
        </View>

        <View style={styles.myDevicesSection}>
          <View style={styles.myDevicesHeader}>
            <View>
              <Text style={styles.myDevicesTitle}>{STRINGS.POST_DEVICE.YOUR_DEVICES_TITLE}</Text>
              <Text style={styles.myDevicesDescription}>{STRINGS.POST_DEVICE.YOUR_DEVICES_DESC}</Text>
            </View>
            <View style={styles.deviceCountBadge}>
              <Text style={styles.deviceCountText}>{devices.length}</Text>
            </View>
          </View>

          {isLoadingDevices ? (
            <ActivityIndicator color={colors.light.primary} />
          ) : devicesError ? (
            <Text style={styles.deviceListError}>{devicesError}</Text>
          ) : devices.length === 0 ? (
            <Text style={styles.deviceListMessage}>{STRINGS.POST_DEVICE.NO_DEVICES_YET}</Text>
          ) : (
            devices.map((device) => (
              <View key={device._id} style={styles.deviceListCard}>
                {device.images?.[0] ? (
                  <Image source={{ uri: device.images[0] }} style={styles.deviceListImage} />
                ) : (
                  <View style={[styles.deviceListImage, styles.deviceListImagePlaceholder]}>
                    <Ionicons name="phone-portrait-outline" size={22} color={colors.light.textSecondary} />
                  </View>
                )}
                <View style={styles.deviceListInfo}>
                  <Text style={styles.deviceListName} numberOfLines={1}>
                    {device.name || device.title}
                  </Text>
                  <Text style={styles.deviceListMeta}>
                    {device.category} • {device.dailyRate.toLocaleString('vi-VN')} {STRINGS.POST_DEVICE.PER_DAY_SUFFIX}
                  </Text>
                  <Text style={[
                    styles.deviceListStatus,
                    device.status === 'available' ? styles.deviceListStatusAvailable : styles.deviceListStatusMuted,
                  ]}>
                    {device.status === 'available' ? STRINGS.POST_DEVICE.STATUS_AVAILABLE : device.status}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle title={STRINGS.POST_DEVICE.SECTION_PHOTOS} />
          <ImageUploadGrid images={photoUris} onChangeImages={setPhotoUris} />
        </View>

        <View style={styles.section}>
          <SectionTitle title={STRINGS.POST_DEVICE.SECTION_DEVICE_INFO} />
          <Text style={styles.fieldLabel}>{STRINGS.POST_DEVICE.LABEL_DEVICE_NAME}<Text style={styles.required}> *</Text></Text>
          <TextInput
            value={deviceName}
            onChangeText={setDeviceName}
            placeholder={STRINGS.POST_DEVICE.PLACEHOLDER_DEVICE_NAME}
            placeholderTextColor={colors.light.textSecondary}
            style={[styles.input, submitted && !deviceName.trim() && styles.inputError]}
          />
          {submitted && !deviceName.trim() ? <Text style={styles.errorText}>{STRINGS.POST_DEVICE.ERR_NAME_REQUIRED}</Text> : null}

          <Text style={styles.fieldLabel}>{STRINGS.POST_DEVICE.LABEL_CATEGORY}<Text style={styles.required}> *</Text></Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.selectInput}
            onPress={() => setShowCategories((visible) => !visible)}
          >
            <Text style={styles.selectText}>{category}</Text>
            <Ionicons name={showCategories ? 'chevron-up' : 'chevron-down'} size={18} color={colors.light.textSecondary} />
          </TouchableOpacity>
          {showCategories ? (
            <View style={styles.categoryMenu}>
              {categories.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.categoryOption}
                  onPress={() => {
                    setCategory(item);
                    setShowCategories(false);
                  }}
                >
                  <Text style={[styles.categoryOptionText, category === item && styles.categoryOptionActive]}>{item}</Text>
                  {category === item ? <Ionicons name="checkmark" size={17} color={colors.light.primary} /> : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>{STRINGS.POST_DEVICE.LABEL_BRAND}<Text style={styles.required}> *</Text></Text>
          <TextInput
            value={brand}
            onChangeText={setBrand}
            placeholder={STRINGS.POST_DEVICE.PLACEHOLDER_BRAND}
            placeholderTextColor={colors.light.textSecondary}
            style={[styles.input, submitted && !brand.trim() && styles.inputError]}
          />
          {submitted && !brand.trim() ? <Text style={styles.errorText}>{STRINGS.POST_DEVICE.ERR_BRAND_REQUIRED}</Text> : null}

          <Text style={styles.fieldLabel}>{STRINGS.POST_DEVICE.LABEL_ADDRESS}<Text style={styles.required}> *</Text></Text>
          <TextInput
            value={addressText}
            onChangeText={setAddressText}
            placeholder={STRINGS.POST_DEVICE.PLACEHOLDER_ADDRESS}
            placeholderTextColor={colors.light.textSecondary}
            style={[styles.input, submitted && !addressText.trim() && styles.inputError]}
          />
          {submitted && !addressText.trim() ? <Text style={styles.errorText}>{STRINGS.POST_DEVICE.ERR_ADDRESS_FIELD}</Text> : null}

          <Text style={styles.fieldLabel}>{STRINGS.POST_DEVICE.LABEL_LOCATION}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={getCurrentLocation}
            disabled={isGettingLocation}
            style={[styles.locationButton, isGettingLocation && styles.disabledButton]}
          >
            {isGettingLocation
              ? <ActivityIndicator size="small" color={colors.light.primary} />
              : <Ionicons name={deviceLocation ? 'checkmark-circle-outline' : 'locate-outline'} size={18} color={colors.light.primary} />}
            <Text style={styles.locationButtonText}>
              {isGettingLocation
                ? STRINGS.POST_DEVICE.LOCATION_GETTING
                : deviceLocation
                  ? STRINGS.POST_DEVICE.LOCATION_CAPTURED_BTN
                  : STRINGS.POST_DEVICE.LOCATION_USE_CURRENT}
            </Text>
          </TouchableOpacity>
          {locationError
            ? <Text style={styles.errorText}>{locationError}</Text>
            : deviceLocation
              ? <Text style={styles.locationStatus}>{STRINGS.POST_DEVICE.LOCATION_SUCCESS}</Text>
              : <Text style={styles.helperText}>{STRINGS.POST_DEVICE.LOCATION_HELPER}</Text>}
        </View>

        <View style={styles.section}>
          <SectionTitle title={STRINGS.POST_DEVICE.SECTION_PRICING} />
          <Text style={styles.fieldLabel}>{STRINGS.POST_DEVICE.LABEL_RENTAL_PRICE}<Text style={styles.required}> *</Text></Text>
          <View style={[styles.currencyInput, submitted && !price.trim() && styles.inputError]}>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder={STRINGS.POST_DEVICE.PLACEHOLDER_PRICE}
              placeholderTextColor={colors.light.textSecondary}
              keyboardType="numeric"
              style={styles.currencyTextInput}
            />
            <Text style={styles.currency}>{STRINGS.POST_DEVICE.CURRENCY_VND}</Text>
          </View>
          {submitted && !price.trim() ? <Text style={styles.errorText}>{STRINGS.POST_DEVICE.ERR_PRICE_REQUIRED}</Text> : null}

          <Text style={styles.fieldLabel}>{STRINGS.POST_DEVICE.LABEL_DEPOSIT}<Text style={styles.required}> *</Text></Text>
          <View style={[styles.currencyInput, submitted && !depositAmount.trim() && styles.inputError]}>
            <TextInput
              value={depositAmount}
              onChangeText={setDepositAmount}
              placeholder={STRINGS.POST_DEVICE.PLACEHOLDER_DEPOSIT}
              placeholderTextColor={colors.light.textSecondary}
              keyboardType="numeric"
              style={styles.currencyTextInput}
            />
            <Text style={styles.currency}>{STRINGS.POST_DEVICE.CURRENCY_VND}</Text>
          </View>
          {submitted && !depositAmount.trim() ? <Text style={styles.errorText}>{STRINGS.POST_DEVICE.ERR_DEPOSIT_REQUIRED}</Text> : null}
          <Text style={styles.helperText}>{STRINGS.POST_DEVICE.DEPOSIT_HELPER}</Text>
        </View>

        <View style={styles.section}>
          <SectionTitle title={STRINGS.POST_DEVICE.SECTION_DESCRIPTION} />
          <View style={[styles.textareaWrap, submitted && !description.trim() && styles.inputError]}>
            <TextInput
              value={description}
              onChangeText={(text) => text.length <= 500 && setDescription(text)}
              placeholder={STRINGS.POST_DEVICE.PLACEHOLDER_DESCRIPTION}
              placeholderTextColor={colors.light.textSecondary}
              multiline
              textAlignVertical="top"
              style={styles.textarea}
            />
            <Text style={styles.counter}>{description.length} / 500</Text>
          </View>
          {submitted && !description.trim() ? <Text style={styles.errorText}>{STRINGS.POST_DEVICE.ERR_DESCRIPTION_REQUIRED}</Text> : null}
        </View>

        <View style={styles.section}>
          <SectionTitle title={STRINGS.POST_DEVICE.SECTION_SPECS} description={STRINGS.POST_DEVICE.SECTION_SPECS_DESC} />
          <SpecsInputForm
            validateSignal={validateSignal}
            onChange={setSpecifications}
            onValidityChange={setSpecificationsValid}
          />
        </View>

        {publishError ? <Text style={styles.publishError}>{publishError}</Text> : null}
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.publishButton, isPublishing && styles.disabledButton]}
          onPress={handlePublish}
          disabled={isPublishing}
          activeOpacity={0.85}
        >
          {isPublishing
            ? <ActivityIndicator color={colors.light.white} />
            : <Text style={styles.publishText}>{STRINGS.POST_DEVICE.BTN_PUBLISH}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.light.card, borderBottomWidth: 1, borderBottomColor: colors.light.borderSubtle,
  },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerButton: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.light.borderSubtle, borderRadius: 12, backgroundColor: colors.light.background,
  },
  headerTitleCol: { flex: 1 },
  headerTitle: { color: colors.light.textPrimary, fontSize: 16, fontWeight: '700' },
  headerSubtitle: { color: colors.light.textSecondary, fontSize: 11, marginTop: 2 },
  content: { paddingHorizontal: 16, paddingTop: 23, paddingBottom: 30 },
  intro: { marginBottom: 27 },
  introTitle: { color: colors.light.textPrimary, fontSize: 24, fontWeight: '800' },
  introText: { color: colors.light.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: 320 },
  myDevicesSection: {
    marginBottom: 25,
    padding: 14,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    borderRadius: 14,
  },
  myDevicesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  myDevicesTitle: { color: colors.light.textPrimary, fontSize: 17, fontWeight: '800' },
  myDevicesDescription: { color: colors.light.textSecondary, fontSize: 12, marginTop: 3 },
  deviceCountBadge: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.primaryLight,
  },
  deviceCountText: { color: colors.light.primary, fontSize: 12, fontWeight: '800' },
  deviceListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginTop: 8,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    borderRadius: 10,
  },
  deviceListImage: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: colors.light.borderDefault,
  },
  deviceListImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  deviceListInfo: { flex: 1, marginLeft: 10 },
  deviceListName: { color: colors.light.textPrimary, fontSize: 13, fontWeight: '800' },
  deviceListMeta: { color: colors.light.textSecondary, fontSize: 11, marginTop: 4 },
  deviceListStatus: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  deviceListStatusAvailable: { color: colors.light.success },
  deviceListStatusMuted: { color: colors.light.textSecondary },
  deviceListMessage: { color: colors.light.textSecondary, fontSize: 12, textAlign: 'center', paddingVertical: 12 },
  deviceListError: { color: colors.light.danger, fontSize: 12, textAlign: 'center', paddingVertical: 12 },
  section: { marginBottom: 25 },
  sectionHeading: { marginBottom: 14 },
  sectionTitle: { color: colors.light.textPrimary, fontSize: 18, fontWeight: '800' },
  sectionDescription: { color: colors.light.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 5 },
  fieldLabel: { color: colors.light.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 7, marginTop: 14 },
  required: { color: colors.light.danger },
  input: {
    height: 48, backgroundColor: colors.light.background, borderWidth: 1,
    borderColor: colors.light.borderDefault, borderRadius: 12, paddingHorizontal: 13,
    color: colors.light.textPrimary, fontSize: 13,
  },
  inputError: { borderColor: colors.light.danger },
  errorText: { color: colors.light.danger, fontSize: 11, marginTop: 5 },
  selectInput: {
    height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.light.background, borderWidth: 1, borderColor: colors.light.borderDefault,
    borderRadius: 12, paddingHorizontal: 13,
  },
  selectText: { color: colors.light.textPrimary, fontSize: 13 },
  categoryMenu: {
    backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.borderDefault,
    borderRadius: 12, marginTop: 6, overflow: 'hidden',
  },
  categoryOption: {
    minHeight: 42, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: colors.light.borderSubtle,
  },
  categoryOptionText: { color: colors.light.textSecondary, fontSize: 13 },
  categoryOptionActive: { color: colors.light.primary, fontWeight: '800' },
  locationButton: {
    minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, marginBottom: 8, borderRadius: 10, backgroundColor: colors.light.primaryLight,
  },
  locationButtonText: { color: colors.light.primary, fontSize: 12, fontWeight: '700' },
  locationStatus: { color: colors.light.success, fontSize: 11, marginBottom: 8 },
  helperText: { color: colors.light.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 7 },
  currencyInput: {
    height: 48, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.background,
    borderWidth: 1, borderColor: colors.light.borderDefault, borderRadius: 12, paddingLeft: 13, paddingRight: 14,
  },
  currencyTextInput: { flex: 1, color: colors.light.textPrimary, fontSize: 13, paddingVertical: 0 },
  currency: { color: colors.light.textSecondary, fontSize: 12, fontWeight: '800' },
  textareaWrap: {
    minHeight: 145, backgroundColor: colors.light.background, borderWidth: 1,
    borderColor: colors.light.borderDefault, borderRadius: 12, padding: 12,
  },
  textarea: { flex: 1, minHeight: 112, color: colors.light.textPrimary, fontSize: 13, lineHeight: 19, padding: 0 },
  counter: { color: colors.light.textSecondary, fontSize: 11, textAlign: 'right' },
  publishError: { color: colors.light.danger, fontSize: 12, marginBottom: 12 },
  publishButton: {
    height: 53, alignItems: 'center', justifyContent: 'center', borderRadius: 12,
    backgroundColor: colors.light.primary,
  },
  publishText: { color: colors.light.white, fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.6 },
});
