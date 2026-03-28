const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "PDFPals",
        icon: path.join(__dirname, 'public', 'assets', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Remove the default Electron menu bar
    Menu.setApplicationMenu(null);

    // Load the index.html from the public folder
    mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));

    // Open DevTools on launch (optional for debugging)
    // mainWindow.webContents.openDevTools()
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
