import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

/**
 * ============================================================================
 * useHomeLocation.ts
 *
 * TRÁCH NHIỆM (RESPONSIBILITY):
 * Quản lý toàn bộ vòng đời và logic định vị GPS của người dùng:
 * 1. Xin quyền truy cập GPS từ người dùng (`expo-location`).
 * 2. Tải nhanh vị trí gần nhất (`lastKnownLocation`) để tránh màn hình trắng ban đầu.
 * 3. Lấy tọa độ GPS chuẩn xác từ vệ tinh/thiết bị (`getCurrentUserLocation`).
 * 4. Theo dõi di chuyển của người dùng bằng `Location.watchPositionAsync`.
 * 5. Sử dụng công thức Haversine để tính khoảng cách: Chỉ tải lại danh sách thiết bị
 *    khi người dùng di chuyển lệch khỏi vị trí cũ từ 150 mét trở lên.
 * 6. Reverse Geocoding: Đổi tọa độ (lat, lng) sang tên địa phương dễ hiểu (Quận, Thành phố).
 * 7. Hủy đăng ký theo dõi (cleanup watcher) khi rời khỏi màn hình để bảo vệ pin thiết bị.
 * ============================================================================
 */

/**
 * Ngưỡng di chuyển (150m):
 * TẠI SAO DÙNG 150 MÉT?
 * Khi người dùng đứng yên hoặc đi lại trong nhà, GPS di động có độ nhiễu tự nhiên (vài mét đến chục mét).
 * Nếu mỗi dao động nhỏ đều gọi API tải lại thiết bị, app sẽ bị giật lag, tốn băng thông và hao pin.
 * Ngưỡng 150m đảm bảo người dùng thực sự đã đi sang một khu vực mới thì mới kích hoạt reload.
 */
export const HOME_LOCATION_MOVEMENT_METERS = 150;

/** Thời gian tối đa lưu bộ nhớ tạm vị trí (24 giờ) */
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

export interface HomeCoordinate {
  latitude: number;
  longitude: number;
}

/** Tọa độ mặc định an toàn (Hà Nội, Việt Nam) khi máy ảo hoặc thiết bị chưa kịp khóa sóng GPS */
export const DEFAULT_HOME_COORDINATE: HomeCoordinate = {
  latitude: 21.0285,
  longitude: 105.8542,
};

export type HomeLocationSource = 'CACHE' | 'LAST_KNOWN' | 'CURRENT';

let memoryCachedLocation: Location.LocationObject | null = null;

// ============================================================================
// CÁC HÀM TIỆN ÍCH TÍNH TOÁN & KIỂM TRA TỌA ĐỘ
// ============================================================================

/**
 * Kiểm tra tính hợp lệ của tọa độ GPS:
 * - Vĩ độ (Latitude) nằm trong khoảng [-90, 90]
 * - Kinh độ (Longitude) nằm trong khoảng [-180, 180]
 */
export function validHomeCoordinate(coord: HomeCoordinate): boolean {
  return (
    Number.isFinite(coord.latitude) &&
    Math.abs(coord.latitude) <= 90 &&
    Number.isFinite(coord.longitude) &&
    Math.abs(coord.longitude) <= 180
  );
}

/**
 * Công thức Haversine tính khoảng cách đường cong mặt cầu giữa 2 tọa độ (đơn vị: mét):
 * d = 2R * arcsin(sqrt(sin²(Δlat/2) + cos(lat1)*cos(lat2)*sin²(Δlng/2)))
 * Trong đó R = 6,371,000 mét (bán kính Trái Đất).
 */
export function homeDistanceMeters(from: HomeCoordinate, to: HomeCoordinate): number {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLng / 2) ** 2;

  const c = 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  return 6371000 * c;
}

// ============================================================================
// CÁC HÀM TÁCH NHỎ XỬ LÝ GPS ĐỘC LẬP (BEGINNER-FRIENDLY GPS OPERATIONS)
// ============================================================================

/**
 * 1. Xin quyền truy cập vị trí từ người dùng
 */
export async function requestLocationPermission(): Promise<boolean> {
  let { status } = await Location.getForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) {
    const requestResult = await Location.requestForegroundPermissionsAsync();
    status = requestResult.status;
  }
  return status === Location.PermissionStatus.GRANTED;
}

/**
 * 2. Kiểm tra dịch vụ định vị (GPS máy) đã được bật hay chưa
 */
export async function checkLocationServicesEnabled(): Promise<boolean> {
  return await Location.hasServicesEnabledAsync();
}

/**
 * 3. Lấy vị trí đã biết gần nhất trong bộ nhớ cache máy (Fast Load)
 * TẠI SAO LẤY VỊ TRÍ NÀY ĐẦU TIÊN?
 * Việc dò tìm vệ tinh GPS thời gian thực có thể mất từ 2-5 giây. Lấy lastKnownLocation
 * giúp ứng dụng hiển thị thiết bị lân cận ngay tức thì trong lần render đầu tiên.
 */
