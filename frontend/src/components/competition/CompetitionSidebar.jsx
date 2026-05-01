import React from "react";

function getStatusLabel(status) {
  const map = {
    active: "Online",
    finished: "Finished",
    judging: "Judging",
    archived: "Archived",
    registration_open: "Registration Open",
    upcoming: "Upcoming",
  };

  return map[status] || status;
}

export default function CompetitionSidebar({ competition }) {
  return (
    <div className="competition-detail-sidebar">
      <section className="competition-side-block">
        <h2 className="competition-side-title">{competition.name}</h2>

        <div className="competition-status-pill">
          {getStatusLabel(competition.status)}
        </div>

        <div className="competition-side-row">
          <span>Round:</span>
          <strong>
            {competition.current_round}/{competition.total_rounds}
          </strong>
        </div>

        <div className="competition-side-row">
          <span>{competition.participants_count} participants</span>
          <span className="competition-side-code">
            {competition.organizerCode}
          </span>
        </div>

        <div className="competition-side-separator" />

        <div className="competition-side-row">
          <span>Category:</span>
          <strong>{competition.category}</strong>
        </div>

        <div className="competition-side-row">
          <span>Dates:</span>
          <strong>{competition.datesLabel}</strong>
        </div>

        <div className="competition-side-row">
          <span>Difficulty:</span>
          <strong className="difficulty-good">
            ✔ {competition.difficulty}
          </strong>
        </div>
      </section>

      <section className="competition-side-block description">
        <p>{competition.sidebarDescription}</p>
      </section>

      <section className="competition-side-block">
        <h3 className="competition-block-heading">Upcoming event</h3>
        <div className="competition-upcoming-chip">
          {competition.upcomingText}
        </div>
      </section>

      <section className="competition-side-block">
        <h3 className="competition-block-heading">Downloads</h3>

        <div className="competition-download-list">
          {(competition.materials || []).map((item) => (
            <a
              key={item.id}
              href={item.url}
              className="competition-download-item"
              onClick={(e) => e.preventDefault()}
            >
              <span>{item.icon}</span>
              <span>{item.name}</span>
              <span>›</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}