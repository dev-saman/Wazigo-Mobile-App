# Wazigo Mobile App

iOS and Android app for Wazigo business messaging, built with Expo (SDK 57), React Native and TypeScript on top of the Wazigo Laravel API.

> The full README (architecture, auth flow, testing guide, backend blockers) will be written in Stage 14.
> The current plan and API findings are in [docs/development-plan.md](docs/development-plan.md).

## Quick start

```bash
npm install
cp .env.example .env
npm start
```

| Script | Purpose |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run android` | Start and open on Android |
| `npm run ios` | Start and open on iOS (macOS / Expo Go) |
| `npm run lint` | ESLint (eslint-config-expo) |
| `npm run typecheck` | TypeScript check |
| `npm run doctor` | Expo Doctor |
| `npm test` | Jest (network layer + session handling) |
