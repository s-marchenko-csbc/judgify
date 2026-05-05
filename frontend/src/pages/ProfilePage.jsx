import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import CompetitionCard from "../components/CompetitionCard";
import { fetchProfileDashboard, reviewCompetitionCreation, reviewJoinRequest, updateProfileDashboard, updateTeamManagement } from "../api/profileApi";
import { useAuth } from "../context/AuthContext";
import AccountSwitcher from "../components/AccountSwitcher";

const roleLabels = {
  organizer: "Organizer",
  participant: "Participant",
  viewer: "Viewer",
  admin: "Administrator",
};

function normalizeRole(role) {
  if (role === "administrator") return "admin";
  return role || "participant";
}

function getStatusLabel(status) {
  const map = {
    active: "Online",
    finished: "Finished",
    judging: "Judging",
    archived: "Archived",
    registration_open: "Registration open",
    upcoming: "Upcoming",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
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
    pending: "status-registration-open",
    approved: "status-active",
    rejected: "status-finished",
  };
  return map[status] || "status-default";
}

function mergeSavedState(items, savedIds) {
  return (items || []).map((item) => ({ ...item, is_saved: savedIds.has(item.id) || Boolean(item.is_saved) }));
}

function uniqueById(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function LastCompetitionBanner({ item }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="last-competition-banner profile-shared-banner" onClick={() => navigate(`/competitions/${item.id}`, { state: { competition: item } })}>
      <div className="last-competition-banner-cover" style={item.cover_image ? { backgroundImage: `url(${item.cover_image})` } : undefined} />
      <div className="last-competition-banner-content">
        <div className="last-competition-banner-name">{item.name}</div>
        <div className="last-competition-banner-meta">
          <span>👤 {item.participants_count}</span>
          <span>💬 {item.comments_count}</span>
          <span className={getStatusClass(item.status)}>{getStatusLabel(item.status)}</span>
        </div>
      </div>
    </button>
  );
}

