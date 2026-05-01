import React from "react";
import OverviewTab from "./tabs/OverviewTab";
import ParticipantsTab from "./tabs/ParticipantsTab";
import ResultsTab from "./tabs/ResultsTab";
import JudgingTab from "./tabs/JudgingTab";

export default function CompetitionTabContent({
  activeTab,
  competition,
  commentText,
  onCommentTextChange,
  onCommentPost,
}) {
  if (activeTab === "participants") {
    return <ParticipantsTab competition={competition} />;
  }

  if (activeTab === "results") {
    return <ResultsTab competition={competition} />;
  }

  if (activeTab === "judging") {
    return <JudgingTab competition={competition} />;
  }

  return (
    <OverviewTab
      competition={competition}
      commentText={commentText}
      onCommentTextChange={onCommentTextChange}
      onCommentPost={onCommentPost}
    />
  );
}