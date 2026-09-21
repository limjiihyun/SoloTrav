/**
 * 앱 버전 확인 및 업데이트 안내 서비스
 * 
 * - 자체 백엔드 API 없이 원격 JSON (GitHub Raw, Vercel, S3 등)을 통해 최신 버전을 조회합니다.
 * - Android의 경우 원스토어 상품 페이지로 연결합니다.
 */
import { Alert, Linking, Platform } from 'react-native';

// 현재 앱의 설치 버전 (package.json 및 build.gradle의 versionName과 일치)
export const CURRENT_APP_VERSION = '0.0.17';
export const APP_PACKAGE_NAME = 'com.solotravelmatemobile';
export const ONESTORE_PRODUCT_ID = '0001008932';
export const APP_STORE_ID = ''; // iOS App Store 출시 시 App ID 입력 (예: '1234567890')

/**
 * 원격 버전 설정 JSON 파일 URL
 * GitHub Raw URL 또는 S3/호스팅 JSON 경로를 지정할 수 있습니다.
 */
export const DEFAULT_UPDATE_CONFIG_URL =
  'https://raw.githubusercontent.com/jh0neee/SoloTrav/main/app-version.json';

export interface AppVersionConfig {
  latestVersion: string;
  minVersion?: string;
  releaseNotes?: string;
  forceUpdate?: boolean;
  storeUrl?: string;
}

export interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string;
  needsUpdate: boolean;
  isForceUpdate: boolean;
  releaseNotes?: string;
  storeUrl?: string;
}

let hasCheckedInitialLaunch = false;

/**
 * 시맨틱 버전(SemVer) 비교 함수 (v1 < v2 이면 -1, v1 == v2 이면 0, v1 > v2 이면 1)
 */
export function compareVersions(v1: string, v2: string): number {
  const cleanV1 = v1.replace(/^v/, '').trim();
  const cleanV2 = v2.replace(/^v/, '').trim();

  const parts1 = cleanV1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = cleanV2.split('.').map(p => parseInt(p, 10) || 0);

  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}

/**
 * 원격 버전 설정 JSON 파일 URL 후보군
 * main 브랜치 우선 조회 후, 실패 시 feature 브랜치 등으로 fallback 합니다.
 */
export const UPDATE_CONFIG_URLS = [
  'https://raw.githubusercontent.com/jh0neee/SoloTrav/main/app-version.json',
  'https://raw.githubusercontent.com/jh0neee/SoloTrav/feature/sjihyeon/app-version.json',
];

/**
 * 원격 버전 정보 조회 (CDN 캐시 방지 적용)
 */
export async function fetchRemoteVersionConfig(
  customUrl?: string,
): Promise<AppVersionConfig | null> {
  const targetUrls = customUrl ? [customUrl] : UPDATE_CONFIG_URLS;

  for (const baseUrl of targetUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // GitHub CDN의 5분 캐시를 우회하기 위해 timestamp 쿼리 파라미터 추가
      const cacheBustUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

      const response = await fetch(cacheBustUrl, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data: AppVersionConfig = await response.json();
        if (data && data.latestVersion) {
          return data;
        }
      }
    } catch {
      // 다음 URL로 fallback 시도
    }
  }

  return null;
}

/**
 * 스토어 상세 페이지 열기
 * Android: 원스토어 앱 상세 페이지를 우선 열고, 앱이 없으면 원스토어 웹으로 연결
 */
export async function openAppStore(customUrl?: string): Promise<void> {
  if (customUrl) {
    try {
      await Linking.openURL(customUrl);
      return;
    } catch {
      // 커스텀 URL 열기 실패 시 기본 스킴으로 진행
    }
  }

  if (Platform.OS === 'android') {
    const oneStoreAppUrl = `onestore://common/product/${ONESTORE_PRODUCT_ID}`;
    const oneStoreWebUrl = `https://onesto.re/${ONESTORE_PRODUCT_ID}`;

    try {
      await Linking.openURL(oneStoreAppUrl);
    } catch {
      await Linking.openURL(oneStoreWebUrl);
    }
  } else if (Platform.OS === 'ios') {
    if (APP_STORE_ID) {
      const appStoreUrl = `itms-apps://itunes.apple.com/app/id${APP_STORE_ID}`;
      try {
        await Linking.openURL(appStoreUrl);
      } catch {
        // App Store 앱 열기 실패 시
      }
    }
  }
}

