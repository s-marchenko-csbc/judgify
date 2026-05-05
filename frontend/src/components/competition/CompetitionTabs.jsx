import React from "react";
import { useLanguage } from "../../context/LanguageContext";

const tabs = [
  { id: "overview", labelKey: "detailTabs.overview" },
  { id: "participants", labelKey: "detailTabs.participants" },
  { id: "results", labelKey: "detailTabs.results" },
  { id: "judging", labelKey: "detailTabs.judging" },
];

export default function CompetitionTabs({ activeTab, onTabChange }) {
  const { t } = useLanguage();

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
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  );
}
