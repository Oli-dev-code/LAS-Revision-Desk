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
    show: false,
    autoHideMenuBar: true,
    title: 'LAS Revision Desk',
    backgroundColor: '#fbfcfa',
    icon: path.join(__dirname, 'assets', 'las-logo-icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  updateCheckWindow.setMenuBarVisibility(false);
  updateCheckWindow.once('ready-to-show', () => updateCheckWindow.show());
  updateCheckWindow.loadFile(path.join(__dirname, 'update-check.html'));
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
