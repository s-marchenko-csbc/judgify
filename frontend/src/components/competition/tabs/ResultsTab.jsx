import React from "react";

export default function ResultsTab({ competition }) {
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
    </section>
  );
}