from datetime import timedelta
from decimal import Decimal, InvalidOperation
import hashlib
import os
import platform
import secrets
import shutil
import sys
import time
import uuid

from django import get_version as get_django_version
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout, password_validation
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q, F, Count
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from django.utils import timezone

from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Competition,
    UserSavedCompetition,
    UserCompetitionWatch,
    CompetitionAnnouncement,
    CompetitionAnnouncementComment,
    CompetitionTeam,
    CompetitionParticipant,
    CompetitionJoinRequest,
    CompetitionInvitation,
    OutboundMessage,
    CompetitionRound,
    CompetitionJudgingCriterion,
    CompetitionSubmission,
    CompetitionJudgeAssignment,
    CompetitionScore,
    CompetitionRoundResult,
    CompetitionLeaderboardEntry,
    CompetitionJudgingMetric,
    UserProfile,
    UserFile,
    RecentlyViewedCompetition,
    RecentlyViewedMaterial,
    CompetitionMaterial,
    LandingFilterOption,
    PlatformSetting,
    UserBadge,
    Certificate,
    UserMaterial,
)
from .serializers import (
    CompetitionCardSerializer,
    CompetitionDetailSerializer,
    SidebarCompetitionSerializer,
    CompetitionAnnouncementSerializer,
    CompetitionAnnouncementCommentSerializer,
    CompetitionTeamSerializer,
    CompetitionParticipantSerializer,
    CompetitionJoinRequestSerializer,
    CompetitionSubmissionSerializer,
    CompetitionBuilderSerializer,
    CompetitionJudgingCriterionSerializer,
    CompetitionInvitationSerializer,
    OutboundMessageSerializer,
    CompetitionJudgeAssignmentSerializer,
    CompetitionScoreSerializer,
    CompetitionRoundResultSerializer,
    CompetitionLeaderboardEntrySerializer,
    CompetitionJudgingMetricSerializer,
    UserSavedCompetitionSerializer,
    UserCompetitionWatchSerializer,
    CompetitionMaterialSerializer,
    RecentlyViewedMaterialSerializer,
    UserProfileSerializer,
    UserBadgeSerializer,
    CertificateSerializer,
    UserMaterialSerializer,
)

PROCESS_STARTED_AT = time.time()


AUTO_APPROVE_ORGANIZER_SETTING = "auto_approve_organizer_competitions"


def get_platform_setting(key, default=None):
    setting = PlatformSetting.objects.filter(key=key).first()
    if not setting:
        return default
    value = setting.value
    if isinstance(value, dict) and "value" in value:
        return value["value"]
    return value


def set_platform_setting(key, value):
    PlatformSetting.objects.update_or_create(
        key=key,
        defaults={"value": {"value": value}},
    )
    return value


def request_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def recompute_competition_timing(competition, now=None, save=True):
    """Synchronize status flags with competition and round deadlines.

    Round activity is sequential: a later round cannot become active until every
    previous round has ended. Submissions are open only inside the active round,
    not during the whole competition window.
    """
    if competition.status in ["draft", "archived"]:
        changed = []
        if competition.registration_open:
            competition.registration_open = False
            changed.append("registration_open")
        if competition.submissions_open:
            competition.submissions_open = False
            changed.append("submissions_open")
        if competition.timer_deadline:
            competition.timer_deadline = None
            changed.append("timer_deadline")
        if save and changed:
            competition.save(update_fields=[*changed, "updated_at"])
        return competition

    now = now or timezone.now()
    rounds = list(competition.rounds.all().order_by("sort_order", "starts_at", "id"))
    first_round_start = min([round_obj.starts_at for round_obj in rounds if round_obj.starts_at], default=None)
    all_rounds_finished = bool(rounds) and all(round_obj.ends_at and now > round_obj.ends_at for round_obj in rounds)
    any_round_started = any(round_obj.starts_at and now >= round_obj.starts_at for round_obj in rounds)

    registration_open = False
    if competition.registration_starts_at and competition.registration_ends_at:
        registration_open = competition.registration_starts_at <= now <= competition.registration_ends_at
    elif competition.registration_ends_at:
        registration_open = now <= competition.registration_ends_at
    elif competition.registration_starts_at:
        registration_open = competition.registration_starts_at <= now and (not competition.starts_at or now < competition.starts_at)

    active_round = None
    completed_rounds = 0
    blocked_by_previous = False
    round_status_updates = []
    for index, round_obj in enumerate(rounds, start=1):
        next_round_status = round_obj.status
        if round_obj.ends_at and now > round_obj.ends_at:
            completed_rounds = index
            next_round_status = "judged" if competition.status in ["finished", "archived"] else "closed"
            if round_obj.status != next_round_status:
                round_obj.status = next_round_status
                round_status_updates.append(round_obj)
            continue
        if blocked_by_previous:
            if round_obj.status not in ["draft", "scheduled"]:
                round_obj.status = "scheduled" if round_obj.starts_at else "draft"
                round_status_updates.append(round_obj)
            break
        if round_obj.starts_at and round_obj.ends_at and round_obj.starts_at <= now <= round_obj.ends_at:
            active_round = (index, round_obj)
            next_round_status = "active"
            if round_obj.status != next_round_status:
                round_obj.status = next_round_status
                round_status_updates.append(round_obj)
            break
        next_round_status = "scheduled" if round_obj.starts_at else "draft"
        if round_obj.status != next_round_status:
            round_obj.status = next_round_status
            round_status_updates.append(round_obj)
        # Once we reach the first not-finished round, later rounds are not allowed
        # to become active even if their dates overlap by mistake.
        blocked_by_previous = True

    results_published = bool(competition.results_public_at and now >= competition.results_public_at)
    judging_is_open = (
        not results_published
        and bool(competition.judging_starts_at or competition.judging_ends_at)
        and (not competition.judging_starts_at or now >= competition.judging_starts_at)
        and (not competition.judging_ends_at or now <= competition.judging_ends_at)
    )

    if results_published:
        status_value = "finished"
    elif judging_is_open:
        status_value = "judging"
    elif active_round:
        status_value = "active"
    elif rounds and first_round_start and now < first_round_start:
        status_value = "registration_open" if registration_open else "upcoming"
    elif rounds and all_rounds_finished:
        status_value = "finished"
    elif rounds and (any_round_started or (competition.starts_at and now >= competition.starts_at)):
        status_value = "active"
    elif competition.starts_at and now < competition.starts_at:
        status_value = "registration_open" if registration_open else "upcoming"
    elif competition.starts_at and competition.ends_at and competition.starts_at <= now <= competition.ends_at:
        status_value = "active"
    elif competition.ends_at and now > competition.ends_at:
        status_value = "finished"
    else:
        status_value = competition.status if competition.status in ["active", "judging", "finished"] else ("registration_open" if registration_open else "upcoming")

    submissions_open = bool(status_value == "active" and active_round and active_round[1].submission_required)

    if status_value == "finished":
        for round_obj in rounds:
            if round_obj.ends_at and now > round_obj.ends_at and round_obj.status != "judged":
                round_obj.status = "judged"
                round_status_updates.append(round_obj)

    round_deadline = None
    if active_round:
        competition.current_round = active_round[0]
        round_deadline = active_round[1].ends_at
    elif status_value in ["upcoming", "registration_open"]:
        competition.current_round = 0
    elif status_value == "active" and rounds:
        competition.current_round = min(len(rounds), completed_rounds + 1)
    elif status_value in ["judging", "finished"]:
        competition.current_round = len(rounds) or competition.total_rounds

    timer_deadline = None
    if status_value == "registration_open":
        timer_deadline = competition.registration_ends_at or competition.starts_at
    elif status_value == "upcoming":
        future_milestones = [
            value
            for value in [competition.registration_starts_at, competition.starts_at]
            if value and value > now
        ]
        timer_deadline = min(future_milestones) if future_milestones else competition.starts_at
    elif status_value == "active":
        if round_deadline:
            timer_deadline = round_deadline
        elif rounds and competition.current_round and competition.current_round <= len(rounds):
            timer_deadline = rounds[competition.current_round - 1].starts_at or competition.ends_at
        else:
            timer_deadline = competition.ends_at
    elif status_value == "judging":
        timer_deadline = competition.judging_ends_at or competition.results_public_at

    competition.status = status_value
    competition.registration_open = registration_open
    competition.submissions_open = submissions_open
    competition.timer_deadline = timer_deadline
    competition.total_rounds = max(1, len(rounds) or competition.total_rounds)
    competition.trending_score = (competition.participants_count * 3) + competition.views_count + (competition.followers_count * 2) + (competition.comments_count * 0.5)

    if save:
        competition.save(update_fields=[
            "status", "registration_open", "submissions_open", "timer_deadline",
            "current_round", "total_rounds", "trending_score", "updated_at",
        ])
        if round_status_updates:
            CompetitionRound.objects.bulk_update(list({round_obj.id: round_obj for round_obj in round_status_updates}.values()), ["status"])
        closed_round_ids = [round_obj.id for round_obj in rounds if round_obj.ends_at and now > round_obj.ends_at]
        if closed_round_ids:
            CompetitionSubmission.objects.filter(
                competition=competition,
                round_id__in=closed_round_ids,
            ).exclude(status__in=["locked", "rejected"]).update(status="locked", locked_at=now)
    return competition

def get_or_create_profile(user, defaults=None):
    defaults = defaults or {}
    profile, _ = UserProfile.objects.get_or_create(
        user=user,
        defaults={
            "display_name": user.get_full_name() or user.get_username(),
            "primary_role": defaults.get("primary_role") or "participant",
            "country": defaults.get("country") or "Ukraine",
        },
    )
    return profile


def user_is_admin(user):
    if not user.is_authenticated:
        return False
    profile = get_or_create_profile(user)
    return user.is_staff or user.is_superuser or profile.primary_role == "admin"


def user_primary_role(user):
    if not user.is_authenticated:
        return None
    return get_or_create_profile(user).primary_role


def user_can_create_competitions(user):
    role = user_primary_role(user)
    return user_is_admin(user) or role == "organizer"


def active_participation_roles():
    return ["participant", "team_member", "judge"]


def user_has_active_team_conflict(user, competition, team=None):
    if not user or not user.is_authenticated:
        return False
    qs = CompetitionParticipant.objects.filter(
        competition=competition,
        user=user,
        role__in=["participant", "team_member"],
        status__in=["pending", "approved"],
    )
    if team:
        qs = qs.exclude(team=team)
    return qs.exists()


def user_is_competition_judge(user, competition):
    if not user or not user.is_authenticated:
        return False
    return CompetitionParticipant.objects.filter(
        competition=competition,
        user=user,
        role="judge",
        status__in=["pending", "approved"],
    ).exists()


def user_has_participation_for_judge_conflict(user, competition):
    if not user or not user.is_authenticated:
        return False
    return CompetitionParticipant.objects.filter(
        competition=competition,
        user=user,
        role__in=["participant", "team_member"],
        status__in=["pending", "approved"],
    ).exists()


COMMON_COMPROMISED_PASSWORDS = {
    "password",
    "password1",
    "password123",
    "qwerty",
    "qwerty123",
    "123456",
    "12345678",
    "123456789",
    "111111",
    "admin123",
    "letmein",
    "welcome",
    "demo12345",
    "judgify123",
}


def normalize_email(value):
    return (value or "").strip().lower()


def get_client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def auth_attempt_cache_key(request, email):
    digest = hashlib.sha256(f"{get_client_ip(request)}:{normalize_email(email)}".encode("utf-8")).hexdigest()
    return f"auth-login-attempts:{digest}"


def record_failed_login(request, email):
    key = auth_attempt_cache_key(request, email)
    attempts = cache.get(key, 0) + 1
    cache.set(key, attempts, timeout=15 * 60)
    return attempts


def clear_failed_logins(request, email):
    cache.delete(auth_attempt_cache_key(request, email))


def login_is_rate_limited(request, email):
    return cache.get(auth_attempt_cache_key(request, email), 0) >= 5


def unique_username(base):
    User = get_user_model()
    raw = (base or "user").strip()[:140] or "user"
    username = raw
    counter = 2
    while User.objects.filter(username=username).exists():
        suffix = f"-{counter}"
        username = f"{raw[:150 - len(suffix)]}{suffix}"
        counter += 1
    return username


def validate_account_password(password, user=None, email=""):
    password = password or ""
    errors = []
    if len(password) < 12:
        errors.append("Password must contain at least 12 characters.")
    if not any(ch.islower() for ch in password):
        errors.append("Password must contain a lowercase letter.")
    if not any(ch.isupper() for ch in password):
        errors.append("Password must contain an uppercase letter.")
    if not any(ch.isdigit() for ch in password):
        errors.append("Password must contain a number.")
    if not any(not ch.isalnum() for ch in password):
        errors.append("Password must contain a special character.")
    normalized = password.strip().lower()
    if normalized in COMMON_COMPROMISED_PASSWORDS:
        errors.append("This password is too common or previously compromised.")
    email_name = normalize_email(email).split("@")[0]
    if email_name and len(email_name) >= 4 and email_name in normalized:
        errors.append("Password must not contain your email name.")
    try:
        password_validation.validate_password(password, user=user)
    except DjangoValidationError as exc:
        errors.extend(exc.messages)
    return list(dict.fromkeys(errors))


def serialize_user(user):
    profile = get_or_create_profile(user)
    return {
        "id": user.id,
        "username": user.get_username(),
        "displayName": profile.display_name or user.get_full_name() or user.get_username(),
        "email": getattr(user, "email", ""),
        "primaryRole": profile.primary_role,
        "bio": profile.bio,
        "organization": profile.organization,
        "position": profile.position,
        "phone": profile.phone,
        "country": profile.country,
        "city": profile.city,
        "skills": profile.skills,
        "interests": profile.interests,
        "links": profile.links,
        "avatar": UserProfileSerializer(profile).data.get("avatar"),
        "avatarUrl": UserProfileSerializer(profile).data.get("avatar_url"),
        "isRegistered": True,
        "isStaff": user.is_staff,
        "isSuperuser": user.is_superuser,
        "isActive": user.is_active,
    }


def serialize_admin_user(user):
    profile = get_or_create_profile(user)
    return {
        "id": user.id,
        "username": user.get_username(),
        "email": getattr(user, "email", ""),
        "displayName": profile.display_name or user.get_full_name() or user.get_username(),
        "primaryRole": profile.primary_role,
        "isStaff": user.is_staff,
        "isSuperuser": user.is_superuser,
        "isActive": user.is_active,
        "dateJoined": user.date_joined,
        "lastLogin": user.last_login,
        "competitionsCount": getattr(user, "competitions_count", 0),
        "requestsCount": getattr(user, "requests_count", 0),
    }


def serialize_admin_competition(competition):
    organizer_names = [
        participant.display_name
        for participant in getattr(competition, "prefetched_organizers", [])
    ]
    return {
        "id": competition.id,
        "name": competition.name,
        "slug": competition.slug,
        "status": competition.status,
        "visibilityMode": competition.visibility_mode,
        "showInCatalog": competition.show_in_catalog,
        "isPublic": competition.is_public,
        "organizerApprovalStatus": competition.organizer_approval_status,
        "organizers": organizer_names,
        "participantsCount": competition.participants_count,
        "submissionsOpen": competition.submissions_open,
        "resultsFrozen": competition.results_frozen,
        "startsAt": competition.starts_at,
        "endsAt": competition.ends_at,
        "updatedAt": competition.updated_at,
    }


def serialize_admin_message(message):
    return {
        "id": message.id,
        "competition": message.competition_id,
        "competitionName": message.competition.name if message.competition else "",
        "recipientEmail": message.recipient_email,
        "channel": message.channel,
        "subject": message.subject,
        "body": message.body,
        "status": message.status,
        "errorMessage": message.error_message,
        "queuedAt": message.queued_at,
        "sentAt": message.sent_at,
        "createdAt": message.created_at,
    }


