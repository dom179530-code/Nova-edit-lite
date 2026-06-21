# Nova Edit Lite — Android APK Build Guide

There are **two ways** to get the APK:

---

## ⭐ Option 1 — GitHub Actions (Recommended, no local setup)

GitHub Actions builds the APK in the cloud for free — no Java or Android SDK needed on your machine.

### Steps

1. **Push this project to a GitHub repository:**
   ```bash
   git init && git add . && git commit -m "Nova Edit Lite"
   gh repo create nova-edit-lite --public --push
   # (or: git remote add origin <your-repo-url> && git push -u origin main)
   ```

2. **Trigger the build:**
   - Go to your repo on GitHub → **Actions** tab
   - Click **Build Android APK** in the left sidebar
   - Click **Run workflow** → **Run workflow**

3. **Download the APK:**
   - Wait ~5 minutes for the build to finish (green checkmark)
   - Click the completed workflow run
   - Scroll to **Artifacts** → click **nova-edit-lite-debug-apk**

> Every push to `main` also auto-builds a fresh APK.

---

## Option 2 — Build Locally

### Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | 18+ | https://nodejs.org |
| Java JDK | 17+ | https://adoptium.net |
| Android Studio | Latest | https://developer.android.com/studio |

After installing Android Studio, open **SDK Manager** and install:
- Android SDK Platform 35
- Android SDK Build-Tools 35.x
- Android SDK Platform-Tools

Set environment variables (add to `~/.bashrc` or `~/.zshrc`):
```bash
export ANDROID_HOME=$HOME/Android/Sdk        # macOS: $HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### Quick Build (one command)

```bash
cd nova-edit-lite/
npm install
chmod +x scripts/build-android.sh
./scripts/build-android.sh
```

**Output:** `android/app/build/outputs/apk/debug/app-debug.apk`

> First build downloads ~200 MB of Gradle dependencies — takes 5-10 min. Subsequent builds are fast (~30 sec).

### Install on your device

```bash
# Enable USB Debugging on your Android phone, then:
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Release APK (For Play Store / distribution)

```bash
chmod +x scripts/build-release.sh
./scripts/build-release.sh
```

**Output:** `android/app/build/outputs/apk/release/nova-edit-lite-release.apk`

---

## Open in Android Studio

```bash
npx cap open android
```

Use Android Studio to: run on emulator, debug with Chrome DevTools, generate signed bundles.

---

## App Details

| Property | Value |
|----------|-------|
| App ID | `com.novaedit.lite` |
| App Name | Nova Edit Lite |
| Min Android | 6.0 (API 23) |
| Target Android | 15 (API 35) |
| Orientation | Portrait |
| Theme | Full Screen Dark |
| Version | 1.0.0 |

---

## Troubleshooting

**`ANDROID_HOME` not set** → Install Android Studio, open SDK Manager, copy the SDK path shown at the top.

**`JAVA_HOME` not set** → Install JDK 17 from https://adoptium.net and restart your terminal.

**`gradle-wrapper.jar` missing** → The build script auto-downloads it. Or download manually from  
`https://services.gradle.org/distributions/gradle-8.11.1-bin.zip` and copy the JAR.

**Build fails with SDK not found** → Make sure `ANDROID_HOME` points to the correct directory and API 35 is installed.

**App crashes on launch** → Check logcat: `adb logcat | grep com.novaedit.lite`

**File picker doesn't work on Android 13+** → App requests `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` permissions on first use — just tap Allow.
