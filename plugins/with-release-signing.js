const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Signs release builds with the Play upload key instead of the debug keystore.
 *
 * The generated `android/app/build.gradle` ships with `release` pointing at
 * `signingConfigs.debug` and a comment telling you to fix it. Fixing it by hand
 * does not survive: android/ is generated and gitignored, so the next
 * `expo prebuild --clean` erases the edit. Hence a plugin.
 *
 * The credentials themselves are NOT here — they are Gradle properties, read
 * from `~/.gradle/gradle.properties`, which is outside the repo and never
 * committed. When those properties are absent (a fresh clone, CI without
 * secrets) the build silently falls back to debug signing, so `assembleRelease`
 * keeps working for anyone who only wants to run the app.
 */

const STORE_FILE = 'WAZIGO_UPLOAD_STORE_FILE';

const RELEASE_SIGNING_CONFIG = `
        release {
            if (project.hasProperty('${STORE_FILE}')) {
                storeFile file(${STORE_FILE})
                storePassword WAZIGO_UPLOAD_STORE_PASSWORD
                keyAlias WAZIGO_UPLOAD_KEY_ALIAS
                keyPassword WAZIGO_UPLOAD_KEY_PASSWORD
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (gradle.includes(STORE_FILE)) return cfg; // already applied

    // Append a `release` entry to the existing `signingConfigs { debug { … } }`.
    const signingConfigs = /(signingConfigs \{[\s\S]*?\n {8}\})/;
    if (!signingConfigs.test(gradle)) {
      throw new Error('with-release-signing: could not find the signingConfigs block');
    }
    gradle = gradle.replace(signingConfigs, `$1${RELEASE_SIGNING_CONFIG}`);

    // Point buildTypes.release at it. Anchored on the template's caution
    // comment so it cannot match the identical line in buildTypes.debug.
    const releaseSigning = /(\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\n {12})signingConfig signingConfigs\.debug/;
    if (!releaseSigning.test(gradle)) {
      throw new Error('with-release-signing: could not find the release signingConfig');
    }
    gradle = gradle.replace(
      releaseSigning,
      `$1signingConfig project.hasProperty('${STORE_FILE}') ? signingConfigs.release : signingConfigs.debug`
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
