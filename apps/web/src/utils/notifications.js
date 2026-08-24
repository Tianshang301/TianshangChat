const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
};

const isBrowserNotificationSupported = () => {
  return typeof Notification !== 'undefined' && Notification.permission !== 'denied';
};

const requestNotificationPermission = async () => {
  if (isBrowserNotificationSupported()) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

const showNotification = async (title, body, onClick) => {
  if (isElectron()) {
    return await window.electronAPI.showNotification(title, body);
  }
  
  if (isBrowserNotificationSupported()) {
    const notification = new Notification(title, {
      body: body,
      silent: false
    });
    
    if (onClick) {
      notification.onclick = onClick;
    }
    
    notification.show();
    return true;
  }
  
  return false;
};

const getUpdateStatus = (callback) => {
  if (isElectron()) {
    return window.electronAPI.onUpdateStatus(callback);
  }
  return () => {};
};

const checkForUpdates = async () => {
  if (isElectron()) {
    return await window.electronAPI.checkForUpdates();
  }
  return null;
};

const downloadUpdate = async () => {
  if (isElectron()) {
    return await window.electronAPI.downloadUpdate();
  }
};

const installUpdate = async () => {
  if (isElectron()) {
    return await window.electronAPI.installUpdate();
  }
};

const getVersion = async () => {
  if (isElectron()) {
    return await window.electronAPI.getVersion();
  }
  return '1.0.0';
};

const getLanIp = async () => {
  if (isElectron()) {
    return await window.electronAPI.getLanIp();
  }
  return 'localhost';
};

const isDev = async () => {
  if (isElectron()) {
    return await window.electronAPI.isDev();
  }
  return false;
};

export {
  isElectron,
  isBrowserNotificationSupported,
  requestNotificationPermission,
  showNotification,
  getUpdateStatus,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  getVersion,
  getLanIp,
  isDev
};

export default {
  isElectron,
  showNotification,
  requestNotificationPermission,
  getUpdateStatus,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  getVersion,
  getLanIp,
  isDev
};
