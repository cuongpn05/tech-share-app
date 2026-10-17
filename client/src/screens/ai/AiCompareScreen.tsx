import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AIComparison } from '../../types/ai';
import { Device } from '../../types';
import { API_BASE_URL } from '../../config/api';
import { deviceService } from '../../services/deviceService';
import { AIServiceError, compareDevices } from '../../services/aiService';
import { ComparisonTable } from '../../components/ai/ComparisonTable';
import { colors } from '../../theme/tokens';
import { STRINGS } from '../../constants/strings';

type DeviceSlot = 'device1' | 'device2';

const formatPrice = (price: number) => `${price.toLocaleString('en-US')} ₫/day`;
const getImageUri = (image?: string) => {
  if (!image) {
    return 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600';
  }
  if (/^https?:\/\//i.test(image)) return image;

  const serverOrigin = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${serverOrigin}${image.startsWith('/') ? image : `/${image}`}`;
};

export function AiCompareScreen() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [device1, setDevice1] = useState<Device | null>(null);
  const [device2, setDevice2] = useState<Device | null>(null);
  const [comparison, setComparison] = useState<AIComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [error, setError] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [activeSlot, setActiveSlot] = useState<DeviceSlot | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDevices = async () => {
      try {
        const result = await deviceService.getDevices({ limit: 100 });
        if (isMounted) setDevices(result);
      } catch (loadError: unknown) {
        console.error('[AiCompareScreen] Unable to load devices:', loadError);
        if (isMounted) setError(STRINGS.AI_COMPARE.ERR_LOAD_DEVICES);
      } finally {
        if (isMounted) setDevicesLoading(false);
      }
    };

    void loadDevices();
    return () => {
      isMounted = false;
    };
  }, []);

  const openDevicePicker = (slot: DeviceSlot) => {
    setActiveSlot(slot);
    setPickerVisible(true);
  };

  const chooseDevice = (device: Device) => {
    if (activeSlot === 'device1') {
      setDevice1(device);
    } else if (activeSlot === 'device2') {
      setDevice2(device);
    }
    setComparison(null);
    setError('');
    setPickerVisible(false);
  };

  const handleCompare = async () => {
    if (!device1 || !device2) {
      setError(STRINGS.AI_COMPARE.ERR_SELECT_TWO);
      return;
    }

    if (device1._id === device2._id) {
      setError(STRINGS.AI_COMPARE.ERR_SELECT_DIFF);
      return;
    }

    setError('');
    setLoading(true);
    try {
      const data = await compareDevices(device1._id, device2._id);
      setComparison(data);
    } catch (requestError: unknown) {
      console.error('[AiCompareScreen] Device comparison failed:', requestError);
      const message =
        requestError instanceof AIServiceError && requestError.status === 503
          ? STRINGS.AI_COMPARE.ERR_AI_BUSY
          : STRINGS.AI_COMPARE.ERR_COMPARE_FAILED;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const renderSelectedDevice = (device: Device | null, slot: DeviceSlot) => (
    <View style={styles.deviceCard}>
      {device ? (
        <>
          <Image
            source={{
              uri: getImageUri(device.images?.[0]),
            }}
            style={styles.deviceImage}
          />
          <Text style={styles.deviceName}>{device.title}</Text>
          <Text style={styles.deviceBrand}>{device.brand}</Text>
          <Text style={styles.devicePrice}>{formatPrice(device.dailyRate)}</Text>
        </>
      ) : (
        <Text style={styles.emptySelection}>{STRINGS.AI_COMPARE.NO_SELECTION}</Text>
      )}
      <TouchableOpacity
        style={styles.selectButton}
        onPress={() => openDevicePicker(slot)}
        activeOpacity={0.8}
      >
        <Text style={styles.selectButtonText}>
          {device ? STRINGS.AI_COMPARE.CHANGE_DEVICE : STRINGS.AI_COMPARE.SELECT_DEVICE}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{STRINGS.AI_COMPARE.HEADING}</Text>

        {devicesLoading ? (
          <View style={styles.devicesLoading}>
            <ActivityIndicator color={colors.brand[500]} />
            <Text style={styles.loadingText}>{STRINGS.AI_COMPARE.LOADING_DEVICES}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.slotTitle}>{STRINGS.AI_COMPARE.SLOT_DEVICE_1}</Text>
            {renderSelectedDevice(device1, 'device1')}

            <Text style={styles.versus}>{STRINGS.AI_COMPARE.VERSUS}</Text>

            <Text style={styles.slotTitle}>{STRINGS.AI_COMPARE.SLOT_DEVICE_2}</Text>
            {renderSelectedDevice(device2, 'device2')}
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.compareButton, loading && styles.disabledButton]}
          onPress={handleCompare}
          disabled={loading || devicesLoading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Ionicons name="git-compare-outline" size={18} color={colors.text.inverse} />
          )}
          <Text style={styles.compareButtonText}>{STRINGS.AI_COMPARE.COMPARE_BUTTON}</Text>
        </TouchableOpacity>

        {loading ? (
          <Text style={styles.loadingText}>{STRINGS.AI_COMPARE.COMPARING_STATE}</Text>
        ) : null}

        {comparison && device1 && device2 ? (
          <ComparisonTable
            device1={device1}
            device2={device2}
            comparison={comparison}
          />
        ) : null}
      </ScrollView>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.picker}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{STRINGS.AI_COMPARE.PICKER_TITLE}</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={devices}
              keyExtractor={(item) => item._id}
              ListEmptyComponent={
                <Text style={styles.emptyList}>{STRINGS.AI_COMPARE.PICKER_EMPTY}</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.deviceOption}
                  onPress={() => chooseDevice(item)}
                >
                  <Text style={styles.optionName}>{item.title}</Text>
                  <Text style={styles.deviceBrand}>
                    {item.brand} · {formatPrice(item.dailyRate)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
    paddingTop: 24,
  },
  heading: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
  },
  slotTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  deviceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border.light,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  deviceImage: {
    width: '100%',
    height: 150,
    backgroundColor: colors.border.light,
    borderRadius: 10,
    marginBottom: 10,
  },
  deviceName: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  deviceBrand: {
    color: colors.text.secondary,
    fontSize: 13,
    marginTop: 4,
  },
  devicePrice: {
    color: colors.brand[600],
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  emptySelection: {
    color: colors.text.secondary,
    paddingVertical: 18,
    textAlign: 'center',
  },
  selectButton: {
    alignItems: 'center',
    backgroundColor: colors.brand[100],
    borderRadius: 10,
    marginTop: 12,
    paddingVertical: 11,
  },
  selectButtonText: {
    color: colors.brand[700],
    fontSize: 14,
    fontWeight: '700',
  },
  versus: {
    color: colors.text.secondary,
    fontSize: 16,
    fontWeight: '800',
    marginVertical: 16,
    textAlign: 'center',
  },
  compareButton: {
    alignItems: 'center',
    backgroundColor: colors.brand[600],
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 14,
  },
  disabledButton: {
    opacity: 0.7,
  },
  compareButtonText: {
    color: colors.text.inverse,
    fontSize: 15,
    fontWeight: '700',
  },
  error: {
    color: colors.red,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  devicesLoading: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  modalOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  picker: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '75%',
    padding: 18,
  },
  pickerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pickerTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  deviceOption: {
    borderBottomColor: colors.border.light,
    borderBottomWidth: 1,
    paddingVertical: 14,
  },
  optionName: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyList: {
    color: colors.text.secondary,
    paddingVertical: 24,
    textAlign: 'center',
  },
});
