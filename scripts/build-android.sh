#!/bin/bash
set -e

echo ""
echo "================================================"
echo "  Nova Edit Lite — Android APK Build Script"
echo "================================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# ── 0. Prerequisites check ──────────────────────────────────────────────────
echo "[0/5] Checking prerequisites..."
if ! command -v java &>/dev/null; then
  echo "  ERROR: Java not found. Install JDK 17+: https://adoptium.net"
  exit 1
fi
JAVA_VER=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d. -f1)
if [ "$JAVA_VER" -lt 17 ] 2>/dev/null; then
  echo "  ERROR: Java 17+ required. Found Java $JAVA_VER"
  exit 1
fi
echo "      Java: $(java -version 2>&1 | head -1)"

if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
  echo "  ERROR: ANDROID_HOME not set."
  echo "  Install Android Studio → https://developer.android.com/studio"
  echo "  Then: export ANDROID_HOME=\$HOME/Library/Android/sdk  (macOS)"
  echo "        export ANDROID_HOME=\$HOME/Android/Sdk          (Linux)"
  exit 1
fi
ANDROID_HOME=${ANDROID_HOME:-$ANDROID_SDK_ROOT}
echo "      Android SDK: $ANDROID_HOME"
echo ""

# ── 1. Web assets ────────────────────────────────────────────────────────────
echo "[1/5] Building web assets for Android..."
PORT=3000 BASE_PATH="/" npx vite build --config vite.android.config.ts
echo "      Done → dist/android/"
echo ""

# ── 2. Gradle wrapper JAR ────────────────────────────────────────────────────
if [ ! -f "android/gradle/wrapper/gradle-wrapper.jar" ] || \
   [ "$(wc -c < android/gradle/wrapper/gradle-wrapper.jar)" -lt 50000 ]; then
  echo "[2/5] Downloading Gradle wrapper JAR..."
  GRADLE_VER="8.11.1"
  WRAPPER_URL="https://services.gradle.org/distributions/gradle-${GRADLE_VER}-bin.zip"
  TMP_GRADLE="/tmp/gradle-${GRADLE_VER}.zip"
  if [ ! -f "$TMP_GRADLE" ]; then
    curl -sL "$WRAPPER_URL" -o "$TMP_GRADLE"
  fi
  TMP_EXTRACT="/tmp/gradle-${GRADLE_VER}-extract"
  rm -rf "$TMP_EXTRACT" && mkdir -p "$TMP_EXTRACT"
  unzip -q "$TMP_GRADLE" -d "$TMP_EXTRACT"
  WRAPPER_SRC=$(find "$TMP_EXTRACT" -name "gradle-wrapper.jar" | head -1)
  cp "$WRAPPER_SRC" android/gradle/wrapper/gradle-wrapper.jar
  echo "      Done"
else
  echo "[2/5] Gradle wrapper JAR present — skipping download"
fi
echo ""

# ── 3. Capacitor sync ────────────────────────────────────────────────────────
echo "[3/5] Syncing Capacitor assets to Android project..."
npx cap copy android 2>&1 | grep -v "^$" || true
echo "      Done"
echo ""

# ── 4. Gradle permissions ────────────────────────────────────────────────────
echo "[4/5] Setting Gradle wrapper permissions..."
chmod +x android/gradlew
echo "      Done"
echo ""

# ── 5. Build APK ─────────────────────────────────────────────────────────────
echo "[5/5] Building debug APK (first run downloads ~200MB of dependencies)..."
echo "      This may take 5-10 minutes on first build..."
cd android
ANDROID_HOME="$ANDROID_HOME" ./gradlew assembleDebug --no-daemon \
  --stacktrace 2>&1 | grep -E "BUILD|FAILED|ERROR|error:|Downloading|Download" || true
cd ..
echo ""

APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
  echo "================================================"
  echo "  ✅ SUCCESS!"
  echo "  APK: $PROJECT_DIR/$APK_PATH"
  echo "  Size: $(du -sh "$APK_PATH" | cut -f1)"
  echo "================================================"
  echo ""
  echo "Install on a connected Android device (USB debugging on):"
  echo "  adb install $APK_PATH"
  echo ""
  echo "Or copy the APK to your phone and open it to install."
else
  echo "================================================"
  echo "  ❌ APK not found at expected path."
  echo "  Check android/app/build/outputs/apk/ for output."
  echo "================================================"
  exit 1
fi
