# Wazigo Mobile App — Development Plan

Source of truth for API behaviour: **Wazigo Mobile App — API Reference** (Google Sheet,
sheets: Start here, Login, Chat, Dashboard, Live updates; last reviewed 2026-09-15).

## Platform baseline (Stage 1)

| Item | Version |
| --- | --- |
| Expo SDK | 57.0.22 (npm `latest`, stable) |
| React Native | 0.86.3 |
| React | 19.2.3 |
| Expo Router | 57.0.21 (routes in `src/app/`) |
| TypeScript | 6.0.3 (strict) |
| Node / npm | 22.20.0 / 11.5.1 |

## Structure decisions

- Redux slices so far: `auth`, `connectivity`. `bootstrap`, `dashboard`, `conversations`, `messages`,
  `templates` and `presence` are registered in `src/store/rootReducer.ts` in their own stages.
- **Routes live in `src/app/`** (Expo Router convention for SDK 57). Because every file in
  `src/app/` is treated as a route, the Redux store and typed hooks live in **`src/store/`**
  (`store.ts`, `hooks.ts`) instead of `src/app/`.
- Path alias `@/*` → `src/*`, `@/assets/*` → `assets/*`.
- Layering: Screen → feature thunk/hook → `src/api/apis.ts` → `src/api/network.ts` → Laravel.
  Axios is imported only in `src/api/network.ts`.
- Socket client isolated in `src/services/socket/`; the rest of the app depends on an
  app-level interface, not the Pusher/Reverb library.

## Network & session architecture (Stage 3)

```
Screen / component
   └─ Redux thunk / feature hook        src/features/*/…Thunks.ts
        └─ src/api/apis.ts              typed endpoint functions
             └─ src/api/network.ts      the only axios importer (lint-enforced)
                  └─ Laravel API
```

