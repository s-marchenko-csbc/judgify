import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import AccountSwitcher from "../components/AccountSwitcher";
import { useAuth } from "../context/AuthContext";
import {
  createCompetitionDraft,
  createCompetitionInvitations,
  fetchCompetitionBuilder,
  publishCompetition,
  saveCompetitionBuilder,
} from "../api/competitionBuilderApi";

const steps = [
  { id: 1, title: "Basics", hint: "Card, catalog filters and public identity" },
  { id: 2, title: "Format & Access", hint: "Registration, review, teams and discovery" },
  { id: 3, title: "Schedule & Rounds", hint: "Registration, competition stages and round windows" },
  { id: 4, title: "Submissions & Evaluation", hint: "Submission rules, criteria and awards" },
  { id: 5, title: "Publish", hint: "Preview, validation and invitations" },
];

const defaultDraft = {
  name: "Untitled competition",
  short_description: "",
  full_description: "",
  cover_image: "",
  banner_image: "",
  status: "draft",
  event_type: "online",
  participation_type: "individual",
  industry: "programming",
  difficulty: "mixed",
  language: "uk",
  access_mode: "application",
  visibility_mode: "public",
  show_in_catalog: true,
  allow_sharing_link: true,
  allow_external_registration: true,
  registration_open: true,
  submissions_open: false,
  min_team_size: 1,
  max_team_size: 4,
  allow_user_team_invites: true,
  allow_organizer_team_assignment: true,
  setup_step: 1,
  completion_percent: 20,
  registration_starts_at: "",
  registration_ends_at: "",
  starts_at: "",
  ends_at: "",
  judging_starts_at: "",
  judging_ends_at: "",
  results_public_at: "",
  rounds: [{ title: "Round 1", description: "", starts_at: "", ends_at: "", submission_required: true, max_attempts: 1, is_stream_enabled: false, stream_url: "", stream_embed_url: "", stream_label: "", sort_order: 0 }],
  submission_settings: {
    submission_mode: "mixed",
    allowed_file_types: ["pdf", "zip", "ipynb"],
    max_file_size_mb: 25,
    max_submissions: 1,
    repository_url_required: false,
    demo_url_required: false,
    description_required: true,
  },
  judging_criteria: [{ title: "Quality", description: "", max_score: 10, weight: 1, sort_order: 0 }],
  awards: [{ title: "Winner", place: 1, issue_certificate: true, issue_badge: true, description: "" }],
};

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}


function extractIframeSrc(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/i);
  return match ? match[1].replace(/&amp;/g, "&") : text;
}

function buildEmbedUrl(value) {
  const raw = extractIframeSrc(value);
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

    if (host === "youtube.com" && url.pathname.startsWith("/embed/")) {
      return raw;
    }

    if (host === "vimeo.com") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : "";
    }

    if (host === "player.vimeo.com" && url.pathname.startsWith("/video/")) {
      return raw;
    }

    if (host === "twitch.tv") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "videos" && parts[1]) {
        return `https://player.twitch.tv/?video=${parts[1]}&parent=${parentHost}`;
      }
      if (parts[0]) {
        return `https://player.twitch.tv/?channel=${parts[0]}&parent=${parentHost}`;
      }
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

function normalizeStreamInput(value) {
  return extractIframeSrc(value);
}

function normalizeDraft(data) {
  const result = { ...defaultDraft, ...(data || {}) };
  [
    "registration_starts_at",
    "registration_ends_at",
    "starts_at",
    "ends_at",
    "judging_starts_at",
    "judging_ends_at",
    "results_public_at",
  ].forEach((key) => {
    result[key] = toDateTimeLocal(result[key]);
  });
  if (!result.rounds?.length) result.rounds = defaultDraft.rounds;
  result.rounds = result.rounds.map((round) => ({
    ...round,
    starts_at: toDateTimeLocal(round.starts_at),
    ends_at: toDateTimeLocal(round.ends_at),
  }));
  if (!result.judging_criteria?.length) result.judging_criteria = defaultDraft.judging_criteria;
  if (!result.awards?.length) result.awards = defaultDraft.awards;
  result.submission_settings = { ...defaultDraft.submission_settings, ...(result.submission_settings || {}) };
  return result;
}

