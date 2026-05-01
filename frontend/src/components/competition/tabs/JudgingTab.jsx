import React from "react";

export default function JudgingTab({ competition }) {
  return (
    <section className="competition-panel">
      <h2 className="competition-section-title">Judging</h2>

      <div className="judging-mode-line">
        Scoring mode: <strong>{competition.judging?.mode}</strong>
      </div>

      <div className="judging-metric-list">
        {(competition.judging?.metrics || []).map((metric) => (
          <div key={metric.label} className="judging-metric-item">
            <div>{metric.label}</div>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}