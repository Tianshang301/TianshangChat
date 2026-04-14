const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage, shell, session } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let tray = null;
let isQuitting = false;

app.commandLine.appendSwitch('no-proxy-server');
app.commandLine.appendSwitch('disable-web-security');

function createWindow() {
  console.log('Creating main window...');
  console.log('Is packaged:', app.isPackaged);
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });

  if (app.isPackaged) {
    const indexPath = path.join(process.resourcesPath, 'dist', 'index.html');
    console.log('Loading production file:', indexPath);
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Load error:', err);
    });
  } else {
    console.log('Loading dev server: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173').catch(err => {
      console.error('Load error:', err);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', (event, code, msg) => {
    console.error('Failed to load:', code, msg);
  });
}

function createTray() {
  try {
    tray = new Tray(nativeImage.createEmpty());
    
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
    ]);
    
    tray.setToolTip('TianshangChat');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => mainWindow?.show());
  } catch (err) {
    console.error('Tray error:', err);
  }
}

function setupAutoUpdater() {
  if (isDev) return;
  
  autoUpdater.logger = console;
  autoUpdater.autoDownload = false;
  
  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    if (Notification.isSupported()) {
      new Notification({ title: 'TianshangChat', body: `Update ${info.version} available` }).show();
    }
  });
  
  autoUpdater.on('error', (err) => {
    console.log('Updater error (ignored):', err.message);
  });
  
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 5000);
}

app.whenReady().then(() => {
  console.log('App ready');
  createWindow();
  if (!isDev) createTray();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
});

ipcMain.handle('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

ipcMain.handle('get-platform', () => process.platform);
ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('minimize-to-tray', () => { mainWindow?.hide(); });
ipcMain.handle('quit-app', () => { isQuitting = true; app.quit(); });
