import React, { useState } from "react";
import { joinCompetition } from "../../api/landingApi";
import { useLanguage } from "../../context/LanguageContext";

const roles = [
  { id: "participant", labelKey: "joinModal.individual" },
  { id: "team_member", labelKey: "joinModal.team" },
];

function rolesForCompetition(competition) {
  if (competition?.participation_type === "individual") {
    return roles.filter((role) => role.id === "participant");
  }
  if (competition?.participation_type === "team") {
    return roles.filter((role) => role.id === "team_member");
  }
  return roles;
}

export default function JoinCompetitionModal({ competition, onClose, onSubmitted }) {
  const { t } = useLanguage();
  const availableRoles = rolesForCompetition(competition);
  const [selectedRole, setSelectedRole] = useState(availableRoles[0]?.id || "participant");
  const [teamName, setTeamName] = useState(competition?.user_team?.name || "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (submitting) return;
    if (selectedRole === "team_member" && !teamName.trim()) {
      setError(t("joinModal.teamRequired"));
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
      setError(err.message || t("joinModal.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverlayMouseDown = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown}>
      <div className="join-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{t("joinModal.title")}</h2>
        <p>{t("joinModal.description")}</p>

        <div className="join-role-list">
          {availableRoles.map((role) => (
            <button
              key={role.id}
              type="button"
              className={`join-role-btn ${selectedRole === role.id ? "active" : ""}`}
              onClick={() => setSelectedRole(role.id)}
            >
              {t(role.labelKey)}
            </button>
          ))}
        </div>

        {selectedRole === "team_member" && (
          <label className="join-field">
            {t("joinModal.teamName")}
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder={t("joinModal.teamPlaceholder")}
            />
          </label>
        )}

        <label className="join-field">
          {t("joinModal.note")}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("joinModal.notePlaceholder")}
          />
        </label>

        {error && <div className="join-error">{error}</div>}

        <div className="join-modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            {t("joinModal.cancel")}
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? t("joinModal.submitting")
              : competition?.access_mode === "open"
                ? t("joinModal.joinNow")
                : t("joinModal.submitReview")}
          </button>
        </div>
      </div>
    </div>
  );
}
