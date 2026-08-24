import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { validatePassword, validateUsername } from '../utils/validators';
import { getServerUrl } from '../config';

export interface AuthUser {
  id: number;
  username: string;
  avatar: string | null;
  createdAt?: string;
}

interface RegisterResult {
  success: boolean;
  error?: string;
  user?: { id: number; username: string };
}

interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  serverUrl: string;
  serverIp: string;
  setServerIp: (ip: string) => void;
  updateServerUrl: (url: string) => void;
  getServerUrlSync: () => string;
  connectionType: string;
  register: (username: string, password: string) => Promise<RegisterResult>;
  login: (username: string, password: string, remember?: boolean) => Promise<LoginResult>;
  logout: () => Promise<void>;
  updateUserAvatar: (avatarUrl: string) => void;
  clearError: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverIp, setServerIpState] = useState(() => localStorage.getItem('serverIp') || '');
  const serverUrlRef = useRef(getServerUrl(localStorage.getItem('serverIp')));
  const [connectionType, setConnectionType] = useState('localhost');

  const setServerIp = (ip: string) => {
    setServerIpState(ip);
    localStorage.setItem('serverIp', ip);
    serverUrlRef.current = getServerUrl(ip);
  };

  const updateServerUrl = (url: string) => {
    serverUrlRef.current = url;
  };

  const getServerUrlSync = () => serverUrlRef.current;

  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      setConnectionType('localhost');
    } else {
      setConnectionType('lan');
    }
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      void verifyToken(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (authToken: string): Promise<void> => {
    try {
      const response = await fetch(`${serverUrlRef.current}/api/auth/verify`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data: unknown = await response.json();
      if (isSuccessWithUser(data)) {
        const userResponse = await fetch(`${serverUrlRef.current}/api/auth/user`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        const userData: unknown = await userResponse.json();
        if (isSuccessWithUser(userData)) {
          setUser({
            id: userData.user.id,
            username: userData.user.username,
            avatar: userData.user.avatar ?? null,
            createdAt: (userData.user as { createdAt?: string }).createdAt,
          });
          setToken(authToken);
        }
      } else {
        localStorage.removeItem('token');
        setToken(null);
      }
    } catch (err) {
      console.error('Verify token error:', err);
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const register = async (username: string, password: string): Promise<RegisterResult> => {
    setError(null);

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      setError(usernameValidation.error ?? 'Invalid username');
      return { success: false, error: usernameValidation.error };
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error ?? 'Invalid password');
      return { success: false, error: passwordValidation.error };
    }

    try {
      const response = await fetch(`${serverUrlRef.current}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      const data: unknown = await response.json();

      if (isSuccess(data) && hasNestedUser(data)) {
        return { success: true, user: data.user };
      }
      const errorMsg = extractError(data, 'Registration failed');
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } catch (err) {
      console.error('Register error:', err);
      const errorMsg = 'Registration failed. Please try again.';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const login = async (
    username: string,
    password: string,
    remember = false,
  ): Promise<LoginResult> => {
    setError(null);

    try {
      const response = await fetch(`${serverUrlRef.current}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, remember }),
      });
      const data: unknown = await response.json();

      const d = asRecord(data);
      const tok = typeof d?.['token'] === 'string' ? d['token'] : null;
      const u = parseUser(d?.['user']);

      if (tok && u) {
        setUser({ id: u.id, username: u.username, avatar: u.avatar ?? null });
        setToken(tok);
        localStorage.setItem('token', tok);
        return { success: true };
      }
      const errorMsg = extractError(data, 'Login failed');
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } catch (err) {
      console.error('Login error:', err);
      const errorMsg = `Login failed. Please try again. (${err instanceof Error ? err.message : String(err)})`;
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${serverUrlRef.current}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    try {
      const { wipeLocalData } = await import('../domain/sync');
      await wipeLocalData();
    } catch (err) {
      console.error('Local cache wipe failed:', err);
    }
  }, [token]);

  const updateUserAvatar = (avatarUrl: string) => {
    setUser((prev) => (prev ? { ...prev, avatar: avatarUrl } : null));
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextValue = {
    user,
    token,
    loading,
    error,
    serverUrl: serverUrlRef.current,
    serverIp,
    setServerIp,
    updateServerUrl,
    getServerUrlSync,
    connectionType,
    register,
    login,
    logout,
    updateUserAvatar,
    clearError,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { getServerUrl };

/* ------------------------------------------------------------------ */
/* Narrowing helpers for untyped JSON payloads                         */
/* ------------------------------------------------------------------ */

function hasProp(obj: unknown, key: string): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

function asRecord(obj: unknown): Record<string, unknown> | null {
  return typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>) : null;
}

interface ParsedUser {
  id: number;
  username: string;
  avatar?: string | null;
}

function parseUser(value: unknown): ParsedUser | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v['id'] === 'number' && typeof v['username'] === 'string') {
    return { id: v['id'], username: v['username'], avatar: (v['avatar'] as string | null) ?? null };
  }
  return null;
}

function isSuccess(obj: unknown): obj is Record<string, unknown> {
  return hasProp(obj, 'success') && obj.success === true;
}

function isSuccessWithUser(
  obj: unknown,
): obj is { success: true; user: { id: number; username: string; avatar?: string | null } } {
  return (
    isSuccess(obj) &&
    hasProp(obj, 'user') &&
    typeof obj.user === 'object' &&
    obj.user !== null &&
    'id' in obj.user &&
    'username' in obj.user
  );
}

function hasNestedUser(
  obj: Record<string, unknown>,
): obj is { user: { id: number; username: string; avatar?: string | null } } {
  return (
    hasProp(obj, 'user') &&
    typeof obj.user === 'object' &&
    obj.user !== null &&
    'id' in obj.user &&
    'username' in obj.user
  );
}

function extractError(obj: unknown, fallback: string): string {
  if (hasProp(obj, 'error') && typeof obj.error === 'string') {
    return obj.error;
  }
  return fallback;
}
