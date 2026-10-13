import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

// Same location policy as MapScreen: 24h last-known, High accuracy, 150m movement.
export const HOME_LOCATION_MOVEMENT_METERS = 150;
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;
export interface HomeCoordinate { latitude: number; longitude: number }
export type HomeLocationSource = 'CACHE' | 'LAST_KNOWN' | 'CURRENT';
let cachedLocation: Location.LocationObject | null = null;
export function validHomeCoordinate(coordinate: HomeCoordinate): boolean {
  return Number.isFinite(coordinate.latitude) && Math.abs(coordinate.latitude) <= 90 &&
    Number.isFinite(coordinate.longitude) && Math.abs(coordinate.longitude) <= 180;
}
export function homeDistanceMeters(from: HomeCoordinate, to: HomeCoordinate): number {
  const rad = (value: number) => value * Math.PI / 180;
  const a = Math.sin(rad(to.latitude - from.latitude) / 2) ** 2 +
    Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(rad(to.longitude - from.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}
const debug = (...args: unknown[]) => { if (__DEV__) console.log('[HOME NEARBY]', ...args); };

/** Mirrors Map's cache -> current refresh -> watch/lifecycle architecture without changing Map. */
export function useHomeLocation(onLocation: (coordinate: HomeCoordinate, force: boolean) => void) {
  const callbackRef = useRef(onLocation);
  callbackRef.current = onLocation;
  const [position, setPosition] = useState(null as HomeCoordinate | null);
  const [source, setSource] = useState(null as HomeLocationSource | null);
  const [error, setError] = useState(null as string | null);
  const [warning, setWarning] = useState(null as string | null);
  const [isLocating, setIsLocating] = useState(true);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const latestRef = useRef(null as HomeCoordinate | null);
  const anchorRef = useRef(null as HomeCoordinate | null);
  const activeRef = useRef(false);
  const attemptRef = useRef(0);
  const revisionRef = useRef(0);
  const sourceRef = useRef(null as HomeLocationSource | null);
  const watchRef = useRef(null as Location.LocationSubscription | null);

  const apply = (location: Location.LocationObject, locationSource: HomeLocationSource, force = false) => {
    const coordinate = { latitude: location.coords.latitude, longitude: location.coords.longitude };
    if (!validHomeCoordinate(coordinate)) throw new Error('Location returned invalid coordinates');
    const previous = latestRef.current;
    const sourceChanged = sourceRef.current !== locationSource;
    latestRef.current = coordinate;
    cachedLocation = location;
    if (!previous || homeDistanceMeters(previous, coordinate) >= 1 || sourceChanged || force) {
      setPosition(coordinate);
    }
    sourceRef.current = locationSource;
    setSource(locationSource); setError(null); setWarning(null); setIsLocating(false);
    const moved = !anchorRef.current || homeDistanceMeters(anchorRef.current, coordinate) >= HOME_LOCATION_MOVEMENT_METERS;
    if (moved || sourceChanged || force) {
      debug('location source:', locationSource);
      debug('latitude:', coordinate.latitude); debug('longitude:', coordinate.longitude);
    }
    const anchor = anchorRef.current;
    if (force || !anchor || homeDistanceMeters(anchor, coordinate) >= HOME_LOCATION_MOVEMENT_METERS) {
      anchorRef.current = coordinate;
      callbackRef.current(coordinate, force);
    }
  };

  const refresh = useCallback(async (force = false) => {
    const attempt = ++attemptRef.current;
    const active = () => activeRef.current && attempt === attemptRef.current;
    if (!latestRef.current) setIsLocating(true);
    if (force) setIsRefreshingLocation(true);
    setError(null); setWarning(null);
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) permission = await Location.requestForegroundPermissionsAsync();
      if (!active()) return;
      debug('permission:', permission.status);
      if (!permission.granted) throw new Error('Allow location access to find nearby devices.');
      const services = await Location.hasServicesEnabledAsync();
      if (!active()) return;
      debug('services:', services);
      if (!services) throw new Error('Turn on location services to find nearby devices.');
      if (!latestRef.current) {
        const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
        if (!active()) return;
        const usable = (location: Location.LocationObject | null) => location &&
          validHomeCoordinate(location.coords) && Number.isFinite(location.timestamp) &&
          Date.now() - location.timestamp >= 0 && Date.now() - location.timestamp <= MAX_CACHE_AGE_MS;
        const candidate = usable(lastKnown) && (!usable(cachedLocation) || lastKnown!.timestamp >= cachedLocation!.timestamp)
          ? lastKnown : usable(cachedLocation) ? cachedLocation : null;
        if (candidate) apply(candidate, candidate === lastKnown ? 'LAST_KNOWN' : 'CACHE', force);
      }
      if (!watchRef.current) {
        try {
          const subscription = await Location.watchPositionAsync({
            accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1,
          }, location => {
            if (!activeRef.current || !validHomeCoordinate(location.coords)) return;
            revisionRef.current++;
            apply(location, 'CURRENT');
          });
          if (!active()) { subscription.remove(); return; }
          watchRef.current = subscription;
        } catch (watchError) { debug('watch unavailable:', watchError instanceof Error ? watchError.message : 'error'); }
      }
      // A newer watch event must win over a slow one-shot GPS result.
      const revision = revisionRef.current;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const current = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: true }),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error('Unable to determine your location. Check GPS and try again.')), 15000);
          }),
        ]);
        if (!active()) return;
        if (revision === revisionRef.current) apply(current, 'CURRENT', force);
        else if (force && latestRef.current) callbackRef.current(latestRef.current, true);
      } finally { if (timeout) clearTimeout(timeout); }
    } catch (err) {
      if (!active()) return;
      const message = err instanceof Error ? err.message : 'Unable to determine your location.';
      debug('location error:', message);
      if (latestRef.current) {
        // A transient GPS error cannot erase usable devices or a valid cache.
        setWarning(message);
        if (force) callbackRef.current(latestRef.current, true);
      } else { setError(message); debug('location source:', 'NONE'); }
    } finally { if (active()) { setIsLocating(false); setIsRefreshingLocation(false); } }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    void refresh();
    const lifecycle = AppState.addEventListener('change', (state: string) => {
      if (state === 'active') void refresh();
    });
    return () => {
      activeRef.current = false; attemptRef.current++;
      lifecycle.remove(); watchRef.current?.remove(); watchRef.current = null;
    };
  }, [refresh]);
  const firstFocusRef = useRef(true);
  useFocusEffect(useCallback(() => {
    if (firstFocusRef.current) { firstFocusRef.current = false; return; }
    void refresh();
  }, [refresh]));

  return { position, source, error, warning, isLocating, isRefreshingLocation, refresh };
}
