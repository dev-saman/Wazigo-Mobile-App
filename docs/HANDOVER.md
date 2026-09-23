# Wazigo Mobile App — Handover (after the first device run and design pass)

> **Superseded by [REFERENCE.md](REFERENCE.md) (23 September 2026).** Kept for history;
> parts of this file are out of date.

Last updated: 2026-09-16. Read this first, then [development-plan.md](development-plan.md)
(endpoint map, design deviations, backend blockers).

## 1. Project facts

| Item | Value |
| --- | --- |
| Project folder | `D:\React Native\Wazigo-Mobile-App` |
| Repo / branch | https://github.com/dev-saman/Wazigo-Mobile-App · `main` (pushed, clean) |
| API base URL | `https://app.wazigo.io/api/v1` |
| API spec (authoritative) | Google Sheet "Wazigo Mobile App — API Reference" — sheets: Start here, Login, Chat, Dashboard, Live updates |
| Expo SDK / RN / React | 57.0.23 / 0.86.3 / 19.2.3 |
| App identity (iOS + Android) | `io.wazigo.app` — permanent, never change after the first store upload |
| TypeScript / Node / npm | 6.0.3 (strict) / 22.20.0 / 11.5.1 |
| Router | Expo Router 57 (typed routes + React Compiler on) |
| Platforms | iOS + Android only (web removed) |

Phase-1 scope: **Login, My Dashboard, My Chats** plus their supporting screens.
Nothing else (no registration, password reset, billing, campaigns, team/contact/template/chatbot
management, settings).

## 2. Status

| Stage | State |
| --- | --- |
| 1. Environment, Expo, Git, dependencies, folders | done — `37856cf` |
| 2. Branding, Poppins, design system | done — `2851455` |
| 3. Network layer, APIs, Redux, token storage | done — `88ea399` |
| 4. Splash + Login (OTP/password) + OTP verification | done — `83e6b2f` |
| 5. `/me/bootstrap`, permissions, session restore | done — `d9af3cf` |
| 6. Personal dashboard + Home/Chats tabs | done — `efcafa8` |
| 7. Chats list, search, filters, pagination | done — `c3fbb12` |
| 8. Message history, older pages, mark read | done — `5f8aefa` |
| 9. Send text + media | done — `6c8c993` |
| 10. Reply window + templates | done — `95f720b` |
| 11. Message states, retry, resolve/reopen, actions | done — `2d94323` |
| 12. Offline, loading, session expired, access denied | done — `4e1d45c` |
| 13. REST fallback + presence | done — `3d779ec` — **socket deliberately not connected** |
| 14. Cleanup, expo-doctor, README, blockers doc | done — `0724916` |
| 15. Final commit + push, verified from a clean clone | done — see §3 |
| After 15: first device run, development build, design pass | done — `7ee56b4` … `df61d76` (see §3, last section) |
| 16. Live updates over Reverb + push notifications | code done, **not yet run on a device** — see §3 "Live updates and push (Stage 16)" |
| Next | §7 |

Checks passing at `df61d76`: `npm run lint`, `npm run typecheck`, `npm test` (**210 tests**),
`npx expo-doctor` (21/21). `npm audit`: 14 moderate, 0 high/critical - read Stage 15 in §3 before
touching them.

**The app now runs on the Android emulator as a development build against the production API,**
signed in with a real test account, and real messages have been sent from it (see §3). iOS has
never been run. The DevTools Network tab was not re-checked on the development build.

## 3. What exists

### Routes as they stand now

```
src/app/_layout.tsx             restoreSession() + brand splash while status is "unknown",
                                then <Stack.Protected> opens exactly one group
  (auth)/_layout.tsx            session-expired while auth.sessionExpired, else login + otp
    login.tsx                   /login   phone + OTP or password      (anchor)
    otp.tsx                     /otp     code entry, resend countdown
    session-expired.tsx         /session-expired   design 13, the only reachable auth screen
                                                   while the flag is set
  (app)/_layout.tsx             BootstrapGate: nothing renders until AUTH-05 answers,
                                then presence (CHAT-16/17) runs for as long as it is on screen
    (tabs)/index.tsx            /        dashboard (dashboard.view)
    (tabs)/chats.tsx            /chats   conversation list (conversations.view)
    chats/[id]/index.tsx        /chats/1 thread + composer (covers the tab bar)
    chats/[id]/templates.tsx    /chats/1/templates   template picker + parameters
```

There is **no root `index.tsx`** on purpose: the tabs group owns `/`, so the splash renders from
the root layout instead of a competing route.

### Branding & design system (Stage 2)
- `assets/branding/` — 6 official PNGs (app icon, green/dark/white icon, dark/white wordmark),
  transparent padding trimmed only. Never re-create the logo with text.
- `src/constants/` — `colors.ts` (Deep Green #00603A, Vivid Green #08B74F, Soft Mint #D8F8DE,
  Mint #25D366, Deep Navy #0F172A + neutrals/status), `typography.ts` (Poppins 400/500/600/700,
  one family per weight — never combine with `fontWeight`), `spacing.ts`, `branding.ts`,
  `config.ts` (env), `theme.ts` (re-export barrel).
