/**
 * @jest-environment node
 *
 * Exercises network.ts against a real local HTTP server (axios' node adapter):
 * token attachment, single-flight rotating refresh, retry-once, session expiry
 * and transient refresh failures.
 */
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

type Handler = (req: IncomingMessage, body: string, res: ServerResponse) => void;

const mockSecureStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDevice',
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void mockSecureStore.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void mockSecureStore.delete(key)),
}));

let mockBaseUrl = '';
jest.mock('@/constants/config', () => ({
  get Config() {
    return {
      apiBaseUrl: `${mockBaseUrl}/api/v1`,
      apiOrigin: mockBaseUrl,
      requestTimeoutMs: 2000,
      uploadTimeoutMs: 2000,
      enableNetworkLogging: false,
    };
  },
}));

let server: http.Server;
let handler: Handler;
const hits: { method: string; path: string; auth?: string; body: string }[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      hits.push({ method: req.method ?? '', path: req.url ?? '', auth: req.headers.authorization, body });
      handler(req, body, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  mockBaseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const json = (res: ServerResponse, status: number, payload: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const ok = (res: ServerResponse, data: unknown) => json(res, 200, { status: true, message: 'OK', data });

/** Fresh module graph per test so the in-memory token cache starts empty. */
function load() {
  let mod!: {
    network: typeof import('../network').network;
    tokenStorage: typeof import('@/services/storage/tokenStorage').tokenStorage;
    sessionEvents: typeof import('@/services/session/sessionEvents').sessionEvents;
    api: typeof import('../apis');
  };
  jest.isolateModules(() => {
    mod = {
      network: require('../network').network,
      tokenStorage: require('@/services/storage/tokenStorage').tokenStorage,
      sessionEvents: require('@/services/session/sessionEvents').sessionEvents,
      api: require('../apis'),
    };
  });
  return mod;
}

beforeEach(() => {
  hits.length = 0;
  mockSecureStore.clear();
});

describe('network.ts', () => {
  it('does not attach a token to public login calls', async () => {
    const { tokenStorage, api } = load();
    await tokenStorage.save('stale-access', 'stale-refresh', 3600);
    handler = (_req, _body, res) => ok(res, { test_account: false, notice: null });

    const { data } = await api.requestOtp({ phone: '+919999999999', purpose: 'login' });

    expect(data).toEqual({ test_account: false, notice: null });
    expect(hits[0].path).toBe('/api/v1/auth/otp/request');
    expect(hits[0].auth).toBeUndefined();
  });

  it('attaches the bearer token and unwraps the envelope with meta', async () => {
    const { tokenStorage, api } = load();
    await tokenStorage.save('access-1', 'refresh-1', 3600);
    handler = (_req, _body, res) =>
      json(res, 200, { status: true, message: 'OK', data: [{ id: 1 }], meta: { current_page: 1, per_page: 20, total: 1, last_page: 1 } });

    const response = await api.getConversations({ page: 1, per_page: 20 });

    expect(hits[0].auth).toBe('Bearer access-1');
    expect(hits[0].path).toBe('/api/v1/conversations?page=1&per_page=20');
    expect(response.data).toEqual([{ id: 1 }]);
    expect(response.meta?.total).toBe(1);
  });

  it('refreshes once for concurrent 401s, rotates both tokens and retries each request once', async () => {
    const { tokenStorage, api } = load();
    await tokenStorage.save('old-access', 'old-refresh', 3600);

    handler = (req, body, res) => {
      if (req.url === '/api/v1/auth/refresh') {
        expect(JSON.parse(body)).toEqual({ refresh_token: 'old-refresh' });
        setTimeout(
          () => ok(res, { access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'bearer', expires_in: 3600, user: { id: 7, name: 'A' } }),
          50,
        );
        return;
      }
      if (req.headers.authorization === 'Bearer new-access') return ok(res, { path: req.url });
      json(res, 401, { status: false, message: 'Unauthenticated.' });
    };

    const results = await Promise.all([api.getBootstrap(), api.getDashboardOverview(), api.getConversations()]);

    expect(results).toHaveLength(3);
    expect(hits.filter((h) => h.path === '/api/v1/auth/refresh')).toHaveLength(1);
    expect(tokenStorage.get()).toMatchObject({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    expect(mockSecureStore.get('wazigo.session.refresh_token')).toBe('new-refresh');
    // 3 original + 1 refresh + 3 retries
    expect(hits).toHaveLength(7);
  });

  it('refreshes proactively when the stored access token has expired', async () => {
    const { tokenStorage, api } = load();
    await tokenStorage.save('expired-access', 'refresh-1', 1);
    await new Promise((r) => setTimeout(r, 5));
    // expires_in=1s is inside the 30s skew window, so no 401 round-trip is needed.
    handler = (req, _body, res) => {
      if (req.url === '/api/v1/auth/refresh') {
        return ok(res, { access_token: 'fresh', refresh_token: 'refresh-2', token_type: 'bearer', expires_in: 3600, user: { id: 1, name: 'A' } });
      }
      return ok(res, null);
    };

    await api.sendPresenceHeartbeat();

    expect(hits.map((h) => h.path)).toEqual(['/api/v1/auth/refresh', '/api/v1/me/presence/heartbeat']);
    expect(hits[1].auth).toBe('Bearer fresh');
  });

  it('expires the session once when refresh is rejected, without looping', async () => {
    const { tokenStorage, api, sessionEvents } = load();
    await tokenStorage.save('old-access', 'revoked-refresh', 3600);
    const expired = jest.fn();
    sessionEvents.on('expired', expired);

    handler = (_req, _body, res) => json(res, 401, { status: false, message: 'Unauthenticated.' });

    const outcomes = await Promise.allSettled([api.getBootstrap(), api.getConversations()]);

    outcomes.forEach((o) => {
      expect(o.status).toBe('rejected');
      expect((o as PromiseRejectedResult).reason).toMatchObject({ code: 'SESSION_EXPIRED' });
    });
    expect(expired).toHaveBeenCalledTimes(1);
    expect(hits.filter((h) => h.path === '/api/v1/auth/refresh')).toHaveLength(1);
    expect(hits).toHaveLength(3);
    expect(tokenStorage.get()).toBeNull();
    expect(mockSecureStore.size).toBe(0);
  });

  it('keeps the session when refresh fails with a server error', async () => {
    const { tokenStorage, api, sessionEvents } = load();
    await tokenStorage.save('old-access', 'refresh-1', 3600);
    const expired = jest.fn();
    sessionEvents.on('expired', expired);

    handler = (req, _body, res) =>
      req.url === '/api/v1/auth/refresh' ? json(res, 503, { status: false, message: 'down' }) : json(res, 401, {});

    await expect(api.getBootstrap()).rejects.toMatchObject({ code: 'SERVER_ERROR' });
    expect(expired).not.toHaveBeenCalled();
    expect(tokenStorage.get()).toMatchObject({ refreshToken: 'refresh-1' });
  });

  it('keeps the session when the connection drops during a refresh', async () => {
    const { tokenStorage, api, sessionEvents } = load();
    await tokenStorage.save('old-access', 'refresh-1', 3600);
    const expired = jest.fn();
    sessionEvents.on('expired', expired);

    // No response at all - the same shape as a dropped mobile connection.
    handler = (req, _body, res) =>
      req.url === '/api/v1/auth/refresh' ? res.destroy() : json(res, 401, {});

    await expect(api.getBootstrap()).rejects.toMatchObject({ isNetworkError: true });
    expect(expired).not.toHaveBeenCalled();
    expect(tokenStorage.get()).toMatchObject({ refreshToken: 'refresh-1' });
  });

  it('normalizes 422 validation and 429 rate-limit errors', async () => {
    const { api } = load();
    handler = (req, _body, res) => {
      if (req.url === '/api/v1/auth/login') {
        return json(res, 422, { status: false, message: 'The code is invalid.', errors: { code: ['The code is invalid.'] } });
      }
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '42' });
      res.end(JSON.stringify({ status: false, message: 'Too Many Attempts.' }));
    };

    await expect(api.loginWithOtp({ phone: '+919999999999', code: '00000' })).rejects.toEqual({
      code: 'VALIDATION',
      status: 422,
      message: 'The code is invalid.',
      errors: { code: ['The code is invalid.'] },
      retryAfterSeconds: undefined,
    });
    await expect(api.requestOtp({ phone: '+919999999999', purpose: 'login' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 42,
    });
  });

  it('announces a suspended workspace once, for a signed-in call and for sign-in alike', async () => {
    const { tokenStorage, api, sessionEvents } = load();
    await tokenStorage.save('access', 'refresh', 3600);
    const blocked = jest.fn();
    sessionEvents.on('workspaceUnavailable', blocked);

    handler = (_req, _body, res) =>
      json(res, 403, {
        status: false,
        message: 'Forbidden.',
        data: {
          code: 'workspace_unavailable',
          workspace_status: 'suspended',
          reason: 'Payment for August has not reached us.',
          support: { email: 'support@wazigo.io', chat_url: 'https://wa.me/919999999999?text=Hi' },
        },
      });

    await expect(api.getConversations()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      workspace: {
        workspace_status: 'suspended',
        reason: 'Payment for August has not reached us.',
        support: { email: 'support@wazigo.io', chat_url: 'https://wa.me/919999999999?text=Hi' },
      },
    });
    // Sign-in is a public call, and it has to report the closure just the same.
    await expect(api.loginWithOtp({ phone: '+919999999999', code: '123456' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    expect(blocked).toHaveBeenCalledTimes(2);
    expect(blocked.mock.calls[0][0].workspace_status).toBe('suspended');
    // A 403 is never retried, so the two calls are the only two requests made.
    expect(hits).toHaveLength(2);
  });

  it('leaves an ordinary 403 as a plain permission refusal', async () => {
    const { tokenStorage, api, sessionEvents } = load();
    await tokenStorage.save('access', 'refresh', 3600);
    const blocked = jest.fn();
    sessionEvents.on('workspaceUnavailable', blocked);

    handler = (_req, _body, res) => json(res, 403, { status: false, message: 'This action is unauthorized.' });

    await expect(api.getConversations()).rejects.toMatchObject({ code: 'FORBIDDEN', workspace: undefined });
    expect(blocked).not.toHaveBeenCalled();
  });

  it('does not retry 403 and short-circuits requests while offline', async () => {
    const { tokenStorage, api, network } = load();
    await tokenStorage.save('access', 'refresh', 3600);
    handler = (_req, _body, res) => json(res, 403, { status: false, message: 'This action is unauthorized.' });

    await expect(api.getConversationMessages(99)).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(hits).toHaveLength(1);

    network.setOnline(false);
    await expect(api.getConversations()).rejects.toMatchObject({ code: 'OFFLINE', isOffline: true });
    expect(hits).toHaveLength(1);
  });

  /**
   * Writes are not gated - they go straight out. What remains is the trace, so
   * an unexplained production send can still be tied to the tap that caused it.
   */
  it('traces every write with a timestamp and the stack it came from', async () => {
    const { tokenStorage, api } = load();
    await tokenStorage.save('access-1', 'refresh-1', 3600);
    handler = (_req, _body, res) => ok(res, {});
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(api.sendTextMessage(3, { text: 'hi' })).resolves.toMatchObject({ httpStatus: 200 });
    expect(hits.map((hit) => `${hit.method} ${hit.path}`)).toEqual(['POST /api/v1/conversations/3/messages']);

    const traced = log.mock.calls.map((call) => String(call[0]));
    expect(traced.some((line) => /^\[api:write\] \S+Z POST \/conversations\/3\/messages$/.test(line))).toBe(true);
    expect(traced.some((line) => line.startsWith('[api:write] issued from:'))).toBe(true);
    log.mockRestore();
  });

  it('refreshes an almost-expired session before the read that needed it', async () => {
    const { tokenStorage, api } = load();
    // expires_in=1s is inside the 30s skew window, so the read refreshes first.
    await tokenStorage.save('expired-access', 'refresh-1', 1);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    handler = (req, _body, res) =>
      req.url === '/api/v1/auth/refresh'
        ? ok(res, { access_token: 'access-2', refresh_token: 'refresh-2', token_type: 'bearer', expires_in: 3600 })
        : ok(res, { permissions: [] });

    await expect(api.getBootstrap()).resolves.toMatchObject({ httpStatus: 200 });
    expect(hits.map((hit) => `${hit.method} ${hit.path}`)).toEqual([
      'POST /api/v1/auth/refresh',
      'GET /api/v1/me/bootstrap',
    ]);
    jest.mocked(console.log).mockRestore();
  });

  it('authorizes socket channels outside the response envelope', async () => {
    const { tokenStorage, api } = load();
    await tokenStorage.save('access-1', 'refresh-1', 3600);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    // Pusher auth is not wrapped in the envelope.
    handler = (_req, _body, res) => json(res, 200, { auth: 'key:signature' });

    await expect(api.authorizeBroadcastChannel({ socket_id: '1.2', channel_name: 'private-App.Models.User.5' })).resolves.toMatchObject({
      data: { auth: 'key:signature' },
    });

    expect(hits.map((hit) => `${hit.method} ${hit.path}`)).toEqual(['POST /api/v1/broadcasting/auth']);
    expect(hits[0].auth).toBe('Bearer access-1');
    jest.mocked(console.log).mockRestore();
  });

  it('sends the push token in the body of DELETE /me/devices', async () => {
    const { tokenStorage, api } = load();
    await tokenStorage.save('access-1', 'refresh-1', 3600);
    handler = (_req, _body, res) => ok(res, null);

    await api.unregisterPushDevice({ token: 'ExponentPushToken[abc]' });

    expect(hits).toHaveLength(1);
    expect(`${hits[0].method} ${hits[0].path}`).toBe('DELETE /api/v1/me/devices');
    expect(JSON.parse(hits[0].body)).toEqual({ token: 'ExponentPushToken[abc]' });
  });

  it('never hands credentials to a non-Wazigo host and resolves relative media paths', async () => {
    const { tokenStorage, network } = load();
    await tokenStorage.save('access', 'refresh', 3600);

    await expect(network.authorizedRequest('https://lookaside.fbsbx.com/whatsapp/media')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(network.authorizedRequest('/conversations/1/messages/2/media')).resolves.toEqual({
      url: `${mockBaseUrl}/api/v1/conversations/1/messages/2/media`,
      headers: { Accept: '*/*', Authorization: 'Bearer access' },
    });
    expect(network.resolveApiUrl('/api/v1/conversations/1/messages/2/media')).toBe(
      `${mockBaseUrl}/api/v1/conversations/1/messages/2/media`,
    );
  });
});
