import React from "react";
import { useAuth } from "../../context/AuthContext";

function getJoinState(competition, currentUser) {
  const role = currentUser?.primaryRole;
  if (role !== "participant") return null;

  const status = competition?.user_participation_status || "none";
  const team = competition?.user_team?.name ? ` · ${competition.user_team.name}` : "";

  if (status === "approved") return { label: `Already participating${team}`, disabled: true, className: "joined" };
  if (status === "pending") return { label: `Pending review${team}`, disabled: true, className: "pending" };
  if (status === "rejected") return { label: "Request rejected", disabled: false, className: "rejected" };
  if (competition?.can_join === false) return null;
  return { label: "Join Competition", disabled: false, className: "" };
}

export default function CompetitionHeader({ competition, onJoin, onEdit }) {
  const { user } = useAuth();
  const joinState = getJoinState(competition, user);

  return (
    <section className="competition-detail-header">
      <div
        className="competition-detail-cover"
        style={{
          backgroundImage: competition.banner_image || competition.cover_image
            ? `url(${competition.banner_image || competition.cover_image})`
            : undefined,
        }}
      />

      <div className="competition-detail-title-row">
        <div>
          <h1 className="competition-detail-title">{competition.name}</h1>
          <div className="competition-detail-round">
            Round: {competition.current_round}/{competition.total_rounds}
          </div>
          {competition.user_team?.name && (
            <div className="competition-user-team-note">
              Team: {competition.user_team.name} · {competition.user_team.status || "pending"}
            </div>
          )}
        </div>

        <div className="competition-header-actions">
          {competition.can_edit && (
            <button type="button" className="competition-edit-btn" onClick={onEdit}>
              Edit competition
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
