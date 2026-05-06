from django.urls import path

from .views import (
    CsrfView,
    HealthCheckView,
    AdminCompetitionDetailView,
    AdminCompetitionsView,
    AdminFilterOptionsView,
    AdminMessagesView,
    AdminOverviewView,
    AdminUserDetailView,
    AdminUsersView,
    UserFileDownloadView,
    CurrentUserView,
    DevLoginView,
    LoginView,
    LogoutView,
    RegisterView,
    LandingCompetitionsView,
    LandingSidebarView,
    LandingFiltersView,
    CompetitionDetailView,
    ToggleSavedCompetitionView,
    MySavedCompetitionsView,
    ToggleCompetitionWatchView,
    MarkMaterialViewedView,
    CompetitionAnnouncementsView,
    AddAnnouncementCommentView,
    CompetitionParticipantsView,
    JoinCompetitionView,
    CompetitionJoinRequestReviewView,
    TeamManagementView,
    CompetitionResultsView,
    CompetitionJudgingView,
    CompetitionSubmissionsView,
    CompetitionSubmissionReviewView,
    CompetitionScoreDetailView,
    ProfileDashboardView,
    CompetitionDraftListCreateView,
    CompetitionBuilderDetailView,
    CompetitionPublishView,
    CompetitionOrganizerApprovalView,
    CompetitionJudgeAssignmentView,
    CompetitionJudgeAssignmentResponseView,
    CompetitionMaterialUploadView,
    CompetitionInvitationView,
    CompetitionOutboundMessagesView,
)

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="api-health"),
    # admin panel
    path("admin/overview/", AdminOverviewView.as_view(), name="admin-overview"),
    path("admin/users/", AdminUsersView.as_view(), name="admin-users"),
    path("admin/users/<int:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("admin/competitions/", AdminCompetitionsView.as_view(), name="admin-competitions"),
    path("admin/competitions/<int:pk>/", AdminCompetitionDetailView.as_view(), name="admin-competition-detail"),
    path("admin/filters/", AdminFilterOptionsView.as_view(), name="admin-filters"),
    path("admin/messages/", AdminMessagesView.as_view(), name="admin-messages"),
    # auth/session
    path("auth/csrf/", CsrfView.as_view(), name="auth-csrf"),
    path("auth/me/", CurrentUserView.as_view(), name="auth-me"),
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/dev-login/", DevLoginView.as_view(), name="auth-dev-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("files/<int:pk>/download/", UserFileDownloadView.as_view(), name="file-download"),

    # landing
    path("landing/competitions/", LandingCompetitionsView.as_view(), name="landing-competitions"),
    path("landing/sidebar/", LandingSidebarView.as_view(), name="landing-sidebar"),
    path("landing/filters/", LandingFiltersView.as_view(), name="landing-filters"),

    # competition details
    path("competitions/<int:pk>/", CompetitionDetailView.as_view(), name="competition-detail"),

    # saved
    path("competitions/<int:pk>/save/", ToggleSavedCompetitionView.as_view(), name="competition-save"),
    path("me/saved/", MySavedCompetitionsView.as_view(), name="my-saved-competitions"),
    path("me/profile-dashboard/", ProfileDashboardView.as_view(), name="profile-dashboard"),

    # competition constructor / drafts
    path("me/competition-drafts/", CompetitionDraftListCreateView.as_view(), name="competition-drafts"),
    path("competition-builder/<int:pk>/", CompetitionBuilderDetailView.as_view(), name="competition-builder-detail"),
    path("competition-builder/<int:pk>/publish/", CompetitionPublishView.as_view(), name="competition-builder-publish"),
    path("competition-builder/<int:pk>/approval/", CompetitionOrganizerApprovalView.as_view(), name="competition-builder-approval"),
    path("competition-builder/<int:pk>/judges/", CompetitionJudgeAssignmentView.as_view(), name="competition-builder-judges"),
    path("competition-builder/<int:pk>/materials/", CompetitionMaterialUploadView.as_view(), name="competition-builder-materials"),
    path("competition-builder/<int:pk>/invitations/", CompetitionInvitationView.as_view(), name="competition-builder-invitations"),
    path("competition-builder/<int:pk>/messages/", CompetitionOutboundMessagesView.as_view(), name="competition-builder-messages"),

    # watch
    path("competitions/<int:pk>/watch/", ToggleCompetitionWatchView.as_view(), name="competition-watch"),
    path("materials/<int:pk>/view/", MarkMaterialViewedView.as_view(), name="material-view"),

    # overview
    path("competitions/<int:pk>/announcements/", CompetitionAnnouncementsView.as_view(), name="competition-announcements"),
    path("announcements/<int:pk>/comments/", AddAnnouncementCommentView.as_view(), name="announcement-add-comment"),

    # participants / join
    path("competitions/<int:pk>/participants/", CompetitionParticipantsView.as_view(), name="competition-participants"),
    path("competitions/<int:pk>/join/", JoinCompetitionView.as_view(), name="competition-join"),
    path("competition-join-requests/<int:pk>/review/", CompetitionJoinRequestReviewView.as_view(), name="competition-join-request-review"),
    path("me/teams/<int:pk>/", TeamManagementView.as_view(), name="my-team-management"),

    # results / judging
    path("competitions/<int:pk>/submissions/", CompetitionSubmissionsView.as_view(), name="competition-submissions"),
    path("competition-submissions/<int:pk>/review/", CompetitionSubmissionReviewView.as_view(), name="competition-submission-review"),
    path("competitions/<int:pk>/results/", CompetitionResultsView.as_view(), name="competition-results"),
    path("competitions/<int:pk>/judging/", CompetitionJudgingView.as_view(), name="competition-judging"),
    path("judge-assignments/<int:pk>/respond/", CompetitionJudgeAssignmentResponseView.as_view(), name="judge-assignment-respond"),
    path("competition-scores/<int:pk>/", CompetitionScoreDetailView.as_view(), name="competition-score-detail"),
]
