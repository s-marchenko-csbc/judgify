import React from "react";
import { useLanguage } from "../../../context/LanguageContext";

function getEmbedUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const parentHost = window.location.hostname || "localhost";

    if (host === "youtube.com" && url.pathname === "/watch") {
      const videoId = url.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }
    if (host === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }
    if (host === "youtube.com" && url.pathname.startsWith("/embed/")) return raw;

    if (host === "vimeo.com") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : "";
    }
    if (host === "player.vimeo.com" && url.pathname.startsWith("/video/")) return raw;

    if (host === "twitch.tv") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "videos" && parts[1]) return `https://player.twitch.tv/?video=${parts[1]}&parent=${parentHost}`;
      if (parts[0]) return `https://player.twitch.tv/?channel=${parts[0]}&parent=${parentHost}`;
    }
    if (host === "player.twitch.tv") {
      if (!url.searchParams.has("parent")) url.searchParams.set("parent", parentHost);
      return url.toString();
    }

    return raw;
  } catch {
    return "";
  }
}

function activeRoundForStream(competition) {
  const rounds = Array.isArray(competition.rounds) ? competition.rounds : [];
  if (!rounds.length) return null;
  const current = Number(competition.current_round || 0);
  return rounds.find((round, index) => index + 1 === current) || rounds.find((round) => round.is_stream_enabled) || null;
}

function StreamBlock({ competition }) {
  const { t } = useLanguage();
  const round = activeRoundForStream(competition);
  if (!round?.is_stream_enabled || (!round.stream_url && !round.stream_embed_url)) return null;

  const embedSrc = round.stream_embed_url || getEmbedUrl(round.stream_url);

  return (
    <section className="competition-stream-card">
      <div className="competition-stream-header">
        <h2 className="competition-section-title">{t("overviewTab.liveStream")}</h2>
        <span>{round.stream_label || round.title || t("overviewTab.roundStream")}</span>
      </div>
      {embedSrc ? (
        <div className="competition-stream-frame-wrap">
          <iframe
            src={embedSrc}
            title={round.stream_label || round.title || t("overviewTab.competitionStream")}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : (
        <a className="competition-stream-link" href={round.stream_url} target="_blank" rel="noreferrer">
          {t("overviewTab.openStream")}
        </a>
      )}
    </section>
  );
}

export default function OverviewTab({
  competition,
  commentText,
  onCommentTextChange,
  onCommentPost,
}) {
  const { t } = useLanguage();
  const announcement = competition.announcements?.[0];

  return (
    <section className="competition-panel">
      <StreamBlock competition={competition} />

      <h2 className="competition-section-title">{t("overviewTab.announcements")}</h2>

      {!announcement ? (
        <p className="competition-empty-note">{t("overviewTab.emptyAnnouncements")}</p>
      ) : (
        <div className="announcement-card">
          <div className="announcement-header">
            <div className="announcement-author-wrap">
              <img
                src={announcement.avatar}
                alt={announcement.author}
                className="announcement-avatar"
              />
              <div>
                <div className="announcement-author">{announcement.author}</div>
              </div>
            </div>

            <div className="announcement-time">🗂 {announcement.postedAgo}</div>
          </div>

          <p className="announcement-text">{announcement.text}</p>

          <div className="announcement-comment-form">
            <input
              type="text"
              placeholder={t("overviewTab.commentPlaceholder")}
              value={commentText}
              onChange={(e) => onCommentTextChange(e.target.value)}
            />
            <button type="button" onClick={onCommentPost}>
              {t("overviewTab.post")}
            </button>
          </div>

          {(announcement.comments || []).length > 0 && (
            <div className="announcement-comment-list">
              {announcement.comments.map((comment) => (
                <div key={comment.id} className="announcement-comment-item">
                  <strong>{comment.author}:</strong> {comment.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
