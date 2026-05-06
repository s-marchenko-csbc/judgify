import React from 'react';
import { useLanguage } from "../context/LanguageContext";

const tabs = [
  { key: 'registration_open', labelKey: 'tabs.registration_open' },
  { key: 'active', labelKey: 'tabs.active' },
  { key: 'judging', labelKey: 'tabs.judging' },
  { key: 'upcoming', labelKey: 'tabs.upcoming' },
  { key: 'finished', labelKey: 'tabs.finished' },
  { key: 'archived', labelKey: 'tabs.archived' },
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