function StatsBlock({ role, statsData, onNavigate }) {
  const isOrganizer = role === "organizer" || role === "admin";
  const stats = isOrganizer
    ? [
        { icon: "📅", value: statsData?.organized ?? statsData?.active ?? 0, label: "organized" },
        { icon: "⏳", value: statsData?.pending ?? 0, label: "pending" },
        { icon: "🏁", value: statsData?.archived ?? 0, label: "archived" },
        { icon: "🏅", value: statsData?.badges ?? 0, label: "badges" },
      ]
    : [
        { icon: "🏅", value: statsData?.badges ?? 0, label: "badges" },
        { icon: "📄", value: statsData?.certificates ?? 0, label: "certificates" },
        { icon: "⏳", value: statsData?.pending ?? 0, label: "pending" },
        { icon: "🏁", value: statsData?.archived ?? 0, label: "archived" },
      ];

  return (
    <section className="profile-panel">
      <h2>{isOrganizer ? "Organizer stats" : "Participant stats"}</h2>
      <div className="profile-stats-cards">
        {stats.map((stat) => (
          <button
            type="button"
            className={`profile-stat-tile ${["pending", "archived"].includes(stat.label) ? "profile-stat-tile--link" : ""}`}
            key={stat.label}
            onClick={() => ["pending", "archived"].includes(stat.label) && onNavigate?.(stat.label)}
            disabled={!["pending", "archived"].includes(stat.label)}
          >
            <span>{stat.icon}</span>
            <strong>{stat.value}</strong>
            <small>{stat.label}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function CreateCompetitionPanel() {
  const navigate = useNavigate();
  return (
    <section className="profile-create-panel">
      <div>
        <span className="profile-section-kicker">Organizer tools</span>
        <h2>Create a new competition</h2>
        <p>Prepare base info, rounds, deadlines, jury roles and publication status from one workspace.</p>
      </div>
      <button type="button" onClick={() => navigate("/competitions/new")}>+ Create competition</button>
    </section>
  );
}

function DraftsPanel({ items = [] }) {
  return (
    <section className="profile-panel">
      <h2>My organized competitions</h2>
      {items.length === 0 ? <div className="profile-empty-state">No organized competitions.</div> : (
        <div className="profile-draft-list">
          {items.map((draft) => (
            <button type="button" className="profile-draft-card" key={draft.id} onClick={() => window.location.assign(`/competitions/${draft.id}/edit`)}>
              <strong>{draft.name}</strong>
              <span>{draft.stage || draft.status_label || `Step ${draft.setup_step || 1} · ${draft.status || "Draft"}`} · approval: {getStatusLabel(draft.organizer_approval_status || "pending")}</span>
              <div className="profile-progress"><i style={{ width: `${draft.progress || draft.completion_percent || 35}%` }} /></div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function TeamAccessPanel({ teams = [], currentUserId, onManageTeam }) {
  if (!teams.length) return null;
  return (
    <section className="profile-panel profile-team-panel">
      <h2>My teams</h2>
      <div className="profile-team-list">
        {teams.map((team) => {
          const isCaptain = Number(team.captain) === Number(currentUserId);
          return (
            <article className="profile-team-card" key={team.id}>
              <div className="profile-team-card-head">
                <div><strong>{team.name}</strong><span>{team.competition_name}</span></div>
                <em className={`team-status team-status-${team.status}`}>{team.status}</em>
              </div>
              <div className="profile-team-captain">Captain: {team.captain_name || "not assigned"}{isCaptain ? " · you" : ""}</div>
              <div className="profile-team-members">
                {(team.members || []).map((member) => {
                  const isSelf = Number(member.user) === Number(currentUserId);
                  const canTransfer = isCaptain && !isSelf && member.user && ["pending", "approved"].includes(member.status);
                  const canWithdraw = isCaptain && !isSelf && member.status !== "withdrawn";
                  return (
                    <div className="profile-team-member" key={member.id} title={member.user_name || member.display_name}>
                      <span>{(member.user_name || member.display_name || "U").slice(0, 1).toUpperCase()}</span>
                      <div><strong>{member.user_name || member.display_name}</strong><small>{member.role} · {member.status}{isSelf ? " · you" : ""}</small></div>
                      {isCaptain && <div className="profile-team-member-actions">
                        {canTransfer && <button type="button" onClick={() => onManageTeam?.(team.id, { action: "transfer_captain", member_id: member.id })}>Make captain</button>}
                        {canWithdraw && <button type="button" className="danger" onClick={() => onManageTeam?.(team.id, { action: "update_member", member_id: member.id, status: "withdrawn", role: member.role })}>Remove</button>}
                      </div>}
                    </div>
                  );
                })}
              </div>
              {isCaptain && <p className="profile-team-note">Only one captain is allowed. Captain rights can be transferred to another team member.</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CompetitionSection({ title, items = [], savedIds, onSavedChange, emptyText }) {
  return (
    <section className="profile-panel profile-competition-section">
      <h2>{title}</h2>
      {items.length === 0 ? <div className="profile-empty-state">{emptyText || "No competitions in this section yet."}</div> : (
        <div className="cards-grid profile-competition-grid">
          {items.map((item) => <CompetitionCard key={item.id} item={{ ...item, is_saved: savedIds.has(item.id) || Boolean(item.is_saved) }} onSavedChange={onSavedChange} />)}
        </div>
      )}
    </section>
  );
}

function AwardAccordion({ title, count, items = [], emptyText }) {
  const latest = items[0];
  return (
    <details className="profile-panel profile-award-accordion" open={Boolean(latest)}>
      <summary>
        <span>{title}</span>
        <strong>{count ?? items.length}</strong>
      </summary>
      {!latest ? <div className="profile-empty-state">{emptyText}</div> : (
        <>
          <article className="profile-latest-award">
            <small>Latest</small>
            <strong>{latest.title || latest.file?.original_name || title}</strong>
            <span>{latest.competition_name || latest.badge_type || latest.verification_code || "Personal achievement"}</span>
          </article>
          <div className="profile-resource-list profile-award-list">
            {items.map((item) => (
              <div className="profile-resource-item" key={item.id || `${title}-${item.title}`}>
                <strong>{item.title || item.file?.original_name || title}</strong>
                <span>{item.competition_name || item.badge_type || item.verification_code || "—"}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </details>
  );
}

function BadgesCertificatesPanel({ badges = [], certificates = [], stats }) {
  return (
    <div className="profile-awards-stack">
      <AwardAccordion title="Badges" count={stats?.badges ?? badges.length} items={badges} emptyText="No badges yet." />
      <AwardAccordion title="Certificates" count={stats?.certificates ?? certificates.length} items={certificates} emptyText="No certificates yet." />
    </div>
  );
}

function PendingRequestsPanel({ role, requests = [], onReview }) {
  const navigate = useNavigate();
  const title = role === "organizer" ? "Registration requests" : role === "admin" ? "Competition creation requests" : "My pending applications";
  const canReviewJoin = role === "organizer" || role === "admin";

  return (
    <section className="profile-panel profile-pending-panel">
      <h2>{title}</h2>
      {requests.length === 0 ? <div className="profile-empty-state">No pending requests.</div> : (
        <div className="profile-resource-list">
          {requests.map((item) => (
            <div className="profile-resource-item profile-pending-item" key={`${item.type}-${item.id}`}>
              <button type="button" className="profile-pending-open" onClick={() => item.competition_id && navigate(`/competitions/${item.competition_id}`)}>
                <strong>{item.title || item.competition_name}</strong>
                <span>{item.competition_name && item.competition_name !== item.title ? `${item.competition_name} · ` : ""}{item.team_name ? `${item.team_name} · ` : ""}{item.role ? `${item.role} · ` : ""}{item.status}</span>
                {item.message && <small>{item.message}</small>}
              </button>
              {canReviewJoin && item.type === "join_request" && (
                <div className="profile-pending-actions">
                  <button type="button" onClick={() => onReview?.(item.id, "approved")}>Approve</button>
                  <button type="button" className="danger" onClick={() => onReview?.(item.id, "rejected")}>Reject</button>
                </div>
              )}
              {role === "admin" && item.type === "competition_creation_request" && (
                <div className="profile-pending-actions">
                  <button type="button" onClick={() => onReview?.(item.competition_id || item.id, "approved", item.type)}>Approve</button>
                  <button type="button" className="danger" onClick={() => onReview?.(item.competition_id || item.id, "rejected", item.type)}>Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ProfileEditForm({ user, onSave }) {
  const [draft, setDraft] = useState(() => ({
    displayName: user?.displayName || user?.username || "",
    email: user?.email || "",
    primaryRole: normalizeRole(user?.primaryRole),
    organization: user?.organization || "",
    country: user?.country || "Ukraine",
    bio: user?.bio || "",
    skillsText: (user?.skills || []).join(", "),
    interestsText: (user?.interests || []).join(", "),
    avatarDataUrl: user?.avatarUrl || user?.avatar_url || user?.avatar?.url || "",
  }));
  const setField = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));
  const handleAvatarFile = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setField("avatarDataUrl", String(reader.result || ""));
    reader.readAsDataURL(file);
  };
  const submit = (event) => {
    event.preventDefault();
    onSave({
      displayName: draft.displayName,
      email: draft.email,
      primaryRole: draft.primaryRole,
      organization: draft.organization,
      country: draft.country,
      bio: draft.bio,
      skills: draft.skillsText.split(",").map((item) => item.trim()).filter(Boolean),
      interests: draft.interestsText.split(",").map((item) => item.trim()).filter(Boolean),
      avatarDataUrl: draft.avatarDataUrl,
    });
  };
  return (
    <section className="profile-panel profile-edit-panel">
      <h2>Edit profile</h2>
      <form className="profile-form" onSubmit={submit}>
        <div className="profile-avatar-editor"><div className="profile-avatar-preview">{draft.avatarDataUrl ? <img src={draft.avatarDataUrl} alt="" /> : "Profile photo"}</div><label className="profile-avatar-upload">Upload profile photo<input type="file" accept="image/*" onChange={handleAvatarFile} /></label></div>
        <div className="profile-form-grid">
          <label>Display name<input value={draft.displayName} onChange={(e) => setField("displayName", e.target.value)} /></label>
          <label>Email<input type="email" value={draft.email} onChange={(e) => setField("email", e.target.value)} /></label>
          <label>Status<select value={draft.primaryRole} onChange={(e) => setField("primaryRole", e.target.value)}><option value="organizer">Organizer</option><option value="participant">Participant</option><option value="viewer">Viewer</option>{normalizeRole(user?.primaryRole) === "admin" && <option value="admin">Administrator</option>}</select></label>
          <label>Organization<input value={draft.organization} onChange={(e) => setField("organization", e.target.value)} /></label>
          <label>Country<input value={draft.country} onChange={(e) => setField("country", e.target.value)} /></label>
          <label>Skills<input value={draft.skillsText} onChange={(e) => setField("skillsText", e.target.value)} /></label>
        </div>
        <label>Interests<input value={draft.interestsText} onChange={(e) => setField("interestsText", e.target.value)} /></label>
        <label>Bio<textarea value={draft.bio} onChange={(e) => setField("bio", e.target.value)} /></label>
        <button className="profile-primary-btn" type="submit">Save profile</button>
      </form>
    </section>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading, isAuthenticated, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [profileStats, setProfileStats] = useState(null);
  const [profileBadges, setProfileBadges] = useState([]);
  const [profileCertificates, setProfileCertificates] = useState([]);
  const [profileMaterials, setProfileMaterials] = useState([]);
  const [draftCompetitions, setDraftCompetitions] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeCompetitions, setActiveCompetitions] = useState([]);
  const [archivedCompetitions, setArchivedCompetitions] = useState([]);
  const [teams, setTeams] = useState([]);

  const role = normalizeRole(user?.primaryRole);

  const loadDashboard = async () => {
    const dashboard = await fetchProfileDashboard();
    const saved = dashboard?.saved_competitions || [];
    const ids = new Set(saved.map((item) => item.id));
    setSavedIds(ids);
    setRecentlyViewed(mergeSavedState(dashboard?.recently_viewed || [], ids));
    setDraftCompetitions(dashboard?.draft_competitions || []);
    setPendingRequests(dashboard?.pending_requests || []);
    setActiveCompetitions(mergeSavedState(dashboard?.active_competitions || [], ids));
    setArchivedCompetitions(mergeSavedState(dashboard?.archived_competitions || [], ids));
    setTeams(dashboard?.teams || []);
    setProfileStats(dashboard?.stats || null);
    setProfileBadges(dashboard?.badges || []);
    setProfileCertificates(dashboard?.certificates || []);
    setProfileMaterials(dashboard?.materials || []);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    fetchProfileDashboard().then((dashboard) => {
      if (cancelled) return;
      const ids = new Set((dashboard?.saved_competitions || []).map((item) => item.id));
      setSavedIds(ids);
      setRecentlyViewed(mergeSavedState(dashboard?.recently_viewed || [], ids));
      setDraftCompetitions(dashboard?.draft_competitions || []);
      setPendingRequests(dashboard?.pending_requests || []);
      setActiveCompetitions(mergeSavedState(dashboard?.active_competitions || [], ids));
      setArchivedCompetitions(mergeSavedState(dashboard?.archived_competitions || [], ids));
      setTeams(dashboard?.teams || []);
      setProfileStats(dashboard?.stats || null);
      setProfileBadges(dashboard?.badges || []);
      setProfileCertificates(dashboard?.certificates || []);
      setProfileMaterials(dashboard?.materials || []);
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const handleSavedChange = (competitionId, nextSaved) => {
    setSavedIds((prev) => { const next = new Set(prev); if (nextSaved) next.add(competitionId); else next.delete(competitionId); return next; });
    const patch = (items) => items.map((competition) => competition.id === competitionId ? { ...competition, is_saved: nextSaved } : competition);
    setRecentlyViewed(patch);
    setActiveCompetitions(patch);
    setArchivedCompetitions(patch);
  };

  const handleReview = async (requestId, decision, type = "join_request") => {
    if (type === "competition_creation_request") {
      await reviewCompetitionCreation(requestId, decision);
    } else {
      await reviewJoinRequest(requestId, decision);
    }
    await loadDashboard();
  };


  const handleManageTeam = async (teamId, payload) => {
    await updateTeamManagement(teamId, payload);
    await loadDashboard();
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    ...(role !== "viewer" ? [{ id: "pending", label: "Pending" }] : []),
    { id: "archived", label: "Archived" },
    ...(role === "organizer" || role === "admin" ? [{ id: "drafts", label: "My competitions" }] : []),
  ];

  if (loading) return <div className="profile-dashboard-page"><main className="profile-dashboard-shell"><div className="profile-loading-panel">Loading profile...</div></main></div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="profile-dashboard-page">
      <main className="profile-dashboard-shell">
        <div className="profile-topbar">
          <button className="profile-back-btn" type="button" onClick={() => navigate(-1)}>←</button>
          <button className="profile-logo-link" type="button" onClick={() => navigate("/")} aria-label="Go to landing page">
            <span className="app-logo-mark" aria-hidden="true"><svg viewBox="0 0 64 64" role="img" focusable="false"><path d="M19 10c-5.1 3.4-8.1 8.9-8.1 15.1 0 8.6 6 14.1 13.5 21l7.6 7 7.6-7c7.5-6.9 13.5-12.4 13.5-21 0-6.2-3-11.7-8.1-15.1-4.8-3.2-11.5-2.5-15.2 1.7L32 13.6l1.7-1.9C30 7.5 23.8 6.8 19 10Z" /><path d="M22.3 19.5c-2 1.5-3.1 3.7-3.1 6.2 0 4 2.9 6.7 7.2 10.6l5.6 5.1 5.6-5.1c4.3-3.9 7.2-6.6 7.2-10.6 0-2.5-1.1-4.7-3.1-6.2-2.4-1.8-5.7-1.5-7.7.7L32 22.4l-2-2.2c-2-2.2-5.3-2.5-7.7-.7Z" /></svg></span>
            <span>Judgify</span>
          </button>
          <div className="profile-search"><span>⌕</span><input placeholder="Search" /></div>
          <AccountSwitcher compact />
        </div>

        <div className="profile-dashboard-grid">
          <section className="profile-left-column">
            <section className="profile-main-identity profile-panel">
              <div className="profile-photo-box">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : "Profile photo"}</div>
              <div className="profile-name-block"><h1>{user?.displayName || user?.username || "Name"}</h1><p>Status: {roleLabels[role] || "Participant"}</p>{user?.organization && <span>{user.organization}</span>}</div>
              <button className="profile-edit-link" type="button" onClick={() => setEditing((prev) => !prev)}>{editing ? "Close" : "Edit"}</button>
            </section>

            <nav className="profile-tabs-row" aria-label="Profile sections">
              {tabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
            </nav>

            {editing && <ProfileEditForm user={user} onSave={async (patch) => { try { const result = await updateProfileDashboard(patch); updateProfile(result?.user || patch); } catch (error) { console.error(error); updateProfile(patch); } setEditing(false); }} />}

            {(role === "organizer" || role === "admin") && activeTab === "overview" && <CreateCompetitionPanel />}
            {(role === "organizer" || role === "admin") && activeTab === "drafts" && <DraftsPanel items={draftCompetitions} />}
            {activeTab === "pending" && <PendingRequestsPanel role={role} requests={pendingRequests} onReview={handleReview} />}

            {role === "participant" && activeTab === "overview" && (
              <>
                <StatsBlock role={role} statsData={profileStats} onNavigate={setActiveTab} />
                <CompetitionSection title="Registered competitions" items={activeCompetitions} savedIds={savedIds} onSavedChange={handleSavedChange} emptyText="You are not registered for active or upcoming competitions yet." />
                <CompetitionSection title="Archived competitions" items={archivedCompetitions} savedIds={savedIds} onSavedChange={handleSavedChange} emptyText="No archived competitions yet." />
                <TeamAccessPanel teams={teams} currentUserId={user?.id} onManageTeam={handleManageTeam} />
                <BadgesCertificatesPanel badges={profileBadges} certificates={profileCertificates} stats={profileStats} />
              </>
            )}

            {(role === "organizer" || role === "admin") && activeTab === "overview" && (
              <>
                <StatsBlock role={role} statsData={profileStats} />
                <TeamAccessPanel teams={teams} currentUserId={user?.id} onManageTeam={handleManageTeam} />
                <BadgesCertificatesPanel badges={profileBadges} certificates={profileCertificates} stats={profileStats} />
              </>
            )}

            {role === "viewer" && activeTab === "overview" && (
              <section className="profile-panel profile-viewer-note"><h2>Viewer profile</h2><p>The viewer role keeps the workspace intentionally simple: recent views and saved public competitions.</p></section>
            )}

            {activeTab === "archived" && <CompetitionSection title="Archived competitions" items={archivedCompetitions} savedIds={savedIds} onSavedChange={handleSavedChange} emptyText="No archived competitions yet." />}
          </section>

          <aside className="profile-right-column">
            <section className="right-panel-block profile-recent-panel">
              <div className="profile-panel-header"><h2>Recently viewed</h2></div>
              <div className="last-competitions-list">{recentlyViewed.slice(0, role === "viewer" ? 6 : 4).map((item) => <LastCompetitionBanner key={item.id} item={item} />)}</div>
            </section>
            {role !== "viewer" && activeTab !== "overview" && <StatsBlock role={role} statsData={profileStats} onNavigate={setActiveTab} />}
            {(role === "participant" || role === "admin") && profileMaterials.length > 0 && (
              <section className="profile-panel"><h2>Personal materials</h2><div className="profile-resource-list">{profileMaterials.map((item) => <div className="profile-resource-item" key={item.id}><strong>{item.title || item.file?.original_name || "Material"}</strong><span>{item.competition_name || item.material_type || "File"}</span></div>)}</div></section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
