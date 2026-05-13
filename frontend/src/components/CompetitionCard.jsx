import React, { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toggleSavedCompetition } from "../api/savedApi";
import { useLanguage } from "../context/LanguageContext";

function getStatusLabel(status, t) {
  return t(`statuses.${status}`, { defaultValue: status });
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

function formatRemaining(ms, t) {
  if (ms === null || ms === undefined) return t("card.noTimer");
  if (ms <= 0) return "00:00:00";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}${t("card.dayShort")} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return [hours, minutes, seconds]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}

function deriveRoundState(item, now) {
  const rounds = Array.isArray(item.rounds) ? item.rounds : [];
  if (!rounds.length) {
    return {
      currentRound: item.current_round || 0,
      totalRounds: item.total_rounds || 1,
      deadline: item.timer_deadline || null,
      status: item.status,
    };
  }

  const sortedRounds = [...rounds].sort((a, b) => {
    const orderA = Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : 0;
    const orderB = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0;
    return orderA - orderB;
  });

  let completed = 0;
  let activeIndex = 0;
  let nextDeadline = item.timer_deadline || null;

  sortedRounds.forEach((round, index) => {
    const start = round.starts_at ? new Date(round.starts_at).getTime() : null;
    const end = round.ends_at ? new Date(round.ends_at).getTime() : null;
    if (end && now > end) completed = index + 1;
    if (!activeIndex && start && end && now >= start && now <= end && completed === index) {
      activeIndex = index + 1;
      nextDeadline = round.ends_at;
    }
  });

  if (!activeIndex && item.status === "active") {
    activeIndex = Math.min(sortedRounds.length, completed + 1);
    nextDeadline = sortedRounds[activeIndex - 1]?.starts_at || sortedRounds[activeIndex - 1]?.ends_at || item.timer_deadline || null;
  }

  return {
    currentRound: activeIndex || item.current_round || 0,
    totalRounds: sortedRounds.length || item.total_rounds || 1,
    deadline: nextDeadline,
    status: item.status,
  };
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

function CompetitionCard({ item, onSavedChange, now = Date.now() }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [saved, setSaved] = useState(Boolean(item.is_saved));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSaved(Boolean(item.is_saved));
  }, [item.is_saved]);

  const roundState = useMemo(() => deriveRoundState(item, now), [item, now]);

  const remainingMs = useMemo(() => {
    if (!roundState.deadline) return null;
    return new Date(roundState.deadline).getTime() - now;
  }, [roundState.deadline, now]);

  const isTimerExpired = remainingMs !== null && remainingMs <= 0;
  const uiStatus = roundState.status;

  const hasUserParticipation = ["approved", "pending"].includes(item.user_participation_status);
  const participationHint = item.user_participation_status === "pending" ? t("card.pendingReview") : "";

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

    try {
      await toggleSavedCompetition(item.id, nextSaved);

      if (onSavedChange) {
        onSavedChange(item.id, nextSaved, item);
      }
    } catch (error) {
      console.error(error);
      setSaved(!nextSaved);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`competition-card competition-card--interactive ${hasUserParticipation ? "competition-card--user-participation" : ""}`}
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
            {formatRemaining(remainingMs, t)}
          </div>
        )}

        <button
          type="button"
          className={`card-bookmark-btn ${saved ? "saved" : ""}`}
          onClick={handleSavedClick}
          aria-label={saved ? t("card.removeSaved") : t("card.save")}
          title={saved ? t("card.removeSaved") : t("card.save")}
          disabled={saving}
        >
          <HeartIcon filled={saved} />
        </button>
      </div>

      <div className="card-body">
        <div className="card-name-row">
          <div className="card-name">{item.name}</div>
          <div className="card-tags-inline">
            {item.industry && (
              <span className="card-industry-tag">{t(`options.industry.${item.industry}`, { defaultValue: item.industry })}</span>
            )}
            {item.language && (
              <span className="card-industry-tag">{String(item.language).toUpperCase()}</span>
            )}
          </div>
        </div>

        <div className="card-round">
          {t("card.round", { current: roundState.currentRound, total: roundState.totalRounds })}
        </div>

        {item.short_description && (
          <div className="card-description">{item.short_description}</div>
        )}
      </div>

      <div className="card-footer">
        <span>{t("card.participants", { count: item.participants_count })}</span>
        <span className={getStatusClass(uiStatus)}>
          {getStatusLabel(uiStatus, t)}
        </span>
        {participationHint && <span className="card-participation-hint">{participationHint}</span>}
      </div>
    </div>
  );
}

export default memo(CompetitionCard);
