/** 카카오 인증 뒤, 서비스 진입 전에 표시하는 이용약관 동의 화면. */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CheckIcon } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthContext';
import { authService } from '../../auth/authService';
import {
  CURRENT_TERMS_VERSION,
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
} from '../../config/legal';
import { toApiError } from '../../api/errors';
import { colors } from '../../theme/colors';

async function openDocument(label: string, url: string | null) {
  if (!url) {
    Alert.alert(
      `${label} 준비 중`,
      '문서 URL은 백엔드 약관 API가 확정되면 연결할 예정입니다.',
    );
    return;
  }

  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('문서를 열 수 없어요', '잠시 후 다시 시도해주세요.');
  }
}

function TermsAgreementScreen() {
  const insets = useSafeAreaInsets();
  const { completeTermsAgreement, logout } = useAuth();
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [termsVersion, setTermsVersion] = useState<string | null>(null);
  const [termsUrl, setTermsUrl] = useState<string | null>(null);

  const isAllAgreed = termsAgreed && privacyAgreed;

  const handleToggleAll = () => {
    const nextValue = !isAllAgreed;
    setTermsAgreed(nextValue);
    setPrivacyAgreed(nextValue);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        console.log(
          '[TermsAgreementScreen] 서비스 이용약관 전문 조회 시작 (GET /terms/service)',
        );
        const serviceTerms = await authService.getServiceTerms();
        console.log(
          '[TermsAgreementScreen] 서비스 이용약관 조회 성공:',
          serviceTerms,
        );
        if (cancelled) {
          return;
        }
        if (
          serviceTerms.version &&
          /^[a-f0-9]{64}$/i.test(serviceTerms.version.trim())
        ) {
          console.log(
            '[TermsAgreementScreen] 약관 버전 설정:',
            serviceTerms.version.trim(),
          );
          setTermsVersion(serviceTerms.version.trim());
        }
      } catch (err) {
        console.warn(
          '[TermsAgreementScreen] 초기 약관 정보 조회 실패 (제출 시 재시도):',
          err,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAcceptTerms = async () => {
    if (!isAllAgreed || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    let versionToSubmit = termsVersion;
    if (!versionToSubmit) {
      console.log(
        '[TermsAgreementScreen] termsVersion이 null 상태입니다. 최신 약관 조회를 먼저 수행합니다.',
      );
      try {
        const serviceTerms = await authService.getServiceTerms();
        if (
          serviceTerms.version &&
          /^[a-f0-9]{64}$/i.test(serviceTerms.version.trim())
        ) {
          versionToSubmit = serviceTerms.version.trim();
          setTermsVersion(versionToSubmit);
        }
      } catch (err) {
        console.warn('[TermsAgreementScreen] 최신 약관 조회 실패:', err);
      }
    }

    if (!versionToSubmit || !/^[a-f0-9]{64}$/i.test(versionToSubmit)) {
      versionToSubmit = CURRENT_TERMS_VERSION;
    }

    console.log(
      '[TermsAgreementScreen] 약관 동의 제출 시작 (전달할 버전:',
      versionToSubmit,
      ')',
    );
    try {
      await completeTermsAgreement(versionToSubmit);
      console.log('[TermsAgreementScreen] 약관 동의 제출 완료');
    } catch (caught) {
      console.error('[TermsAgreementScreen] 약관 동의 제출 실패:', caught);
      const apiError = toApiError(caught);
      console.error('[TermsAgreementScreen] ApiError 분석:', {
        status: apiError.status,
        code: apiError.code,
        message: apiError.message,
        payload: apiError.payload,
        isConflict: apiError.isConflict,
        isUnauthorized: apiError.isUnauthorized,
      });
      if (apiError.isConflict) {
        // 409 Conflict: 이전 버전은 409로 거부
        const message =
          apiError.message && !apiError.message.includes('409')
            ? apiError.message
            : '이전 버전의 약관입니다. 최신 약관을 확인한 후 다시 시도해주세요.';
        setErrorMessage(message);
        Alert.alert('약관 동의 불가', message);
      } else if (apiError.isUnauthorized) {
        const message = '로그인 세션이 만료되었습니다. 다시 로그인해주세요.';
        setErrorMessage(message);
        Alert.alert('세션 만료', message, [
          { text: '확인', onPress: () => logout() },
        ]);
      } else if (apiError.isNetworkError) {
        const message =
          '서버에 연결할 수 없습니다. 네트워크 연결 상태를 확인해주세요.';
        setErrorMessage(message);
        Alert.alert('네트워크 오류', message);
      } else {
        const message =
          apiError.message ||
          '약관 동의 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        setErrorMessage(message);
        Alert.alert('오류', message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          혼행등대를 시작하기 전에{`\n`}약관을 확인해주세요
        </Text>
        <Text style={styles.description}>
          서비스 이용에 필요한 필수 약관이에요.
        </Text>

        <View style={styles.cardContainer}>
          {/* 전체 동의 */}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="약관 전체 동의"
            accessibilityState={{ checked: isAllAgreed }}
            onPress={handleToggleAll}
            style={styles.allAgreementRow}
          >
            <View
              style={[
                styles.checkbox,
                styles.checkboxLarge,
                isAllAgreed && styles.checkboxChecked,
              ]}
            >
              {isAllAgreed ? (
                <CheckIcon
                  color={colors.textOnPrimary}
                  size={18}
                  weight="bold"
                />
              ) : null}
            </View>
            <Text style={styles.allAgreementLabel}>약관 전체 동의</Text>
          </Pressable>

          <View style={styles.divider} />

          {/* 1. 필수 혼행등대 이용약관 */}
          <View style={styles.itemRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="필수 혼행등대 이용약관 동의"
              accessibilityState={{ checked: termsAgreed }}
              onPress={() => setTermsAgreed(v => !v)}
              style={styles.itemToggle}
            >
              <View
                style={[
                  styles.checkbox,
                  termsAgreed && styles.checkboxChecked,
                ]}
              >
                {termsAgreed ? (
                  <CheckIcon
                    color={colors.textOnPrimary}
                    size={14}
                    weight="bold"
                  />
                ) : null}
              </View>
              <Text style={styles.itemLabel}>
                <Text style={styles.required}>[필수] </Text>
                혼행등대 이용약관 동의
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="혼행등대 이용약관 보기"
              hitSlop={8}
              onPress={() =>
                openDocument('이용약관', termsUrl ?? TERMS_OF_SERVICE_URL)
              }
            >
              <Text style={styles.viewLabel}>보기</Text>
            </Pressable>
          </View>

          {/* 2. 필수 개인정보 수집 및 이용 동의 */}
          <View style={styles.itemRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="필수 개인정보 수집 및 이용 동의"
              accessibilityState={{ checked: privacyAgreed }}
              onPress={() => setPrivacyAgreed(v => !v)}
              style={styles.itemToggle}
            >
              <View
                style={[
                  styles.checkbox,
                  privacyAgreed && styles.checkboxChecked,
                ]}
              >
                {privacyAgreed ? (
                  <CheckIcon
                    color={colors.textOnPrimary}
                    size={14}
                    weight="bold"
                  />
                ) : null}
              </View>
              <Text style={styles.itemLabel}>
                <Text style={styles.required}>[필수] </Text>
                개인정보 수집 및 이용 동의
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="개인정보 처리방침 보기"
              hitSlop={8}
              onPress={() =>
                openDocument('개인정보 처리방침', PRIVACY_POLICY_URL)
              }
            >
              <Text style={styles.viewLabel}>보기</Text>
            </Pressable>
          </View>
        </View>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="동의하고 시작하기"
          accessibilityState={{ disabled: !isAllAgreed || isSubmitting }}
          disabled={!isAllAgreed || isSubmitting}
          onPress={handleAcceptTerms}
          style={({ pressed }) => [
            styles.primaryButton,
            (!isAllAgreed || isSubmitting) && styles.primaryButtonDisabled,
            pressed && isAllAgreed && !isSubmitting && styles.primaryButtonPressed,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.textOnPrimary} size="small" />
          ) : (
            <Text
              style={[
                styles.primaryButtonLabel,
                !isAllAgreed && styles.primaryButtonLabelDisabled,
              ]}
            >
              동의하고 시작하기
            </Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="동의하지 않고 로그아웃"
          disabled={isSubmitting}
          onPress={logout}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && !isSubmitting && styles.secondaryButtonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonLabel}>동의하지 않고 나가기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    backgroundColor: colors.cream,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 56,
  },
  title: {
    fontSize: 27,
    lineHeight: 38,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  description: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  cardContainer: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  allAgreementRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  allAgreementLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  itemRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  itemLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.textTertiary,
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  checkboxLarge: {
    width: 24,
    height: 24,
    borderRadius: 7,
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  required: {
    color: colors.primaryStrong,
    fontWeight: '600',
  },
  viewLabel: {
    paddingLeft: 8,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  errorBanner: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#fed7d7',
  },
  errorBannerText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
    textAlign: 'center',
    fontWeight: '500',
  },
  actions: {
    gap: 8,
  },
  primaryButton: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryStrong,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.ctaDisabled,
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  primaryButtonLabelDisabled: {
    color: colors.ctaDisabledText,
  },
  secondaryButton: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  secondaryButtonPressed: {
    backgroundColor: colors.surface,
  },
  secondaryButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

export default TermsAgreementScreen;
