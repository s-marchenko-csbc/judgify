from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import (
    Competition,
    UserSavedCompetition,
    UserCompetitionWatch,
    CompetitionMaterial,
    CompetitionPlannedEvent,
    CompetitionAnnouncement,
    CompetitionAnnouncementComment,
    CompetitionTeam,
    CompetitionParticipant,
    CompetitionJoinRequest,
    CompetitionSubmission,
    CompetitionRound,
    CompetitionSubmissionSettings,
    CompetitionJudgingCriterion,
    CompetitionJudgeAssignment,
    CompetitionScore,
    CompetitionAward,
    CompetitionInvitation,
    OutboundMessage,
    CompetitionRoundResult,
    CompetitionLeaderboardEntry,
    CompetitionJudgingMetric,
    UserProfile,
    UserFile,
    RecentlyViewedCompetition,
    RecentlyViewedMaterial,
    Badge,
    UserBadge,
    Certificate,
    UserMaterial,
)


def build_file_download_url(user_file, request=None):
    if not user_file:
        return ""
    if user_file.public_url:
        return user_file.public_url
    path = f"/api/files/{user_file.id}/download/"
    return request.build_absolute_uri(path) if request else path


class CompetitionRoundSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = CompetitionRound
        fields = [
            "id", "title", "description", "status", "starts_at", "ends_at",
            "submission_required", "max_attempts",
            "is_stream_enabled", "stream_url", "stream_embed_url", "stream_label",
            "sort_order",
        ]


class CompetitionSubmissionSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetitionSubmissionSettings
        fields = [
            "submission_mode", "submission_policy", "allowed_file_types", "max_file_size_mb",
            "max_submissions", "repository_url_required", "demo_url_required",
            "description_required",
        ]


class CompetitionJudgingCriterionSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = CompetitionJudgingCriterion
        fields = [
            "id", "judging_mode", "title", "description",
            "max_score", "weight", "sort_order",
        ]


class CompetitionAwardSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = CompetitionAward
        fields = ["id", "title", "place", "issue_certificate", "issue_badge", "description"]


class CompetitionInvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetitionInvitation
        fields = [
            "id", "email", "target_type", "team_name", "status",
            "message", "expires_at", "sent_at", "responded_at", "created_at",
        ]
        read_only_fields = ["id", "status", "sent_at", "responded_at", "created_at"]


class OutboundMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = OutboundMessage
        fields = [
            "id", "recipient_email", "channel", "subject", "body",
            "status", "error_message", "queued_at", "sent_at", "created_at",
        ]
        read_only_fields = ["id", "status", "error_message", "queued_at", "sent_at", "created_at"]


