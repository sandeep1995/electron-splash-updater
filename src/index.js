const electron = require('electron');
const { EventEmitter } = require('events');
const Store = require('electron-store');
const url = require('url');
const path = require('path');

const { app, BrowserWindow } = electron;
const { autoUpdater } = require('electron-updater');

class SplashUpdater extends EventEmitter {
  constructor() {
    super();
    this.setOptions();
    this.store = new Store();
    this.updaterWindow = null;
  }

  static async shouldApplyUpdate() {
    return true;
  }

  setOptions(options = {}) {
    this.autoUpdater = options.autoUpdater || autoUpdater;
    this.backgroundColor = options.backgroundColor || '#2c3e50';
    this.foregroundColor = options.foregroundColor || '#ffffff';
    this.spinnerGif = options.spinnerGif || './loading.gif';
    this.width = options.width || 350;
    this.height = options.height || 350;
    if (!options.feedURLConfig) {
      throw new Error('feedURLConfig is required');
    }
    this.feedURLConfig = options.feedURLConfig;
    this.shouldApplyUpdate = options.shouldApplyUpdate || SplashUpdater.shouldApplyUpdate;
    this.configureAutoUpdater();
  }

  configureAutoUpdater() {
    this.autoUpdater.allowDowngrade = false;
    this.autoUpdater.autoDownload = true;
    this.autoUpdater.autoInstallOnAppQuit = true;
  }

  setFeedURL(config) {
    this.autoUpdater.setFeedURL(config);
  }

  static getStartURL() {
    return url
      .pathToFileURL(path.join(__dirname, './boot.html'))
      .toString();
  }

  getUpdaterWindowOptions() {
    return {
      width: this.width,
      height: this.height,
      resizable: false,
      frame: false,
      show: true,
      titleBarStyle: 'hidden',
      backgroundColor: this.backgroundColor,
      fullscreenable: false,
      skipTaskbar: false,
      center: true,
      movable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        disableBlinkFeatures: 'Auxclick',
        sandbox: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    };
  }

  emitStatus(status) {
    if (this.updaterWindow && !this.updaterWindow.isDestroyed()) {
      this.updaterWindow.webContents.send('__MAIN_MESSAGE__', {
        type: 'splashUpdater/status',
        value: { status },
      });
    }
    this.emit(status);
  }

  closeSplashScreen(callback, ...args) {
    setTimeout(() => {
      this.updaterWindow.close();
      this.updaterWindow = null;
      if (callback) { if (args) { callback(...args); } else { callback(); } }
    }, 600);
  }

  static ensureSafeQuitAndInstall(window) {
    app.removeAllListeners('window-all-closed');
    const browserWindows = BrowserWindow.getAllWindows();
    browserWindows.forEach((browserWindow) => {
      browserWindow.removeAllListeners('close');
    });
    if (window) {
      window.close();
    }
  }

  applyUpdate() {
    SplashUpdater.ensureSafeQuitAndInstall(this.updaterWindow);
    setTimeout(() => {
      if (this.updaterWindow) {
        this.autoUpdater.quitAndInstall(true, true);
      } else {
        this.shouldApplyUpdate().then((val) => {
          if (val) {
            this.autoUpdater.quitAndInstall(true);
          }
        });
      }
    }, 800);
  }

  boot() {
    return new Promise((resolve, reject) => {
      this.updaterWindow = new BrowserWindow(this.getUpdaterWindowOptions());
      const startURL = SplashUpdater.getStartURL();
      this.updaterWindow.loadURL(startURL);
      this.autoUpdater.setFeedURL(this.feedURLConfig);
      this.autoUpdater.checkForUpdates();

      this.autoUpdater.on('error', (err) => {
        this.emitStatus('failed');
        this.closeSplashScreen(reject, err);
      });

      this.autoUpdater.on('checking-for-update', () => {
        this.emitStatus('checking-for-update');
      });

      this.autoUpdater.on('update-available', () => {
        this.emitStatus('downloading');
      });

      this.autoUpdater.on('download-progress', (info) => {
        if (this.updaterWindow) {
          const speed = info.bytesPerSecond > 1024 * 1024
            ? `${(info.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
            : `${(info.bytesPerSecond / 1024).toFixed(1)} KB/s`;

          const downloadingInfo = { speed, percentage: parseFloat(info.percent).toFixed(1) };
          if (this.updaterWindow && !this.updaterWindow.isDestroyed()) {
            this.updaterWindow.webContents.send('__MAIN_MESSAGE__', {
              type: 'splashUpdater/downloading',
              value: downloadingInfo,
            });
          }
          this.emit('download-progress', downloadingInfo);
        }
      });

      this.autoUpdater.on('update-not-available', () => {
        this.emitStatus('update-not-available');
        this.closeSplashScreen(resolve);
      });

      this.autoUpdater.on('update-downloaded', () => {
        this.emitStatus('update-downloaded');
        this.applyUpdate();
      });
    });
  }
}

const splashUpdater = new SplashUpdater();

module.exports = splashUpdater;
