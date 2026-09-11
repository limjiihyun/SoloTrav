/**
 * 여행 정보 API 요청 모음 (한국관광공사 TourAPI 프록시).
 *
 * 로그인 없이도 호출되는 공개 데이터지만, 토큰이 있으면 자동으로 실리도록
 * 다른 요청과 같은 apiClient 를 씁니다(토큰이 없으면 헤더가 안 붙을 뿐입니다).
 *
 * 화면은 여기 있는 함수만 부르고 TourAPI 파라미터 이름은 몰라도 됩니다.
 */
import { Platform } from 'react-native';
import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { APP_NAME } from '../config/userAgent';
import {
  toAiCourseTicket,
  type AiCourseTicket,
  toGalleryPhotos,
  toHubAttractions,
  toRegionSafetyList,
  toTotalCount,
  toTourFestivals,
  toTourContentDetail,
  toTourContents,
  toVisitorTotals,
  todayYmd,
  type VisitorTotals,
} from './travelMappers';
import type {
  AiCourseRequestDto,
  TourArrange,
  TourInfoQuery,
  TourMobileOs,
} from './travelDto';
import type {
  AiCourse,
  GalleryPhoto,
  HubAttraction,
  RegionSafety,
  TourFestival,
  TourContent,
  TourContentDetail,
} from '../types/travel';

/** TourAPI 가 요구하는 호출 주체 정보 — 모든 요청에 공통으로 실립니다. */
const MOBILE_OS: TourMobileOs =
  Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'AND' : 'ETC';

function withDefaults(query: TourInfoQuery): TourInfoQuery {
  return { MobileOS: MOBILE_OS, MobileApp: APP_NAME, ...query };
}

/** 목록 조회 결과 — 더 불러올 게 남았는지 화면이 판단할 수 있게 총 건수를 함께 줍니다. */
export type TourPage<T> = {
  items: T[];
  totalCount: number;
  /** 다음 페이지가 있으면 그 번호, 없으면 null */
  nextPage: number | null;
};

export const REGION_PAGE_SIZE = 100;
export const DEFAULT_RADIUS = 5000;
export const FESTIVAL_RADIUS = 50000;

function toPage<T>(
  items: T[],
  payload: unknown,
  pageNo: number,
  size: number,
): TourPage<T> {
  const totalCount = toTotalCount(payload);
  return {
    items,
    totalCount,
    nextPage: pageNo * size < totalCount ? pageNo + 1 : null,
  };
}

/** 지역 필터. areaCode 대신 **법정동 코드**를 씁니다(travelDto 주석 참고). */
export type RegionFilter = {
  /** 법정동 시도 코드 (충북 = '43') */
  regionCode?: string;
  /** 법정동 시군구 코드 (단양군 = '800') */
  districtCode?: string;
};

