from django.urls import path

from .views import (
    LandingCompetitionsView,
    LandingSidebarView,
    LandingFiltersView,
    CompetitionDetailView,
    ToggleSavedCompetitionView,
    MySavedCompetitionsView,
    ToggleCompetitionWatchView,
    CompetitionAnnouncementsView,
    AddAnnouncementCommentView,
    CompetitionParticipantsView,
    JoinCompetitionView,
    CompetitionResultsView,
    CompetitionJudgingView,
)

urlpatterns = [
    # landing
    path("landing/competitions/", LandingCompetitionsView.as_view(), name="landing-competitions"),
    path("landing/sidebar/", LandingSidebarView.as_view(), name="landing-sidebar"),
    path("landing/filters/", LandingFiltersView.as_view(), name="landing-filters"),

    # competition details
    path("competitions/<int:pk>/", CompetitionDetailView.as_view(), name="competition-detail"),

    # saved
    path("competitions/<int:pk>/save/", ToggleSavedCompetitionView.as_view(), name="competition-save"),
    path("me/saved/", MySavedCompetitionsView.as_view(), name="my-saved-competitions"),

    # watch
    path("competitions/<int:pk>/watch/", ToggleCompetitionWatchView.as_view(), name="competition-watch"),

    # overview
    path("competitions/<int:pk>/announcements/", CompetitionAnnouncementsView.as_view(), name="competition-announcements"),
    path("announcements/<int:pk>/comments/", AddAnnouncementCommentView.as_view(), name="announcement-add-comment"),

    # participants / join
    path("competitions/<int:pk>/participants/", CompetitionParticipantsView.as_view(), name="competition-participants"),
    path("competitions/<int:pk>/join/", JoinCompetitionView.as_view(), name="competition-join"),

    # results / judging
    path("competitions/<int:pk>/results/", CompetitionResultsView.as_view(), name="competition-results"),
    path("competitions/<int:pk>/judging/", CompetitionJudgingView.as_view(), name="competition-judging"),
]