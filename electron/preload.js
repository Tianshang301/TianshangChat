const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  isDev: () => ipcRenderer.invoke('is-dev'),
  getLanIp: () => ipcRenderer.invoke('get-lan-ip'),

  showNotification: (title, body) => 
    ipcRenderer.invoke('show-notification', { title, body }),

  checkForUpdates: () => 
    ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => 
    ipcRenderer.invoke('download-update'),
  installUpdate: () => 
    ipcRenderer.invoke('install-update'),

  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-status');
  },

  minimizeToTray: () => 
    ipcRenderer.invoke('minimize-to-tray'),
  quitApp: () => 
    ipcRenderer.invoke('quit-app'),

  onFocus: (callback) => {
    const handler = () => callback();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  },

  onBlur: (callback) => {
    const handler = () => callback();
    window.addEventListener('blur', handler);
    return () => window.removeEventListener('blur', handler);
  }
});
