import React from "react";
import { useLanguage } from "../../../context/LanguageContext";

function normalizeRole(role, t) {
  return t(`roles.${role || "participant"}`, {
    defaultValue: role || t("participantsTab.fallback"),
  });
}

export default function ParticipantsTab({ competition }) {
  const { t } = useLanguage();
  const participants = competition.participants || [];

  return (
    <section className="competition-panel">
      <h2 className="competition-section-title">{t("participantsTab.title")}</h2>

      {!participants.length ? (
        <p className="competition-empty-note">{t("participantsTab.empty")}</p>
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
                  {participant.name || participant.display_name || participant.user_name || t("participantsTab.fallback")}
                </div>
                <div className="participant-role">
                  {participant.team_name ? `${participant.team_name} - ` : ""}
                  {normalizeRole(participant.role, t)} - {t(`options.status.${participant.status || "pending"}`, { defaultValue: participant.status || "pending" })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
