import React from "react";

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

function BannerItem({ item }) {
  return (
    <div className="last-competition-banner">
      <div
        className="last-competition-banner-cover"
        style={
          item.cover_image
            ? { backgroundImage: `url(${item.cover_image})` }
            : undefined
        }
      />
      <div className="last-competition-banner-content">
        <div className="last-competition-banner-name">{item.name}</div>
        <div className="last-competition-banner-meta">
          <span>👤 {item.participants_count}</span>
          <span>💬 {item.comments_count}</span>
          <span className={getStatusClass(item.status)}>
            {getStatusLabel(item.status)}
          </span>
        </div>
      </div>
    </div>
  );
}

function SavedCard({ item }) {
  return (
    <div className="sidebar-card">
      <div
        className="sidebar-card-cover"
        style={
          item.cover_image
            ? { backgroundImage: `url(${item.cover_image})` }
            : undefined
        }
      />
      <div className="sidebar-card-info">
        <div className="sidebar-card-name">{item.name}</div>
        <div className="sidebar-card-meta">
          <span>👤 {item.participants_count}</span>
          <span>💬 {item.comments_count}</span>
          <span className={getStatusClass(item.status)}>
            {getStatusLabel(item.status)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function RightSidebar({ data }) {
  if (!data) return null;

  return (
    <aside className="right-sidebar">
      <section className="right-panel-block">
        <h3>Last Competitions</h3>
        <div className="last-competitions-list">
          {data.last_competitions.map((item) => (
            <BannerItem key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="right-panel-block">
        <h3>Saved</h3>
        <div className="sidebar-list">
          {data.saved_competitions.map((item) => (
            <SavedCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </aside>
  );
}