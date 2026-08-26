# 📱 CineBox Android Native App (Standalone Fullscreen)

This directory contains the **Standalone Fullscreen Native Android Application** for **CineBox**, built with Android SDK, Hardware-Accelerated WebView, and custom HTML5 video fullscreen controller.

---

## ✨ Features
- 🚀 **100% Standalone (No Chrome Dependency)**: Completely removes browser UI, address bars, and Chrome Custom Tabs.
- 📺 **Full-Screen Immersive Video Player**: Native `WebChromeClient` automatically rotates to landscape orientation on video fullscreen and hides status/navigation bars.
- ⚡ **Hardware Acceleration**: 60fps smooth scrolling, instant media buffering, and 0ms startup lag.
- 📥 **Integrated High-Speed Downloader**: Native `DownloadManager` integration for 1-tap background movie/episode downloads.
- 🔄 **Pull-to-Refresh**: Native `SwipeRefreshLayout` with custom CineBox cyan glow styling.
- 🎨 **Deep OLED Dark Theming**: Edge-to-edge system navigation and status bar (`#07090E`).
- 📶 **Offline Fallback Screen**: Graceful retry screen when disconnected from Wi-Fi / mobile data.

---

## 🛠️ How to Build the APK

### Method 1: 1-Click Local Build Script (Windows)
Double-click [`build_apk.bat`](file:///C:/Users/Shahriyar%20Shehab/Desktop/cinebox/build_apk.bat) in the root folder.
It automatically locates Java 17 and Android SDK, compiles the project, and outputs `cinebox.apk` in the root folder.

---

### Method 2: Using Command Line
```powershell
cd android
.\gradlew.bat assembleDebug
```
Output APK is located at:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

### Method 3: Automated Build via GitHub Actions
Every push to `main` automatically triggers `.github/workflows/build-android.yml`, which compiles the APK and attaches it to GitHub Releases for direct 1-click download.