- `src/components/common/` — `AppText`, `Button`, `IconButton`, `Card`, `Screen`, `BrandLogo`,
  `Avatar`, `Badge`. `src/components/feedback/` — `Banner`, `StateView`, `Skeleton`/`SkeletonList`.
- App icon + native splash wired in `app.json` (splash: Deep Green, app icon, imageWidth 88).
- `SplashView` (the deep-green brand splash) is rendered by the root layout during session
  restore. The Stage 2 `/ui-preview` design-system catalogue was removed in Stage 4.

### Network & session (Stage 3)

```
Screen → feature thunk/hook → src/api/apis.ts → src/api/network.ts → Laravel
```

- `src/api/network.ts` — the only axios importer (ESLint-enforced). Single-flight rotating
  refresh, proactive refresh 30 s before expiry, retry-once on 401, reuse of an already-rotated
  token instead of a second refresh, offline short-circuit, timeouts, envelope unwrapping,
  `ApiError` normalization, `upload()` multipart, `authorizedRequest()` for non-axios downloads
  (refuses non-Wazigo hosts), dev logging without query strings/bodies.
- `src/api/endpoints.ts` (all paths + `PUBLIC_PATHS`), `src/api/apis.ts` (typed functions per
  workbook ID), `src/api/types.ts` (envelope, `ApiError`, domain resources, `Permissions`, limits).
- `src/services/storage/tokenStorage.ts` — SecureStore, one key per token, refresh written first.
- `src/services/storage/appStorage.ts` — AsyncStorage, `wazigo:` prefix, NON-SENSITIVE only.
- `src/services/session/` — `sessionEvents` (expired/refreshed), `sessionCleanup`
  (`registerSessionCleanup` for the socket/presence services later).
- `src/store/` — store, typed hooks (`useAppDispatch`, `useAppSelector`, `createAppAsyncThunk`),
  `rootReducer` (`app/reset` wipes session state, keeps connectivity), `sessionListeners`.
- `src/features/auth/` — slice (`status: unknown|authenticated|unauthenticated|signingOut`,
  `user`, `sessionExpired`, `otpChallenge`), thunks (`requestLoginOtp`, `signInWithOtp`,
  `signInWithPassword`, `restoreSession`, `signOut`, `handleSessionExpired`), selectors.
- `src/features/connectivity/` — slice + `useConnectivityMonitor()` (mounted in the root layout).

### Login & OTP (Stage 4)

- `src/components/forms/` — `TextField`, `PhoneField` (fixed +91, groups as you type),
  `OtpInput` (boxes drawn under one invisible input, so OS paste/autofill and backspace work).
- `src/features/auth/validation.ts` (react-hook-form + zod, one schema for both login modes),
  `errors.ts` (ApiError -> field errors + one banner), `authSlice.otpChallenge`
  (pending phone, resend cooldown, server notice), `restoreSession` thunk.
- `src/utils/phone.ts` (E.164 in, `+91 98765 43210` out) and `src/utils/time.ts` (countdown).
- OTP length is `Config.otpLength` (`EXPO_PUBLIC_OTP_LENGTH`, default 5); the resend cooldown
  is 60 s and a 429 `Retry-After` overrides it.
- Not built, as agreed: Google sign-in, registration, password reset, and the Terms/Privacy
  links (no URLs supplied).

### Bootstrap & permissions (Stage 5)

- `src/features/bootstrap/` — slice (`idle|loading|ready|failed|denied`, `permissions`, `roles`,
  `numbers`, `error`), `loadBootstrap` (AUTH-05), selectors, `usePermission()`, and the
  `BootstrapGate` / `RequirePermission` / `AccessDeniedView` components. One barrel: `@/features/bootstrap`.
- **`BootstrapGate` wraps `(app)/_layout.tsx`**, so no signed-in screen renders until AUTH-05
  answers - nothing is drawn or sent without the server's permission list. Its loading state is the
  same `SplashView` as launch, so cold start and login look like one continuous screen.
- Only `user`, `roles`, `permissions`, `numbers` are read; the user from bootstrap replaces the
  slimmer one from login. 401 -> sign out, 403 -> Access Denied, offline/5xx -> retry in place.
- `RequirePermission` / `usePermission()` now gate the dashboard (`dashboard.view`), the chats list
  and thread (`conversations.view`), the composer (`conversations.send`), templates
  (`templates.view` / `templates.send`) and priority + labels (`conversations.tag`).
- Permissions were fetched once per session until Stage 13; they are now re-fetched silently on
  foreground and on reconnect (at most every 5 minutes).

### Dashboard & tabs (Stage 6)

- `src/features/dashboard/` — slice (`idle|loading|refreshing|ready|failed`), `loadDashboard({refresh})`
  (DASH-01), memoised selectors, `DashboardHeader` (wordmark + confirmed sign-out) and `GreetingCard`.
  `src/components/dashboard/` — `MetricCard`, `StatRow`, `DashboardSkeleton`.
- **Tabs come from `expo-router/js-tabs`**: `import { Tabs } from 'expo-router'` is deprecated in
  Expo Router 57, and `unstable-native-tabs` cannot carry Poppins labels or the brand greens.
  Two tabs only (Home, Chats).