function preparePayload(draft, step) {
  const payload = { ...draft, setup_step: step, completion_percent: Math.min(100, step * 20) };
  [
    "registration_starts_at",
    "registration_ends_at",
    "starts_at",
    "ends_at",
    "judging_starts_at",
    "judging_ends_at",
    "results_public_at",
  ].forEach((key) => {
    payload[key] = fromDateTimeLocal(payload[key]);
  });
  payload.rounds = (payload.rounds || []).map((round) => {
    const streamUrl = normalizeStreamInput(round.stream_url);
    const embedUrl = buildEmbedUrl(streamUrl);
    return {
      ...round,
      starts_at: fromDateTimeLocal(round.starts_at),
      ends_at: fromDateTimeLocal(round.ends_at),
      stream_url: streamUrl,
      stream_embed_url: round.is_stream_enabled ? embedUrl : "",
    };
  });
  payload.is_public = payload.visibility_mode === "public";
  payload.show_in_catalog = payload.visibility_mode === "public" && Boolean(payload.show_in_catalog);
  return payload;
}

function Field({ label, children, note }) {
  return <label className="builder-field"><span>{label}</span>{children}{note && <small>{note}</small>}</label>;
}


function timeValue(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function getScheduleErrors(draft) {
  const errors = [];
  const now = Date.now();
  const starts = timeValue(draft.starts_at);
  const ends = timeValue(draft.ends_at);
  const registrationStarts = timeValue(draft.registration_starts_at);
  const registrationEnds = timeValue(draft.registration_ends_at);
  const judgingStarts = timeValue(draft.judging_starts_at);
  const judgingEnds = timeValue(draft.judging_ends_at);
  const resultsAt = timeValue(draft.results_public_at);

  if (starts && starts < now) errors.push("Competition cannot start before it is created.");
  if (ends && ends < now) errors.push("Competition cannot end before it is created.");
  if (starts && ends && ends <= starts) errors.push("Competition end must be later than competition start.");
  if (registrationStarts && starts && registrationStarts > starts) errors.push("Registration cannot start after the competition starts.");
  if (registrationEnds && starts && registrationEnds > starts) errors.push("Registration must end no later than the competition start.");
  if (registrationStarts && registrationEnds && registrationEnds <= registrationStarts) errors.push("Registration end must be later than registration start.");
  if (judgingStarts && ends && judgingStarts < ends) errors.push("Judging cannot start before the competition ends.");
  if (judgingStarts && judgingEnds && judgingEnds <= judgingStarts) errors.push("Judging end must be later than judging start.");
  if (resultsAt && judgingEnds && resultsAt < judgingEnds) errors.push("Results cannot be published before judging ends.");

  let previousRoundEnd = null;
  (draft.rounds || []).forEach((round, index) => {
    const roundStart = timeValue(round.starts_at);
    const roundEnd = timeValue(round.ends_at);
    const label = round.title || `Round ${index + 1}`;
    if (roundStart && starts && roundStart < starts) errors.push(`${label}: round must start within the competition window.`);
    if (roundEnd && ends && roundEnd > ends) errors.push(`${label}: round must end within the competition window.`);
    if (roundStart && roundEnd && roundEnd <= roundStart) errors.push(`${label}: round end must be later than round start.`);
    if (previousRoundEnd && roundStart && roundStart < previousRoundEnd) errors.push(`${label}: next round cannot start before the previous round ends.`);
    if (roundEnd) previousRoundEnd = roundEnd;
  });

  return [...new Set(errors)];
}

function CheckField({ label, checked, onChange, note }) {
  return (
    <label className="builder-field builder-check-field">
      <span>{label}</span>
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
      {note && <small>{note}</small>}
    </label>
  );
}

function ToggleCard({ active, title, text, onClick }) {
  return (
    <button type="button" className={`builder-choice ${active ? "active" : ""}`} onClick={onClick}>
      <strong>{title}</strong>
      <span>{text}</span>
    </button>
  );
}

export default function CompetitionBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(defaultDraft);
  const [competitionId, setCompetitionId] = useState(id || null);
  const [statusText, setStatusText] = useState("");
  const [inviteText, setInviteText] = useState("");
  const [teamInviteText, setTeamInviteText] = useState("");
  const [saving, setSaving] = useState(false);
  const draftCreationStartedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (id) {
      fetchCompetitionBuilder(id).then((data) => {
        setDraft(normalizeDraft(data));
        setStep(data.setup_step || 1);
      }).catch((error) => setStatusText(error.message));
    } else {
      if (draftCreationStartedRef.current) return;
      draftCreationStartedRef.current = true;
      createCompetitionDraft(preparePayload(defaultDraft, 1)).then((data) => {
        setCompetitionId(data.id);
        setDraft(normalizeDraft(data));
        navigate(`/competitions/${data.id}/edit`, { replace: true });
      }).catch((error) => {
        draftCreationStartedRef.current = false;
        setStatusText(error.message);
      });
    }
  }, [id, isAuthenticated, navigate]);

  const setField = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));
  const setNested = (section, field, value) => setDraft((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));

  const updateArrayItem = (section, index, field, value) => {
    setDraft((prev) => ({
      ...prev,
      [section]: prev[section].map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  };

  const addArrayItem = (section, item) => {
    setDraft((prev) => ({ ...prev, [section]: [...prev[section], { ...item, sort_order: prev[section].length }] }));
  };

  const saveDraft = async (nextStep = step) => {
    if (!competitionId || saving) return null;
    setSaving(true);
    setStatusText("Saving draft...");
    try {
      const saved = await saveCompetitionBuilder(competitionId, preparePayload(draft, nextStep));
      setDraft(normalizeDraft(saved));
      setStep(nextStep);
      setStatusText("Draft saved");
      return saved;
    } catch (error) {
      setStatusText(error.message || "Draft was not saved");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const validation = useMemo(() => {
    const missing = [];
    if (!draft.name || draft.name === "Untitled competition") missing.push("competition title");
    if (!draft.short_description) missing.push("short description");
    if (!draft.ends_at) missing.push("competition end");
    if (!draft.rounds?.length) missing.push("at least one round");
    if ((draft.rounds || []).some((round) => !round.ends_at)) missing.push("round end time");
    if (draft.access_mode === "invite_only" && !draft.allow_sharing_link) missing.push("sharing link or invitations");
    return [...missing, ...getScheduleErrors(draft)];
  }, [draft]);

  const scheduleErrors = useMemo(() => getScheduleErrors(draft), [draft]);

  const handlePublish = async () => {
    await saveDraft(5);
    try {
      const published = await publishCompetition(competitionId);
      setDraft(normalizeDraft(published));
      setStatusText("Competition published");
      navigate(`/competitions/${published.id || competitionId}`);
    } catch (error) {
      setStatusText(error.message || "Competition was not published");
    }
  };

  const queueInvitations = async (targetType) => {
    const raw = targetType === "team" ? teamInviteText : inviteText;
    const recipients = raw.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
    if (!recipients.length) return;
    try {
      await createCompetitionInvitations(competitionId, {
        recipients,
        target_type: targetType,
        team_name: targetType === "team" ? "Invited team" : "",
        message: `You are invited to join ${draft.name}.`,
        queue_messages: true,
      });
      setStatusText("Invitations queued as outbound messages");
      if (targetType === "team") setTeamInviteText(""); else setInviteText("");
    } catch (error) {
      setStatusText(error.message || "Invitations were not queued");
    }
  };

  if (loading) return <div className="builder-page"><main className="builder-shell">Loading...</main></div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="builder-page">
      <main className="builder-shell">
        <div className="builder-topbar">
          <button type="button" onClick={() => navigate("/profile")}>Profile</button>
          <div><strong>Competition constructor</strong><span>{statusText}</span></div>
          <div className="builder-topbar-actions"><button type="button" onClick={() => saveDraft(step)} disabled={saving}>Save draft</button><AccountSwitcher compact /></div>
        </div>

        <section className="builder-hero">
          <div>
            <span className="profile-section-kicker">Step {step} of 5</span>
            <h1>{draft.name || "New competition"}</h1>
            <p>One draft is updated through the whole setup flow. The same fields feed catalog filters, cards, profile blocks and participation rules.</p>
          </div>
          <div className="builder-progress"><i style={{ width: `${Math.min(100, step * 20)}%` }} /></div>
        </section>

        <div className="builder-layout">
          <aside className="builder-steps">
            {steps.map((item) => (
              <button key={item.id} type="button" className={step === item.id ? "active" : ""} onClick={() => saveDraft(item.id)}>
                <strong>{item.title}</strong><span>{item.hint}</span>
              </button>
            ))}
          </aside>

          <section className="builder-panel">
            {step === 1 && (
              <div className="builder-form-grid">
                <Field label="Title"><input value={draft.name} onChange={(e) => setField("name", e.target.value)} /></Field>
                <Field label="Category / industry" note="Directly used in catalog filters"><select value={draft.industry} onChange={(e) => setField("industry", e.target.value)}><option value="programming">Programming</option><option value="design">Design</option><option value="robotics">Robotics</option><option value="cybersecurity">Cybersecurity</option></select></Field>
                <Field label="Event type"><select value={draft.event_type} onChange={(e) => setField("event_type", e.target.value)}><option value="online">Online</option><option value="offline">Offline</option><option value="hybrid">Hybrid</option></select></Field>
                <Field label="Difficulty"><select value={draft.difficulty} onChange={(e) => setField("difficulty", e.target.value)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="mixed">Mixed</option></select></Field>
                <Field label="Language" note="Used in landing filters"><select value={draft.language} onChange={(e) => setField("language", e.target.value)}><option value="uk">Ukrainian</option><option value="en">English</option><option value="pl">Polish</option><option value="de">German</option><option value="fr">French</option><option value="es">Spanish</option><option value="other">Other</option></select></Field>
                <Field label="Short description"><textarea value={draft.short_description} onChange={(e) => setField("short_description", e.target.value)} /></Field>
                <Field label="Full description"><textarea value={draft.full_description} onChange={(e) => setField("full_description", e.target.value)} /></Field>
                <Field label="Cover image URL"><input value={draft.cover_image || ""} onChange={(e) => setField("cover_image", e.target.value)} /></Field>
                <Field label="Banner image URL"><input value={draft.banner_image || ""} onChange={(e) => setField("banner_image", e.target.value)} /></Field>
              </div>
            )}

            {step === 2 && (
              <div className="builder-stack">
                <h2>Registration and distribution model</h2>
                <div className="builder-choice-grid">
                  <ToggleCard active={draft.access_mode === "open"} title="Open registration" text="Join immediately creates approved participation." onClick={() => setField("access_mode", "open")} />
                  <ToggleCard active={draft.access_mode === "application"} title="Application review" text="Join creates pending request until organizer/admin approves." onClick={() => setField("access_mode", "application")} />
                  <ToggleCard active={draft.access_mode === "invite_only"} title="Invite only" text="Users join through organizer invitations; hidden competitions may use private links." onClick={() => setField("access_mode", "invite_only")} />
                </div>
                <div className="builder-choice-grid">
                  <ToggleCard active={draft.participation_type === "individual"} title="Individual" text="Each participant submits independently." onClick={() => setField("participation_type", "individual")} />
                  <ToggleCard active={draft.participation_type === "team"} title="Team" text="Participants join or create teams." onClick={() => setField("participation_type", "team")} />
                  <ToggleCard active={draft.participation_type === "mixed"} title="Mixed" text="Individual and team participation are both allowed." onClick={() => setField("participation_type", "mixed")} />
                </div>
                <div className="builder-form-grid">
                  <Field label="Visibility"><select value={draft.visibility_mode} onChange={(e) => setField("visibility_mode", e.target.value)}><option value="public">Public catalog</option><option value="unlisted">Unlisted link</option><option value="private">Private</option></select></Field>
                  <CheckField label="Show in catalog" checked={draft.show_in_catalog} onChange={(value) => setField("show_in_catalog", value)} />
                  <CheckField label="Allow sharing link" checked={draft.allow_sharing_link} onChange={(value) => setField("allow_sharing_link", value)} />
                  <CheckField label="External registration" checked={draft.allow_external_registration} onChange={(value) => setField("allow_external_registration", value)} />
                  <Field label="Min team size"><input type="number" min="1" value={draft.min_team_size} onChange={(e) => setField("min_team_size", Number(e.target.value))} /></Field>
                  <Field label="Max team size"><input type="number" min="1" value={draft.max_team_size} onChange={(e) => setField("max_team_size", Number(e.target.value))} /></Field>
                  <CheckField label="User team invites" checked={draft.allow_user_team_invites} onChange={(value) => setField("allow_user_team_invites", value)} />
                  <CheckField label="Organizer team assignment" checked={draft.allow_organizer_team_assignment} onChange={(value) => setField("allow_organizer_team_assignment", value)} />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="builder-stack">
                <h2>Schedule and rounds</h2>
                <p className="builder-muted">Competition status, timers and catalog tabs are derived from these time windows and round dates.</p>
                <div className="builder-form-grid">
                  <Field label="Registration starts"><input type="datetime-local" value={draft.registration_starts_at || ""} onChange={(e) => setField("registration_starts_at", e.target.value)} /></Field>
                  <Field label="Registration ends"><input type="datetime-local" value={draft.registration_ends_at || ""} onChange={(e) => setField("registration_ends_at", e.target.value)} /></Field>
                  <Field label="Competition starts" note="Optional: if empty, the competition starts when you publish it."><input type="datetime-local" value={draft.starts_at || ""} onChange={(e) => setField("starts_at", e.target.value)} /></Field>
                  <Field label="Competition ends"><input type="datetime-local" value={draft.ends_at || ""} onChange={(e) => setField("ends_at", e.target.value)} /></Field>
                  <Field label="Judging starts"><input type="datetime-local" value={draft.judging_starts_at || ""} onChange={(e) => setField("judging_starts_at", e.target.value)} /></Field>
                  <Field label="Judging ends"><input type="datetime-local" value={draft.judging_ends_at || ""} onChange={(e) => setField("judging_ends_at", e.target.value)} /></Field>
                  <Field label="Results public at"><input type="datetime-local" value={draft.results_public_at || ""} onChange={(e) => setField("results_public_at", e.target.value)} /></Field>
                </div>

                {scheduleErrors.length > 0 && (
                  <div className="builder-error-list" role="alert">
                    {scheduleErrors.map((item) => <div key={item}>{item}</div>)}
                  </div>
                )}

                <h2>Rounds</h2>
                {draft.rounds.map((round, index) => (
                  <div className="builder-inline-card builder-round-card" key={index}>
                    <input value={round.title} onChange={(e) => updateArrayItem("rounds", index, "title", e.target.value)} placeholder="Round title" />
                    <input type="datetime-local" value={round.starts_at || ""} onChange={(e) => updateArrayItem("rounds", index, "starts_at", e.target.value)} title="Optional for the first/next sequential round; empty start is derived on publication." />
                    <input type="datetime-local" value={round.ends_at || ""} onChange={(e) => updateArrayItem("rounds", index, "ends_at", e.target.value)} />
                    <label className="builder-round-check"><input type="checkbox" checked={Boolean(round.submission_required)} onChange={(e) => updateArrayItem("rounds", index, "submission_required", e.target.checked)} /> Submission required</label>
                    <label className="builder-round-check"><input type="checkbox" checked={Boolean(round.is_stream_enabled)} onChange={(e) => updateArrayItem("rounds", index, "is_stream_enabled", e.target.checked)} /> Show video stream</label>
                    {round.is_stream_enabled && (
                      <>
                        <input value={round.stream_label || ""} onChange={(e) => updateArrayItem("rounds", index, "stream_label", e.target.value)} placeholder="Stream label, e.g. Round briefing" />
                        <input
                          value={round.stream_url || ""}
                          onChange={(e) => updateArrayItem("rounds", index, "stream_url", e.target.value)}
                          onBlur={(e) => updateArrayItem("rounds", index, "stream_url", normalizeStreamInput(e.target.value))}
                          placeholder="Stream URL: YouTube, Vimeo or Twitch"
                        />
                        <small className="builder-stream-hint">Insert one normal stream link. YouTube, youtu.be, Vimeo, Twitch channel/video links are converted to an embedded player automatically. Do not paste iframe code.</small>
                      </>
                    )}
                    <textarea value={round.description || ""} onChange={(e) => updateArrayItem("rounds", index, "description", e.target.value)} placeholder="Round description" />
                  </div>
                ))}
                <button type="button" onClick={() => addArrayItem("rounds", { title: `Round ${draft.rounds.length + 1}`, description: "", starts_at: "", ends_at: "", submission_required: true, max_attempts: 1, is_stream_enabled: false, stream_url: "", stream_embed_url: "", stream_label: "" })}>+ Add round</button>
              </div>
            )}

            {step === 4 && (
              <div className="builder-stack">
                <h2>Submission settings</h2>
                <div className="builder-form-grid">
                  <Field label="Submission mode"><select value={draft.submission_settings.submission_mode} onChange={(e) => setNested("submission_settings", "submission_mode", e.target.value)}><option value="file_upload">File upload</option><option value="text_answer">Text answer</option><option value="repository_link">Repository link</option><option value="demo_link">Demo link</option><option value="mixed">Mixed</option></select></Field>
                  <Field label="Max file size, MB"><input type="number" value={draft.submission_settings.max_file_size_mb} onChange={(e) => setNested("submission_settings", "max_file_size_mb", Number(e.target.value))} /></Field>
                  <Field label="Max submissions"><input type="number" value={draft.submission_settings.max_submissions} onChange={(e) => setNested("submission_settings", "max_submissions", Number(e.target.value))} /></Field>
                  <CheckField label="Repository required" checked={draft.submission_settings.repository_url_required} onChange={(value) => setNested("submission_settings", "repository_url_required", value)} />
                  <CheckField label="Demo required" checked={draft.submission_settings.demo_url_required} onChange={(value) => setNested("submission_settings", "demo_url_required", value)} />
                </div>

                <h2>Judging criteria</h2>
                {draft.judging_criteria.map((criterion, index) => <div className="builder-inline-card" key={index}><input value={criterion.title} onChange={(e) => updateArrayItem("judging_criteria", index, "title", e.target.value)} /><input type="number" value={criterion.max_score} onChange={(e) => updateArrayItem("judging_criteria", index, "max_score", Number(e.target.value))} /><input type="number" step="0.1" value={criterion.weight} onChange={(e) => updateArrayItem("judging_criteria", index, "weight", Number(e.target.value))} /></div>)}
                <button type="button" onClick={() => addArrayItem("judging_criteria", { title: "New criterion", description: "", max_score: 10, weight: 1 })}>+ Add criterion</button>

                <h2>Awards</h2>
                {draft.awards.map((award, index) => <div className="builder-inline-card" key={index}><input value={award.title} onChange={(e) => updateArrayItem("awards", index, "title", e.target.value)} /><input type="number" value={award.place || ""} onChange={(e) => updateArrayItem("awards", index, "place", Number(e.target.value))} /></div>)}
                <button type="button" onClick={() => addArrayItem("awards", { title: "Special award", place: null, issue_certificate: true, issue_badge: true })}>+ Add award</button>
              </div>
            )}

            {step === 5 && (
              <div className="builder-stack">
                <section className="builder-preview-card">
                  <div style={draft.cover_image ? { backgroundImage: `url(${draft.cover_image})` } : undefined} />
                  <article><span>{draft.industry} · {draft.participation_type} · {draft.access_mode} · {String(draft.language || "uk").toUpperCase()}</span><h2>{draft.name}</h2><p>{draft.short_description || "No short description yet."}</p></article>
                </section>
                <section className="builder-validation">
                  <h2>Validation</h2>
                  {validation.length ? <p>Fix before publication: {validation.join(", ")}</p> : <p>Required publication fields are filled.</p>}
                </section>
                <section className="builder-invites">
                  <h2>Invitation infrastructure</h2>
                  <p>Invitations create records in the invitation table and queue outbound email messages. A real provider can later process the queued messages.</p>
                  <div className="builder-form-grid">
                    <Field label="Individual emails"><textarea value={inviteText} onChange={(e) => setInviteText(e.target.value)} placeholder="one@email.com, two@email.com" /></Field>
                    <Field label="Team emails"><textarea value={teamInviteText} onChange={(e) => setTeamInviteText(e.target.value)} placeholder="captain@email.com" /></Field>
                  </div>
                  <button type="button" onClick={() => queueInvitations("individual")}>Queue individual invitations</button>
                  <button type="button" onClick={() => queueInvitations("team")}>Queue team invitations</button>
                </section>
                <button className="builder-publish-btn" type="button" onClick={handlePublish} disabled={validation.length > 0}>Publish competition</button>
              </div>
            )}

            <div className="builder-actions">
              <button type="button" disabled={step === 1} onClick={() => saveDraft(step - 1)}>Back</button>
              <button type="button" onClick={() => step < 5 ? saveDraft(step + 1) : saveDraft(5)}>{step < 5 ? "Save & continue" : "Save final draft"}</button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
