const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire ipcRenderer object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    openLogin: (url) => ipcRenderer.send('open-login', url),
    onLoginComplete: (callback) => ipcRenderer.on('login-complete', callback),
    sendLoginComplete: (data) => ipcRenderer.send('login-complete', data),
    onLoginSuccess: (callback) => ipcRenderer.on('login-success', callback),
  }
);