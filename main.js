const { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Apply flags BEFORE app is ready
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let mainWindow;
let overlayWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 700,
    minWidth: 800,
    minHeight: 580,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0c10',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      backgroundThrottling: false,
    }
  });

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });
  mainWindow.webContents.session.setPermissionCheckHandler(() => true);

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 220,
    height: 220,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    type: process.platform === 'win32' ? 'toolbar' : 'panel',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      backgroundThrottling: false,
      offscreen: false,
    }
  });

  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setContentProtection(false);
  overlayWindow.webContents.setBackgroundThrottling(false);

  overlayWindow.on('blur', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  overlayWindow.on('show', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('recheck-cam');
    }
  });
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('camera');
    systemPreferences.askForMediaAccess('microphone');
  }
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 300, height: 200 }
  });
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL()
  }));
});

ipcMain.handle('save-file', async (event, { buffer, filename }) => {
  const dir = path.join(os.homedir(), 'Videos', 'VideoRec');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, Buffer.from(buffer));
  return filepath;
});

ipcMain.handle('save-screenshot', async (event, { buffer, filename }) => {
  const dir = path.join(os.homedir(), 'Pictures', 'VideoRec');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, Buffer.from(buffer));
  return filepath;
});

ipcMain.handle('open-folder', async (event, filepath) => {
  shell.showItemInFolder(filepath);
});

// FIX: Relay rec-state-update from main window to overlay window
ipcMain.on('rec-state-update', (event, isRecording) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('rec-state', isRecording);
  }
});

// FIX: Relay overlay appearance settings to overlay window
ipcMain.on('update-overlay-shape', (event, shape) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('set-shape', shape);
  }
});

ipcMain.on('update-ring-color', (event, color) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('set-ring-color', color);
  }
});

ipcMain.on('show-overlay', () => {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow();
  } else {
    overlayWindow.show();
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.webContents.send('recheck-cam');
  }
});

ipcMain.on('hide-overlay', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }
});

ipcMain.on('resize-overlay', (event, { w, h }) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setSize(w, h);
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  }
});

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
  mainWindow.close();
});
