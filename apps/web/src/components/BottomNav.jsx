import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const isAndroid = typeof window !== 'undefined' && window.Capacitor !== undefined;

function BottomNav({ activeTab, onTabChange }) {
  const { t, language, setLanguage, languages, languageNames } = useLanguage();

  if (!isAndroid) {
    return null;
  }

  const tabs = [
    { id: 'public', icon: '💬', label: t('publicChat') },
    { id: 'private', icon: '👤', label: t('privateChat') },
    { id: 'groups', icon: '👥', label: t('myGroups') },
    { id: 'settings', icon: '⚙️', label: t('settings') }
  ];

  return (
    <div className="bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

export default BottomNav;
