import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
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
  onCommentPost,
  onAnnouncementCreate,
  onAnnouncementUpdate,
  onAnnouncementDelete,
}) {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const announcements = useMemo(() => competition.announcements || [], [competition.announcements]);

  const fullDescription = String(competition.full_description || competition.description || competition.short_description || "").trim();
  const shortDescription = String(competition.short_description || "").trim();
  const [draft, setDraft] = useState({ id: null, title: "", text: "", is_pinned: false });
  const [commentDrafts, setCommentDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setDraft({ id: null, title: "", text: "", is_pinned: false });
    setCommentDrafts({});
    setMessage("");
  }, [competition.id]);

  const resetDraft = () => setDraft({ id: null, title: "", text: "", is_pinned: false });

  const startEdit = (announcement) => {
    setDraft({
      id: announcement.id,
      title: announcement.title || "",
      text: announcement.text || "",
      is_pinned: Boolean(announcement.is_pinned),
    });
    setMessage("");
  };

  const submitAnnouncement = async (event) => {
    event.preventDefault();
    if (!competition.can_edit || !draft.title.trim() || !draft.text.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        title: draft.title.trim(),
        text: draft.text.trim(),
        is_pinned: draft.is_pinned,
      };
      if (draft.id) await onAnnouncementUpdate?.(draft.id, payload);
      else await onAnnouncementCreate?.(payload);
      resetDraft();
    } catch (error) {
      setMessage(error?.message || t("overviewTab.announcementSaveError", { defaultValue: "Could not save announcement." }));
    } finally {
      setSaving(false);
    }
  };

  const removeAnnouncement = async (announcementId) => {
    if (!onAnnouncementDelete) return;
    setSaving(true);
    setMessage("");
    try {
      await onAnnouncementDelete(announcementId);
      if (draft.id === announcementId) resetDraft();
    } catch (error) {
      setMessage(error?.message || t("overviewTab.announcementDeleteError", { defaultValue: "Could not delete announcement." }));
    } finally {
      setSaving(false);
    }
  };

  const submitComment = async (announcementId) => {
    const text = String(commentDrafts[announcementId] || "").trim();
    if (!text || !onCommentPost) return;
    setSaving(true);
    setMessage("");
    try {
      await onCommentPost(announcementId, text);
      setCommentDrafts((prev) => ({ ...prev, [announcementId]: "" }));
    } catch (error) {
      setMessage(error?.message || t("overviewTab.commentSaveError", { defaultValue: "Could not post comment." }));
    } finally {
      setSaving(false);
    }
  };

  const authorName = (announcement) =>
    announcement.author_name || announcement.author || t("overviewTab.organizer", { defaultValue: "Organizer" });
  const avatar = (announcement) =>
    announcement.author_avatar_url || announcement.avatar || "https://api.dicebear.com/7.x/initials/svg?seed=Organizer";
  const dateLabel = (announcement) => {
    if (announcement.postedAgo) return announcement.postedAgo;
    if (!announcement.created_at) return "";
    return new Date(announcement.created_at).toLocaleString();
  };

  return (
    <section className="competition-panel">
      <StreamBlock competition={competition} />

      <section className="competition-description-card">
        <h2 className="competition-section-title">
          {t("overviewTab.description", { defaultValue: "Competition description" })}
        </h2>
        {shortDescription && shortDescription !== fullDescription && (
          <p className="competition-description-lead">{shortDescription}</p>
        )}
        <p className="competition-description-text">
          {fullDescription || t("competitionPage.descriptionFallback")}
        </p>
      </section>

      <h2 className="competition-section-title">{t("overviewTab.announcements")}</h2>

      {competition.can_edit && (
        <form className="announcement-editor" onSubmit={submitAnnouncement}>
          <input
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            placeholder={t("overviewTab.announcementTitle", { defaultValue: "Announcement title" })}
          />
          <textarea
            value={draft.text}
            onChange={(event) => setDraft((prev) => ({ ...prev, text: event.target.value }))}
            placeholder={t("overviewTab.announcementText", { defaultValue: "Message for participants" })}
            rows="4"
          />
          <div className="announcement-editor-actions">
            <label>
              <input
                type="checkbox"
                checked={draft.is_pinned}
                onChange={(event) => setDraft((prev) => ({ ...prev, is_pinned: event.target.checked }))}
              />
              {t("overviewTab.pinAnnouncement", { defaultValue: "Pin" })}
            </label>
            <button type="submit" disabled={saving || !draft.title.trim() || !draft.text.trim()}>
              {draft.id
                ? t("overviewTab.saveAnnouncement", { defaultValue: "Save" })
                : t("overviewTab.addAnnouncement", { defaultValue: "Add announcement" })}
            </button>
            {draft.id && (
              <button type="button" className="secondary" onClick={resetDraft} disabled={saving}>
                {t("overviewTab.cancelEdit", { defaultValue: "Cancel" })}
              </button>
            )}
          </div>
          {message && <span className="announcement-message">{message}</span>}
        </form>
      )}

      {!announcements.length ? (
        <p className="competition-empty-note">{t("overviewTab.emptyAnnouncements")}</p>
      ) : (
        <div className="announcement-list">
          {announcements.map((announcement) => (
            <article className="announcement-card" key={announcement.id}>
              <div className="announcement-header">
                <div className="announcement-author-wrap">
                  <img
                    src={avatar(announcement)}
                    alt={authorName(announcement)}
                    className="announcement-avatar"
                  />
                  <div>
                    <div className="announcement-author">{authorName(announcement)}</div>
                    <div className="announcement-title">{announcement.title}</div>
                  </div>
                </div>

                <div className="announcement-meta">
                  {announcement.is_pinned && <span>{t("overviewTab.pinned", { defaultValue: "Pinned" })}</span>}
                  <time>{dateLabel(announcement)}</time>
                </div>
              </div>

              <p className="announcement-text">{announcement.text}</p>

              {announcement.can_edit && (
                <div className="announcement-card-actions">
                  <button type="button" onClick={() => startEdit(announcement)} disabled={saving}>
                    {t("overviewTab.editAnnouncement", { defaultValue: "Edit" })}
                  </button>
                  <button type="button" className="danger" onClick={() => removeAnnouncement(announcement.id)} disabled={saving}>
                    {t("overviewTab.deleteAnnouncement", { defaultValue: "Delete" })}
                  </button>
                </div>
              )}

              {isAuthenticated && announcement.can_comment !== false && (
                <div className="announcement-comment-form">
                  <input
                    type="text"
                    placeholder={t("overviewTab.commentPlaceholder")}
                    value={commentDrafts[announcement.id] || ""}
                    onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [announcement.id]: event.target.value }))}
                  />
                  <button type="button" onClick={() => submitComment(announcement.id)} disabled={saving || !String(commentDrafts[announcement.id] || "").trim()}>
                    {t("overviewTab.post")}
                  </button>
                </div>
              )}

              {(announcement.comments || []).length > 0 && (
                <div className="announcement-comment-list">
                  {announcement.comments.map((comment) => (
                    <div key={comment.id} className="announcement-comment-item">
                      <strong>{comment.author_name || comment.author}:</strong> {comment.text}
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
          {!competition.can_edit && message && <span className="announcement-message">{message}</span>}
        </div>
      )}
    </section>
  );
}
