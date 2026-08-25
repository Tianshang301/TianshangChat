import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(v: boolean) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l(true));
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((l) => l(false));
  });
}

/** Offline banner + update toast + install button in one slim strip. */
export function PwaIndicators() {
  const { t } = useLanguage();
  const [online, setOnline] = useState(navigator.onLine);
  const [installable, setInstallable] = useState(deferredPrompt !== null);
  const [swUpdateReady, setSwUpdateReady] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const canInstall = (v: boolean) => setInstallable(v);
    listeners.add(canInstall);

    // Service-worker update detection.
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              setSwUpdateReady(true);
            }
          });
        });
      });
    }

    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      listeners.delete(canInstall);
    };
  }, []);

  const strip: string[] = [];
  if (!online) strip.push(`⚠ ${t('offlineBanner') || '离线模式：消息将排队，恢复后自动发送'}`);
  if (swUpdateReady) strip.push('🔄 新版本可用');

  if (strip.length === 0 && !installable) return null;

  return (
    <div className="pwa-indicators">
      {strip.map((s) => (
        <div key={s} className="pwa-strip">
          <span>{s}</span>
          {swUpdateReady && (
            <button className="pwa-action" onClick={() => window.location.reload()}>
              刷新
            </button>
          )}
        </div>
      ))}
      {installable && (
        <div className="pwa-strip">
          <span>📲 安装到桌面</span>
          <button
            className="pwa-action"
            onClick={() => {
              void deferredPrompt?.prompt();
              deferredPrompt = null;
              setInstallable(false);
            }}
          >
            安装
          </button>
        </div>
      )}
    </div>
  );
}
