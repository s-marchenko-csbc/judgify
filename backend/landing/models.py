import uuid

from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Competition(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("published", "Published"),
        ("upcoming", "Upcoming"),
        ("registration_open", "Registration Open"),
        ("active", "Active"),
        ("judging", "Judging"),
        ("finished", "Finished"),
        ("archived", "Archived"),
    ]

    EVENT_TYPE_CHOICES = [
        ("online", "Online"),
        ("offline", "Offline"),
        ("hybrid", "Hybrid"),
    ]

    PARTICIPATION_TYPE_CHOICES = [
        ("team", "Team"),
        ("individual", "Individual"),
        ("mixed", "Mixed"),
    ]

    ACCESS_MODE_CHOICES = [
        ("open", "Open registration"),
        ("application", "Application review"),
        ("invite_only", "Invite only"),
    ]

    VISIBILITY_MODE_CHOICES = [
        ("public", "Public catalog"),
        ("unlisted", "Unlisted link"),
        ("private", "Private"),
    ]

    ORGANIZER_APPROVAL_CHOICES = [
        ("pending", "Pending administrator approval"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    JUDGING_AGGREGATION_CHOICES = [
        ("average", "Average"),
        ("sum", "Sum"),
    ]

    JUDGING_VISIBILITY_CHOICES = [
        ("aggregate", "Aggregate scores only"),
        ("open", "Show judge scores"),
        ("anonymous", "Anonymous judge scores"),
    ]

    INDUSTRY_CHOICES = [
        ("programming", "Programming"),
        ("design", "Design"),
        ("robotics", "Robotics"),
        ("cybersecurity", "Cybersecurity"),
    ]

    DIFFICULTY_CHOICES = [
        ("beginner", "Beginner"),
        ("intermediate", "Intermediate"),
        ("advanced", "Advanced"),
        ("mixed", "Mixed"),
    ]

    LANGUAGE_CHOICES = [
        ("uk", "Ukrainian"),
        ("en", "English"),
        ("pl", "Polish"),
        ("de", "German"),
        ("fr", "French"),
        ("es", "Spanish"),
        ("other", "Other"),
    ]

    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    short_description = models.TextField(blank=True)
    full_description = models.TextField(blank=True)

    cover_image = models.URLField(blank=True)
    banner_image = models.URLField(blank=True)

    status = models.CharField(max_length=32, choices=STATUS_CHOICES, db_index=True)
    event_type = models.CharField(max_length=16, choices=EVENT_TYPE_CHOICES, db_index=True)
    participation_type = models.CharField(
        max_length=16,
        choices=PARTICIPATION_TYPE_CHOICES,
        db_index=True,
    )
    industry = models.CharField(max_length=32, choices=INDUSTRY_CHOICES, db_index=True)
    difficulty = models.CharField(max_length=32, choices=DIFFICULTY_CHOICES, db_index=True)
    language = models.CharField(max_length=16, choices=LANGUAGE_CHOICES, default="uk", db_index=True)

    current_round = models.PositiveIntegerField(default=1)
    total_rounds = models.PositiveIntegerField(default=1)

    participants_count = models.PositiveIntegerField(default=0)
    comments_count = models.PositiveIntegerField(default=0)
    views_count = models.PositiveIntegerField(default=0)
    followers_count = models.PositiveIntegerField(default=0)

    is_live_stream_enabled = models.BooleanField(default=False)
    is_online_now = models.BooleanField(default=False)
    registration_open = models.BooleanField(default=False)
    submissions_open = models.BooleanField(default=False)
    is_public = models.BooleanField(default=True)

    access_mode = models.CharField(max_length=32, choices=ACCESS_MODE_CHOICES, default="application", db_index=True)
    visibility_mode = models.CharField(max_length=32, choices=VISIBILITY_MODE_CHOICES, default="public", db_index=True)
    show_in_catalog = models.BooleanField(default=True)
    allow_sharing_link = models.BooleanField(default=True)
    allow_external_registration = models.BooleanField(default=True)

    min_team_size = models.PositiveIntegerField(default=1)
    max_team_size = models.PositiveIntegerField(default=4)
    allow_user_team_invites = models.BooleanField(default=True)
    allow_organizer_team_assignment = models.BooleanField(default=True)

    manual_judging_enabled = models.BooleanField(default=True)
    automatic_judging_enabled = models.BooleanField(default=False)
    peer_review_enabled = models.BooleanField(default=False)
    judging_aggregation = models.CharField(
        max_length=16,
        choices=JUDGING_AGGREGATION_CHOICES,
        default="average",
    )
    judging_visibility = models.CharField(
        max_length=16,
        choices=JUDGING_VISIBILITY_CHOICES,
        default="aggregate",
    )
    results_frozen = models.BooleanField(default=False)

    setup_step = models.PositiveSmallIntegerField(default=1)
    completion_percent = models.PositiveSmallIntegerField(default=0)
    publish_ready = models.BooleanField(default=False)
    organizer_approval_status = models.CharField(
        max_length=16,
        choices=ORGANIZER_APPROVAL_CHOICES,
        default="pending",
        db_index=True,
    )
    organizer_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_competitions",
    )
    organizer_approved_at = models.DateTimeField(null=True, blank=True)

    trending_score = models.FloatField(default=0)

    registration_starts_at = models.DateTimeField(null=True, blank=True)
    registration_ends_at = models.DateTimeField(null=True, blank=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    judging_starts_at = models.DateTimeField(null=True, blank=True)
    judging_ends_at = models.DateTimeField(null=True, blank=True)
    results_public_at = models.DateTimeField(null=True, blank=True)
    timer_deadline = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name) or "competition"
            if self.status == "draft" and base_slug == "untitled-competition":
                base_slug = f"untitled-competition-{uuid.uuid4().hex[:8]}"
            slug = base_slug
            counter = 2
            while Competition.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class UserSavedCompetition(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_competitions",
    )
    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="saved_by_users",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "competition")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} saved {self.competition}"


