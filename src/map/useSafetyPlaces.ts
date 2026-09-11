import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  safetyPlaceApi,
  type SafetyPlace,
  type SafetyPlaceType,
} from '../api/safetyPlaceApi';
import { roughDistance, type Coords } from './useNearbyPlaces';
import type { City } from '../data/cities';

const RADIUS_M = 10_000;
export type MapBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};
const ALL_TYPES: SafetyPlaceType[] = [
  'hospital',
  'femaleHouse',
  'cctv',
  'streetlight',
  'food',
];

export function useSafetyPlaces(
  center: Coords,
  /** 조회할 충북 시군 — 사용자 좌표 대신 시군명·코드로 서버를 좁힙니다. */
  city: City,
  active: SafetyPlaceType[],
  preloadAll: boolean = false,
  countCenter: Coords = center,
  bounds: MapBounds | null = null,
) {
  /** 지역이 바뀌면 결과도 달라지므로 캐시 키에 지역을 함께 넣습니다. */
  const [cache, setCache] = useState<Record<string, SafetyPlace[]>>({});
  const [loadingTypes, setLoadingTypes] = useState<SafetyPlaceType[]>([]);
  const [errors, setErrors] = useState<SafetyPlaceType[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const requestedTypes = preloadAll ? ALL_TYPES : active;
  const key = [...requestedTypes].sort().join(',');
  const cacheKey = useCallback(
    (type: SafetyPlaceType) => `${city.municipalityCode}|${type}`,
    [city.municipalityCode],
  );

  useEffect(() => {
    const requested = [...requestedTypes];
    if (!requested.length) return;
    const controller = new AbortController();
    setLoadingTypes(requested);
    setErrors([]);
    Promise.allSettled(
      requested.map(type => safetyPlaceApi.list(type, city, controller.signal)),
    ).then(results => {
      if (controller.signal.aborted) return;
      setCache(previous => {
        const next = { ...previous };
        results.forEach((result, index) => {
          if (result.status === 'fulfilled')
            next[cacheKey(requested[index])] = result.value;
        });
        return next;
      });
      setErrors(
        requested.filter((_, index) => results[index].status === 'rejected'),
      );
      setLoadingTypes([]);
    });
    return () => controller.abort();
  }, [key, city.municipalityCode, cacheKey, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const isVisible = useCallback(
    (place: SafetyPlace, fallbackCenter: Coords) => {
      if (!bounds) return roughDistance(fallbackCenter, place) <= RADIUS_M;
      const insideLatitude =
        place.lat >= bounds.south && place.lat <= bounds.north;
      // 일반적인 경우 west <= east. 날짜변경선을 걸친 화면도 안전하게 처리합니다.
      const insideLongitude =
        bounds.west <= bounds.east
          ? place.lng >= bounds.west && place.lng <= bounds.east
          : place.lng >= bounds.west || place.lng <= bounds.east;
      return insideLatitude && insideLongitude;
    },
    [bounds],
  );

  const places = useMemo(
    () =>
      active
        .flatMap(type => cache[cacheKey(type)] ?? [])
        .filter(place => isVisible(place, center)),
    [active, cache, cacheKey, center, isVisible],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        ALL_TYPES.map(type => [
          type,
          (cache[cacheKey(type)] ?? []).filter(place =>
            isVisible(place, countCenter),
          ).length,
        ]),
      ) as Record<SafetyPlaceType, number>,
    [cache, cacheKey, countCenter, isVisible],
  );
  const retry = useCallback(() => setReloadKey(value => value + 1), []);
  return {
    places,
    counts,
    loading: loadingTypes.length > 0,
    loadingTypes,
    errors,
    retry,
  };
}
