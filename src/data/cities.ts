/**
 * 도시 데이터 (충북 시군).
 * - type: 지도 칩 색상 및 범례 구분
 * - pos: 지도 컨테이너 내 위치(%) — 절대배치에 사용
 * - stats: 트렌드(%), 추천 가산점(+) — 아직 서버 지표가 없어 기획 임시값입니다.
 *
 * 안전등급·안전점수는 지역안전지수 API(travelApi.getRegionSafetyBySido)로 덮어씁니다.
 * 이 파일의 safetyGrade/stats.safety 는 응답이 오기 전에 보여줄 기본값입니다.
 *
 * 지역 코드가 두 종류라 헷갈리기 쉽습니다.
 *  - regionCode/districtCode : **법정동 코드**. 관광정보 조회(lDongRegnCd/lDongSignguCd)에 씁니다.
 *  - municipalityCode        : 기초지자체 관광지 API 의 signguCd. 법정동 코드를 이어붙인 값('43'+'800').
 *  - sido/sigungu            : 지역안전지수는 코드가 아니라 **이름**으로 조회합니다.
 */
export type CityType = 'decline' | 'urban' | 'transit';

export type City = {
  id: string;
  name: string;
  type: CityType;
  region: string;
  tag: string; // 상세 카드용 짧은 배지 (예: '인구감소')
  safetyGrade: string; // 'A' | 'B' ... — API 응답이 오면 대체됩니다
  description: string;
  stats: { safety: number; trend: number; bonus: number };
  pos: { x: number; y: number };

  /** 지역안전지수 조회용 시도명 */
  sido: string;
  /** 지역안전지수 조회용 시군구명 (행정구역 전체 이름) */
  sigungu: string;
  /** 법정동 시도 코드 — 충북은 전부 '43' */
  regionCode: string;
  /** 법정동 시군구 코드 */
  districtCode: string;
  /** 기초지자체 관광지 API 의 signguCd (regionCode + districtCode) */
  municipalityCode: string;
  /**
   * CCTV 목록 API(/cctvs)의 localGovernmentCode.
   * 법정동·행정기관코드 어느 체계와도 다른 데이터셋 자체 코드라 서버 응답에서
   * 시군별로 뽑아 적었습니다(2026-09). 이 값으로 걸어야 시군 단위로 옵니다.
   */
  cctvLocalGovernmentCode: string;
  /** 시·군청 기준 대표 좌표 — 주변 관광지 조회에 씁니다 */
  center: { lat: number; lng: number };
};

export const CITY_TYPE_LABEL: Record<CityType, string> = {
  decline: '인구감소지역',
  urban: '도시형',
  transit: '경유형',
};

