import React from "react";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "participants", label: "Participants" },
  { id: "results", label: "Results" },
  { id: "judging", label: "Judging" },
];

export default function CompetitionTabs({ activeTab, onTabChange }) {
  return (
    <div className="competition-detail-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`competition-detail-tab-btn ${
            activeTab === tab.id ? "active" : ""
          }`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}