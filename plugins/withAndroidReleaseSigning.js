// Expo config plugin: wires the Android release buildType to a real release
// keystore on every `expo prebuild`. The keystore + passwords live OUTSIDE the
// repo (in ~/.gradle/gradle.properties, see README), so `android/` can stay
// gitignored and regenerated without ever losing the signing config.
//
// Properties expected in ~/.gradle/gradle.properties (or any gradle props):
//   BALANCE_UPLOAD_STORE_FILE, BALANCE_UPLOAD_STORE_PASSWORD,
//   BALANCE_UPLOAD_KEY_ALIAS, BALANCE_UPLOAD_KEY_PASSWORD
// When absent (e.g. CI without secrets), release falls back to debug signing.
const { withAppBuildGradle } = require('@expo/config-plugins');

const DEBUG_BLOCK = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
`;

const RELEASE_SIGNING_CONFIG = `        release {
            if (project.hasProperty('BALANCE_UPLOAD_STORE_FILE')) {
                storeFile file(BALANCE_UPLOAD_STORE_FILE)
                storePassword BALANCE_UPLOAD_STORE_PASSWORD
                keyAlias BALANCE_UPLOAD_KEY_ALIAS
                keyPassword BALANCE_UPLOAD_KEY_PASSWORD
            }
        }
`;

const RELEASE_BUILDTYPE_ANCHOR = `            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

const RELEASE_BUILDTYPE_REPLACEMENT = `            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig project.hasProperty('BALANCE_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`;

function applySigning(contents) {
  if (contents.includes('signingConfigs.release')) {
    return contents; // already wired
  }
  if (!contents.includes(DEBUG_BLOCK)) {
    throw new Error('[withAndroidReleaseSigning] debug signingConfig block not found — RN template changed?');
  }
  if (!contents.includes(RELEASE_BUILDTYPE_ANCHOR)) {
    throw new Error('[withAndroidReleaseSigning] release buildType anchor not found — RN template changed?');
  }
  return contents
    .replace(DEBUG_BLOCK, DEBUG_BLOCK + RELEASE_SIGNING_CONFIG)
    .replace(RELEASE_BUILDTYPE_ANCHOR, RELEASE_BUILDTYPE_REPLACEMENT);
}

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('[withAndroidReleaseSigning] app/build.gradle is not groovy');
    }
    cfg.modResults.contents = applySigning(cfg.modResults.contents);
    return cfg;
  });
};