class UserCompetitionWatch(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="watched_competitions",
    )
    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="watchers",
    )
    watch_live = models.BooleanField(default=True)
    watch_rounds = models.BooleanField(default=True)
    watch_updates = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "competition")

    def __str__(self):
        return f"{self.user} watches {self.competition}"


class CompetitionRound(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("scheduled", "Scheduled"),
        ("active", "Active"),
        ("closed", "Closed"),
        ("judged", "Judged"),
    ]

    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="rounds",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="draft", db_index=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    submission_required = models.BooleanField(default=True)
    max_attempts = models.PositiveIntegerField(default=1)
    is_stream_enabled = models.BooleanField(default=False)
    stream_url = models.URLField(blank=True)
    stream_embed_url = models.URLField(blank=True)
    stream_label = models.CharField(max_length=120, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.competition.name}: {self.title}"


class CompetitionSubmissionSettings(models.Model):
    SUBMISSION_MODE_CHOICES = [
        ("file_upload", "File upload"),
        ("text_answer", "Text answer"),
        ("repository_link", "Repository link"),
        ("demo_link", "Demo link"),
        ("mixed", "Mixed"),
    ]

    SUBMISSION_POLICY_CHOICES = [
        ("single", "Single submission"),
        ("latest", "Latest submission wins"),
        ("multiple", "Multiple submissions"),
    ]

    competition = models.OneToOneField(
        Competition,
        on_delete=models.CASCADE,
        related_name="submission_settings",
    )
    submission_mode = models.CharField(max_length=32, choices=SUBMISSION_MODE_CHOICES, default="mixed")
    submission_policy = models.CharField(max_length=16, choices=SUBMISSION_POLICY_CHOICES, default="single")
    allowed_file_types = models.JSONField(default=list, blank=True)
    max_file_size_mb = models.PositiveIntegerField(default=25)
    max_submissions = models.PositiveIntegerField(default=1)
    repository_url_required = models.BooleanField(default=False)
    demo_url_required = models.BooleanField(default=False)
    description_required = models.BooleanField(default=True)

    def __str__(self):
        return f"Submission settings for {self.competition.name}"


