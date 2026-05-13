import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import Header from "../components/Header";
import CompetitionHeader from "../components/competition/CompetitionHeader";
import CompetitionSidebar from "../components/competition/CompetitionSidebar";
import CompetitionTabs from "../components/competition/CompetitionTabs";
import CompetitionTabContent from "../components/competition/CompetitionTabContent";
import JoinCompetitionModal from "../components/competition/JoinCompetitionModal";
import SignUpModal from "../components/SignUpModal";
import OnboardModal from "../components/auth/OnboardModal";
import SignInModal from "../components/auth/SignInModal";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

import { fetchCompetitionDetail, fetchCompetitions, fetchCompetitionParticipants, fetchCompetitionResults, fetchCompetitionJudging, submitCompetitionScore, submitCompetitionWork, deleteCompetitionScore, respondJudgeAssignment } from "../api/landingApi";

function capitalize(value) {
  if (!value) return "";
  const normalized = String(value).replaceAll("_", " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function optionLabel(t, group, value, fallback = "") {
  return t(`options.${group}.${value}`, { defaultValue: fallback || capitalize(value) });
}

function formatDateRange(baseCompetition, language, t) {
  const startDate = baseCompetition?.starts_at ? new Date(baseCompetition.starts_at) : null;
  const endDate = baseCompetition?.ends_at ? new Date(baseCompetition.ends_at) : null;

  if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return t("competitionPage.schedulePending");
  }

  const format = (date) =>
    date.toLocaleDateString(language === "uk" ? "uk-UA" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return `${format(startDate)} - ${format(endDate)}`;
}

function formatUpcomingCountdown(timerDeadline, t) {
  if (!timerDeadline) {
    return t("competitionPage.timerUnavailable");
  }

  const diff = new Date(timerDeadline).getTime() - Date.now();
  const safe = Math.max(diff, 0);

  const totalSeconds = Math.floor(safe / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

function enrichCompetition(baseCompetition, language, t) {
  const currentRound = baseCompetition?.current_round || 0;
  const totalRounds = baseCompetition?.total_rounds || 0;
  const nextRound = totalRounds ? Math.min(currentRound + 1, totalRounds) : 0;

  return {
    ...baseCompetition,
    organizerCode: baseCompetition?.slug || `competition-${baseCompetition?.id || ""}`,
    category: baseCompetition?.industry
      ? optionLabel(t, "industry", baseCompetition.industry)
      : t("competitionPage.categoryFallback"),
    difficulty: baseCompetition?.difficulty
      ? optionLabel(t, "difficulty", baseCompetition.difficulty)
      : t("competitionPage.difficultyFallback"),
    datesLabel: formatDateRange(baseCompetition, language, t),
    sidebarDescription: baseCompetition?.short_description || t("competitionPage.descriptionFallback"),
    upcomingText: nextRound
      ? t("competitionPage.roundTimer", { round: nextRound, time: formatUpcomingCountdown(baseCompetition?.timer_deadline, t) })
      : t("competitionPage.timer", { time: formatUpcomingCountdown(baseCompetition?.timer_deadline, t) }),
    materials: baseCompetition?.materials || [],
    announcements: baseCompetition?.announcements || [],
    participants: baseCompetition?.participants || [],
    results: baseCompetition?.results || { roundHistory: [], leaderboard: [], roundScores: [] },
    judging: baseCompetition?.judging || { mode: t("competitionPage.notConfigured"), metrics: [], criteria: [], round_scores: [], my_submissions: [] },
  };
}

export default function CompetitionPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { user, login, isAuthenticated, authSessionKey } = useAuth();
  const { language, t } = useLanguage();

  const [competition, setCompetition] = useState(
    location.state?.competition
      ? enrichCompetition(location.state.competition, language, t)
      : null
  );
  const [loading, setLoading] = useState(!location.state?.competition);
  const [error, setError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(
    searchParams.get("join") === "1"
  );
  const [authStep, setAuthStep] = useState(null);
  const [pendingSignUpData, setPendingSignUpData] = useState(null);
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "overview"
  );

  const canCurrentUserJoin =
    isAuthenticated
      ? user?.primaryRole === "participant" && competition?.can_join !== false
      : competition?.can_join !== false;

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    setShowJoinModal(searchParams.get("join") === "1");
  }, [searchParams]);

  useEffect(() => {
    if (!showJoinModal) return;
    if (!isAuthenticated) {
      setAuthStep((current) => current || "signin");
    } else if (authStep === "signin" || authStep === "signup") {
      setAuthStep(null);
    }
  }, [authStep, isAuthenticated, showJoinModal]);

  useEffect(() => {
    setCompetition((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        can_edit: false,
        can_join: false,
        user_participation_status: "none",
        user_participation_role: "",
        user_team: null,
        judging: {
          ...(prev.judging || {}),
          judge_workspace: null,
          my_submissions: [],
        },
      };
    });
  }, [authSessionKey]);

  useEffect(() => {
    let isMounted = true;

    async function loadCompetition({ showLoader = false } = {}) {
      try {
        if (showLoader) setLoading(!location.state?.competition);
        setError("");

        const detail = await fetchCompetitionDetail(id);
        const participants = await fetchCompetitionParticipants(id);
        const [resultsResponse, judgingResponse] = await Promise.allSettled([
          fetchCompetitionResults(id),
          fetchCompetitionJudging(id),
        ]);
        const resultsData = resultsResponse.status === "fulfilled" ? resultsResponse.value : {};
        const results = {
          roundHistory: (resultsData.round_history || []).map((item) => ({
            round: item.round_number ?? item.round,
            leader: item.leader_name ?? item.leader,
            topScore: item.top_score ?? item.topScore,
          })),
          leaderboard: (resultsData.leaderboard || []).map((item) => ({
            rank: item.rank,
            name: item.name,
            score: item.score,
          })),
          roundScores: resultsData.round_scores || [],
        };
        const judging = judgingResponse.status === "fulfilled" ? judgingResponse.value : { mode: t("competitionPage.notConfigured"), metrics: [] };
        if (isMounted) {
          setCompetition(enrichCompetition({ ...detail, participants, results, judging }, language, t));
        }
      } catch (err) {
        console.error(err);
        if (location.state?.competition) {
          if (showLoader) setLoading(false);
          return;
        }
        try {
          const list = await fetchCompetitions({ tab: "trending" });
          const found = list.find((item) => String(item.id) === String(id));
          if (!found) throw new Error(t("competitionPage.notFound"));
          const participants = await fetchCompetitionParticipants(id).catch(() => []);
          if (isMounted) setCompetition(enrichCompetition({ ...found, participants }, language, t));
        } catch (fallbackError) {
          console.error(fallbackError);
          if (isMounted) setError(t("competitionPage.loadError"));
        }
      } finally {
        if (showLoader && isMounted) setLoading(false);
      }
    }

    loadCompetition({ showLoader: true });
    const intervalId = window.setInterval(() => loadCompetition({ showLoader: false }), 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [authSessionKey, id, location.state, language, t]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    nextParams.delete("join");
    setSearchParams(nextParams);
  };

  const openJoinModal = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("join", "1");
    setSearchParams(nextParams);
    if (!isAuthenticated) {
      setAuthStep("signin");
    }
  };

  const closeJoinModal = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("join");
    setSearchParams(nextParams);
  };

  const closeAuthFlow = () => {
    setAuthStep(null);
    setPendingSignUpData(null);
    if (!isAuthenticated) {
      closeJoinModal();
    }
  };

  const handleOpenSignUp = () => {
    setAuthStep("signup");
  };

  const handleOpenSignIn = () => {
    setAuthStep("signin");
  };

  const handleSignInComplete = async (credentials) => {
    await login(credentials);
    setAuthStep(null);
  };

  const handleSignUpComplete = (data) => {
    setPendingSignUpData(data || null);
    setAuthStep("onboard");
  };

  const handleFinishOnboarding = async (data) => {
    await login({
      ...(pendingSignUpData || {}),
      interests: data?.interests || [],
      createTeam: false,
    });
    setPendingSignUpData(null);
    setAuthStep(null);
  };

  const handleJoinSubmitted = async (result) => {
    const participants = await fetchCompetitionParticipants(id).catch(() => competition?.participants || []);
    setCompetition((prev) => ({
      ...prev,
      participants,
      participants_count: participants.filter((item) => item.status === "approved").length,
      user_participation_status: result?.status || "pending",
      user_participation_role: result?.role || "participant",
      user_team: result?.team ? result.team : result?.team_name ? { name: result.team_name, status: "pending" } : prev?.user_team,
      can_join: false,
    }));
    closeJoinModal();
  };

  const handleCommentPost = () => {
    const text = commentText.trim();
    if (!text) return;

    setCompetition((prev) => ({
      ...prev,
      announcements: prev.announcements.map((announcement, index) =>
        index === 0
          ? {
              ...announcement,
              comments: [
                ...(announcement.comments || []),
                {
                  id: Date.now(),
                  author: t("competitionPage.you"),
                  text,
                },
              ],
            }
          : announcement
      ),
    }));

    setCommentText("");
  };

  const handleScoreSubmit = async (payload) => {
    const response = await submitCompetitionScore(id, payload);
    setCompetition((prev) =>
      enrichCompetition({
        ...prev,
        judging: {
          ...(prev?.judging || {}),
          round_scores: response.round_scores || prev?.judging?.round_scores || [],
          judge_workspace: response.judge_workspace || prev?.judging?.judge_workspace || null,
        },
        results: {
          ...(prev?.results || {}),
          leaderboard: response.leaderboard || prev?.results?.leaderboard || [],
          roundScores: response.round_scores || prev?.results?.roundScores || [],
        },
      }, language, t)
    );
    return response;
  };

  const handleSubmissionCreate = async (payload) => {
    const submission = await submitCompetitionWork(id, payload);
    setCompetition((prev) =>
      enrichCompetition((() => {
        const currentSubmissions = prev?.judging?.my_submissions || [];
        const policy = prev?.submission_settings?.submission_policy || "single";
        const nextSubmissions = currentSubmissions.filter((item) => {
          if (item.id === submission.id) return false;
          if (policy !== "multiple" && String(item.round) === String(submission.round)) return false;
          return true;
        });
        return {
          ...prev,
          judging: {
            ...(prev?.judging || {}),
            my_submissions: [submission, ...nextSubmissions],
          },
        };
      })(), language, t)
    );
    return submission;
  };

  const handleScoreDelete = async (scoreId) => {
    const response = await deleteCompetitionScore(scoreId);
    setCompetition((prev) =>
      enrichCompetition({
        ...prev,
        judging: {
          ...(prev?.judging || {}),
          round_scores: response.round_scores || prev?.judging?.round_scores || [],
          judge_workspace: response.judge_workspace || prev?.judging?.judge_workspace || null,
        },
        results: {
          ...(prev?.results || {}),
          leaderboard: response.leaderboard || prev?.results?.leaderboard || [],
          roundScores: response.round_scores || prev?.results?.roundScores || [],
        },
      }, language, t)
    );
    return response;
  };

  const handleJudgeAssignmentRespond = async (assignmentId, decision) => {
    const response = await respondJudgeAssignment(assignmentId, decision);
    setCompetition((prev) =>
      enrichCompetition({
        ...prev,
        judging: {
          ...(prev?.judging || {}),
          judge_workspace: response.judge_workspace || prev?.judging?.judge_workspace || null,
        },
      }, language, t)
    );
    return response;
  };

  const pageTitle = useMemo(
    () => competition?.name || t("competitionPage.titleFallback"),
    [competition, t]
  );

  if (loading) {
    return <div className="competition-page-state">{t("competitionPage.loading")}</div>;
  }

  if (error) {
    return <div className="competition-page-state error">{error}</div>;
  }

  if (!competition) {
    return <div className="competition-page-state">{t("competitionPage.notFound")}</div>;
  }

  return (
    <div className="landing-page competition-detail-page">
      <Header />

      <div className="competition-page-shell">
        <div className="competition-page-card">
          <div className="competition-page-grid">
            <main className="competition-page-main">
              <CompetitionHeader
                competition={competition}
                pageTitle={pageTitle}
                onJoin={openJoinModal}
                onEdit={() => navigate(`/competitions/${competition.id}/edit`)}
              />

              <CompetitionTabs
                activeTab={activeTab}
                onTabChange={handleTabChange}
              />

              <CompetitionTabContent
                activeTab={activeTab}
                competition={competition}
                commentText={commentText}
                onCommentTextChange={setCommentText}
                onCommentPost={handleCommentPost}
                onScoreSubmit={handleScoreSubmit}
                onSubmissionCreate={handleSubmissionCreate}
                onScoreDelete={handleScoreDelete}
                onJudgeAssignmentRespond={handleJudgeAssignmentRespond}
              />
            </main>

            <aside className="competition-page-side">
              <CompetitionSidebar competition={competition} />
            </aside>
          </div>
        </div>
      </div>

      {showJoinModal && isAuthenticated && canCurrentUserJoin && (
        <JoinCompetitionModal
          competition={competition}
          onClose={closeJoinModal}
          onSubmitted={handleJoinSubmitted}
        />
      )}

      {authStep === "signin" && (
        <SignInModal
          isOpen={true}
          onClose={closeAuthFlow}
          onOpenSignUp={handleOpenSignUp}
          onComplete={handleSignInComplete}
        />
      )}

      {authStep === "signup" && (
        <SignUpModal
          isOpen={true}
          onClose={closeAuthFlow}
          onOpenSignIn={handleOpenSignIn}
          onComplete={handleSignUpComplete}
          allowedRoles={["participant"]}
        />
      )}

      {authStep === "onboard" && <OnboardModal onFinish={handleFinishOnboarding} />}
    </div>
  );
}
