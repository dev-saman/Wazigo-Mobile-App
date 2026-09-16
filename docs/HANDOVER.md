# Wazigo Mobile App — Handover (end of Stage 3)

Last updated: 2026-09-16. Read this first, then [development-plan.md](development-plan.md)
(endpoint map, design deviations, backend blockers).

## 1. Project facts

| Item | Value |
| --- | --- |
| Project folder | `D:\React Native\Wazigo-Mobile-App` |
| Repo / branch | https://github.com/dev-saman/Wazigo-Mobile-App · `main` (pushed, clean) |
| API base URL | `https://app.wazigo.io/api/v1` |
| API spec (authoritative) | Google Sheet "Wazigo Mobile App — API Reference" — sheets: Start here, Login, Chat, Dashboard, Live updates |
| Expo SDK / RN / React | 57.0.22 / 0.86.3 / 19.2.3 |
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
| 4. Splash + Login (OTP/password) + OTP verification | **next** |
| 5–15 | not started (see plan) |

Checks currently passing: `npm run lint`, `npm run typecheck`, `npm test` (13 tests),
`npx expo-doctor` (21/21), `npx expo export` for iOS + Android.

**No screen has been run on a device or emulator, and no call has been made to the real
backend yet.** All API behaviour so far is verified only against a local mock server.

## 3. What exists

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
- `src/app/index.tsx` currently renders the static brand Splash + a `__DEV__`-only button to
  `/ui-preview` (`src/app/ui-preview.tsx`, a design-system catalogue). **Both are replaced in Stage 4.**

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
  `user`, `sessionExpired`), thunks (`requestLoginOtp`, `signInWithOtp`, `signInWithPassword`,
  `signOut`, `handleSessionExpired`), selectors.
- `src/features/connectivity/` — slice + `useConnectivityMonitor()` (mounted in the root layout).

## 4. Conventions to keep

- Routes live in `src/app/` (Expo Router). **Redux lives in `src/store/`**, not `src/app/store.ts`,
  because every file under `src/app/` is treated as a route.
- Import alias `@/*` → `src/*`.
- No axios / SecureStore / AsyncStorage imports outside their one allowed file (lint error).
- No raw hex colours or font names in screens — use the theme tokens.
- Screens get `ApiError`, never raw axios errors. Status colour is always paired with text/icon.
- Server timestamps are authoritative (ordering, reply window). Display in Asia/Kolkata.
- Never claim a flow was tested on a device; the user does all device testing.
- Commit style: `chore:` / `feat:` / `docs:`, with the `Co-Authored-By: Claude Opus 5` trailer.
  Never force-push `main`.

## 5. Open questions (blocking later stages)

1. **iOS bundle identifier + Android package name** — not set; needed before any native build.
2. **`/broadcasting/auth` URL** — workbook doesn't say whether it is under `/api/v1` or site root (Stage 13).
3. **Reverb public app key** — no mobile config endpoint exists; must come from `EXPO_PUBLIC_REVERB_APP_KEY` (Stage 13).
4. **Terms of Service / Privacy URLs** — design shows the links on Login; omitted until supplied.
5. **OTP length** — backend default 5, deployment-configurable, not exposed by any API. Build the
   input length-configurable (default 5); confirm the live value when testing.

## 6. Backend blockers (none fixed — see plan for detail)

1. Personal chat list scope (CHAT-01) 2. Direct thread authorization (CHAT-02)
3. Personal media authorization (CHAT-05) 4. Personal dashboard calculations (DASH-01)
5. Personal Reverb event delivery 6. Reassignment must revoke old access immediately

Client-side filtering is never the fix. Until the backend is corrected, live updates fall back to
REST refresh (pull-to-refresh + on app foreground).

## 7. Next: Stage 4 (Splash, Login, OTP)

Build with the existing design system and auth thunks — no new network code should be needed.

1. **Routes**: convert `src/app/` to groups — `(auth)/login`, `(auth)/otp`, and an `(app)` group
   for later stages; keep a Splash/gate at `index`. Delete `ui-preview.tsx` and the dev button.
2. **Splash** (`SplashView` already exists): load tokens, refresh if needed, then route to Login or
   the app. Do not hold the splash artificially. Full session restore + `/me/bootstrap` is Stage 5,
   so for now route to Login when there is no token.
3. **Login**: Wazigo wordmark, "Welcome Back" / "Sign in to continue to your business account",
   phone field fixed to `+91` (send `+91XXXXXXXXXX`), two modes — **Continue with OTP**
   (`requestLoginOtp`) and **Sign In** with password (`signInWithPassword`). No Google, no
   registration, no forgot/reset password.
4. **OTP**: "Verify Your Number" + "We've sent a verification code to +91 XXXXX XXXXX on WhatsApp".
   Configurable digit count (default 5), paste support, auto-advance/backspace, auto-submit when
   complete, resend countdown (60 s default, and honour a 429 `retryAfterSeconds`).
   `signInWithOtp` on submit.
5. **Forms**: react-hook-form + zod + `@hookform/resolvers` (installed, not used yet). Put shared
   validation in `src/features/auth/validation.ts`; add a phone helper in `src/utils/phone.ts`
   (normalize to `+91…`, display as `+91 XXXXX XXXXX`).
6. **Errors**: map `ApiError.errors` to field errors; 422 = wrong/expired code or wrong password;
   401 = unusable account; 429 = cooldown. Disable submit while offline.
7. Keyboard avoidance, SafeArea, 44px touch targets, `maxFontSizeMultiplier` already in `AppText`.
8. Finish with `npm run lint && npm run typecheck && npm test && npx expo-doctor`, then commit
   (suggested: `feat: add splash, login and OTP verification`) and push.

Stages 5–15 remain as listed in development-plan.md.

## 8. Commands

```bash
npm start          # expo start (add -c to clear cache)
npm run android    # emulator / device
npm run ios        # macOS or Expo Go
npm run lint
npm run typecheck  # app + test tsconfigs
npm test           # jest (13 tests)
npm run doctor     # expo-doctor
```

`.env` is gitignored; copy `.env.example`. Only `EXPO_PUBLIC_*` values (they ship inside the app —
never secrets). Without `.env` the app uses the production API by default.