- Home shows only DASH-01 fields: four totals, priority breakdown (urgent first, unknown values
  dropped), today's and the window's inbound/outbound with the busiest day, and delivery with the
  note that **delivered already includes read**. `totals.closed` is ignored on purpose.
- First use of `RequirePermission` (`dashboard.view`). Skeleton while loading, retry on first
  failure, and **a failed pull-to-refresh keeps the visible numbers** and marks them stale.

### Chats list (Stage 7)

- `src/features/conversations/` — slice + `loadConversations({refresh})` / `loadMoreConversations()`;
  `src/components/chat/` — `ConversationRow`, `ChatFilterChips`, `ChatSearchField`, `MessageTick`.
- **Chips are CHAT-01 queries, never local filtering**: Mine (`assigned=mine`, the default scope),
  Unread, Open, Urgent, Unassigned. Search is `search=`, debounced 350 ms.
- **One list request in flight at a time.** A new chip, term or refresh aborts the previous call
  via the request `signal`, so a slow reply cannot overwrite a newer one; `CANCELLED` is not an error.
- Pages merge by id (never a duplicate row), page 1 replaces, `onEndReached` only fires while
  `current_page < last_page`. A failed refresh or next page keeps the rows already listed.
- `FlatList`, not FlashList - a list dependency that cannot be device-tested this stage is not worth
  the risk on SDK 57 / RN 0.86.
- `src/utils/datetime.ts` applies IST as a fixed +05:30 offset instead of `Intl` (Hermes' ICU data
  varies by platform, and a missing zone silently uses the device's, moving messages to the wrong
  day). Screen readers get the real date and time, not `3h`.
- Rows are deliberately not pressable yet; Stage 8 adds the thread screen and passes `onPress`.

### Message thread (Stage 8)

- `src/app/(app)/chats/[id]/index.tsx` (sibling of `(tabs)`, so it covers the tab bar) +
  `src/features/messages/` (state keyed by conversation id, `loadThread`, `loadOlderMessages`,
  and `threadRows.ts` for day grouping) + `MessageBubble`, `DaySeparator`, `ThreadHeader`.
- **The header comes from CHAT-02's `meta.conversation`**; the tapped row is only the placeholder
  until the first page lands.
- Newest-first data + an **inverted `FlatList`**: `onEndReached` means older history, and only
  fires while `current_page < last_page`. Pages merge by id; a failed older page keeps the screen.
- Day separators and bubble times go through the IST helpers, so the day boundary is India's.
- **CHAT-06 runs once per visit**, only when there are unread messages, and patches the thread and
  the listed row from its response. Failure is swallowed - a badge must not interrupt reading.
- 403 shows Access Denied (blocker 2 makes that real), 404 offers a way back, offline offers retry.
- Threads stay in memory for the session; evict if that ever matters.

### Sending and media (Stage 9)

- `sendThunks.ts` (CHAT-03 / CHAT-04), `src/services/media/picker.ts` + `mediaCache.ts`,
  `MessageComposer`, `AttachmentSheet`, `MediaAttachment`. `expo-file-system` 57.0.7 added.
- **Optimistic, and nothing typed is ever lost.** Sends appear at once with a negative local id
  and `pending`; the 201 replaces them in place; a failure keeps them on screen as `failed`
  (Stage 11 retries). Unsent messages survive a thread reload, which is what makes the next
  point safe.
- **409 = the chat was reassigned while it was open.** The thread reloads to show the truth and
  the failed message stays on top of it; retrying the send would only fail again.
- 4096 / 1024 / 50 MB are all enforced before the request; the size check is in the picker, so a
  large file never starts uploading.
- The composer is **hidden** without `conversations.send` (a send box that always fails is worse
  than none) and disabled while offline.
- **Media is never a public URL**: `mediaCache.ts` is the only file allowed to import
  `expo-file-system` (ESLint-enforced) and downloads CHAT-05 with the bearer headers from
  `network.authorizedRequest()`, once per file, into the cache. Logout clears it.
- **Images download and show inline; video, audio and documents are named only** - opening or
  playing them needs a viewer/sharing dependency nobody has chosen yet. **Decide before release.**
- A real bug this stage caught: threads were created by spreading a shared object, so every thread
  after the first shared (and eventually froze) the same `items` array. They are built by a factory
  now - worth remembering for any future `byId` slice.

### Reply window and templates (Stage 10)

- `replyWindow.ts` + `useReplyWindow()`, `src/features/templates/` (CHAT-07 + `templateParams.ts`),
  `sendTemplate` (CHAT-08), `ReplyWindowBanner`, `TemplateListItem`, route `chats/[id]/templates`.
  The thread moved to `chats/[id]/index.tsx` - same URL, room for the child route.
- **The server owns the window**: the app only formats `window_expires_at`. The expiry wins over a
  stale `window_open`, and the value is recomputed every 30 s **and on foreground**, never ticked.
- **A closed window replaces the composer with "Choose Template"** rather than disabling it -
  WhatsApp refuses free-form messages outside 24 hours, so a send box that must fail is dishonest.
- Only `approved_only=1` templates are listed; search is server-side, debounced and cancellable.
- `variable_counts` first, placeholder counting only as a fallback; 20 params and 1024 characters
  are enforced before sending, with a live preview so nobody sends `{{1}}` to a customer.
