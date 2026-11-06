const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire ipcRenderer
contextBridge.exposeInMainWorld('electronAPI', {
  loadGeminiApp: () => ipcRenderer.invoke('load-gemini-app'),
  saveCredentials: (credentials) => ipcRenderer.invoke('save-credentials', credentials),
  getSavedCredentials: () => ipcRenderer.invoke('get-credentials'),
  clearCredentials: () => ipcRenderer.invoke('clear-credentials'),
  saveCookies: (cookies) => ipcRenderer.invoke('save-cookies', cookies),
  getCookies: () => ipcRenderer.invoke('get-cookies'),
  // Add other methods as needed
});