class CompetitionJudgingCriterion(models.Model):
    JUDGING_MODE_CHOICES = [
        ("manual", "Manual judging"),
        ("automatic", "Automatic judging"),
        ("peer_review", "Peer review"),
        ("mixed", "Mixed judging"),
        ("public_voting", "Public voting"),
    ]

    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="judging_criteria",
    )
    judging_mode = models.CharField(max_length=32, choices=JUDGING_MODE_CHOICES, default="manual")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    max_score = models.PositiveIntegerField(default=10)
    weight = models.FloatField(default=1.0)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.competition.name}: {self.title}"


class CompetitionAward(models.Model):
    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="awards",
    )
    title = models.CharField(max_length=255)
    place = models.PositiveIntegerField(null=True, blank=True)
    issue_certificate = models.BooleanField(default=True)
    issue_badge = models.BooleanField(default=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["place", "id"]

    def __str__(self):
        return f"{self.competition.name}: {self.title}"


class CompetitionInvitation(models.Model):
    TARGET_TYPE_CHOICES = [
        ("individual", "Individual participant"),
        ("team", "Team"),
    ]
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("queued", "Queued"),
        ("sent", "Sent"),
        ("accepted", "Accepted"),
        ("declined", "Declined"),
        ("expired", "Expired"),
    ]

    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_competition_invitations",
    )
    email = models.EmailField()
    target_type = models.CharField(max_length=32, choices=TARGET_TYPE_CHOICES, default="individual")
    team_name = models.CharField(max_length=255, blank=True)
    token = models.CharField(max_length=128, unique=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="draft", db_index=True)
    message = models.TextField(blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("competition", "email", "target_type", "team_name")

    def __str__(self):
        return f"Invitation to {self.email} for {self.competition.name}"


class OutboundMessage(models.Model):
    CHANNEL_CHOICES = [
        ("email", "Email"),
        ("platform", "Platform notification"),
    ]
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("queued", "Queued"),
        ("sent", "Sent"),
        ("failed", "Failed"),
    ]

    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="outbound_messages",
        null=True,
        blank=True,
    )
    invitation = models.ForeignKey(
        CompetitionInvitation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="messages",
    )
    recipient_email = models.EmailField()
    channel = models.CharField(max_length=32, choices=CHANNEL_CHOICES, default="email")
    subject = models.CharField(max_length=255)
    body = models.TextField()
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="draft", db_index=True)
    provider_message_id = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)
    queued_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.recipient_email}: {self.subject}"


class CompetitionMaterial(models.Model):
    MATERIAL_TYPE_CHOICES = [
        ("file", "File"),
        ("link", "Link"),
        ("video", "Video"),
        ("repository", "Repository"),
        ("rules", "Rules"),
        ("dataset", "Dataset"),
        ("template", "Template"),
        ("guide", "Guide"),
        ("other", "Other"),
    ]

    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="materials",
    )
    name = models.CharField(max_length=255)
    material_type = models.CharField(
        max_length=32,
        choices=MATERIAL_TYPE_CHOICES,
        default="other",
    )
    url = models.URLField(blank=True)
    file = models.ForeignKey(
        "UserFile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="competition_materials",
    )
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.competition.name}: {self.name}"


class RecentlyViewedMaterial(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recently_viewed_materials",
    )
    material = models.ForeignKey(
        CompetitionMaterial,
        on_delete=models.CASCADE,
        related_name="recent_views",
    )
    viewed_at = models.DateTimeField(auto_now=True)
    view_count = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ("user", "material")
        ordering = ["-viewed_at"]

    def __str__(self):
        return f"{self.user} viewed {self.material}"