- **Tokens**: `src/services/storage/tokenStorage.ts` — SecureStore (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`),
  separate keys per token (iOS ~2 KB value limit), in-memory cache, refresh token written first.
- **Refresh**: single-flight lock; proactive when the access token is within 30 s of `expires_in`;
  on 401 the request is retried once. A request that failed with an already-rotated token reuses the
  new token instead of refreshing again (a second refresh would send a revoked refresh token).
- **Session expiry**: only when refresh is *rejected* (401/403/422…). Network errors, timeouts, 5xx
  and 429 keep the session. Expiry clears SecureStore → emits `sessionEvents.expired` → Redux
  listener clears private AsyncStorage + registered services (socket later) → `app/reset` →
  `auth.sessionExpired = true`.
- **Logout**: best-effort `POST /auth/logout` with `skipAuthRefresh`, then the same local cleanup.
- **Credentials never leave the Wazigo origin**: absolute URLs to other hosts get no bearer token;
  `network.authorizedRequest()` refuses them (media downloads, socket auth).
- **Offline**: requests short-circuit with `code: 'OFFLINE'` when NetInfo reports `isConnected === false`.
- **Errors**: always `ApiError {status, code, message, errors?, retryAfterSeconds?, isNetworkError?, isOffline?, isTimeout?}`.
  5xx never surfaces raw server text.
- **Logging (dev only)**: method, path without query string, status, duration. No headers or bodies.
- **Lint guards**: `axios` only in `network.ts`; `expo-secure-store` only in `tokenStorage.ts`;
  AsyncStorage only in `appStorage.ts`.
- **Tests**: `npm test` — network layer against a local HTTP server (concurrent 401 → one refresh,
  proactive refresh, expiry without loops, transient refresh failure, 422/429/403, offline, foreign
  host) and Redux session handling (sign-in persistence, logout cleanup, expiry reset).

## Design reference (received 2026-09-15)

The Wazigo mobile design sheet (14 screens + brand colours + Poppins scale) sets layout,
spacing, colours, typography, cards and chat appearance. Brand tokens taken from it:
Deep Green `#00603A`, Vivid Green `#08B74F`, Soft Mint `#D8F8DE`, Mint Green `#25D366`,
Deep Navy `#0F172A`.

Design elements **intentionally not implemented** because the API / phase-1 scope does not
support them:

| Design element | Screen | Reason |
| --- | --- | --- |
| Continue with Google | Login | Only phone + OTP / password login |
| Terms of Service / Privacy links | Login | No URLs supplied — add when provided |
| 6-digit OTP boxes | OTP | Backend default is 5 digits; length is configurable (`EXPO_PUBLIC_OTP_LENGTH`) |
| Templates / More tabs | Home, Chats | Mobile v1 tabs are Home + Chats only |
| Pending replies, response rate, customer rating cards | Home | Not in DASH-01; use total / open / unread / window_open |
| Recent conversations "See all" business list | Home | Dashboard must stay personal; chats live in the Chats tab |
| "Awaiting" filter chip | Chats | No matching CHAT-01 filter; using All / Open / Unread / Priority |
| Customer "Online" / last-seen | Conversation | No customer presence field in Conversation resource |
| Call button | Conversation | No calling API |
| Location, Contact attachments | Attachment sheet | CHAT-04 supports image / document / audio / video only |
| Star, Mute, Archive, Report, Block actions | Conversation actions | No endpoints; using resolve / reopen / priority / labels / bot take-over |
| Start a Conversation | Empty state | No outbound conversation creation in phase 1 |

## Endpoint map (verified against the workbook)

| ID | Method + path | Notes |
| --- | --- | --- |
| AUTH-01 | POST `/auth/otp/request` | `{phone, purpose:"login"}` → `{test_account, notice}`. 5-digit code default, 10 min validity, 60 s resend cooldown, 10/day, 5 req/min |
| AUTH-02 | POST `/auth/login` | `{phone, code, device_name?}` → `{access_token, refresh_token, token_type, expires_in, user}`. 422 invalid code, 401 unusable account |
| AUTH-03 | POST `/auth/login/password` | `{phone, password, device_name?}` → same session payload. 422 wrong details / no password |
| AUTH-04 | POST `/auth/refresh` | `{refresh_token}` → new pair; old refresh token revoked. 10 req/min |
| AUTH-05 | GET `/me/bootstrap` | `{user, roles, permissions, routes, menus, feature_flags, numbers, settings, billing}` — use user/roles/permissions/numbers only |
| AUTH-06 | POST `/auth/logout` | `{refresh_token}` → `null`, message "Logged out." |
| AUTH-07 | POST `/auth/otp/notice` | Optional review-account notice |
| AUTH-08 | GET `/auth/me` | Optional; no permissions — bootstrap is preferred |
| CHAT-01 | GET `/conversations` | `page, per_page, status=open\|resolved, search, unread=1, assigned=mine\|unassigned, label_id, priority, number_id` |
| CHAT-02 | GET `/conversations/{id}/messages` | `page, per_page`; newest-first; **thread details in `meta.conversation`** |
| CHAT-03 | POST `/conversations/{id}/messages` | `{type:"text", text}` max 4096 → 201 Message (`text_body`). 409 = assigned to someone else |
| CHAT-04 | POST `/conversations/{id}/messages` | multipart `type=image\|document\|audio\|video`, `file`, `caption` (≤1024). 50 MB ceiling |
| CHAT-05 | GET `/conversations/{id}/messages/{msg}/media` | **Binary stream, not JSON envelope**. `media.pending=true` → refetch later |
| CHAT-06 | POST `/conversations/{id}/read` | → Conversation |
| CHAT-07 | GET `/templates` | `approved_only=1, page, per_page, search, category` |
| CHAT-08 | POST `/conversations/{id}/template` | `{template_id, header_params[], body_params[]}` (≤20 each, strings ≤1024) |
| CHAT-09 | POST `/conversations/{id}/messages/{msg}/retry` | 200 may still be `status=failed` |
| CHAT-10 | POST `/conversations/{id}/resolve` | → Conversation |
| CHAT-11 | POST `/conversations/{id}/reopen` | Does not extend reply window |
| CHAT-12 | POST `/conversations/{id}/assign` | Reference only — **not built** |
| CHAT-13 | GET `/labels` | Optional label picker source |
| CHAT-14 | PUT `/conversations/{id}/labels` | `{label_ids:[]}` replaces full list; permission `conversations.tag` |
| CHAT-15 | PATCH `/conversations/{id}/priority` | `low\|normal\|high\|urgent`; permission `conversations.tag` |
| CHAT-16 | PATCH `/me/presence` | `online\|away\|offline` |
| CHAT-17 | POST `/me/presence/heartbeat` | Every 60 s while foregrounded + active |
| CHAT-18 | POST `/conversations/{id}/chatbot/stop` | "Take over" action inside a chat |
| CHAT-19 | GET `/users` | Reference only — **not built** |
| DASH-01 | GET `/crm/overview` | Use `totals.{total,open,unread,window_open}`, `by_priority[]`, `activity`, `delivery` only |
| LIVE-01 | POST `/broadcasting/auth` | Pusher auth response (no envelope) |

Envelope: `{status, message, data}`; paged lists add `meta {current_page, per_page, total, last_page}`.
Errors: `{status:false, message, errors?}`.

### Permissions referenced
`conversations.view`, `conversations.send`, `conversations.tag`, `templates.view`,
`templates.send`, `dashboard.view`, `users.view` (not used).

### Actions NOT in the API (will not be built)
- Mark conversation unread
- Start new conversation
- Location / contact attachments

## Open questions (need answers before the relevant stage)

1. **Broadcasting auth URL** — the Live updates sheet lists `POST /broadcasting/auth` but does not
   say whether it is under `/api/v1` (`https://app.wazigo.io/api/v1/broadcasting/auth`) or at
   the site root. Needed for Stage 13.
2. **Reverb public app key** — no mobile config endpoint exists; the key must be supplied via
   `EXPO_PUBLIC_REVERB_APP_KEY`. Needed for Stage 13.
3. **iOS bundle identifier / Android package name** — not set yet (store identities are
   permanent). Needed before the first native build.
4. ~~Mobile design reference~~ — received 2026-09-15 (see above).
5. **OTP length** — default is 5 digits but deployment-configurable, and no API returns the
   configured length. Built configurable: `Config.otpLength` (`EXPO_PUBLIC_OTP_LENGTH`, default 5,
   clamped 4-8). Confirm the deployed value during the first real login test.
6. **tenant_id** — only available as a JWT claim (needed for channel names).

## Backend blockers (from workbook — none confirmed fixed)

1. Personal chat list server-side scope (CHAT-01) — Agent currently gets own + unassigned.
2. Direct thread authorization (CHAT-02) — policy permits wider access.
3. Personal media authorization (CHAT-05).
4. Personal dashboard calculations (DASH-01) — counts all chats on accessible numbers;
   `totals.closed` uses `"closed"` while lifecycle uses `"resolved"`.
5. Personal Reverb event delivery — current channel `private-tenant.<tenant>.number.<number>`
   broadcasts other assignees' message content.
6. Reassignment must revoke previous assignee access immediately.

## Routing & screens (Stage 4)

```
src/app/
  _layout.tsx        Provider + fonts + connectivity; runs restoreSession(),
                     shows the brand splash while auth.status is "unknown",
                     then opens exactly one group through <Stack.Protected>
  (auth)/_layout.tsx anchor: login
    login.tsx        /login  - phone (+91) with OTP or password mode
    otp.tsx          /otp    - code entry, auto-submit, resend countdown
  (app)/_layout.tsx  signed-in area (placeholder home until Stages 5-6)
    index.tsx        /
```

- There is deliberately **no root `index.tsx`**: `(app)/index` already owns `/`, and the
  Stage 6 tabs will too. The splash renders from the root layout instead of a route.
- `Stack.Protected guard={...}` is the Expo Router 57 auth pattern; when a guard closes the
  router moves to the first screen still available, so no manual redirects are needed.
- Login state that must outlive a screen (the pending code's phone number and resend
  cooldown) lives in `auth.otpChallenge`, not in route params.
- Forms use react-hook-form + zod (`src/features/auth/validation.ts`); one schema covers both
  login modes so the resolver type stays stable when the user switches.
- `ApiError` is turned into copy by `src/features/auth/errors.ts` - 422 field errors land on the
  inputs, everything else becomes one banner. A tailored server message always wins; Laravel's
  generic "The given data was invalid." does not.
- Both screens disable submit while `connectivity.isConnected === false`.

## Bootstrap & permissions (Stage 5)

- `src/features/bootstrap/` — slice (`status: idle|loading|ready|failed|denied`, `permissions`,
  `roles`, `numbers`, `error`), `loadBootstrap` thunk (AUTH-05), selectors, `usePermission()`.
- **`BootstrapGate` wraps `(app)/_layout.tsx`.** No signed-in screen renders until AUTH-05 has
  answered, so nothing is drawn or sent without the server's own permission list. Its loading
  state reuses the launch `SplashView`, so cold start and login look like one screen.
  This replaces the earlier plan of calling bootstrap inside `restoreSession()` / `startSession`:
  one gate covers both paths, retries in place, and cannot fall out of step with them.
- Only `user`, `roles`, `permissions` and `numbers` are read. `routes`, `menus`, `feature_flags`,
  `settings` and `billing` are ignored (web-shell concerns). Roles are accepted as names or as
  `{ name }` objects; missing lists become empty, never undefined.
- Failure handling:

  | Failure | Result |
  | --- | --- |
  | 401 after the network layer's refresh | sign out (session is gone) |
  | 403 | `denied` → Access Denied (design 14) with Sign out; never a retry |
  | offline / timeout / 5xx | `failed` → retry screen, session kept |

- `RequirePermission` + `AccessDeniedView` are ready for the screens that need them
  (`dashboard.view` in Stage 6, `conversations.view` in Stage 7); `usePermission()` covers
  hiding an action such as send when `conversations.send` is missing.
- `app/reset` clears the slice, so a second account never inherits the first one's permissions.
- **Known limitation:** permissions are fetched once per session. A mid-session change on the
  server is picked up on the next launch; a foreground re-fetch belongs with Stage 13.

## Stages

1. Environment, Expo, Git, dependencies, base folders ✔
2. Branding assets, Poppins, theme / design system ✔
3. `network.ts`, `endpoints.ts`, `apis.ts`, Redux, storage, token management ✔
4. Splash, Login (OTP + password), OTP verification ✔
5. `/me/bootstrap`, permissions, session restore ✔
6. Personal dashboard
7. Chats list, search, filters, pagination
8. Message history, older-page loading, mark read
9. Send text + media
10. Reply window + templates
11. Message states, retry, resolve/reopen, conversation actions
12. Offline, loading, session expired, access denied
13. Realtime (Reverb) architecture with REST fallback
14. Cleanup, lint, Expo Doctor, README, backend blockers doc
15. Commits + push

### Dependencies deferred until their stage (compatibility to be verified then)
- Bottom sheet library (verify against Reanimated 4.5 / RN 0.86) — Stage 9/11
- Pusher-compatible client for Reverb — Stage 13
- `expo-file-system` for authenticated media download — Stage 8/9
- FlashList (only if stable on SDK 57) — Stage 7
- Date/time-zone utility — Stage 6
