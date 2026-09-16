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
};

const restrictImports = (...paths) => ({ 'no-restricted-imports': ['error', { paths }] });

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: restrictImports(
      restricted.axios,
      restricted.secureStore,
      restricted.asyncStorage,
      restricted.fileSystem,
    ),
  },
  {
    files: ['src/api/network.ts'],
    rules: restrictImports(restricted.secureStore, restricted.asyncStorage, restricted.fileSystem),
  },
  {
    files: ['src/services/media/mediaCache.ts'],
    rules: restrictImports(restricted.axios, restricted.secureStore, restricted.asyncStorage),
  },
  {
    files: ['src/services/storage/tokenStorage.ts'],
    rules: restrictImports(restricted.axios, restricted.asyncStorage, restricted.fileSystem),
  },
  {
    files: ['src/services/storage/appStorage.ts'],
    rules: restrictImports(restricted.axios, restricted.secureStore, restricted.fileSystem),
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
