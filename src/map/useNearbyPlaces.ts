/**
 * 지도 마커용 주변 관광정보 조회 훅.
 *
 * 지도를 움직일 때마다 요청하면 API 를 남발하게 되므로, 조회는 화면이 넘겨주는
 * `center` 가 실제로 바뀔 때만 일어납니다. 지도를 끌고 다니는 동안의 중심 변화는
 * 화면이 따로 들고 있다가 "이 지역에서 재검색" 을 누를 때 center 로 넘겨 줍니다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_RADIUS, REGION_PAGE_SIZE, travelApi } from '../api/travelApi';
import type { City } from '../data/cities';
import type { TourCategory } from '../types/tourPlace';
import {
  isMappableTourContent,
  type MappableTourContent,
} from '../types/travel';

export type Coords = { lat: number; lng: number };
export type ViewportBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

type State = {
  places: MappableTourContent[];
  loading: boolean;
  error: string | null;
  /** 서버가 알려 준 반경 안 전체 건수 (가져온 건수보다 클 수 있습니다) */
  totalCount: number;
};

type RegionCacheEntry = {
  items: MappableTourContent[];
  expiresAt: number;
};

/** 같은 충북 목록을 지도에 들어올 때마다 다시 받지 않도록 10분간 보관합니다. (키: 법정동 시군구 코드) */
const REGION_CACHE_TTL_MS = 10 * 60 * 1000;
const regionCache = new Map<string, RegionCacheEntry>();

const INITIAL: State = {
  places: [],
  loading: false,
  error: null,
  totalCount: 0,
};

export function useNearbyPlaces(
  center: Coords,
  /** 조회할 충북 시군 — 법정동 코드로 관광정보를 받습니다. */
  city: City,
  category: TourCategory,
  /** false 면 조회하지 않습니다 (축제처럼 다른 API 를 쓰는 카테고리). */
  enabled: boolean = true,
  radius: number = DEFAULT_RADIUS,
  /** "이 지역에서 재검색"을 누른 순간의 지도 화면 경계 */
  bounds: ViewportBounds | null = null,
) {
  const [state, setState] = useState<State>(INITIAL);
  /** 재시도 버튼이 같은 좌표로도 다시 요청하게 만드는 카운터 */
  const [reloadKey, setReloadKey] = useState(0);

  // 좌표는 서버 요청이 아니라 내려받은 지역 후보의 기기 내 필터링에만 씁니다.
  const { lat, lng } = center;

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState(INITIAL);
      return;
    }

    const controller = new AbortController();
    // 조회 지역이 바뀐 동안 이전 지역 마커가 남아 있으면 현재 지역 결과로
    // 오해할 수 있으므로 새 응답이 올 때까지 비웁니다.
    setState({ places: [], loading: true, error: null, totalCount: 0 });

    async function loadRegion() {
      const cacheKey = city.municipalityCode;
      const cached = regionCache.get(cacheKey);
      if (reloadKey === 0 && cached && cached.expiresAt > Date.now()) {
        return { items: cached.items, totalCount: cached.items.length };
      }

      const loadAllTourism = async () => {
        const items: MappableTourContent[] = [];
        let pageNo = 1;
        let totalCount = 0;
        let totalPages = 1;

        do {
          const page = await travelApi.listSpotsByRegion(
            {
              regionCode: city.regionCode,
              districtCode: city.districtCode,
              page: pageNo,
              size: REGION_PAGE_SIZE,
              // 대표이미지가 없어도 마커는 찍어야 하고, 페이지를 넘기는 동안
              // 순서가 흔들리지 않도록 제목순(A)으로 받습니다.
              arrange: 'A',
            },
            controller.signal,
          );
          items.push(...page.items.filter(isMappableTourContent));
          totalCount = page.totalCount;
          totalPages = Math.max(1, Math.ceil(totalCount / REGION_PAGE_SIZE));
          pageNo += 1;
        } while (pageNo <= totalPages);

        return items;
      };

      // 예전에 쓰던 지역명 기반 조회(region-based-list)는 숙박이 빠져 숙박 전용
      // API 로 보완했었습니다. 법정동 코드 조회에는 숙박(contentTypeId=32)이
      // 그대로 들어 있어(충북 11개 시군 건수 전부 일치) 보완 호출을 뺐습니다.
      const items = await loadAllTourism();
      regionCache.set(cacheKey, {
        items,
        expiresAt: Date.now() + REGION_CACHE_TTL_MS,
      });
      return { items, totalCount: items.length };
    }

    loadRegion()
      .then(page => {
        if (controller.signal.aborted || !mounted.current) return;
        setState({
          places: page.items,
          loading: false,
          error: null,
          totalCount: page.totalCount,
        });
      })
      .catch((err: Error) => {
        if (controller.signal.aborted || !mounted.current) return;
        setState({
          places: [],
          loading: false,
          error: err.message || '주변 정보를 불러오지 못했어요.',
          totalCount: 0,
        });
      });

    return () => controller.abort();
  }, [
    enabled,
    city.regionCode,
    city.districtCode,
    city.municipalityCode,
    reloadKey,
  ]);

  /**
   * 서버가 준 지역 후보 중 현재 조회 중심 반경에 들어오는 항목만 표시합니다.
   * 정확한 지도 중심 좌표는 이 계산에서만 사용되고 네트워크로 전송되지 않습니다.
   */
  const places = useMemo(
    () =>
      state.places
        .filter(place => place.category === category)
        .map(place => ({
          ...place,
          distance: roughDistance({ lat, lng }, place),
        }))
        .filter(place =>
          bounds ? isInsideBounds(place, bounds) : place.distance <= radius,
        )
        .sort((a, b) => a.distance - b.distance),
    [state.places, category, lat, lng, radius, bounds],
  );

  const retry = useCallback(() => setReloadKey(key => key + 1), []);

  return { ...state, places, totalCount: places.length, retry };
}