export const CITIES: City[] = [
  {
    id: 'danyang',
    name: '단양',
    type: 'decline',
    region: '충북',
    tag: '인구감소',
    safetyGrade: 'A',
    description:
      '도담삼봉·소백산이 있는 한국의 알프스. 혼행객 야경·자연 산책 코스가 풍부해요.',
    stats: { safety: 84, trend: 31, bonus: 12 },
    pos: { x: 80, y: 40 },
    sido: '충청북도',
    sigungu: '단양군',
    regionCode: '43',
    districtCode: '800',
    municipalityCode: '43800',
    cctvLocalGovernmentCode: '4480000',
    center: { lat: 36.9846, lng: 128.3655 },
  },
  {
    id: 'jecheon',
    name: '제천',
    type: 'decline',
    region: '충북',
    tag: '인구감소',
    safetyGrade: 'A',
    description: '청풍호 둘레길과 한적한 카페가 있는 힐링 도시.',
    stats: { safety: 80, trend: 28, bonus: 10 },
    pos: { x: 70, y: 20 },
    sido: '충청북도',
    sigungu: '제천시',
    regionCode: '43',
    districtCode: '150',
    municipalityCode: '43150',
    cctvLocalGovernmentCode: '4400000',
    center: { lat: 37.1326, lng: 128.191 },
  },
  {
    id: 'chungju',
    name: '충주',
    type: 'urban',
    region: '충북',
    tag: '도시형',
    safetyGrade: 'B',
    description: '충주호와 탄금대, 도심 편의가 두루 갖춰진 도시.',
    stats: { safety: 77, trend: 22, bonus: 6 },
    pos: { x: 52, y: 26 },
    sido: '충청북도',
    sigungu: '충주시',
    regionCode: '43',
    districtCode: '130',
    municipalityCode: '43130',
    cctvLocalGovernmentCode: '4390000',
    center: { lat: 36.991, lng: 127.926 },
  },
  {
    id: 'eumseong',
    name: '음성',
    type: 'transit',
    region: '충북',
    tag: '경유형',
    safetyGrade: 'B',
    description: '조용한 시골 정취가 남아있는 경유지.',
    stats: { safety: 72, trend: 15, bonus: 4 },
    pos: { x: 30, y: 22 },
    sido: '충청북도',
    sigungu: '음성군',
    regionCode: '43',
    districtCode: '770',
    municipalityCode: '43770',
    cctvLocalGovernmentCode: '4470000',
    center: { lat: 36.9403, lng: 127.6905 },
  },
  {
    id: 'jincheon',
    name: '진천',
    type: 'transit',
    region: '충북',
    tag: '경유형',
    safetyGrade: 'B',
    description: '농다리와 초평호가 있는 한적한 고장.',
    stats: { safety: 73, trend: 16, bonus: 5 },
    pos: { x: 26, y: 42 },
    sido: '충청북도',
    sigungu: '진천군',
    regionCode: '43',
    districtCode: '750',
    municipalityCode: '43750',
    cctvLocalGovernmentCode: '4450000',
    center: { lat: 36.8553, lng: 127.4355 },
  },
  {
    id: 'jeungpyeong',
    name: '증평',
    type: 'transit',
    region: '충북',
    tag: '경유형',
    safetyGrade: 'B',
    description: '작지만 알찬 경유형 소도시.',
    stats: { safety: 71, trend: 14, bonus: 4 },
    pos: { x: 47, y: 47 },
    sido: '충청북도',
    sigungu: '증평군',
    regionCode: '43',
    districtCode: '745',
    municipalityCode: '43745',
    cctvLocalGovernmentCode: '5570000',
    center: { lat: 36.7852, lng: 127.5814 },
  },
  {
    id: 'goesan',
    name: '괴산',
    type: 'decline',
    region: '충북',
    tag: '인구감소',
    safetyGrade: 'A',
    description: '산막이옛길과 청정 자연이 있는 인구감소지역.',
    stats: { safety: 82, trend: 26, bonus: 11 },
    pos: { x: 64, y: 46 },
    sido: '충청북도',
    sigungu: '괴산군',
    regionCode: '43',
    districtCode: '760',
    municipalityCode: '43760',
    cctvLocalGovernmentCode: '4460000',
    center: { lat: 36.8153, lng: 127.7866 },
  },
  {
    id: 'cheongju',
    name: '청주',
    type: 'urban',
    region: '충북',
    tag: '도시형',
    safetyGrade: 'B',
    description: '충북의 중심 도시, 교통과 편의의 거점.',
    stats: { safety: 76, trend: 20, bonus: 6 },
    pos: { x: 40, y: 58 },
    sido: '충청북도',
    sigungu: '청주시',
    regionCode: '43',
    districtCode: '110',
    municipalityCode: '43110',
    cctvLocalGovernmentCode: '5710000',
    center: { lat: 36.6424, lng: 127.489 },
  },
  {
    id: 'boeun',
    name: '보은',
    type: 'transit',
    region: '충북',
    tag: '경유형',
    safetyGrade: 'B',
    description: '속리산 법주사가 있는 경유형 지역.',
    stats: { safety: 74, trend: 17, bonus: 5 },
    pos: { x: 54, y: 67 },
    sido: '충청북도',
    sigungu: '보은군',
    regionCode: '43',
    districtCode: '720',
    municipalityCode: '43720',
    cctvLocalGovernmentCode: '4420000',
    center: { lat: 36.4894, lng: 127.7294 },
  },
  {
    id: 'okcheon',
    name: '옥천',
    type: 'decline',
    region: '충북',
    tag: '인구감소',
    safetyGrade: 'A',
    description: '정지용 문학과 대청호가 있는 인구감소지역.',
    stats: { safety: 79, trend: 24, bonus: 9 },
    pos: { x: 34, y: 76 },
    sido: '충청북도',
    sigungu: '옥천군',
    regionCode: '43',
    districtCode: '730',
    municipalityCode: '43730',
    cctvLocalGovernmentCode: '4430000',
    center: { lat: 36.3064, lng: 127.5714 },
  },
  {
    id: 'yeongdong',
    name: '영동',
    type: 'decline',
    region: '충북',
    tag: '인구감소',
    safetyGrade: 'A',
    description: '포도와 와인의 고장, 인구감소지역.',
    stats: { safety: 78, trend: 23, bonus: 8 },
    pos: { x: 52, y: 82 },
    sido: '충청북도',
    sigungu: '영동군',
    regionCode: '43',
    districtCode: '740',
    municipalityCode: '43740',
    cctvLocalGovernmentCode: '4440000',
    center: { lat: 36.175, lng: 127.7765 },
  },
];

/** 홈 '숨은 동네'에 노출할 인구감소지역 전체 */
export const SPOTLIGHT_CITY_IDS = CITIES.filter(
  city => city.type === 'decline',
).map(city => city.id);

export const getCityById = (id: string) =>
  CITIES.find(city => city.id === id) ?? CITIES[0];

/** 지역안전지수 응답의 시군구명(예: '단양군')으로 도시를 찾습니다. */
export const getCityBySigungu = (sigungu: string) =>
  CITIES.find(city => city.sigungu === sigungu) ?? null;

/** 법정동 시군구 코드(예: '800')로 도시를 찾습니다. */
export const getCityByDistrictCode = (districtCode: string) =>
  CITIES.find(city => city.districtCode === districtCode) ?? null;

/** 두 좌표 간 거리 계산 (Haversine 공식, 단위: m) */
export function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/** 현재 좌표와 가장 가까운 시·군을 로컬에서 찾습니다. */
export function getNearestCity(lat: number, lng: number): City {
  let nearest = CITIES[0];
  let minDistance = Infinity;

  for (const city of CITIES) {
    const dist = getDistanceMeters(lat, lng, city.center.lat, city.center.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = city;
    }
  }

  return nearest;
}