export async function getLastKnownLocation(): Promise<Location.LocationObject | null> {
  try {
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown && validHomeCoordinate(lastKnown.coords)) {
      const age = Date.now() - lastKnown.timestamp;
      if (age >= 0 && age <= MAX_CACHE_AGE_MS) {
        return lastKnown;
      }
    }
  } catch {
    // Nếu thiết bị không có vị trí cũ, bỏ qua
  }
  return null;
}

/**
 * 4. Lấy vị trí GPS thời gian thực với cơ chế Fallback đa tầng (Multi-tier Fallback):
 * - Tầng 1: Thử lấy vị trí Balanced (GPS vệ tinh + mạng) trong tối đa 5 giây.
 * - Tầng 2: Nếu GPS vệ tinh chưa kịp phản hồi (trong nhà hoặc máy ảo), tự động hạ xuống
 *          độ chính xác Low (lấy nhanh qua Wifi/Cell tower trong < 2.5 giây).
 * - Tầng 3: Nếu cả 2 đều chưa có, lấy vị trí đã biết gần nhất của máy (getLastKnownPositionAsync).
 * Nhờ cơ chế này, app luôn lấy được vị trí mà không bao giờ bị nghẽn hay timeout làm phiền người dùng.
 */
export async function getCurrentUserLocation(): Promise<Location.LocationObject | null> {
  // Tầng 1: Balanced (vệ tinh + mạng di động)
  try {
    const loc = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: false,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
    if (loc && validHomeCoordinate(loc.coords)) {
      return loc;
    }
  } catch {
    // Tiếp tục tầng 2
  }

  // Tầng 2: Low (Wifi / Cell tower - rất nhạy và phản hồi cực nhanh trên máy ảo và trong phòng)
  try {
    const loc = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
        mayShowUserSettingsDialog: false,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    if (loc && validHomeCoordinate(loc.coords)) {
      return loc;
    }
  } catch {
    // Tiếp tục tầng 3
  }

  // Tầng 3: Vị trí cuối cùng mà hệ điều hành từng ghi nhận
  try {
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown && validHomeCoordinate(lastKnown.coords)) {
      return lastKnown;
    }
  } catch {
    // Không có
  }

  return null;
}

/**
 * 5. Chuyển đổi tọa độ thành tên địa danh (Reverse Geocoding)
 */
export async function reverseGeocodeLocation(coord: HomeCoordinate): Promise<string | null> {
  try {
    const addresses = await Location.reverseGeocodeAsync({
      latitude: coord.latitude,
      longitude: coord.longitude,
    });
    if (addresses && addresses.length > 0) {
      const item = addresses[0];
      const district = item.subregion || item.district;
      const city = item.city || item.region;
      const formatted = [district, city].filter(Boolean).join(', ') || item.name;
      return formatted || null;
    }
  } catch {
    // Không dịch được tên địa danh thì không ảnh hưởng đến tọa độ
  }
  return null;
}

/**
 * 6. Bắt đầu theo dõi di chuyển vị trí liên tục
 */
export async function startWatchingLocation(
  onLocationChanged: (location: Location.LocationObject) => void
): Promise<Location.LocationSubscription | null> {
  try {
    return await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      onLocationChanged
    );
  } catch {
    return null;
  }
}

/**
 * 7. Dừng theo dõi vị trí để bảo toàn pin
 */
export function stopWatchingLocation(
  subscription: Location.LocationSubscription | null
): void {
  if (subscription) {
    subscription.remove();
  }
}

// ============================================================================
// CUSTOM HOOK CHÍNH: useHomeLocation
// ============================================================================

