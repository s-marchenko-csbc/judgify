from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Competition(models.Model):
    STATUS_CHOICES = [
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

    trending_score = models.FloatField(default=0)

    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    timer_deadline = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
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


class CompetitionMaterial(models.Model):
    MATERIAL_TYPE_CHOICES = [
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
    url = models.URLField()
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.competition.name}: {self.name}"


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


class CompetitionParticipant(models.Model):
    ROLE_CHOICES = [
        ("participant", "Participant"),
        ("team", "Team"),
        ("observer", "Observer"),
        ("judge", "Judge"),
        ("organizer", "Organizer"),
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
    display_name = models.CharField(max_length=255)
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default="participant")
    is_active_now = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["display_name"]

    def __str__(self):
        return f"{self.display_name} ({self.role})"


class CompetitionJoinRequest(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    ROLE_CHOICES = [
        ("participant", "Participant"),
        ("team", "Team"),
        ("observer", "Observer"),
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
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="approved")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("competition", "user", "role")

    def __str__(self):
        return f"{self.user} -> {self.competition} ({self.role})"


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