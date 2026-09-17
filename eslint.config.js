// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const restricted = {
  axios: { name: 'axios', message: 'Only src/api/network.ts may import axios. Use functions from src/api/apis.ts.' },
  secureStore: {
    name: 'expo-secure-store',
    message: 'Use src/services/storage/tokenStorage.ts for credentials.',
  },
  asyncStorage: {
    name: '@react-native-async-storage/async-storage',
    message: 'Use src/services/storage/appStorage.ts (non-sensitive data only).',
  },
  fileSystem: {
    name: 'expo-file-system',
    message: 'Use src/services/media/mediaCache.ts so downloads stay authenticated and cached.',
  },
  pusher: {
    name: 'pusher-js/react-native',
    message: 'Only src/services/socket/socketClient.ts may use the socket client; screens get live signals.',
  },
  pusherRoot: {
    name: 'pusher-js',
    message: 'Only src/services/socket/socketClient.ts may use the socket client; screens get live signals.',
  },
  notifications: {
    name: 'expo-notifications',
    message: 'Use src/services/push/pushNotifications.ts.',
  },
};

const everyRestriction = Object.values(restricted);
const allExcept = (...allowed) => everyRestriction.filter((path) => !allowed.includes(path));

const restrictImports = (...paths) => ({ 'no-restricted-imports': ['error', { paths }] });

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: restrictImports(...everyRestriction),
  },
  {
    files: ['src/api/network.ts'],
    rules: restrictImports(...allExcept(restricted.axios)),
  },
  {
    files: ['src/services/media/mediaCache.ts'],
    rules: restrictImports(...allExcept(restricted.fileSystem)),
  },
  {
    files: ['src/services/storage/tokenStorage.ts'],
    rules: restrictImports(...allExcept(restricted.secureStore)),
  },
  {
    files: ['src/services/storage/appStorage.ts'],
    rules: restrictImports(...allExcept(restricted.asyncStorage)),
  },
  {
    files: ['src/services/socket/socketClient.ts'],
    rules: restrictImports(...allExcept(restricted.pusher, restricted.pusherRoot)),
  },
  {
    files: ['src/services/push/pushNotifications.ts'],
    rules: restrictImports(...allExcept(restricted.notifications)),
  },
  {
    // Tests mock native modules and load isolated module graphs.
    files: ['**/__tests__/**/*.{ts,tsx}'],
    languageOptions: { globals: { jest: 'readonly', describe: 'readonly', it: 'readonly', expect: 'readonly', beforeAll: 'readonly', beforeEach: 'readonly', afterAll: 'readonly' } },
    rules: {
      'no-restricted-imports': 'off',
      'import/first': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
