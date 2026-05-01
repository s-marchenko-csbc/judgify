from django.db.models import Q
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Competition,
    UserSavedCompetition,
    UserCompetitionWatch,
    CompetitionAnnouncement,
    CompetitionAnnouncementComment,
    CompetitionParticipant,
    CompetitionJoinRequest,
    CompetitionRoundResult,
    CompetitionLeaderboardEntry,
    CompetitionJudgingMetric,
)
from .serializers import (
    CompetitionCardSerializer,
    CompetitionDetailSerializer,
    SidebarCompetitionSerializer,
    CompetitionAnnouncementSerializer,
    CompetitionAnnouncementCommentSerializer,
    CompetitionParticipantSerializer,
    CompetitionJoinRequestSerializer,
    CompetitionRoundResultSerializer,
    CompetitionLeaderboardEntrySerializer,
    CompetitionJudgingMetricSerializer,
    UserSavedCompetitionSerializer,
    UserCompetitionWatchSerializer,
)


class LandingCompetitionsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = Competition.objects.filter(is_public=True)

        search = request.query_params.get("search")
        tab = request.query_params.get("tab")
        statuses = request.query_params.getlist("status")
        event_types = request.query_params.getlist("event_type")
        participation_types = request.query_params.getlist("participation_type")
        industries = request.query_params.getlist("industry")
        difficulties = request.query_params.getlist("difficulty")

        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(short_description__icontains=search)
            )

        if statuses:
            qs = qs.filter(status__in=statuses)

        if event_types:
            qs = qs.filter(event_type__in=event_types)

        if participation_types:
            qs = qs.filter(participation_type__in=participation_types)

        if industries:
            qs = qs.filter(industry__in=industries)

        if difficulties:
            qs = qs.filter(difficulty__in=difficulties)

        if tab == "trending" or not tab:
            qs = qs.order_by("-trending_score", "-created_at")
        elif tab == "new":
            qs = qs.order_by("-created_at")
        elif tab == "open_submission":
            qs = qs.filter(submissions_open=True).order_by("-created_at")
        elif tab == "live_stream":
            qs = qs.filter(
                is_live_stream_enabled=True,
                is_online_now=True,
            ).order_by("-created_at")

        serializer = CompetitionCardSerializer(
            qs[:20],
            many=True,
            context={"request": request},
        )
        return Response(serializer.data)


class LandingSidebarView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({
                "last_competitions": [],
                "saved_competitions": [],
            })

        last_competitions = Competition.objects.filter(
            is_public=True
        ).order_by("-created_at")[:6]

        saved_ids = UserSavedCompetition.objects.filter(
            user=request.user
        ).values_list("competition_id", flat=True)

        saved_competitions = Competition.objects.filter(
            id__in=saved_ids,
            is_public=True,
        ).order_by("-created_at")[:6]

        return Response({
            "last_competitions": SidebarCompetitionSerializer(
                last_competitions,
                many=True,
            ).data,
            "saved_competitions": SidebarCompetitionSerializer(
                saved_competitions,
                many=True,
            ).data,
        })


class LandingFiltersView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "status": [
                {"value": "upcoming", "label": "Upcoming"},
                {"value": "registration_open", "label": "Registration open"},
                {"value": "active", "label": "Active"},
                {"value": "finished", "label": "Finished"},
                {"value": "judging", "label": "Judging"},
                {"value": "archived", "label": "Archived"},
            ],
            "event_type": [
                {"value": "online", "label": "Online"},
                {"value": "offline", "label": "Offline"},
                {"value": "hybrid", "label": "Hybrid"},
            ],
            "participation_type": [
                {"value": "team", "label": "Team"},
                {"value": "individual", "label": "Individual"},
            ],
            "industry": [
                {"value": "programming", "label": "Programming"},
                {"value": "design", "label": "Design"},
                {"value": "robotics", "label": "Robotics"},
                {"value": "cybersecurity", "label": "Cybersecurity"},
            ],
            "difficulty": [
                {"value": "beginner", "label": "Beginner"},
                {"value": "intermediate", "label": "Intermediate"},
                {"value": "advanced", "label": "Advanced"},
                {"value": "mixed", "label": "Mixed"},
            ],
        })


class CompetitionDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        competition = get_object_or_404(
            Competition,
            pk=pk,
            is_public=True,
        )

        serializer = CompetitionDetailSerializer(
            competition,
            context={"request": request},
        )
        return Response(serializer.data)


class ToggleSavedCompetitionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)

        UserSavedCompetition.objects.get_or_create(
            user=request.user,
            competition=competition,
        )

        return Response({"saved": True}, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)

        UserSavedCompetition.objects.filter(
            user=request.user,
            competition=competition,
        ).delete()

        return Response({"saved": False}, status=status.HTTP_200_OK)


class MySavedCompetitionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        saved_items = UserSavedCompetition.objects.filter(
            user=request.user
        ).select_related("competition")

        serializer = UserSavedCompetitionSerializer(
            saved_items,
            many=True,
            context={"request": request},
        )
        return Response(serializer.data)


class ToggleCompetitionWatchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)

        watch_obj, created = UserCompetitionWatch.objects.get_or_create(
            user=request.user,
            competition=competition,
            defaults={
                "watch_live": True,
                "watch_rounds": True,
                "watch_updates": True,
            },
        )

        if not created:
            watch_obj.watch_live = request.data.get("watch_live", watch_obj.watch_live)
            watch_obj.watch_rounds = request.data.get("watch_rounds", watch_obj.watch_rounds)
            watch_obj.watch_updates = request.data.get("watch_updates", watch_obj.watch_updates)
            watch_obj.save()

        serializer = UserCompetitionWatchSerializer(watch_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)

        UserCompetitionWatch.objects.filter(
            user=request.user,
            competition=competition,
        ).delete()

        return Response({"watching": False}, status=status.HTTP_200_OK)


class CompetitionAnnouncementsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        competition = get_object_or_404(
            Competition,
            pk=pk,
            is_public=True,
        )

        announcements = CompetitionAnnouncement.objects.filter(
            competition=competition
        ).select_related("author").prefetch_related("comments__author")

        serializer = CompetitionAnnouncementSerializer(
            announcements,
            many=True,
        )
        return Response(serializer.data)


class AddAnnouncementCommentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        announcement = get_object_or_404(CompetitionAnnouncement, pk=pk)

        text = (request.data.get("text") or "").strip()
        if not text:
            return Response(
                {"detail": "Comment text is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comment = CompetitionAnnouncementComment.objects.create(
            announcement=announcement,
            author=request.user,
            text=text,
        )

        competition = announcement.competition
        competition.comments_count = CompetitionAnnouncementComment.objects.filter(
            announcement__competition=competition
        ).count()
        competition.save(update_fields=["comments_count"])

        serializer = CompetitionAnnouncementCommentSerializer(comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CompetitionParticipantsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        competition = get_object_or_404(
            Competition,
            pk=pk,
            is_public=True,
        )

        participants = CompetitionParticipant.objects.filter(
            competition=competition
        ).select_related("user").order_by("display_name")

        serializer = CompetitionParticipantSerializer(
            participants,
            many=True,
        )
        return Response(serializer.data)


class JoinCompetitionView(APIView):
    permission_classes = [IsAuthenticated]

    ALLOWED_ROLES = {"participant", "team", "observer"}

    def post(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)

        role = (request.data.get("role") or "").strip()
        if role not in self.ALLOWED_ROLES:
            return Response(
                {"detail": "Invalid role."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        join_request, _ = CompetitionJoinRequest.objects.get_or_create(
            competition=competition,
            user=request.user,
            role=role,
            defaults={"status": "approved"},
        )

        full_name = request.user.get_full_name().strip()
        display_name = full_name or getattr(request.user, "username", "") or getattr(request.user, "email", "")

        CompetitionParticipant.objects.get_or_create(
            competition=competition,
            user=request.user,
            defaults={
                "display_name": display_name,
                "role": role,
                "is_active_now": False,
            },
        )

        competition.participants_count = CompetitionParticipant.objects.filter(
            competition=competition
        ).count()
        competition.save(update_fields=["participants_count"])

        serializer = CompetitionJoinRequestSerializer(join_request)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CompetitionResultsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        competition = get_object_or_404(
            Competition,
            pk=pk,
            is_public=True,
        )

        round_history = CompetitionRoundResult.objects.filter(
            competition=competition
        ).order_by("round_number", "id")

        leaderboard = CompetitionLeaderboardEntry.objects.filter(
            competition=competition
        ).order_by("rank", "id")

        return Response({
            "round_history": CompetitionRoundResultSerializer(
                round_history,
                many=True,
            ).data,
            "leaderboard": CompetitionLeaderboardEntrySerializer(
                leaderboard,
                many=True,
            ).data,
        })


class CompetitionJudgingView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        competition = get_object_or_404(
            Competition,
            pk=pk,
            is_public=True,
        )

        metrics = CompetitionJudgingMetric.objects.filter(
            competition=competition
        ).order_by("sort_order", "id")

        mode = metrics[0].mode if metrics else "individual"

        return Response({
            "mode": mode,
            "metrics": CompetitionJudgingMetricSerializer(
                metrics,
                many=True,
            ).data,
        })