export function useHomeLocation(
  onLocationUpdate: (coordinate: HomeCoordinate, force: boolean) => void,
  enabled = true
) {
  // Callback ref giữ tham chiếu mới nhất để tránh re-render lặp
  const callbackRef = useRef(onLocationUpdate);
  callbackRef.current = onLocationUpdate;

  // State vị trí và trạng thái
  const [position, setPosition] = useState<HomeCoordinate | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [source, setSource] = useState<HomeLocationSource | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Refs theo dõi vòng đời component
  const latestCoordRef = useRef<HomeCoordinate | null>(null);
  const lastQueriedCoordRef = useRef<HomeCoordinate | null>(null);
  const isMountedRef = useRef(true);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  /**
   * Cập nhật vị trí vào State và kích hoạt tải dữ liệu nếu di chuyển >= 150m
   */
  const applyCoordinates = async (
    locationObj: Location.LocationObject,
    locSource: HomeLocationSource,
    force = false
  ) => {
    const newCoord: HomeCoordinate = {
      latitude: locationObj.coords.latitude,
      longitude: locationObj.coords.longitude,
    };

    if (!validHomeCoordinate(newCoord)) return;

    latestCoordRef.current = newCoord;
    memoryCachedLocation = locationObj;
    setPosition(newCoord);
    setSource(locSource);
    setError(null);
    setWarning(null);
    setIsLocating(false);

    // Kiểm tra xem vị trí mới đã cách vị trí truy vấn lần trước >= 150m chưa
    const lastQueried = lastQueriedCoordRef.current;
    const distanceMoved = lastQueried ? homeDistanceMeters(lastQueried, newCoord) : Infinity;
    const shouldReloadDevices = force || !lastQueried || distanceMoved >= HOME_LOCATION_MOVEMENT_METERS;

    if (shouldReloadDevices) {
      lastQueriedCoordRef.current = newCoord;
      callbackRef.current(newCoord, force);

      // Lấy tên thành phố hiển thị trên UI
      const name = await reverseGeocodeLocation(newCoord);
      if (isMountedRef.current && name) {
        setCityName(name);
      }
    }
  };

  /**
   * Hàm làm mới vị trí GPS (Refresh function)
   */
  const refresh = useCallback(
    async (force = false) => {
      if (!enabled) return;

      if (!latestCoordRef.current) setIsLocating(true);
      if (force) setIsRefreshingLocation(true);
      setError(null);
      setWarning(null);

      try {
        // Bước 1: Kiểm tra quyền
        const hasPermission = await requestLocationPermission();
        if (!isMountedRef.current) return;
        if (!hasPermission) {
          setError('Location permission is required to discover nearby devices.');
          setIsLocating(false);
          setIsRefreshingLocation(false);
          return;
        }

        // Bước 2: Kiểm tra GPS máy đã bật chưa
        const isServicesEnabled = await checkLocationServicesEnabled();
        if (!isMountedRef.current) return;
        if (!isServicesEnabled) {
          setError('Please enable GPS / location services on your device.');
          setIsLocating(false);
          setIsRefreshingLocation(false);
          return;
        }

        // Bước 3: Nạp nhanh vị trí cache/last-known nếu chưa có vị trí nào
        if (!latestCoordRef.current) {
          const fastLocation = (await getLastKnownLocation()) || memoryCachedLocation;
          if (fastLocation && isMountedRef.current) {
            await applyCoordinates(fastLocation, 'LAST_KNOWN', force);
          }
        }

        // Bước 4: Lấy GPS chính xác thời gian thực
        const freshGps = await getCurrentUserLocation();
        if (isMountedRef.current && freshGps) {
          await applyCoordinates(freshGps, 'CURRENT', force);
        }

        // Bước 5: Bắt đầu watcher để tự động phát hiện khi di chuyển
        if (!watcherRef.current) {
          watcherRef.current = await startWatchingLocation((watchedLocation) => {
            if (isMountedRef.current) {
              void applyCoordinates(watchedLocation, 'CURRENT', false);
            }
          });
        }

        // Bước 6: Trường hợp máy ảo mới hoặc thiết bị chưa có GPS trong cache
        // Sử dụng tọa độ an toàn mặc định để tải danh sách thiết bị
        if (!latestCoordRef.current && isMountedRef.current) {
          const fallbackLocation: Location.LocationObject = {
            coords: {
              latitude: DEFAULT_HOME_COORDINATE.latitude,
              longitude: DEFAULT_HOME_COORDINATE.longitude,
              altitude: 0,
              accuracy: 100,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          };
          await applyCoordinates(fallbackLocation, 'CACHE', force);
        }
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        // Nếu đã có vị trí (từ cache/last-known/default), tiếp tục dùng ổn định, KHÔNG hiện warning
        if (latestCoordRef.current) {
          if (force) callbackRef.current(latestCoordRef.current, true);
        } else {
          // Chỉ báo lỗi khi thực sự không có tọa độ nào
          const msg = err instanceof Error ? err.message : 'Unable to determine location';
          setError(msg);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLocating(false);
          setIsRefreshingLocation(false);
        }
      }
    },
    [enabled]
  );

  // Vòng đời Lifecycle: Tự động refresh khi mount hoặc khi app từ background quay lại active
  useEffect(() => {
    isMountedRef.current = true;
    if (enabled) {
      void refresh();
    }

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && enabled) {
        void refresh();
      }
    });

    return () => {
      isMountedRef.current = false;
      appStateSub.remove();
      stopWatchingLocation(watcherRef.current);
      watcherRef.current = null;
    };
  }, [enabled, refresh]);

  // Làm mới khi tab Home được focus lại
  const firstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        return;
      }
      if (enabled) {
        void refresh();
      }
    }, [enabled, refresh])
  );

  return {
    position,
    source,
    error,
    warning,
    isLocating,
    isRefreshingLocation,
    refresh,
    cityName,
  };
}
