#!/bin/bash
set -e

echo ""
echo "================================================"
echo "  Nova Edit Lite — Release APK Build Script"
echo "================================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

KEYSTORE="android/nova-edit-lite.keystore"
KEY_ALIAS="nova-edit-lite"

if [ ! -f "$KEYSTORE" ]; then
  echo "[0/5] Generating release keystore (first time only)..."
  keytool -genkey -v \
    -keystore "$KEYSTORE" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass novaeditlite \
    -keypass novaeditlite \
    -dname "CN=Nova Edit Lite, OU=App, O=NovaEdit, L=Unknown, S=Unknown, C=US"
  echo "      Keystore generated at $KEYSTORE"
  echo ""
fi

echo "[1/5] Building web assets for Android..."
npx vite build --config vite.android.config.ts
echo "      Done → dist/android/"
echo ""

echo "[2/5] Syncing Capacitor to Android project..."
npx cap sync android
echo "      Done → android/"
echo ""

echo "[3/5] Setting Gradle wrapper permissions..."
chmod +x android/gradlew
echo "      Done"
echo ""

echo "[4/5] Building release APK..."
cd android
./gradlew assembleRelease --no-daemon
cd ..
echo ""

echo "[5/5] Signing APK..."
UNSIGNED="android/app/build/outputs/apk/release/app-release-unsigned.apk"
SIGNED="android/app/build/outputs/apk/release/nova-edit-lite-release.apk"

if [ -f "$UNSIGNED" ]; then
  jarsigner -verbose \
    -sigalg SHA256withRSA \
    -digestalg SHA-256 \
    -keystore "$KEYSTORE" \
    -storepass novaeditlite \
    -keypass novaeditlite \
    "$UNSIGNED" \
    "$KEY_ALIAS"

  zipalign -v 4 "$UNSIGNED" "$SIGNED"

  echo ""
  echo "================================================"
  echo "  SUCCESS! Signed release APK at:"
  echo "  $SIGNED"
  echo "================================================"
else
  echo "  Release APK at android/app/build/outputs/apk/release/"
fi
echo ""
