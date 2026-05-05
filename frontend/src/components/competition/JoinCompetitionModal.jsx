import React, { useState } from "react";
import { joinCompetition } from "../../api/landingApi";

const roles = [
  { id: "participant", label: "Individual participant" },
  { id: "team_member", label: "Team participant" },
];

export default function JoinCompetitionModal({ competition, onClose, onSubmitted }) {
  const [selectedRole, setSelectedRole] = useState("participant");
  const [teamName, setTeamName] = useState(competition?.user_team?.name || "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (submitting) return;
    if (selectedRole === "team_member" && !teamName.trim()) {
      setError("Team name is required for team participation.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result = await joinCompetition(competition.id, {
        role: selectedRole,
        team_name: selectedRole === "team_member" ? teamName.trim() : "",
        message: message.trim(),
      });
      onSubmitted?.(result);
    } catch (err) {
      setError(err.message || "Could not submit join request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="join-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Join Competition</h2>
        <p>
          Submit a participation request. Depending on the access model, it can be approved immediately or reviewed by organizer/administrator.
        </p>

        <div className="join-role-list">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              className={`join-role-btn ${selectedRole === role.id ? "active" : ""}`}
              onClick={() => setSelectedRole(role.id)}
            >
              {role.label}
            </button>
          ))}
        </div>

        {selectedRole === "team_member" && (
          <label className="join-field">
            Team name
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name or create a new team"
            />
          </label>
        )}

        <label className="join-field">
          Request note
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional note for organizer/admin"
          />
        </label>

        {error && <div className="join-error">{error}</div>}

        <div className="join-modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : competition?.access_mode === "open" ? "Join now" : "Submit for review"}
          </button>
        </div>
      </div>
    </div>
  );
}
