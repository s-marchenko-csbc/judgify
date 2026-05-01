import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toggleCompetitionSaved } from "../api/landingApi";

function getStatusLabel(status) {
  const map = {
    active: "Online",
    finished: "Finished",
    judging: "Judging",
    archived: "Archived",
    registration_open: "Registration open",
    upcoming: "Upcoming",
  };

  return map[status] || status;
}

function getStatusClass(status) {
  const map = {
    active: "status-active",
    finished: "status-finished",
    judging: "status-judging",
    archived: "status-archived",
    registration_open: "status-registration-open",
    upcoming: "status-upcoming",
  };

  return map[status] || "status-default";
}

function formatRemaining(ms) {
  if (ms === null || ms === undefined) return "No timer";
  if (ms <= 0) return "00:00:00";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return [hours, minutes, seconds]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}

function HeartIcon({ filled = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      className={`card-heart-icon ${filled ? "filled" : ""}`}
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

export default function CompetitionCard({ item, onSavedChange }) {
  const navigate = useNavigate();

  const [now, setNow] = useState(Date.now());
  const [saved, setSaved] = useState(Boolean(item.is_saved));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setSaved(Boolean(item.is_saved));
  }, [item.is_saved]);

  const remainingMs = useMemo(() => {
    if (!item.timer_deadline) return null;
    return new Date(item.timer_deadline).getTime() - now;
  }, [item.timer_deadline, now]);

  const isTimerExpired = remainingMs !== null && remainingMs <= 0;

  const uiStatus =
    item.status === "active" && isTimerExpired
      ? "finished"
      : item.status;

  const isDanger =
    remainingMs !== null &&
    remainingMs > 0 &&
    remainingMs <= 5 * 60 * 1000;

  const openCompetition = () => {
    navigate(`/competitions/${item.id}`, {
      state: {
        competition: {
          ...item,
          status: uiStatus,
        },
      },
    });
  };

  const handleSavedClick = async (e) => {
    e.stopPropagation();

    if (saving) return;

    const nextSaved = !saved;
    setSaved(nextSaved);
    setSaving(true);

    if (onSavedChange) {
      onSavedChange(item.id, nextSaved);
    }

    try {
      await toggleCompetitionSaved(item.id, nextSaved);
    } catch (error) {
      console.warn("Saved state was updated locally, but backend sync failed.", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="competition-card competition-card--interactive"
      onClick={openCompetition}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openCompetition();
        }
      }}
    >
      <div
        className="card-cover"
        style={
          item.cover_image
            ? { backgroundImage: `url(${item.cover_image})` }
            : undefined
        }
      >
        {item.status !== "archived" && remainingMs !== null && (
          <div className={`card-timer ${isDanger ? "danger" : ""}`}>
            {formatRemaining(remainingMs)}
          </div>
        )}

        <button
          type="button"
          className={`card-bookmark-btn ${saved ? "saved" : ""}`}
          onClick={handleSavedClick}
          aria-label={saved ? "Remove from saved" : "Save competition"}
          title={saved ? "Remove from saved" : "Save competition"}
          disabled={saving}
        >
          <HeartIcon filled={saved} />
        </button>
      </div>

      <div className="card-body">
        <div className="card-name-row">
          <div className="card-name">{item.name}</div>
          {item.industry && (
            <span className="card-industry-tag">{item.industry}</span>
          )}
        </div>

        <div className="card-round">
          Round: {item.current_round}/{item.total_rounds}
        </div>

        {item.short_description && (
          <div className="card-description">{item.short_description}</div>
        )}
      </div>

      <div className="card-footer">
        <span>👤 {item.participants_count} participants</span>
        <span className={getStatusClass(uiStatus)}>
          {getStatusLabel(uiStatus)}
        </span>
      </div>
    </div>
  );
}
