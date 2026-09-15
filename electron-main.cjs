const { app, BrowserWindow, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');

let updateCheckWindow;

function createUpdateCheckWindow() {
  updateCheckWindow = new BrowserWindow({
    width: 380,
    height: 190,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    show: true,
    title: 'LAS Revision Desk',
    backgroundColor: '#fbfcfa',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  updateCheckWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fbfcfa;color:#203c43;font:14px 'Segoe UI',Arial,sans-serif;display:grid;place-items:center;height:100vh}.panel{text-align:center}.mark{width:42px;height:42px;margin:0 auto 16px;border-radius:8px;background:#176f6b;color:#fff;display:grid;place-items:center;font-weight:700;font-size:20px}.status{font-weight:600}.detail{margin-top:7px;color:#66777b;font-size:12px}</style></head><body><div class="panel"><div class="mark">L</div><div class="status">Checking for updates...</div><div class="detail">Please wait a moment.</div></div></body></html>`)}`);
  return updateCheckWindow;
}

function updateCheckStatus(status, detail) {
  if (!updateCheckWindow || updateCheckWindow.isDestroyed()) return;
  updateCheckWindow.webContents.executeJavaScript(`document.querySelector('.status').textContent = ${JSON.stringify(status)}; document.querySelector('.detail').textContent = ${JSON.stringify(detail)};`).catch(() => {});
}

function closeUpdateCheckWindow() {
  if (updateCheckWindow && !updateCheckWindow.isDestroyed()) updateCheckWindow.close();
  updateCheckWindow = null;
}

async function checkForUpdatesBeforeLaunch() {
  if (!app.isPackaged) return;

  createUpdateCheckWindow();

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => console.log('Checking for LAS Revision Desk updates...'));
  autoUpdater.on('update-available', (info) => {
    console.log(`LAS Revision Desk update available: ${info.version}`);
    updateCheckStatus('Update found', `Downloading version ${info.version}...`);
  });
  autoUpdater.on('update-not-available', (info) => {
    console.log(`LAS Revision Desk is up to date at ${info.version}.`);
    updateCheckStatus('No updates found', 'Starting LAS Revision Desk...');
  });
  autoUpdater.on('error', (error) => console.error('LAS Revision Desk update failed:', error));
  autoUpdater.on('update-downloaded', () => {
    const choice = dialog.showMessageBoxSync({
      type: 'info',
      buttons: ['Restart and install', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'LAS Revision Desk update ready',
      message: 'A new version of LAS Revision Desk has been downloaded.',
      detail: 'Restart the app now to install the update.'
    });

    if (choice === 0) autoUpdater.quitAndInstall();
  });

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error('LAS Revision Desk update check failed:', error);
    updateCheckStatus('Update check unavailable', 'Starting LAS Revision Desk...');
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  closeUpdateCheckWindow();
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(__dirname, 'assets', 'las-logo-icon.png'),
    backgroundColor: '#fbfcfa',
    title: 'LAS Revision Desk',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  checkForUpdatesBeforeLaunch().finally(createWindow);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
