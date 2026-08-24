/**
 * Global augmentations for platform shells (Electron preload bridge, Capacitor).
 */

export interface ElectronUpdaterStatus {
  status: string;
  info?: unknown;
}

export interface ElectronAPI {
  platform: string;
  version: string;
  isDev?: boolean;
  showNotification(title: string, body: string): void;
  checkForUpdates?(): Promise<unknown>;
  downloadUpdate?(): Promise<void>;
  installUpdate?(): Promise<void>;
  onUpdateStatus(callback: (status: ElectronUpdaterStatus) => void): () => void;
  minimizeToTray?(): void;
  quitApp?(): void;
  getLanIp?(): Promise<string>;
  isDevAsync?(): Promise<boolean>;
  onFocus?(cb: () => void): void;
  onBlur?(cb: () => void): void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  }
}

export {};