class CompetitionPlannedEvent(models.Model):
    EVENT_KIND_CHOICES = [
        ("announcement", "Announcement"),
        ("round_start", "Round Start"),
        ("round_end", "Round End"),
        ("judging_start", "Judging Start"),
        ("judging_end", "Judging End"),
        ("results", "Results"),
        ("other", "Other"),
    ]

    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="planned_events",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    event_kind = models.CharField(
        max_length=32,
        choices=EVENT_KIND_CHOICES,
        default="other",
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["starts_at", "sort_order", "id"]

    def __str__(self):
        return f"{self.competition.name}: {self.title}"


class CompetitionAnnouncement(models.Model):
    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="announcements",
    )
    title = models.CharField(max_length=255)
    text = models.TextField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="competition_announcements",
    )
    is_pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_pinned", "-created_at"]

    def __str__(self):
        return f"{self.competition.name}: {self.title}"


class CompetitionAnnouncementComment(models.Model):
    announcement = models.ForeignKey(
        CompetitionAnnouncement,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="competition_announcement_comments",
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment by {self.author} on {self.announcement_id}"


class CompetitionTeam(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("pending", "Pending review"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("archived", "Archived"),
    ]

    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="teams",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="pending", db_index=True)
    captain = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="captained_competition_teams",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("competition", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} / {self.competition.name}"


class CompetitionParticipant(models.Model):
    ROLE_CHOICES = [
        ("participant", "Participant"),
        ("team_member", "Team member"),
        ("judge", "Judge"),
        ("organizer", "Organizer"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending review"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("withdrawn", "Withdrawn"),
    ]

    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="participant_entries",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="competition_memberships",
    )
    team = models.ForeignKey(
        CompetitionTeam,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="members",
    )
    display_name = models.CharField(max_length=255)
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default="participant")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="pending", db_index=True)
    is_active_now = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["display_name"]
        unique_together = ("competition", "user")

    def __str__(self):
        return f"{self.display_name} ({self.role})"


class CompetitionJoinRequest(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("withdrawn", "Withdrawn"),
    ]

    ROLE_CHOICES = [
        ("participant", "Participant"),
        ("team_member", "Team member"),
    ]

    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="join_requests",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="competition_join_requests",
    )
    role = models.CharField(max_length=32, choices=ROLE_CHOICES)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    team = models.ForeignKey(
        CompetitionTeam,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="join_requests",
    )
    team_name = models.CharField(max_length=255, blank=True)
    message = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_competition_join_requests",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("competition", "user", "role")

    def __str__(self):
        return f"{self.user} -> {self.competition} ({self.role})"


