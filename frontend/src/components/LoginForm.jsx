import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

function LoginForm({ onSwitchToRegister }) {
  const { login, error, clearError } = useAuth();
  const { t, language, setLanguage, languages, languageNames } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    await login(username, password, remember);
    setLoading(false);
  };

  return (
    <div className="auth-form">
      <h2>{t('login')}</h2>
      {error && <div className="auth-error">{error}</div>}
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
        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            {t('rememberMe')}
          </label>
        </div>
        <button type="submit" className="auth-btn" disabled={loading}>
          {loading ? t('loggingIn') : t('login')}
        </button>
      </form>
      <div className="auth-footer">
        <span>{t('noAccount')}</span>
        <button className="switch-btn" onClick={onSwitchToRegister}>
          {t('register')}
        </button>
      </div>
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

export default LoginForm;
