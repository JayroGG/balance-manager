#!/usr/bin/env bash
set -e

ENV_NAME="$1"
SRC_ENV_FILE=".env.${ENV_NAME}"

if [[ -z "${ENV_NAME}" ]]; then
  echo "✖  Usage: $0 <dev|stage|prod>"
  exit 1
fi

if [[ ! -f "${SRC_ENV_FILE}" ]]; then
  echo "✖  No such file: ${SRC_ENV_FILE}"
  exit 1
fi

# Expo (managed/CNG) reads .env.${APP_ENV} via app.config.js → expo-constants.
# No .env copy needed; the bundler picks up APP_ENV at build time.
export APP_ENV="${ENV_NAME}"

echo "↪ APP_ENV=${APP_ENV} — Building Android APK (assembleRelease)…"
# Native assets (icon, splash) are baked into android/ at prebuild time. After changing them
# (or app.config.js/plugins), regenerate manually: npx expo prebuild --platform android --clean
# (signing survives --clean via the withAndroidReleaseSigning plugin + ~/.gradle creds).
# NOTE: prebuild rewrites the npm android/ios scripts to `expo run:*` — revert that; dev stays Expo Go.
if [[ ! -d android ]]; then
  npx expo prebuild --platform android
fi
cd android
./gradlew assembleRelease
