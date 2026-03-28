const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  convert: (action, payload) => ipcRenderer.invoke('perform-conversion', { action, payload }),
  openFileDialog: (filters) => ipcRenderer.invoke('dialog:openFile', filters),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  openPath: (path) => ipcRenderer.invoke('shell:openPath', path),
  openOutputDir: (path) => ipcRenderer.invoke('shell:openOutputDir', path),
  cancelConversion: (payload) => ipcRenderer.invoke('cancel-conversion', payload),
  onProgress: (callback) => ipcRenderer.on('conversion-progress', (event, data) => callback(data)),
  removeProgressListener: () => ipcRenderer.removeAllListeners('conversion-progress'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggleMaximize'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onWindowMaximizedStateChanged: (callback) =>
    ipcRenderer.on('window-maximized-state-changed', (event, state) => callback(state)),
  removeWindowMaximizedStateChangedListener: () =>
    ipcRenderer.removeAllListeners('window-maximized-state-changed'),
  startUpdate: (updateInfo) => ipcRenderer.send('start-update', updateInfo),
  checkUpdate: (version) => ipcRenderer.invoke('check-update', { version })
});