def ensure_admin_request(request):
    if not user_is_admin(request.user):
        return Response({"detail": "Administrator access required."}, status=status.HTTP_403_FORBIDDEN)
    return None


def read_memory_info():
    info = {}
    try:
        with open("/proc/meminfo", "r", encoding="utf-8") as handle:
            for line in handle:
                key, value = line.split(":", 1)
                amount = int(value.strip().split()[0]) * 1024
                info[key] = amount
    except (OSError, ValueError):
        return {}

    total = info.get("MemTotal")
    available = info.get("MemAvailable") or info.get("MemFree")
    if not total or available is None:
        return {}
    used = max(total - available, 0)
    return {
        "totalMb": round(total / 1024 / 1024, 1),
        "availableMb": round(available / 1024 / 1024, 1),
        "usedMb": round(used / 1024 / 1024, 1),
        "usedPercent": round((used / total) * 100, 1),
    }


def process_memory_mb():
    try:
        import resource
        usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        if sys.platform == "darwin":
            usage = usage / 1024 / 1024
        else:
            usage = usage / 1024
        return round(usage, 1)
    except Exception:
        return None


def serialize_server_metrics(db_latency_ms=None):
    disk = shutil.disk_usage(os.getcwd())
    load_average = []
    if hasattr(os, "getloadavg"):
        try:
            load_average = [round(value, 2) for value in os.getloadavg()]
        except OSError:
            load_average = []
    return {
        "serverTime": timezone.now(),
        "uptimeSeconds": int(time.time() - PROCESS_STARTED_AT),
        "pythonVersion": platform.python_version(),
        "djangoVersion": get_django_version(),
        "platform": platform.platform(),
        "cpuCount": os.cpu_count() or 0,
        "loadAverage": load_average,
        "processMemoryMb": process_memory_mb(),
        "memory": read_memory_info(),
        "disk": {
            "totalMb": round(disk.total / 1024 / 1024, 1),
            "usedMb": round(disk.used / 1024 / 1024, 1),
            "freeMb": round(disk.free / 1024 / 1024, 1),
            "usedPercent": round((disk.used / disk.total) * 100, 1) if disk.total else 0,
        },
        "databaseLatencyMs": db_latency_ms,
    }


LANDING_FILTER_DEFAULTS = {
    "status": [
        {"value": "upcoming", "label_en": "Upcoming", "label_uk": "Незабаром"},
        {"value": "registration_open", "label_en": "Registration open", "label_uk": "Реєстрація відкрита"},
        {"value": "active", "label_en": "Active", "label_uk": "Активні"},
        {"value": "finished", "label_en": "Finished", "label_uk": "Завершено"},
        {"value": "judging", "label_en": "Judging", "label_uk": "Оцінювання"},
        {"value": "archived", "label_en": "Archived", "label_uk": "Архів"},
    ],
    "event_type": [
        {"value": "online", "label_en": "Online", "label_uk": "Онлайн"},
        {"value": "offline", "label_en": "Offline", "label_uk": "Офлайн"},
        {"value": "hybrid", "label_en": "Hybrid", "label_uk": "Гібридний"},
    ],
    "participation_type": [
        {"value": "individual", "label_en": "Individual", "label_uk": "Індивідуальна"},
        {"value": "team", "label_en": "Team", "label_uk": "Командна"},
        {"value": "mixed", "label_en": "Mixed", "label_uk": "Змішана"},
    ],
    "access_mode": [
        {"value": "open", "label_en": "Open registration", "label_uk": "Відкрита реєстрація"},
        {"value": "application", "label_en": "Application review", "label_uk": "Розгляд заявок"},
        {"value": "invite_only", "label_en": "Invite only", "label_uk": "Лише запрошення"},
    ],
    "visibility_mode": [
        {"value": "public", "label_en": "Public catalog", "label_uk": "Публічний каталог"},
        {"value": "unlisted", "label_en": "Unlisted link", "label_uk": "Доступ за посиланням"},
        {"value": "private", "label_en": "Private", "label_uk": "Приватне"},
    ],
    "industry": [
        {"value": "programming", "label_en": "Programming", "label_uk": "Програмування"},
        {"value": "design", "label_en": "Design", "label_uk": "Дизайн"},
        {"value": "robotics", "label_en": "Robotics", "label_uk": "Робототехніка"},
        {"value": "cybersecurity", "label_en": "Cybersecurity", "label_uk": "Кібербезпека"},
    ],
    "difficulty": [
        {"value": "beginner", "label_en": "Beginner", "label_uk": "Початковий"},
        {"value": "intermediate", "label_en": "Intermediate", "label_uk": "Середній"},
        {"value": "advanced", "label_en": "Advanced", "label_uk": "Просунутий"},
        {"value": "mixed", "label_en": "Mixed", "label_uk": "Змішаний"},
    ],
    "language": [
        {"value": "uk", "label_en": "Ukrainian", "label_uk": "Українська"},
        {"value": "en", "label_en": "English", "label_uk": "Англійська"},
        {"value": "pl", "label_en": "Polish", "label_uk": "Польська"},
        {"value": "de", "label_en": "German", "label_uk": "Німецька"},
        {"value": "fr", "label_en": "French", "label_uk": "Французька"},
        {"value": "es", "label_en": "Spanish", "label_uk": "Іспанська"},
        {"value": "other", "label_en": "Other", "label_uk": "Інша"},
    ],
}


def ensure_landing_filter_configs():
    existing = set(LandingFilterOption.objects.values_list("group", "value"))
    to_create = []
    for group, items in LANDING_FILTER_DEFAULTS.items():
        for index, item in enumerate(items):
            key = (group, item["value"])
            if key in existing:
                continue
            to_create.append(LandingFilterOption(
                group=group,
                value=item["value"],
                label_en=item["label_en"],
                label_uk=item["label_uk"],
                sort_order=index,
            ))
    if to_create:
        LandingFilterOption.objects.bulk_create(to_create, ignore_conflicts=True)


def filter_config_map():
    return {
        (item.group, item.value): item
        for item in LandingFilterOption.objects.all()
    }


def serialize_landing_filter_options(language="en", include_hidden=False):
    configs = filter_config_map()
    label_field = "label_uk" if language == "uk" else "label_en"
    result = {}
    groups = sorted(
        group
        for group in (set(LANDING_FILTER_DEFAULTS.keys()) | {group for group, _ in configs.keys()})
        if group != "status"
    )
    for group in groups:
        items = LANDING_FILTER_DEFAULTS.get(group, [])
        serialized = []
        for index, default in enumerate(items):
            config = configs.get((group, default["value"]))
            hidden = bool(config.is_hidden) if config else False
            if hidden and not include_hidden:
                continue
            label = getattr(config, label_field, "") if config else ""
            fallback = default.get(label_field) or default["label_en"]
            serialized.append({
                "group": group,
                "value": default["value"],
                "label": label or fallback,
                "labelEn": (config.label_en if config else "") or default["label_en"],
                "labelUk": (config.label_uk if config else "") or default["label_uk"],
                "defaultLabelEn": default["label_en"],
                "defaultLabelUk": default["label_uk"],
                "hidden": hidden,
                "sortOrder": config.sort_order if config else index,
            })
        default_values = {item["value"] for item in items}
        for (config_group, config_value), config in configs.items():
            if config_group != group or config_value in default_values:
                continue
            if config.is_hidden and not include_hidden:
                continue
            fallback = config_value.replace("_", " ").replace("-", " ").title()
            label = getattr(config, label_field, "") or config.label_en or config.label_uk or fallback
            serialized.append({
                "group": group,
                "value": config_value,
                "label": label,
                "labelEn": config.label_en or fallback,
                "labelUk": config.label_uk or fallback,
                "defaultLabelEn": fallback,
                "defaultLabelUk": fallback,
                "hidden": bool(config.is_hidden),
                "sortOrder": config.sort_order,
            })
        result[group] = sorted(serialized, key=lambda item: (item["sortOrder"], item["value"]))
    return result


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "detail": "CSRF cookie set",
            "csrfToken": get_token(request),
        })