- Sending a template is optimistic like any other message and returns to the thread at once.

### Message states and actions (Stage 11)

- `retryThunks.ts` (CHAT-09), `conversationActions.ts` (CHAT-10/11/14/15/18), `labelsSlice.ts`
  (CHAT-13), the shared `Sheet` / `SheetAction` primitives and four sheets.
- **Retry depends on whether the server ever saw the message**: a server id goes through CHAT-09,
  a negative (local) id is simply sent again - no id to retry, no duplicate risk.
- **A 200 from CHAT-09 can still say `failed`**; the response replaces the bubble either way.
  `retry.available` / `blocked_reason` are respected, and `may_duplicate` is stated before sending.
- Every action answers with the Conversation, so it patches the thread and the listed row from the
  response. **Reopening does not extend the reply window**, and the sheet says so.
- Priority and labels need `conversations.tag`; take-over appears only while a bot session runs.
  CHAT-14 replaces the whole label list, so the sheet selects the final state.
- Message info shows only what the API returns (one status, one timestamp, error detail, origin) -
  the design's sent/delivered/read timeline has no fields behind it.

### Offline, loading and session states (Stage 12)

- `src/components/feedback/` gained `errorCopy.ts` (`errorStateFor`, `isOfflineError`, `StateCopy`),
  `ErrorState`, `StaleDataBanner` and `OfflineNotice`; `src/app/(auth)/session-expired.tsx` and
  `ThreadSkeleton` are new. Design screens 11-14.
- **Session Expired is a screen now, not a banner on Login.** `auth.sessionExpired` closes a guard
  in `(auth)/_layout.tsx`, so it is the only screen the router can reach until it is acknowledged -
  an expiry during a background fetch cannot leave a half-loaded screen up. "Log In Again" only
  clears the flag; the guard reopens Login and the router moves there.
- **One offline strip for the whole app**, rendered by `Screen`, so no screen repeats it and none
  can forget it. Login, OTP, the composer and the template form now say what being offline means
  for the action in front of the user instead of restating the condition.
- **One copy deck for failures.** `errorStateFor` maps an `ApiError` to icon, tone, title and
  description, and `ErrorState` renders it, so offline, timeout, a dropped connection, 429 and 5xx
  read the same on the dashboard, the chats list, a thread, templates and the bootstrap gate. A 5xx
  never shows raw server text. Two cases keep their own handling because the action differs: 403 on
  a thread is Access Denied, and 404 offers a way back rather than a retry.
- **A failed refresh keeps what is on screen** in all four slices; `StaleDataBanner` says so on the
  chats list, the thread and templates too, not only on the dashboard.
- **Offline refuses cleanly**: the conversation, priority, labels and message sheets disable their
  actions and explain why (`Sheet` takes a `notice`), and a template cannot be sent.
- Loading shapes match the content: a bubble-shaped `ThreadSkeleton` instead of a centred spinner,
  and `SkeletonList` without avatars for the template rows.
- Accessibility: live regions on state views, banners and the sheet notice; explicit retry labels
  ("Retry loading your conversations"); every skeleton and list footer names what it is loading.
- A refresh whose connection drops keeps the session - that is now tested, not assumed (timeouts
  count as network errors, so they are transient too).

### Live updates and presence (Stage 13)

- **The socket is not connected, on purpose.** Missing: the Reverb app key, the
  `/broadcasting/auth` location, `tenant_id` (a JWT claim only) and the event catalogue - the
  workbook documents the channel but never what is broadcast on it. And **blocker 5** means
  `private-tenant.<tenant>.number.<number>` carries other assignees' message content, which a
  personal app must not receive. Guessing event names, or shipping a connect path for a channel
  the app must not join, would be unverifiable either way.
- `src/features/realtime/` - `isStale` + `useLiveRefresh`. Every screen that loads something
  refreshes on **app foreground** and on **reconnect**, but only once what it shows is older than
  30 s (permissions: 5 minutes). Pull-to-refresh is unchanged.
- **The refresh is quiet**: `loadConversations`, `loadThread` and `loadDashboard` take a flag that
  skips the loading dispatch, so a refresh nobody asked for never blanks a thread, drops a skeleton
  over the list, or spins a `RefreshControl`. A failure keeps what is on screen (Stage 12's stale
  banner says so).
- **It stands down once the user has paged** (`page > 1`) - reloading page 1 under someone who has
  scrolled back through history would throw that history away.
- `loadBootstrap({ silent: true })` re-fetches permissions without the gate: a transient failure
  keeps the permissions in hand, but 403 (access taken away) and 401 (dead session) behave exactly
  as on first load.
- `src/features/presence/` - CHAT-16/17. Online while foregrounded, away on background, a heartbeat
  every 60 s, nothing while offline, and a re-send of any status the server never accepted. Every
  failure is swallowed. The transport is injected, so the policy is tested without the network.
  **No slice**: nothing in the design shows the agent's own presence.
- A test caught a real bug here: a status change made while the previous call was in flight was
  dropped, which would have left an agent showing "online" after backgrounding the app.
