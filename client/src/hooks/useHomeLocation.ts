import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

// Giữ vị trí tối đa 24 giờ và tải lại thiết bị khi di chuyển từ 150 m.
export const HOME_LOCATION_MOVEMENT_METERS = 150;
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;
export interface HomeCoordinate {
  latitude: number;
  longitude: number;
}
export type HomeLocationSource = 'CACHE' | 'LAST_KNOWN' | 'CURRENT';
let cachedLocation: Location.LocationObject | null = null;
export function validHomeCoordinate(coordinate: HomeCoordinate): boolean {
  return Number.isFinite(coordinate.latitude) && Math.abs(coordinate.latitude) <= 90 &&
    Number.isFinite(coordinate.longitude) && Math.abs(coordinate.longitude) <= 180;
}
export function homeDistanceMeters(from: HomeCoordinate, to: HomeCoordinate): number {
  const toRadians = (value: number) => value * Math.PI / 180;
  const haversineValue = Math.sin(toRadians(to.latitude - from.latitude) / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(toRadians(to.longitude - from.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, haversineValue)));
}
const debug = (...args: unknown[]) => {
  if (__DEV__) console.log('[HOME NEARBY]', ...args);
};

function isUsableCachedLocation(location: Location.LocationObject | null): location is Location.LocationObject {
  if (!location || !validHomeCoordinate(location.coords) || !Number.isFinite(location.timestamp)) {
    return false;
  }
  const ageInMilliseconds = Date.now() - location.timestamp;
  return ageInMilliseconds >= 0 && ageInMilliseconds <= MAX_CACHE_AGE_MS;
}

function selectCachedLocation(lastKnownLocation: Location.LocationObject | null): Location.LocationObject | null {
  if (isUsableCachedLocation(lastKnownLocation)) {
    if (!isUsableCachedLocation(cachedLocation) || lastKnownLocation.timestamp >= cachedLocation.timestamp) {
      return lastKnownLocation;
    }
  }
  if (isUsableCachedLocation(cachedLocation)) return cachedLocation;
  return null;
}

async function getCurrentLocationWithTimeout(): Promise<Location.LocationObject> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    // GPS có thể chờ lâu; timeout giúp người dùng thử lại sau 15 giây.
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: true }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Unable to determine your location. Check GPS and try again.')), 15000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

