import React, { useState } from 'react';
import { useAuth, getServerUrl } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const isAndroid = typeof window !== 'undefined' && window.Capacitor !== undefined;
const PORT = 3000;

function RegisterForm({ onSwitchToLogin }) {
  const { register, error, clearError, serverIp, setServerIp, updateServerUrl } = useAuth();
  const { t, language, setLanguage, languages, languageNames } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [localServerIp, setLocalServerIp] = useState(serverIp);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setLocalError('');

    if (password !== confirmPassword) {
      setLocalError(t('passwordMismatch'));
      return;
    }

    if (password.length < 6) {
      setLocalError(t('passwordTooShort'));
      return;
    }

    if (username.length < 3) {
      setLocalError(t('usernameTooShort'));
      return;
    }

    if (isAndroid && localServerIp) {
      const newUrl = `http://${localServerIp}:${PORT}`;
      updateServerUrl(newUrl);
      setServerIp(localServerIp);
    }

    setLoading(true);
    const result = await register(username, password);
    setLoading(false);
    
    if (!result.success && !error) {
      setLocalError(result.error);
    }
  };

  return (
    <div className="auth-form">
      <h2>{t('register')}</h2>
      {(error || localError) && <div className="auth-error">{error || localError}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            type="text"
            className="auth-input"
            placeholder={t('username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="form-group">
          <input
            type="password"
            className="auth-input"
            placeholder={t('password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <input
            type="password"
            className="auth-input"
            placeholder={t('confirmPassword')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <div className="password-hint">{t('passwordHint')}</div>
        <button type="submit" className="auth-btn" disabled={loading}>
          {loading ? t('registering') : t('register')}
        </button>
      </form>
      <div className="auth-footer">
        <span>{t('hasAccount')}</span>
        <button className="switch-btn" onClick={onSwitchToLogin}>
          {t('login')}
        </button>
      </div>
      {isAndroid && (
        <div className="server-ip-section">
          <label className="server-ip-label">{t('serverIp') || 'Server IP'}:</label>
          <input
            type="text"
            className="auth-input server-ip-input"
            placeholder={t('enterServerIp') || 'Enter server IP (e.g. 192.168.1.100)'}
            value={localServerIp}
            onChange={(e) => setLocalServerIp(e.target.value)}
          />
        </div>
      )}
      <div className="language-selector-welcome">
        {languages.map((lang) => (
          <button
            key={lang}
            className={`lang-btn-welcome ${language === lang ? 'active' : ''}`}
            onClick={() => setLanguage(lang)}
          >
            {languageNames[lang]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default RegisterForm;
