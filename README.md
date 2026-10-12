# Nexity Mobile (React Native)

Bare React Native 0.87 (TypeScript, New Architecture, Hermes) configured for **physical Android devices over USB only**. No emulator, no Android Studio required.

## Project structure

```
src/
  app/App.tsx              Root component (providers)
  config/env.ts            API URL per build type (dev = localhost via adb reverse)
  navigation/              React Navigation stack + typed routes
  screens/                 Screens
  services/api/            Axios client + API calls
  theme/                   Colors, spacing
scripts/setup-android-sdk.ps1   Minimal SDK installer (no emulator)
android/                   Native Android project
```

Imports use the `@/` alias, e.g. `import { env } from '@/config/env'`.

## Documentation

Specs for every screen and endpoint live in the backend repo: `../backend/documentation/` (start with `INDEX.md`). Premium features (Secret Messages, Secret Crush, plans and store billing) are in `../backend/documentation/modules/premium/`, with security rules in `../backend/documentation/architecture/SECRET_FEATURES_SECURITY.md`.

## One-time machine setup

1. Node.js >= 22.11
2. JDK 17: `winget install --id Microsoft.OpenJDK.17 -e`
3. Android SDK (adb, platform, build-tools, NDK, CMake): `npm run setup:android`
4. Open a **new** terminal and verify: `java -version`, `adb version`

## Phone setup (one time)

1. Settings > About phone > tap **Build number** 7 times (enables Developer options)
2. Settings > Developer options > enable **USB debugging** (on Xiaomi/Redmi/POCO also enable **Install via USB** and **USB debugging (Security settings)**)
3. Connect via USB, set USB mode to **File transfer**, accept the **Allow USB debugging** prompt
4. `npm run devices` must show your device as `device` (not `unauthorized`)

## Daily development

```powershell
npm install                 # install dependencies
npm run devices             # confirm phone is connected
npm start                   # terminal 1: Metro bundler
npm run android             # terminal 2: build, install and launch on the phone
npm run reverse             # after every reconnect: maps phone localhost:8081/4000 to PC
```

Shake the phone (or `adb shell input keyevent 82`) to open the Dev Menu. Press `r` in the Metro terminal to reload.

## Builds

| Command | Output |
| --- | --- |
| `npm run apk:debug` | `android/app/build/outputs/apk/debug/app-debug.apk` (needs Metro running) |
| `npm run apk:release` | `android/app/build/outputs/apk/release/app-release.apk` (standalone) |
| `npm run aab:release` | `android/app/build/outputs/bundle/release/app-release.aab` (Play Store) |
| `npm run install:debug` / `npm run install:release` | Installs the APK on the connected phone |
| `npm run android:release` | Builds, installs and launches the release build |

## Release signing

Without a keystore, release builds are signed with the debug key (fine for testing, rejected by Play Store).

```powershell
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore nexity-upload.keystore -alias nexity-upload -keyalg RSA -keysize 2048 -validity 10000
cd ..
copy keystore.properties.example keystore.properties   # then fill in passwords
```

`keystore.properties` and `*.keystore` are git-ignored. Back up the keystore securely: losing it means you cannot update the app on Play Store. In CI, set the same `NEXITY_UPLOAD_*` keys as environment variables.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `unauthorized` in `adb devices` | Unlock phone, accept prompt; else `adb kill-server` then `adb start-server` |
| No device listed | Use a data cable, USB mode File transfer, try another port |
| Red screen "Unable to load script" | `npm start` running? `npm run reverse` |
| App can't reach backend | Backend running on port 4000? `npm run reverse` |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | `npm run uninstall` (signature changed between debug/release) |
| Strange build errors | `npm run clean:android`, then `npm run start:reset` |
| Logs | `npm run logcat` |
