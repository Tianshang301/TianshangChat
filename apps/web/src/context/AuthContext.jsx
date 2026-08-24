import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { encryptPassword, validatePassword, validateUsername } from '../utils/crypto';

const AuthContext = createContext();

const PORT = 3000;

const getServerUrl = (serverIp) => {
  if (serverIp) {
    return `http://${serverIp}:${PORT}`;
  }
  
  const hostname = window.location.hostname;
  
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'file') {
    return `http://127.0.0.1:${PORT}`;
  }
  
  return `http://${hostname}:${PORT}`;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [serverIp, setServerIpState] = useState(() => localStorage.getItem('serverIp') || '');
  const serverUrlRef = useRef(getServerUrl(localStorage.getItem('serverIp')));
  const [connectionType, setConnectionType] = useState('localhost');

  const setServerIp = (ip) => {
    setServerIpState(ip);
    localStorage.setItem('serverIp', ip);
    serverUrlRef.current = getServerUrl(ip);
  };

  const updateServerUrl = (url) => {
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
      verifyToken(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (authToken) => {
    try {
      const response = await fetch(`${serverUrlRef.current}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await response.json();
      if (data.success) {
        const userResponse = await fetch(`${serverUrlRef.current}/api/auth/user`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        const userData = await userResponse.json();
        if (userData.success) {
          setUser(userData.user);
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

  const register = async (username, password) => {
    setError(null);
    
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      setError(usernameValidation.error);
      return { success: false, error: usernameValidation.error };
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error);
      return { success: false, error: passwordValidation.error };
    }

    const encryptedPassword = encryptPassword(password);

    try {
      const response = await fetch(`${serverUrlRef.current}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          password: encryptedPassword
        })
      });
      const data = await response.json();
      
      if (data.success) {
        return { success: true, user: data.user };
      } else {
        setError(data.error);
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Register error:', err);
      const errorMsg = 'Registration failed. Please try again.';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const login = async (username, password, remember = false) => {
    setError(null);
    
    const encryptedPassword = encryptPassword(password);
    const loginUrl = `${serverUrlRef.current}/api/auth/login`;
    console.log('[DEBUG] Login URL:', loginUrl);
    console.log('[DEBUG] serverUrlRef.current:', serverUrlRef.current);

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          password: encryptedPassword,
          remember
        })
      });
      const data = await response.json();
      
      if (data.success) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('token', data.token);
        return { success: true, user: data.user };
      } else {
        setError(data.error);
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Login error:', err);
      console.log('[DEBUG] Fetch error details:', err.message, err.name);
      const errorMsg = 'Login failed. Please try again. (' + err.message + ')';
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
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  }, [token]);

  const updateUserAvatar = (avatarUrl) => {
    setUser(prev => prev ? { ...prev, avatar: avatarUrl } : null);
  };

  const clearError = () => {
    setError(null);
  };

  const value = {
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
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { getServerUrl };