- **When the answers arrive**: the socket goes behind `src/services/socket/` and an app-level
  interface (no screen or slice imports the client), registers with `registerSessionCleanup`, and
  stays gated until blocker 5 is fixed. The REST fallback stays underneath it. *(Superseded by
  Stage 16 below.)*

### Live updates and push (Stage 16)

**Where the missing answers came from (2026-09-17, read-only).**

| Question | Answer | Source |
| --- | --- | --- |
| Reverb app key | `f1852114c0374fef9a295616c9d9ca8e` (public) | `reverb-key` meta tag on https://app.wazigo.io/login |
| `/broadcasting/auth` | `POST /api/v1/broadcasting/auth` | the live API ("Supported methods: POST"), and the web app's API client |
| `tenant_id` | `settings.tenant.id` in `GET /me/bootstrap` | the web app's settings slice |
| Events on `tenant.<t>.number.<n>` | `message.received`, `message.sent` (`{message, conversation}`), `message.status` (`{id, conversation_id, status, error_detail, retry}`), `conversation.updated`, `conversation.assigned` (`{conversation}`) | the web app's live-update hook |
| Personal channel | `App.Models.User.<id>`, Laravel broadcast notifications (`{id, title, body, level, icon, link}`) | same |
| Device tokens | `POST /api/v1/me/devices`, `DELETE /api/v1/me/devices` | the live API ("Supported methods: POST, DELETE") |

**Decision (user, 2026-09-17): number channels as signals.** The only live message channels are
still per number (blocker 5). The app subscribes to them, but `signalFromEvent` keeps nothing but
a conversation id - no text, no contact - and the screens reload through CHAT-01/02 and DASH-01.
What an agent sees is still decided by the server. The payloads do reach the phone until the
server sends personal events; fixing blocker 5 needs no app change beyond the channel names.

- `src/services/socket/` - `channels.ts` (names, event → signal, pure and tested) and
  `socketClient.ts` (the only `pusher-js` importer; channel auth through `network`, so bearer +
  refresh rules apply).
- `src/features/realtime/` - `realtimeSlice` (socket state, the open thread), `liveSignalBus`
  (socket and foreground pushes both feed it), `liveBatch` (750 ms batching), `applyLiveBatch`
  (reloads only what is on screen, respecting permissions), `useRealtime` (connect while
  foreground + online, disconnect in background, catch up after a reconnect, **15 s poll while
  the socket is down**) and `useActiveConversation`.
- **Live reloads merge.** `loadConversations({ merge })` puts page 1 on top of pages already
  scrolled to; `loadThread({ merge })` keeps loaded history. The Stage 13 foreground refresh
  still stands down after paging; live updates no longer need to.
- **Mark read follows live updates.** CHAT-06 was once per visit; it now also runs when a live
  reload brings unread messages into the open thread (keyed on the server's copy, so a failed
  call does not loop).
- `src/services/push/pushNotifications.ts` (the only `expo-notifications` importer) and
  `src/features/push/` - Android channel `messages`, permission after sign-in, Expo push token
  registered with `{token, platform, provider: "expo", device_name}`, re-registered when the
  token rotates, unregistered in `signOut` **before** AUTH-06. Tap opens `/chats/<id>` from
  `conversation_id` (also `conversationId`, `conversation.id`, or a `link`/`url`), including a
  notification that launched the app. No banner for the thread already open; a push that
  arrives while the app is open is also a live signal.
- **Push must never crash the app.** The first run on a development build made before
  `expo-notifications` was added threw "Cannot find native module 'ExpoPushTokenManager'" at import
  and took down the signed-in area. `pushNotifications.ts` now loads the package lazily, only when
  the native module exists, and otherwise reports `unavailable` (one `[push]` warning). Rebuild the
  development build after any native dependency change: `npx expo run:android`.
- **pusher-js's types lie about its React Native export.** The second device run crashed with
  "Object cannot be used as a constructor": the types say `export default Pusher`, the React
  Native bundle does `module.exports.Pusher = Pusher`. Typecheck and `expo export` both passed.
  `resolvePusher.ts` finds the class, a test loads the real bundle, and `socketClient` now never
  throws - any failure is `unavailable` and the 15 s poll takes over.
- **Verified against production (unauthenticated, 2026-09-17):** `wss://app.wazigo.io/app/<key>`
  with the public key answers `pusher:connection_established`, and a private channel without a
  valid signature is refused (4009) - host, port, TLS and key are right; channel auth with a
  bearer token is the part a signed-in device run still has to prove.
- **`expo run:android` does NOT re-apply config plugins to an existing `android/` folder.** The
  local `android/` predates Stage 16, so it has no `google-services` Gradle plugin, no
  `google-services.json` and no notification icon/channel metadata - an FCM token would fail with
  "Default FirebaseApp is not initialized". Regenerate it once: `npx expo prebuild --clean
  --platform android`, then `npx expo run:android`.
- **Unverified contract: the POST /me/devices body.** The route exists; its field names could not
  be read without signing in. The app sends `token`, `platform`, `provider`, `device_name`. On a
  422 a development build logs the field names the server expected (`[push] register failed`).