class CompetitionSubmission(models.Model):
    STATUS_CHOICES = [
        ("created", "Created"),
        ("validated", "Validated"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
        ("locked", "Locked"),
    ]

    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    round = models.ForeignKey(
        CompetitionRound,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    participant = models.ForeignKey(
        CompetitionParticipant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submissions",
    )
    team = models.ForeignKey(
        CompetitionTeam,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submissions",
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="competition_submissions",
    )
    title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    repository_url = models.URLField(blank=True)
    demo_url = models.URLField(blank=True)
    file = models.ForeignKey(
        "UserFile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="competition_submissions",
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="created", db_index=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["round__sort_order", "-created_at"]

    def __str__(self):
        subject = self.team.name if self.team else (self.participant.display_name if self.participant else "Submission")
        return f"{self.competition.name}: {subject} / {self.round.title}"


class CompetitionJudgeAssignment(models.Model):
    ASSIGNMENT_TYPE_CHOICES = [
        ("manual", "Manual judge"),
        ("peer_review", "Peer reviewer"),
        ("automatic", "Automatic evaluator"),
    ]

    STATUS_CHOICES = [
        ("invited", "Invited"),
        ("accepted", "Accepted"),
        ("declined", "Declined"),
        ("completed", "Completed"),
    ]

    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="judge_assignments",
    )
    round = models.ForeignKey(
        CompetitionRound,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="judge_assignments",
    )
    judge = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="competition_judge_assignments",
    )
    assignment_type = models.CharField(max_length=16, choices=ASSIGNMENT_TYPE_CHOICES, default="manual", db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="invited", db_index=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_judge_assignments",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["competition", "round__sort_order", "judge_id"]
        unique_together = ("competition", "round", "judge", "assignment_type")

    def __str__(self):
        return f"{self.judge} judges {self.competition.name} ({self.assignment_type})"


class CompetitionScore(models.Model):
    REVIEW_TYPE_CHOICES = [
        ("automatic", "Automatic"),
        ("manual", "Manual judge"),
        ("peer_review", "Peer review"),
    ]

    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="scores",
    )
    round = models.ForeignKey(
        CompetitionRound,
        on_delete=models.CASCADE,
        related_name="scores",
    )
    criterion = models.ForeignKey(
        CompetitionJudgingCriterion,
        on_delete=models.CASCADE,
        related_name="scores",
    )
    judge = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="competition_scores",
    )
    subject_participant = models.ForeignKey(
        CompetitionParticipant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="received_scores",
    )
    subject_team = models.ForeignKey(
        CompetitionTeam,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="received_scores",
    )
    submission = models.ForeignKey(
        CompetitionSubmission,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scores",
    )
    review_type = models.CharField(max_length=16, choices=REVIEW_TYPE_CHOICES, db_index=True)
    score = models.DecimalField(max_digits=8, decimal_places=2)
    comment = models.TextField(blank=True)
    is_final = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["round__sort_order", "subject_team_id", "subject_participant_id", "criterion__sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["competition", "round", "criterion", "judge", "review_type", "submission"],
                condition=models.Q(submission__isnull=False),
                name="uniq_score_by_submission",
            ),
            models.UniqueConstraint(
                fields=["competition", "round", "criterion", "judge", "review_type", "subject_participant"],
                condition=models.Q(submission__isnull=True, subject_participant__isnull=False),
                name="uniq_score_by_participant",
            ),
            models.UniqueConstraint(
                fields=["competition", "round", "criterion", "judge", "review_type", "subject_team"],
                condition=models.Q(submission__isnull=True, subject_team__isnull=False),
                name="uniq_score_by_team",
            ),
        ]
        indexes = [
            models.Index(fields=["competition", "round", "review_type"]),
            models.Index(fields=["competition", "subject_participant"]),
            models.Index(fields=["competition", "subject_team"]),
        ]

    def __str__(self):
        subject = self.subject_team or self.subject_participant or self.submission
        return f"{self.competition.name}: {subject} / {self.criterion.title} = {self.score}"


class CompetitionRoundResult(models.Model):
    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="round_results",
    )
    round_number = models.PositiveIntegerField()
    leader_name = models.CharField(max_length=255)
    top_score = models.FloatField(default=0)
    summary = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["round_number", "id"]

    def __str__(self):
        return f"{self.competition.name} / round {self.round_number}"


class CompetitionLeaderboardEntry(models.Model):
    ENTRY_TYPE_CHOICES = [
        ("individual", "Individual"),
        ("team", "Team"),
    ]

    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="leaderboard_entries",
    )
    rank = models.PositiveIntegerField()
    name = models.CharField(max_length=255)
    score = models.FloatField(default=0)
    entry_type = models.CharField(max_length=16, choices=ENTRY_TYPE_CHOICES, default="individual")
    round_number = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["rank", "id"]

    def __str__(self):
        return f"{self.competition.name} #{self.rank} {self.name}"


class CompetitionJudgingMetric(models.Model):
    MODE_CHOICES = [
        ("individual", "Individual"),
        ("team", "Team"),
    ]

    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="judging_metrics",
    )
    mode = models.CharField(max_length=16, choices=MODE_CHOICES, default="individual")
    label = models.CharField(max_length=255)
    value = models.FloatField(default=0)
    max_value = models.FloatField(null=True, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.competition.name}: {self.label}={self.value}"

