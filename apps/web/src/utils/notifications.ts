import type { ElectronUpdaterStatus } from '../types/globals';

const isElectron = (): boolean => {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
};

const isBrowserNotificationSupported = (): boolean => {
  return typeof Notification !== 'undefined' && Notification.permission !== 'denied';
};

const requestNotificationPermission = async (): Promise<boolean> => {
  if (isBrowserNotificationSupported()) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

const showNotification = async (
  title: string,
  body: string,
  onClick?: () => void,
): Promise<boolean> => {
  if (isElectron()) {
    window.electronAPI?.showNotification(title, body);
    return true;
  }

  if (isBrowserNotificationSupported()) {
    const notification = new Notification(title, {
      body,
      silent: false,
    });

    if (onClick) {
      notification.onclick = onClick;
    }

    return true;
  }

  return false;
};

type UpdateStatusListener = (status: ElectronUpdaterStatus) => void;

const getUpdateStatus = (callback: UpdateStatusListener): (() => void) => {
  if (isElectron() && window.electronAPI?.onUpdateStatus) {
    return window.electronAPI.onUpdateStatus(callback);
  }
  return () => {};
};

const checkForUpdates = async (): Promise<unknown> => {
  if (isElectron()) {
    return await window.electronAPI?.checkForUpdates?.();
  }
  return null;
};

const downloadUpdate = async (): Promise<void> => {
  if (isElectron()) {
    await window.electronAPI?.downloadUpdate?.();
  }
};

const installUpdate = async (): Promise<void> => {
  if (isElectron()) {
    await window.electronAPI?.installUpdate?.();
  }
};

const getVersion = async (): Promise<string> => {
  if (isElectron()) {
    return await Promise.resolve(window.electronAPI?.version ?? '1.0.0');
  }
  return '1.0.0';
};

const getLanIp = async (): Promise<string> => {
  if (isElectron() && window.electronAPI?.getLanIp) {
    return window.electronAPI.getLanIp();
  }
  return 'localhost';
};

const isDev = async (): Promise<boolean> => {
  if (isElectron()) {
    return window.electronAPI?.isDev === true;
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
  isDev,
};
