import React from 'react';

const tabs = [
  { key: 'active', label: 'Active competitions' },
  { key: 'trending', label: 'Trending' },
  { key: 'new', label: 'New' },
  { key: 'open_submission', label: 'Open Submission' },
  { key: 'live_stream', label: 'Live Stream' },
  { key: 'completed', label: 'Finished & archived' },
];

export default function CompetitionTabs({ activeTab, onChange }) {
  return (
    <div className="competition-tabs">
      {tabs.map((tab) => (
        <button key={tab.key} className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`} onClick={() => onChange(tab.key)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
