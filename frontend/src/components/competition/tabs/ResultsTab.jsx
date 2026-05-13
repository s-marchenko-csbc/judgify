import React from "react";
import { useLanguage } from "../../../context/LanguageContext";

const scoreValue = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return value;
  return Number.isInteger(numberValue) ? numberValue : numberValue.toFixed(2);
};

const buildLeaderboardFromRoundScores = (roundScores = []) => {
  const totals = new Map();

  roundScores.forEach((table) => {
    (table.rows || []).forEach((row) => {
      if (row.total_score === null || row.total_score === undefined) return;
      const subject = row.subject || {};
      const key = subject.team_id ? `team-${subject.team_id}` : subject.participant_id ? `participant-${subject.participant_id}` : subject.id;
      if (!key) return;
      const current = totals.get(key) || {
        name: subject.name || subject.title || "—",
        score: 0,
      };
      current.score += Number(row.total_score) || 0;
      totals.set(key, current);
    });
  });

  return Array.from(totals.values())
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)))
    .map((item, index) => ({ ...item, rank: index + 1 }));
};

const buildRoundHistoryFromRoundScores = (roundScores = []) =>
  roundScores.map((table, index) => {
    const scoredRows = (table.rows || []).filter((row) => row.total_score !== null && row.total_score !== undefined);
    const best = [...scoredRows].sort((a, b) => (b.total_score || 0) - (a.total_score || 0))[0];
    return {
      round: table.round?.sort_order || index + 1,
      title: table.round?.title,
      leader: best?.subject?.name || best?.subject?.title || "—",
      topScore: best?.total_score ?? 0,
    };
  });

export default function ResultsTab({ competition }) {
  const { t } = useLanguage();
  const roundScores = competition.results?.roundScores || competition.judging?.round_scores || [];
  const roundHistory = (competition.results?.roundHistory?.length ? competition.results.roundHistory : buildRoundHistoryFromRoundScores(roundScores));
  const leaderboard = (competition.results?.leaderboard?.length ? competition.results.leaderboard : buildLeaderboardFromRoundScores(roundScores));

  return (
    <section className="competition-panel">
      <h2 className="competition-section-title">{t("resultsTab.title")}</h2>

      <div className="results-grid">
        <div className="results-card">
          <h3>{t("resultsTab.roundHistory")}</h3>
          <div className="round-history-list">
            {roundHistory.length ? roundHistory.map((item) => (
              <div key={`${item.round}-${item.title || item.leader}`} className="round-history-row">
                <span>{item.title || t("resultsTab.round", { round: item.round })}</span>
                <span>{item.leader}</span>
                <strong>{scoreValue(item.topScore)}</strong>
              </div>
            )) : (
              <div className="round-history-row">
                <span>{t("resultsTab.noRoundHistory", { defaultValue: "Немає даних про раунди" })}</span>
                <span>—</span>
                <strong>—</strong>
              </div>
            )}
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
              {leaderboard.length ? leaderboard.map((item) => (
                <tr key={`${item.rank}-${item.name}`}>
                  <td>{item.rank}</td>
                  <td>{item.name}</td>
                  <td>{scoreValue(item.score)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="3">{t("resultsTab.noLeaderboard", { defaultValue: "Рейтинг ще не сформовано" })}</td>
                </tr>
              )}
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
                <strong>{t("resultsTab.scored", { count: (table.rows || []).filter((row) => row.total_score !== null && row.total_score !== undefined).length })}</strong>
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
                      <td>{scoreValue(row.total_score)}</td>
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
