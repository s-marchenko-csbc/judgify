from rest_framework import serializers

from .models import (
    Competition,
    UserSavedCompetition,
    UserCompetitionWatch,
    CompetitionMaterial,
    CompetitionPlannedEvent,
    CompetitionAnnouncement,
    CompetitionAnnouncementComment,
    CompetitionParticipant,
    CompetitionJoinRequest,
    CompetitionRoundResult,
    CompetitionLeaderboardEntry,
    CompetitionJudgingMetric,
)


class CompetitionMaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetitionMaterial
        fields = [
            "id",
            "name",
            "material_type",
            "url",
            "sort_order",
            "created_at",
        ]


class CompetitionPlannedEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetitionPlannedEvent
        fields = [
            "id",
            "title",
            "description",
            "event_kind",
            "starts_at",
            "ends_at",
            "sort_order",
            "created_at",
        ]


class CompetitionAnnouncementCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = CompetitionAnnouncementComment
        fields = [
            "id",
            "author",
            "author_name",
            "text",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "author",
            "author_name",
            "created_at",
        ]

    def get_author_name(self, obj):
        if obj.author:
            full_name = obj.author.get_full_name()
            if full_name:
                return full_name
            return getattr(obj.author, "username", "") or getattr(obj.author, "email", "")
        return ""


class CompetitionAnnouncementSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    comments = CompetitionAnnouncementCommentSerializer(many=True, read_only=True)

    class Meta:
        model = CompetitionAnnouncement
        fields = [
            "id",
            "competition",
            "title",
            "text",
            "author",
            "author_name",
            "is_pinned",
            "created_at",
            "comments",
        ]
        read_only_fields = [
            "id",
            "author_name",
            "created_at",
            "comments",
        ]

    def get_author_name(self, obj):
        if obj.author:
            full_name = obj.author.get_full_name()
            if full_name:
                return full_name
            return getattr(obj.author, "username", "") or getattr(obj.author, "email", "")
        return "Organizer"


class CompetitionParticipantSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = CompetitionParticipant
        fields = [
            "id",
            "competition",
            "user",
            "user_name",
            "display_name",
            "role",
            "is_active_now",
            "joined_at",
        ]
        read_only_fields = [
            "id",
            "user_name",
            "joined_at",
        ]

    def get_user_name(self, obj):
        if obj.user:
            full_name = obj.user.get_full_name()
            if full_name:
                return full_name
            return getattr(obj.user, "username", "") or getattr(obj.user, "email", "")
        return obj.display_name


class CompetitionJoinRequestSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = CompetitionJoinRequest
        fields = [
            "id",
            "competition",
            "user",
            "user_name",
            "role",
            "status",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "user_name",
            "status",
            "created_at",
        ]

    def get_user_name(self, obj):
        if obj.user:
            full_name = obj.user.get_full_name()
            if full_name:
                return full_name
            return getattr(obj.user, "username", "") or getattr(obj.user, "email", "")
        return ""


class CompetitionRoundResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetitionRoundResult
        fields = [
            "id",
            "competition",
            "round_number",
            "leader_name",
            "top_score",
            "summary",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
        ]


class CompetitionLeaderboardEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetitionLeaderboardEntry
        fields = [
            "id",
            "competition",
            "rank",
            "name",
            "score",
            "entry_type",
            "round_number",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
        ]


class CompetitionJudgingMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetitionJudgingMetric
        fields = [
            "id",
            "competition",
            "mode",
            "label",
            "value",
            "max_value",
            "sort_order",
        ]


class UserCompetitionWatchSerializer(serializers.ModelSerializer):
    competition_name = serializers.CharField(source="competition.name", read_only=True)
    competition_slug = serializers.CharField(source="competition.slug", read_only=True)

    class Meta:
        model = UserCompetitionWatch
        fields = [
            "id",
            "competition",
            "competition_name",
            "competition_slug",
            "watch_live",
            "watch_rounds",
            "watch_updates",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "competition_name",
            "competition_slug",
            "created_at",
        ]


class SidebarCompetitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Competition
        fields = [
            "id",
            "name",
            "slug",
            "cover_image",
            "participants_count",
            "comments_count",
            "status",
        ]


class CompetitionCardSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    event_type_label = serializers.CharField(source="get_event_type_display", read_only=True)
    participation_type_label = serializers.CharField(
        source="get_participation_type_display",
        read_only=True,
    )
    industry_label = serializers.CharField(source="get_industry_display", read_only=True)
    difficulty_label = serializers.CharField(source="get_difficulty_display", read_only=True)

    is_saved = serializers.SerializerMethodField()
    is_watching = serializers.SerializerMethodField()

    class Meta:
        model = Competition
        fields = [
            "id",
            "slug",
            "name",
            "short_description",
            "cover_image",
            "status",
            "status_label",
            "event_type",
            "event_type_label",
            "participation_type",
            "participation_type_label",
            "industry",
            "industry_label",
            "difficulty",
            "difficulty_label",
            "current_round",
            "total_rounds",
            "participants_count",
            "comments_count",
            "views_count",
            "followers_count",
            "is_live_stream_enabled",
            "is_online_now",
            "registration_open",
            "submissions_open",
            "trending_score",
            "starts_at",
            "ends_at",
            "timer_deadline",
            "is_saved",
            "is_watching",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "slug",
            "status_label",
            "event_type_label",
            "participation_type_label",
            "industry_label",
            "difficulty_label",
            "participants_count",
            "comments_count",
            "views_count",
            "followers_count",
            "trending_score",
            "is_saved",
            "is_watching",
            "created_at",
            "updated_at",
        ]

    def get_is_saved(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        return UserSavedCompetition.objects.filter(
            user=request.user,
            competition=obj,
        ).exists()

    def get_is_watching(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        return UserCompetitionWatch.objects.filter(
            user=request.user,
            competition=obj,
        ).exists()


class CompetitionDetailSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    event_type_label = serializers.CharField(source="get_event_type_display", read_only=True)
    participation_type_label = serializers.CharField(
        source="get_participation_type_display",
        read_only=True,
    )
    industry_label = serializers.CharField(source="get_industry_display", read_only=True)
    difficulty_label = serializers.CharField(source="get_difficulty_display", read_only=True)

    is_saved = serializers.SerializerMethodField()
    is_watching = serializers.SerializerMethodField()

    materials = CompetitionMaterialSerializer(many=True, read_only=True)
    planned_events = CompetitionPlannedEventSerializer(many=True, read_only=True)

    class Meta:
        model = Competition
        fields = [
            "id",
            "slug",
            "name",
            "short_description",
            "full_description",
            "cover_image",
            "banner_image",
            "status",
            "status_label",
            "event_type",
            "event_type_label",
            "participation_type",
            "participation_type_label",
            "industry",
            "industry_label",
            "difficulty",
            "difficulty_label",
            "current_round",
            "total_rounds",
            "participants_count",
            "comments_count",
            "views_count",
            "followers_count",
            "is_live_stream_enabled",
            "is_online_now",
            "registration_open",
            "submissions_open",
            "is_public",
            "trending_score",
            "starts_at",
            "ends_at",
            "timer_deadline",
            "materials",
            "planned_events",
            "is_saved",
            "is_watching",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "slug",
            "status_label",
            "event_type_label",
            "participation_type_label",
            "industry_label",
            "difficulty_label",
            "participants_count",
            "comments_count",
            "views_count",
            "followers_count",
            "trending_score",
            "materials",
            "planned_events",
            "is_saved",
            "is_watching",
            "created_at",
            "updated_at",
        ]

    def get_is_saved(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        return UserSavedCompetition.objects.filter(
            user=request.user,
            competition=obj,
        ).exists()

    def get_is_watching(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        return UserCompetitionWatch.objects.filter(
            user=request.user,
            competition=obj,
        ).exists()


class UserSavedCompetitionSerializer(serializers.ModelSerializer):
    competition = CompetitionCardSerializer(read_only=True)

    class Meta:
        model = UserSavedCompetition
        fields = [
            "id",
            "competition",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "competition",
            "created_at",
        ]