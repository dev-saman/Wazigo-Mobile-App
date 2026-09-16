# Wazigo Mobile App

The iOS and Android app for Wazigo business messaging: an agent signs in, sees their own
dashboard, and works their own WhatsApp conversations. Expo SDK 57, React Native 0.86,
TypeScript (strict), Expo Router and Redux Toolkit, on top of the Wazigo Laravel API.

**Phase 1 is Login, My Dashboard and My Chats**, plus the screens those need. Registration,
password reset, billing, campaigns and any team/contact/template/chatbot management stay on the
web dashboard.

## Status

Every screen in phase 1 is built and the checks below pass. Two things are worth knowing before
you judge anything by that:

- **Nothing has run on a device or an emulator, and no call has reached the real backend.** All
  API behaviour was verified against a local mock server and unit tests.
- **Six backend blockers are still open**, and four of them are what stand between "my chats" and
  "nearly my chats". They are written up for the server team in
  [docs/backend-blockers.md](docs/backend-blockers.md). Filtering on the device is never the fix.

## Quick start

```bash
npm install
cp .env.example .env
npm start
```

Then press `a` for Android or `i` for iOS (macOS). Without a `.env` the app talks to the
production API.

| Script | What it does |
| --- | --- |
| `npm start` | Expo dev server (`-c` clears the cache) |
| `npm run android` | Start and open on Android |
| `npm run ios` | Start and open on iOS (macOS / Expo Go) |
| `npm run lint` | ESLint (`eslint-config-expo`) plus this project's import guards |
| `npm run typecheck` | TypeScript for the app and for the tests |
| `npm test` | Jest — 182 tests |
| `npm run doctor` | Expo Doctor |

## Environment

Only `EXPO_PUBLIC_*` values are read, and they are **inlined into the app bundle**: anyone with the
binary can read them. Never put an API secret, the Reverb secret or WhatsApp credentials here.

| Variable | Default | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | `https://app.wazigo.io/api/v1` | API root. The origin without `/api/v1` is derived from it for media and broadcast auth |
| `EXPO_PUBLIC_OTP_LENGTH` | `5` | Login code length. Must match the backend's OTP setting (no endpoint exposes it) |
| `EXPO_PUBLIC_REVERB_APP_KEY` | *(empty)* | Public Reverb key. **Unused today** — the socket is not connected (see below) |
| `EXPO_PUBLIC_REVERB_HOST` / `_PORT` / `_SCHEME` | `app.wazigo.io` / `443` / `https` | Reverb endpoint, for when it is |

## How it is put together

```
Screen  →  feature thunk / hook  →  src/api/apis.ts  →  src/api/network.ts  →  Laravel
```

Nothing skips a layer. Screens never see an axios error - they get a normalized `ApiError`.

```
src/
  app/          routes only (Expo Router). Every file here is a URL
  api/          network.ts (the only axios importer), apis.ts, endpoints.ts, types.ts
  components/   common/ (primitives), chat/, dashboard/, feedback/, forms/
  constants/    colours, typography, spacing, branding, config — the design tokens
  features/     auth, bootstrap, connectivity, conversations, dashboard, messages,
                presence, realtime, templates — slice + thunks + selectors per feature
  services/     media/ (picker, authenticated cache), session/, storage/
  store/        the Redux store, typed hooks, root reducer, session listeners
  utils/        pure helpers (phone, time, IST date formatting, device)
```

Rules the linter enforces, because each one has a reason:

| Rule | Why |
| --- | --- |
| `axios` only in `src/api/network.ts` | One place owns refresh, retries, offline and error shapes |
| `expo-secure-store` only in `tokenStorage.ts` | Credentials live in exactly one file |
| AsyncStorage only in `appStorage.ts` | It is for non-sensitive data only, under a `wazigo:` prefix |
| `expo-file-system` only in `mediaCache.ts` | Media is fetched with the bearer token, never as a public URL |

Two conventions that are easy to trip over:

- **Redux lives in `src/store/`, not `src/app/store.ts`** — anything under `src/app/` is a route.
- Import with the `@/*` alias (`@/features/...`), and take colours and fonts from
  `@/constants/theme`, never as raw hex or font names.

### Session

Tokens are kept in SecureStore, one key per token. The network layer refreshes them proactively,
holds a single-flight lock so concurrent 401s cause one refresh, and retries the original request
once. **A session only ends when a refresh is *rejected*** - a network error, timeout, 5xx or 429
keeps it. When it does end, SecureStore and private storage are cleared and the app shows the
Session Expired screen.

### Permissions

`GET /me/bootstrap` answers before any signed-in screen renders, so nothing is ever drawn or sent
without the server's own list of what the user may do. They are re-fetched quietly on app
foreground and on reconnect; a failed re-fetch keeps the permissions already in hand, while a 403
means access was taken away and is treated as such.

### Live updates

**There is no socket.** The app key, the `/broadcasting/auth` location, the `tenant_id` claim and
the event catalogue are all unknown, and blocker 5 means the one documented channel would deliver
other assignees' message content to a personal app. Instead every screen refreshes itself when the
app returns to the foreground and when the device reconnects - quietly, so a refresh nobody asked
for never blanks a thread - on top of pull-to-refresh. See
[docs/development-plan.md](docs/development-plan.md) for where the socket goes when those answers
arrive.

## Tests

`npm test` runs Jest with no device and no network of its own:

- `src/api/__tests__/network.test.ts` drives the real network layer against a **local HTTP
  server**: concurrent 401s causing one refresh, proactive refresh, expiry without looping,
  transient refresh failures keeping the session, 422/429/403, offline, and a refusal to send
  credentials to a foreign host.
- The feature tests cover what the API contract demands: CHAT-01 query building and paging,
  thread merging, optimistic sends and retries, the 24-hour reply window, template parameters,
  conversation actions, presence, and the offline/error copy every screen shares.

There are no rendering tests: React Native rendering is exactly the part that must be checked on a
real device, and a passing render test would only suggest otherwise.

## Documentation

| Document | What is in it |
| --- | --- |
| [docs/HANDOVER.md](docs/HANDOVER.md) | Read first. Status, what exists, decisions and their reasons, what is next |
| [docs/development-plan.md](docs/development-plan.md) | Endpoint map, stage-by-stage design notes, deviations from the design and why |
| [docs/backend-blockers.md](docs/backend-blockers.md) | For the server team: what must change, and how to verify each fix |
