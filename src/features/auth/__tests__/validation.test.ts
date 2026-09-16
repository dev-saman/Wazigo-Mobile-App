import type { ApiError } from '@/api/types';
import { Config } from '@/constants/config';

import { authErrorMessage, authFieldErrors } from '../errors';
import { isCompleteOtpCode, loginFormSchema } from '../validation';

const values = (overrides: Partial<Record<'phone' | 'password' | 'mode', string>> = {}) => ({
  phone: '98765 43210',
  password: '',
  mode: 'otp' as const,
  ...overrides,
});

describe('loginFormSchema', () => {
  it('needs no password in OTP mode', () => {
    expect(loginFormSchema.safeParse(values()).success).toBe(true);
  });

  it('requires a password in password mode', () => {
    expect(loginFormSchema.safeParse(values({ mode: 'password' })).success).toBe(false);
    expect(loginFormSchema.safeParse(values({ mode: 'password', password: 'x' })).success).toBe(true);
  });

  it('rejects a number the API would refuse', () => {
    const result = loginFormSchema.safeParse(values({ phone: '12345' }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['phone']);
  });
});

describe('isCompleteOtpCode', () => {
  const code = '1'.repeat(Config.otpLength);

  it('accepts exactly the configured number of digits', () => {
    expect(isCompleteOtpCode(code)).toBe(true);
    expect(isCompleteOtpCode(code.slice(1))).toBe(false);
    expect(isCompleteOtpCode(`${code}1`)).toBe(false);
    expect(isCompleteOtpCode(`${code.slice(1)}a`)).toBe(false);
  });
});

describe('authFieldErrors', () => {
  it('maps API field names onto the form fields, first message only', () => {
    const error: ApiError = {
      code: 'VALIDATION',
      status: 422,
      message: 'The given data was invalid.',
      errors: { phone: ['That number is not registered.', 'Second.'], otp: ['Expired code.'] },
    };

    expect(authFieldErrors(error)).toEqual({
      phone: 'That number is not registered.',
      code: 'Expired code.',
    });
  });
});

describe('authErrorMessage', () => {
  it('replaces a generic validation message with login copy', () => {
    const error: ApiError = { code: 'VALIDATION', status: 422, message: 'The given data was invalid.' };
    expect(authErrorMessage(error, 'verifyOtp')).toMatch(/incorrect or has expired/i);
  });

  it('keeps a specific server message', () => {
    const error: ApiError = { code: 'VALIDATION', status: 422, message: 'This code was already used.' };
    expect(authErrorMessage(error, 'verifyOtp')).toBe('This code was already used.');
  });

  it('replaces the network layer default for 401 with login copy', () => {
    const error: ApiError = { code: 'UNAUTHORIZED', status: 401, message: 'You need to sign in to continue.' };
    expect(authErrorMessage(error, 'password')).toMatch(/cannot sign in right now/i);
  });

  it('states the wait for a rate limit', () => {
    const error: ApiError = {
      code: 'RATE_LIMITED',
      status: 429,
      message: 'Too many attempts.',
      retryAfterSeconds: 42,
    };
    expect(authErrorMessage(error, 'requestOtp')).toBe('Too many attempts. Try again in 42 seconds.');
  });

  it('passes offline errors through untouched', () => {
    const error: ApiError = { code: 'OFFLINE', message: 'You are offline.', isOffline: true };
    expect(authErrorMessage(error, 'requestOtp')).toBe('You are offline.');
  });
});
