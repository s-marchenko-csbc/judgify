from django.contrib import admin
from .models import (
    Competition, UserSavedCompetition, UserCompetitionWatch,
    UserProfile, UserFile, RecentlyViewedCompetition, RecentlyViewedMaterial, Badge, UserBadge, Certificate, UserMaterial,
    CompetitionTeam, CompetitionParticipant, CompetitionJoinRequest,
    CompetitionRound, CompetitionSubmissionSettings, CompetitionJudgingCriterion,
    CompetitionSubmission, CompetitionJudgeAssignment, CompetitionScore,
    CompetitionAward, CompetitionInvitation, OutboundMessage,
)


@admin.register(Competition)
class CompetitionAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'name', 'status', 'event_type', 'participation_type', 'industry',
        'difficulty', 'language', 'is_online_now', 'submissions_open', 'created_at'
    )
    list_filter = (
        'status', 'event_type', 'participation_type', 'industry', 'difficulty', 'language',
        'is_online_now', 'submissions_open'
    )
    search_fields = ('name', 'short_description', 'slug')


@admin.register(UserSavedCompetition)
class UserSavedCompetitionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'competition', 'created_at')


@admin.register(UserCompetitionWatch)
class UserCompetitionWatchAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'competition', 'watch_live', 'watch_rounds', 'watch_updates', 'created_at')


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "display_name", "primary_role", "organization", "updated_at")
    list_filter = ("primary_role",)
    search_fields = ("display_name", "user__username", "user__email", "organization")


@admin.register(UserFile)
class UserFileAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "original_name", "file_type", "visibility", "size_bytes", "created_at")
    list_filter = ("file_type", "visibility")
    search_fields = ("original_name", "storage_key", "owner__username")


@admin.register(RecentlyViewedCompetition)
class RecentlyViewedCompetitionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "competition", "view_count", "viewed_at")


@admin.register(RecentlyViewedMaterial)
class RecentlyViewedMaterialAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "material", "view_count", "viewed_at")

admin.site.register(Badge)
admin.site.register(UserBadge)
admin.site.register(Certificate)
admin.site.register(UserMaterial)


@admin.register(CompetitionTeam)
class CompetitionTeamAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "competition", "status", "captain", "updated_at")
    list_filter = ("status", "competition")
    search_fields = ("name", "competition__name", "captain__username", "captain__email")


@admin.register(CompetitionParticipant)
class CompetitionParticipantAdmin(admin.ModelAdmin):
    list_display = ("id", "display_name", "competition", "team", "role", "status", "is_active_now", "joined_at")
    list_filter = ("role", "status", "competition")
    search_fields = ("display_name", "user__username", "user__email", "team__name", "competition__name")


@admin.register(CompetitionJoinRequest)
class CompetitionJoinRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "competition", "role", "status", "team_name", "created_at", "reviewed_at")
    list_filter = ("role", "status", "competition")
    search_fields = ("user__username", "user__email", "competition__name", "team_name")


@admin.register(CompetitionRound)
class CompetitionRoundAdmin(admin.ModelAdmin):
    list_display = ("competition", "title", "status", "starts_at", "ends_at", "submission_required", "sort_order")
    list_filter = ("status", "submission_required")


@admin.register(CompetitionSubmissionSettings)
class CompetitionSubmissionSettingsAdmin(admin.ModelAdmin):
    list_display = ("competition", "submission_mode", "submission_policy", "max_file_size_mb", "max_submissions")


@admin.register(CompetitionJudgingCriterion)
class CompetitionJudgingCriterionAdmin(admin.ModelAdmin):
    list_display = ("competition", "title", "judging_mode", "max_score", "weight")


@admin.register(CompetitionSubmission)
class CompetitionSubmissionAdmin(admin.ModelAdmin):
    list_display = ("id", "competition", "round", "participant", "team", "status", "updated_at")
    list_filter = ("status", "competition", "round")
    search_fields = ("title", "participant__display_name", "team__name", "competition__name")


@admin.register(CompetitionJudgeAssignment)
class CompetitionJudgeAssignmentAdmin(admin.ModelAdmin):
    list_display = ("id", "competition", "round", "judge", "assignment_type", "status", "updated_at")
    list_filter = ("assignment_type", "status", "competition")
    search_fields = ("judge__username", "judge__email", "competition__name")


@admin.register(CompetitionScore)
class CompetitionScoreAdmin(admin.ModelAdmin):
    list_display = ("id", "competition", "round", "criterion", "judge", "review_type", "score", "is_final", "updated_at")
    list_filter = ("review_type", "is_final", "competition", "round")
    search_fields = ("criterion__title", "judge__username", "judge__email", "subject_participant__display_name", "subject_team__name")


@admin.register(CompetitionAward)
class CompetitionAwardAdmin(admin.ModelAdmin):
    list_display = ("competition", "title", "place", "issue_certificate", "issue_badge")


@admin.register(CompetitionInvitation)
class CompetitionInvitationAdmin(admin.ModelAdmin):
    list_display = ("competition", "email", "target_type", "team_name", "status", "created_at")
    list_filter = ("target_type", "status")
    search_fields = ("email", "competition__name", "team_name")


@admin.register(OutboundMessage)
class OutboundMessageAdmin(admin.ModelAdmin):
    list_display = ("recipient_email", "competition", "channel", "status", "created_at")
    list_filter = ("channel", "status")
    search_fields = ("recipient_email", "subject")
