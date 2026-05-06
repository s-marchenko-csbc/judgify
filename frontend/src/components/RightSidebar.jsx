import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toggleSavedCompetition } from "../api/savedApi";
import { useLanguage } from "../context/LanguageContext";
import { getMaterialBadge, getMaterialMeta, getMaterialTitle, getMaterialUrl } from "../utils/materials";

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

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      className="card-heart-icon filled"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function CompetitionRecentItem({ item, t }) {
  return (
    <Link className="recent-item recent-item-link" to={`/competitions/${item.id}`}>
      <div
        className="recent-item-cover"
        style={item.cover_image ? { backgroundImage: `url(${item.cover_image})` } : undefined}
      />
      <div className="recent-item-content">
        <div className="recent-item-name">{item.name}</div>
        <div className="recent-item-meta">
          <span>{t("card.participants", { count: item.participants_count })}</span>
          <span>{t("sidebar.comments", { count: item.comments_count })}</span>
          {item.language && <span>{String(item.language).toUpperCase()}</span>}
          <span className={getStatusClass(item.status)}>{getStatusLabel(item.status, t)}</span>
        </div>
      </div>
    </Link>
  );
}

function MaterialRecentItem({ record, t }) {
  const material = record.material || {};
  const href = getMaterialUrl(material);
  const content = (
    <>
      <div className="recent-material-icon">{getMaterialBadge(material)}</div>
      <div className="recent-item-content">
        <div className="recent-item-name">{getMaterialTitle(material, t("profile.material"))}</div>
        <div className="recent-item-meta">
          <span>{record.competition_name}</span>
          <span>{getMaterialMeta(material, t)}</span>
        </div>
      </div>
    </>
  );
  return href ? (
    <a className="recent-item recent-material-item" href={href} target="_blank" rel="noreferrer">
      {content}
    </a>
  ) : (
    <div className="recent-item recent-material-item disabled">
      {content}
    </div>
  );
}

function SavedCard({ item, onSavedChange, t }) {
  const [saving, setSaving] = useState(false);

  const handleRemove = async () => {
    if (saving) return;
    setSaving(true);

    try {
      await toggleSavedCompetition(item.id, false);
      onSavedChange?.(item.id, false, item);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sidebar-card">
      <Link
        to={`/competitions/${item.id}`}
        className="sidebar-card-cover"
        style={item.cover_image ? { backgroundImage: `url(${item.cover_image})` } : undefined}
        aria-label={t("sidebar.openCompetition", { name: item.name })}
      />
      <div className="sidebar-card-info">
        <div className="sidebar-card-name-row">
          <Link to={`/competitions/${item.id}`} className="sidebar-card-name">{item.name}</Link>
          <button
            type="button"
            className="sidebar-heart-btn saved"
            onClick={handleRemove}
            aria-label={t("card.removeSaved")}
            title={t("card.removeSaved")}
            disabled={saving}
          >
            <HeartIcon />
          </button>
        </div>
        <div className="sidebar-card-meta">
          <span>{t("card.participants", { count: item.participants_count })}</span>
          <span>{t("sidebar.comments", { count: item.comments_count })}</span>
          {item.language && <span>{String(item.language).toUpperCase()}</span>}
          <span className={getStatusClass(item.status)}>{getStatusLabel(item.status, t)}</span>
        </div>
      </div>
    </div>
  );
}

function uniqueById(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function uniqueMaterialRecords(records = []) {
  const seen = new Set();
  return records.filter((record) => {
    const key = record?.material?.id || record?.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function RightSidebar({ data, onSavedChange }) {
  const { t } = useLanguage();

  if (!data) return null;

  const recentlyViewed = uniqueById(data.recently_viewed || data.last_competitions || []);
  const recentMaterials = uniqueMaterialRecords(data.recent_materials || []);

  return (
    <aside className="right-sidebar">
      <section className="right-panel-block">
        <h3>{t("sidebar.recentlyViewed")}</h3>
        <div className="last-competitions-list">
          {recentlyViewed.length === 0 && recentMaterials.length === 0 ? (
            <div className="sidebar-empty">{t("sidebar.emptyRecent")}</div>
          ) : (
            <>
              {recentlyViewed.length > 0 && (
                <>
                  <div className="recent-section-title">{t("sidebar.competitions")}</div>
                  {recentlyViewed.map((item) => <CompetitionRecentItem key={`competition-${item.id}`} item={item} t={t} />)}
                </>
              )}
              {recentMaterials.length > 0 && (
                <>
                  <div className="recent-section-title">{t("sidebar.materials")}</div>
                  {recentMaterials.map((record) => <MaterialRecentItem key={`material-${record.material?.id || record.id}`} record={record} t={t} />)}
                </>
              )}
            </>
          )}
        </div>
      </section>

      <section className="right-panel-block">
        <h3>{t("sidebar.saved")}</h3>
        <div className="sidebar-list">
          {(data.saved_competitions || []).length === 0 ? (
            <div className="sidebar-empty">{t("sidebar.emptySaved")}</div>
          ) : (
            (data.saved_competitions || []).map((item) => (
              <SavedCard key={item.id} item={item} onSavedChange={onSavedChange} t={t} />
            ))
          )}
        </div>
      </section>
    </aside>
  );
}
