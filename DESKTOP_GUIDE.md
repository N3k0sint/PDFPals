# 🚀 PDFPals: Desktop Distribution Guide

You can turn your local PDFPals suite into a standalone Windows application (.exe) that you can share with your friends.

## 🛠️ How to Build the Software

1.  **Open your terminal** in the `PDF Scanner` folder.
2.  **Run the build command**:
    ```bash
    npm run build:win
    ```
3.  **Find your files**:
    *   Once finished, a new folder named `dist` will appear.
    *   Inside `dist`, you will find:
        *   **PDFPals Suite Portable.exe**: A single file you can just run (no install needed).
        *   **PDFPals Suite Setup.exe**: An installer you can send to your friends.

## 🌟 Sharing with Friends
Simply send them the **Portable.exe** file. They don't need to install Node.js or anything else—the application is self-contained!

## ⚙️ Development Mode
To test the desktop window without building:
```bash
npm run electron:start
```

---
© 2026 PDFPals | Professional Desktop Utility
