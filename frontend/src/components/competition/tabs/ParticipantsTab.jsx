import React from "react";

function normalizeRole(role) {
  if (role === "team_member") return "Team member";
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : "Participant";
}

export default function ParticipantsTab({ competition }) {
  const participants = competition.participants || [];

  return (
    <section className="competition-panel">
      <h2 className="competition-section-title">Participants</h2>

      {!participants.length ? (
        <p className="competition-empty-note">No registered participants yet.</p>
      ) : (
        <div className="participant-list">
          {participants.map((participant) => (
            <div key={participant.id} className="participant-item">
              <span
                className={`participant-dot ${
                  participant.isActiveNow || participant.is_active_now ? "online" : "offline"
                }`}
              />
              <div className="participant-info">
                <div className="participant-name">
                  {participant.name || participant.display_name || participant.user_name || "Participant"}
                </div>
                <div className="participant-role">
                  {participant.team_name ? `${participant.team_name} · ` : ""}
                  {normalizeRole(participant.role)} · {participant.status || "pending"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