class UserProfile(models.Model):
    ROLE_CHOICES = [
        ("admin", "Administrator"),
        ("organizer", "Organizer"),
        ("participant", "Participant"),
        ("viewer", "Viewer"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    display_name = models.CharField(max_length=255, blank=True)
    primary_role = models.CharField(max_length=32, choices=ROLE_CHOICES, default="participant")
    bio = models.TextField(blank=True)
    organization = models.CharField(max_length=255, blank=True)
    position = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=64, blank=True)
    country = models.CharField(max_length=128, blank=True)
    city = models.CharField(max_length=128, blank=True)
    skills = models.JSONField(default=list, blank=True)
    interests = models.JSONField(default=list, blank=True)
    links = models.JSONField(default=dict, blank=True)
    avatar_file = models.ForeignKey(
        "UserFile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="avatar_profiles",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.display_name or self.user.get_username()


class UserFile(models.Model):
    FILE_TYPE_CHOICES = [
        ("avatar", "Avatar"),
        ("certificate", "Certificate"),
        ("badge_icon", "Badge icon"),
        ("resource", "Resource"),
        ("submission", "Submission"),
        ("competition_cover", "Competition cover"),
        ("competition_attachment", "Competition attachment"),
        ("other", "Other"),
    ]
    VISIBILITY_CHOICES = [
        ("private", "Private"),
        ("public", "Public"),
        ("competition_only", "Competition only"),
    ]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="files",
    )
    storage_key = models.CharField(max_length=512, unique=True)
    original_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=128, blank=True)
    size_bytes = models.PositiveBigIntegerField(default=0)
    content = models.BinaryField(null=True, blank=True)
    checksum = models.CharField(max_length=128, blank=True)
    file_type = models.CharField(max_length=32, choices=FILE_TYPE_CHOICES, default="other")
    visibility = models.CharField(max_length=32, choices=VISIBILITY_CHOICES, default="private")
    public_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.original_name


class RecentlyViewedCompetition(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recent_competition_views",
    )
    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name="recent_views",
    )
    viewed_at = models.DateTimeField(auto_now=True)
    view_count = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ("user", "competition")
        ordering = ["-viewed_at"]

    def __str__(self):
        return f"{self.user} viewed {self.competition}"


class LandingFilterOption(models.Model):
    group = models.CharField(max_length=64, db_index=True)
    value = models.CharField(max_length=64)
    label_en = models.CharField(max_length=255, blank=True)
    label_uk = models.CharField(max_length=255, blank=True)
    is_hidden = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("group", "value")
        ordering = ["group", "sort_order", "value"]

    def __str__(self):
        return f"{self.group}:{self.value}"


class Badge(models.Model):
    code = models.SlugField(unique=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    badge_type = models.CharField(max_length=64, blank=True)
    icon_file = models.ForeignKey(
        UserFile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="badge_icons",
    )

    def __str__(self):
        return self.title


class UserBadge(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="badges",
    )
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE, related_name="awards")
    competition = models.ForeignKey(
        Competition,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="awarded_badges",
    )
    awarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-awarded_at"]


class Certificate(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="certificates",
    )
    competition = models.ForeignKey(
        Competition,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="certificates",
    )
    file = models.ForeignKey(UserFile, on_delete=models.CASCADE, related_name="certificates")
    title = models.CharField(max_length=255)
    issued_at = models.DateTimeField(null=True, blank=True)
    verification_code = models.CharField(max_length=128, unique=True)

    class Meta:
        ordering = ["-issued_at", "-id"]

    def __str__(self):
        return self.title


class UserMaterial(models.Model):
    MATERIAL_TYPE_CHOICES = [
        ("certificate", "Certificate"),
        ("resource", "Resource"),
        ("submission", "Submission"),
        ("note", "Note"),
        ("feedback", "Feedback"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="materials",
    )
    file = models.ForeignKey(UserFile, on_delete=models.CASCADE, related_name="materials")
    title = models.CharField(max_length=255)
    material_type = models.CharField(max_length=32, choices=MATERIAL_TYPE_CHOICES, default="resource")
    competition = models.ForeignKey(
        Competition,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_materials",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
