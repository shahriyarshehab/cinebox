# 📱 CineBox Android App (Trusted Web Activity)

This folder contains the complete, production-ready **Android Studio / Gradle** native project for **CineBox**, built using Google's **Trusted Web Activity (TWA)** and `AndroidBrowserHelper`.

---

## 🚀 Features in Android App
- ⚡ **Native Android Shell**: Runs fullscreen with 0ms startup delay using Android Browser Helper.
- 🎨 **Deep System Theming**: Dark status bar (`#07090E`), ambient splash screen, and matching navigation bar.
- 📲 **App Shortcuts**: Quick launcher shortcuts for **TV Shows**, **Movies**, and **Watchlist**.
- 🎬 **Native Player Handlers**: Seamlessly launches external players like **VLC Media Player**, **MX Player**, and download managers via Android Intents.
- 🔔 **Web Push Notifications**: Integrated with `DelegationService` for native notifications.
- 🌐 **Digital Asset Links**: True fullscreen standalone mode without browser URL bars when verified with `.well-known/assetlinks.json`.

---

## 🛠️ How to Build the APK

### Option 1: Using Android Studio (Recommended)
1. Open **Android Studio**.
2. Click **Open** and select the `android` folder in this repository.
3. Wait for Gradle sync to complete.
4. Connect an Android device (or launch an Emulator) and click **Run (▶)**.
5. To generate an APK:
   - Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   - The APK will be generated at `app/build/outputs/apk/debug/app-debug.apk`.

---

### Option 2: Using Bubblewrap CLI (Google Play Store Package)
1. Install Bubblewrap CLI:
   ```bash
   npm install -g @bubblewrap/cli
   ```
2. Build the signed APK / AAB from project root:
   ```bash
   bubblewrap build
   ```

---

### Option 3: Automated Build with GitHub Actions
- A GitHub Actions workflow is included at `.github/workflows/build-android.yml`.
- Every time you push to `main`, GitHub will automatically compile the APK and attach it to the workflow run artifacts for instant 1-click download.

---

## 🔑 Digital Asset Links Setup (Removing the URL Bar)

For Android to run your app in 100% fullscreen mode without the Chrome top address bar, Android requires **Digital Asset Links** verification:

1. Generate your release keystore (if not done yet):
   ```bash
   keytool -genkey -v -keystore cinebox-keystore.jks -alias cinebox -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Extract the **SHA-256 fingerprint**:
   ```bash
   keytool -list -v -keystore cinebox-keystore.jks -alias cinebox
   ```
3. Open `cinebox/.well-known/assetlinks.json` and paste your SHA-256 fingerprint into the `sha256_cert_fingerprints` array.
4. Deploy your changes to GitHub Pages (`https://shahriyarshehab.github.io/cinebox/`).
