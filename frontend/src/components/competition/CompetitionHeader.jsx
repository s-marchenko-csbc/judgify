import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";

function getJoinState(competition, currentUser, t) {
  const role = currentUser?.primaryRole;
  if (currentUser && role !== "participant") return null;
  const canShowJoin = ["upcoming", "registration_open", "active"].includes(competition?.status) && competition?.registration_open;

  const status = competition?.user_participation_status || "none";
  const team = competition?.user_team?.name ? ` - ${competition.user_team.name}` : "";

  if (status === "approved") return { label: `${t("competitionHeader.alreadyParticipating")}${team}`, disabled: true, className: "joined" };
  if (status === "pending") return { label: `${t("competitionHeader.pendingReview")}${team}`, disabled: true, className: "pending" };
  if (!canShowJoin || competition?.can_join === false) return null;
  if (status === "rejected") return { label: t("competitionHeader.requestRejected"), disabled: false, className: "rejected" };
  return { label: t("competitionHeader.join"), disabled: false, className: "" };
}

export default function CompetitionHeader({ competition, onJoin, onEdit }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const joinState = getJoinState(competition, user, t);
  const bannerImage = competition.banner_image || competition.cover_image || "";
  const fallbackImage = competition.cover_image && competition.cover_image !== bannerImage ? competition.cover_image : "";
  const [coverSrc, setCoverSrc] = useState(bannerImage);

  useEffect(() => {
    setCoverSrc(bannerImage);
  }, [bannerImage]);

  return (
    <section className="competition-detail-header">
      <div className="competition-detail-cover">
        {coverSrc && (
          <img
            src={coverSrc}
            alt=""
            loading="eager"
            onError={() => setCoverSrc(fallbackImage)}
          />
        )}
      </div>

      <div className="competition-detail-title-row">
        <div>
          <h1 className="competition-detail-title">{competition.name}</h1>
          <div className="competition-detail-round">
            {t("competitionHeader.round", { current: competition.current_round, total: competition.total_rounds })}
          </div>
          {competition.user_team?.name && (
            <div className="competition-user-team-note">
              {t("competitionHeader.team", {
                name: competition.user_team.name,
                status: t(`statuses.${competition.user_team.status || "pending"}`, { defaultValue: competition.user_team.status || "pending" }),
              })}
            </div>
          )}
        </div>

        <div className="competition-header-actions">
          {competition.can_edit && (
            <button type="button" className="competition-edit-btn" onClick={onEdit}>
              {t("competitionHeader.edit")}
            </button>
          )}
          {joinState && (
            <button
              type="button"
              className={`competition-join-btn ${joinState.className}`}
              onClick={onJoin}
              disabled={joinState.disabled}
            >
              {joinState.label}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
