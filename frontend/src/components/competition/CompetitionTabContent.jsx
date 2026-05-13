import React from "react";
import OverviewTab from "./tabs/OverviewTab";
import ParticipantsTab from "./tabs/ParticipantsTab";
import ResultsTab from "./tabs/ResultsTab";
import JudgingTab from "./tabs/JudgingTab";

export default function CompetitionTabContent({
  activeTab,
  competition,
  onCommentPost,
  onAnnouncementCreate,
  onAnnouncementUpdate,
  onAnnouncementDelete,
  onScoreSubmit,
  onSubmissionCreate,
  onScoreDelete,
  onJudgeAssignmentRespond,
}) {
  if (activeTab === "participants") {
    return <ParticipantsTab competition={competition} />;
  }

  if (activeTab === "results") {
    return <ResultsTab competition={competition} />;
  }

  if (activeTab === "judging") {
    return (
      <JudgingTab
        competition={competition}
        onScoreSubmit={onScoreSubmit}
        onSubmissionCreate={onSubmissionCreate}
        onScoreDelete={onScoreDelete}
        onJudgeAssignmentRespond={onJudgeAssignmentRespond}
      />
    );
  }

  return (
    <OverviewTab
      competition={competition}
      onCommentPost={onCommentPost}
      onAnnouncementCreate={onAnnouncementCreate}
      onAnnouncementUpdate={onAnnouncementUpdate}
      onAnnouncementDelete={onAnnouncementDelete}
    />
  );
}
