import type { ApiError } from '@/api/types';

import { errorStateFor, isOfflineError, StateCopy } from '../errorCopy';

const error = (fields: Partial<ApiError>): ApiError =>
  ({ code: 'UNKNOWN', message: 'Something failed.', ...fields }) as ApiError;

const FALLBACK = 'We could not load your dashboard';

describe('isOfflineError', () => {
  it('is only true for the device being offline', () => {
    expect(isOfflineError(error({ code: 'OFFLINE' }))).toBe(true);
    expect(isOfflineError(error({ code: 'NETWORK', isOffline: true }))).toBe(true);
    expect(isOfflineError(error({ code: 'NETWORK' }))).toBe(false);
    expect(isOfflineError(null)).toBe(false);
    expect(isOfflineError(undefined)).toBe(false);
  });
});

describe('errorStateFor', () => {
  it('says the same thing about being offline wherever it happens', () => {
    expect(errorStateFor(error({ code: 'OFFLINE', message: 'No connection.' }), FALLBACK)).toEqual({
      icon: 'cloud-offline-outline',
      tone: 'neutral',
      title: StateCopy.offlineTitle,
      description: StateCopy.offlineDescription,
    });
  });

  it('separates a timeout from a dropped connection', () => {
    expect(errorStateFor(error({ code: 'TIMEOUT', isTimeout: true }), FALLBACK)).toMatchObject({
      icon: 'time-outline',
      title: StateCopy.timeoutTitle,
    });
    expect(errorStateFor(error({ code: 'NETWORK', isNetworkError: true }), FALLBACK)).toMatchObject({
      icon: 'cloud-offline-outline',
      title: StateCopy.unreachableTitle,
    });
  });

  it('repeats the server Retry-After when there is one', () => {
    expect(errorStateFor(error({ code: 'RATE_LIMITED', retryAfterSeconds: 30 }), FALLBACK)).toMatchObject({
      title: StateCopy.rateLimitedTitle,
      description: 'Please wait 30 seconds and try again.',
    });
    expect(errorStateFor(error({ code: 'RATE_LIMITED', retryAfterSeconds: 1 }), FALLBACK).description).toBe(
      'Please wait 1 second and try again.',
    );
    expect(errorStateFor(error({ code: 'RATE_LIMITED' }), FALLBACK).description).toBe(
      StateCopy.rateLimitedDescription,
    );
  });

  it('prefers the server message for a refusal, and has copy when there is none', () => {
    expect(
      errorStateFor(error({ code: 'FORBIDDEN', message: 'Your account cannot see this number.' }), FALLBACK),
    ).toEqual({
      icon: 'lock-closed-outline',
      tone: 'neutral',
      title: StateCopy.forbiddenTitle,
      description: 'Your account cannot see this number.',
    });
    expect(errorStateFor(error({ code: 'FORBIDDEN', message: '' }), FALLBACK).description).toBe(
      StateCopy.forbiddenDescription,
    );
  });

  it('never shows the raw 5xx text, only the screen title and what to do', () => {
    expect(
      errorStateFor(error({ code: 'SERVER_ERROR', status: 500, message: 'SQLSTATE[HY000]' }), FALLBACK),
    ).toEqual({
      icon: 'alert-circle-outline',
      tone: 'error',
      title: FALLBACK,
      description: StateCopy.serverDescription,
    });
  });

  it('falls back to the screen title and the error message for anything else', () => {
    expect(errorStateFor(error({ code: 'UNKNOWN', message: 'That did not work.' }), FALLBACK)).toEqual({
      icon: 'alert-circle-outline',
      tone: 'error',
      title: FALLBACK,
      description: 'That did not work.',
    });
  });

  it('still reads as a failure when there is no error object at all', () => {
    expect(errorStateFor(null, FALLBACK)).toEqual({
      icon: 'alert-circle-outline',
      tone: 'error',
      title: FALLBACK,
      description: StateCopy.genericDescription,
    });
  });
});
