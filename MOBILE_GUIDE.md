# 📱 PDFPals Mobile Deployment Guide

PDFPals is built using **Capacitor**, which means you can easily turn this web suite into a native **Android** or **iOS** app for you and your friends!

---

## 🛠️ Prerequisites
*   **Node.js** installed on your computer.
*   **Android Studio** (for Android) or **Xcode** (for Mac/iOS).
*   **Capacitor CLI**: Already included in your `package.json`.

> [!IMPORTANT]
> **ALWAYS** run these commands from the main folder (`D:\AntiGrav\PDF Scanner`), **NOT** from inside the `android` folder.

## 🤖 Building for Android (.APK)

Follow these steps to generate an app for your Android phone:

### 1. Sync the Files
This command copies your latest tool fixes (from the `public` folder) into the Android project.
```bash
npx cap sync android
```

### 2. Open in Android Studio
Launch Android Studio and open the `android/` folder in this project.
```bash
npx cap open android
```

### 3. Generate the APK
*   **Step A (Wait for Sync)**: Look at the top right. If you see a **"Sync Project with Gradle Files"** (Elepant icon 🐘) spinning, wait for it to finish.
*   **Step C (Fix Connection Error)**: If you saw a "Web page not available" or "Connection Refused" error:
    1.  Go to the top menu: **Build** > **Clean Project**.
    2.  Then do **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)** again.
*   **Step D (Locate)**: Once finished, a small bubble will appear at the bottom right. Click **"locate"** to find your `app-debug.apk`.

### 4. Install on Phone
*   Send the `.apk` file to your phone (via USB, Telegram, or Drive).
*   Open the file on your phone to install **PDFPals Mobile**!

---

## 🍎 Building for iOS (iPhone)
*(Requires a Mac with Xcode)*
1.  Add the iOS platform: `npx cap add ios`
2.  Sync: `npx cap sync ios`
3.  Open in Xcode: `npx cap open ios`
4.  Select your iPhone and click **Play** (Build).

---

## 💡 Pro-Tips for Mobile
*   **Camera Access**: The **CamScanner** tool will automatically request camera permissions the first time you use it.
*   **Privacy**: Just like the desktop version, the mobile app processes everything locally on your phone. No data is sent to any server.

---

## 🆘 Troubleshooting: "Permission Denied / EPERM"
If you see an `EPERM` error when syncing:
1.  **Close Android Studio** completely.
2.  **Close any File Explorer windows** that are open to the `android` folder.
3.  Run `npx cap sync android` again.

### 🛡️ The "Nuclear Option" (If it's still stuck)
If the error persists, your `android` folder might be corrupted. You can safely delete it and start fresh:
1.  Delete the `android/` folder manually.
2.  Run: `npx cap add android`
3.  Run: `npx cap sync android`
4.  Run: `npx cap open android`

---
🏆 **Now you can carry PDFPals in your pocket!** 🚀✨
