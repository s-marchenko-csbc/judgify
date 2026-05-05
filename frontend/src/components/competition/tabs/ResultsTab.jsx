import React from "react";
import { useLanguage } from "../../../context/LanguageContext";

export default function ResultsTab({ competition }) {
  const { t } = useLanguage();
  const roundScores = competition.results?.roundScores || competition.judging?.round_scores || [];

  return (
    <section className="competition-panel">
      <h2 className="competition-section-title">{t("resultsTab.title")}</h2>

      <div className="results-grid">
        <div className="results-card">
          <h3>{t("resultsTab.roundHistory")}</h3>
          <div className="round-history-list">
            {(competition.results?.roundHistory || []).map((item) => (
              <div key={item.round} className="round-history-row">
                <span>{t("resultsTab.round", { round: item.round })}</span>
                <span>{item.leader}</span>
                <strong>{item.topScore}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="results-card">
          <h3>{t("resultsTab.leaderboard")}</h3>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>{t("resultsTab.rank")}</th>
                <th>{t("resultsTab.name")}</th>
                <th>{t("resultsTab.score")}</th>
              </tr>
            </thead>
            <tbody>
              {(competition.results?.leaderboard || []).map((item) => (
                <tr key={item.rank}>
                  <td>{item.rank}</td>
                  <td>{item.name}</td>
                  <td>{item.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!!roundScores.length && (
        <div className="results-round-score-section">
          <h3>{t("resultsTab.roundScores")}</h3>
          {roundScores.map((table) => (
            <div key={table.round?.id || table.round?.title} className="results-round-score-block">
              <div className="round-history-row">
                <span>{table.round?.title || t("judgingTab.round")}</span>
                <span>{t(`options.status.${table.round?.status}`, { defaultValue: table.round?.status || "" })}</span>
                <strong>{t("resultsTab.scored", { count: table.rows?.length || 0 })}</strong>
              </div>
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>{t("resultsTab.name")}</th>
                    <th>{t("resultsTab.scoredCriteria")}</th>
                    <th>{t("resultsTab.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(table.rows || []).slice(0, 10).map((row) => (
                    <tr key={row.subject?.id}>
                      <td>{row.subject?.title || row.subject?.name}</td>
                      <td>{row.scored_criteria}</td>
                      <td>{row.total_score ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
