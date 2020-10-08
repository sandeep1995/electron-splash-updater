const { app } = require('electron');

const isDev = app.isPackaged !== true;

const isMacOS = () => process.platform === 'darwin';

const isWindows = () => process.platform === 'win32';

module.exports = {
  isDev,
  isMacOS,
  isWindows,
};