- Config: `app.json` gained the `expo-notifications` plugin (monochrome icon, brand green,
  default channel `messages`) and `android.googleServicesFile`. `google-services.json` is
  gitignored with the FCM/APNs key files; keep a local copy in the project root.
- Checks: lint, typecheck, **241 tests**, `expo-doctor` 21/21, `expo export --platform android`.
  Device runs so far found the two crashes above (both fixed); live updates and push have not yet
  been seen working on a device.

**To finish push (user actions, need an Expo account):**

1. `npx eas init` - links the project and writes `extra.eas.projectId` into `app.json`.
2. `npx eas credentials` → Android → FCM V1 service account key → upload `wazigo-fcm-key.json`.
3. `npx eas credentials` → iOS → Push Notifications key → upload `AuthKey_8BGC36W5BS.p8`,
   Key ID `8BGC36W5BS`, Team ID `7FU38TU5N4`.
4. `npx expo prebuild --clean --platform android`, then `npx expo run:android` - the clean prebuild
   is what adds Firebase and the notification config to the existing `android/` folder.
5. Server: send through Expo's push API with `data.conversation_id` and `channelId: "messages"`.

### Cleanup and handover (Stage 14)

- **`expo-doctor` 21/21** after taking `expo` 57.0.23 and `expo-image-picker` 57.0.18 (both
  changelogs: no user-facing changes). Every check and both exports were re-run on them.
- `jest`, `jest-expo` and `@types/jest` moved to `devDependencies`.
- **App identity `io.wazigo.app`** for the iOS bundle identifier and the Android package name.
- **[README.md](../README.md)** rewritten for someone new to the repo, including what has *not* been
  verified.
- **[backend-blockers.md](backend-blockers.md)** is the document to hand the server team: each
  blocker with today's behaviour, what the app does about it, what "fixed" looks like and how to
  verify it, plus the values the app is still waiting for.
- Swept for leftovers: no TODOs, no unguarded logging, no `any` or `@ts-ignore`.

### Final verification and dependency audit (Stage 15)

- Every stage was committed and pushed as it finished, so Stage 15 checks the result rather than
  producing it: **a fresh clone of `origin/main` with `npm ci`** passes lint, typecheck, 182 tests,
  `expo-doctor` 21/21 and `expo export` for iOS and Android. What is on GitHub rebuilds from the
  lockfile alone, with no local state (typecheck included — it does not need `npm start` first).
- **`npm audit` reports 14 moderate findings from two root advisories.** No high or critical ones.
  - `decode-uri-component` 0.2.2 (GHSA-vcc3-ghjq-m6fr, CVSS 6.6, availability only) via
    `query-string` 7.1.3 via `expo-router`. This **is** in the app bundle: a deep link with
    crafted malformed percent-encoding could make the JS thread spin. It is a local denial of
    service against the user's own app, with no data exposure. Patched in 0.5.0.
  - `uuid` 7.0.3 (GHSA-w5hq-g745-h8pq) via `xcode` via `@expo/config-plugins`. **Build tooling
    only** (it edits the Xcode project during prebuild); it never ships in the app.
- **Do not run `npm audit fix --force`.** Its "fix" is downgrading to `expo` 46 and `expo-router` 5,
  which would break the whole project. An `overrides` entry forcing `decode-uri-component` 0.5.0
  under `query-string` 7 was not attempted either: it changes the package's module format, and
  whether a deep link still parses could only be proven on a device. The right fix is an Expo SDK 57
  patch that moves `expo-router` off `query-string` 7 — re-check `npm audit` whenever
  `npx expo install --check` offers one.

### First device run, development build and design pass (after Stage 15)

Seven commits, `d12a6bb` … `df61d76`, plus the guard commit `7ee56b4` before them.

**Running it.** Android emulator (`Pixel_9_Pro`, API 36), **development build** installed as
`io.wazigo.app` (`expo-dev-client` 57.0.19, plugin listed in `app.json`). Build once with
`npx expo run:android`; day to day run `npx expo start --dev-client`. Rebuild only after adding or
upgrading a native package or changing native config in `app.json`. `android/` is gitignored and
regenerated. Expo Go is no longer the way to run it: its white loading screen, its extra React
Native host and its lack of push all go away in the development build.

**Local `.env` (gitignored, not in the repo)** currently holds:
- `EXPO_PUBLIC_NETWORK_DEBUG=1` - prints query, request body and response body for every call in
  the Metro terminal. Tokens, passwords, login codes and `Authorization` are redacted; customer
  message content is not. Off unless set; never in release builds (`src/api/debugLog.ts`).

**Read-only guard - REMOVED (2026-09-18).** The guard added in `7ee56b4` is gone from the code,
along with the `READ_ONLY` error code and `EXPO_PUBLIC_READ_ONLY`. The user asked for it twice and
did not want a read-only mode in the app. **There is now nothing between a tap and production:**
every write goes straight out, in development as in release.

What survives is diagnosis, not prevention - two development-only logs that made the accidental
send traceable in the first place:
- `[api:write]` (`src/api/network.ts`) - every non-GET request, with a timestamp and the call stack
  it was issued from.
- `[ui:write]` (`src/utils/devTrace.ts`) - the user action that started it: composer send,
  attachment, retry, template send, conversation actions, contact note.

