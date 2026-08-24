/**
 * Single source of truth for server endpoint resolution.
 * Replaces the four duplicated implementations from the legacy codebase
 * (src/config.js, utils/config.js, AuthContext, LoginForm/RegisterForm).
 */

export const SERVER_PORT = 3000;

/** Explicit user override (Android / remote LAN clients), persisted in localStorage. */
export function getServerUrl(serverIp?: string | null): string {
  const savedIp = serverIp ?? localStorage.getItem('serverIp');
  if (savedIp) {
    return `http://${savedIp}:${SERVER_PORT}`;
  }

  const hostname = window.location.hostname;
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'file') {
    return `http://127.0.0.1:${SERVER_PORT}`;
  }

  return `http://${hostname}:${SERVER_PORT}`;
}

export const SERVER_URL = getServerUrl();
export const API_URL = `${SERVER_URL}/api`;
export const SOCKET_URL = SERVER_URL;

/** URL of the dev-served page itself (used by Capacitor shell flows). */
export function getBaseUrl(): string {
  return `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`;
}
