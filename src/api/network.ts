/**
 * The ONLY module allowed to import axios.
 *
 * Responsibilities: base URL + headers, bearer attachment for authenticated
 * calls, proactive + 401-driven refresh with a single-flight lock and rotating
 * refresh tokens, one retry per request, offline short-circuit, timeout,
 * error normalization, envelope unwrapping, multipart upload and safe
 * development logging.
 */
import {
  create,
  isAxiosError,
  isCancel,
  type AxiosInstance,
  type AxiosProgressEvent,
  type AxiosRequestConfig,
  type AxiosResponse,
  type Method,
} from 'axios';

import { Config } from '@/constants/config';
import { sessionEvents } from '@/services/session/sessionEvents';
import { tokenStorage } from '@/services/storage/tokenStorage';

import { PUBLIC_PATHS, REFRESH_PATH } from './endpoints';
import type { ApiEnvelope, ApiError, ApiErrorCode, ApiResponse, SessionPayload, UploadFile } from './types';

// ---------------------------------------------------------------------------
// Axios config extensions (internal)
// ---------------------------------------------------------------------------

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Attach the bearer token. Defaults to true except for PUBLIC_PATHS. */
    requiresAuth?: boolean;
    /** Do not attempt refresh on 401 (e.g. logout). */
    skipAuthRefresh?: boolean;
    _isRefresh?: boolean;
    _retried?: boolean;
    _tokenUsed?: string;
    _startedAt?: number;
  }
}

export type RequestOptions = {
  params?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
  skipAuthRefresh?: boolean;
  /** Unwrap the `{status, message, data, meta}` envelope (default true). */
  envelope?: boolean;
  timeout?: number;
  signal?: AbortSignal;
};

export type UploadOptions = RequestOptions & {
  onProgress?: (fraction: number) => void;
};

export type UploadBody = {
  file: UploadFile;
  /** Extra multipart fields such as `type` and `caption`. Empty values are skipped. */
  fields?: Record<string, string | number | boolean | undefined | null>;
  /** Multipart field name for the file (default `file`). */
  fileField?: string;
};

// ---------------------------------------------------------------------------
// Constants & state
// ---------------------------------------------------------------------------

/** Refresh slightly before the server-side expiry to avoid avoidable 401s. */
const EXPIRY_SKEW_MS = 30_000;

const ERROR_CODES = new Set<ApiErrorCode>([
  'UNAUTHORIZED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION',
  'RATE_LIMITED',
  'SERVER_ERROR',
  'TIMEOUT',
  'OFFLINE',
  'NETWORK',
  'CANCELLED',
  'UNKNOWN',
]);

/** null = unknown (treat as online). Updated by the connectivity service. */
let isOnline: boolean | null = null;

/** Single-flight refresh lock shared by every caller. */
let refreshInFlight: Promise<string> | null = null;

const client: AxiosInstance = create({
  baseURL: Config.apiBaseUrl,
  timeout: Config.requestTimeoutMs,
  headers: { Accept: 'application/json' },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url);

const stripQuery = (url = '') => url.split('?')[0];

const isPublicPath = (url?: string) => !!url && PUBLIC_PATHS.includes(stripQuery(url));

/** Absolute URLs only receive credentials when they point at the Wazigo API origin. */
const isApiOrigin = (url?: string) => !url || !isAbsoluteUrl(url) || url.startsWith(`${Config.apiOrigin}/`);

const needsAuth = (config: AxiosRequestConfig) => config.requiresAuth ?? !isPublicPath(config.url);

const isExpiringSoon = (expiresAt: number | null) => expiresAt != null && Date.now() >= expiresAt - EXPIRY_SKEW_MS;

const makeError = (code: ApiErrorCode, message: string, extra: Partial<ApiError> = {}): ApiError => ({
  code,
  message,
  ...extra,
});

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof Error) &&
    typeof (value as ApiError).message === 'string' &&
    ERROR_CODES.has((value as ApiError).code)
  );
}

/** Copy used when the server sends none - screens can detect an unhelpful default. */
export const DEFAULT_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: 'You need to sign in to continue.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  FORBIDDEN: "You don't have permission to access this resource.",
  NOT_FOUND: 'This item is no longer available.',
  CONFLICT: 'This conversation was updated by someone else.',
  VALIDATION: 'Please check the details and try again.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  SERVER_ERROR: 'Wazigo is having trouble right now. Please try again shortly.',
  TIMEOUT: 'The request took too long. Please try again.',
  OFFLINE: "You're offline. Check your internet connection and try again.",
  NETWORK: 'Unable to reach Wazigo. Check your connection and try again.',
  CANCELLED: 'Request cancelled.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

const codeForStatus = (status: number): ApiErrorCode => {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 422) return 'VALIDATION';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN';
};

const parseRetryAfter = (value: unknown): number | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const date = Date.parse(String(value));
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000));
};