Both line up with `adb logcat` timestamps, so a write can still be tied back to the tap that caused
it. Neither blocks anything.

**Why the guard exists - the accidental send (unresolved).** On 2026-09-16 at 14:48:50 IST a text
"hi" was sent to +91 90045 83919 (conversation 3, an internal test contact) from the emulator
during what was meant to be read-only inspection. Logcat proves it went through the composer's
Send path (keyboard focus, then a touch 241 ms before the POST). It does **not** prove who typed:
the agent's adb commands never typed or tapped the composer, but touches the agent did not send
were logged throughout the session, and a second attempt at 15:11 (blocked by the guard, whose
`[ui:write]` trace showed `composer send pressed`) came entirely from input the agent did not send.
Other Claude sessions on this project and another dev server (`192.168.1.40:8081`) were active at
the time. Evidence is in logcat captures, not in the repo. If it matters again: run
`adb shell getevent -lt` alongside the app (kernel events = emulator window; injected `adb input`
does not appear there) with the `[ui:write]` / `[api:write]` logs.

**Fixed from the device run (`d12a6bb`).**
- Opening a thread crashed: the live API sends a failed message's `error_detail` as WhatsApp's
  error object `{code, title, message, error_data}` (or a list), not the documented string.
  `messageErrorText()` (`src/features/messages/messageError.ts`) turns any shape into text; every
  render site uses it. `MessageErrorDetail` is typed in `types.ts`.
- Avatars showed "+8" / "+1" for number-only contacts. `getInitials` (`src/utils/initials.ts`)
  uses only words starting with a letter (any script); no name means a neutral contact icon.
- The thread header said "Conversation" without a name. `contactDisplay()`
  (`src/features/conversations/contactDisplay.ts`): name, else formatted number, else
  "Unknown Contact" - used by the header and the list rows.
- A require cycle (`OfflineNotice` -> common barrel -> `Screen` -> `OfflineNotice`); a whole-tree
  scan now finds no runtime cycles.

**Design pass - screens matched to the mockup (`Wazigo_Design.png`, 14 screens).**
- *Splash (1, `ccbf5c1`)*: icon 37.5% / wordmark 58.5% of width, 21 pt tagline, pill-and-dots
  loader at 77% height (Reduce Motion respected), a diagonal Deep Green gradient via React Native's
  `experimental_backgroundImage` (`Gradients.splash` in `colors.ts`, parse-tested).
- *Login (2) and OTP (3) (`3aa1ea0`)*: content in the upper half, no visible field labels (spoken
  instead), short "- or -". OTP: centred title, number on its own line in Deep Green, compact
  centred boxes, **no verify button** (auto-submit when the last digit is in), "Resend in
  **00:28**". Still no Google sign-in and no Terms/Privacy line.
