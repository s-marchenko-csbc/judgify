import React from "react";

export default function ResultsTab({ competition }) {
  const roundScores = competition.results?.roundScores || competition.judging?.round_scores || [];

  return (
    <section className="competition-panel">
      <h2 className="competition-section-title">Results</h2>

      <div className="results-grid">
        <div className="results-card">
          <h3>Round history</h3>
          <div className="round-history-list">
            {(competition.results?.roundHistory || []).map((item) => (
              <div key={item.round} className="round-history-row">
                <span>Round {item.round}</span>
                <span>{item.leader}</span>
                <strong>{item.topScore}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="results-card">
          <h3>Leaderboard</h3>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Score</th>
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
          <h3>Round scores</h3>
          {roundScores.map((table) => (
            <div key={table.round?.id || table.round?.title} className="results-round-score-block">
              <div className="round-history-row">
                <span>{table.round?.title || "Round"}</span>
                <span>{table.round?.status}</span>
                <strong>{table.rows?.length || 0} scored</strong>
              </div>
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Scored criteria</th>
                    <th>Total</th>
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
