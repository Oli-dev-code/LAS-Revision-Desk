const { app, BrowserWindow, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');

function startAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => console.log('Checking for LAS Revision Desk updates...'));
  autoUpdater.on('update-available', (info) => console.log(`LAS Revision Desk update available: ${info.version}`));
  autoUpdater.on('update-not-available', (info) => console.log(`LAS Revision Desk is up to date at ${info.version}.`));
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

  autoUpdater.checkForUpdatesAndNotify();
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
  createWindow();
  setTimeout(startAutoUpdater, 5000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