- *Chats (5) (`5f4f8d2`)*: white background, filled grey search (`TextField variant="filled"`),
  selected chip Deep Green with its count ("Mine (6)" - selected chip only, CHAT-01 gives one
  total), grey unselected chips, inset row dividers (`ConversationRowDivider`). Also fixes the chips
  stretching into tall capsules (`ScrollView`'s default `flexGrow: 1`).
- *Dashboard (4) (`1000dee`)*: larger header wordmark, greeting card with a pale watermark and
  👋, compact metric cards, and **Recent Conversations** with "See all": newest 3 of CHAT-01
  `assigned=mine`, held in `dashboard.recent` with its own request (the Chats list cancels its own
  in-flight calls), refreshed with the dashboard, patched by `conversationPatched`. Blocker 1
  applies. The Home background is still the grey page colour (the Chats screen is white) -
  not yet compared.
- Screens 6-14 (thread, templates, sheets, empty/offline/expired/denied states) have **not** been
  compared with the design yet.

**Other fixes.**
- The message box stayed at full height after sending a long message (`df61d76`).
- Redux Toolkit dev checks warn after 150 ms instead of 32 ms (the toast covered the tab bar).

**Seen while testing, not fixed yet.**
- **Image upload returns 500** from production every time (5 attempts, 0.6-1.1 s each); text sends
  return 201. The request matches CHAT-04 (multipart `type=image`, `file` with name and MIME). The
  cause is in the server logs for `POST /api/v1/conversations/3/messages` around 15:40-15:56 IST.
- **Retry copy is wrong after a 5xx**: a failed local message offers "Try sending again" with
  *"This message never reached Wazigo, so it will be sent fresh"*, but after a 500 it did reach the
  server; each retry re-uploads and could duplicate. Proposed: warn about duplicates whenever the
  server responded. Not built.
- Production returned 503 for `/me/bootstrap` for ~20 s at 15:41 IST.
- Three template messages in conversation 3 show "Template message": for those the API returns
  `text_body: null` and no template name or preview; only `delivery_pricing.category` exists.
  Undecided whether to show the category.
- New messages do not appear in an open thread by themselves (no socket, no polling) - reopen the
  thread, or background the app for 30 s.

## 4. Conventions to keep

- Routes live in `src/app/` (Expo Router). **Redux lives in `src/store/`**, not `src/app/store.ts`,
  because every file under `src/app/` is treated as a route.
- Import alias `@/*` → `src/*`.
- No axios / SecureStore / AsyncStorage imports outside their one allowed file (lint error).
- No raw hex colours or font names in screens — use the theme tokens.
- Screens get `ApiError`, never raw axios errors. Status colour is always paired with text/icon.
- Server timestamps are authoritative (ordering, reply window). Display in Asia/Kolkata.
- Never claim a flow was tested on a device unless it was actually run; the user does the testing.
- **Production is live data.** A send, retry, template, upload, resolve/reopen, priority, label or
  take-over from the app reaches real customers on WhatsApp. The agent performs none of these
  without the user's explicit approval of that action; opening a thread with unread messages also
  marks it read (a write). The user tests with test accounts.
- Run the app as the development build, not Expo Go (§3, last section).
- Match the design by measuring the mockup; say what is deliberately different and why (the API
  or phase-1 scope), rather than inventing data the API does not return.
- Commit style: `chore:` / `feat:` / `fix:` / `docs:`, with the `Co-Authored-By: Claude Opus 5`
  trailer. Never force-push `main`.

## 5. Open questions (blocking later stages)

1. ~~**iOS bundle identifier + Android package name**~~ — decided: `io.wazigo.app` for both (Stage 14).
2. ~~**`/broadcasting/auth` URL**~~ — answered: `/api/v1/broadcasting/auth` (Stage 16).
3. ~~**Reverb public app key** and **`tenant_id`**~~ — answered: the login page's `reverb-key`
   meta tag, and `settings.tenant.id` in `/me/bootstrap` (Stage 16).
4. **Terms of Service / Privacy URLs** — design shows the links on Login; omitted until supplied.
5. **OTP length** — backend default 5, deployment-configurable, not exposed by any API. Real logins
   have worked with the default of 5; confirm that is the deployed setting.
6. ~~**Live event names and payload shapes**~~ — answered from the web app (Stage 16). The app
   uses only the conversation id from each event.
7. **Opening a document, playing a video or audio** — images download and display inline, but the
   other types are only named. That needs a dependency nobody has chosen: `expo-sharing` to hand a
   file to the OS, `expo-video` / `expo-audio` to play one. Native, so it must be decided before a
   build, not after. Until then the bubble names the file rather than offering a button that fails.
8. **Push notifications** — app side built in Stage 16 with Expo push tokens; Firebase project,
   `google-services.json`, the FCM service-account key and the APNs key exist. Still open: `eas
   init` + uploading both keys to EAS (user), the exact `POST /me/devices` body (unverified), and
   the server's sends (Expo push API, `data.conversation_id`, only to the assignee).
9. **Template fallback** — show `delivery_pricing.category` next to "Template message", or not.
10. ~~**The read-only guard**~~ — removed 2026-09-18, along with `EXPO_PUBLIC_READ_ONLY`.

## 6. Backend blockers (none fixed — see plan for detail)

1. Personal chat list scope (CHAT-01) 2. Direct thread authorization (CHAT-02)
3. Personal media authorization (CHAT-05) 4. Personal dashboard calculations (DASH-01)
5. Personal Reverb event delivery 6. Reassignment must revoke old access immediately

Client-side filtering is never the fix. For blocker 5 the app joins the number channels but uses
events only as signals to re-query the server (Stage 16, user decision); the payloads still reach
the phone until the server sends personal events.

## 7. Next

Pick up from here, in roughly this order:

1. **Image upload 500s** (§3, "Seen while testing"): get the server log for those requests; confirm
   the app's multipart request with `EXPO_PUBLIC_NETWORK_DEBUG=1` or the DevTools Network tab on
   the development build.
3. **Retry wording after a server error**: warn about possible duplicates whenever the server
   responded, keep "sent fresh" only for failures that never reached it.
4. **Keep matching the design**: Home background (white or not), then screens 6-14 - thread,
   reply-window banners, templates, the conversation and message sheets, and the empty / offline /
   session-expired / access-denied states.
5. **Decide**: template fallback category (question 9) and media viewing (question 7).
6. **Verify Stage 16 on a device**: rebuild the development build, watch Metro for `[socket]` and
   `[push]` warnings, send a WhatsApp message to a test number and confirm the list, dashboard and
   open thread update without pulling; then finish the push steps in §3 Stage 16 and test a
   notification with the app closed, in the background and on the open chat.
7. **Docs**: `development-plan.md` has not been updated for anything after Stage 15; this file is
   the current record.

## 8. Commands

```bash
npx expo run:android            # build + install the development build (after native changes)
npx expo start --dev-client     # daily: Metro for the development build (add -c after .env changes)
npm run lint
npm run typecheck               # app + test tsconfigs
npm test                        # jest (241 tests)
npm run doctor                  # expo-doctor (21/21)
adb logcat -v time | grep ReactNativeJS   # app logs incl. [api], [api:write], [ui:write], [api:debug]
```

`.env` is gitignored; copy `.env.example`. Only `EXPO_PUBLIC_*` values (they ship inside the app -
never secrets). Without `.env` the app uses the production API. Development-only switch:
`EXPO_PUBLIC_NETWORK_DEBUG` (1 = print request and response bodies). Restart Metro with `-c` after
changing `.env`.
