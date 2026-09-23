# Wazigo Mobile App — Complete Reference

**Current as of 23 September 2026.** This is the single source of truth for the app. It
supersedes `HANDOVER.md`, `development-plan.md` and `backend-blockers.md`, which are kept for
history and are stale in places.

---

## 1. What this app is

The iOS and Android app for Wazigo business messaging. An agent signs in with their phone
number, sees their own dashboard, and works their own WhatsApp conversations.

**Phase 1 is Login, My Dashboard and My Chats**, plus the screens those need. Registration,
password reset, billing, campaigns, and team / contact / template / chatbot management all stay
on the web dashboard. The web menu is deliberately *not* turned into mobile navigation.

It is a client. All business logic, WhatsApp integration and authorization live in the Wazigo
Laravel API; the app renders what the server allows and sends what the server accepts.

---

## 2. Current status — read this before judging anything else

| Area | State |
| --- | --- |
| Phase-1 screens | Built |
| Tests | 286 passing across 38 suites |
| Typecheck / lint | Clean |
| Android device run | Done — development build on an emulator, against the live API |
| iOS | Builds and runs on the Simulator (iPhone 17 Pro, iOS 26.2), signed in against the live API (§4) |
| Backend blockers | 3 of 6 fixed; 3 still open (§13) |
| Support chat (Phase 4) | Built, partly verified (§11); the Settings card renders on iOS and the mail fallback works |

Three things are **not** true despite the code being complete:

1. **iOS runs, but not everything on it is proven.** It builds, installs, signs in against the
   live API, and the dashboard, chats, a thread and Settings all render (§4). Not proven: APNs
   (a simulator gets no push token at all), release signing, and sending a message — every
   conversation on the test account has a closed reply window, so the composer has only been
   checked in isolation.
2. **Media beyond images cannot be opened.** Documents, video and audio are named in the
   bubble but not playable — that needs a native dependency nobody has chosen (§12).
3. **Image upload returns 500 from production.** Reproduced five times. The request matches the
   API contract; the cause is server-side and unresolved (§12).

---

## 3. Stack

| Thing | Version | Note |
| --- | --- | --- |
| Expo SDK | 57 | Pinned; read `docs.expo.dev/versions/v57.0.0/` before writing code |
| React Native | 0.86.3 | |
| React | 19.2.3 | React Compiler enabled (`experiments.reactCompiler`) |
| TypeScript | ~6.0.3 | strict |
| Expo Router | ~57.0.21 | typed routes enabled |
| Redux Toolkit | ^2.12.0 | with `react-redux` ^9.3.0 |
| axios | ^1.20.0 | **only** importable from `src/api/network.ts` |
| pusher-js | ^8.6.0 | Laravel Reverb client |
| react-hook-form + zod | ^7.88 / ^4.6 | forms and validation |
| Jest | ~29.7 with `jest-expo` | no rendering tests (§14) |

Bundle id / package name is `io.wazigo.app` on both platforms.

---

## 4. Getting it running

```bash
npm install          # postinstall runs patch-package
cp .env.example .env
```

### Android (the verified path)

```bash
npx expo run:android          # build + install the development build (first time, or after native changes)
npx expo start --dev-client   # day to day; add -c after changing .env
```

`android/` is generated and gitignored — it is recreated by prebuild, so never hand-edit it
(that is why `plugins/with-release-signing.js` exists, §15).

**Not Expo Go.** The development build is required: Expo Go has no push, adds a second React
Native host, and shows a white loading screen.

Useful while running:

```bash
adb logcat -v time | grep ReactNativeJS     # [api], [api:write], [ui:write], [api:debug]
adb exec-out screencap -p > shot.png        # screenshot
adb -s emulator-5554 emu avd name           # the AVD name expo run:android --device wants
```

### iOS

`npx expo run:ios`. Verified on an iPhone 17 Pro simulator (iOS 26.2) on an **Intel** Mac with
Xcode 26.2 and CocoaPods 1.15.2: builds with 0 errors, installs, signs in against the live API,
and renders the dashboard, chats list, a message thread and Settings. First build takes about
40 minutes; later ones are far quicker.

