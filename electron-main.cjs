const { app, BrowserWindow, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');

let updateCheckWindow;

function createUpdateCheckWindow() {
  updateCheckWindow = new BrowserWindow({
    width: 360,
    height: 250,
    useContentSize: true,
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

function updateCheckProgress(percent, speed, eta) {
  if (!updateCheckWindow || updateCheckWindow.isDestroyed()) return;
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  updateCheckWindow.webContents.executeJavaScript(`(() => { const root = document.querySelector('.window'); const track = document.querySelector('.progress-track'); const bar = track?.querySelector('span'); const label = document.querySelector('.progress-label'); const stats = document.querySelector('.download-stats'); if (!root || !track || !bar || !label || !stats) return; root.classList.remove('error'); track.classList.remove('indeterminate'); bar.style.width = ${JSON.stringify(`${safePercent.toFixed(1)}%`)}; label.textContent = ${JSON.stringify(`${safePercent.toFixed(1)}% downloaded`)}; stats.textContent = ${JSON.stringify([speed, eta].filter(Boolean).join(' · '))}; })()`).catch(() => {});
}

function updateCheckError() {
  if (!updateCheckWindow || updateCheckWindow.isDestroyed()) return;
  updateCheckWindow.webContents.executeJavaScript(`(() => { const root = document.querySelector('.window'); const track = document.querySelector('.progress-track'); const label = document.querySelector('.progress-label'); const stats = document.querySelector('.download-stats'); if (!root || !track || !label || !stats) return; root.classList.add('error'); track.classList.remove('indeterminate'); track.querySelector('span').style.width = '0'; label.textContent = 'Continuing with the current version'; stats.textContent = ''; })()`).catch(() => {});
}

function closeUpdateCheckWindow() {
  if (updateCheckWindow && !updateCheckWindow.isDestroyed()) updateCheckWindow.close();
  updateCheckWindow = null;
}

function closeUpdateCheckWindowAfterStatus(delay = 700) {
  setTimeout(closeUpdateCheckWindow, delay);
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** unitIndex)).toFixed(unitIndex ? 1 : 0)} ${units[unitIndex]}`;
}

function formatDuration(seconds) {
  const rounded = Math.max(1, Math.round(seconds));
  if (rounded < 60) return `${rounded}s`;
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

async function checkForUpdatesBeforeLaunch() {
  const developmentBuild = !app.isPackaged;
  if (developmentBuild) autoUpdater.forceDevUpdateConfig = true;

  createUpdateCheckWindow();

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = !developmentBuild;
  autoUpdater.on('checking-for-update', () => console.log('Checking for LAS Revision Desk updates...'));
  autoUpdater.on('update-available', (info) => {
    console.log(`LAS Revision Desk update available: ${info.version}`);
    updateCheckStatus('Downloading update', `Downloading version ${info.version}...`);
    updateCheckProgress(0, '', 'Calculating time remaining...');
  });
  autoUpdater.on('download-progress', (progress) => {
    const speed = progress.bytesPerSecond ? `${formatBytes(progress.bytesPerSecond)}/s` : '';
    const remainingBytes = Math.max(0, (progress.total || 0) - (progress.transferred || 0));
    const secondsRemaining = progress.bytesPerSecond ? remainingBytes / progress.bytesPerSecond : 0;
    const eta = secondsRemaining > 0 && Number.isFinite(secondsRemaining) ? `${formatDuration(secondsRemaining)} remaining` : '';
    updateCheckProgress(progress.percent, speed, eta);
  });
  autoUpdater.on('update-not-available', (info) => {
    console.log(`LAS Revision Desk is up to date at ${info.version}.`);
    updateCheckStatus('No updates found', 'Starting LAS Revision Desk...');
    closeUpdateCheckWindowAfterStatus();
  });
  autoUpdater.on('error', (error) => {
    console.error('LAS Revision Desk update failed:', error);
    updateCheckStatus('Update check unavailable', 'We couldn’t check for updates. You can continue using the current version.');
    updateCheckError();
    closeUpdateCheckWindowAfterStatus(1800);
  });
  autoUpdater.on('update-downloaded', () => {
    if (developmentBuild) {
      updateCheckStatus('Update downloaded', 'A development update is ready for the packaged application.');
      closeUpdateCheckWindowAfterStatus(1400);
      return;
    }
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
    updateCheckStatus('Update check unavailable', 'We couldn’t check for updates. You can continue using the current version.');
    updateCheckError();
    closeUpdateCheckWindowAfterStatus(1800);
  }
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
