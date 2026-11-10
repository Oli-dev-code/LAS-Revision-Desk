const { app, BrowserWindow, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');

let updateCheckWindow;
let updateActionHandler;
let periodicUpdateTimer;
let periodicUpdateCheckInProgress = false;
let lastNotifiedUpdateVersion;
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

function createUpdateCheckWindow() {
  updateCheckWindow = new BrowserWindow({
    width: 360,
    height: 300,
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
  updateCheckWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('las-revision://')) return;
    event.preventDefault();
    updateCheckWindow.webContents.emit('update-action', url.replace('las-revision://', ''));
  });
  updateCheckWindow.webContents.on('update-action', (action) => updateActionHandler?.(action));
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

function showUpdateReady(version) {
  if (!updateCheckWindow || updateCheckWindow.isDestroyed()) return;
  updateCheckWindow.webContents.executeJavaScript(`(() => { const root = document.querySelector('.window'); const track = document.querySelector('.progress-track'); const label = document.querySelector('.progress-label'); const stats = document.querySelector('.download-stats'); const actions = document.querySelector('.ready-actions'); if (!root || !track || !label || !stats || !actions) return; root.classList.remove('error'); document.querySelector('.status').textContent = 'Update ready to install'; document.querySelector('.detail').textContent = ${JSON.stringify(`Version ${version} has been downloaded.`)}; track.classList.remove('indeterminate'); track.querySelector('span').style.width = '100%'; label.textContent = 'Download complete'; stats.textContent = ''; actions.hidden = false; })()`).catch(() => {});
}

function notifyUpdateReady(version) {
  if (!version || version === lastNotifiedUpdateVersion || !Notification.isSupported()) return;
  lastNotifiedUpdateVersion = version;
  const notification = new Notification({
    title: 'LAS Revision Desk update ready',
    body: `Version ${version} has been downloaded. Restart to install it.`,
    icon: path.join(__dirname, 'assets', 'las-logo-icon.png')
  });
  notification.on('click', () => {
    if (!updateCheckWindow || updateCheckWindow.isDestroyed()) createUpdateCheckWindow();
    updateCheckWindow.show();
    updateCheckWindow.focus();
  });
  notification.show();
}

function closeUpdateCheckWindow() {
  if (updateCheckWindow && !updateCheckWindow.isDestroyed()) updateCheckWindow.close();
  updateCheckWindow = null;
}

function closeUpdateCheckWindowAfterStatus(delay = 700) {
  setTimeout(closeUpdateCheckWindow, delay);
}

function startPeriodicUpdateChecks() {
  if (periodicUpdateTimer) clearInterval(periodicUpdateTimer);
  periodicUpdateTimer = setInterval(async () => {
    if (periodicUpdateCheckInProgress || !app.isReady()) return;
    periodicUpdateCheckInProgress = true;
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('LAS Revision Desk periodic update check failed:', error);
    } finally {
      periodicUpdateCheckInProgress = false;
    }
  }, UPDATE_CHECK_INTERVAL_MS);
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
  let resolveStartup;
  let startupResolved = false;
  let openMainWindow = true;
  const waitForUpdateFlow = new Promise((resolve) => { resolveStartup = resolve; });
  const finishUpdateFlow = (delay = 0) => {
    if (startupResolved) return;
    startupResolved = true;
    setTimeout(resolveStartup, delay);
  };

  createUpdateCheckWindow();

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = !developmentBuild;
  updateActionHandler = (action) => {
    if (action === 'restart') {
      openMainWindow = false;
      autoUpdater.quitAndInstall();
    }
    if (action === 'later') {
      closeUpdateCheckWindow();
      finishUpdateFlow();
    }
  };
  autoUpdater.on('checking-for-update', () => console.log('Checking for LAS Revision Desk updates...'));
  autoUpdater.on('update-available', (info) => {
    console.log(`LAS Revision Desk update available: ${info.version}`);
    if (!updateCheckWindow || updateCheckWindow.isDestroyed()) createUpdateCheckWindow();
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
    finishUpdateFlow(700);
  });
  autoUpdater.on('error', (error) => {
    console.error('LAS Revision Desk update failed:', error);
    updateCheckStatus('Update check unavailable', 'We couldn’t check for updates. You can continue using the current version.');
    updateCheckError();
    closeUpdateCheckWindowAfterStatus(1800);
    finishUpdateFlow(1800);
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (developmentBuild) {
      updateCheckStatus('Update downloaded', 'A development update is ready for the packaged application.');
      closeUpdateCheckWindowAfterStatus(1400);
      finishUpdateFlow(1400);
      return;
    }
    const version = info?.version || 'the latest version';
    showUpdateReady(version);
    notifyUpdateReady(version);
  });

  try {
    await autoUpdater.checkForUpdates();
    await waitForUpdateFlow;
  } catch (error) {
    console.error('LAS Revision Desk update check failed:', error);
    updateCheckStatus('Update check unavailable', 'We couldn’t check for updates. You can continue using the current version.');
    updateCheckError();
    closeUpdateCheckWindowAfterStatus(1800);
    finishUpdateFlow(1800);
    await waitForUpdateFlow;
  }
  startPeriodicUpdateChecks();
  return openMainWindow;
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

  window.maximize();
  window.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  checkForUpdatesBeforeLaunch().then((openMainWindow) => {
    if (openMainWindow) createWindow();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
