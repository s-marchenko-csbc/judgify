import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";

import Header from "../components/Header";
import CompetitionHeader from "../components/competition/CompetitionHeader";
import CompetitionSidebar from "../components/competition/CompetitionSidebar";
import CompetitionTabs from "../components/competition/CompetitionTabs";
import CompetitionTabContent from "../components/competition/CompetitionTabContent";
import JoinCompetitionModal from "../components/competition/JoinCompetitionModal";

import { fetchCompetitions } from "../api/landingApi";

function capitalize(value) {
  if (!value) return "";
  const normalized = String(value).replaceAll("_", " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDateRange(baseCompetition) {
  if (!baseCompetition?.timer_deadline) {
    return "May 9, 2027 – May 20, 2027";
  }

  const endDate = new Date(baseCompetition.timer_deadline);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 11);

  const format = (date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return `${format(startDate)} – ${format(endDate)}`;
}

function formatUpcomingCountdown(timerDeadline) {
  if (!timerDeadline) {
    return "02:14:11";
  }

  const diff = new Date(timerDeadline).getTime() - Date.now();
  const safe = Math.max(diff, 0);

  const totalSeconds = Math.floor(safe / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

function buildMockCompetition(baseCompetition) {
  const currentRound = baseCompetition?.current_round || 1;
  const totalRounds = baseCompetition?.total_rounds || 6;

  return {
    ...baseCompetition,
    organizerCode: `Ereed-${500 + Number(baseCompetition?.id || 15)}`,
    category: capitalize(baseCompetition?.industry) || "Programming",
    difficulty: capitalize(baseCompetition?.difficulty) || "Beginner",
    datesLabel: formatDateRange(baseCompetition),
    sidebarDescription:
      baseCompetition?.short_description ||
      "A programming competition focused on creating AI models to solve specified challenges in an online environment.",
    upcomingText: `Round ${Math.min(
      currentRound + 1,
      totalRounds
    )} begins in: ${formatUpcomingCountdown(
      baseCompetition?.timer_deadline
    )} on May 11, Altcom, in fifteen seconds.`,
    materials: [
      { id: 1, name: "Starter Dataset", icon: "⚓", url: "#" },
      { id: 2, name: "Sample AI Model Code", icon: "🧬", url: "#" },
    ],
    announcements: [
      {
        id: 1,
        author: "Round 1: Kickoff!",
        avatar:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80&auto=format&fit=crop",
        postedAgo: "1 day ago",
        text: "Participants, competitions have started! You are piloting 3 tasks in 3 hours, resources and downloads for you below.",
        comments: [],
      },
    ],
    participants: [
      { id: 1, name: "Alice Johnson", role: "Participant", isActiveNow: true },
      { id: 2, name: "Neo Coders", role: "Team", isActiveNow: false },
      { id: 3, name: "Victor Lane", role: "Participant", isActiveNow: true },
      { id: 4, name: "Data Falcons", role: "Team", isActiveNow: true },
      { id: 5, name: "Marta Silva", role: "Observer", isActiveNow: false },
      { id: 6, name: "Core Matrix", role: "Team", isActiveNow: false },
    ],
    results: {
      roundHistory: [
        { round: 1, leader: "Neo Coders", topScore: 91.4 },
        { round: 2, leader: "Data Falcons", topScore: 93.8 },
        { round: 3, leader: "Victor Lane", topScore: 95.1 },
      ],
      leaderboard: [
        { rank: 1, name: "Victor Lane", score: 95.1 },
        { rank: 2, name: "Data Falcons", score: 93.8 },
        { rank: 3, name: "Neo Coders", score: 91.4 },
        { rank: 4, name: "Alice Johnson", score: 88.7 },
      ],
    },
    judging: {
      mode: "individual",
      metrics: [
        { label: "Accuracy", value: 91 },
        { label: "Speed", value: 83 },
        { label: "Innovation", value: 88 },
        { label: "Penalty", value: 4 },
      ],
    },
  };
}

export default function CompetitionPage() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [competition, setCompetition] = useState(
    location.state?.competition
      ? buildMockCompetition(location.state.competition)
      : null
  );
  const [loading, setLoading] = useState(!location.state?.competition);
  const [error, setError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(
    searchParams.get("join") === "1"
  );
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "overview"
  );

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
    if (location.state?.competition) return;

    let isMounted = true;

    async function loadCompetitionFallback() {
      try {
        setLoading(true);
        setError("");

        const list = await fetchCompetitions({ tab: "trending" });
        const found = list.find((item) => String(item.id) === String(id));

        if (!found) {
          throw new Error("Competition not found");
        }

        if (isMounted) {
          setCompetition(buildMockCompetition(found));
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setError("Не вдалося завантажити сторінку змагання.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadCompetitionFallback();

    return () => {
      isMounted = false;
    };
  }, [id, location.state]);

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
  };

  const closeJoinModal = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("join");
    setSearchParams(nextParams);
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
                  author: "You",
                  text,
                },
              ],
            }
          : announcement
      ),
    }));

    setCommentText("");
  };

  const pageTitle = useMemo(
    () => competition?.name || "Competition",
    [competition]
  );

  if (loading) {
    return <div className="competition-page-state">Loading competition...</div>;
  }

  if (error) {
    return <div className="competition-page-state error">{error}</div>;
  }

  if (!competition) {
    return <div className="competition-page-state">Competition not found.</div>;
  }

  return (
    <div className="landing-page">
      <Header />

      <div className="competition-page-shell">
        <div className="competition-page-card">
          <div className="competition-page-grid">
            <main className="competition-page-main">
              <CompetitionHeader
                competition={competition}
                pageTitle={pageTitle}
                onJoin={openJoinModal}
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
              />
            </main>

            <aside className="competition-page-side">
              <CompetitionSidebar competition={competition} />
            </aside>
          </div>
        </div>
      </div>

      {showJoinModal && (
        <JoinCompetitionModal
          competition={competition}
          onClose={closeJoinModal}
        />
      )}
    </div>
  );
}