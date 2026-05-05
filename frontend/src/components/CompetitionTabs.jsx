import React from 'react';
import { useLanguage } from "../context/LanguageContext";

const tabs = [
  { key: 'active', labelKey: 'tabs.active' },
  { key: 'trending', labelKey: 'tabs.trending' },
  { key: 'new', labelKey: 'tabs.new' },
  { key: 'open_submission', labelKey: 'tabs.open_submission' },
  { key: 'live_stream', labelKey: 'tabs.live_stream' },
  { key: 'completed', labelKey: 'tabs.completed' },
];

export default function CompetitionTabs({ activeTab, onChange }) {
  const { t } = useLanguage();

  return (
    <div className="competition-tabs">
      {tabs.map((tab) => (
        <button key={tab.key} className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`} onClick={() => onChange(tab.key)}>
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  );
}