/**
 * 앱 버전 체크 수행
 */
export async function checkVersionStatus(): Promise<VersionCheckResult | null> {
  const remoteConfig = await fetchRemoteVersionConfig();
  if (!remoteConfig || !remoteConfig.latestVersion) {
    return null;
  }

  const current = CURRENT_APP_VERSION;
  const latest = remoteConfig.latestVersion;
  const minVersion = remoteConfig.minVersion || '0.0.0';

  const needsUpdate = compareVersions(current, latest) < 0;
  const isForceUpdate =
    Boolean(remoteConfig.forceUpdate) || compareVersions(current, minVersion) < 0;

  return {
    currentVersion: current,
    latestVersion: latest,
    needsUpdate,
    isForceUpdate,
    releaseNotes: remoteConfig.releaseNotes,
    storeUrl: remoteConfig.storeUrl,
  };
}

/**
 * 업데이트 체크 후 안내 팝업 띄우기
 *
 * @param options.isInitialLaunch 앱 최초 진입 시 체크 여부 (세션 당 1회만 노출)
 * @param options.showUpToDateAlert 최신 버전일 때도 "최신 버전입니다" 팝업을 띄울지 여부 (마이 탭에서 수동 확인 시 true)
 */
export async function checkAndPromptAppUpdate(options: {
  isInitialLaunch?: boolean;
  showUpToDateAlert?: boolean;
}): Promise<void> {
  if (options.isInitialLaunch) {
    if (hasCheckedInitialLaunch) return;
    hasCheckedInitialLaunch = true;
  }

  const status = await checkVersionStatus();

  if (!status) {
    if (options.showUpToDateAlert) {
      Alert.alert(
        '버전 확인',
        `현재 버전: v${CURRENT_APP_VERSION}\n최신 버전 정보를 확인할 수 없습니다. 네트워크를 확인해주세요.`,
      );
    }
    return;
  }

  if (status.needsUpdate) {
    const noteText = status.releaseNotes ? `\n\n[업데이트 내용]\n${status.releaseNotes}` : '';

    if (status.isForceUpdate) {
      // 강제 업데이트 (취소 불가)
      Alert.alert(
        '필수 업데이트 안내',
        `원활한 서비스 이용을 위해 최신 버전(v${status.latestVersion})으로 업데이트가 필요합니다.${noteText}`,
        [
          {
            text: '업데이트하기',
            onPress: () => openAppStore(status.storeUrl),
          },
        ],
        { cancelable: false },
      );
    } else {
      // 선택 업데이트
      Alert.alert(
        '앱 업데이트 안내',
        `새로운 버전(v${status.latestVersion})이 출시되었습니다.${noteText}\n\n지금 업데이트하시겠습니까?`,
        [
          {
            text: '나중에 하기',
            style: 'cancel',
            onPress: () => {
              if (options.isInitialLaunch) {
                // 사용자가 첫 진입 때 '나중에 하기'를 선택하면 마이 탭에서 할 수 있다고 추가 안내
                setTimeout(() => {
                  Alert.alert(
                    '업데이트 안내',
                    '마이 탭의 [앱 버전 및 업데이트] 메뉴에서 언제든지 다시 업데이트하실 수 있습니다.',
                  );
                }, 300);
              }
            },
          },
          {
            text: '업데이트',
            onPress: () => openAppStore(status.storeUrl),
          },
        ],
      );
    }
  } else {
    if (options.showUpToDateAlert) {
      Alert.alert(
        '최신 버전입니다',
        `현재 최신 버전(v${CURRENT_APP_VERSION})을 사용하고 있습니다.`,
      );
    }
  }
}