class CurrentUserView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"authenticated": False, "user": None})

        return Response({
            "authenticated": True,
            "user": serialize_user(request.user),
        })


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        User = get_user_model()
        email = normalize_email(request.data.get("email"))
        password = request.data.get("password") or ""
        display_name = (request.data.get("displayName") or request.data.get("username") or email.split("@")[0]).strip()
        requested_username = (request.data.get("username") or email).strip()
        requested_role = request.data.get("primaryRole") or request.data.get("primary_role") or "participant"
        valid_roles = {choice[0] for choice in UserProfile.ROLE_CHOICES}
        if requested_role not in valid_roles:
            return Response({"detail": "Unsupported account role."}, status=status.HTTP_400_BAD_REQUEST)
        if requested_role == "admin":
            return Response(
                {"detail": "Administrator role cannot be self-assigned."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not email or "@" not in email:
            return Response({"detail": "A valid email address is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not password:
            return Response({"detail": "Password is required."}, status=status.HTTP_400_BAD_REQUEST)

        existing_user = User.objects.filter(email__iexact=email).order_by("id").first()
        password_user = existing_user or User(username=requested_username, email=email, first_name=display_name)
        password_errors = validate_account_password(password, user=password_user, email=email)
        if password_errors:
            return Response({"detail": " ".join(password_errors)}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if existing_user:
                if existing_user.has_usable_password():
                    return Response(
                        {"detail": "An account with this email already exists. Please sign in instead."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                user = existing_user
                if display_name and not user.get_full_name():
                    user.first_name = display_name
                if not user.email:
                    user.email = email
            else:
                username = requested_username if not User.objects.filter(username=requested_username).exists() else unique_username(email)
                user = User(username=username, email=email, first_name=display_name)
            user.set_password(password)
            user.save()

            profile = get_or_create_profile(user, {"primary_role": requested_role})
            profile.display_name = display_name or profile.display_name
            profile.primary_role = requested_role
            profile.interests = request.data.get("interests") or profile.interests or []
            profile.skills = request.data.get("skills") or profile.skills or []
            profile.save(update_fields=["display_name", "primary_role", "interests", "skills", "updated_at"])

        login(request, user)
        return Response({
            "authenticated": True,
            "user": serialize_user(user),
            "csrfToken": get_token(request),
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = normalize_email(request.data.get("email"))
        password = request.data.get("password") or ""
        if not email or not password:
            return Response({"detail": "Email and password are required."}, status=status.HTTP_400_BAD_REQUEST)
        if login_is_rate_limited(request, email):
            return Response(
                {"detail": "Too many failed sign-in attempts. Please wait 15 minutes and try again."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        User = get_user_model()
        user = User.objects.filter(email__iexact=email).order_by("id").first()
        authenticated_user = None
        if user and user.has_usable_password():
            authenticated_user = authenticate(request, username=user.get_username(), password=password)

        if authenticated_user is None:
            record_failed_login(request, email)
            return Response({"detail": "Invalid email or password."}, status=status.HTTP_403_FORBIDDEN)

        clear_failed_logins(request, email)
        login(request, authenticated_user)
        return Response({
            "authenticated": True,
            "user": serialize_user(authenticated_user),
            "csrfToken": get_token(request),
        })


class DevLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        User = get_user_model()
        display_name = request.data.get("displayName") or "Demo User"
        email = (request.data.get("email") or "demo@example.com").strip().lower()
        requested_role = request.data.get("primaryRole") or request.data.get("primary_role")
        valid_roles = {choice[0] for choice in UserProfile.ROLE_CHOICES}
        primary_role = requested_role if requested_role in valid_roles else "participant"
        account_key = request.data.get("accountKey") or request.data.get("account_key")
        email_base = (email.split("@")[0] if email else "demo_user").replace(".", "_").replace("+", "_")
        requested_username = (request.data.get("username") or "").strip()
        username = requested_username or account_key or email or f"{email_base}_{primary_role}"

        is_demo_account = str(account_key or "").startswith("demo:")
        if not is_demo_account:
            return Response(
                {"detail": "Development login is available only for demo accounts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        user = None
        created = False
        if email and not is_demo_account:
            user = User.objects.filter(email__iexact=email).order_by("id").first()

        if user is None:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={"email": email, "first_name": display_name},
            )

        changed = False
        if email and getattr(user, "email", "") != email:
            user.email = email
            changed = True
        if display_name and not user.get_full_name():
            user.first_name = display_name
            changed = True
        if changed:
            user.save()

        profile = get_or_create_profile(user, {"primary_role": primary_role})
        if not requested_role and not is_demo_account:
            primary_role = profile.primary_role or "participant"
        is_demo_admin = account_key == "demo:admin" and username == "demo_admin"
        if is_demo_admin and not user.is_staff:
            user.is_staff = True
            user.save(update_fields=["is_staff"])
        if primary_role == "admin" and not (user.is_staff or user.is_superuser or profile.primary_role == "admin"):
            return Response(
                {"detail": "Administrator role cannot be self-assigned."},
                status=status.HTTP_403_FORBIDDEN,
            )
        profile.display_name = display_name or profile.display_name
        profile.primary_role = primary_role
        profile.save(update_fields=["display_name", "primary_role", "updated_at"])

        login(request, user)

        return Response({
            "authenticated": True,
            "user": serialize_user(user),
            "csrfToken": get_token(request),
        })


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response({
            "authenticated": False,
            "csrfToken": get_token(request),
        })


class HealthCheckView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Reaching this endpoint proves that Django has started and the database
        # connection is usable. The seeded flag helps the frontend keep the
        # splash screen visible until demo competitions are actually available.
        try:
            competitions_count = Competition.objects.count()
        except Exception as exc:
            return Response({
                "ready": False,
                "database": "unavailable",
                "detail": str(exc),
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({
            "ready": competitions_count > 0,
            "database": "ok",
            "competitionsCount": competitions_count,
        })


class AdminOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = ensure_admin_request(request)
        if denied:
            return denied

        db_started = time.perf_counter()
        users_count = get_user_model().objects.count()
        db_latency_ms = round((time.perf_counter() - db_started) * 1000, 1)
        return Response({
            "stats": {
                "users": users_count,
                "activeUsers": get_user_model().objects.filter(is_active=True).count(),
                "competitions": Competition.objects.count(),
                "pendingCompetitions": Competition.objects.filter(organizer_approval_status="pending").count(),
                "activeCompetitions": Competition.objects.filter(status__in=["published", "upcoming", "registration_open", "active", "judging"]).count(),
                "draftCompetitions": Competition.objects.filter(status="draft").count(),
                "queuedMessages": OutboundMessage.objects.filter(status="queued").count(),
                "failedMessages": OutboundMessage.objects.filter(status="failed").count(),
            },
            "server": serialize_server_metrics(db_latency_ms=db_latency_ms),
            "settings": {
                "autoApproveOrganizerCompetitions": bool(
                    get_platform_setting(AUTO_APPROVE_ORGANIZER_SETTING, False)
                ),
            },
            "recentMessages": [
                serialize_admin_message(message)
                for message in OutboundMessage.objects.select_related("competition").order_by("-created_at")[:8]
            ],
        })

    def patch(self, request):
        denied = ensure_admin_request(request)
        if denied:
            return denied

        if "autoApproveOrganizerCompetitions" in request.data:
            set_platform_setting(
                AUTO_APPROVE_ORGANIZER_SETTING,
                bool(request.data.get("autoApproveOrganizerCompetitions")),
            )
        return self.get(request)


class AdminUsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = ensure_admin_request(request)
        if denied:
            return denied
        User = get_user_model()
        search = (request.query_params.get("search") or "").strip()
        role = (request.query_params.get("role") or "").strip()
        users = User.objects.select_related("profile").annotate(
            competitions_count=Count("competition_memberships", distinct=True),
            requests_count=Count("competition_join_requests", distinct=True),
        ).order_by("-date_joined")
        if search:
            users = users.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(profile__display_name__icontains=search)
            )
        if role:
            users = users.filter(profile__primary_role=role)
        return Response([serialize_admin_user(user) for user in users[:100]])


class AdminUserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        denied = ensure_admin_request(request)
        if denied:
            return denied
        User = get_user_model()
        target = get_object_or_404(User, pk=pk)
        if target.id == request.user.id:
            return Response({"detail": "You cannot delete your own administrator account."}, status=status.HTTP_400_BAD_REQUEST)
        blocking_competitions = Competition.objects.filter(
            participant_entries__user=target,
            participant_entries__role="organizer",
        ).exclude(status__in=["finished", "archived"])
        sole_organizer_ids = []
        for competition in blocking_competitions.distinct()[:50]:
            organizer_count = CompetitionParticipant.objects.filter(
                competition=competition,
                role="organizer",
                status="approved",
                user__isnull=False,
            ).exclude(user=target).count()
            if organizer_count == 0:
                sole_organizer_ids.append(competition.id)
        if sole_organizer_ids:
            return Response(
                {
                    "detail": "This account is the sole organizer for unfinished competitions. Reassign another organizer before deleting it.",
                    "competitionIds": sole_organizer_ids,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        target.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, pk):
        denied = ensure_admin_request(request)
        if denied:
            return denied

        User = get_user_model()
        target = get_object_or_404(User, pk=pk)
        profile = get_or_create_profile(target)
        data = request.data
        user_changed = []
        profile_changed = []

        if "email" in data:
            target.email = (data.get("email") or "").strip()
            user_changed.append("email")
        if "displayName" in data:
            display_name = (data.get("displayName") or "").strip()
            profile.display_name = display_name
            target.first_name = display_name
            profile_changed.append("display_name")
            user_changed.append("first_name")
        if "isActive" in data:
            next_active = bool(data.get("isActive"))
            if target.id == request.user.id and not next_active:
                return Response({"detail": "You cannot deactivate your own administrator account."}, status=status.HTTP_400_BAD_REQUEST)
            target.is_active = next_active
            user_changed.append("is_active")
        if "isStaff" in data:
            next_staff = bool(data.get("isStaff"))
            if target.id == request.user.id and not next_staff:
                return Response({"detail": "You cannot remove staff access from yourself."}, status=status.HTTP_400_BAD_REQUEST)
            target.is_staff = next_staff
            user_changed.append("is_staff")
        if "primaryRole" in data:
            next_role = data.get("primaryRole")
            valid_roles = {choice[0] for choice in UserProfile.ROLE_CHOICES}
            if next_role not in valid_roles:
                return Response({"detail": "Unsupported profile role."}, status=status.HTTP_400_BAD_REQUEST)
            if target.id == request.user.id and next_role != "admin":
                return Response({"detail": "You cannot remove administrator role from yourself."}, status=status.HTTP_400_BAD_REQUEST)
            profile.primary_role = next_role
            profile_changed.append("primary_role")
            if next_role == "admin" and not target.is_staff:
                target.is_staff = True
                user_changed.append("is_staff")

        if user_changed:
            target.save(update_fields=list(dict.fromkeys(user_changed)))
        if profile_changed:
            profile.save(update_fields=list(dict.fromkeys([*profile_changed, "updated_at"])))
        target.competitions_count = CompetitionParticipant.objects.filter(user=target).count()
        target.requests_count = CompetitionJoinRequest.objects.filter(user=target).count()
        return Response(serialize_admin_user(target))


class AdminCompetitionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = ensure_admin_request(request)
        if denied:
            return denied
        search = (request.query_params.get("search") or "").strip()
        status_filter = (request.query_params.get("status") or "").strip()
        competitions = Competition.objects.all().prefetch_related("participant_entries").order_by("-updated_at")
        if search:
            competitions = competitions.filter(Q(name__icontains=search) | Q(short_description__icontains=search))
        if status_filter:
            competitions = competitions.filter(status=status_filter)
        items = list(competitions[:100])
        for competition in items:
            competition.prefetched_organizers = [
                participant for participant in competition.participant_entries.all()
                if participant.role == "organizer"
            ][:4]
        return Response([serialize_admin_competition(competition) for competition in items])


class AdminCompetitionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        denied = ensure_admin_request(request)
        if denied:
            return denied
        competition = get_object_or_404(Competition, pk=pk)
        competition.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, pk):
        denied = ensure_admin_request(request)
        if denied:
            return denied
        competition = get_object_or_404(Competition, pk=pk)
        data = request.data
        allowed_values = {
            "status": {choice[0] for choice in Competition.STATUS_CHOICES},
            "visibilityMode": {choice[0] for choice in Competition.VISIBILITY_MODE_CHOICES},
            "organizerApprovalStatus": {choice[0] for choice in Competition.ORGANIZER_APPROVAL_CHOICES},
        }
        changed = []
        if "status" in data:
            if data["status"] not in allowed_values["status"]:
                return Response({"detail": "Unsupported competition status."}, status=status.HTTP_400_BAD_REQUEST)
            competition.status = data["status"]
            changed.append("status")
        if "visibilityMode" in data:
            if data["visibilityMode"] not in allowed_values["visibilityMode"]:
                return Response({"detail": "Unsupported visibility mode."}, status=status.HTTP_400_BAD_REQUEST)
            competition.visibility_mode = data["visibilityMode"]
            competition.is_public = data["visibilityMode"] == "public"
            changed.extend(["visibility_mode", "is_public"])
        if "showInCatalog" in data:
            competition.show_in_catalog = bool(data["showInCatalog"])
            changed.append("show_in_catalog")
        if "organizerApprovalStatus" in data:
            if data["organizerApprovalStatus"] not in allowed_values["organizerApprovalStatus"]:
                return Response({"detail": "Unsupported approval status."}, status=status.HTTP_400_BAD_REQUEST)
            competition.organizer_approval_status = data["organizerApprovalStatus"]
            competition.organizer_approved_by = request.user
            competition.organizer_approved_at = timezone.now()
            changed.extend(["organizer_approval_status", "organizer_approved_by", "organizer_approved_at"])
        if "resultsFrozen" in data:
            competition.results_frozen = bool(data["resultsFrozen"])
            changed.append("results_frozen")

        if changed:
            changed.append("updated_at")
            competition.save(update_fields=list(dict.fromkeys(changed)))
            recompute_competition_timing(competition, save=True)
        competition.prefetched_organizers = list(CompetitionParticipant.objects.filter(competition=competition, role="organizer")[:4])
        return Response(serialize_admin_competition(competition))


class AdminMessagesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = ensure_admin_request(request)
        if denied:
            return denied
        messages = OutboundMessage.objects.select_related("competition").order_by("-created_at")[:100]
        return Response([serialize_admin_message(message) for message in messages])

    def post(self, request):
        denied = ensure_admin_request(request)
        if denied:
            return denied
        subject = (request.data.get("subject") or "").strip()
        body = (request.data.get("body") or "").strip()
        channel = request.data.get("channel") or "email"
        message_status = request.data.get("status") or "queued"
        if channel not in {choice[0] for choice in OutboundMessage.CHANNEL_CHOICES}:
            return Response({"detail": "Unsupported message channel."}, status=status.HTTP_400_BAD_REQUEST)
        if message_status not in {"draft", "queued"}:
            return Response({"detail": "Messages can be created as draft or queued."}, status=status.HTTP_400_BAD_REQUEST)
        if not subject or not body:
            return Response({"detail": "Subject and body are required."}, status=status.HTTP_400_BAD_REQUEST)

        competition = None
        if request.data.get("competition"):
            competition = get_object_or_404(Competition, pk=request.data.get("competition"))

        recipient_emails = request.data.get("recipientEmails") or request.data.get("recipients") or []
        if isinstance(recipient_emails, str):
            recipient_emails = [item.strip() for item in recipient_emails.replace(";", ",").split(",") if item.strip()]
        target_role = request.data.get("targetRole") or ""
        if target_role:
            users = get_user_model().objects.filter(email__gt="", is_active=True).select_related("profile")
            if target_role != "all":
                users = users.filter(profile__primary_role=target_role)
            recipient_emails.extend(users.values_list("email", flat=True))
        recipient_emails = sorted({email.strip().lower() for email in recipient_emails if email and "@" in email})
        if not recipient_emails:
            return Response({"detail": "At least one recipient email or target role is required."}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        messages = [
            OutboundMessage(
                competition=competition,
                recipient_email=email,
                channel=channel,
                subject=subject,
                body=body,
                status=message_status,
                queued_at=now if message_status == "queued" else None,
            )
            for email in recipient_emails[:500]
        ]
        created = OutboundMessage.objects.bulk_create(messages)
        return Response([serialize_admin_message(message) for message in created], status=status.HTTP_201_CREATED)


class AdminFilterOptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = ensure_admin_request(request)
        if denied:
            return denied
        ensure_landing_filter_configs()
        return Response(serialize_landing_filter_options(language="en", include_hidden=True))

    def post(self, request):
        return self._upsert_option(request)

    def patch(self, request):
        return self._upsert_option(request)

    def _upsert_option(self, request):
        denied = ensure_admin_request(request)
        if denied:
            return denied
        group = (request.data.get("group") or "").strip()
        value = (request.data.get("value") or "").strip()
        allowed_groups = set(LANDING_FILTER_DEFAULTS.keys()) | {"status", "event_type", "participation_type", "industry", "difficulty", "language"}
        if group not in allowed_groups:
            return Response({"detail": "Unsupported landing filter group."}, status=status.HTTP_400_BAD_REQUEST)
        if not value:
            return Response({"detail": "Filter value is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(value) > 64 or not value.replace("_", "").replace("-", "").isalnum():
            return Response({"detail": "Filter value can contain letters, numbers, hyphens and underscores."}, status=status.HTTP_400_BAD_REQUEST)
        defaults_by_group = {
            item["value"]: item
            for item in LANDING_FILTER_DEFAULTS.get(group, [])
        }
        default = defaults_by_group.get(value) or {
            "label_en": value.replace("_", " ").replace("-", " ").title(),
            "label_uk": value.replace("_", " ").replace("-", " ").title(),
        }
        default_order = next(
            (
                index
                for index, item in enumerate(LANDING_FILTER_DEFAULTS.get(group, []))
                if item["value"] == value
            ),
            LandingFilterOption.objects.filter(group=group).count(),
        )
        option, _ = LandingFilterOption.objects.get_or_create(
            group=group,
            value=value,
            defaults={
                "label_en": default["label_en"],
                "label_uk": default["label_uk"],
                "sort_order": default_order,
            },
        )
        if "labelEn" in request.data:
            option.label_en = (request.data.get("labelEn") or "").strip()[:255] or default["label_en"]
        if "labelUk" in request.data:
            option.label_uk = (request.data.get("labelUk") or "").strip()[:255] or default["label_uk"]
        if "hidden" in request.data:
            option.is_hidden = bool(request.data.get("hidden"))
        if "sortOrder" in request.data:
            try:
                option.sort_order = max(0, int(request.data.get("sortOrder")))
            except (TypeError, ValueError):
                return Response({"detail": "Sort order must be a number."}, status=status.HTTP_400_BAD_REQUEST)
        option.save()
        return Response(serialize_landing_filter_options(language="en", include_hidden=True))


class LandingCompetitionsView(APIView):
    permission_classes = [AllowAny]
    CACHE_TTL_SECONDS = 5
    CARD_QUERY_FIELDS = [
        "id", "slug", "name", "short_description", "cover_image", "status",
        "event_type", "participation_type", "access_mode", "visibility_mode",
        "show_in_catalog", "allow_sharing_link", "allow_external_registration",
        "auto_approve_join_requests", "min_team_size", "max_team_size", "manual_judging_enabled",
        "automatic_judging_enabled", "peer_review_enabled", "judging_aggregation",
        "judging_visibility", "results_frozen", "industry", "difficulty",
        "language", "current_round", "total_rounds", "participants_count",
        "comments_count", "views_count", "followers_count",
        "is_live_stream_enabled", "is_online_now", "registration_open",
        "submissions_open", "trending_score", "registration_starts_at",
        "registration_ends_at", "starts_at", "ends_at", "judging_starts_at",
        "judging_ends_at", "results_public_at", "timer_deadline",
        "created_at", "updated_at",
    ]

    STATUS_TABS = {
        "registration_open": ["registration_open"],
        "active": ["active"],
        "judging": ["judging"],
        "upcoming": ["upcoming", "published"],
        "finished": ["finished"],
        "archived": ["archived"],
    }

    def get(self, request):
        now = timezone.now()
        is_anonymous = not request.user.is_authenticated
        cache_key = None
        if is_anonymous:
            cache_key = f"landing:competitions:v3:{request.META.get('QUERY_STRING', '')}"
            cached_payload = cache.get(cache_key)
            if cached_payload is not None:
                return Response(cached_payload)

        # Keep the database status in sync before filtering. This is intentionally
        # throttled so a busy landing page does not write the same timing fields
        # on every tab/search refresh.
        if cache.add("landing:timing-sync:v1", "1", self.CACHE_TTL_SECONDS):
            base_qs = Competition.objects.filter(is_public=True, show_in_catalog=True).exclude(status="draft")
            for competition in base_qs[:100]:
                recompute_competition_timing(competition, now=now, save=True)

        qs = Competition.objects.filter(is_public=True, show_in_catalog=True).exclude(status="draft")

        search = request.query_params.get("search")
        tab = request.query_params.get("tab") or "registration_open"
        event_types = request.query_params.getlist("event_type")
        participation_types = request.query_params.getlist("participation_type")
        access_modes = request.query_params.getlist("access_mode")
        visibility_modes = request.query_params.getlist("visibility_mode")
        industries = request.query_params.getlist("industry")
        difficulties = request.query_params.getlist("difficulty")
        languages = request.query_params.getlist("language")

        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(short_description__icontains=search))
        if event_types:
            qs = qs.filter(event_type__in=event_types)
        if participation_types:
            qs = qs.filter(participation_type__in=participation_types)
        if access_modes:
            qs = qs.filter(access_mode__in=access_modes)
        if visibility_modes:
            qs = qs.filter(visibility_mode__in=visibility_modes)
        if industries:
            qs = qs.filter(industry__in=industries)
        if difficulties:
            qs = qs.filter(difficulty__in=difficulties)
        if languages:
            qs = qs.filter(language__in=languages)

        tab_statuses = self.STATUS_TABS.get(tab, self.STATUS_TABS["registration_open"])
        qs = qs.filter(status__in=tab_statuses)
        if tab in ["registration_open", "upcoming"]:
            qs = qs.order_by("timer_deadline", "starts_at", "-created_at")
        elif tab in ["active", "judging"]:
            qs = qs.order_by("timer_deadline", "-trending_score", "name")
        else:
            qs = qs.order_by("-ends_at", "-updated_at", "name")

        competitions = list(qs.only(*self.CARD_QUERY_FIELDS)[:20])
        serializer_context = {"request": request}
        if request.user.is_authenticated and competitions:
            competition_ids = [competition.id for competition in competitions]
            serializer_context["user_primary_role"] = user_primary_role(request.user)
            serializer_context["saved_competition_ids"] = set(
                UserSavedCompetition.objects.filter(
                    user=request.user,
                    competition_id__in=competition_ids,
                ).values_list("competition_id", flat=True)
            )
            serializer_context["watched_competition_ids"] = set(
                UserCompetitionWatch.objects.filter(
                    user=request.user,
                    competition_id__in=competition_ids,
                ).values_list("competition_id", flat=True)
            )
            serializer_context["membership_by_competition"] = {
                membership.competition_id: membership
                for membership in CompetitionParticipant.objects.filter(
                    competition_id__in=competition_ids,
                    user=request.user,
                ).select_related("team")
            }
            join_request_by_competition = {}
            for join_request in (
                CompetitionJoinRequest.objects.filter(
                    competition_id__in=competition_ids,
                    user=request.user,
                )
                .select_related("team")
                .order_by("competition_id", "-created_at")
            ):
                join_request_by_competition.setdefault(join_request.competition_id, join_request)
            serializer_context["join_request_by_competition"] = join_request_by_competition
            if request.user.is_staff or request.user.is_superuser or serializer_context["user_primary_role"] == "admin":
                serializer_context["editable_competition_ids"] = set(competition_ids)
            elif serializer_context["user_primary_role"] == "organizer":
                serializer_context["editable_competition_ids"] = set(
                    CompetitionParticipant.objects.filter(
                        competition_id__in=competition_ids,
                        user=request.user,
                        role="organizer",
                    ).values_list("competition_id", flat=True)
                )
            else:
                serializer_context["editable_competition_ids"] = set()

        serializer = CompetitionCardSerializer(competitions, many=True, context=serializer_context)
        payload = list(serializer.data)
        if cache_key:
            cache.set(cache_key, payload, self.CACHE_TTL_SECONDS)
        return Response(payload)


class LandingSidebarView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        now = timezone.now()
        latest_competitions = list(
            Competition.objects.filter(is_public=True, show_in_catalog=True)
            .exclude(status__in=["draft", "archived"])
            .order_by("-updated_at", "-created_at")[:6]
        )
        latest_competitions = [
            recompute_competition_timing(competition, now=now, save=False)
            for competition in latest_competitions
        ]
        latest_competitions = [
            competition
            for competition in latest_competitions
            if competition.status != "archived"
        ]

        if not request.user.is_authenticated:
            return Response({
                "recently_viewed": [],
                "recent_materials": [],
                "last_competitions": SidebarCompetitionSerializer(latest_competitions, many=True).data,
                "saved_competitions": [],
            })

        recent_records = (
            RecentlyViewedCompetition.objects.filter(user=request.user, competition__is_public=True)
            .select_related("competition")
            .order_by("-viewed_at")[:6]
        )
        seen_competition_ids = set()
        recent_competitions = []
        for record in recent_records:
            if record.competition_id not in seen_competition_ids:
                recent_competitions.append(record.competition)
                seen_competition_ids.add(record.competition_id)

        recent_material_records = (
            RecentlyViewedMaterial.objects.filter(user=request.user, material__competition__is_public=True)
            .select_related("material", "material__competition")
            .order_by("-viewed_at")[:6]
        )

        saved_records = (
            UserSavedCompetition.objects.filter(user=request.user, competition__is_public=True)
            .select_related("competition")
            .order_by("-created_at")[:6]
        )
        saved_competitions = [record.competition for record in saved_records]

        return Response({
            "recently_viewed": SidebarCompetitionSerializer(recent_competitions, many=True).data,
            "recent_materials": RecentlyViewedMaterialSerializer(
                recent_material_records,
                many=True,
                context={"request": request},
            ).data,
            "last_competitions": SidebarCompetitionSerializer(latest_competitions, many=True).data,
            "saved_competitions": SidebarCompetitionSerializer(saved_competitions, many=True).data,
        })


class LandingFiltersView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        language = request.query_params.get("lang") or request.query_params.get("language") or "en"
        language = "uk" if language == "uk" else "en"
        return Response(serialize_landing_filter_options(language=language, include_hidden=False))


class CompetitionDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        competition = get_object_or_404(
            Competition,
            pk=pk,
            is_public=True,
        )
        recompute_competition_timing(competition, save=True)

        if request.user.is_authenticated:
            viewed, created = RecentlyViewedCompetition.objects.get_or_create(
                user=request.user,
                competition=competition,
            )
            if not created:
                RecentlyViewedCompetition.objects.filter(pk=viewed.pk).update(
                    view_count=F("view_count") + 1,
                    viewed_at=timezone.now(),
                )
            Competition.objects.filter(pk=competition.pk).update(views_count=F("views_count") + 1)
            competition.refresh_from_db(fields=["views_count"])

        serializer = CompetitionDetailSerializer(
            competition,
            context={"request": request},
        )
        return Response(serializer.data)


class ToggleSavedCompetitionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk, is_public=True)

        UserSavedCompetition.objects.get_or_create(
            user=request.user,
            competition=competition,
        )

        return Response({"saved": True}, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        # Removing a saved item must be idempotent. Profile/sidebar state can
        # contain stale IDs after reseeding the local database, so a DELETE for
        # a missing competition should still clean up any stale relation and
        # return a successful unsaved state instead of breaking the UI with 404.
        UserSavedCompetition.objects.filter(
            user=request.user,
            competition_id=pk,
        ).delete()

        return Response({"saved": False}, status=status.HTTP_200_OK)


class MySavedCompetitionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        saved_items = (
            UserSavedCompetition.objects.filter(user=request.user, competition__is_public=True)
            .select_related("competition")
            .order_by("-created_at")
        )

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


class MarkMaterialViewedView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        material = get_object_or_404(CompetitionMaterial, pk=pk, competition__is_public=True)
        viewed, created = RecentlyViewedMaterial.objects.get_or_create(
            user=request.user,
            material=material,
        )
        if not created:
            RecentlyViewedMaterial.objects.filter(pk=viewed.pk).update(
                view_count=F("view_count") + 1,
                viewed_at=timezone.now(),
            )
            viewed.refresh_from_db()
        return Response(
            RecentlyViewedMaterialSerializer(viewed, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


def user_can_manage_announcement(user, announcement):
    if not user or not user.is_authenticated:
        return False
    if user.is_staff or user.is_superuser or user_is_admin(user):
        return True
    if announcement.author_id:
        return announcement.author_id == user.id
    return user_can_edit_competition(user, announcement.competition)


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
            context={"request": request},
        )
        return Response(serializer.data)

    def post(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        if not user_can_edit_competition(request.user, competition):
            return Response({"detail": "You cannot edit announcements for this competition."}, status=status.HTTP_403_FORBIDDEN)

        payload = {
            "competition": competition.id,
            "title": (request.data.get("title") or "").strip(),
            "text": (request.data.get("text") or "").strip(),
            "is_pinned": request_bool(request.data.get("is_pinned"), False),
        }
        serializer = CompetitionAnnouncementSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        announcement = serializer.save(author=request.user, competition=competition)
        return Response(
            CompetitionAnnouncementSerializer(announcement, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def patch(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        if not user_can_edit_competition(request.user, competition):
            return Response({"detail": "You cannot edit announcements for this competition."}, status=status.HTTP_403_FORBIDDEN)

        announcement = get_object_or_404(CompetitionAnnouncement, pk=request.data.get("id"), competition=competition)
        if not user_can_manage_announcement(request.user, announcement):
            return Response({"detail": "You can edit only your own announcements."}, status=status.HTTP_403_FORBIDDEN)
        payload = request.data.copy()
        if "is_pinned" in payload:
            payload["is_pinned"] = request_bool(payload.get("is_pinned"), False)
        serializer = CompetitionAnnouncementSerializer(announcement, data=payload, partial=True)
        serializer.is_valid(raise_exception=True)
        announcement = serializer.save(competition=competition)
        return Response(CompetitionAnnouncementSerializer(announcement, context={"request": request}).data)

    def delete(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        if not user_can_edit_competition(request.user, competition):
            return Response({"detail": "You cannot edit announcements for this competition."}, status=status.HTTP_403_FORBIDDEN)

        announcement = get_object_or_404(CompetitionAnnouncement, pk=request.data.get("id") or request.query_params.get("id"), competition=competition)
        if not user_can_manage_announcement(request.user, announcement):
            return Response({"detail": "You can delete only your own announcements."}, status=status.HTTP_403_FORBIDDEN)
        announcement.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AddAnnouncementCommentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        announcement = get_object_or_404(CompetitionAnnouncement, pk=pk)
        if not announcement.competition.is_public and not user_can_edit_competition(request.user, announcement.competition):
            return Response(
                {"detail": "Comments are not available for this announcement."},
                status=status.HTTP_403_FORBIDDEN,
            )

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

        serializer = CompetitionAnnouncementCommentSerializer(comment, context={"request": request})
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
            competition=competition,
            role__in=["participant", "team_member"],
        ).select_related("user", "team").order_by("display_name")

        serializer = CompetitionParticipantSerializer(
            participants,
            many=True,
        )
        return Response(serializer.data)


class JoinCompetitionView(APIView):
    permission_classes = [IsAuthenticated]

    ALLOWED_ROLES = {"participant", "team_member"}

    def post(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        recompute_competition_timing(competition, save=True)

        profile = get_or_create_profile(request.user)
        if profile.primary_role != "participant" or request.user.is_staff:
            return Response(
                {"detail": "Only participant accounts can register for competitions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not competition.registration_open or competition.status not in ["registration_open", "upcoming", "active"]:
            return Response(
                {"detail": "Registration for this competition is not open."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        role = (request.data.get("role") or "participant").strip()
        if role == "team":
            role = "team_member"
        if role not in self.ALLOWED_ROLES:
            return Response(
                {"detail": "Invalid role."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_member = CompetitionParticipant.objects.filter(
            competition=competition,
            user=request.user,
        ).select_related("team").first()
        if existing_member and existing_member.role == "judge" and existing_member.status in ["pending", "approved"]:
            return Response(
                {"detail": "Judges cannot participate in the same competition they judge."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if existing_member and existing_member.status in ["approved", "pending"]:
            return Response({
                "detail": "You already have a participation record for this competition.",
                "status": existing_member.status,
                "role": existing_member.role,
                "team": CompetitionTeamSerializer(existing_member.team).data if existing_member.team else None,
            }, status=status.HTTP_200_OK)

        existing_request = CompetitionJoinRequest.objects.filter(
            competition=competition,
            user=request.user,
            status__in=["pending", "approved"],
        ).select_related("team").order_by("-created_at").first()
        if existing_request:
            return Response(CompetitionJoinRequestSerializer(existing_request).data, status=status.HTTP_200_OK)

        team = None
        team_name = (request.data.get("team_name") or "").strip()
        if role == "team_member":
            if not team_name:
                return Response(
                    {"detail": "Team name is required for team participation."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            team = CompetitionTeam.objects.filter(competition=competition, name=team_name).first()
            if team and team.captain_id and team.captain_id != request.user.id:
                return Response(
                    {"detail": "Join this team through an invitation from its captain."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if team and user_has_active_team_conflict(request.user, competition, team=team):
                return Response(
                    {"detail": "You already belong to another team in this competition."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not team:
                team = CompetitionTeam.objects.create(
                    competition=competition,
                    name=team_name,
                    captain=request.user,
                    status="pending",
                    description=(request.data.get("team_description") or "").strip(),
                )

        full_name = request.user.get_full_name().strip()
        display_name = full_name or getattr(request.user, "username", "") or getattr(request.user, "email", "")
        message = (request.data.get("message") or "").strip()

        initial_status = "approved" if competition.auto_approve_join_requests else "pending"
        reviewed_by = None
        reviewed_at = timezone.now() if initial_status == "approved" else None

        join_request, _ = CompetitionJoinRequest.objects.update_or_create(
            competition=competition,
            user=request.user,
            role=role,
            defaults={
                "status": initial_status,
                "team": team,
                "team_name": team.name if team else "",
                "message": message,
                "reviewed_by": reviewed_by,
                "reviewed_at": reviewed_at,
            },
        )

        CompetitionParticipant.objects.update_or_create(
            competition=competition,
            user=request.user,
            defaults={
                "display_name": display_name,
                "role": role,
                "status": initial_status,
                "team": team,
                "is_active_now": False,
            },
        )

        if team:
            team.status = initial_status
            team.save(update_fields=["status", "updated_at"])

        competition.participants_count = CompetitionParticipant.objects.filter(
            competition=competition,
            status="approved",
            role__in=["participant", "team_member"],
        ).count()
        competition.save(update_fields=["participants_count"])

        serializer = CompetitionJoinRequestSerializer(join_request)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CompetitionJoinRequestReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        join_request = get_object_or_404(
            CompetitionJoinRequest.objects.select_related("competition", "user", "team"),
            pk=pk,
            status="pending",
        )
        competition = join_request.competition
        profile = get_or_create_profile(request.user)
        is_admin = request.user.is_staff or profile.primary_role == "admin"
        is_organizer = CompetitionParticipant.objects.filter(
            competition=competition,
            user=request.user,
            role="organizer",
            status="approved",
        ).exists()
        if not (is_admin or is_organizer):
            return Response({"detail": "Only the competition organizer or administrator can review this request."}, status=status.HTTP_403_FORBIDDEN)

        decision = (request.data.get("decision") or request.data.get("status") or "").strip().lower()
        if decision not in ["approved", "rejected"]:
            return Response({"detail": "Decision must be approved or rejected."}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        join_request.status = decision
        join_request.reviewed_by = request.user
        join_request.reviewed_at = now
        join_request.save(update_fields=["status", "reviewed_by", "reviewed_at"])

        participant, _ = CompetitionParticipant.objects.update_or_create(
            competition=competition,
            user=join_request.user,
            defaults={
                "display_name": join_request.user.get_full_name() or join_request.user.get_username() or join_request.user.email,
                "role": join_request.role,
                "status": decision,
                "team": join_request.team,
                "is_active_now": False,
            },
        )
        if join_request.team:
            join_request.team.status = decision
            join_request.team.save(update_fields=["status", "updated_at"])

        competition.participants_count = CompetitionParticipant.objects.filter(
            competition=competition,
            status="approved",
            role__in=["participant", "team_member"],
        ).count()
        competition.save(update_fields=["participants_count"])

        return Response({
            "request": CompetitionJoinRequestSerializer(join_request).data,
            "participant": CompetitionParticipantSerializer(participant).data,
            "participants_count": competition.participants_count,
        })


class TeamManagementView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        team = get_object_or_404(
            CompetitionTeam.objects.select_related("competition", "captain").prefetch_related("members__user"),
            pk=pk,
        )
        if team.captain_id != request.user.id:
            return Response(
                {"detail": "Only the current team captain can manage team access and transfer captain rights."},
                status=status.HTTP_403_FORBIDDEN,
            )

        action = (request.data.get("action") or "").strip()
        member_id = request.data.get("member_id")

        if action == "transfer_captain":
            member = get_object_or_404(
                CompetitionParticipant.objects.select_related("user"),
                pk=member_id,
                team=team,
                status__in=["pending", "approved"],
            )
            if not member.user:
                return Response({"detail": "Selected member does not have an account."}, status=status.HTTP_400_BAD_REQUEST)
            if member.user_id == request.user.id:
                return Response({"detail": "You are already the captain of this team."}, status=status.HTTP_400_BAD_REQUEST)
            team.captain = member.user
            team.save(update_fields=["captain", "updated_at"])

        elif action == "invite_member":
            email = normalize_email(request.data.get("email"))
            if not email:
                return Response({"detail": "Member email is required."}, status=status.HTTP_400_BAD_REQUEST)
            if not team.competition.allow_user_team_invites and not user_can_edit_competition(request.user, team.competition):
                return Response({"detail": "Team member invitations are disabled for this competition."}, status=status.HTTP_403_FORBIDDEN)
            User = get_user_model()
            invited_user = User.objects.filter(email__iexact=email).first()
            if invited_user:
                if user_is_competition_judge(invited_user, team.competition):
                    return Response({"detail": "Judges cannot join teams in the same competition."}, status=status.HTTP_400_BAD_REQUEST)
                if user_has_active_team_conflict(invited_user, team.competition, team=team):
                    return Response({"detail": "This user already belongs to another team in this competition."}, status=status.HTTP_400_BAD_REQUEST)
            token = secrets.token_urlsafe(32)
            invitation, _ = CompetitionInvitation.objects.update_or_create(
                competition=team.competition,
                email=email,
                target_type="team",
                team_name=team.name,
                defaults={
                    "invited_by": request.user,
                    "token": token,
                    "status": "queued",
                    "message": (request.data.get("message") or "").strip(),
                },
            )
            OutboundMessage.objects.create(
                competition=team.competition,
                invitation=invitation,
                recipient_email=email,
                channel="email",
                subject=f"Team invitation: {team.competition.name}",
                body=(invitation.message or f"You are invited to join team {team.name}.") + f"\n\nInvitation link: /competitions/{team.competition_id}?invite={invitation.token}",
                status="queued",
                queued_at=timezone.now(),
            )

        elif action == "update_member":
            member = get_object_or_404(CompetitionParticipant, pk=member_id, team=team)
            next_status = (request.data.get("status") or member.status).strip()
            next_role = (request.data.get("role") or member.role).strip()
            allowed_statuses = {"pending", "approved", "withdrawn"}
            allowed_roles = {"team_member", "participant"}
            if next_status not in allowed_statuses:
                return Response({"detail": "Unsupported member status for captain management."}, status=status.HTTP_400_BAD_REQUEST)
            if next_role not in allowed_roles:
                return Response({"detail": "Unsupported member role for captain management."}, status=status.HTTP_400_BAD_REQUEST)
            if member.user_id == request.user.id and next_status == "withdrawn":
                return Response({"detail": "Transfer captain rights before removing yourself from the team."}, status=status.HTTP_400_BAD_REQUEST)
            member.status = next_status
            member.role = next_role
            member.save(update_fields=["status", "role"])

        else:
            return Response({"detail": "Unsupported team management action."}, status=status.HTTP_400_BAD_REQUEST)

        team = CompetitionTeam.objects.prefetch_related("members__user", "members__user__profile").select_related("competition", "captain").get(pk=team.pk)
        return Response(CompetitionTeamSerializer(team).data)


def judging_subjects(competition, request=None):
    submissions = CompetitionSubmission.objects.filter(
        competition=competition,
        status__in=["accepted", "locked"],
    ).select_related("round", "participant", "team", "submitted_by", "file").order_by(
        "round__sort_order", "team__name", "participant__display_name", "-updated_at"
    )

    subjects = []
    for submission in submissions:
        if submission.team_id:
            subject_name = submission.team.name
            subject_type = "team"
        elif submission.participant_id:
            subject_name = submission.participant.display_name
            subject_type = "participant"
        else:
            subject_name = submission.title or "Submission"
            subject_type = "submission"
        subjects.append({
            "type": subject_type,
            "id": f"submission-{submission.id}",
            "submission_id": submission.id,
            "round_id": submission.round_id,
            "team_id": submission.team_id,
            "participant_id": submission.participant_id,
            "name": subject_name,
            "title": submission.title,
            "status": submission.status,
            "repository_url": submission.repository_url,
            "demo_url": submission.demo_url,
            "file": {
                "id": submission.file_id,
                "original_name": submission.file.original_name,
                "mime_type": submission.file.mime_type,
                "size_bytes": submission.file.size_bytes,
                "url": build_file_download_url(submission.file, request),
            } if submission.file else None,
        })
    return subjects


def user_competition_membership(user, competition):
    if not user or not user.is_authenticated:
        return None
    return CompetitionParticipant.objects.filter(
        competition=competition,
        user=user,
    ).select_related("team").first()


def judge_has_accepted_assignment(user, competition, round_obj=None):
    if not user or not user.is_authenticated:
        return False
    assignments = CompetitionJudgeAssignment.objects.filter(
        competition=competition,
        judge=user,
        assignment_type="manual",
        status__in=["accepted", "completed"],
    )
    if round_obj:
        assignments = assignments.filter(Q(round__isnull=True) | Q(round=round_obj))
    return assignments.exists()


def judging_window_open(competition, now=None):
    now = now or timezone.now()
    if competition.judging_starts_at and now < competition.judging_starts_at:
        return False
    if competition.judging_ends_at and now > competition.judging_ends_at:
        return False
    return True


def user_allowed_review_types(user, competition):
    if not user or not user.is_authenticated:
        return []
    if user_can_edit_competition(user, competition):
        allowed = []
        if competition.automatic_judging_enabled:
            allowed.append("automatic")
        if competition.manual_judging_enabled:
            allowed.append("manual")
        if competition.peer_review_enabled:
            allowed.append("peer_review")
        return allowed

    membership = user_competition_membership(user, competition)
    allowed = []
    if (
        membership
        and membership.role == "judge"
        and membership.status == "approved"
        and competition.manual_judging_enabled
        and judge_has_accepted_assignment(user, competition)
    ):
        allowed.append("manual")
    if membership and membership.role in ["participant", "team_member"] and membership.status == "approved" and competition.peer_review_enabled:
        allowed.append("peer_review")
    return allowed


def criterion_allows_review_type(criterion, review_type):
    if criterion.judging_mode == "mixed":
        return review_type in {"automatic", "manual", "peer_review"}
    if criterion.judging_mode == "public_voting":
        return review_type == "peer_review"
    return criterion.judging_mode == review_type


def score_visibility_allows_details(request, competition):
    if competition.judging_visibility == "open":
        return True
    if request and request.user.is_authenticated and user_can_edit_competition(request.user, competition):
        return True
    return False


def results_are_public(competition, now=None):
    now = now or timezone.now()
    if competition.results_public_at:
        return now >= competition.results_public_at
    if competition.judging_ends_at:
        return now > competition.judging_ends_at
    return competition.status in ["finished", "archived"]


def user_can_view_results(user, competition):
    if user and user.is_authenticated and user_can_edit_competition(user, competition):
        return True
    return results_are_public(competition)


def result_subject_key(subject):
    if subject.get("team_id"):
        return f"team-{subject.get('team_id')}", "team"
    if subject.get("participant_id"):
        return f"participant-{subject.get('participant_id')}", "individual"
    return subject.get("id"), "individual"


def build_live_leaderboard(competition, request=None, limit=10, tables=None):
    tables = tables if tables is not None else build_round_score_tables(competition, request)
    per_round_scores = {}
    for table in tables:
        round_id = table.get("round", {}).get("id")
        if not round_id:
            continue
        for row in table.get("rows") or []:
            score = row.get("total_score")
            subject = row.get("subject") or {}
            subject_id, entry_type = result_subject_key(subject)
            if score is None or not subject_id:
                continue
            bucket = per_round_scores.setdefault((subject_id, round_id), {
                "name": subject.get("name") or subject.get("title") or "Submission",
                "score": Decimal(str(score)),
                "entry_type": entry_type,
            })
            bucket["score"] = max(bucket["score"], Decimal(str(score)))

    totals = {}
    for (subject_id, _round_id), item in per_round_scores.items():
        entry = totals.setdefault(subject_id, {
            "name": item["name"],
            "score": Decimal("0"),
            "entry_type": item["entry_type"],
            "round_number": None,
        })
        entry["score"] += item["score"]

    ranked = sorted(totals.values(), key=lambda item: (-item["score"], item["name"]))[:limit]
    return [
        {
            "id": index,
            "competition": competition.id,
            "rank": index,
            "name": item["name"],
            "score": float(item["score"]),
            "entry_type": item["entry_type"],
            "round_number": item["round_number"],
        }
        for index, item in enumerate(ranked, start=1)
    ]


def latest_scoreable_submission(competition, round_obj, participant=None, team=None):
    qs = CompetitionSubmission.objects.filter(
        competition=competition,
        round=round_obj,
        status__in=["accepted", "locked"],
    )
    if team:
        qs = qs.filter(team=team)
    elif participant:
        qs = qs.filter(participant=participant)
    else:
        return None
    return qs.order_by("-updated_at", "-created_at", "-id").first()


def build_round_score_tables(competition, request=None):
    rounds = list(competition.rounds.all().order_by("sort_order", "id"))
    criteria = list(competition.judging_criteria.all().order_by("sort_order", "id"))
    subjects = judging_subjects(competition, request)
    subject_lookup = {subject["id"]: subject for subject in subjects}
    scores = CompetitionScore.objects.filter(competition=competition).select_related(
        "round",
        "criterion",
        "judge",
        "subject_participant",
        "subject_team",
    ).order_by("round__sort_order", "criterion__sort_order", "id")

    grouped = {}
    for item in scores:
        if item.submission_id:
            subject_id = f"submission-{item.submission_id}"
        else:
            subject_id = f"team-{item.subject_team_id}" if item.subject_team_id else f"participant-{item.subject_participant_id}"
        if subject_id not in subject_lookup:
            continue
        row_key = (item.round_id, subject_id)
        criterion_bucket = grouped.setdefault(row_key, {}).setdefault(item.criterion_id, [])
        criterion_bucket.append(item)

    show_details = score_visibility_allows_details(request, competition)
    tables = []
    for round_obj in rounds:
        rows = []
        for subject in subjects:
            if subject.get("round_id") != round_obj.id:
                continue
            criterion_values = []
            total_score = Decimal("0")
            scored_criteria = 0
            score_details = []
            for criterion in criteria:
                entries = grouped.get((round_obj.id, subject["id"]), {}).get(criterion.id, [])
                if entries:
                    values = [entry.score for entry in entries]
                    aggregate = sum(values, Decimal("0"))
                    if competition.judging_aggregation == "average":
                        aggregate = aggregate / Decimal(len(values))
                    weighted = aggregate * Decimal(str(criterion.weight))
                    total_score += weighted
                    scored_criteria += 1
                    value = float(aggregate)
                else:
                    value = None
                criterion_values.append({
                    "criterion_id": criterion.id,
                    "title": criterion.title,
                    "max_score": criterion.max_score,
                    "weight": criterion.weight,
                    "score": value,
                    "score_count": len(entries),
                })
                if show_details:
                    score_details.extend(CompetitionScoreSerializer(entries, many=True, context={"request": request}).data)

            if scored_criteria or competition.status in ["active", "judging", "finished", "archived"]:
                rows.append({
                    "subject": subject,
                    "total_score": float(total_score) if scored_criteria else None,
                    "scored_criteria": scored_criteria,
                    "criteria": criterion_values,
                    "scores": score_details,
                })
        rows.sort(key=lambda item: (item["total_score"] is None, -(item["total_score"] or 0), item["subject"]["name"]))
        tables.append({
            "round": {
                "id": round_obj.id,
                "title": round_obj.title,
                "status": round_obj.status,
                "sort_order": round_obj.sort_order,
                "starts_at": round_obj.starts_at,
                "ends_at": round_obj.ends_at,
            },
            "rows": rows,
        })
    return tables


def build_judge_workspace(competition, request):
    if not request or not request.user.is_authenticated:
        return None
    assignments = CompetitionJudgeAssignment.objects.filter(
        competition=competition,
        judge=request.user,
    ).select_related("round", "judge")
    allowed_review_types = user_allowed_review_types(request.user, competition)
    has_assignment_context = assignments.exists()
    if not allowed_review_types and not has_assignment_context:
        return None

    membership = user_competition_membership(request.user, competition)
    window_open = judging_window_open(competition)
    can_see_subjects = bool(allowed_review_types and window_open)
    if user_can_edit_competition(request.user, competition):
        can_see_subjects = True
    subjects = judging_subjects(competition, request) if can_see_subjects else []
    if "peer_review" in allowed_review_types and allowed_review_types == ["peer_review"] and membership:
        subjects = [
            subject for subject in subjects
            if subject.get("participant_id") != membership.id and subject.get("team_id") != membership.team_id
        ]

    own_scores = CompetitionScore.objects.filter(
        competition=competition,
        judge=request.user,
    ).select_related("round", "criterion", "subject_participant", "subject_team", "judge")

    return {
        "allowed_review_types": allowed_review_types,
        "default_review_type": allowed_review_types[0] if allowed_review_types else "",
        "can_score": bool(allowed_review_types and window_open),
        "judging_window_open": window_open,
        "subjects": subjects,
        "assignments": CompetitionJudgeAssignmentSerializer(assignments, many=True).data,
        "existing_scores": CompetitionScoreSerializer(own_scores, many=True, context={"request": request}).data,
    }


def active_submission_round(competition):
    return competition.rounds.filter(status="active", submission_required=True).order_by("sort_order", "id").first()


def submission_round_for_request(competition, data):
    round_id = data.get("round") or data.get("round_id") or data.get("roundId")
    if not round_id:
        return active_submission_round(competition), None
    try:
        round_obj = competition.rounds.get(pk=round_id, submission_required=True)
    except (CompetitionRound.DoesNotExist, ValueError, TypeError):
        return None, "Selected round is not available for submissions."
    if round_obj.status != "active":
        return None, "Selected round is not active for submissions."
    return round_obj, None


def submission_owner_filter(membership):
    if membership.team_id:
        return {"team": membership.team, "participant": None}
    return {"participant": membership, "team": None}


def user_submission_queryset(user, competition):
    membership = user_competition_membership(user, competition)
    if not membership:
        return CompetitionSubmission.objects.none()
    if membership.team_id:
        return CompetitionSubmission.objects.filter(competition=competition, team=membership.team)
    return CompetitionSubmission.objects.filter(competition=competition, participant=membership)


def submission_file_extension(uploaded_file):
    name = normalize_upload_name(getattr(uploaded_file, "name", ""))
    return os.path.splitext(name)[1].lower().lstrip(".")


def validate_submission_content(settings_obj, description, repository_url, demo_url, uploaded_file, existing_submission=None):
    has_existing_file = bool(existing_submission and existing_submission.file_id and not uploaded_file)
    has_file = bool(uploaded_file or has_existing_file)
    mode = settings_obj.submission_mode if settings_obj else "mixed"

    if settings_obj:
        if settings_obj.description_required and not description:
            return "Submission description is required."
        if settings_obj.repository_url_required and not repository_url:
            return "Repository URL is required."
        if settings_obj.demo_url_required and not demo_url:
            return "Demo URL is required."
        if uploaded_file and settings_obj.allowed_file_types:
            extension = submission_file_extension(uploaded_file)
            allowed = {str(item).lower().lstrip(".") for item in settings_obj.allowed_file_types if item}
            if extension and extension not in allowed:
                return f"File type .{extension} is not allowed for this competition."

    if mode == "file_upload" and not has_file:
        return "A file is required for this submission."
    if mode == "text_answer" and not description:
        return "Text answer is required for this submission."
    if mode == "repository_link" and not repository_url:
        return "Repository URL is required for this submission."
    if mode == "demo_link" and not demo_url:
        return "Demo URL is required for this submission."
    if mode == "mixed" and not any([description, repository_url, demo_url, has_file]):
        return "Add a description, repository URL, demo URL, or file before submitting."
    return ""


class CompetitionSubmissionsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        if user_can_edit_competition(request.user, competition):
            submissions = CompetitionSubmission.objects.filter(competition=competition)
        else:
            membership = user_competition_membership(request.user, competition)
            if (
                membership
                and membership.role == "judge"
                and membership.status == "approved"
                and judge_has_accepted_assignment(request.user, competition)
                and judging_window_open(competition)
            ):
                submissions = CompetitionSubmission.objects.filter(competition=competition, status__in=["accepted", "locked"])
            else:
                submissions = user_submission_queryset(request.user, competition)
        submissions = submissions.select_related("round", "participant", "team", "submitted_by", "file").order_by("round__sort_order", "-updated_at")
        return Response(CompetitionSubmissionSerializer(submissions, many=True, context={"request": request}).data)

    def post(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk, is_public=True)
        recompute_competition_timing(competition, save=True)
        membership = user_competition_membership(request.user, competition)
        if not membership or membership.status != "approved" or membership.role not in ["participant", "team_member"]:
            return Response({"detail": "Only approved participants can submit work for judging."}, status=status.HTTP_403_FORBIDDEN)

        round_obj, round_error = submission_round_for_request(competition, request.data)
        if round_error:
            return Response({"detail": round_error}, status=status.HTTP_400_BAD_REQUEST)
        if competition.status != "active" or not competition.submissions_open or not round_obj:
            return Response({"detail": "Submissions are open only during the active submission round."}, status=status.HTTP_400_BAD_REQUEST)

        settings_obj = getattr(competition, "submission_settings", None)
        title = (request.data.get("title") or "").strip()
        description = (request.data.get("description") or "").strip()
        repository_url = (request.data.get("repository_url") or request.data.get("repositoryUrl") or "").strip()
        demo_url = (request.data.get("demo_url") or request.data.get("demoUrl") or "").strip()

        owner_filter = submission_owner_filter(membership)
        existing = CompetitionSubmission.objects.filter(
            competition=competition,
            round=round_obj,
            **owner_filter,
        ).exclude(status="rejected").order_by("-created_at")

        policy = settings_obj.submission_policy if settings_obj else "single"
        max_submissions = settings_obj.max_submissions if settings_obj else 1
        round_max_attempts = max(1, round_obj.max_attempts or 1)
        effective_max_submissions = min(max(1, max_submissions or 1), round_max_attempts)
        existing_submission = existing.first() if policy in {"single", "latest"} else None
        if existing.filter(status="locked").exists():
            return Response({"detail": "Submission for this round is locked."}, status=status.HTTP_400_BAD_REQUEST)
        if policy == "multiple" and existing.count() >= effective_max_submissions:
            return Response({"detail": "Maximum submissions for this round has been reached."}, status=status.HTTP_400_BAD_REQUEST)

        file_obj = None
        file_id = request.data.get("file") or request.data.get("file_id")
        uploaded_file = request.FILES.get("file")
        content_error = validate_submission_content(
            settings_obj,
            description,
            repository_url,
            demo_url,
            uploaded_file,
            existing_submission=existing_submission,
        )
        if content_error:
            return Response({"detail": content_error}, status=status.HTTP_400_BAD_REQUEST)
        if uploaded_file:
            if settings_obj and settings_obj.max_file_size_mb:
                max_bytes = int(settings_obj.max_file_size_mb) * 1024 * 1024
                declared_size = getattr(uploaded_file, "size", None)
                if declared_size and declared_size > max_bytes:
                    return Response(
                        {"detail": f"File is too large. Maximum size is {settings_obj.max_file_size_mb} MB."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            try:
                file_obj = create_uploaded_user_file(
                    request.user,
                    uploaded_file,
                    file_type="submission",
                    visibility="competition_only",
                )
            except ValueError as error:
                return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        elif file_id:
            file_obj = get_object_or_404(UserFile, pk=file_id, owner=request.user)

        if existing_submission:
            existing_submission.submitted_by = request.user
            existing_submission.title = title
            existing_submission.description = description
            existing_submission.repository_url = repository_url
            existing_submission.demo_url = demo_url
            if file_obj:
                existing_submission.file = file_obj
            existing_submission.status = "accepted"
            existing_submission.locked_at = None
            existing_submission.save(update_fields=[
                "submitted_by", "title", "description", "repository_url", "demo_url",
                "file", "status", "locked_at", "updated_at",
            ])
            return Response(CompetitionSubmissionSerializer(existing_submission, context={"request": request}).data)

        submission = CompetitionSubmission.objects.create(
            competition=competition,
            round=round_obj,
            participant=owner_filter["participant"],
            team=owner_filter["team"],
            submitted_by=request.user,
            title=title,
            description=description,
            repository_url=repository_url,
            demo_url=demo_url,
            file=file_obj,
            status="accepted",
        )
        return Response(CompetitionSubmissionSerializer(submission, context={"request": request}).data, status=status.HTTP_201_CREATED)


class CompetitionSubmissionReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        submission = get_object_or_404(
            CompetitionSubmission.objects.select_related("competition", "round", "participant", "team", "submitted_by", "file"),
            pk=pk,
        )
        if not user_can_edit_competition(request.user, submission.competition):
            return Response({"detail": "Only the organizer can review submissions."}, status=status.HTTP_403_FORBIDDEN)

        next_status = (request.data.get("status") or request.data.get("decision") or "").strip().lower()
        if next_status not in {"accepted", "rejected", "locked"}:
            return Response({"detail": "Submission status must be accepted, rejected, or locked."}, status=status.HTTP_400_BAD_REQUEST)
        submission.status = next_status
        if next_status == "locked" and not submission.locked_at:
            submission.locked_at = timezone.now()
        submission.save(update_fields=["status", "locked_at", "updated_at"])
        return Response(CompetitionSubmissionSerializer(submission, context={"request": request}).data)


class CompetitionResultsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        competition = get_object_or_404(
            Competition,
            pk=pk,
            is_public=True,
        )
        recompute_competition_timing(competition, save=True)

        if not user_can_view_results(request.user, competition):
            return Response(
                {"detail": "Results are not public yet."},
                status=status.HTTP_403_FORBIDDEN,
            )

        round_history = CompetitionRoundResult.objects.filter(
            competition=competition
        ).order_by("round_number", "id")

        round_scores = build_round_score_tables(competition, request)
        if not user_can_edit_competition(request.user, competition):
            round_scores = [
                {
                    **table,
                    "rows": [row for row in table.get("rows", []) if row.get("total_score") is not None],
                }
                for table in round_scores
            ]
        live_leaderboard = build_live_leaderboard(competition, request, tables=round_scores)
        if not live_leaderboard:
            live_leaderboard = CompetitionLeaderboardEntrySerializer(
                CompetitionLeaderboardEntry.objects.filter(
                    competition=competition
                ).order_by("rank", "id")[:10],
                many=True,
            ).data

        return Response({
            "round_history": CompetitionRoundResultSerializer(
                round_history,
                many=True,
            ).data,
            "leaderboard": live_leaderboard,
            "round_scores": round_scores,
        })


class ProfileDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile = get_or_create_profile(user)
        role = profile.primary_role or "participant"

        saved_records = (
            UserSavedCompetition.objects.filter(user=user, competition__is_public=True)
            .select_related("competition")
            .order_by("-created_at")[:12]
        )
        saved = [record.competition for record in saved_records]

        recent_records = RecentlyViewedCompetition.objects.filter(user=user, competition__is_public=True).select_related("competition").order_by("-viewed_at")[:12]
        recently_viewed = [record.competition for record in recent_records]

        memberships = CompetitionParticipant.objects.filter(user=user).select_related("competition", "team")
        approved_competitions = Competition.objects.filter(
            participant_entries__in=memberships.filter(status="approved", role__in=["participant", "team_member"]),
            is_public=True,
        ).distinct()

        active = approved_competitions.filter(status__in=["upcoming", "registration_open", "active", "judging"]).order_by("timer_deadline", "starts_at")[:12]
        archived = approved_competitions.filter(status__in=["finished", "archived"]).order_by("-ends_at", "-updated_at")[:12]

        teams = CompetitionTeam.objects.filter(members__user=user).prefetch_related("members__user", "members__user__profile").select_related("competition", "captain").distinct()[:12]
        organizer_base = Competition.objects.filter(
            participant_entries__user=user,
            participant_entries__role="organizer",
            participant_entries__status="approved",
        ).distinct()
        working_statuses = ["published", "upcoming", "registration_open", "active", "judging"]
        organized = organizer_base.filter(
            status__in=working_statuses,
        ).exclude(
            organizer_approval_status="rejected",
        ).order_by("timer_deadline", "-updated_at")[:12]
        drafts = organizer_base.filter(status="draft").order_by("-updated_at")[:12]

        pending_requests = []
        if role == "organizer":
            organized_ids = CompetitionParticipant.objects.filter(
                user=user,
                role="organizer",
                status="approved",
            ).values_list("competition_id", flat=True)
            incoming = CompetitionJoinRequest.objects.filter(
                competition_id__in=organized_ids,
                status="pending",
            ).select_related("competition", "user", "team").order_by("-created_at")[:20]
            pending_requests = [
                {
                    "id": item.id,
                    "type": "join_request",
                    "title": item.user.get_full_name() or item.user.get_username(),
                    "competition_id": item.competition_id,
                    "competition_name": item.competition.name,
                    "role": item.role,
                    "status": item.status,
                    "team_name": item.team_name or (item.team.name if item.team else ""),
                    "message": item.message,
                    "created_at": item.created_at,
                }
                for item in incoming
            ]
        elif role == "admin" or user.is_staff:
            organizer_drafts = Competition.objects.filter(
                participant_entries__role="organizer",
                organizer_approval_status="pending",
            ).select_related().distinct().order_by("-updated_at")[:20]
            pending_requests = [
                {
                    "id": item.id,
                    "type": "competition_creation_request",
                    "title": item.name,
                    "competition_id": item.id,
                    "competition_name": item.name,
                    "status": item.organizer_approval_status,
                    "message": item.short_description or "Organizer draft awaiting administrative review.",
                    "created_at": item.created_at,
                }
                for item in organizer_drafts
            ]
        else:
            own_pending = CompetitionJoinRequest.objects.filter(
                user=user,
                status="pending",
            ).select_related("competition", "team").order_by("-created_at")[:20]
            pending_requests = [
                {
                    "id": item.id,
                    "type": "my_join_request",
                    "title": item.competition.name,
                    "competition_id": item.competition_id,
                    "competition_name": item.competition.name,
                    "role": item.role,
                    "status": item.status,
                    "team_name": item.team_name or (item.team.name if item.team else ""),
                    "message": item.message,
                    "created_at": item.created_at,
                }
                for item in own_pending
            ]

        judge_assignments = CompetitionJudgeAssignment.objects.filter(
            judge=user,
            competition__is_public=True,
        ).select_related("competition", "round").order_by("-updated_at")[:20]
        score_counts = {
            item["competition"]: item
            for item in CompetitionScore.objects.filter(
                judge=user,
                competition__in=[assignment.competition for assignment in judge_assignments],
            ).values("competition").annotate(total=Count("id"), finalized=Count("id", filter=Q(is_final=True)))
        }
        judge_work = [
            {
                "id": assignment.id,
                "competition_id": assignment.competition_id,
                "competition_name": assignment.competition.name,
                "round_id": assignment.round_id,
                "round_title": assignment.round.title if assignment.round else "",
                "assignment_type": assignment.assignment_type,
                "status": assignment.status,
                "judging_starts_at": assignment.competition.judging_starts_at,
                "judging_ends_at": assignment.competition.judging_ends_at,
                "scores_count": score_counts.get(assignment.competition_id, {}).get("total", 0),
                "finalized_count": score_counts.get(assignment.competition_id, {}).get("finalized", 0),
            }
            for assignment in judge_assignments
        ]

        notifications = []
        for message in OutboundMessage.objects.filter(recipient_email__iexact=user.email).select_related("competition").order_by("-created_at")[:8]:
            notifications.append({
                "id": f"message-{message.id}",
                "type": "message",
                "title": message.subject,
                "text": message.body[:240],
                "competition_id": message.competition_id,
                "competition_name": message.competition.name if message.competition else "",
                "status": message.status,
                "created_at": message.created_at,
            })
        for item in CompetitionJoinRequest.objects.filter(user=user).select_related("competition", "team").order_by("-created_at")[:8]:
            notifications.append({
                "id": f"join-{item.id}",
                "type": "join_request",
                "title": item.competition.name,
                "text": item.message or item.team_name or (item.team.name if item.team else ""),
                "competition_id": item.competition_id,
                "competition_name": item.competition.name,
                "status": item.status,
                "created_at": item.created_at,
            })
        for assignment in judge_assignments[:8]:
            notifications.append({
                "id": f"judge-{assignment.id}",
                "type": "judge_assignment",
                "title": assignment.competition.name,
                "text": assignment.round.title if assignment.round else assignment.get_assignment_type_display(),
                "competition_id": assignment.competition_id,
                "competition_name": assignment.competition.name,
                "status": assignment.status,
                "created_at": assignment.updated_at,
            })
        notifications = sorted(notifications, key=lambda item: item["created_at"] or timezone.now(), reverse=True)[:10]

        own_comments = [
            {
                "id": comment.id,
                "text": comment.text,
                "created_at": comment.created_at,
                "announcement_id": comment.announcement_id,
                "announcement_title": comment.announcement.title,
                "competition_id": comment.announcement.competition_id,
                "competition_name": comment.announcement.competition.name,
            }
            for comment in CompetitionAnnouncementComment.objects.filter(
                author=user,
                announcement__competition__is_public=True,
            ).select_related("announcement", "announcement__competition").order_by("-created_at")[:12]
        ]

        return Response({
            "user": serialize_user(user),
            "profile": UserProfileSerializer(profile).data,
            "active_competitions": CompetitionCardSerializer(active, many=True, context={"request": request}).data,
            "saved_competitions": CompetitionCardSerializer(saved, many=True, context={"request": request}).data,
            "recently_viewed": CompetitionCardSerializer(recently_viewed, many=True, context={"request": request}).data,
            "archived_competitions": CompetitionCardSerializer(archived, many=True, context={"request": request}).data,
            "pending_requests": pending_requests,
            "pending_competitions": CompetitionCardSerializer(
                Competition.objects.filter(id__in=[item.get("competition_id") for item in pending_requests if item.get("competition_id")], is_public=True).distinct()[:12],
                many=True,
                context={"request": request},
            ).data,
            "organized_competitions": CompetitionCardSerializer(organized, many=True, context={"request": request}).data,
            "draft_competitions": CompetitionCardSerializer(drafts, many=True, context={"request": request}).data,
            "teams": CompetitionTeamSerializer(teams, many=True).data,
            "badges": UserBadgeSerializer(UserBadge.objects.filter(user=user)[:12], many=True).data,
            "certificates": CertificateSerializer(
                Certificate.objects.filter(user=user)[:12],
                many=True,
                context={"request": request},
            ).data,
            "materials": UserMaterialSerializer(
                UserMaterial.objects.filter(user=user)[:12],
                many=True,
                context={"request": request},
            ).data,
            "judge_work": judge_work,
            "notifications": notifications,
            "my_comments": own_comments,
            "stats": {
                "active": active.count(),
                "pending": len(pending_requests),
                "organized": organizer_base.filter(status__in=working_statuses).exclude(organizer_approval_status="rejected").count(),
                "saved": UserSavedCompetition.objects.filter(user=user, competition__is_public=True).count(),
                "archived": archived.count(),
                "badges": UserBadge.objects.filter(user=user).count(),
                "certificates": Certificate.objects.filter(user=user).count(),
                "judge_assignments": len(judge_work),
                "judge_scores": sum(item["scores_count"] for item in judge_work),
            },
        })

    def patch(self, request):
        profile = get_or_create_profile(request.user)
        data = request.data
        mapping = {
            "displayName": "display_name",
        }
        allowed = ["bio", "organization", "position", "phone", "country", "city", "skills", "interests", "links"]
        if "email" in data:
            request.user.email = data.get("email") or ""
            request.user.save(update_fields=["email"])
        if data.get("avatarDataUrl"):
            links = dict(profile.links or {})
            links["avatarDataUrl"] = data["avatarDataUrl"]
            profile.links = links
        for frontend_key, model_key in mapping.items():
            if frontend_key in data:
                setattr(profile, model_key, data[frontend_key])
        if "primaryRole" in data:
            next_role = data["primaryRole"]
            valid_roles = {choice[0] for choice in UserProfile.ROLE_CHOICES}
            if next_role not in valid_roles:
                return Response({"detail": "Unsupported profile role."}, status=status.HTTP_400_BAD_REQUEST)
            if next_role == "admin" and not user_is_admin(request.user):
                return Response(
                    {"detail": "Administrator role cannot be self-assigned."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            profile.primary_role = next_role
        for key in allowed:
            if key in data:
                setattr(profile, key, data[key])
        profile.save()
        return Response({"user": serialize_user(request.user), "profile": UserProfileSerializer(profile).data})



BUILDER_DATETIME_FIELDS = [
    "registration_starts_at",
    "registration_ends_at",
    "starts_at",
    "ends_at",
    "judging_starts_at",
    "judging_ends_at",
    "results_public_at",
    "timer_deadline",
]

def normalize_builder_payload(data):
    payload = data.copy()
    for field in BUILDER_DATETIME_FIELDS:
        if payload.get(field) == "":
            payload[field] = None

    for nested_field in ["rounds", "submission_settings", "judging_criteria", "awards"]:
        if payload.get(nested_field) is None:
            payload.pop(nested_field, None)

    if payload.get("starts_at") and not payload.get("judging_starts_at"):
        payload["judging_starts_at"] = payload["starts_at"]
    if payload.get("ends_at") and not payload.get("judging_ends_at"):
        payload["judging_ends_at"] = payload["ends_at"]

    normalized_rounds = []
    for round_item in payload.get("rounds") or []:
        item = round_item.copy()
        for field in ["starts_at", "ends_at"]:
            if item.get(field) == "":
                item[field] = None
        normalized_rounds.append(item)
    if "rounds" in payload:
        payload["rounds"] = normalized_rounds
    return payload

def user_can_edit_competition(user, competition):
    if not user.is_authenticated:
        return False
    if user_is_admin(user):
        return True
    profile = get_or_create_profile(user)
    if profile.primary_role != "organizer":
        return False
    if CompetitionParticipant.objects.filter(competition=competition, user=user, role="organizer").exists():
        return True
    return False


def ensure_organizer_membership(user, competition):
    display_name = user.get_full_name() or user.get_username() or getattr(user, "email", "")
    CompetitionParticipant.objects.update_or_create(
        competition=competition,
        user=user,
        defaults={
            "display_name": display_name,
            "role": "organizer",
            "status": "approved",
        },
    )


def normalize_upload_name(name):
    cleaned = (name or "upload").replace("\\", "/").split("/")[-1].strip()
    return cleaned or "upload"


def create_uploaded_user_file(owner, uploaded_file, file_type="resource", visibility="private"):
    original_name = normalize_upload_name(getattr(uploaded_file, "name", "upload"))
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    declared_size = getattr(uploaded_file, "size", None)
    if declared_size and declared_size > max_bytes:
        raise ValueError(f"File is too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB} MB.")

    content = uploaded_file.read(max_bytes + 1)
    size_bytes = len(content)
    if size_bytes > max_bytes:
        raise ValueError(f"File is too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB} MB.")

    return UserFile.objects.create(
        owner=owner,
        storage_key=f"uploads/{owner.id}/{uuid.uuid4().hex}-{original_name}",
        original_name=original_name,
        mime_type=getattr(uploaded_file, "content_type", "") or "",
        size_bytes=size_bytes,
        content=content,
        checksum=hashlib.sha256(content).hexdigest(),
        file_type=file_type,
        visibility=visibility,
    )


def user_can_access_file(user, user_file):
    if user_file.visibility == "public":
        return True

    material_links = CompetitionMaterial.objects.filter(file=user_file).select_related("competition")
    if material_links.filter(competition__is_public=True).exists():
        return True

    if not user.is_authenticated:
        return False
    if user_file.owner_id == user.id or user_is_admin(user):
        return True
    return material_links.filter(competition__participant_entries__user=user).exists()


class UserFileDownloadView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        user_file = get_object_or_404(UserFile, pk=pk)
        if not user_can_access_file(request.user, user_file):
            return Response({"detail": "You cannot access this file."}, status=status.HTTP_403_FORBIDDEN)
        if user_file.content is None:
            return Response({"detail": "File content is not available."}, status=status.HTTP_404_NOT_FOUND)

        content_type = user_file.mime_type or "application/octet-stream"
        response = HttpResponse(bytes(user_file.content), content_type=content_type)
        filename = normalize_upload_name(user_file.original_name).replace('"', "")
        disposition = "inline" if content_type.startswith("image/") else "attachment"
        response["Content-Disposition"] = f'{disposition}; filename="{filename}"'
        response["Content-Length"] = str(user_file.size_bytes)
        return response


class CompetitionDraftListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Competition.objects.filter(
            participant_entries__user=request.user,
            participant_entries__role="organizer",
            status="draft",
        ).distinct().order_by("-updated_at")
        return Response(CompetitionBuilderSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        if not user_can_create_competitions(request.user):
            return Response(
                {"detail": "Only organizers or administrators can create competitions."},
                status=status.HTTP_403_FORBIDDEN,
            )
        data = normalize_builder_payload(request.data)
        data.setdefault("name", "Untitled competition")
        if data.get("name") == "Untitled competition":
            existing = Competition.objects.filter(
                participant_entries__user=request.user,
                participant_entries__role="organizer",
                status="draft",
                name="Untitled competition",
            ).distinct().order_by("-updated_at").first()
            if existing and not existing.short_description and not existing.full_description:
                return Response(
                    CompetitionBuilderSerializer(existing, context={"request": request}).data,
                    status=status.HTTP_200_OK,
                )
        data.setdefault("status", "draft")
        data.setdefault("event_type", "online")
        data.setdefault("participation_type", "individual")
        data.setdefault("industry", "programming")
        data.setdefault("difficulty", "mixed")
        data.setdefault("language", "uk")
        data.setdefault("access_mode", "application")
        data.setdefault("visibility_mode", "public")
        data.setdefault("is_public", data.get("visibility_mode") == "public")
        data.setdefault("show_in_catalog", data.get("visibility_mode") == "public")
        auto_approved = user_is_admin(request.user) or get_platform_setting(AUTO_APPROVE_ORGANIZER_SETTING, False)
        serializer = CompetitionBuilderSerializer(data=data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            competition = serializer.save()
            if auto_approved:
                competition.organizer_approval_status = "approved"
                competition.organizer_approved_by = request.user if user_is_admin(request.user) else None
                competition.organizer_approved_at = timezone.now()
                competition.save(update_fields=["organizer_approval_status", "organizer_approved_by", "organizer_approved_at", "updated_at"])
            ensure_organizer_membership(request.user, competition)
        return Response(CompetitionBuilderSerializer(competition, context={"request": request}).data, status=status.HTTP_201_CREATED)


class CompetitionBuilderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        if not user_can_edit_competition(request.user, competition):
            return Response({"detail": "You cannot edit this competition."}, status=status.HTTP_403_FORBIDDEN)
        return Response(CompetitionBuilderSerializer(competition, context={"request": request}).data)

    def patch(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        if not user_can_edit_competition(request.user, competition):
            return Response({"detail": "You cannot edit this competition."}, status=status.HTTP_403_FORBIDDEN)
        serializer = CompetitionBuilderSerializer(competition, data=normalize_builder_payload(request.data), partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            competition = serializer.save()
            ensure_organizer_membership(request.user, competition)
            recompute_competition_timing(competition, save=True)
        return Response(CompetitionBuilderSerializer(competition, context={"request": request}).data)


class CompetitionPublishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        if not user_can_edit_competition(request.user, competition):
            return Response({"detail": "You cannot publish this competition."}, status=status.HTTP_403_FORBIDDEN)
        if not user_is_admin(request.user) and competition.organizer_approval_status == "rejected":
            return Response(
                {
                    "detail": "This competition was rejected by an administrator and cannot be published until it is reviewed again.",
                    "organizer_approval_status": competition.organizer_approval_status,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        missing = []
        for field in ["name", "short_description", "industry", "participation_type", "access_mode", "ends_at"]:
            if not getattr(competition, field):
                missing.append(field)
        if missing:
            return Response({"detail": "Competition is not ready for publication.", "missing": missing}, status=status.HTTP_400_BAD_REQUEST)

        published_at = timezone.now()
        if not competition.starts_at:
            competition.starts_at = published_at
        if not competition.judging_starts_at:
            competition.judging_starts_at = competition.starts_at
        if not competition.judging_ends_at:
            competition.judging_ends_at = competition.ends_at

        if competition.ends_at and competition.ends_at <= competition.starts_at:
            return Response({
                "detail": "Competition end must be later than competition start.",
                "errors": {"ends_at": "Competition end must be later than the publish/start time."},
            }, status=status.HTTP_400_BAD_REQUEST)

        rounds = list(competition.rounds.all().order_by("sort_order", "id"))
        previous_end = None
        round_errors = []
        for index, round_obj in enumerate(rounds):
            if not round_obj.starts_at:
                round_obj.starts_at = competition.starts_at if previous_end is None else previous_end + timedelta(seconds=1)
            if not round_obj.ends_at:
                round_errors.append({"index": index, "ends_at": "Round end time is required."})
                continue
            if round_obj.starts_at < competition.starts_at:
                round_errors.append({"index": index, "starts_at": "Round cannot start before the competition starts."})
            if competition.ends_at and round_obj.ends_at > competition.ends_at:
                round_errors.append({"index": index, "ends_at": "Round cannot end after the competition ends."})
            if round_obj.ends_at <= round_obj.starts_at:
                round_errors.append({"index": index, "ends_at": "Round end must be later than round start."})
            if previous_end and round_obj.starts_at <= previous_end:
                round_errors.append({"index": index, "starts_at": "Next round must start after the previous round ends."})
            if previous_end and round_obj.ends_at <= previous_end:
                round_errors.append({"index": index, "ends_at": "Next round must end after the previous round ends."})
            previous_end = round_obj.ends_at

        if round_errors:
            return Response({
                "detail": "Competition rounds are not valid.",
                "errors": {"rounds": round_errors},
            }, status=status.HTTP_400_BAD_REQUEST)

        for round_obj in rounds:
            round_obj.save(update_fields=["starts_at", "updated_at"] if hasattr(round_obj, "updated_at") else ["starts_at"])

        # A published draft must leave the draft state before timing is recomputed.
        # recompute_competition_timing() intentionally skips draft/archived items,
        # so keeping status="draft" here made newly published competitions invisible
        # in the public catalog and detail routes.
        competition.status = "upcoming"
        competition.is_public = competition.visibility_mode == "public"
        competition.show_in_catalog = competition.visibility_mode == "public" and competition.show_in_catalog
        competition.publish_ready = True
        competition.completion_percent = 100
        competition.save(update_fields=["starts_at", "judging_starts_at", "judging_ends_at", "status", "is_public", "show_in_catalog", "publish_ready", "completion_percent", "updated_at"])
        recompute_competition_timing(competition, save=True)
        return Response(CompetitionBuilderSerializer(competition, context={"request": request}).data)


class CompetitionOrganizerApprovalView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not user_is_admin(request.user):
            return Response(
                {"detail": "Only administrators can approve organizer competition requests."},
                status=status.HTTP_403_FORBIDDEN,
            )

        competition = get_object_or_404(Competition, pk=pk)
        decision = (request.data.get("decision") or request.data.get("status") or "").strip().lower()
        if decision not in {"approved", "rejected"}:
            return Response(
                {"detail": "Decision must be approved or rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        competition.organizer_approval_status = decision
        competition.organizer_approved_by = request.user
        competition.organizer_approved_at = timezone.now()
        if decision == "rejected":
            competition.publish_ready = False
        competition.save(update_fields=[
            "organizer_approval_status",
            "organizer_approved_by",
            "organizer_approved_at",
            "publish_ready",
            "updated_at",
        ])
        return Response(CompetitionBuilderSerializer(competition, context={"request": request}).data)


class CompetitionJudgeAssignmentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        if not user_can_edit_competition(request.user, competition):
            return Response({"detail": "You cannot view jury assignments for this competition."}, status=status.HTTP_403_FORBIDDEN)

        judges = CompetitionParticipant.objects.filter(
            competition=competition,
            role="judge",
        ).select_related("user", "team")
        return Response(CompetitionParticipantSerializer(judges, many=True).data)

    def post(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        if not user_can_edit_competition(request.user, competition):
            return Response({"detail": "You cannot assign jury members for this competition."}, status=status.HTTP_403_FORBIDDEN)

        User = get_user_model()
        email = (request.data.get("email") or "").strip()
        username = (request.data.get("username") or "").strip()
        display_name = (request.data.get("display_name") or request.data.get("displayName") or "").strip()

        if not (email or username):
            return Response({"detail": "Judge email or username is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not username:
            username = email.split("@")[0].replace(".", "_").replace("+", "_")

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "first_name": display_name or username,
            },
        )
        changed = False
        if email and getattr(user, "email", "") != email:
            user.email = email
            changed = True
        if display_name and not user.get_full_name():
            user.first_name = display_name
            changed = True
        if created:
            user.set_unusable_password()
            changed = True
        if changed:
            user.save()

        if user_has_participation_for_judge_conflict(user, competition):
            return Response(
                {"detail": "Participants and team members cannot be assigned as judges in the same competition."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile = get_or_create_profile(user, {"primary_role": "participant"})
        if not profile.display_name and display_name:
            profile.display_name = display_name
            profile.save(update_fields=["display_name", "updated_at"])

        participant, _ = CompetitionParticipant.objects.update_or_create(
            competition=competition,
            user=user,
            defaults={
                "display_name": display_name or user.get_full_name() or user.get_username(),
                "role": "judge",
                "status": "approved",
                "team": None,
                "is_active_now": False,
            },
        )
        CompetitionJudgeAssignment.objects.get_or_create(
            competition=competition,
            round=None,
            judge=user,
            assignment_type="manual",
            defaults={
                "status": "invited",
                "invited_by": request.user,
            },
        )
        return Response(CompetitionParticipantSerializer(participant).data, status=status.HTTP_201_CREATED)


class CompetitionJudgeAssignmentResponseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        assignment = get_object_or_404(
            CompetitionJudgeAssignment.objects.select_related("competition", "round", "judge"),
            pk=pk,
            judge=request.user,
        )
        decision = (request.data.get("decision") or request.data.get("status") or "").strip().lower()
        if decision not in {"accepted", "declined"}:
            return Response({"detail": "Decision must be accepted or declined."}, status=status.HTTP_400_BAD_REQUEST)

        if decision == "accepted" and user_has_participation_for_judge_conflict(request.user, assignment.competition):
            return Response(
                {"detail": "Participants and team members cannot judge the same competition."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment.status = decision
        assignment.save(update_fields=["status", "updated_at"])

        membership = CompetitionParticipant.objects.filter(
            competition=assignment.competition,
            user=request.user,
            role="judge",
        ).first()
        if membership:
            membership.status = "approved" if decision == "accepted" else "withdrawn"
            membership.save(update_fields=["status"])

        return Response({
            "assignment": CompetitionJudgeAssignmentSerializer(assignment).data,
            "judge_workspace": build_judge_workspace(assignment.competition, request),
        })


class CompetitionMaterialUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        if not user_can_edit_competition(request.user, competition):
            return Response({"detail": "You cannot view materials for this competition."}, status=status.HTTP_403_FORBIDDEN)
        return Response(CompetitionMaterialSerializer(competition.materials.all(), many=True, context={"request": request}).data)

    def post(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        if not user_can_edit_competition(request.user, competition):
            return Response({"detail": "You cannot upload materials for this competition."}, status=status.HTTP_403_FORBIDDEN)

        uploaded_file = request.FILES.get("file")
        material_url = (request.data.get("url") or "").strip()
        if not uploaded_file and not material_url:
            return Response({"detail": "File or URL is required."}, status=status.HTTP_400_BAD_REQUEST)

        name = (request.data.get("name") or "").strip()
        material_type = (request.data.get("material_type") or request.data.get("materialType") or "other").strip()
        valid_types = {choice[0] for choice in CompetitionMaterial.MATERIAL_TYPE_CHOICES}
        if material_type not in valid_types:
            material_type = "other"

        sort_order = request.data.get("sort_order") or request.data.get("sortOrder") or competition.materials.count()
        sort_order = int(sort_order) if str(sort_order).isdigit() else competition.materials.count()

        user_file = None
        if uploaded_file:
            try:
                user_file = create_uploaded_user_file(
                    request.user,
                    uploaded_file,
                    file_type="competition_attachment",
                    visibility="competition_only",
                )
            except ValueError as error:
                return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        material = CompetitionMaterial.objects.create(
            competition=competition,
            name=name or (user_file.original_name if user_file else material_url),
            material_type=material_type,
            url="" if user_file else material_url,
            file=user_file,
            sort_order=sort_order,
        )
        return Response(CompetitionMaterialSerializer(material, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def delete(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        if not user_can_edit_competition(request.user, competition):
            return Response({"detail": "You cannot delete materials for this competition."}, status=status.HTTP_403_FORBIDDEN)
        material_id = request.data.get("id") or request.query_params.get("id")
        material = get_object_or_404(CompetitionMaterial, pk=material_id, competition=competition)
        linked_file = material.file
        material.delete()
        if linked_file and not linked_file.competition_materials.exists():
            linked_file.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CompetitionInvitationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        if not user_can_edit_competition(request.user, competition):
            return Response({"detail": "You cannot view invitations for this competition."}, status=status.HTTP_403_FORBIDDEN)
        invitations = competition.invitations.all()[:100]
        return Response(CompetitionInvitationSerializer(invitations, many=True).data)

    def post(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        recipients = request.data.get("recipients") or []
        if isinstance(recipients, str):
            recipients = [line.strip() for line in recipients.replace(",", "\n").splitlines() if line.strip()]
        target_type = request.data.get("target_type") or "individual"
        team_name = (request.data.get("team_name") or "").strip()
        message = request.data.get("message") or ""
        queue_messages = request_bool(request.data.get("queue_messages"), True)

        can_invite = user_can_edit_competition(request.user, competition)
        if not can_invite and target_type == "team" and team_name:
            can_invite = CompetitionTeam.objects.filter(
                competition=competition,
                name=team_name,
                captain=request.user,
            ).exists()
        if not can_invite:
            return Response({"detail": "You cannot invite users to this competition."}, status=status.HTTP_403_FORBIDDEN)

        created = []
        for email in recipients:
            token = secrets.token_urlsafe(32)
            invitation, _ = CompetitionInvitation.objects.update_or_create(
                competition=competition,
                email=email,
                target_type=target_type,
                team_name=team_name if target_type == "team" else "",
                defaults={
                    "invited_by": request.user,
                    "token": token,
                    "status": "queued" if queue_messages else "draft",
                    "message": message,
                },
            )
            created.append(invitation)
            if queue_messages:
                accept_path = f"/competitions/{competition.id}?invite={invitation.token}"
                OutboundMessage.objects.create(
                    competition=competition,
                    invitation=invitation,
                    recipient_email=email,
                    channel="email",
                    subject=f"Invitation: {competition.name}",
                    body=(message or f"You are invited to join {competition.name}.") + f"\n\nInvitation link: {accept_path}",
                    status="queued",
                    queued_at=timezone.now(),
                )
        return Response(CompetitionInvitationSerializer(created, many=True).data, status=status.HTTP_201_CREATED)


class CompetitionInvitationResponseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, token):
        invitation = get_object_or_404(
            CompetitionInvitation.objects.select_related("competition", "invited_by"),
            token=token,
        )
        decision = (request.data.get("decision") or request.data.get("status") or "").strip().lower()
        if decision not in {"accepted", "declined"}:
            return Response({"detail": "Decision must be accepted or declined."}, status=status.HTTP_400_BAD_REQUEST)
        if invitation.expires_at and timezone.now() > invitation.expires_at:
            invitation.status = "expired"
            invitation.responded_at = timezone.now()
            invitation.save(update_fields=["status", "responded_at"])
            return Response({"detail": "This invitation has expired."}, status=status.HTTP_400_BAD_REQUEST)
        if normalize_email(request.user.email) != normalize_email(invitation.email):
            return Response({"detail": "This invitation was sent to another email address."}, status=status.HTTP_403_FORBIDDEN)

        if decision == "declined":
            invitation.status = "declined"
            invitation.responded_at = timezone.now()
            invitation.save(update_fields=["status", "responded_at"])
            return Response(CompetitionInvitationSerializer(invitation).data)

        competition = invitation.competition
        if user_is_competition_judge(request.user, competition):
            return Response({"detail": "Judges cannot join teams in the same competition."}, status=status.HTTP_400_BAD_REQUEST)

        role = "team_member" if invitation.target_type == "team" else "participant"
        team = None
        if invitation.target_type == "team":
            if not invitation.team_name:
                return Response({"detail": "Team invitation is missing a team name."}, status=status.HTTP_400_BAD_REQUEST)
            team = CompetitionTeam.objects.filter(competition=competition, name=invitation.team_name).first()
            if not team:
                return Response({"detail": "The invited team no longer exists."}, status=status.HTTP_400_BAD_REQUEST)
            if user_has_active_team_conflict(request.user, competition, team=team):
                return Response({"detail": "You already belong to another team in this competition."}, status=status.HTTP_400_BAD_REQUEST)
        elif user_has_active_team_conflict(request.user, competition):
            return Response({"detail": "You already have an active participation record for this competition."}, status=status.HTTP_400_BAD_REQUEST)

        invitation.status = "accepted"
        invitation.responded_at = timezone.now()
        invitation.save(update_fields=["status", "responded_at"])

        status_value = "approved" if not team or team.status == "approved" else "pending"
        display_name = request.user.get_full_name() or request.user.get_username() or request.user.email
        participant, _ = CompetitionParticipant.objects.update_or_create(
            competition=competition,
            user=request.user,
            defaults={
                "display_name": display_name,
                "role": role,
                "status": status_value,
                "team": team,
                "is_active_now": False,
            },
        )
        CompetitionJoinRequest.objects.update_or_create(
            competition=competition,
            user=request.user,
            role=role,
            defaults={
                "status": status_value,
                "team": team,
                "team_name": team.name if team else "",
                "message": invitation.message,
                "reviewed_by": invitation.invited_by,
                "reviewed_at": timezone.now() if status_value == "approved" else None,
            },
        )
        competition.participants_count = CompetitionParticipant.objects.filter(
            competition=competition,
            status="approved",
            role__in=["participant", "team_member"],
        ).count()
        competition.save(update_fields=["participants_count"])
        return Response({
            "invitation": CompetitionInvitationSerializer(invitation).data,
            "participant": CompetitionParticipantSerializer(participant).data,
            "team": CompetitionTeamSerializer(team).data if team else None,
        })


class CompetitionOutboundMessagesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk)
        if not user_can_edit_competition(request.user, competition):
            return Response({"detail": "You cannot view messages for this competition."}, status=status.HTTP_403_FORBIDDEN)
        messages = competition.outbound_messages.all()[:100]
        return Response(OutboundMessageSerializer(messages, many=True).data)


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

        criteria = competition.judging_criteria.all().order_by("sort_order", "id")
        configured_modes = sorted({criterion.judging_mode for criterion in criteria})
        if not configured_modes:
            configured_modes = [
                mode for mode, enabled in [
                    ("automatic", competition.automatic_judging_enabled),
                    ("manual", competition.manual_judging_enabled),
                    ("peer_review", competition.peer_review_enabled),
                ] if enabled
            ]
        mode = ", ".join(configured_modes) if configured_modes else (metrics[0].mode if metrics else "not configured")

        can_view_judging_materials = False
        if request.user.is_authenticated and user_can_edit_competition(request.user, competition):
            can_view_judging_materials = True
            assignments = CompetitionJudgeAssignment.objects.filter(competition=competition).select_related("round", "judge")
        else:
            assignments = CompetitionJudgeAssignment.objects.none()
            if request.user.is_authenticated and judging_window_open(competition) and user_allowed_review_types(request.user, competition):
                can_view_judging_materials = True

        submissions_queryset = CompetitionSubmission.objects.none()
        if can_view_judging_materials:
            submissions_queryset = CompetitionSubmission.objects.filter(
                competition=competition,
                status__in=["accepted", "locked"],
            ).select_related("round", "participant", "team", "submitted_by", "file")

        return Response({
            "mode": mode,
            "review_modes": {
                "automatic": competition.automatic_judging_enabled,
                "manual": competition.manual_judging_enabled,
                "peer_review": competition.peer_review_enabled,
                "aggregation": competition.judging_aggregation,
                "visibility": competition.judging_visibility,
                "results_frozen": competition.results_frozen,
            },
            "criteria": CompetitionJudgingCriterionSerializer(criteria, many=True).data,
            "submissions": CompetitionSubmissionSerializer(
                submissions_queryset,
                many=True,
                context={"request": request},
            ).data,
            "my_submissions": CompetitionSubmissionSerializer(
                user_submission_queryset(request.user, competition).select_related("round", "participant", "team", "submitted_by", "file") if request.user.is_authenticated else CompetitionSubmission.objects.none(),
                many=True,
                context={"request": request},
            ).data,
            "round_scores": build_round_score_tables(competition, request),
            "judge_workspace": build_judge_workspace(competition, request),
            "assignments": CompetitionJudgeAssignmentSerializer(assignments, many=True).data,
            "metrics": CompetitionJudgingMetricSerializer(
                metrics,
                many=True,
            ).data,
        })

    def post(self, request, pk):
        competition = get_object_or_404(Competition, pk=pk, is_public=True)
        recompute_competition_timing(competition, save=True)
        if competition.results_frozen:
            return Response({"detail": "Results are frozen for this competition."}, status=status.HTTP_400_BAD_REQUEST)

        allowed_review_types = user_allowed_review_types(request.user, competition)
        review_type = (request.data.get("review_type") or request.data.get("reviewType") or (allowed_review_types[0] if allowed_review_types else "")).strip()
        if review_type not in allowed_review_types:
            return Response({"detail": "You are not allowed to submit this type of score."}, status=status.HTTP_403_FORBIDDEN)

        round_obj = get_object_or_404(CompetitionRound, pk=request.data.get("round") or request.data.get("round_id"), competition=competition)
        if not judging_window_open(competition) and not user_can_edit_competition(request.user, competition):
            return Response({"detail": "Judging is not open for this competition."}, status=status.HTTP_400_BAD_REQUEST)
        if review_type == "manual" and not user_can_edit_competition(request.user, competition) and not judge_has_accepted_assignment(request.user, competition, round_obj):
            return Response({"detail": "You must accept the judge invitation before scoring this round."}, status=status.HTTP_403_FORBIDDEN)
        criterion = get_object_or_404(
            CompetitionJudgingCriterion,
            pk=request.data.get("criterion") or request.data.get("criterion_id"),
            competition=competition,
        )
        if not criterion_allows_review_type(criterion, review_type):
            return Response({"detail": "This criterion cannot be evaluated with the selected review type."}, status=status.HTTP_400_BAD_REQUEST)

        if round_obj.status not in ["active", "closed", "judged"]:
            return Response({"detail": "Works can be scored only while the round is active or after it is closed."}, status=status.HTTP_400_BAD_REQUEST)

        raw_score = request.data.get("score")
        try:
            score_value = Decimal(str(raw_score))
        except (InvalidOperation, TypeError, ValueError):
            return Response({"detail": "Score must be a number."}, status=status.HTTP_400_BAD_REQUEST)
        if score_value < 0 or score_value > Decimal(str(criterion.max_score)):
            return Response({"detail": f"Score must be between 0 and {criterion.max_score}."}, status=status.HTTP_400_BAD_REQUEST)

        subject_id = (request.data.get("subject_id") or request.data.get("subjectId") or "").strip()
        participant_id = request.data.get("subject_participant") or request.data.get("participant_id")
        team_id = request.data.get("subject_team") or request.data.get("team_id")
        submission_id = request.data.get("submission") or request.data.get("submission_id")
        if subject_id.startswith("submission-"):
            submission_id = subject_id.replace("submission-", "", 1)
        elif subject_id.startswith("participant-"):
            participant_id = subject_id.replace("participant-", "", 1)
        elif subject_id.startswith("team-"):
            team_id = subject_id.replace("team-", "", 1)

        participant = None
        team = None
        submission = None
        if submission_id:
            submission = get_object_or_404(
                CompetitionSubmission.objects.select_related("participant", "team"),
                pk=submission_id,
                competition=competition,
                round=round_obj,
                status__in=["accepted", "locked"],
            )
            participant = submission.participant
            team = submission.team
            if participant_id and submission.participant_id and str(participant_id) != str(submission.participant_id):
                return Response({"detail": "Submission does not belong to the selected participant."}, status=status.HTTP_400_BAD_REQUEST)
            if team_id and submission.team_id and str(team_id) != str(submission.team_id):
                return Response({"detail": "Submission does not belong to the selected team."}, status=status.HTTP_400_BAD_REQUEST)
        elif team_id:
            team = get_object_or_404(CompetitionTeam, pk=team_id, competition=competition)
        elif participant_id:
            participant = get_object_or_404(
                CompetitionParticipant,
                pk=participant_id,
                competition=competition,
                status="approved",
                role__in=["participant", "team_member"],
            )
        else:
            return Response({"detail": "Score subject is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not submission:
            submission = latest_scoreable_submission(competition, round_obj, participant=participant, team=team)
            if submission:
                participant = submission.participant
                team = submission.team
            else:
                return Response({"detail": "Selected work has no accepted submission for this round."}, status=status.HTTP_400_BAD_REQUEST)

        membership = user_competition_membership(request.user, competition)
        if review_type == "peer_review" and membership:
            if participant and participant.id == membership.id:
                return Response({"detail": "Participants cannot peer-review their own work."}, status=status.HTTP_400_BAD_REQUEST)
            if team and membership.team_id == team.id:
                return Response({"detail": "Team members cannot peer-review their own team."}, status=status.HTTP_400_BAD_REQUEST)

        lookup = {
            "competition": competition,
            "round": round_obj,
            "criterion": criterion,
            "judge": request.user,
            "review_type": review_type,
            "submission": submission,
            "subject_participant": participant,
            "subject_team": team,
        }
        created_score = False
        try:
            with transaction.atomic():
                if submission:
                    legacy_lookup = {
                        "competition": competition,
                        "round": round_obj,
                        "criterion": criterion,
                        "judge": request.user,
                        "review_type": review_type,
                        "submission__isnull": True,
                        "subject_participant": participant,
                        "subject_team": team,
                    }
                    CompetitionScore.objects.filter(**legacy_lookup).update(submission=submission)
                score_obj, created_score = CompetitionScore.objects.update_or_create(
                    **lookup,
                    defaults={
                        "score": score_value,
                        "comment": (request.data.get("comment") or "").strip(),
                        "is_final": bool(request.data.get("is_final", request.data.get("finalized", False))),
                    },
                )
        except IntegrityError:
            score_obj = CompetitionScore.objects.get(**lookup)
            score_obj.score = score_value
            score_obj.comment = (request.data.get("comment") or "").strip()
            score_obj.is_final = bool(request.data.get("is_final", request.data.get("finalized", False)))
            score_obj.save(update_fields=["score", "comment", "is_final", "updated_at"])

        if review_type == "manual":
            CompetitionJudgeAssignment.objects.update_or_create(
                competition=competition,
                round=round_obj,
                judge=request.user,
                assignment_type="manual",
                defaults={"status": "completed" if score_obj.is_final else "accepted"},
            )

        round_scores = build_round_score_tables(competition, request)
        return Response({
            "score": CompetitionScoreSerializer(score_obj, context={"request": request}).data,
            "round_scores": round_scores,
            "leaderboard": build_live_leaderboard(competition, request, tables=round_scores),
            "judge_workspace": build_judge_workspace(competition, request),
        }, status=status.HTTP_201_CREATED if created_score else status.HTTP_200_OK)


class CompetitionScoreDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        score_obj = get_object_or_404(
            CompetitionScore.objects.select_related("competition", "round", "judge"),
            pk=pk,
        )
        if score_obj.competition.results_frozen:
            return Response({"detail": "Results are frozen for this competition."}, status=status.HTTP_400_BAD_REQUEST)
        if score_obj.judge_id != request.user.id and not user_can_edit_competition(request.user, score_obj.competition):
            return Response({"detail": "You can delete only your own score."}, status=status.HTTP_403_FORBIDDEN)
        if not judging_window_open(score_obj.competition) and not user_can_edit_competition(request.user, score_obj.competition):
            return Response({"detail": "Judging deadline has passed for this competition."}, status=status.HTTP_400_BAD_REQUEST)
        competition = score_obj.competition
        score_obj.delete()
        round_scores = build_round_score_tables(competition, request)
        return Response({
            "round_scores": round_scores,
            "leaderboard": build_live_leaderboard(competition, request, tables=round_scores),
            "judge_workspace": build_judge_workspace(competition, request),
        })
