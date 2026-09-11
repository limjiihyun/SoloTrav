import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { toApiError } from './errors';
import type { City } from '../data/cities';

export type SafetyPlaceType =
  | 'hospital'
  | 'femaleHouse'
  | 'cctv'
  | 'streetlight'
  | 'food';

export type SafetyPlace = {
  id: string;
  type: SafetyPlaceType;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  distance: number | null;
};

type Raw = Record<string, unknown>;

/** 한 페이지 최대 건수 — 서버가 101 이상은 400 으로 거절합니다. */
const PAGE_SIZE = 100;
/**
 * 페이지 순회 상한. 청주 CCTV 가 약 2,900건(29페이지)으로 가장 많습니다.
 * 서버 total 이 잘못 와도 여기서 멈춥니다.
 */
const MAX_PAGES = 40;
/** 공개 SOS API 의 limit 상한 */
const SOS_LIMIT = 50;

function value(raw: Raw, keys: string[]): unknown {
  for (const key of keys) {
    const found = raw[key];
    if (found !== undefined && found !== null && found !== '') return found;
  }
}

function number(input: unknown): number | null {
  const parsed = typeof input === 'number' ? input : Number(input);
  return Number.isFinite(parsed) ? parsed : null;
}

function rows(payload: unknown): Raw[] {
  if (Array.isArray(payload)) return payload as Raw[];
  if (!payload || typeof payload !== 'object') return [];
  const raw = payload as Raw;
  for (const key of [
    'payload',
    'data',
    'items',
    'content',
    'results',
    'rows',
  ]) {
    const nested = raw[key];
    if (Array.isArray(nested)) return nested as Raw[];
    const found = rows(nested);
    if (found.length) return found;
  }
  return [];
}

/**
 * 응답 봉투의 총 건수. 엔드포인트마다 이름이 달라 후보를 모두 봅니다.
 * (cctv·가로등: total / 병의원: totalCount / 음식업소: pagination.totalRows)
 */
function totalOf(payload: unknown): number {
  if (!payload || typeof payload !== 'object') return 0;
  const raw = payload as Raw;
  const nested =
    raw.payload && typeof raw.payload === 'object' ? (raw.payload as Raw) : raw;
  const pagination = nested.pagination as Raw | undefined;
  return (
    number(value(nested, ['total', 'totalCount'])) ??
    number(pagination?.totalRows) ??
    0
  );
}

function normalize(
  raw: Raw,
  type: SafetyPlaceType,
  index: number,
): SafetyPlace | null {
  const lat = number(
    value(raw, [
      'lat',
      'latitude',
      'wgs84Lat',
      'refineWgs84Lat',
      'y',
      'mapY',
      'mapy',
      '위도',
      'LATITUDE',
      'REFINE_WGS84_LAT',
    ]),
  );
  const lng = number(
    value(raw, [
      'lng',
      'lon',
      'longitude',
      'wgs84Lon',
      'refineWgs84Logt',
      'x',
      'mapX',
      'mapx',
      '경도',
      'LONGITUDE',
      'REFINE_WGS84_LOGT',
    ]),
  );
  if (
    lat === null ||
    lng === null ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }
  const fallback = {
    hospital: '병·의원',
    femaleHouse: '여성안심지킴이집',
    cctv: 'CCTV',
    streetlight: '스마트 가로등',
    food: '음식업소',
  }[type];
  return {
    id: `${type}-${String(
      value(raw, ['id', 'hpid', 'facilityId', 'managementNo', '관리번호']) ??
        index,
    )}`,
    type,
    name: String(
      value(raw, [
        'name',
        'title',
        'hospitalName',
        'dutyName',
        'facilityName',
        'companyName',
        'businessName',
        '상호명',
        '업소명',
        '기관명',
      ]) ?? fallback,
    ),
    address: String(
      value(raw, [
        'address',
        'roadAddress',
        'road_address',
        'parcel_address',
        'dutyAddr',
        'location',
        '소재지도로명주소',
        '도로명주소',
        '소재지주소',
      ]) ?? '',
    ),
    phone:
      String(
        value(raw, [
          'phone',
          'tel',
          'telephone',
          'management_phone_number',
          'dutyTel1',
          '전화번호',
        ]) ?? '',
      ) || null,
    distance: number(value(raw, ['distance', 'distanceMeters', 'dist'])),
    lat,
    lng,
  };
}

/**
 * 페이지를 끝까지 순회해 행을 모읍니다.
 * 서버가 준 총 건수만큼만 돌고, 빈 페이지가 오면 그 전에 멈춥니다.
 */
async function fetchAllPages(
  pathOf: (page: number) => string,
  signal?: AbortSignal,
): Promise<Raw[]> {
  const collected: Raw[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data } = await apiClient.get(pathOf(page), { signal });
    const pageRows = rows(data);
    collected.push(...pageRows);
    const total = totalOf(data);
    if (pageRows.length === 0 || collected.length >= total) break;
  }
  return collected;
}

/**
 * 레이어별 조회. 사용자 좌표는 보내지 않고 시군명·코드로만 좁힙니다.
 * 엔드포인트마다 필터·페이징 규약이 달라 한 곳에 모아 둡니다(endpoints.ts 주석 참고).
 */
async function fetchRaw(
  type: SafetyPlaceType,
  city: City,
  signal?: AbortSignal,
): Promise<Raw[]> {
  switch (type) {
    case 'cctv':
      return fetchAllPages(
        page =>
          ENDPOINTS.cctvs({
            localGovernmentCode: city.cctvLocalGovernmentCode,
            page,
            limit: PAGE_SIZE,
          }),
        signal,
      );
    case 'streetlight':
      return fetchAllPages(
        page =>
          ENDPOINTS.smartStreetlights({
            sido: city.sido,
            sigungu: city.sigungu,
            page,
            limit: PAGE_SIZE,
          }),
        signal,
      );
    case 'hospital':
      return fetchAllPages(
        pageNo =>
          ENDPOINTS.hospitals({
            sido: city.sido,
            sigungu: city.sigungu,
            pageNo,
            numOfRows: PAGE_SIZE,
          }),
        signal,
      );
    case 'femaleHouse': {
      // 목록 API(/female-safety-houses)는 지역 필터가 없어 전국 앞부분만 옵니다.
      // 같은 데이터를 regionName 으로 거르는 공개 SOS API 를 씁니다.
      const { data } = await apiClient.get(
        ENDPOINTS.safetyFacilities({
          regionName: `${city.sido} ${city.sigungu}`,
          limit: SOS_LIMIT,
        }),
        { signal },
      );
      return rows(data);
    }
    case 'food': {
      // 충북 전용 API 라 지역 파라미터가 없고, 데이터도 통틀어 10건뿐입니다.
      const { data } = await apiClient.get(
        ENDPOINTS.chungbukFoods({ currentPage: 1, perPage: PAGE_SIZE }),
        { signal },
      );
      return rows(data);
    }
  }
}

export const safetyPlaceApi = {
  list: async (
    type: SafetyPlaceType,
    /** 조회할 충북 시군 */
    city: City,
    signal?: AbortSignal,
  ): Promise<SafetyPlace[]> => {
    try {
      return (await fetchRaw(type, city, signal))
        .map((item, index) => normalize(item, type, index))
        .filter((item): item is SafetyPlace => item !== null);
    } catch (error) {
      throw toApiError(error);
    }
  },
};