/** 날짜변경선을 걸친 화면까지 고려한 지도 경계 포함 여부입니다. */
export function isInsideBounds(point: Coords, bounds: ViewportBounds): boolean {
  const insideLatitude = point.lat >= bounds.south && point.lat <= bounds.north;
  const insideLongitude =
    bounds.west <= bounds.east
      ? point.lng >= bounds.west && point.lng <= bounds.east
      : point.lng >= bounds.west || point.lng <= bounds.east;
  return insideLatitude && insideLongitude;
}

/**
 * 마지막 조회 화면과 현재 화면이 의미 있게 달라졌는지 비교합니다.
 * 중심 이동뿐 아니라 확대·축소로 경계가 달라진 경우도 재검색 대상으로 봅니다.
 */
export function hasViewportChanged(
  current: ViewportBounds | null,
  queried: ViewportBounds | null,
): boolean {
  if (!current || !queried) return false;

  const latSpan = Math.max(queried.north - queried.south, 0.0001);
  const lngSpan = Math.max(Math.abs(queried.east - queried.west), 0.0001);
  const latTolerance = Math.max(0.0003, latSpan * 0.03);
  const lngTolerance = Math.max(0.0003, lngSpan * 0.03);

  return (
    Math.abs(current.south - queried.south) > latTolerance ||
    Math.abs(current.north - queried.north) > latTolerance ||
    Math.abs(current.west - queried.west) > lngTolerance ||
    Math.abs(current.east - queried.east) > lngTolerance
  );
}

/**
 * 두 좌표 사이 거리(m) — 재검색 버튼을 띄울지 판단하는 데만 씁니다.
 * 정밀도가 중요하지 않아 위도 1도 ≒ 111km 로 근사합니다.
 */
export function roughDistance(a: Coords, b: Coords): number {
  const dLat = (a.lat - b.lat) * 111_000;
  // 경도 1도의 실제 거리는 위도가 높을수록 짧아집니다.
  const dLng = (a.lng - b.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}