export const travelApi = {
  /**
   * 키워드 검색 — 홈 검색창에서 씁니다.
   *
   * 사진이 없는 항목이 섞이면 카드 목록이 들쭉날쭉해지지만, 검색은 "찾는 게
   * 나오는 것"이 우선이라 대표이미지 필수 정렬(O/Q/R)을 쓰지 않습니다.
   */
  searchSpots: async (
    params: {
      keyword: string;
      contentTypeId?: string;
      page?: number;
      size?: number;
      arrange?: TourArrange;
    } & RegionFilter,
    signal?: AbortSignal,
  ): Promise<TourPage<TourContent>> => {
    const pageNo = params.page ?? 1;
    const size = params.size ?? 20;
    const { data } = await apiClient.get(
      ENDPOINTS.tourSearchKeyword(
        withDefaults({
          keyword: params.keyword,
          contentTypeId: params.contentTypeId,
          lDongRegnCd: params.regionCode,
          lDongSignguCd: params.districtCode,
          arrange: params.arrange ?? 'C',
          pageNo,
          numOfRows: size,
        }),
      ),
      { signal },
    );
    return toPage(toTourContents(data), data, pageNo, size);
  },

  /**
   * 지역 기반 관광정보 — '이 동네에 뭐가 있는지' 카드로 보여줄 때.
   * 기본 정렬은 대표이미지가 있는 것만(Q) 입니다.
   */
  listSpotsByRegion: async (
    params: {
      contentTypeId?: string;
      page?: number;
      size?: number;
      arrange?: TourArrange;
    } & RegionFilter,
    signal?: AbortSignal,
  ): Promise<TourPage<TourContent>> => {
    const pageNo = params.page ?? 1;
    const size = params.size ?? 20;
    const { data } = await apiClient.get(
      ENDPOINTS.tourAreaBasedList(
        withDefaults({
          contentTypeId: params.contentTypeId,
          lDongRegnCd: params.regionCode,
          lDongSignguCd: params.districtCode,
          arrange: params.arrange ?? 'Q',
          pageNo,
          numOfRows: size,
        }),
      ),
      { signal },
    );
    return toPage(toTourContents(data), data, pageNo, size);
  },

  /**
   * 지역 전체 관광정보. 정확한 사용자·지도 좌표는 보내지 않습니다.
   *
   * ⚠️ 서버에 대표 좌표가 등록된 지역만 결과가 옵니다. 2026-09 기준 충북에서는
   * 청주시만 데이터가 있고 나머지 10개 시군은 200 OK 에 totalCount 0 입니다.
   * 그래서 지도 마커는 이 함수 대신 법정동 코드로 조회하는 listSpotsByRegion
   * 을 씁니다. 서버 레지스트리가 채워지기 전까지 새로 쓰지 마세요.
   */
  listNearbySpots: async (
    params: { regionName: string; page?: number; size?: number },
    signal?: AbortSignal,
  ): Promise<TourPage<TourContent>> => {
    const pageNo = params.page ?? 1;
    const size = params.size ?? REGION_PAGE_SIZE;
    const { data } = await apiClient.get(
      ENDPOINTS.tourRegionBasedList({
        regionName: params.regionName,
        pageNo,
        numOfRows: size,
      }),
      { signal },
    );
    return toPage(toTourContents(data), data, pageNo, size);
  },

  /**
   * 축제·행사 조회.
   * from(YYYYMMDD) 이후 시작하는 행사가 오므로 기본값은 오늘입니다.
   * 오늘 이전에 시작해 지금도 하는 축제까지 담고 싶으면 from 을 앞당겨 주세요.
   */
  listFestivals: async (
    params: { from?: string; to?: string; size?: number } & RegionFilter = {},
    signal?: AbortSignal,
  ): Promise<TourFestival[]> => {
    const { data } = await apiClient.get(
      ENDPOINTS.tourSearchFestival(
        withDefaults({
          eventStartDate: params.from ?? todayYmd(),
          eventEndDate: params.to,
          lDongRegnCd: params.regionCode,
          lDongSignguCd: params.districtCode,
          arrange: 'A',
          pageNo: 1,
          numOfRows: params.size ?? 20,
        }),
      ),
      { signal },
    );
    return toTourFestivals(data);
  },

  /** 숙박 정보 조회 */
  listStays: async (
    params: {
      page?: number;
      size?: number;
      arrange?: TourArrange;
    } & RegionFilter = {},
    signal?: AbortSignal,
  ): Promise<TourPage<TourContent>> => {
    const pageNo = params.page ?? 1;
    const size = params.size ?? 20;
    const { data } = await apiClient.get(
      ENDPOINTS.tourSearchStay(
        withDefaults({
          lDongRegnCd: params.regionCode,
          lDongSignguCd: params.districtCode,
          arrange: params.arrange ?? 'Q',
          pageNo,
          numOfRows: size,
        }),
      ),
      { signal },
    );
    return toPage(toTourContents(data), data, pageNo, size);
  },

  /**
   * 관광 콘텐츠 상세.
   *
   * 공통정보(제목·개요)는 반드시 있어야 하지만 소개정보·이미지는 없는 콘텐츠도
   * 많습니다. 그래서 세 요청을 나란히 보내되 뒤 둘은 실패해도 무시합니다.
   * contentTypeId 를 알면 함께 넘겨주세요 — 소개정보 조회에 필요합니다.
   */
  getSpotDetail: async (
    contentId: string,
    contentTypeId?: string,
    signal?: AbortSignal,
  ): Promise<TourContentDetail | null> => {
    const [common, intro, images] = await Promise.all([
      apiClient.get(
        ENDPOINTS.tourDetailCommon(withDefaults({ contentId, numOfRows: 1 })),
        { signal },
      ),
      apiClient
        .get(
          ENDPOINTS.tourDetailIntro(
            withDefaults({ contentId, contentTypeId, numOfRows: 1 }),
          ),
          { signal },
        )
        .catch(() => null),
      apiClient
        .get(
          ENDPOINTS.tourDetailImage(withDefaults({ contentId, numOfRows: 10 })),
          { signal },
        )
        .catch(() => null),
    ]);
    return toTourContentDetail(common.data, intro?.data, images?.data);
  },

  /**
   * 관광사진 갤러리.
   * keyword 를 주면 검색 엔드포인트로, 없으면 최신 목록으로 갑니다.
   */
  listGalleryPhotos: async (
    params: {
      keyword?: string;
      page?: number;
      size?: number;
    } = {},
  ): Promise<TourPage<GalleryPhoto>> => {
    const pageNo = params.page ?? 1;
    const size = params.size ?? 20;
    const query = {
      MobileOS: MOBILE_OS,
      MobileApp: APP_NAME,
      keyword: params.keyword,
      arrange: 'A' as const,
      pageNo,
      numOfRows: size,
    };
    const { data } = await apiClient.get(
      params.keyword
        ? ENDPOINTS.tourGallerySearchList(query)
        : ENDPOINTS.tourGalleryList(query),
    );
    return toPage(toGalleryPhotos(data), data, pageNo, size);
  },

  /**
   * 조건에 맞는 관광정보가 몇 건인지만 셉니다.
   * 목록은 필요 없고 숫자만 쓰는 자리(동네 인프라 통계)를 위해 1건만 받아
   * totalCount 를 꺼냅니다.
   */
  countSpots: async (
    params: { contentTypeId?: string } & RegionFilter,
  ): Promise<number> => {
    const { data } = await apiClient.get(
      ENDPOINTS.tourAreaBasedList(
        withDefaults({
          contentTypeId: params.contentTypeId,
          lDongRegnCd: params.regionCode,
          lDongSignguCd: params.districtCode,
          arrange: 'C',
          pageNo: 1,
          numOfRows: 1,
        }),
      ),
    );
    return toTotalCount(data);
  },

  /**
   * 하루치 기초 지자체 방문자수를 시군구별로 합쳐서 돌려줍니다.
   *
   * 이 API 는 지역을 좁힐 수 없어 전국 800행이 통째로 옵니다. 그래서 관심 있는
   * 시군구 코드를 함께 넘기면 파싱 단계에서 걸러 메모리에 남기지 않습니다.
   */
  getVisitorTotals: async (
    ymd: string,
    keepCodes?: string[],
  ): Promise<Map<string, VisitorTotals>> => {
    const { data } = await apiClient.get(
      ENDPOINTS.visitorLocalGovernment({
        startYmd: ymd,
        endYmd: ymd,
        pageNo: 1,
        numOfRows: 1000,
        MobileOS: MOBILE_OS,
        MobileApp: APP_NAME,
      }),
    );
    return toVisitorTotals(data, keepCodes);
  },

  /**
   * 방문자수 데이터가 실제로 있는 가장 최근 날짜를 찾습니다.
   *
   * 집계가 한 달 넘게 밀려서(2026-08 기준 07-11 까지) 오늘 날짜로 조회하면
   * 빈 배열이 옵니다. 주말 나들이 수요를 보려는 것이니 **토요일**만 훑습니다.
   *
   * 한 주씩 순서대로 두드리면 최악의 경우 왕복이 10번이라 홈 첫 로딩이 눈에
   * 띄게 느려집니다. 건수만 확인하면 되는 가벼운 요청이라 전부 동시에 보내고
   * 그중 가장 최근 날짜를 고릅니다(사실상 왕복 1번).
   */
  findLatestVisitorDate: async (maxWeeks = 10): Promise<string | null> => {
    const candidates = recentSaturdays(maxWeeks);
    const results = await Promise.all(
      candidates.map(ymd =>
        apiClient
          .get(
            ENDPOINTS.visitorLocalGovernment({
              startYmd: ymd,
              endYmd: ymd,
              pageNo: 1,
              numOfRows: 1,
              MobileOS: MOBILE_OS,
              MobileApp: APP_NAME,
            }),
          )
          // 한 주가 실패해도 다른 주로 계속 갑니다.
          .then(response => (toTotalCount(response.data) > 0 ? ymd : null))
          .catch(() => null),
      ),
    );
    // candidates 가 최신순이라 먼저 걸리는 값이 가장 최근 날짜입니다.
    return results.find((ymd): ymd is string => ymd !== null) ?? null;
  },

  /**
   * 시도 하나의 지역안전지수 — 시도 행 1건 + 그 아래 시군구 행들이 함께 옵니다.
   * 도시 목록 전체의 안전등급을 요청 한 번으로 채울 수 있습니다.
   */
  getRegionSafetyBySido: async (
    sido: string,
    baseYear?: string,
  ): Promise<RegionSafety[]> => {
    const { data } = await apiClient.get(
      ENDPOINTS.regionalSafetyBySido({ sido, baseYear }),
    );
    return toRegionSafetyList(data);
  },

  /**
   * 기초지자체 중심 관광지(방문 상위 랭킹).
   *
   * baseYm 은 집계가 끝난 달만 데이터가 있습니다. 이번 달·지난달은 아직 빈
   * 배열이 오는 일이 흔해서, 값을 안 주면 최근 달부터 최대 4개월을 거슬러
   * 올라가며 처음 데이터가 잡히는 달을 씁니다.
   */
  listHubAttractions: async (params: {
    /** 광역 법정동 코드 (충북 = '43') */
    areaCd: string;
    /** 시군구 법정동 코드 (단양군 = '43800') */
    signguCd: string;
    baseYm?: string;
    size?: number;
  }): Promise<HubAttraction[]> => {
    const months = params.baseYm ? [params.baseYm] : recentMonths(4);

    for (const baseYm of months) {
      const { data } = await apiClient.get(
        ENDPOINTS.municipalityAttractions({
          baseYm,
          areaCd: params.areaCd,
          signguCd: params.signguCd,
          pageNo: 1,
          numOfRows: params.size ?? 10,
          mobileOs: MOBILE_OS,
          mobileApp: APP_NAME,
        }),
      );
      const attractions = toHubAttractions(data);
      if (attractions.length > 0) {
        return attractions;
      }
    }
    return [];
  },

  /**
   * AI 맞춤 코스 생성 (비동기 처리: POST 202 접수 -> 상태 폴링 조회 -> 완료 코스 반환)
   * 지역명, 여행 기간, 출발일, 여행 취향 조건을 전달하여 최적의 혼행 코스를 생성합니다.
   */
  generateAiCourse: async (
    request: AiCourseRequestDto,
    signal?: AbortSignal,
    onProgress?: (status: string) => void,
  ): Promise<AiCourse> => {
    console.log('====================================================');
    console.log('[AI Course API] >>> POST Request to:', ENDPOINTS.aiCourses());
    console.log('[AI Course API] Request Body:\n', JSON.stringify(request, null, 2));
    console.log('====================================================');

    let ticket: AiCourseTicket;
    try {
      const response = await apiClient.post(
        ENDPOINTS.aiCourses(),
        request,
        { signal },
      );
      console.log('[AI Course API] <<< POST Response Status:', response.status);
      console.log(
        '[AI Course API] POST Response Data:\n',
        JSON.stringify(response.data, null, 2),
      );
      ticket = toAiCourseTicket(
        response.data,
        request.regionName,
        request.duration,
      );
    } catch (error: any) {
      console.error(
        '[AI Course API] !!! POST REQUEST FAILED !!!',
        error?.response?.status,
        error?.message,
      );
      throw error;
    }

    // 1. 이미 완료되었거나 코스가 동봉된 경우 즉시 반환
    if (ticket.isCompleted && ticket.course) {
      console.log('[AI Course API] Immediate completion. Course ready!');
      return ticket.course;
    }

    if (ticket.isFailed) {
      throw new Error(ticket.errorMessage || 'AI 코스 생성에 실패했습니다.');
    }

    const requestId = ticket.requestId;
    if (!requestId) {
      // requestId가 없는 경우, 혹시 response.data 자체가 코스인지 확인
      if (ticket.course && ticket.course.stops.length > 0) {
        return ticket.course;
      }
      throw new Error('코스 생성 접수 번호(requestId)를 받지 못했습니다.');
    }

    console.log(
      `[AI Course API] Request accepted (${ticket.status}), polling for requestId: ${requestId}`,
    );
    onProgress?.(ticket.status);

    // 2. 비동기 상태 폴링 (최대 30회, 1.5초 간격 = 최대 45초)
    const MAX_POLLS = 30;
    const POLL_INTERVAL_MS = 1500;

    for (let i = 0; i < MAX_POLLS; i++) {
      if (signal?.aborted) {
        throw new Error('코스 생성이 취소되었습니다.');
      }

      await new Promise<void>(resolve => setTimeout(() => resolve(), POLL_INTERVAL_MS));

      try {
        console.log(
          `[AI Course API] Polling [${i + 1}/${MAX_POLLS}] GET ${ENDPOINTS.aiCourseResult(requestId)}`,
        );
        const pollResponse = await apiClient.get(
          ENDPOINTS.aiCourseResult(requestId),
          { signal },
        );
        console.log(
          `[AI Course API] Poll [${i + 1}] response status:`,
          pollResponse.status,
        );
        const pollTicket = toAiCourseTicket(
          pollResponse.data,
          request.regionName,
          request.duration,
        );
        console.log(
          `[AI Course API] Poll [${i + 1}] ticket status:`,
          pollTicket.status,
          'hasCourse:',
          !!pollTicket.course,
        );

        if (pollTicket.isCompleted && pollTicket.course) {
          console.log('[AI Course API] Course completed successfully!');
          return pollTicket.course;
        }

        if (pollTicket.isFailed) {
          throw new Error(
            pollTicket.errorMessage || '코스 생성 처리 중 오류가 발생했습니다.',
          );
        }

        onProgress?.(pollTicket.status);
      } catch (pollErr: any) {
        // 일시적인 네트워크 오류는 몇 번 재시도 허용, 치명적 에러(401, 404 등)는 바로 throw
        const status = pollErr?.response?.status;
        if (status === 401 || status === 403 || status === 404) {
          throw pollErr;
        }
        console.warn(
          `[AI Course API] Polling warning on attempt ${i + 1}:`,
          pollErr.message,
        );
      }
    }

    throw new Error('AI 코스 생성이 지연되고 있습니다. 잠시 후 다시 시도해주세요.');
  },

  /**
   * GET /travel/ai-courses/{requestId} — AI 코스 상태 및 결과 직접 조회
   */
  fetchAiCourseResult: async (
    requestId: string,
    regionName: string = '',
    duration: string = 'ONE_NIGHT',
  ): Promise<AiCourseTicket> => {
    const { data } = await apiClient.get(ENDPOINTS.aiCourseResult(requestId));
    return toAiCourseTicket(data, regionName, duration);
  },
};

/**
 * 가장 가까운 지난 토요일부터 주 단위로 거슬러 올라가며 YYYYMMDD 를 만듭니다.
 * 오늘이 토요일이면 오늘은 아직 집계 전이므로 지난주부터 셉니다.
 */
function recentSaturdays(count: number): string[] {
  const base = new Date();
  // 0=일 … 6=토. 이번 주 토요일이 미래면 지난주 토요일로 내립니다.
  const back = (base.getDay() + 1) % 7 || 7;
  base.setDate(base.getDate() - back);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base);
    date.setDate(date.getDate() - index * 7);
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}${month}${day}`;
  });
}

/** 지난달부터 count 개월치 YYYYMM 을 최신순으로 만듭니다. */
function recentMonths(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (index + 1), 1);
    return `${date.getFullYear()}${`${date.getMonth() + 1}`.padStart(2, '0')}`;
  });
}
