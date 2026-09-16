import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import { normalizeError } from '@/api/network';
import { AppText, Button, IconButton, Screen } from '@/components/common';
import { Banner } from '@/components/feedback';
import { OtpInput } from '@/components/forms';
import { Config } from '@/constants/config';
import { Layout, Spacing } from '@/constants/theme';
import { selectIsAuthenticated, selectOtpChallenge } from '@/features/auth/authSelectors';
import { requestLoginOtp, signInWithOtp } from '@/features/auth/authThunks';
import { authErrorMessage, authFieldErrors } from '@/features/auth/errors';
import { isCompleteOtpCode, ValidationMessages } from '@/features/auth/validation';
import { selectIsOffline } from '@/features/connectivity/connectivitySlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { formatPhoneForDisplay } from '@/utils/phone';
import { formatCountdown, secondsUntil } from '@/utils/time';

const Copy = {
  title: 'Verify Your Number',
  verify: 'Verify and continue',
  resend: 'Resend code',
  noCode: 'Did not receive the code?',
  resent: 'We have sent a new code.',
  offline: 'You are offline',
  offlineDetail: 'Check your internet connection to verify the code.',
  back: 'Back to sign in',
};

export default function OtpScreen() {
  const dispatch = useAppDispatch();
  const challenge = useAppSelector(selectOtpChallenge);
  const authenticated = useAppSelector(selectIsAuthenticated);
  const offline = useAppSelector(selectIsOffline);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const phone = challenge?.phone ?? null;
  const resendAvailableAt = challenge?.resendAvailableAt ?? null;
  const [secondsLeft, setSecondsLeft] = useState(() =>
    resendAvailableAt ? secondsUntil(resendAvailableAt) : 0,
  );

  // Recomputed from the timestamp on every tick, so a backgrounded app catches up.
  useEffect(() => {
    if (resendAvailableAt == null) return;
    const update = () => setSecondsLeft(secondsUntil(resendAvailableAt));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [resendAvailableAt]);

  const verify = useCallback(
    async (value: string) => {
      if (!phone || verifying) return;
      if (!isCompleteOtpCode(value)) {
        setError(ValidationMessages.code);
        return;
      }

      setError(null);
      setInfo(null);
      setVerifying(true);
      try {
        // On success the root layout swaps to the app group and this unmounts.
        await dispatch(signInWithOtp({ phone, code: value })).unwrap();
      } catch (caught) {
        const apiError = normalizeError(caught);
        setError(authFieldErrors(apiError).code ?? authErrorMessage(apiError, 'verifyOtp'));
        setCode('');
      } finally {
        setVerifying(false);
      }
    },
    [dispatch, phone, verifying],
  );

  const resend = async () => {
    if (!phone || secondsLeft > 0 || resending) return;
    setError(null);
    setInfo(null);
    setCode('');
    setResending(true);
    try {
      await dispatch(requestLoginOtp({ phone, resend: true })).unwrap();
      setInfo(Copy.resent);
    } catch (caught) {
      const apiError = normalizeError(caught);
      setError(authFieldErrors(apiError).phone ?? authErrorMessage(apiError, 'requestOtp'));
    } finally {
      setResending(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/login');
  };

  // A successful sign-in also clears the challenge: the root layout is already
  // swapping to the app group, so this must not bounce back to Login.
  if (!challenge || !phone) return authenticated ? null : <Redirect href="/login" />;

  const busy = verifying || resending;

  return (
    <Screen background="surface" padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <IconButton icon="chevron-back" accessibilityLabel={Copy.back} onPress={goBack} />
          </View>

          <AppText variant="display" accessibilityRole="header">
            {Copy.title}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary" style={styles.subtitle}>
            {`We have sent a ${Config.otpLength}-digit code to ${formatPhoneForDisplay(phone)} on WhatsApp. It is valid for ${Config.otpValidityMinutes} minutes.`}
          </AppText>

          {challenge.notice || offline || info || error ? (
            <View style={styles.banners}>
              {challenge.notice ? <Banner tone="info" title={challenge.notice} /> : null}
              {offline ? (
                <Banner
                  tone="warning"
                  icon="cloud-offline-outline"
                  title={Copy.offline}
                  description={Copy.offlineDetail}
                />
              ) : null}
              {info && !error ? (
                <Banner tone="success" icon="checkmark-circle-outline" title={info} />
              ) : null}
              {error ? <Banner tone="error" title={error} /> : null}
            </View>
          ) : null}

          <OtpInput
            value={code}
            onChangeText={(next) => {
              setCode(next);
              if (error) setError(null);
            }}
            onComplete={(next) => void verify(next)}
            length={Config.otpLength}
            autoFocus
            editable={!busy}
            hasError={!!error}
          />

          <Button
            title={Copy.verify}
            onPress={() => void verify(code)}
            loading={verifying}
            disabled={offline || code.length < Config.otpLength}
            style={styles.submit}
          />

          <View style={styles.resend}>
            <AppText variant="caption" color="textSecondary">
              {Copy.noCode}
            </AppText>
            {secondsLeft > 0 ? (
              <AppText variant="captionMedium" color="textMuted">
                {`Resend in ${formatCountdown(secondsLeft)}`}
              </AppText>
            ) : (
              <Pressable
                onPress={() => void resend()}
                disabled={busy || offline}
                accessibilityRole="button"
                accessibilityLabel={Copy.resend}
                accessibilityState={{ disabled: busy || offline, busy: resending }}
                hitSlop={8}
              >
                <AppText variant="captionMedium" color={busy || offline ? 'disabledText' : 'deepGreen'}>
                  {Copy.resend}
                </AppText>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.xxl,
    maxWidth: Layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: { alignItems: 'flex-start', marginBottom: Spacing.xl },
  subtitle: { marginTop: Spacing.sm, marginBottom: Spacing.xxl },
  banners: { gap: Spacing.sm, marginBottom: Spacing.xl },
  submit: { marginTop: Spacing.xxl },
  resend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xl,
  },
});
