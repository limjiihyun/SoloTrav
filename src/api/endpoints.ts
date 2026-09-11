/**
 * API 경로(라우터) 중앙 관리.
 * 서버 라우트가 바뀌면 이 파일만 수정하면 됩니다.
 * 경로는 baseURL(env.apiBaseUrl = .../api/v1) 기준의 상대 경로입니다.
 */

import type {
  GalleryQuery,
  MunicipalityQuery,
  RegionalSafetyQuery,
  TourInfoQuery,
  VisitorRegionQuery,
} from './travelDto';

type QueryValue = string | number | boolean | undefined | null;

/** undefined/null 인 값은 빼고 쿼리스트링을 붙입니다. */
function withQuery(path: string, params?: Record<string, QueryValue>): string {
  if (!params) {
    return path;
  }
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  if (entries.length === 0) {
    return path;
  }
  const query = entries
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join('&');
  return `${path}?${query}`;
}

export const ENDPOINTS = {
  // 인증 — 카카오
  /** Kakao Native 앱 설정 조회 */
  kakaoNativeConfig: () => `/auth/kakao/native/config`,
  /** Kakao 웹 OAuth 인가 URL 조회 */
  kakaoAuthUrl: (params?: { redirectUri?: string; state?: string; dev? : string }) =>
    withQuery(`/auth/kakao/auth-url`, params),
  /** Kakao 웹 OAuth callback 로그인 */
  kakaoCallback: (params: { code: string; state?: string; dev?: string }) =>
    withQuery(`/auth/kakao/callback`, params),
  /** Kakao Native SDK access token 로그인 */
  kakaoNativeLogin: () => `/auth/kakao/native`,
  /** 카카오 재인증으로 회원 탈퇴 예약 취소 */
  cancelWithdrawal: () => `/auth/withdrawal/cancel`,

  // 약관
  /** 서비스 이용약관 전문 조회 (공개) */
  serviceTerms: () => `/terms/service`,
  /** 내 약관 동의 상태 조회 (인증) */
  myTermsStatus: () => `/auth/terms`,
  /** 현재 약관에 동의 (인증) */
  termsAccept: () => `/auth/terms/accept`,

  // 인증 — 세션
  /** 서비스 refresh token 으로 JWT 재발급 */
  refresh: () => `/auth/refresh`,
  /** 서비스 refresh token 폐기 */
  logout: () => `/auth/logout`,

  // 마이페이지
  /** 내 정보 조회 */
  me: () => `/users/me`,
  /** 회원 탈퇴 예약 */
  withdrawal: () => `/auth/me`,
  /** 내 여행 취향 프롬프트 조회(GET) / 등록·편집(POST) */
  travelPreferences: () => `/users/me/travel-preferences`,
  /** 내 여행 배지 조회 */
  travelBadges: () => `/users/me/travel-badges`,
  /** 현장 방문 인증 — 좌표는 보내지 않고 기기에서 계산한 거리만 보냅니다. */
  placeCheckIns: () => `/users/me/place-check-ins`,
  /** 내 차단 목록 조회 (GET) */
  userBlocks: (params?: { page?: number; limit?: number }) =>
    withQuery(`/users/me/blocks`, params),
  /** 사용자 차단 (PUT) / 사용자 차단 해제 (DELETE) */
  userBlock: (userId: string) =>
    `/users/me/blocks/${encodeURIComponent(userId)}`,

  // 신고 (Moderation)
  /** 게시물·댓글·사용자·AI 응답 신고 (POST) */
  reports: () => `/reports`,
  /** 내 신고 목록 및 처리 결과 조회 (GET) */
  myReports: (params?: { page?: number; limit?: number; status?: string }) =>
    withQuery(`/reports/me`, params),
  /** 내 신고 상세 조회 (GET) */
  myReport: (reportId: string) =>
    `/reports/me/${encodeURIComponent(reportId)}`,

  // 여행 기록
  /** 여행 기록 조회(GET) / 등록(POST) */
  travelRecords: () => `/travel-records`,
  /** 내 여행 기록 조회 */
  myTravelRecords: () => `/travel-records/me`,
  /** 기록 수정(PATCH) / 삭제(DELETE) */
  travelRecord: (recordId: string) =>
    `/travel-records/${encodeURIComponent(recordId)}`,
  /** 기록 이미지 업로드 (multipart/form-data) */
  travelRecordImages: (recordId: string) =>
    `/travel-records/${encodeURIComponent(recordId)}/images`,

  // 피드 좋아요
  /** 기록 좋아요(POST) / 취소(DELETE) */
  recordLikes: (recordId: string) =>
    `/travel-records/${encodeURIComponent(recordId)}/likes`,

  // ── 샛별이 (AI 여행 코스) ──
  // "접수 → SSE 구독" 인 비동기 구조라 한 번의 대화에 세 경로를 씁니다.

  /** 코스 생성 요청 접수 (POST) — requestId 를 돌려줍니다 */
  saetbyeolChat: () => `/ai/saetbyeol/chat`,
  /** 요청 최종 상태 조회 — 앱 재시작·화면 복귀 시 결과를 되찾을 때 씁니다 */
  saetbyeolChatResult: (requestId: string) =>
    `/ai/saetbyeol/chat/${encodeURIComponent(requestId)}`,
  /** 결과 SSE 스트림 (text/event-stream) */
  saetbyeolChatStream: (requestId: string) =>
    `/ai/saetbyeol/chat/${encodeURIComponent(requestId)}/stream`,

  // AI 코스 찜
  /** AI 코스 찜 등록(POST) / 내 찜 목록 조회(GET) */
  aiFavorites: () => `/ai/favorites`,
  /** 찜 상세 조회(GET) / 찜 해제(DELETE) */
  aiFavorite: (favoriteId: string) =>
    `/ai/favorites/${encodeURIComponent(favoriteId)}`,
  /** AI 맞춤 코스 생성 요청 접수 (POST) — 202 Accepted, requestId 반환 */
  aiCourses: () => `/travel/ai-courses`,
  /** AI 맞춤 코스 처리 상태 및 결과 조회 (GET) */
  aiCourseResult: (requestId: string) =>
    `/travel/ai-courses/${encodeURIComponent(requestId)}`,
  /** AI 맞춤 코스 SSE 스트림 (GET) */
  aiCourseStream: (requestId: string) =>
    `/travel/ai-courses/${encodeURIComponent(requestId)}/stream`,

  // SOS
  /** 선택한 지역의 안전 시설(여성안심지킴이집) 조회 — 사용자 좌표는 보내지 않고 regionName으로 조회 */
  safetyFacilities: (params: {
    regionName: string;
    limit?: number;
  }) => withQuery(`/sos/safety-facilities`, params),

  // ── 지도 안전 장소 레이어 ──
  // 사용자 좌표는 보내지 않고 시군명·코드로만 좁힙니다. 지역 필터 없이 부르면
  // 전국 목록의 첫 페이지만 와서 지도 화면 안에 아무것도 안 남습니다.
  // 엔드포인트마다 필터·페이징 파라미터 이름이 제각각이라(2026-09 실측)
  // 아래 주석의 규약을 그대로 따라야 합니다.

  /** 병·의원 — sido 와 sigungu 를 **함께** 줘야 시군 필터가 동작합니다. numOfRows 1~100. */
  hospitals: (params: {
    sido: string;
    sigungu: string;
    pageNo?: number;
    numOfRows?: number;
  }) => withQuery(`/hospitals`, params),
  /**
   * 여성안심지킴이집 — 이 목록 API 는 어떤 지역 필터도 받지 않습니다.
   * 지도 레이어는 regionName 을 지키는 공개 API(safetyFacilities)를 씁니다.
   */
  femaleSafetyHouses: (params?: { pageNo?: number; numOfRows?: number }) =>
    withQuery(`/female-safety-houses`, params),
  /** CCTV — localGovernmentCode(City.cctvLocalGovernmentCode)로 시군 필터. limit 1~100. */
  cctvs: (params: {
    localGovernmentCode: string;
    page?: number;
    limit?: number;
  }) => withQuery(`/cctvs`, params),
  /** 스마트 가로등 — sido 필수, sigungu 는 함께 주면 시군까지 좁혀집니다. limit 1~100. */
  smartStreetlights: (params: {
    sido: string;
    sigungu?: string;
    page?: number;
    limit?: number;
  }) => withQuery(`/smart-streetlights`, params),
  /** 충북 음식업소 — 지역 파라미터 없음. 서버 데이터가 통틀어 10건뿐입니다(2026-09). */
  chungbukFoods: (params?: { currentPage?: number; perPage?: number }) =>
    withQuery(`/foods/chungbuk`, params),

  // 관광정보 (한국관광공사 TourAPI 프록시)
  /** 지역 전체 관광정보 조회 — 정확한 사용자·지도 좌표는 보내지 않습니다. */
  tourRegionBased: (params: Record<string, QueryValue>) =>
    withQuery(`/travel/information/region-based-list`, params),

  // 관광사진갤러리
  /**
   * 관광사진 키워드 검색: /gallerySearchList1
   * 좌표 파라미터가 없어 키워드(장소명·지역명)로만 찾을 수 있습니다.
   */
  gallerySearch: (params: Record<string, QueryValue>) =>
    withQuery(`/travel/photozone/gallery-search-list`, params),

  // 댓글
  /** 기록의 댓글 조회(GET) / 등록(POST) */
  recordComments: (recordId: string) =>
    `/travel-records/${encodeURIComponent(recordId)}/comments`,
  /** 댓글 수정(PATCH) / 삭제(DELETE) — 기록 id 가 아니라 댓글 id 기준입니다 */
  comment: (commentId: string) =>
    `/travel-records/comments/${encodeURIComponent(commentId)}`,
  /** 댓글 좋아요(POST) / 취소(DELETE) */
  commentLikes: (commentId: string) =>
    `/travel-records/comments/${encodeURIComponent(commentId)}/likes`,

  // ── 여행 정보 (한국관광공사 TourAPI 프록시) ──
  // 서버가 kebab-case 와 원본 camelCase(예: searchKeyword2) 두 벌을 열어두었는데
  // 같은 핸들러입니다. 우리 서버 라우팅 관례를 따라 kebab-case 만 씁니다.

  /** 키워드 검색 조회 */
  tourSearchKeyword: (params?: TourInfoQuery) =>
    withQuery(`/travel/information/search-keyword`, params),
  /** 지역기반 관광정보 조회 */
  tourAreaBasedList: (params?: TourInfoQuery) =>
    withQuery(`/travel/information/area-based-list`, params),
  /** 지역명 기반 관광정보 조회 */
  tourRegionBasedList: (params?: TourInfoQuery) =>
    withQuery(`/travel/information/region-based-list`, params),
  /** 행사 정보 조회 */
  tourSearchFestival: (params?: TourInfoQuery) =>
    withQuery(`/travel/information/search-festival`, params),
  /** 숙박 정보 조회 */
  tourSearchStay: (params?: TourInfoQuery) =>
    withQuery(`/travel/information/search-stay`, params),
  /** 공통 정보 조회 (제목·주소·개요) */
  tourDetailCommon: (params?: TourInfoQuery) =>
    withQuery(`/travel/information/detail-common`, params),
  /** 소개 정보 조회 (이용시간·휴무일 등, 콘텐츠 타입별로 필드가 다름) */
  tourDetailIntro: (params?: TourInfoQuery) =>
    withQuery(`/travel/information/detail-intro`, params),
  /** 이미지 정보 조회 */
  tourDetailImage: (params?: TourInfoQuery) =>
    withQuery(`/travel/information/detail-image`, params),
  /** 지역코드 조회 (areaCode 를 주면 그 지역의 시군구 목록) */
  tourAreaCode: (params?: TourInfoQuery) =>
    withQuery(`/travel/information/area-code`, params),
  /** 법정동 코드 조회 */
  tourLdongCode: (params?: TourInfoQuery) =>
    withQuery(`/travel/information/ldong-code`, params),

  /** 관광사진 갤러리 목록 조회 */
  tourGalleryList: (params?: GalleryQuery) =>
    withQuery(`/travel/photozone/gallery-list`, params),
  /** 관광사진 갤러리 키워드 검색 */
  tourGallerySearchList: (params?: GalleryQuery) =>
    withQuery(`/travel/photozone/gallery-search-list`, params),

  /** 지역안전지수 목록 조회 */
  regionalSafety: (params?: RegionalSafetyQuery) =>
    withQuery(`/travel/regional-safety`, params),
  /** 시도명으로 지역안전지수 조회 — 해당 시도의 시군까지 한 번에 옵니다 */
  regionalSafetyBySido: (params?: RegionalSafetyQuery) =>
    withQuery(`/travel/regional-safety/sido`, params),

  /** 기초지자체 중심 관광지 목록 (방문 상위 랭킹) */
  municipalityAttractions: (params: MunicipalityQuery) =>
    withQuery(`/travel/municipality/tourist-attractions/items`, params),

  /** 기초 지자체(시군구) 지역방문자수 — 지역 필터가 없어 전국이 통째로 옵니다 */
  visitorLocalGovernment: (params: VisitorRegionQuery) =>
    withQuery(`/travel/visitor-region/local-government`, params),
  /** 광역 지자체(시도) 지역방문자수 */
  visitorMetropolitan: (params: VisitorRegionQuery) =>
    withQuery(`/travel/visitor-region/metropolitan`, params),
} as const;
