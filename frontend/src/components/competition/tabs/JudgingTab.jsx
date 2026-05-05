import React, { useEffect, useMemo, useState } from "react";

function formatScore(value) {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return Number.isInteger(numeric) ? numeric : numeric.toFixed(2);
}

function SubmissionPanel({ competition, judging, onSubmissionCreate }) {
  const canSubmit =
    competition.user_participation_status === "approved" &&
    ["participant", "team_member"].includes(competition.user_participation_role) &&
    competition.submissions_open;
  const mySubmissions = judging?.my_submissions || [];
  const [form, setForm] = useState({ title: "", description: "", repository_url: "", demo_url: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!onSubmissionCreate) return;
    setSaving(true);
    setMessage("");
    try {
      await onSubmissionCreate(form);
      setForm({ title: "", description: "", repository_url: "", demo_url: "" });
      setMessage("Submission sent to judging.");
    } catch (error) {
      setMessage(error?.message || "Submission could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="judge-scorecard">
      <div className="judging-round-heading">
        <h3>My submissions</h3>
        <span>{competition.submissions_open ? "open" : "closed"}</span>
      </div>

      {!!mySubmissions.length && (
        <div className="submission-list">
          {mySubmissions.map((item) => (
            <div key={item.id} className="submission-row">
              <div>
                <strong>{item.title || item.round_title || "Submission"}</strong>
                <small>{item.round_title} · {item.status}</small>
              </div>
              <span>{item.repository_url || item.demo_url || item.description || "No external link"}</span>
            </div>
          ))}
        </div>
      )}

      {canSubmit && (
        <form className="submission-form" onSubmit={handleSubmit}>
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="Title"
          />
          <textarea
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            placeholder="Description"
            rows="3"
          />
          <input
            value={form.repository_url}
            onChange={(event) => updateField("repository_url", event.target.value)}
            placeholder="Repository URL"
          />
          <input
            value={form.demo_url}
            onChange={(event) => updateField("demo_url", event.target.value)}
            placeholder="Demo URL"
          />
          <div className="scorecard-actions">
            <button type="submit" disabled={saving}>{saving ? "Sending..." : "Submit work"}</button>
            {message && <span>{message}</span>}
          </div>
        </form>
      )}
      {!canSubmit && !mySubmissions.length && (
        <div className="judging-empty">Submissions are available only for approved participants during an active round.</div>
      )}
    </div>
  );
}

function ScoreTables({ tables = [] }) {
  if (!tables.length) {
    return <div className="judging-empty">Scores will appear here after submitted work is evaluated.</div>;
  }

  return (
    <div className="judging-round-list">
      {tables.map((table) => (
        <div key={table.round?.id || table.round?.title} className="judging-round-block">
          <div className="judging-round-heading">
            <h3>{table.round?.title || "Round"}</h3>
            <span>{table.round?.status || "scheduled"}</span>
          </div>

          <div className="judging-table-scroll">
            <table className="judging-score-table">
              <thead>
                <tr>
                  <th>Submitted work</th>
                  {(table.rows?.[0]?.criteria || []).map((criterion) => (
                    <th key={criterion.criterion_id}>{criterion.title}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(table.rows || []).map((row) => (
                  <tr key={row.subject?.id}>
                    <td>
                      <strong>{row.subject?.title || row.subject?.name}</strong>
                      <small>{row.subject?.name}</small>
                    </td>
                    {(row.criteria || []).map((criterion) => (
                      <td key={criterion.criterion_id}>
                        {formatScore(criterion.score)}
                        <small> / {criterion.max_score}</small>
                      </td>
                    ))}
                    <td><strong>{formatScore(row.total_score)}</strong></td>
                  </tr>
                ))}
                {!table.rows?.length && (
                  <tr>
                    <td colSpan="3">No accepted submissions are available for this round yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function JudgeScorecard({ judging, onScoreSubmit, onScoreDelete }) {
  const workspace = judging?.judge_workspace;
  const criteria = judging?.criteria || [];
  const rounds = (judging?.round_scores || []).map((item) => item.round).filter(Boolean);
  const subjects = workspace?.subjects || [];
  const allowedReviewTypes = workspace?.allowed_review_types || [];

  const [reviewType, setReviewType] = useState(workspace?.default_review_type || allowedReviewTypes[0] || "");
  const [roundId, setRoundId] = useState(rounds[0]?.id || "");
  const subjectsForRound = useMemo(
    () => subjects.filter((subject) => String(subject.round_id) === String(roundId)),
    [subjects, roundId]
  );
  const [subjectId, setSubjectId] = useState(subjectsForRound[0]?.id || "");
  const [draftScores, setDraftScores] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const existingScoreMap = useMemo(() => {
    const map = {};
    (workspace?.existing_scores || []).forEach((score) => {
      const scoreSubjectId = score.submission
        ? `submission-${score.submission}`
        : score.subject_team
          ? `team-${score.subject_team}`
          : `participant-${score.subject_participant}`;
      const key = [score.review_type, score.round, scoreSubjectId, score.criterion].join(":");
      map[key] = score;
    });
    return map;
  }, [workspace]);

  useEffect(() => {
    if (!roundId && rounds[0]?.id) setRoundId(rounds[0].id);
    if (!reviewType && allowedReviewTypes[0]) setReviewType(allowedReviewTypes[0]);
  }, [roundId, rounds, reviewType, allowedReviewTypes]);

  useEffect(() => {
    if (!subjectsForRound.some((subject) => subject.id === subjectId)) {
      setSubjectId(subjectsForRound[0]?.id || "");
    }
  }, [subjectsForRound, subjectId]);

  useEffect(() => {
    const next = {};
    criteria.forEach((criterion) => {
      const key = [reviewType, roundId, subjectId, criterion.id].join(":");
      const existing = existingScoreMap[key];
      if (existing) {
        next[criterion.id] = {
          score: existing.score,
          comment: existing.comment || "",
          scoreId: existing.id,
          isFinal: existing.is_final,
        };
      } else {
        next[criterion.id] = { score: "", comment: "", scoreId: null, isFinal: false };
      }
    });
    setDraftScores(next);
  }, [criteria, existingScoreMap, reviewType, roundId, subjectId]);

  if (!workspace || !criteria.length || !rounds.length || !subjects.length) {
    return null;
  }

  const updateCriterionDraft = (criterionId, field, value) => {
    setDraftScores((prev) => ({
      ...prev,
      [criterionId]: {
        ...(prev[criterionId] || {}),
        [field]: value,
      },
    }));
  };

  const handleSave = async (finalize = false) => {
    const selectedScores = criteria
      .map((criterion) => ({
        criterion,
        draft: draftScores[criterion.id] || {},
      }))
      .filter((item) => item.draft.score !== undefined && item.draft.score !== "");

    if (!selectedScores.length || !onScoreSubmit || !subjectId) return;

    setSaving(true);
    setMessage("");
    try {
      for (const item of selectedScores) {
        await onScoreSubmit({
          review_type: reviewType,
          round_id: roundId,
          subject_id: subjectId,
          criterion_id: item.criterion.id,
          score: item.draft.score,
          comment: item.draft.comment || "",
          is_final: finalize,
        });
      }
      setMessage(finalize ? "Scores finalized." : "Draft scores saved.");
    } catch (error) {
      setMessage(error?.message || "Scores could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (criterionId) => {
    const scoreId = draftScores[criterionId]?.scoreId;
    if (!scoreId || !onScoreDelete) return;
    setSaving(true);
    setMessage("");
    try {
      await onScoreDelete(scoreId);
      setMessage("Score removed.");
    } catch (error) {
      setMessage(error?.message || "Score could not be removed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="judge-scorecard">
      <div className="judging-round-heading">
        <h3>Scorecard</h3>
        <span>{allowedReviewTypes.join(", ")}</span>
      </div>

      <div className="scorecard-controls">
        <label>
          Mode
          <select value={reviewType} onChange={(event) => setReviewType(event.target.value)}>
            {allowedReviewTypes.map((item) => (
              <option key={item} value={item}>{item.replace("_", " ")}</option>
            ))}
          </select>
        </label>
        <label>
          Round
          <select value={roundId} onChange={(event) => setRoundId(event.target.value)}>
            {rounds.map((round) => (
              <option key={round.id} value={round.id}>{round.title}</option>
            ))}
          </select>
        </label>
        <label>
          Submission
          <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            {subjectsForRound.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.title || subject.name}</option>
            ))}
          </select>
        </label>
      </div>

      {!subjectsForRound.length && (
        <div className="judging-empty">No accepted submissions are available for this round.</div>
      )}

      {!!subjectsForRound.length && (
        <div className="judging-table-scroll">
          <table className="judging-score-table scorecard-table">
            <thead>
              <tr>
                <th>Criterion</th>
                <th>Max</th>
                <th>Score</th>
                <th>Comment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((criterion) => {
                const draft = draftScores[criterion.id] || {};
                return (
                  <tr key={criterion.id}>
                    <td>
                      <strong>{criterion.title}</strong>
                      {criterion.description && <small>{criterion.description}</small>}
                    </td>
                    <td>{criterion.max_score}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={criterion.max_score}
                        step="0.01"
                        value={draft.score ?? ""}
                        onChange={(event) => updateCriterionDraft(criterion.id, "score", event.target.value)}
                      />
                    </td>
                    <td>
                      <textarea
                        rows="2"
                        value={draft.comment ?? ""}
                        onChange={(event) => updateCriterionDraft(criterion.id, "comment", event.target.value)}
                      />
                    </td>
                    <td>
                      <span>{draft.isFinal ? "final" : draft.scoreId ? "draft" : "new"}</span>
                      {draft.scoreId && (
                        <button type="button" className="score-delete-btn" onClick={() => handleDelete(criterion.id)} disabled={saving}>
                          Clear
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="scorecard-actions">
        <button type="button" onClick={() => handleSave(false)} disabled={saving || !subjectsForRound.length}>
          {saving ? "Saving..." : "Save draft"}
        </button>
        <button type="button" onClick={() => handleSave(true)} disabled={saving || !subjectsForRound.length}>
          Finalize
        </button>
        {message && <span>{message}</span>}
      </div>
    </div>
  );
}

export default function JudgingTab({ competition, onScoreSubmit, onSubmissionCreate, onScoreDelete }) {
  const judging = competition.judging || {};
  const reviewModes = judging.review_modes || {};
  const roundScores = judging.round_scores || competition.results?.roundScores || [];

  return (
    <section className="competition-panel">
      <h2 className="competition-section-title">Judging</h2>

      <div className="judging-mode-line">
        Scoring mode: <strong>{judging.mode || "not configured"}</strong>
        <span>Aggregation: {reviewModes.aggregation || "average"}</span>
        <span>Visibility: {reviewModes.visibility || "aggregate"}</span>
      </div>

      <SubmissionPanel competition={competition} judging={judging} onSubmissionCreate={onSubmissionCreate} />

      <div className="judging-metric-list">
        {(judging.metrics || []).map((metric) => (
          <div key={metric.label} className="judging-metric-item">
            <div>{metric.label}</div>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>

      <JudgeScorecard judging={judging} onScoreSubmit={onScoreSubmit} onScoreDelete={onScoreDelete} />
      <ScoreTables tables={roundScores} />
    </section>
  );
}