class CompetitionBuilderSerializer(serializers.ModelSerializer):
    ROUND_ACTIVITY_LOCKED_FIELDS = {"submission_required", "max_attempts", "sort_order"}
    SCORED_CRITERION_LOCKED_FIELDS = {"judging_mode", "max_score", "weight"}

    rounds = CompetitionRoundSerializer(many=True, required=False)
    submission_settings = CompetitionSubmissionSettingsSerializer(required=False)
    judging_criteria = CompetitionJudgingCriterionSerializer(many=True, required=False)
    awards = CompetitionAwardSerializer(many=True, required=False)
    materials = serializers.SerializerMethodField()
    invitations = CompetitionInvitationSerializer(many=True, read_only=True)

    class Meta:
        model = Competition
        fields = [
            "id", "slug", "name", "short_description", "full_description",
            "cover_image", "banner_image", "status", "event_type",
            "participation_type", "industry", "difficulty", "language",
            "access_mode", "visibility_mode", "show_in_catalog",
            "allow_sharing_link", "allow_external_registration",
            "min_team_size", "max_team_size", "allow_user_team_invites",
            "allow_organizer_team_assignment", "manual_judging_enabled",
            "automatic_judging_enabled", "peer_review_enabled",
            "judging_aggregation", "judging_visibility", "results_frozen",
            "registration_open",
            "submissions_open", "is_public", "setup_step",
            "completion_percent", "publish_ready",
            "organizer_approval_status", "organizer_approved_at",
            "registration_starts_at", "registration_ends_at",
            "starts_at", "ends_at", "judging_starts_at",
            "judging_ends_at", "results_public_at", "timer_deadline",
            "current_round", "total_rounds", "rounds",
            "submission_settings", "judging_criteria", "awards", "materials", "invitations",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "slug", "organizer_approval_status",
            "organizer_approved_at", "created_at", "updated_at",
        ]

    def validate(self, attrs):
        data = {**getattr(self.instance, "__dict__", {}), **attrs}

        starts_at = data.get("starts_at")
        ends_at = data.get("ends_at")
        registration_starts_at = data.get("registration_starts_at")
        registration_ends_at = data.get("registration_ends_at")
        judging_starts_at = data.get("judging_starts_at")
        judging_ends_at = data.get("judging_ends_at")
        results_public_at = data.get("results_public_at")

        if starts_at and not judging_starts_at:
            attrs["judging_starts_at"] = starts_at
            judging_starts_at = starts_at
        if ends_at and not judging_ends_at:
            attrs["judging_ends_at"] = ends_at
            judging_ends_at = ends_at

        errors = {}

        if starts_at and ends_at and ends_at <= starts_at:
            errors["ends_at"] = "Competition end must be later than competition start."

        if registration_starts_at and starts_at and registration_starts_at > starts_at:
            errors["registration_starts_at"] = "Registration cannot start after the competition starts."
        if registration_ends_at and starts_at and registration_ends_at > starts_at:
            errors["registration_ends_at"] = "Registration must end no later than the competition start."
        if registration_starts_at and registration_ends_at and registration_ends_at <= registration_starts_at:
            errors["registration_ends_at"] = "Registration end must be later than registration start."

        if judging_starts_at and judging_ends_at and judging_ends_at <= judging_starts_at:
            errors["judging_ends_at"] = "Judging end must be later than judging start."
        if results_public_at and judging_ends_at and results_public_at < judging_ends_at:
            errors["results_public_at"] = "Results cannot be published before judging ends."

        rounds = attrs.get("rounds", None)
        if rounds is not None and starts_at and ends_at:
            round_errors = []
            previous_end = None
            for index, round_data in enumerate(rounds):
                item_errors = {}
                round_start = round_data.get("starts_at")
                round_end = round_data.get("ends_at")
                effective_round_start = round_start
                if not effective_round_start and previous_end:
                    effective_round_start = previous_end + timedelta(seconds=1)
                elif not effective_round_start and index == 0:
                    effective_round_start = starts_at
                if effective_round_start and effective_round_start < starts_at:
                    item_errors["starts_at"] = "Round must start within the competition window."
                if round_end and round_end > ends_at:
                    item_errors["ends_at"] = "Round must end within the competition window."
                if effective_round_start and round_end and round_end <= effective_round_start:
                    item_errors["ends_at"] = "Round end must be later than round start."
                if previous_end and effective_round_start and effective_round_start <= previous_end:
                    item_errors["starts_at"] = "Next round must start after the previous round ends."
                if previous_end and round_end and round_end <= previous_end:
                    item_errors["ends_at"] = "Next round must end after the previous round ends."
                if round_end:
                    previous_end = round_end
                if item_errors:
                    round_errors.append({"index": index, **item_errors})
            if round_errors:
                errors["rounds"] = round_errors

        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def get_materials(self, obj):
        return CompetitionMaterialSerializer(obj.materials.all(), many=True, context=self.context).data

    def create(self, validated_data):
        nested = self._pop_nested(validated_data)
        competition = Competition.objects.create(**validated_data)
        self._sync_nested(competition, nested)
        return competition

    def update(self, instance, validated_data):
        nested = self._pop_nested(validated_data)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.is_public = instance.visibility_mode == "public"
        instance.show_in_catalog = instance.visibility_mode == "public" and instance.show_in_catalog
        instance.save()
        self._sync_nested(instance, nested)
        return instance

    def _pop_nested(self, data):
        return {
            "rounds": data.pop("rounds", None),
            "submission_settings": data.pop("submission_settings", None),
            "judging_criteria": data.pop("judging_criteria", None),
            "awards": data.pop("awards", None),
        }

    def _sync_nested(self, competition, nested):
        if nested.get("rounds") is not None:
            round_items = nested["rounds"] or [{"title": "Round 1", "description": "", "sort_order": 0}]
            existing_rounds = {round_obj.id: round_obj for round_obj in competition.rounds.all()}
            seen_round_ids = set()
            for index, item in enumerate(round_items):
                item = item.copy()
                round_id = item.pop("id", None)
                item.setdefault("sort_order", index)
                if round_id and round_id in existing_rounds:
                    round_obj = existing_rounds[round_id]
                    locked_changes = self._locked_round_changes(round_obj, item)
                    if locked_changes:
                        raise serializers.ValidationError({
                            "rounds": (
                                f"Cannot change {', '.join(locked_changes)} for started rounds "
                                "or rounds with submissions, scores, or judge assignments."
                            )
                        })
                    for key, value in item.items():
                        setattr(round_obj, key, value)
                    round_obj.save()
                    seen_round_ids.add(round_obj.id)
                else:
                    round_obj = CompetitionRound.objects.create(competition=competition, **item)
                    seen_round_ids.add(round_obj.id)

            removable_rounds = [round_obj for round_id, round_obj in existing_rounds.items() if round_id not in seen_round_ids]
            blocked_rounds = [
                round_obj.title
                for round_obj in removable_rounds
                if round_obj.submissions.exists() or round_obj.scores.exists() or round_obj.judge_assignments.exists()
            ]
            if blocked_rounds:
                raise serializers.ValidationError({
                    "rounds": f"Cannot delete rounds with submissions, scores, or judge assignments: {', '.join(blocked_rounds)}."
                })
            for round_obj in removable_rounds:
                round_obj.delete()

            rounds = list(competition.rounds.all())
            competition.total_rounds = max(1, len(rounds))

            dated_starts = [round_obj.starts_at for round_obj in rounds if round_obj.starts_at]
            dated_ends = [round_obj.ends_at for round_obj in rounds if round_obj.ends_at]
            if dated_starts and not competition.starts_at:
                competition.starts_at = min(dated_starts)
            if dated_ends and not competition.ends_at:
                competition.ends_at = max(dated_ends)
            competition.save(update_fields=["total_rounds", "starts_at", "ends_at", "updated_at"])

        if nested.get("submission_settings") is not None:
            CompetitionSubmissionSettings.objects.update_or_create(
                competition=competition, defaults=nested["submission_settings"]
            )

        if nested.get("judging_criteria") is not None:
            existing_criteria = {criterion.id: criterion for criterion in competition.judging_criteria.all()}
            seen_criterion_ids = set()
            for index, item in enumerate(nested["judging_criteria"]):
                item = item.copy()
                criterion_id = item.pop("id", None)
                item.setdefault("sort_order", index)
                if criterion_id and criterion_id in existing_criteria:
                    criterion = existing_criteria[criterion_id]
                    locked_changes = self._locked_criterion_changes(criterion, item)
                    if locked_changes:
                        raise serializers.ValidationError({
                            "judging_criteria": (
                                f"Cannot change {', '.join(locked_changes)} for criteria that already have scores."
                            )
                        })
                    for key, value in item.items():
                        setattr(criterion, key, value)
                    criterion.save()
                    seen_criterion_ids.add(criterion.id)
                else:
                    criterion = CompetitionJudgingCriterion.objects.create(competition=competition, **item)
                    seen_criterion_ids.add(criterion.id)

            removable_criteria = [
                criterion for criterion_id, criterion in existing_criteria.items()
                if criterion_id not in seen_criterion_ids
            ]
            blocked_criteria = [criterion.title for criterion in removable_criteria if criterion.scores.exists()]
            if blocked_criteria:
                raise serializers.ValidationError({
                    "judging_criteria": f"Cannot delete criteria with existing scores: {', '.join(blocked_criteria)}."
                })
            for criterion in removable_criteria:
                criterion.delete()

        if nested.get("awards") is not None:
            existing_awards = {award.id: award for award in competition.awards.all()}
            seen_award_ids = set()
            for item in nested["awards"]:
                item = item.copy()
                award_id = item.pop("id", None)
                if award_id and award_id in existing_awards:
                    award = existing_awards[award_id]
                    for key, value in item.items():
                        setattr(award, key, value)
                    award.save()
                    seen_award_ids.add(award.id)
                else:
                    award = CompetitionAward.objects.create(competition=competition, **item)
                    seen_award_ids.add(award.id)
            for award_id, award in existing_awards.items():
                if award_id not in seen_award_ids:
                    award.delete()

    def _locked_round_changes(self, round_obj, incoming):
        has_activity = (
            (round_obj.starts_at and round_obj.starts_at <= timezone.now())
            or round_obj.submissions.exists()
            or round_obj.scores.exists()
            or round_obj.judge_assignments.exists()
        )
        if not has_activity:
            return []
        changes = []
        for field in self.ROUND_ACTIVITY_LOCKED_FIELDS:
            if field in incoming and getattr(round_obj, field) != incoming[field]:
                changes.append(field)
        return changes

    def _locked_criterion_changes(self, criterion, incoming):
        if not criterion.scores.exists():
            return []
        changes = []
        for field in self.SCORED_CRITERION_LOCKED_FIELDS:
            if field in incoming and getattr(criterion, field) != incoming[field]:
                changes.append(field)
        return changes


class CompetitionMaterialSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    has_file = serializers.SerializerMethodField()
    file_id = serializers.IntegerField(read_only=True)
    original_name = serializers.CharField(source="file.original_name", read_only=True)
    mime_type = serializers.CharField(source="file.mime_type", read_only=True)
    size_bytes = serializers.IntegerField(source="file.size_bytes", read_only=True)

    class Meta:
        model = CompetitionMaterial
        fields = [
            "id",
            "competition",
            "name",
            "material_type",
            "url",
            "file_url",
            "download_url",
            "has_file",
            "file_id",
            "original_name",
            "mime_type",
            "size_bytes",
            "sort_order",
            "created_at",
        ]

    def get_url(self, obj):
        return obj.url or ""

    def get_file_url(self, obj):
        return build_file_download_url(obj.file, self.context.get("request"))

    def get_download_url(self, obj):
        return self.get_file_url(obj) or obj.url or ""

    def get_has_file(self, obj):
        return bool(obj.file_id)




class RecentlyViewedMaterialSerializer(serializers.ModelSerializer):
    material = CompetitionMaterialSerializer(read_only=True)
    competition_id = serializers.IntegerField(source="material.competition_id", read_only=True)
    competition_name = serializers.CharField(source="material.competition.name", read_only=True)

    class Meta:
        model = RecentlyViewedMaterial
        fields = ["id", "material", "competition_id", "competition_name", "view_count", "viewed_at"]
        read_only_fields = fields


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
            "competition",
            "author",
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


class TeamMemberSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = CompetitionParticipant
        fields = ["id", "user", "user_name", "display_name", "role", "status", "is_active_now", "avatar"]

    def get_user_name(self, obj):
        if obj.user:
            full_name = obj.user.get_full_name()
            return full_name or getattr(obj.user, "username", "") or getattr(obj.user, "email", "")
        return obj.display_name

    def get_avatar(self, obj):
        profile = getattr(obj.user, "profile", None) if obj.user else None
        if profile and profile.avatar_file:
            return profile.avatar_file.public_url or ""
        return ""


class CompetitionTeamSerializer(serializers.ModelSerializer):
    competition_name = serializers.CharField(source="competition.name", read_only=True)
    captain_name = serializers.SerializerMethodField()
    members = TeamMemberSerializer(many=True, read_only=True)

    class Meta:
        model = CompetitionTeam
        fields = [
            "id", "competition", "competition_name", "name", "description",
            "status", "captain", "captain_name", "members", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "competition_name", "captain_name", "members", "created_at", "updated_at"]

    def get_captain_name(self, obj):
        if obj.captain:
            return obj.captain.get_full_name() or obj.captain.get_username() or getattr(obj.captain, "email", "")
        return ""


class CompetitionParticipantSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    team_name = serializers.CharField(source="team.name", read_only=True)

    class Meta:
        model = CompetitionParticipant
        fields = [
            "id",
            "competition",
            "user",
            "user_name",
            "display_name",
            "role",
            "status",
            "team",
            "team_name",
            "is_active_now",
            "joined_at",
        ]
        read_only_fields = [
            "id",
            "user_name",
            "team_name",
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
    team_name = serializers.CharField(read_only=True)

    class Meta:
        model = CompetitionJoinRequest
        fields = [
            "id",
            "competition",
            "user",
            "user_name",
            "role",
            "status",
            "team",
            "team_name",
            "message",
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


class CompetitionSubmissionSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source="participant.display_name", read_only=True)
    team_name = serializers.CharField(source="team.name", read_only=True)
    round_title = serializers.CharField(source="round.title", read_only=True)
    submitted_by_name = serializers.SerializerMethodField()
    file = serializers.SerializerMethodField()

    class Meta:
        model = CompetitionSubmission
        fields = [
            "id",
            "competition",
            "round",
            "round_title",
            "participant",
            "participant_name",
            "team",
            "team_name",
            "submitted_by",
            "submitted_by_name",
            "title",
            "description",
            "repository_url",
            "demo_url",
            "file",
            "status",
            "locked_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "round_title", "participant_name", "team_name", "submitted_by_name", "file", "created_at", "updated_at"]

    def get_submitted_by_name(self, obj):
        if not obj.submitted_by:
            return ""
        full_name = obj.submitted_by.get_full_name()
        return full_name or obj.submitted_by.get_username() or getattr(obj.submitted_by, "email", "")

    def get_file(self, obj):
        if not obj.file:
            return None
        request = self.context.get("request")
        return {
            "id": obj.file_id,
            "original_name": obj.file.original_name,
            "mime_type": obj.file.mime_type,
            "size_bytes": obj.file.size_bytes,
            "url": build_file_download_url(obj.file, request),
        }


class CompetitionJudgeAssignmentSerializer(serializers.ModelSerializer):
    judge_name = serializers.SerializerMethodField()
    round_title = serializers.CharField(source="round.title", read_only=True)

    class Meta:
        model = CompetitionJudgeAssignment
        fields = [
            "id",
            "competition",
            "round",
            "round_title",
            "judge",
            "judge_name",
            "assignment_type",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_judge_name(self, obj):
        full_name = obj.judge.get_full_name()
        return full_name or obj.judge.get_username() or getattr(obj.judge, "email", "")


class CompetitionScoreSerializer(serializers.ModelSerializer):
    judge_name = serializers.SerializerMethodField()
    criterion_title = serializers.CharField(source="criterion.title", read_only=True)
    criterion_max_score = serializers.IntegerField(source="criterion.max_score", read_only=True)
    round_title = serializers.CharField(source="round.title", read_only=True)
    participant_name = serializers.CharField(source="subject_participant.display_name", read_only=True)
    team_name = serializers.CharField(source="subject_team.name", read_only=True)

    class Meta:
        model = CompetitionScore
        fields = [
            "id",
            "competition",
            "round",
            "round_title",
            "criterion",
            "criterion_title",
            "criterion_max_score",
            "judge",
            "judge_name",
            "subject_participant",
            "participant_name",
            "subject_team",
            "team_name",
            "submission",
            "review_type",
            "score",
            "comment",
            "is_final",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "judge_name", "criterion_title", "criterion_max_score", "round_title", "participant_name", "team_name", "created_at", "updated_at"]

    def get_judge_name(self, obj):
        if not obj.judge:
            return "Automatic"
        visibility = getattr(obj.competition, "judging_visibility", "aggregate")
        request = self.context.get("request")
        can_see_name = visibility == "open"
        if request and request.user.is_authenticated:
            can_see_name = can_see_name or request.user.id == obj.judge_id
        if not can_see_name:
            return "Anonymous judge"
        full_name = obj.judge.get_full_name()
        return full_name or obj.judge.get_username() or getattr(obj.judge, "email", "")


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
            "language",
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
    language_label = serializers.CharField(source="get_language_display", read_only=True)

    is_saved = serializers.SerializerMethodField()
    is_watching = serializers.SerializerMethodField()
    user_participation_status = serializers.SerializerMethodField()
    user_participation_role = serializers.SerializerMethodField()
    user_team = serializers.SerializerMethodField()
    can_join = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

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
            "access_mode",
            "visibility_mode",
            "show_in_catalog",
            "allow_sharing_link",
            "allow_external_registration",
            "min_team_size",
            "max_team_size",
            "manual_judging_enabled",
            "automatic_judging_enabled",
            "peer_review_enabled",
            "judging_aggregation",
            "judging_visibility",
            "results_frozen",
            "industry",
            "industry_label",
            "difficulty",
            "difficulty_label",
            "language",
            "language_label",
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
            "registration_starts_at",
            "registration_ends_at",
            "starts_at",
            "ends_at",
            "judging_starts_at",
            "judging_ends_at",
            "results_public_at",
            "timer_deadline",
            "is_saved",
            "is_watching",
            "user_participation_status",
            "user_participation_role",
            "user_team",
            "can_join",
            "can_edit",
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
            "language_label",
            "participants_count",
            "comments_count",
            "views_count",
            "followers_count",
            "trending_score",
            "is_saved",
            "is_watching",
            "user_participation_status",
            "user_participation_role",
            "user_team",
            "can_join",
            "can_edit",
            "created_at",
            "updated_at",
        ]

    def get_is_saved(self, obj):
        if "saved_competition_ids" in self.context:
            return obj.id in self.context["saved_competition_ids"]
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        return UserSavedCompetition.objects.filter(
            user=request.user,
            competition=obj,
        ).exists()

    def get_is_watching(self, obj):
        if "watched_competition_ids" in self.context:
            return obj.id in self.context["watched_competition_ids"]
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        return UserCompetitionWatch.objects.filter(
            user=request.user,
            competition=obj,
        ).exists()

    def _membership(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        if not hasattr(obj, "_current_user_membership"):
            obj._current_user_membership = CompetitionParticipant.objects.filter(
                competition=obj, user=request.user
            ).select_related("team").first()
        return obj._current_user_membership

    def _join_request(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        if not hasattr(obj, "_current_user_join_request"):
            obj._current_user_join_request = CompetitionJoinRequest.objects.filter(
                competition=obj, user=request.user
            ).order_by("-created_at").select_related("team").first()
        return obj._current_user_join_request

    def get_user_participation_status(self, obj):
        membership = self._membership(obj)
        if membership:
            return membership.status
        join_request = self._join_request(obj)
        if join_request:
            return join_request.status
        return "none"

    def get_user_participation_role(self, obj):
        membership = self._membership(obj)
        if membership:
            return membership.role
        join_request = self._join_request(obj)
        if join_request:
            return join_request.role
        return ""

    def get_user_team(self, obj):
        membership = self._membership(obj)
        team = membership.team if membership else None
        if not team:
            join_request = self._join_request(obj)
            team = join_request.team if join_request else None
        if not team:
            return None
        return {"id": team.id, "name": team.name, "status": team.status}

    def get_can_join(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            role = getattr(getattr(request.user, "profile", None), "primary_role", "")
            if role != "participant" or request.user.is_staff:
                return False
            membership = self._membership(obj)
            if membership and membership.role == "judge":
                return False
        if obj.access_mode == "invite_only":
            return False
        if obj.status not in ["registration_open", "upcoming", "active"] or not obj.registration_open:
            return False
        return self.get_user_participation_status(obj) in ["none", "rejected", "withdrawn"]

    def get_can_edit(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        role = getattr(getattr(request.user, "profile", None), "primary_role", "")
        if request.user.is_staff or role == "admin":
            return True
        if role != "organizer":
            return False
        return CompetitionParticipant.objects.filter(competition=obj, user=request.user, role="organizer").exists()


class CompetitionDetailSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    event_type_label = serializers.CharField(source="get_event_type_display", read_only=True)
    participation_type_label = serializers.CharField(
        source="get_participation_type_display",
        read_only=True,
    )
    industry_label = serializers.CharField(source="get_industry_display", read_only=True)
    difficulty_label = serializers.CharField(source="get_difficulty_display", read_only=True)
    language_label = serializers.CharField(source="get_language_display", read_only=True)

    is_saved = serializers.SerializerMethodField()
    is_watching = serializers.SerializerMethodField()
    user_participation_status = serializers.SerializerMethodField()
    user_participation_role = serializers.SerializerMethodField()
    user_team = serializers.SerializerMethodField()
    can_join = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

    rounds = CompetitionRoundSerializer(many=True, read_only=True)
    materials = CompetitionMaterialSerializer(many=True, read_only=True)
    planned_events = CompetitionPlannedEventSerializer(many=True, read_only=True)
    submission_settings = CompetitionSubmissionSettingsSerializer(read_only=True)

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
            "access_mode",
            "visibility_mode",
            "show_in_catalog",
            "allow_sharing_link",
            "allow_external_registration",
            "min_team_size",
            "max_team_size",
            "manual_judging_enabled",
            "automatic_judging_enabled",
            "peer_review_enabled",
            "judging_aggregation",
            "judging_visibility",
            "results_frozen",
            "industry",
            "industry_label",
            "difficulty",
            "difficulty_label",
            "language",
            "language_label",
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
            "registration_starts_at",
            "registration_ends_at",
            "starts_at",
            "ends_at",
            "judging_starts_at",
            "judging_ends_at",
            "results_public_at",
            "timer_deadline",
            "rounds",
            "submission_settings",
            "materials",
            "planned_events",
            "is_saved",
            "is_watching",
            "user_participation_status",
            "user_participation_role",
            "user_team",
            "can_join",
            "can_edit",
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
            "language_label",
            "participants_count",
            "comments_count",
            "views_count",
            "followers_count",
            "trending_score",
            "materials",
            "submission_settings",
            "planned_events",
            "is_saved",
            "is_watching",
            "user_participation_status",
            "user_participation_role",
            "user_team",
            "can_join",
            "can_edit",
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

    def _membership(self, obj):
        if "membership_by_competition" in self.context:
            return self.context["membership_by_competition"].get(obj.id)
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        return CompetitionParticipant.objects.filter(competition=obj, user=request.user).select_related("team").first()

    def _join_request(self, obj):
        if "join_request_by_competition" in self.context:
            return self.context["join_request_by_competition"].get(obj.id)
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        return CompetitionJoinRequest.objects.filter(competition=obj, user=request.user).order_by("-created_at").select_related("team").first()

    def get_user_participation_status(self, obj):
        membership = self._membership(obj)
        if membership:
            return membership.status
        join_request = self._join_request(obj)
        if join_request:
            return join_request.status
        return "none"

    def get_user_participation_role(self, obj):
        membership = self._membership(obj)
        if membership:
            return membership.role
        join_request = self._join_request(obj)
        if join_request:
            return join_request.role
        return ""

    def get_user_team(self, obj):
        membership = self._membership(obj)
        team = membership.team if membership else None
        if not team:
            join_request = self._join_request(obj)
            team = join_request.team if join_request else None
        if not team:
            return None
        return {"id": team.id, "name": team.name, "status": team.status}

    def get_can_join(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            role = self.context.get("user_primary_role")
            if role is None:
                role = getattr(getattr(request.user, "profile", None), "primary_role", "")
            if role != "participant" or request.user.is_staff:
                return False
            membership = self._membership(obj)
            if membership and membership.role == "judge":
                return False
        if obj.access_mode == "invite_only":
            return False
        if obj.status not in ["registration_open", "upcoming", "active"] or not obj.registration_open:
            return False
        return self.get_user_participation_status(obj) in ["none", "rejected", "withdrawn"]

    def get_can_edit(self, obj):
        if "editable_competition_ids" in self.context:
            return obj.id in self.context["editable_competition_ids"]
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        role = self.context.get("user_primary_role")
        if role is None:
            role = getattr(getattr(request.user, "profile", None), "primary_role", "")
        if request.user.is_staff or role == "admin":
            return True
        if role != "organizer":
            return False
        return CompetitionParticipant.objects.filter(competition=obj, user=request.user, role="organizer").exists()


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

class UserFileSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = UserFile
        fields = [
            "id", "storage_key", "original_name", "mime_type", "size_bytes",
            "file_type", "visibility", "url", "created_at",
        ]
        read_only_fields = fields

    def get_url(self, obj):
        return build_file_download_url(obj, self.context.get("request"))


class UserProfileSerializer(serializers.ModelSerializer):
    avatar = UserFileSerializer(source="avatar_file", read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            "display_name", "primary_role", "bio", "organization", "position",
            "phone", "country", "city", "skills", "interests", "links", "avatar", "avatar_url",
        ]
        read_only_fields = ["avatar", "avatar_url"]

    def get_avatar_url(self, obj):
        if obj.avatar_file and obj.avatar_file.public_url:
            return obj.avatar_file.public_url
        return (obj.links or {}).get("avatarDataUrl", "")


class UserBadgeSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source="badge.title", read_only=True)
    description = serializers.CharField(source="badge.description", read_only=True)
    badge_type = serializers.CharField(source="badge.badge_type", read_only=True)
    competition_name = serializers.CharField(source="competition.name", read_only=True)

    class Meta:
        model = UserBadge
        fields = ["id", "title", "description", "badge_type", "competition", "competition_name", "awarded_at"]


class CertificateSerializer(serializers.ModelSerializer):
    file = UserFileSerializer(read_only=True)
    competition_name = serializers.CharField(source="competition.name", read_only=True)

    class Meta:
        model = Certificate
        fields = ["id", "title", "competition", "competition_name", "file", "issued_at", "verification_code"]


class UserMaterialSerializer(serializers.ModelSerializer):
    file = UserFileSerializer(read_only=True)
    competition_name = serializers.CharField(source="competition.name", read_only=True)

    class Meta:
        model = UserMaterial
        fields = ["id", "title", "material_type", "competition", "competition_name", "file", "created_at"]
