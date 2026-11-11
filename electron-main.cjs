const { app, BrowserWindow, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

let updateCheckWindow;
let updateActionHandler;
let periodicUpdateTimer;
let periodicUpdateCheckInProgress = false;
let manualUpdateCheckInProgress = false;
let lastNotifiedUpdateVersion;
let appServer;
let appUrl;
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function startLocalAppServer() {
  const root = path.resolve(__dirname);
  appServer = http.createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(requestUrl.pathname);
      const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
      const filePath = path.resolve(root, relativePath);
      const relativeToRoot = path.relative(root, filePath);
      if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
        response.writeHead(403);
        response.end();
        return;
      }
      const file = await fs.promises.readFile(filePath);
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
      });
      if (request.method === 'HEAD') response.end();
      else response.end(file);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
  return new Promise((resolve, reject) => {
    appServer.once('error', reject);
    appServer.listen(0, '127.0.0.1', () => {
      const address = appServer.address();
      resolve(`http://127.0.0.1:${address.port}/index.html`);
    });
  });
}

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
  updateCheckWindow.webContents.executeJavaScript(`window.updateCheckUi?.setStatus(${JSON.stringify(status)}, ${JSON.stringify(detail)})`).catch(() => {});
}

function updateCheckProgress(percent, speed, eta) {
  if (!updateCheckWindow || updateCheckWindow.isDestroyed()) return;
  updateCheckWindow.webContents.executeJavaScript(`window.updateCheckUi?.setProgress(${JSON.stringify(percent)}, ${JSON.stringify(speed)}, ${JSON.stringify(eta)})`).catch(() => {});
}

function updateCheckError() {
  if (!updateCheckWindow || updateCheckWindow.isDestroyed()) return;
  updateCheckWindow.webContents.executeJavaScript('window.updateCheckUi?.showError()').catch(() => {});
}

function showUpdateReady(version) {
  if (!updateCheckWindow || updateCheckWindow.isDestroyed()) return;
  updateCheckWindow.webContents.executeJavaScript(`window.updateCheckUi?.showReady(${JSON.stringify(version)})`).catch(() => {});
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
    if (action === 'check' && !manualUpdateCheckInProgress) {
      manualUpdateCheckInProgress = true;
      updateCheckWindow?.webContents.executeJavaScript('window.updateCheckUi?.showChecking()').catch(() => {});
      updateCheckStatus('Checking for updates...', 'Looking for a newer version...');
      autoUpdater.checkForUpdates().catch((error) => {
        manualUpdateCheckInProgress = false;
        console.error('LAS Revision Desk manual update check failed:', error);
        updateCheckStatus('Update check unavailable', "We couldn't check for updates. Please try again.");
        updateCheckError();
      });
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
    if (manualUpdateCheckInProgress) {
      manualUpdateCheckInProgress = false;
      updateCheckStatus('You’re up to date', `You’re using version ${info.version}.`);
      updateCheckWindow?.webContents.executeJavaScript('window.updateCheckUi?.showCheckComplete()').catch(() => {});
      return;
    }
    updateCheckStatus('No updates found', 'Starting LAS Revision Desk...');
    closeUpdateCheckWindowAfterStatus();
    finishUpdateFlow(700);
  });
  autoUpdater.on('error', (error) => {
    console.error('LAS Revision Desk update failed:', error);
    if (manualUpdateCheckInProgress) {
      manualUpdateCheckInProgress = false;
      updateCheckStatus('Update check unavailable', "We couldn't check for updates. Please try again.");
      updateCheckError();
      return;
    }
    updateCheckStatus('Update check unavailable', "We couldn't check for updates. You can continue using the current version.");
    updateCheckError();
    closeUpdateCheckWindowAfterStatus(1800);
    finishUpdateFlow(1800);
  });
  autoUpdater.on('update-downloaded', (info) => {
    manualUpdateCheckInProgress = false;
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
    updateCheckStatus('Update check unavailable', "We couldn't check for updates. You can continue using the current version.");
    updateCheckError();
    closeUpdateCheckWindowAfterStatus(1800);
    finishUpdateFlow(1800);
    await waitForUpdateFlow;
  }
  startPeriodicUpdateChecks();
  return openMainWindow;
}

function createWindow(appUrl) {
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
  window.loadURL(appUrl);
}

app.whenReady().then(() => {
  checkForUpdatesBeforeLaunch().then((openMainWindow) => {
    if (!openMainWindow) return;
    startLocalAppServer().then((url) => {
      appUrl = url;
      createWindow(appUrl);
    }).catch((error) => {
      console.error('LAS Revision Desk local app server failed:', error);
      app.quit();
    });
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && appUrl) createWindow(appUrl);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  appServer?.close();
});
