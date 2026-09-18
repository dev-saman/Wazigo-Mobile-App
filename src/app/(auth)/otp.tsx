import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';

import { normalizeError } from '@/api/network';
import { AppText, IconButton, Screen } from '@/components/common';
import { Banner } from '@/components/feedback';
import { OtpInput } from '@/components/forms';
import { Config } from '@/constants/config';
import { Colors, Layout, Spacing } from '@/constants/theme';
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
  sentTo: (length: number) => `We've sent a ${length}-digit WhatsApp code to`,
  validFor: (minutes: number) => `The code is valid for ${minutes} minutes.`,
  resend: 'Resend code',
  noCode: "Didn't receive the code?",
  resendIn: 'Resend in',
  resent: 'We have sent a new code.',
  verifying: 'Verifying…',
  offlineHint: 'You need an internet connection to verify the code.',
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
  const displayPhone = formatPhoneForDisplay(phone);

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

          {/* Design screen 3: centred title, then the number on its own line in green. */}
          <AppText variant="display" align="center" accessibilityRole="header">
            {Copy.title}
          </AppText>
          <View
            style={styles.subtitle}
            accessible
            accessibilityLabel={`${Copy.sentTo(Config.otpLength)} ${displayPhone}. ${Copy.validFor(Config.otpValidityMinutes)}`}
          >
            <AppText variant="bodySmall" color="textSecondary" align="center">
              {Copy.sentTo(Config.otpLength)}
            </AppText>
            <AppText variant="title" color="deepGreen" align="center">
              {displayPhone}
            </AppText>
          </View>

          {/*
            Offline is reported once by the global strip in `Screen`.

            `challenge.notice` is deliberately NOT rendered. It is server text
            (AUTH-01 `data.notice`), and for accounts the backend flags as review
            test accounts it reads "This is a review test account…", which is
            store-reviewer instruction rather than anything a real person should
            see. The field is still parsed and kept in `auth.otpChallenge`, so
            restoring it is a one-line change if a notice worth showing appears.
          */}
          {info || error ? (
            <View style={styles.banners}>
              {info && !error ? (
                <Banner tone="success" icon="checkmark-circle-outline" title={info} />
              ) : null}
              {error ? <Banner tone="error" title={error} /> : null}
            </View>
          ) : null}

          {/* No verify button, as in the design: the code is checked as soon as the
              last digit is in, whether typed, pasted or autofilled. A wrong code is
              cleared so the next attempt starts empty. */}
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

          {offline ? (
            <AppText variant="caption" color="textSecondary" align="center" style={styles.hint}>
              {Copy.offlineHint}
            </AppText>
          ) : null}

          {verifying ? (
            <View style={styles.row} accessibilityLiveRegion="polite">
              <ActivityIndicator color={Colors.primary} size="small" />
              <AppText variant="caption" color="textSecondary">
                {Copy.verifying}
              </AppText>
            </View>
          ) : (
            <View style={styles.row}>
              <AppText variant="caption" color="textSecondary">
                {Copy.noCode}
              </AppText>
              {secondsLeft > 0 ? (
                <AppText
                  variant="caption"
                  color="textSecondary"
                  accessibilityLabel={`${Copy.resendIn} ${secondsLeft} seconds`}
                >
                  {`${Copy.resendIn} `}
                  <AppText variant="captionMedium" color="textPrimary">
                    {formatCountdown(secondsLeft)}
                  </AppText>
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
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
    maxWidth: Layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  // The back arrow sits at the top; the title starts well below it, as in the design.
  header: { alignItems: 'flex-start', marginBottom: Spacing.huge },
  subtitle: { marginTop: Spacing.sm, marginBottom: Spacing.xxxl, gap: Spacing.xxs },
  banners: { gap: Spacing.sm, marginBottom: Spacing.xl },
  hint: { marginTop: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xxl,
  },
});
