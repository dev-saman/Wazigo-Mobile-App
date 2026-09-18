import { useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type TextInput,
} from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';

import { normalizeError } from '@/api/network';
import { AppText, BrandLogo, Button, IconButton, Screen } from '@/components/common';
import { Banner } from '@/components/feedback';
import { PhoneField, TextField } from '@/components/forms';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { selectOtpChallenge } from '@/features/auth/authSelectors';
import { requestLoginOtp, signInWithPassword } from '@/features/auth/authThunks';
import { authErrorMessage, authFieldErrors } from '@/features/auth/errors';
import { loginFormSchema, ValidationMessages, type LoginFormValues } from '@/features/auth/validation';
import { selectIsOffline } from '@/features/connectivity/connectivitySlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toE164 } from '@/utils/phone';
import { secondsUntil } from '@/utils/time';

const Copy = {
  title: 'Welcome Back',
  subtitle: 'Sign in to continue to your business account',
  phoneLabel: 'Phone number',
  phonePlaceholder: 'Enter your phone number',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Enter your password',
  continueWithOtp: 'Continue',
  signIn: 'Sign In',
  usePassword: 'Sign in with password',
  useOtp: 'Use a one-time code instead',
  otpHint: 'We will send a login code to this number on WhatsApp.',
  offlineHint: 'You need an internet connection to sign in.',
  or: 'or',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const offline = useAppSelector(selectIsOffline);
  const challenge = useAppSelector(selectOtpChallenge);

  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const { control, handleSubmit, setError, setValue, formState } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { phone: '', password: '', mode: 'otp' },
  });

  // useWatch (not watch) keeps this component compatible with React Compiler.
  const mode = useWatch({ control, name: 'mode' });
  const busy = formState.isSubmitting;

  // Unused while the password entry point is commented out at the bottom of the
  // form. Kept, not deleted, so restoring AUTH-03 is a one-block change.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const switchMode = (next: LoginFormValues['mode']) => {
    setFormError(null);
    setValue('mode', next);
    setValue('password', '');
  };

  const submit = handleSubmit(async (values) => {
    const phone = toE164(values.phone);
    if (!phone) {
      setError('phone', { message: ValidationMessages.phone });
      return;
    }

    setFormError(null);

    try {
      if (values.mode === 'password') {
        // The root layout swaps to the app group as soon as the session lands.
        await dispatch(signInWithPassword({ phone, password: values.password })).unwrap();
        return;
      }

      // A code is already on its way to this number: go straight to the OTP
      // screen instead of asking for one the server would refuse to send.
      if (challenge?.phone === phone && secondsUntil(challenge.resendAvailableAt) > 0) {
        router.push('/otp');
        return;
      }

      await dispatch(requestLoginOtp({ phone })).unwrap();
      router.push('/otp');
    } catch (error) {
      const apiError = normalizeError(error);
      const fields = authFieldErrors(apiError);
      if (fields.phone) setError('phone', { message: fields.phone });
      if (fields.password) setError('password', { message: fields.password });
      setFormError(
        fields.phone || fields.password
          ? null
          : authErrorMessage(apiError, values.mode === 'password' ? 'password' : 'requestOtp'),
      );
    }
  });

  // Design screen 2: content starts in the upper part of the screen rather than
  // centred, under a wordmark about 60% of the width.
  const { width, height } = useWindowDimensions();
  const wordmarkWidth = clamp(Math.round(width * 0.6), 190, 250);

  return (
    <Screen background="surface" padded={false}>
      {/* The scroll view sits inside the avoiding view: nesting them the other
          way round leaves the focused field under the keyboard. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: Math.round(height * 0.1) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <BrandLogo variant="logoDark" width={wordmarkWidth} />
          </View>

          <AppText variant="display" align="center" accessibilityRole="header">
            {Copy.title}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary" align="center" style={styles.subtitle}>
            {Copy.subtitle}
          </AppText>

          {/* Offline is reported once by the global strip in `Screen`; this
              screen only says what that means for signing in. */}
          {formError ? (
            <View style={styles.banners}>
              <Banner tone="error" title={formError} />
            </View>
          ) : null}

          <Controller
            control={control}
            name="phone"
            render={({ field, fieldState }) => (
              <PhoneField
                // No visible label or hint in the design; screen readers still
                // get both.
                accessibilityLabel={Copy.phoneLabel}
                accessibilityHint={mode === 'otp' ? Copy.otpHint : undefined}
                placeholder={Copy.phonePlaceholder}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                editable={!busy}
                error={fieldState.error?.message}
                containerStyle={styles.field}
                returnKeyType={mode === 'password' ? 'next' : 'done'}
                onSubmitEditing={() =>
                  mode === 'password' ? passwordRef.current?.focus() : void submit()
                }
              />
            )}
          />

          {mode === 'password' ? (
            <Controller
              control={control}
              name="password"
              render={({ field, fieldState }) => (
                <TextField
                  ref={passwordRef}
                  accessibilityLabel={Copy.passwordLabel}
                  placeholder={Copy.passwordPlaceholder}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  editable={!busy}
                  error={fieldState.error?.message}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={() => void submit()}
                  containerStyle={styles.field}
                  trailing={
                    <IconButton
                      icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      color="textMuted"
                      onPress={() => setShowPassword((visible) => !visible)}
                    />
                  }
                />
              )}
            />
          ) : null}

          <Button
            title={mode === 'password' ? Copy.signIn : Copy.continueWithOtp}
            onPress={() => void submit()}
            loading={busy}
            disabled={offline}
            accessibilityHint={offline ? Copy.offlineHint : undefined}
          />
          {offline ? (
            <AppText variant="caption" color="textSecondary" align="center" style={styles.hint}>
              {Copy.offlineHint}
            </AppText>
          ) : null}

          {/*
            Password sign-in is hidden for now: WhatsApp OTP is the only way in.

            Only the entry point is commented out. AUTH-03 is still wired end to
            end - the password field above, `switchMode`, `signInWithPassword`
            and the copy all remain - so restoring it is a matter of putting this
            block back. Without it `mode` can never become 'password', which is
            what makes the field above unreachable rather than dead.

          <View style={styles.divider}>
            <View style={styles.rule} />
            <AppText variant="caption" color="textMuted">
              {Copy.or}
            </AppText>
            <View style={styles.rule} />
          </View>

          <Button
            title={mode === 'password' ? Copy.useOtp : Copy.usePassword}
            variant="outline"
            icon={mode === 'password' ? 'chatbubble-ellipses-outline' : 'lock-closed-outline'}
            disabled={busy}
            onPress={() => switchMode(mode === 'password' ? 'otp' : 'password')}
          />
          */}
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
    paddingBottom: Spacing.xxl,
    maxWidth: Layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: { alignItems: 'center', marginBottom: Spacing.xxxl },
  // Narrow enough to wrap onto two lines, as in the design.
  subtitle: { marginTop: Spacing.sm, marginBottom: Spacing.xxxl, maxWidth: 220, alignSelf: 'center' },
  banners: { gap: Spacing.sm, marginBottom: Spacing.lg },
  field: { marginBottom: Spacing.xxl },
  hint: { marginTop: Spacing.sm },
  // "— or —": short dashes either side, not rules across the screen.
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.xxl,
  },
  rule: { width: 20, height: 1, backgroundColor: Colors.borderStrong },
});