/** Converts anything thrown by axios (or this module) into an ApiError. */
export function normalizeError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  if (isCancel(error)) return makeError('CANCELLED', DEFAULT_ERROR_MESSAGES.CANCELLED);

  if (isAxiosError(error)) {
    const response = error.response;

    if (!response) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return makeError('TIMEOUT', DEFAULT_ERROR_MESSAGES.TIMEOUT, { isTimeout: true, isNetworkError: true });
      }
      const offline = isOnline === false;
      return makeError(offline ? 'OFFLINE' : 'NETWORK', DEFAULT_ERROR_MESSAGES[offline ? 'OFFLINE' : 'NETWORK'], {
        isNetworkError: true,
        isOffline: offline,
      });
    }

    const status = response.status;
    const code = codeForStatus(status);
    const body = (typeof response.data === 'object' && response.data !== null ? response.data : {}) as {
      message?: unknown;
      errors?: unknown;
    };
    const serverMessage = typeof body.message === 'string' && body.message.trim() ? body.message.trim() : undefined;
    const errors =
      body.errors && typeof body.errors === 'object' ? (body.errors as Record<string, string[]>) : undefined;

    return makeError(code, code === 'SERVER_ERROR' ? DEFAULT_ERROR_MESSAGES.SERVER_ERROR : serverMessage ?? DEFAULT_ERROR_MESSAGES[code], {
      status,
      errors,
      retryAfterSeconds: status === 429 ? parseRetryAfter(response.headers?.['retry-after']) : undefined,
    });
  }

  return makeError('UNKNOWN', DEFAULT_ERROR_MESSAGES.UNKNOWN);
}

const log = (config: AxiosRequestConfig | undefined, outcome: number | string) => {
  if (!Config.enableNetworkLogging || !config) return;
  const duration = config._startedAt ? ` ${Date.now() - config._startedAt}ms` : '';
  // Path only: query strings can contain search terms (customer names / phones).
  console.log(`[api] ${(config.method ?? 'get').toUpperCase()} ${stripQuery(config.url)} → ${outcome}${duration}`);
};

// ---------------------------------------------------------------------------
// Session refresh
// ---------------------------------------------------------------------------

async function expireSession(reason: 'refresh_failed' | 'no_refresh_token'): Promise<ApiError> {
  await tokenStorage.clear().catch(() => undefined);
  sessionEvents.emit('expired', { reason });
  return makeError('SESSION_EXPIRED', DEFAULT_ERROR_MESSAGES.SESSION_EXPIRED, { status: 401 });
}

async function performRefresh(): Promise<string> {
  const tokens = await tokenStorage.load();
  if (!tokens?.refreshToken) throw await expireSession('no_refresh_token');

  let session: SessionPayload | undefined;
  try {
    const response = await client.post<ApiEnvelope<SessionPayload>>(
      REFRESH_PATH,
      { refresh_token: tokens.refreshToken },
      { requiresAuth: false, skipAuthRefresh: true, _isRefresh: true },
    );
    session = response.data?.data;
  } catch (error) {
    const apiError = normalizeError(error);
    // Transient failures keep the session; the caller sees a normal network error.
    const transient =
      apiError.isNetworkError || apiError.code === 'SERVER_ERROR' || apiError.code === 'RATE_LIMITED';
    if (transient) throw apiError;
    throw await expireSession('refresh_failed');
  }

  if (!session?.access_token || !session.refresh_token) throw await expireSession('refresh_failed');

  // AUTH-04 revokes the old refresh token: replace both together.
  await tokenStorage.save(session.access_token, session.refresh_token, session.expires_in);
  sessionEvents.emit('refreshed', { user: session.user });
  return session.access_token;
}

/** Returns a fresh access token, sharing one in-flight refresh across callers. */
function refreshSession(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** Current access token, refreshed first when it is about to expire. */
async function getValidAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const tokens = await tokenStorage.load();
  if (!tokens) return null;
  if (isExpiringSoon(tokens.accessExpiresAt)) {
    try {
      return await refreshSession();
    } catch (error) {
      if (isApiError(error) && error.code === 'SESSION_EXPIRED') throw error;
      // Transient refresh failure: try the existing token; a 401 retries refresh once.
      return tokens.accessToken;
    }
  }
  return tokens.accessToken;
}

// ---------------------------------------------------------------------------
// Interceptors
// ---------------------------------------------------------------------------

client.interceptors.request.use(async (config) => {
  config._startedAt = Date.now();

  if (isOnline === false) {
    throw makeError('OFFLINE', DEFAULT_ERROR_MESSAGES.OFFLINE, { isOffline: true, isNetworkError: true });
  }

  const isForm = typeof FormData !== 'undefined' && config.data instanceof FormData;
  if (!isForm && config.data !== undefined && !config.headers.has('Content-Type')) {
    config.headers.set('Content-Type', 'application/json');
  }

  if (!needsAuth(config) || config._isRefresh || !isApiOrigin(config.url)) {
    config.headers.delete('Authorization');
    return config;
  }

  const token = await getValidAccessToken();
  if (!token) {
    throw makeError('UNAUTHORIZED', DEFAULT_ERROR_MESSAGES.UNAUTHORIZED, { status: 401 });
  }
  config.headers.set('Authorization', `Bearer ${token}`);
  config._tokenUsed = token;
  return config;
});