// Hook quản lý quyền, cache và vòng đời GPS riêng cho Home.
export function useHomeLocation(onLocation: (coordinate: HomeCoordinate, force: boolean) => void, enabled = true) {
  const callbackRef = useRef(onLocation);
  callbackRef.current = onLocation;
  const [position, setPosition] = useState<HomeCoordinate | null>(null);
  const [source, setSource] = useState<HomeLocationSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const latestLocationRef = useRef<HomeCoordinate | null>(null);
  const queryLocationRef = useRef<HomeCoordinate | null>(null);
  const isMountedRef = useRef(false);
  const refreshAttemptRef = useRef(0);
  const watchRevisionRef = useRef(0);
  const sourceRef = useRef<HomeLocationSource | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const applyLocation = (location: Location.LocationObject, locationSource: HomeLocationSource, force = false) => {
    const coordinate = { latitude: location.coords.latitude, longitude: location.coords.longitude };
    if (!validHomeCoordinate(coordinate)) throw new Error('Location returned invalid coordinates');
    const previousLocation = latestLocationRef.current;
    const sourceChanged = sourceRef.current !== locationSource;
    latestLocationRef.current = coordinate;
    cachedLocation = location;
    if (!previousLocation || homeDistanceMeters(previousLocation, coordinate) >= 1 || sourceChanged || force) {
      setPosition(coordinate);
    }
    sourceRef.current = locationSource;
    setSource(locationSource);
    setError(null);
    setWarning(null);
    setIsLocating(false);
    const hasMovedBeyondThreshold = !queryLocationRef.current || homeDistanceMeters(queryLocationRef.current, coordinate) >= HOME_LOCATION_MOVEMENT_METERS;
    if (hasMovedBeyondThreshold || sourceChanged || force) {
      debug('location source:', locationSource);
      debug('latitude:', coordinate.latitude);
      debug('longitude:', coordinate.longitude);
    }
    // GPS mới thay thế cache ngay; các lần cập nhật GPS sau dùng ngưỡng 150 m.
    const queryLocation = queryLocationRef.current;
    const hasCurrentFix = sourceChanged && locationSource === 'CURRENT';
    if (force || hasCurrentFix || !queryLocation || homeDistanceMeters(queryLocation, coordinate) >= HOME_LOCATION_MOVEMENT_METERS) {
      queryLocationRef.current = coordinate;
      callbackRef.current(coordinate, force);
    }
  };

  function handleWatchedLocation(location: Location.LocationObject) {
    if (!isMountedRef.current || !validHomeCoordinate(location.coords)) return;
    watchRevisionRef.current++;
    applyLocation(location, 'CURRENT');
  }

  async function startLocationWatch(isCurrentAttempt: () => boolean): Promise<boolean> {
    if (locationSubscriptionRef.current) return true;
    try {
      const subscription = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 1,
      }, handleWatchedLocation);
      if (!isCurrentAttempt()) {
        subscription.remove();
        return false;
      }
      locationSubscriptionRef.current = subscription;
    } catch (watchError) {
      // Watch không dùng được thì vẫn thử lấy GPS một lần.
      debug('watch unavailable:', watchError instanceof Error ? watchError.message : 'error');
    }
    return true;
  }

  async function checkLocationPermission(isCurrentAttempt: () => boolean): Promise<boolean> {
    // Giữ thứ tự kiểm tra quyền và request hiện hành như trước khi tách hàm.
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (!isCurrentAttempt()) return false;

    debug('permission:', permission.status);
    if (!permission.granted) {
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
      latestLocationRef.current = null;
      queryLocationRef.current = null;
      cachedLocation = null;
      setPosition(null);
      throw new Error('Allow location access to find nearby devices.');
    }
    return true;
  }

  async function checkLocationServices(isCurrentAttempt: () => boolean): Promise<boolean> {
    const areLocationServicesEnabled = await Location.hasServicesEnabledAsync();
    if (!isCurrentAttempt()) return false;

    debug('services:', areLocationServicesEnabled);
    if (!areLocationServicesEnabled) {
      throw new Error('Turn on location services to find nearby devices.');
    }
    return true;
  }

  async function applyCachedLocation(force: boolean, isCurrentAttempt: () => boolean): Promise<boolean> {
    const lastKnownLocation = await Location.getLastKnownPositionAsync().catch(() => null);
    if (!isCurrentAttempt()) return false;

    const cachedCandidate = selectCachedLocation(lastKnownLocation);
    if (!cachedCandidate) return true;

    const cachedSource = cachedCandidate === lastKnownLocation ? 'LAST_KNOWN' : 'CACHE';
    applyLocation(cachedCandidate, cachedSource, force);
    return true;
  }

  function handleLocationError(locationError: unknown, force: boolean) {
    const errorMessage = locationError instanceof Error
      ? locationError.message
      : 'Unable to determine your location.';
    debug('location error:', errorMessage);

    const lastUsableLocation = latestLocationRef.current;
    if (!lastUsableLocation) {
      setError(errorMessage);
      debug('location source:', 'NONE');
      return;
    }

    // GPS lỗi tạm thời: giữ vị trí hợp lệ và danh sách đang có.
    setWarning(errorMessage);
    if (force) callbackRef.current(lastUsableLocation, true);
  }

  // Giữ refresh ổn định để các effect không đăng ký lại listener sau mỗi render.
  const refresh = useCallback(async (force = false) => {
    if (!enabled) return;
    const refreshAttempt = ++refreshAttemptRef.current;
    // Bỏ qua kết quả khi đã unmount hoặc có lần refresh mới hơn.
    const isCurrentAttempt = () => isMountedRef.current && refreshAttempt === refreshAttemptRef.current;
    if (!latestLocationRef.current) setIsLocating(true);
    if (force) setIsRefreshingLocation(true);
    setError(null);
    setWarning(null);
    try {
      const hasLocationPermission = await checkLocationPermission(isCurrentAttempt);
      if (!isCurrentAttempt() || !hasLocationPermission) return;

      const hasLocationServices = await checkLocationServices(isCurrentAttempt);
      if (!isCurrentAttempt() || !hasLocationServices) return;

      if (!latestLocationRef.current) {
        const canContinueAfterCache = await applyCachedLocation(force, isCurrentAttempt);
        if (!isCurrentAttempt() || !canContinueAfterCache) return;
      }
      if (!locationSubscriptionRef.current) {
        const canContinueAfterWatch = await startLocationWatch(isCurrentAttempt);
        if (!canContinueAfterWatch) return;
      }
      // Vị trí mới từ watch phải thắng kết quả GPS một lần trả về chậm.
      const watchRevision = watchRevisionRef.current;
      const currentLocation = await getCurrentLocationWithTimeout();
      if (!isCurrentAttempt()) return;
      if (watchRevision === watchRevisionRef.current) {
        applyLocation(currentLocation, 'CURRENT', force);
      } else if (force && latestLocationRef.current) {
        callbackRef.current(latestLocationRef.current, true);
      }
    } catch (error) {
      if (!isCurrentAttempt()) return;
      handleLocationError(error, force);
    } finally {
      if (isCurrentAttempt()) {
        setIsLocating(false);
        setIsRefreshingLocation(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    isMountedRef.current = true;
    void refresh();
    const lifecycle = AppState.addEventListener('change', (state: string) => {
      if (state === 'active') void refresh();
    });
    return () => {
      isMountedRef.current = false;
      refreshAttemptRef.current++;
      // Gỡ listener và watch để không cập nhật màn hình đã unmount.
      lifecycle.remove();
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
      queryLocationRef.current = null;
      latestLocationRef.current = null;
    };
  }, [refresh]);
  const firstFocusRef = useRef(true);
  useFocusEffect(useCallback(() => {
    if (firstFocusRef.current) {
      firstFocusRef.current = false;
      return;
    }
    void refresh();
  }, [refresh]));

  return { position, source, error, warning, isLocating, isRefreshingLocation, refresh };
}
