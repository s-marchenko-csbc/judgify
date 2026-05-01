import React from "react";

export default function OverviewTab({
  competition,
  commentText,
  onCommentTextChange,
  onCommentPost,
}) {
  const announcement = competition.announcements?.[0];

  if (!announcement) {
    return <div className="competition-panel">No announcements yet.</div>;
  }

  return (
    <section className="competition-panel">
      <h2 className="competition-section-title">Announcements</h2>

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
            placeholder="Leave a comment..."
            value={commentText}
            onChange={(e) => onCommentTextChange(e.target.value)}
          />
          <button type="button" onClick={onCommentPost}>
            Post
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
    </section>
  );
}