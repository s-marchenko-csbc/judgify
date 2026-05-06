import React from "react";
import { markMaterialViewed } from "../../api/landingApi";
import { useLanguage } from "../../context/LanguageContext";
import { getMaterialBadge, getMaterialMeta, getMaterialTitle, getMaterialUrl } from "../../utils/materials";

function getStatusLabel(status, t) {
  return t(`statuses.${status}`, { defaultValue: status });
}

export default function CompetitionSidebar({ competition }) {
  const { t } = useLanguage();

  return (
    <div className="competition-detail-sidebar">
      <section className="competition-side-block">
        <h2 className="competition-side-title">{competition.name}</h2>

        <div className="competition-status-pill">
          {getStatusLabel(competition.status, t)}
        </div>

        <div className="competition-side-row">
          <span>{t("competitionSidebar.round")}</span>
          <strong>
            {competition.current_round}/{competition.total_rounds}
          </strong>
        </div>

        <div className="competition-side-row">
          <span>{t("card.participants", { count: competition.participants_count })}</span>
          <span className="competition-side-code">
            {competition.organizerCode}
          </span>
        </div>

        <div className="competition-side-separator" />

        <div className="competition-side-row">
          <span>{t("competitionSidebar.category")}</span>
          <strong>{competition.category}</strong>
        </div>

        <div className="competition-side-row">
          <span>{t("competitionSidebar.dates")}</span>
          <strong>{competition.datesLabel}</strong>
        </div>

        <div className="competition-side-row">
          <span>{t("competitionSidebar.difficulty")}</span>
          <strong className="difficulty-good">
            {competition.difficulty}
          </strong>
        </div>

        <div className="competition-side-row">
          <span>{t("competitionSidebar.language")}</span>
          <strong>{String(competition.language || "uk").toUpperCase()}</strong>
        </div>
      </section>

      <section className="competition-side-block description">
        <p>{competition.sidebarDescription}</p>
      </section>

      <section className="competition-side-block">
        <h3 className="competition-block-heading">{t("competitionSidebar.upcomingEvent")}</h3>
        <div className="competition-upcoming-chip">
          {competition.upcomingText}
        </div>
      </section>

      <section className="competition-side-block">
        <h3 className="competition-block-heading">{t("competitionSidebar.downloads")}</h3>

        <div className="competition-download-list">
          {(competition.materials || []).map((item) => {
            const href = getMaterialUrl(item);
            const content = (
              <>
                <span>{getMaterialBadge(item)}</span>
                <span>
                  <strong>{getMaterialTitle(item, t("profile.material"))}</strong>
                  {getMaterialMeta(item, t) && <small>{getMaterialMeta(item, t)}</small>}
                </span>
                <span>{">"}</span>
              </>
            );
            return href ? (
              <a
                key={item.id}
                href={href}
                className="competition-download-item"
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (Number.isInteger(Number(item.id))) {
                    markMaterialViewed(item.id).catch(console.error);
                  }
                }}
              >
                {content}
              </a>
            ) : (
              <div key={item.id} className="competition-download-item disabled">
                {content}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
