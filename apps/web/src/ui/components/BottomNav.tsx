import { useLanguage } from '../../context/LanguageContext';

const isAndroid = typeof window !== 'undefined' && window.Capacitor !== undefined;

export type MobileTab = 'public' | 'private' | 'groups' | 'settings';

function BottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (tab: MobileTab) => void;
}) {
  const { t } = useLanguage();

  if (!isAndroid) {
    return null;
  }

  const tabs: Array<{ id: MobileTab; icon: string; label: string }> = [
    { id: 'public', icon: '💬', label: t('publicChat') },
    { id: 'private', icon: '👤', label: t('privateChat') },
    { id: 'groups', icon: '👥', label: t('myGroups') },
    { id: 'settings', icon: '⚙️', label: t('settings') },
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
