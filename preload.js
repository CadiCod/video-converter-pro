const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // File dialogs
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  selectOutputDir: () => ipcRenderer.invoke('dialog:selectOutputDir'),

  // Video operations
  probeVideo: (filePath) => ipcRenderer.invoke('video:probe', filePath),
  convertVideo: (options) => ipcRenderer.invoke('video:convert', options),
  cancelConversion: (id) => ipcRenderer.send('video:cancel', id),

  // Progress listener
  onProgress: (callback) => {
    ipcRenderer.on('conversion:progress', (event, data) => callback(data));
  },

  // File system
  getDefaultOutputDir: () => ipcRenderer.invoke('fs:getDefaultOutputDir'),
  openInExplorer: (path) => ipcRenderer.invoke('fs:openInExplorer', path),
  openFile: (path) => ipcRenderer.invoke('fs:openFile', path),
  openExternal: (url) => ipcRenderer.invoke('fs:openExternal', url),
  getFileSize: (path) => ipcRenderer.invoke('fs:getFileSize', path),

  // Drag & drop - Electron 33+ requires webUtils for file paths
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return file.path || '';
    }
  },

  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion')
});