**Expo SDK 57 does not compile under Xcode 26.2 without a patch.** `xcodebuild` fails with
error 65 in the `[CP-User] Build ExpoModulesJSI xcframework` phase, which compiles Expo's JSI
Swift package under `-cxx-interoperability-mode=default -swift-version 6`. Swift 6.2.3 rejects
two things Expo ships as-is: `SWIFT_RETURNS_RETAINED` on a constructor of an `import_reference`
type (`RuntimeScheduler.h`), and three `nonisolated(unsafe)` locals captured by a global-actor
closure (`JavaScriptRuntime.swift`). `expo-modules-core` pins `expo-modules-jsi@~57.1.0` and
57.1.0 is the newest on that line — the 58.0.3 tarball carries the identical header — so
`patches/expo-modules-jsi+57.1.0.patch` is the fix. Upstream:
[expo/expo#50067](https://github.com/expo/expo/issues/50067),
[#49740](https://github.com/expo/expo/pull/49740).

> **Both patches are pinned to exact versions** — `expo-modules-core@57.0.18` (Android's NDK
> build) and `expo-modules-jsi@57.1.0` (iOS compiling at all). Bumping `expo` can float either
> package and orphan its patch. Re-roll them if you take the upgrades `expo-doctor` suggests.

`app.json` declares export compliance (`ITSAppUsesNonExemptEncryption`) and suppresses two
placeholder purpose strings for permissions the app never uses — Face ID (`expo-secure-store`
never sets `requireAuthentication`) and the microphone (`launchCameraAsync` is images-only).
The microphone one also drops `android.permission.RECORD_AUDIO`, which was an unused
expo-image-picker default; that is the only Android-visible change.

Four platform behaviours were wrong and are fixed:

| Was | Now |
| --- | --- |
| `textAlignVertical: 'center'` — Android-only, so a one-line draft sat 2.75pt high in the composer | Padded to `(minTouch − lineHeight) / 2` on iOS; measured 0.08pt off centre, box still exactly 44.00pt |
| Tab bar `64 + inset` = 98pt against iOS's native 83 | `Platform.select({ ios: 52, default: 64 })` → measured 86pt on the signed-in app; Android keeps its device-tuned value |
| Sheets had no swipe-down — `onRequestClose` is only the Android back button | `PanResponder` + `Animated` on the grabber and title row, no new dependency |
| `ellipsis-vertical` in `ThreadHeader`, an Android convention | `ellipsis-horizontal` on iOS |

**A `PanResponder` inside a `Modal` on iOS must claim on touch-down.** `onMoveShouldSetPanResponder`
is never called there — nor the capture variant — so `gestureState.dy` stays 0 and the ordinary
"claim once the finger has moved 4pt" idiom silently does nothing. The identical responder mounted
outside a `Modal` receives the whole stream, which is how this was found.
`onStartShouldSetPanResponder: () => true` is the way around it; a child `Pressable` still wins its
own taps. Note that a native `ScrollView` in the same `Modal` scrolls fine — UIKit handles that
without the JS responder system, so it is **not** evidence that JS gestures are being delivered.

Still unproven on iOS:

- **APNs.** A simulator never issues a push token, and push is unconfigured until `eas init`
  regardless (§10).
- **Release signing.** `plugins/with-release-signing.js` is Android-only; the iOS equivalent
  does not exist.
- **Sending a message.** Every conversation on the test account has a closed 24-hour reply
  window, so the composer has only been measured in isolation, never used to send.
- **`expo-secure-store` across a reinstall.** It uses the iOS Keychain rather than the Android
  Keystore; session restore works, but expiry and reinstall behaviour were not re-tested.

Two traps worth knowing:

- **`expo run:ios` points the dev client at your LAN IP** (e.g. `192.168.1.107:8081`), which the
  simulator often cannot reach — it lands back on the home screen looking like a crash. Re-open
  against loopback:
  `xcrun simctl openurl booted "exp+wazigo-mobile-app://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"`.
- **`Could not parse Expo config: android.googleServicesFile` on every Metro start** is harmless
  noise. `google-services.json` is gitignored and Android-only; the dev server's manifest
  middleware validates it even when serving iOS. `expo config` exits 0 without it and the iOS
  build is unaffected.

`ios/` is gitignored (CNG). `npx expo prebuild --platform ios` regenerates it and **clears
`ios/Pods`**; the next `expo run:ios` reinstalls them (~150 s). The prebuilt RN frameworks all
ship `ios-arm64_x86_64-simulator` slices, so an Intel Mac needs no source build of React Native.

### Environment

Only `EXPO_PUBLIC_*` values are read, and they are **inlined into the bundle** — anyone with the
binary can read them. Never put an API secret, the Reverb secret or WhatsApp credentials here.

| Variable | Default | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | `https://app.wazigo.io/api/v1` | API root. The origin (without `/api/v1`) is derived for media and broadcast auth |
| `EXPO_PUBLIC_OTP_LENGTH` | `5` | Login code length. Must match the backend setting — no endpoint exposes it |
| `EXPO_PUBLIC_NETWORK_DEBUG` | *(off)* | `1` prints query, request and response bodies. Development only. Redacts credentials, **not** customer message content |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | *(empty)* | Fallback for push tokens when `app.json` has no `extra.eas.projectId` |

There is deliberately **no Reverb configuration**. Since 2026-09-18 the socket key, host, port
and scheme arrive from `GET /me/bootstrap` at runtime; a build ships with no app key at all.

---

## 5. Architecture

```
Screen  →  feature thunk / hook  →  src/api/apis.ts  →  src/api/network.ts  →  Laravel
```

Nothing skips a layer. Screens never see an axios error — they get a normalized `ApiError`.

```
src/
  app/          routes only (Expo Router). Every file here is a URL
  api/          network.ts (the only axios importer), apis.ts, endpoints.ts, types.ts, support.ts
  components/   common/ (primitives), chat/, dashboard/, feedback/, forms/
  constants/    colours, typography, spacing, branding, config — the design tokens
  features/     one folder per feature: slice + thunks + selectors (+ components where private)
  services/     media/ (picker, authenticated cache), session/, socket/, push/, storage/
  store/        the store, typed hooks, root reducer, session listeners
  utils/        pure helpers (phone, time, IST dates, initials, device)
```

Features: `auth`, `bootstrap`, `cannedMessages`, `composer`, `connectivity`, `contactNotes`,
`conversations`, `dashboard`, `messages`, `preferences`, `presence`, `push`, `realtime`,
`support`, `templates`, `workspace`.

### Boundaries the linter enforces

Each has a reason, and each is a lint **error**, not a warning.

| Rule | Why |
| --- | --- |
| `axios` only in `src/api/network.ts` | One place owns refresh, retries, offline and error shapes |
| `expo-secure-store` only in `tokenStorage.ts` | Credentials live in exactly one file |
| AsyncStorage only in `appStorage.ts` | Non-sensitive data only, under a `wazigo:` prefix |
| `expo-file-system` only in `mediaCache.ts` | Media is fetched with the bearer token, never as a public URL |
| `pusher-js` only in `services/socket/socketClient.ts` | Socket events become ids at one edge; no screen sees a payload |
| `expo-notifications` only in `services/push/pushNotifications.ts` | One place owns permissions, tokens and the foreground rule |

### Two conventions that are easy to trip over

- **Redux lives in `src/store/`, not `src/app/store.ts`** — everything under `src/app/` is a route.
- Import via the `@/*` alias. Take colours and fonts from `@/constants/theme`, never raw hex or
  font names.

---

## 6. Routes

```
src/app/
  _layout.tsx                          root: fonts, session restore, group guard
  (auth)/
    _layout.tsx                        guards: workspace block > session expired > login
    login.tsx                          phone entry, OTP request
    otp.tsx                            code entry, auto-submit, resend countdown
    session-expired.tsx                refresh was rejected
    workspace-unavailable.tsx          business suspended or deactivated
  (app)/
    _layout.tsx                        BootstrapGate + presence, realtime, push
    (tabs)/
      _layout.tsx                      two tabs: Home and Chats
      index.tsx                        dashboard
      chats.tsx                        conversation list
    chats/[id]/
      index.tsx                        message thread
      notes.tsx                        contact notes
      quick-replies.tsx                canned messages picker
      templates.tsx                    template picker + parameters
    settings.tsx                       notifications, support, account
```

Group switching is by `Stack.Protected` guards on auth status, never by imperative navigation —
when a guard closes, Expo Router moves to the first reachable screen by itself.

Two tabs only. The design's Templates and More tabs are out of phase-1 scope; templates are
reached from inside a conversation.

---

## 7. The API contract

Base URL `https://app.wazigo.io/api/v1`. Bearer token on everything except the public paths.

**Success envelope:** `{status: true, message: "OK", data: ...}`, with `meta:
{current_page, per_page, total, last_page}` on paged results. Inspect the HTTP status first.

**Errors:** `{status: false, message, errors?}`. Normalized into `ApiError` with a `code` from:
`UNAUTHORIZED`, `SESSION_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION`,
`RATE_LIMITED`, `SERVER_ERROR`, `TIMEOUT`, `OFFLINE`, `NETWORK`, `CANCELLED`, `UNKNOWN`.

### Endpoints

| ID | Method + path | Purpose |
| --- | --- | --- |
| AUTH-01 | `POST /auth/otp/request` | Request a login code. Returns `{test_account, notice}`. 5/min |
| AUTH-02 | `POST /auth/login` | OTP login → session payload |
| AUTH-03 | `POST /auth/login/password` | Password login → session payload (**entry point hidden in the UI**) |
| AUTH-04 | `POST /auth/refresh` | Rotates **both** tokens |
| AUTH-05 | `GET /me/bootstrap` | user, roles, permissions, numbers, realtime, support, settings |
| AUTH-06 | `POST /auth/logout` | Revoke session; carries `device_token` to drop the push token in the same call |
| AUTH-07 | `POST /auth/otp/notice` | Optional |
| AUTH-08 | `GET /auth/me` | Optional — no permissions registry, so not used at load |
| AUTH-11 | `PATCH /me/preferences` | `mute_notifications`, `mute_sound` (server-side mute) |
| — | `POST` / `DELETE /me/devices` | Register / remove this phone's Expo push token |
| DASH-01 | `GET /crm/overview` | Dashboard totals, priority split, activity, delivery |
| CHAT-01 | `GET /conversations` | List; params `status, search, unread, assigned, label_id, priority, number_id, page, per_page` |
| CHAT-02 | `GET /conversations/{id}/messages` | Thread; `meta.conversation` carries the conversation |
| CHAT-03 | `POST /conversations/{id}/messages` | Send text (`{type:'text', text}`) |
| CHAT-04 | `POST /conversations/{id}/messages` | Send media — multipart, `type` + `file` (+ `caption`) |
| CHAT-05 | `GET /conversations/{id}/messages/{msg}/media` | Authenticated media bytes |
| CHAT-06 | `POST /conversations/{id}/read` | Mark read (**a write** — opening a thread performs it) |
| CHAT-07 | `GET /templates` | `approved_only`, `search`, `category` |
| CHAT-08 | `POST /conversations/{id}/template` | Send a template with header/body params |
| CHAT-09 | `POST /conversations/{id}/messages/{msg}/retry` | Retry a failed send |
| CHAT-10 / 11 | `POST .../resolve` / `.../reopen` | Close / reopen |
| CHAT-13 | `GET /labels` | Label catalogue (read-only) |
| CHAT-14 / 15 | `PUT .../labels`, `PUT .../priority` | Update labels / priority |
| CHAT-16 / 17 | `PUT /me/presence`, `POST /me/presence/heartbeat` | Presence |
| CHAT-18 | `POST /conversations/{id}/chatbot/stop` | Take over from the bot |
| CHAT-20 | `GET /canned-messages` | Quick replies (team + personal, unpaged) |
| CHAT-21 / 22 | `GET` / `POST /contacts/{id}/notes` | Internal notes, max 2000 chars |
| LIVE-01 | `POST /broadcasting/auth` | Private channel auth, under `/api/v1` |

Public (no bearer): `/auth/otp/request`, `/auth/login`, `/auth/login/password`, `/auth/refresh`,
`/auth/otp/notice`.

**Not in the API, so not built:** assigning a conversation to someone, creating or editing
labels, templates or canned messages, deleting conversations.

---

## 8. Session and authentication

Tokens live in SecureStore, one key per token. The network layer:

- **Refreshes proactively** 30 s before expiry, so an avoidable 401 never happens.
- Holds a **single-flight lock** — concurrent 401s cause exactly one refresh.
- **Retries the original request once** after a refresh.
- Reuses a pair another request already rotated, rather than sending a revoked refresh token.
- **Short-circuits while offline** instead of waiting for a timeout.
- Refuses to send credentials to a non-Wazigo host.

**A session only ends when a refresh is *rejected*.** A network error, timeout, 5xx or 429 keeps
it — the app retries when the connection comes back. When it does end, SecureStore and private
storage are cleared and the Session Expired screen is the only reachable route.

The layer is decoupled from Redux through `sessionEvents` (`expired`, `refreshed`,
`workspaceUnavailable`); `store/sessionListeners.ts` bridges them.

### Login flow

Phone (E.164, `+91` default) → `AUTH-01` → OTP screen with a 60 s resend countdown (a 429
`Retry-After` always wins) → auto-submit when the last digit lands → `AUTH-02` → tokens stored →
`BootstrapGate` loads `AUTH-05` → signed-in area renders.

Two things are deliberately hidden rather than deleted:

- **Password sign-in** — only the entry point is commented out, so `mode` can never become
  `'password'`. Restoring AUTH-03 is putting one block back.
- **The review-account notice** — AUTH-01's `data.notice` says "This is a review test account…"
  for flagged accounts, which is store-reviewer instruction, not something a real customer should
  read on a login screen. Still parsed into state; simply not drawn.

---

## 9. Permissions

`GET /me/bootstrap` answers before any signed-in screen renders, so nothing is ever drawn or sent
without the server's own list of what the user may do. `BootstrapGate` holds the whole area.

Re-fetched quietly on foreground and on reconnect, once what is loaded is older than **5 minutes**
(a full bootstrap is expensive). A failed background re-fetch keeps the permissions already in
hand; a 403 or 401 is not transient and is handled as if it were the first load.

Permission keys used: `conversations.view`, `conversations.send`, `conversations.tag`,
`templates.view`, `templates.send`, `dashboard.view`. Use the returned permissions, never
hardcoded role names.

---

## 10. Live updates and push

### Reverb (LIVE-02)

The app subscribes to **one** channel: `tenant.<id>.agent.<user>`, whose exact name the server
composes and hands over in `AUTH-05 data.realtime.channels.agent`. It carries only conversations
assigned to the signed-in person. Connection details (key, host, port, scheme, auth path) come
from the same block and are validated on arrival — a half-filled block is treated as absent so
the app falls straight through to REST rather than retrying a connection that cannot work.

**Events are signals, never data.** `services/socket/channels.ts` reduces every event to a
conversation id at the edge; nothing from a payload is stored, rendered or logged. The five
events are `message.received`, `message.sent`, `message.status`, `conversation.updated`,
`conversation.assigned`. A burst is batched, and the screens reload through the normal
server-scoped REST calls, quietly, keeping the page and scroll position the user is on.

`conversation.assigned` carries `previous_assigned_user_id`, so a chat moving *away* from this
user closes the open thread instead of leaving it on messages it can no longer refresh.

Underneath it is the REST fallback: refresh on foreground and on reconnect, pull-to-refresh, and
a 15 s poll of what is on screen while the socket cannot connect.

### Push

Expo push tokens (one service covering FCM and APNs). After sign-in the app asks for permission,
gets the token and registers it with `POST /me/devices`. Sign-out sends the token inline with
`AUTH-06`, so revoking the session and dropping the token are one call that cannot half-succeed.

Tapping a notification opens its chat (`conversation_id` in the data), and no banner shows for
the chat already on screen. `mute_notifications` is a **server-side** check shared with the web
app's bell — it stops every push to that person on every phone.

Push requires a development or store build, `eas init`, the FCM and APNs keys uploaded to EAS,
and `google-services.json` in the project root (gitignored).

---

## 11. Support chat and workspace suspension (Super-admin Phase 4)

Wazigo support runs on WhatsApp. The server hands the app a finished `wa.me` link with the
customer's name, business and account number already written into the message and already
encoded. The app only opens it.

**Two rules, enforced by the reader in `api/support.ts`, not by convention:**

1. The support number never appears as text, because nothing ever parses it out of the link —
   `chat_url` is passed through byte for byte. Only the email is shown as a contact detail.
2. A `chat_url` that is not an absolute `http(s)` URL is treated as "not set" rather than opened.
   That shape is the contract, and it is what makes the fallback work: a phone without WhatsApp
   opens the very same link in its browser.

`data.support` is `{email, chat_url}` on every bootstrap. `email` falls back to
`support@wazigo.io`, so in practice it is never null; `chat_url` is null until a support number
is set in the back office.

**Settings** shows a Support section: the WhatsApp row only when `chat_url` is present, the email
whenever there is one, neither when there is neither.

**Suspension.** A suspended or deactivated business answers `403` to every route — every
signed-in call plus `/auth/login`, `/auth/login/password` and `/auth/refresh`. (`/auth/otp/request`
does *not* refuse: the code is sent, and the login step returns the 403.) The body is:

```json
{"status": false, "message": "...", "data": {
  "code": "workspace_unavailable",
  "workspace_status": "suspended" | "deactivated",
  "reason": "text for the customer, null when deactivated",
  "support": {"email": "...", "chat_url": "..." }
}}
```

It is recognised **once, centrally**, in the response interceptor and announced through
`sessionEvents`, so no screen has to know about it. The handler records the block synchronously,
clears the session, and resets the store behind it.

That ordering matters: `/auth/refresh` answers 403 too, so one response says both "the business
is closed" and "this session is dead". If the session-expired story landed second it would reset
the workspace slice and show "Session expired" — which explains nothing and sends the customer
round the login loop. So the block is set before the first `await`, `rootReducer` carries the
slice across a reset, and `handleSessionExpired` stands down when a block exists.

Reactivation requires signing in again; a refresh then returns 401 and takes the ordinary path.

**Verified:** the bootstrap block is live and the Settings section renders correctly.
**Not verified:** the suspended screen end to end — it needs a business actually suspended, and
the backend's matching refresh fix published.

---

## 12. Offline, errors and message states

- One offline strip for the whole app — every screen is inside `Screen`, so it is reported once.
- Sends are **optimistic** with pending / sent / delivered / read / failed ticks.
- Contact notes are deliberately **not** optimistic: a note that silently failed to save is worse
  than one that takes a moment to appear, because the author would believe a colleague can see it.
- A failed message's `error_detail` arrives as WhatsApp's error object (or a list of them), not
  the documented string. Always render it through `messageErrorText()`.
- The 24-hour reply window comes from `window_open` / `window_expires_at`. Outside it, only an
  approved template can be sent, and sending one does not reopen free text.
- Server timestamps are authoritative for ordering and the reply window. Displayed in
  Asia/Kolkata.

**Known wrong / unfinished:**

- **Image upload 500s** from production every time (5 attempts). Text sends return 201. The
  multipart request matches CHAT-04. Cause is server-side, in the logs for
  `POST /api/v1/conversations/3/messages`.
- **Retry copy after a 5xx is wrong.** A failed message offers "This message never reached
  Wazigo, so it will be sent fresh" — but after a 500 it *did* reach the server, and each retry
  could duplicate. Should warn about duplicates whenever the server responded.
- **Documents, video and audio cannot be opened** — only named. Needs `expo-sharing` /
  `expo-video` / `expo-audio`. Native, so it must be decided before a build.
- **Some template messages show only "Template message"** — the API returns `text_body: null`
  with no name or preview, only `delivery_pricing.category`. Undecided whether to show it.

---

## 13. What the backend still owes

Three of the original six blockers are fixed. **Client-side filtering is never the fix for any
of them.**

| # | Blocker | State |
| --- | --- | --- |
| 1 | `GET /conversations` must scope to the caller (CHAT-01) | **OPEN** — still own + unassigned for Agent, all for Admin/Supervisor |
| 2 | `GET /conversations/{id}/messages` must authorize by assignment (CHAT-02) | **OPEN** — policy unchanged |
| 3 | Media must use the same rule (CHAT-05) | **OPEN** |
| 4 | `GET /crm/overview` must count only the caller's conversations (DASH-01) | **OPEN** — still workspace-wide |
| 5 | Reverb must deliver personal events | **FIXED** 2026-09-17 (LIVE-02) |
| 6 | Reassignment must revoke previous access immediately | **FIXED** — `previous_assigned_user_id` |

Also outstanding, not blockers:

- **No support WhatsApp number is set** in the back office (`chat_url: null`), so the "Chat with
  support" row is hidden on every device.
- The API reference spreadsheet documents **none** of Phase 4 — not `data.support`, not the 403
  body, and Phase 4 is absent from its "Change-required status" tab.

---

## 14. Testing

`npm test` — 286 tests, 38 suites, no device and no network of its own.

- `src/api/__tests__/network.test.ts` drives the **real** network layer against a **local HTTP
  server**: concurrent 401s causing one refresh, proactive refresh, expiry without looping,
  transient failures keeping the session, 422/429/403, the workspace 403, offline, and a refusal
  to hand credentials to a foreign host.
- Feature tests cover what the contract demands: CHAT-01 query building and paging, thread
  merging, optimistic sends and retries, the reply window, template parameters, conversation
  actions, presence, live-update batching, and the shared offline/error copy.

**There are no rendering tests, on purpose.** React Native rendering is exactly the part that
must be checked on a real device, and a passing render test would only suggest otherwise.

```bash
npm run lint         # eslint-config-expo + this project's import guards
npm run typecheck    # app and test tsconfigs
npm test
npm run doctor       # expo-doctor
```

---

## 15. Build and release

**Android release signing** is handled by `plugins/with-release-signing.js`. The generated
`build.gradle` points `release` at the debug keystore; fixing that by hand does not survive,
because `android/` is regenerated and gitignored — hence a config plugin. The credentials
themselves are Gradle properties in `~/.gradle/gradle.properties`, outside the repo. When they
are absent (fresh clone, CI without secrets) the build falls back to debug signing, so
`assembleRelease` keeps working for anyone who only wants to run the app.

**iOS release signing is not configured.**

`patches/expo-modules-core+57.0.18.patch` fixes an Android Gradle stub-PCH task that breaks on
paths containing spaces — which this project's path has. Applied by `patch-package` on install.

---

## 16. Conventions to keep

- Routes in `src/app/`; **Redux in `src/store/`**.
- Import alias `@/*` → `src/*`.
- No axios / SecureStore / AsyncStorage / pusher-js / file-system / notifications imports outside
  their one allowed file — lint errors, each for a reason.
- No raw hex colours or font names in screens; use theme tokens.
- Screens get `ApiError`, never raw axios errors. Status colour is always paired with text or an
  icon.
- **Production is live data.** A send, retry, template, upload, resolve/reopen, priority, label or
  take-over reaches real customers on WhatsApp — and opening a thread with unread messages marks
  it read, which is also a write. Never perform these without the user's explicit approval. The
  user tests with test accounts.
- There is **no read-only guard** and the user does not want one. What survives is diagnosis, not
  prevention: `[api:write]` logs every non-GET with a timestamp and the stack it came from, and
  `[ui:write]` logs the action that started it. Both line up with `adb logcat`.
- Never claim a flow was tested on a device unless it was actually run.
- Match the design by measuring the mockup; say what is deliberately different and why, rather
  than inventing data the API does not return.
- Commits: `chore:` / `feat:` / `fix:` / `docs:` with the `Co-Authored-By: Claude Opus 5`
  trailer. Never force-push `main`.

---

## 17. Open questions

1. **Terms of Service / Privacy URLs** — the design shows them on Login; omitted until supplied.
2. **OTP length** — backend default 5, deployment-configurable, exposed by no endpoint. Real
   logins work with 5; confirm that is the deployed setting.
3. **Media viewing** — which dependency for documents, video and audio (§12). Native, so decide
   before a build.
4. **Template fallback** — show `delivery_pricing.category` next to "Template message", or not.
5. **Design screens 6–14** — thread, reply-window banners, templates, the sheets, and the empty /
   offline / expired / denied states have not been compared with the mockup.
6. **Push on a suspended workspace** — does the server stop sending? If not, agents keep getting
   notifications for messages they cannot open.
7. **Support from the login screen** — `support` comes from bootstrap, which needs a session, so
   someone who cannot sign in cannot reach support from the app.