client.interceptors.response.use(
  (response) => {
    log(response.config, response.status);
    return response;
  },
  async (error: unknown) => {
    if (isApiError(error)) return Promise.reject(error);
    if (!isAxiosError(error)) return Promise.reject(normalizeError(error));

    const config = error.config;
    const status = error.response?.status;
    log(config, status ?? error.code ?? 'ERR');

    const canRefresh =
      status === 401 && !!config && needsAuth(config) && !config._isRefresh && !config.skipAuthRefresh && !config._retried;

    if (!canRefresh || !config) return Promise.reject(normalizeError(error));

    config._retried = true;
    try {
      // If another request already rotated the pair, reuse it instead of refreshing again
      // (a second refresh would send an already-revoked refresh token).
      const current = tokenStorage.get();
      const token =
        current && config._tokenUsed && current.accessToken !== config._tokenUsed
          ? current.accessToken
          : await refreshSession();
      config.headers.set('Authorization', `Bearer ${token}`);
      return await client.request(config);
    } catch (retryError) {
      return Promise.reject(normalizeError(retryError));
    }
  },
);

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

function unwrap<T, M>(response: AxiosResponse, envelope: boolean): ApiResponse<T, M> {
  const body = response.data;
  if (envelope && body && typeof body === 'object' && 'data' in body) {
    const env = body as ApiEnvelope<T, M>;
    if (env.status === false) {
      throw makeError('UNKNOWN', env.message || DEFAULT_ERROR_MESSAGES.UNKNOWN, { status: response.status });
    }
    return { data: env.data, message: env.message, meta: env.meta, httpStatus: response.status };
  }
  return { data: body as T, httpStatus: response.status };
}

async function send<T, M>(
  method: Method,
  url: string,
  data: unknown,
  { envelope = true, ...options }: RequestOptions & { onUploadProgress?: (e: AxiosProgressEvent) => void } = {},
): Promise<ApiResponse<T, M>> {
  try {
    const response = await client.request({ method, url, data, ...options });
    return unwrap<T, M>(response, envelope);
  } catch (error) {
    throw normalizeError(error);
  }
}

/** Turns a relative API path (e.g. `media.url`) into an absolute Wazigo URL. */
function resolveApiUrl(pathOrUrl: string): string {
  if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  // Paths that already include /api/vN are origin-relative.
  return /^\/api\/v\d+\//.test(path) ? `${Config.apiOrigin}${path}` : `${Config.apiBaseUrl}${path}`;
}

export const network = {
  get: <T, M = undefined>(url: string, options?: RequestOptions) => send<T, M>('get', url, undefined, options),

  post: <T, M = undefined>(url: string, body?: unknown, options?: RequestOptions) =>
    send<T, M>('post', url, body, options),

  put: <T, M = undefined>(url: string, body?: unknown, options?: RequestOptions) =>
    send<T, M>('put', url, body, options),

  patch: <T, M = undefined>(url: string, body?: unknown, options?: RequestOptions) =>
    send<T, M>('patch', url, body, options),

  delete: <T, M = undefined>(url: string, options?: RequestOptions) => send<T, M>('delete', url, undefined, options),

  /** multipart/form-data. The boundary is generated by React Native — never set it manually. */
  upload: <T, M = undefined>(url: string, { file, fields, fileField = 'file' }: UploadBody, options: UploadOptions = {}) => {
    const form = new FormData();
    Object.entries(fields ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
    });
    // React Native's FormData accepts a {uri, name, type} descriptor for files.
    form.append(fileField, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);

    const { onProgress, ...rest } = options;
    return send<T, M>('post', url, form, {
      timeout: Config.uploadTimeoutMs,
      ...rest,
      onUploadProgress: onProgress
        ? (event) => {
            if (event.total) onProgress(Math.min(1, event.loaded / event.total));
          }
        : undefined,
    });
  },

  /**
   * URL + headers for authenticated requests that cannot use axios
   * (binary media download via the file system, socket channel auth).
   * Refuses to hand credentials to non-Wazigo hosts.
   */
  async authorizedRequest(pathOrUrl: string): Promise<{ url: string; headers: Record<string, string> }> {
    const url = resolveApiUrl(pathOrUrl);
    if (!isApiOrigin(url)) {
      throw makeError('FORBIDDEN', 'Refusing to send credentials to an external host.');
    }
    const token = await getValidAccessToken();
    if (!token) throw makeError('UNAUTHORIZED', DEFAULT_ERROR_MESSAGES.UNAUTHORIZED, { status: 401 });
    return { url, headers: { Accept: '*/*', Authorization: `Bearer ${token}` } };
  },

  resolveApiUrl,

  /** Forces one shared refresh (e.g. after a 401 on a non-axios download). */
  refreshSession,

  /** Called by the connectivity service. */
  setOnline(value: boolean | null) {
    isOnline = value;
  },

  normalizeError,
  isApiError,
};

export type Network = typeof network;
