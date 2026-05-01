import React from "react";

export default function CompetitionHeader({ competition, onJoin }) {
  return (
    <section className="competition-detail-header">
      <div
        className="competition-detail-cover"
        style={{
          backgroundImage: competition.cover_image
            ? `url(${competition.cover_image})`
            : undefined,
        }}
      />

      <div className="competition-detail-title-row">
        <div>
          <h1 className="competition-detail-title">{competition.name}</h1>
          <div className="competition-detail-round">
            Round: {competition.current_round}/{competition.total_rounds}
          </div>
        </div>

        <button
          type="button"
          className="competition-join-btn"
          onClick={onJoin}
        >
          Join Competition
        </button>
      </div>
    </section>
  );
}