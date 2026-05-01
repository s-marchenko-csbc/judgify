import React from "react";

export default function ParticipantsTab({ competition }) {
  return (
    <section className="competition-panel">
      <h2 className="competition-section-title">Participants</h2>

      <div className="participant-list">
        {(competition.participants || []).map((participant) => (
          <div key={participant.id} className="participant-item">
            <span
              className={`participant-dot ${
                participant.isActiveNow ? "online" : "offline"
              }`}
            />
            <div className="participant-info">
              <div className="participant-name">{participant.name}</div>
              <div className="participant-role">{participant.role}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}