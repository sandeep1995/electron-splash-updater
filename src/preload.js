/* global window, CustomEvent */
const { ipcRenderer } = require('electron');

process.once('loaded', () => {
  window.addEventListener('__RENDERER_MESSAGE__', (event) => {
    ipcRenderer.send('__RENDERER_MESSAGE__', event.detail);
  });

  ipcRenderer.on('__MAIN_MESSAGE__', (event, data) => {
    window.dispatchEvent(
      new CustomEvent('__MAIN_MESSAGE__', { detail: data }),
    );
  });
});
