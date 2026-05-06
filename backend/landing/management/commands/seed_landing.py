from datetime import timedelta
import io
import random
import zipfile

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils.text import slugify
from django.utils import timezone

from landing.models import (
    Badge,
    Certificate,
    Competition,
    CompetitionJoinRequest,
    CompetitionMaterial,
    CompetitionParticipant,
    CompetitionRound,
    CompetitionTeam,
    RecentlyViewedCompetition,
    RecentlyViewedMaterial,
    UserBadge,
    UserFile,
    UserProfile,
    UserSavedCompetition,
)

User = get_user_model()


DEMO_PASSWORD = "demo12345"


def _pdf_escape(value):
    return str(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_demo_pdf(title, lines):
    text_lines = [title, *lines]
    commands = ["BT", "/F1 14 Tf", "72 760 Td"]
    for index, line in enumerate(text_lines):
        if index:
            commands.append("0 -22 Td")
        commands.append(f"({_pdf_escape(line)}) Tj")
    commands.append("ET")
    stream = "\n".join(commands).encode("utf-8")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    content = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(content))
        content.extend(f"{index} 0 obj\n".encode("ascii"))
        content.extend(obj)
        content.extend(b"\nendobj\n")
    xref_offset = len(content)
    content.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    content.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        content.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    content.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("ascii")
    )
    return bytes(content)


def build_demo_zip(competition):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as package:
        package.writestr(
            "README.md",
            "\n".join([
                f"# Starter package for {competition.name}",
                "",
                "Use this package as a real downloadable baseline for submissions.",
                "It contains the expected structure, notes, and a submission template.",
            ]),
        )
        package.writestr(
            "submission-template.md",
            "\n".join([
                f"# {competition.name} submission",
                "",
                "Team or participant:",
                "Repository:",
                "Demo link:",
                "Notes:",
            ]),
        )
    return buffer.getvalue()

DEMO_ACCOUNTS = {
    "organizer": {
        "username": "demo_organizer",
        "email": "organizer@example.com",
        "first_name": "Demo",
        "last_name": "Organizer",
        "display_name": "Demo Organizer",
        "primary_role": "organizer",
        "organization": "Judgify Demo",
    },
    "participant": {
        "username": "demo_participant",
        "email": "participant@example.com",
        "first_name": "Demo",
        "last_name": "Participant",
        "display_name": "Demo Participant",
        "primary_role": "participant",
        "organization": "",
    },
    "viewer": {
        "username": "demo_viewer",
        "email": "viewer@example.com",
        "first_name": "Demo",
        "last_name": "Viewer",
        "display_name": "Demo Viewer",
        "primary_role": "viewer",
        "organization": "",
    },
    "admin": {
        "username": "demo_admin",
        "email": "admin@example.com",
        "first_name": "Demo",
        "last_name": "Admin",
        "display_name": "Demo Admin",
        "primary_role": "admin",
        "organization": "Judgify Platform",
    },
}

FAKE_PARTICIPANTS = [
    ("anna_koval", "anna.koval@example.com", "Anna Koval"),
    ("bohdan_sydor", "bohdan.sydor@example.com", "Bohdan Sydor"),
    ("daria_melnyk", "daria.melnyk@example.com", "Daria Melnyk"),
    ("maksym_honchar", "maksym.honchar@example.com", "Maksym Honchar"),
    ("olena_kravets", "olena.kravets@example.com", "Olena Kravets"),
    ("roman_savchuk", "roman.savchuk@example.com", "Roman Savchuk"),
    ("sofia_bondar", "sofia.bondar@example.com", "Sofia Bondar"),
    ("taras_lysenko", "taras.lysenko@example.com", "Taras Lysenko"),
    ("viktoria_shevchenko", "viktoria.shevchenko@example.com", "Viktoria Shevchenko"),
    ("yaroslav_tkach", "yaroslav.tkach@example.com", "Yaroslav Tkach"),
]


class Command(BaseCommand):
    help = "Seed Judgify demo data with coherent users, teams, pending queues, awards and dynamic rounds."

    def handle(self, *args, **kwargs):
        now = timezone.now()

        demo_users = self._ensure_demo_users()
        fake_users = self._ensure_fake_participants()
        self._cleanup_generated_demo_awards(list(demo_users.values()) + [user for user, _ in fake_users])

        # Dev seed intentionally resets demo competitions because their dates/rounds must be recalculated
        # after every container restart.
        Competition.objects.all().delete()

        competitions = self._create_competitions(now)
        self._assign_all_competitions_to_demo_organizer(competitions, demo_users["organizer"])
        self._create_admin_pending_proposal(now)
        self._create_rounds_and_schedule(competitions, now)
        self._create_materials(competitions, demo_users["organizer"])
        self._create_saved_and_recent(competitions, demo_users["participant"], demo_users["viewer"])
        self._create_team_memberships_and_pending_requests(competitions, demo_users, fake_users)
        self._refresh_competition_counters(competitions)
        self._create_awards_and_certificates(competitions, demo_users, fake_users)

        self.stdout.write(self.style.SUCCESS("Judgify demo seed data created successfully."))

    def _ensure_demo_users(self):
        users = {}
        for key, data in DEMO_ACCOUNTS.items():
            user, _ = User.objects.get_or_create(
                username=data["username"],
                defaults={
                    "email": data["email"],
                    "first_name": data["first_name"],
                    "last_name": data["last_name"],
                },
            )
            user.email = data["email"]
            user.first_name = data["first_name"]
            user.last_name = data["last_name"]
            if key == "admin":
                user.is_staff = True
            user.set_password(DEMO_PASSWORD)
            user.save()

            UserProfile.objects.update_or_create(
                user=user,
                defaults={
                    "display_name": data["display_name"],
                    "primary_role": data["primary_role"],
                    "organization": data.get("organization", ""),
                    "country": "Ukraine",
                },
            )
            users[key] = user
        return users

    def _ensure_fake_participants(self):
        fake_users = []
        for username, email, full_name in FAKE_PARTICIPANTS:
            first, *last = full_name.split(" ")
            user, _ = User.objects.get_or_create(
                username=username,
                defaults={"email": email, "first_name": first, "last_name": " ".join(last)},
            )
            user.email = email
            user.first_name = first
            user.last_name = " ".join(last)
            user.set_password(DEMO_PASSWORD)
            user.save()
            UserProfile.objects.update_or_create(
                user=user,
                defaults={"display_name": full_name, "primary_role": "participant", "country": "Ukraine"},
            )
            fake_users.append((user, full_name))
        return fake_users

    def _cleanup_generated_demo_awards(self, users):
        usernames = [user.username for user in users]
        Certificate.objects.filter(user__username__in=usernames).delete()
        UserBadge.objects.filter(user__username__in=usernames).delete()
        UserFile.objects.filter(owner__username__in=usernames, storage_key__startswith="demo/certificates/").delete()

    def _create_competitions(self, now, upsert=False):
        data = [
            {
                "name": "AI Battle 2026",
                "short_description": "Machine learning competition for student teams",
                "cover_image": "https://picsum.photos/seed/ai-battle/900/500",
                "banner_image": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&auto=format&fit=crop",
                "status": "active",
                "event_type": "online",
                "participation_type": "team",
                "industry": "programming",
                "difficulty": "mixed",
                "language": "en",
                "total_rounds": 4,
                "comments_count": 200,
                "views_count": 1300,
                "followers_count": 320,
                "registration_open": False,
                "submissions_open": True,
                "is_live_stream_enabled": True,
                "is_online_now": True,
            },
            {
                "name": "Design Systems Sprint",
                "short_description": "Extended active UI challenge for frontend testing",
                "cover_image": "https://picsum.photos/seed/design-systems-sprint/900/500",
                "banner_image": "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1600&auto=format&fit=crop",
                "status": "active",
                "event_type": "hybrid",
                "participation_type": "team",
                "industry": "design",
                "difficulty": "intermediate",
                "language": "uk",
                "total_rounds": 3,
                "comments_count": 48,
                "views_count": 720,
                "followers_count": 150,
                "registration_open": False,
                "submissions_open": True,
                "is_live_stream_enabled": True,
                "is_online_now": True,
            },
            {
                "name": "Cyber Cup Open Registration",
                "short_description": "Cybersecurity event with open registration for Pending tests",
                "cover_image": "https://picsum.photos/seed/cyber-cup/900/500",
                "banner_image": "https://images.unsplash.com/photo-1526378722484-bd91ca387e72?w=1600&auto=format&fit=crop",
                "status": "registration_open",
                "event_type": "online",
                "participation_type": "team",
                "industry": "cybersecurity",
                "difficulty": "mixed",
                "language": "uk",
                "total_rounds": 4,
                "comments_count": 61,
                "views_count": 980,
                "followers_count": 205,
                "registration_open": True,
                "submissions_open": False,
                "is_live_stream_enabled": False,
                "is_online_now": False,
            },
            {
                "name": "Web UI Registration Lab",
                "short_description": "Open individual registration demo for onboarding tests",
                "cover_image": "https://picsum.photos/seed/web-ui-registration/900/500",
                "banner_image": "https://images.unsplash.com/photo-1559028012-481c04fa702d?w=1600&auto=format&fit=crop",
                "status": "registration_open",
                "event_type": "online",
                "participation_type": "individual",
                "industry": "design",
                "difficulty": "beginner",
                "language": "uk",
                "total_rounds": 3,
                "comments_count": 12,
                "views_count": 180,
                "followers_count": 25,
                "registration_open": True,
                "submissions_open": False,
            },
            {
                "name": "Data Science Open Qualifier",
                "short_description": "Registration-open data analysis qualifier",
                "cover_image": "https://picsum.photos/seed/data-open-qualifier/900/500",
                "banner_image": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&auto=format&fit=crop",
                "status": "registration_open",
                "event_type": "online",
                "participation_type": "team",
                "industry": "programming",
                "difficulty": "intermediate",
                "language": "en",
                "total_rounds": 4,
                "comments_count": 19,
                "views_count": 240,
                "followers_count": 38,
                "registration_open": True,
                "submissions_open": False,
            },
            {
                "name": "Robotics Warm-up Registration",
                "short_description": "Open team registration before a robotics warm-up event",
                "cover_image": "https://picsum.photos/seed/robotics-registration/900/500",
                "banner_image": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1600&auto=format&fit=crop",
                "status": "registration_open",
                "event_type": "hybrid",
                "participation_type": "team",
                "industry": "robotics",
                "difficulty": "mixed",
                "language": "uk",
                "total_rounds": 3,
                "comments_count": 9,
                "views_count": 160,
                "followers_count": 21,
                "registration_open": True,
                "submissions_open": False,
            },
            {
                "name": "Future Robotics League",
                "short_description": "Upcoming robotics tournament",
                "cover_image": "https://picsum.photos/seed/future-robotics/900/500",
                "banner_image": "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1600&auto=format&fit=crop",
                "status": "upcoming",
                "event_type": "offline",
                "participation_type": "team",
                "industry": "robotics",
                "difficulty": "advanced",
                "language": "en",
                "total_rounds": 6,
                "comments_count": 15,
                "views_count": 420,
                "followers_count": 98,
            },
            {
                "name": "Prototype Finals Review",
                "short_description": "Judging stage for finalist projects",
                "cover_image": "https://picsum.photos/seed/prototype-finals/900/500",
                "banner_image": "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1600&auto=format&fit=crop",
                "status": "judging",
                "event_type": "hybrid",
                "participation_type": "team",
                "industry": "programming",
                "difficulty": "advanced",
                "language": "uk",
                "total_rounds": 5,
                "comments_count": 124,
                "views_count": 1110,
                "followers_count": 310,
            },
            {
                "name": "Mobile App Showdown",
                "short_description": "Competition recently finished",
                "cover_image": "https://picsum.photos/seed/mobile-showdown/900/500",
                "banner_image": "https://images.unsplash.com/photo-1526498460520-4c246339dccb?w=1600&auto=format&fit=crop",
                "status": "finished",
                "event_type": "online",
                "participation_type": "individual",
                "industry": "programming",
                "difficulty": "beginner",
                "language": "uk",
                "total_rounds": 4,
                "comments_count": 89,
                "views_count": 860,
                "followers_count": 170,
            },
            {
                "name": "Legacy Innovation Archive",
                "short_description": "Archived competition for reference",
                "cover_image": "https://picsum.photos/seed/legacy-archive/900/500",
                "banner_image": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1600&auto=format&fit=crop",
                "status": "archived",
                "event_type": "offline",
                "participation_type": "team",
                "industry": "design",
                "difficulty": "mixed",
                "language": "pl",
                "total_rounds": 6,
                "comments_count": 142,
                "views_count": 1650,
                "followers_count": 390,
            },
            {
                "name": "Cloud DevOps Arena",
                "short_description": "Active infrastructure automation challenge",
                "cover_image": "https://picsum.photos/seed/cloud-devops-arena/900/500",
                "banner_image": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&auto=format&fit=crop",
                "status": "active",
                "event_type": "online",
                "participation_type": "team",
                "industry": "programming",
                "difficulty": "advanced",
                "language": "en",
                "total_rounds": 4,
                "comments_count": 54,
                "views_count": 690,
                "followers_count": 118,
                "registration_open": False,
                "submissions_open": True,
                "is_online_now": True,
            },
            {
                "name": "No-Code Impact Jam",
                "short_description": "Active product challenge for civic tools",
                "cover_image": "https://picsum.photos/seed/no-code-impact-jam/900/500",
                "banner_image": "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1600&auto=format&fit=crop",
                "status": "active",
                "event_type": "hybrid",
                "participation_type": "mixed",
                "industry": "design",
                "difficulty": "beginner",
                "language": "uk",
                "total_rounds": 3,
                "comments_count": 33,
                "views_count": 510,
                "followers_count": 77,
                "registration_open": False,
                "submissions_open": True,
            },
            {
                "name": "Math Modeling League",
                "short_description": "Active applied modeling tournament",
                "cover_image": "https://picsum.photos/seed/math-modeling-league/900/500",
                "banner_image": "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1600&auto=format&fit=crop",
                "status": "active",
                "event_type": "online",
                "participation_type": "team",
                "industry": "programming",
                "difficulty": "mixed",
                "language": "en",
                "total_rounds": 5,
                "comments_count": 72,
                "views_count": 840,
                "followers_count": 166,
                "registration_open": False,
                "submissions_open": True,
            },
            {
                "name": "Data Viz Open Registration",
                "short_description": "Open registration for visual analytics teams",
                "cover_image": "https://picsum.photos/seed/data-viz-open-registration/900/500",
                "banner_image": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&auto=format&fit=crop",
                "status": "registration_open",
                "event_type": "online",
                "participation_type": "individual",
                "industry": "design",
                "difficulty": "intermediate",
                "language": "uk",
                "total_rounds": 3,
                "comments_count": 17,
                "views_count": 310,
                "followers_count": 46,
                "registration_open": True,
                "submissions_open": False,
            },
            {
                "name": "Embedded Systems Cup",
                "short_description": "Upcoming hardware and firmware contest",
                "cover_image": "https://picsum.photos/seed/embedded-systems-cup/900/500",
                "banner_image": "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=1600&auto=format&fit=crop",
                "status": "upcoming",
                "event_type": "offline",
                "participation_type": "team",
                "industry": "robotics",
                "difficulty": "advanced",
                "language": "en",
                "total_rounds": 4,
                "comments_count": 22,
                "views_count": 430,
                "followers_count": 88,
            },
            {
                "name": "UX Research Challenge",
                "short_description": "Upcoming research sprint for product teams",
                "cover_image": "https://picsum.photos/seed/ux-research-challenge/900/500",
                "banner_image": "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1600&auto=format&fit=crop",
                "status": "upcoming",
                "event_type": "hybrid",
                "participation_type": "team",
                "industry": "design",
                "difficulty": "intermediate",
                "language": "uk",
                "total_rounds": 3,
                "comments_count": 11,
                "views_count": 270,
                "followers_count": 52,
            },
            {
                "name": "Secure API Review",
                "short_description": "Judging stage for backend security submissions",
                "cover_image": "https://picsum.photos/seed/secure-api-review/900/500",
                "banner_image": "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=1600&auto=format&fit=crop",
                "status": "judging",
                "event_type": "online",
                "participation_type": "individual",
                "industry": "cybersecurity",
                "difficulty": "advanced",
                "language": "en",
                "total_rounds": 4,
                "comments_count": 95,
                "views_count": 940,
                "followers_count": 214,
            },
            {
                "name": "Robotics Pitch Review",
                "short_description": "Judging stage for robotics demos",
                "cover_image": "https://picsum.photos/seed/robotics-pitch-review/900/500",
                "banner_image": "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1600&auto=format&fit=crop",
                "status": "judging",
                "event_type": "hybrid",
                "participation_type": "team",
                "industry": "robotics",
                "difficulty": "mixed",
                "language": "uk",
                "total_rounds": 3,
                "comments_count": 64,
                "views_count": 730,
                "followers_count": 142,
            },
            {
                "name": "Accessibility Design Finals",
                "short_description": "Recently finished accessibility design contest",
                "cover_image": "https://picsum.photos/seed/accessibility-design-finals/900/500",
                "banner_image": "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1600&auto=format&fit=crop",
                "status": "finished",
                "event_type": "online",
                "participation_type": "team",
                "industry": "design",
                "difficulty": "mixed",
                "language": "uk",
                "total_rounds": 3,
                "comments_count": 77,
                "views_count": 780,
                "followers_count": 133,
            },
            {
                "name": "Archive: Data Marathon 2025",
                "short_description": "Archived benchmark event for historical comparison",
                "cover_image": "https://picsum.photos/seed/data-marathon-archive/900/500",
                "banner_image": "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1600&auto=format&fit=crop",
                "status": "archived",
                "event_type": "online",
                "participation_type": "individual",
                "industry": "programming",
                "difficulty": "advanced",
                "language": "en",
                "total_rounds": 5,
                "comments_count": 118,
                "views_count": 1320,
                "followers_count": 260,
            },
        ]

        competitions = []
        for item in data:
            defaults = {
                "is_public": True,
                "show_in_catalog": True,
                "organizer_approval_status": "approved",
                **item,
            }
            if upsert:
                competition, _ = Competition.objects.update_or_create(
                    slug=slugify(item["name"]),
                    defaults=defaults,
                )
                competitions.append(competition)
            else:
                competitions.append(Competition.objects.create(**defaults))
        return competitions

    def _assign_all_competitions_to_demo_organizer(self, competitions, organizer_user):
        for comp in competitions:
            CompetitionParticipant.objects.update_or_create(
                competition=comp,
                user=organizer_user,
                defaults={
                    "display_name": "Demo Organizer",
                    "role": "organizer",
                    "status": "approved",
                    "is_active_now": True,
                },
            )

    def _create_admin_pending_proposal(self, now):
        guest_organizer, _ = User.objects.get_or_create(
            username="guest_organizer",
            defaults={"email": "guest.organizer@example.com", "first_name": "Guest", "last_name": "Organizer"},
        )
        guest_organizer.set_password(DEMO_PASSWORD)
        guest_organizer.save()
        UserProfile.objects.update_or_create(
            user=guest_organizer,
            defaults={
                "display_name": "Guest Organizer",
                "primary_role": "organizer",
                "organization": "External Demo Lab",
                "country": "Ukraine",
            },
        )
        draft_competition = Competition.objects.create(
            name="Pending Mobile Hackathon Proposal",
            short_description="Draft creation request for administrator Pending testing",
            cover_image="https://picsum.photos/seed/pending-mobile-hackathon/900/500",
            banner_image="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1600&auto=format&fit=crop",
            status="draft",
            event_type="online",
            participation_type="team",
            industry="programming",
            difficulty="mixed",
            language="uk",
            is_public=False,
            show_in_catalog=False,
            starts_at=now + timedelta(days=7),
            ends_at=now + timedelta(days=9),
            timer_deadline=now + timedelta(days=7),
        )
        CompetitionParticipant.objects.update_or_create(
            competition=draft_competition,
            user=guest_organizer,
            defaults={"display_name": "Guest Organizer", "role": "organizer", "status": "approved"},
        )

    def _create_rounds_and_schedule(self, competitions, now):
        next_month = (now.replace(day=28) + timedelta(days=4)).replace(day=1, hour=23, minute=59, second=59, microsecond=0)
        month_end = next_month - timedelta(days=1)
        for index, comp in enumerate(competitions):
            if comp.status == "active":
                round_count = max(comp.total_rounds, 3)
                start_at = now - timedelta(minutes=random.randint(25, 95))
                end_at = month_end
                self._apply_round_windows(comp, start_at, end_at, round_count, now, stream_enabled=index < 2)
                comp.registration_starts_at = start_at - timedelta(days=2)
                comp.registration_ends_at = start_at - timedelta(minutes=5)
                comp.registration_open = False
                comp.submissions_open = True
                comp.is_online_now = True
                comp.save()
                continue

            if comp.status == "registration_open":
                round_count = max(comp.total_rounds, 3)
                registration_end = now + timedelta(days=2, hours=random.randint(4, 10))
                start_at = registration_end + timedelta(minutes=15)
                end_at = month_end
                self._apply_round_windows(comp, start_at, end_at, round_count, now)
                comp.registration_starts_at = now - timedelta(hours=2)
                comp.registration_ends_at = registration_end
                comp.current_round = 0
                comp.timer_deadline = registration_end
                comp.registration_open = True
                comp.submissions_open = False
                comp.is_online_now = False
                comp.save()
                continue

            if comp.status == "upcoming":
                start_at = now + timedelta(days=2, hours=index)
                end_at = month_end
                self._apply_round_windows(comp, start_at, end_at, max(comp.total_rounds, 3), now)
                comp.registration_starts_at = now + timedelta(hours=6)
                comp.registration_ends_at = start_at - timedelta(hours=2)
                comp.current_round = 0
                comp.timer_deadline = start_at
                comp.save()
                continue

            if comp.status == "judging":
                start_at = now - timedelta(days=1)
                end_at = month_end
                self._apply_round_windows(comp, start_at, end_at, max(comp.total_rounds, 3), now)
                comp.current_round = comp.total_rounds
                comp.timer_deadline = month_end
                comp.judging_starts_at = now - timedelta(hours=1)
                comp.judging_ends_at = month_end
                comp.submissions_open = False
                comp.save()
                continue

            if comp.status in {"finished", "archived"}:
                days_back = 3 if comp.status == "finished" else 20
                start_at = now - timedelta(days=days_back)
                end_at = start_at + timedelta(days=2)
                self._apply_round_windows(comp, start_at, end_at, max(comp.total_rounds, 2), now)
                comp.current_round = comp.total_rounds
                comp.timer_deadline = end_at
                comp.registration_open = False
                comp.submissions_open = False
                comp.is_online_now = False
                comp.save()

    def _apply_round_windows(self, comp, start_at, end_at, round_count, now, stream_enabled=False):
        comp.starts_at = start_at
        comp.ends_at = end_at
        comp.total_rounds = round_count
        segment = (end_at - start_at) / round_count
        cursor = start_at
        active_round = 0
        active_deadline = start_at

        for round_index in range(round_count):
            next_cursor = cursor + segment
            round_number = round_index + 1
            if cursor <= now <= next_cursor:
                active_round = round_number
                active_deadline = next_cursor
            elif active_round == 0 and now < cursor:
                active_round = round_number
                active_deadline = cursor

            is_stream_round = bool(stream_enabled and cursor <= now <= next_cursor)
            CompetitionRound.objects.update_or_create(
                competition=comp,
                sort_order=round_index,
                defaults={
                    "title": f"Round {round_number}",
                    "description": "Demo stage with sequential deadlines.",
                    "starts_at": cursor,
                    "ends_at": next_cursor,
                    "status": "draft",
                    "submission_required": True,
                    "max_attempts": round_number,
                    "is_stream_enabled": is_stream_round,
                    "stream_url": "https://www.youtube.com/watch?v=jfKfPfyJRdk" if is_stream_round else "",
                    "stream_embed_url": "https://www.youtube.com/embed/jfKfPfyJRdk" if is_stream_round else "",
                    "stream_label": "Demo live stream" if is_stream_round else "",
                },
            )
            cursor = next_cursor

        if now > end_at:
            active_round = round_count
            active_deadline = end_at
        comp.current_round = active_round
        comp.timer_deadline = active_deadline
        comp.save()

    def _create_materials(self, competitions, owner):
        for comp in competitions:
            rules_content = build_demo_pdf(
                f"{comp.name} rules",
                [
                    "This file is generated by the Judgify demo seed.",
                    "It replaces the previous external placeholder URL.",
                    "Participants should review deadlines, rounds, and submission policy before joining.",
                ],
            )
            rules_file, _ = UserFile.objects.update_or_create(
                owner=owner,
                storage_key=f"demo/materials/{comp.slug or comp.id}/rules.pdf",
                defaults={
                    "original_name": f"{comp.slug or comp.id}-rules.pdf",
                    "mime_type": "application/pdf",
                    "size_bytes": len(rules_content),
                    "content": rules_content,
                    "file_type": "competition_attachment",
                    "visibility": "competition_only",
                    "public_url": "",
                },
            )
            rules_material, _ = CompetitionMaterial.objects.get_or_create(
                competition=comp,
                name="Competition rules",
                defaults={
                    "material_type": "rules",
                    "file": rules_file,
                    "sort_order": 0,
                },
            )
            if rules_material.file_id != rules_file.id or rules_material.url:
                rules_material.file = rules_file
                rules_material.url = ""
                rules_material.save(update_fields=["file", "url"])

            starter_content = build_demo_zip(comp)
            starter_file, _ = UserFile.objects.update_or_create(
                owner=owner,
                storage_key=f"demo/materials/{comp.slug or comp.id}/starter.zip",
                defaults={
                    "original_name": f"{comp.slug or comp.id}-starter.zip",
                    "mime_type": "application/zip",
                    "size_bytes": len(starter_content),
                    "content": starter_content,
                    "file_type": "competition_attachment",
                    "visibility": "competition_only",
                    "public_url": "",
                },
            )
            starter_material, _ = CompetitionMaterial.objects.get_or_create(
                competition=comp,
                name="Starter package",
                defaults={
                    "material_type": "template",
                    "file": starter_file,
                    "sort_order": 1,
                },
            )
            if starter_material.file_id != starter_file.id or starter_material.url:
                starter_material.file = starter_file
                starter_material.url = ""
                starter_material.save(update_fields=["file", "url"])

    def _create_saved_and_recent(self, competitions, participant_user, viewer_user=None):
        for comp in competitions[:4]:
            UserSavedCompetition.objects.get_or_create(user=participant_user, competition=comp)
            RecentlyViewedCompetition.objects.get_or_create(user=participant_user, competition=comp)
            material = comp.materials.order_by("sort_order", "id").first()
            if material:
                RecentlyViewedMaterial.objects.get_or_create(user=participant_user, material=material)
        if viewer_user:
            for comp in competitions[1:6]:
                UserSavedCompetition.objects.get_or_create(user=viewer_user, competition=comp)
                RecentlyViewedCompetition.objects.get_or_create(user=viewer_user, competition=comp)

    def _create_team_memberships_and_pending_requests(self, competitions, demo_users, fake_users):
        participant_user = demo_users["participant"]

        teammate, _ = User.objects.get_or_create(
            username="team_mate",
            defaults={"email": "mate@example.com", "first_name": "Team", "last_name": "Mate"},
        )
        teammate.set_password(DEMO_PASSWORD)
        teammate.save()
        UserProfile.objects.update_or_create(
            user=teammate,
            defaults={"display_name": "Team Mate", "primary_role": "participant", "country": "Ukraine"},
        )

        approved_team, _ = CompetitionTeam.objects.get_or_create(
            competition=competitions[0],
            name="Blue Logic",
            defaults={"captain": participant_user, "status": "approved"},
        )
        approved_team.captain = participant_user
        approved_team.status = "approved"
        approved_team.save(update_fields=["captain", "status"])

        for member, display_name in [(participant_user, "Demo Participant"), (teammate, "Team Mate")]:
            CompetitionParticipant.objects.update_or_create(
                competition=competitions[0],
                user=member,
                defaults={
                    "display_name": display_name,
                    "role": "team_member",
                    "status": "approved",
                    "team": approved_team,
                    "is_active_now": True,
                },
            )

        pending_team, _ = CompetitionTeam.objects.get_or_create(
            competition=competitions[2],
            name="Pending Sparks",
            defaults={"captain": participant_user, "status": "pending"},
        )
        pending_team.captain = participant_user
        pending_team.status = "pending"
        pending_team.save(update_fields=["captain", "status"])
        CompetitionJoinRequest.objects.update_or_create(
            competition=competitions[2],
            user=participant_user,
            role="team_member",
            defaults={
                "status": "pending",
                "team": pending_team,
                "team_name": pending_team.name,
                "message": "Please review our team application from the demo participant.",
            },
        )
        CompetitionParticipant.objects.update_or_create(
            competition=competitions[2],
            user=participant_user,
            defaults={
                "display_name": "Demo Participant",
                "role": "team_member",
                "status": "pending",
                "team": pending_team,
                "is_active_now": False,
            },
        )

        # Pending organizer queue: visible to demo_organizer in Pending.
        for pending_index, (pending_user, pending_name) in enumerate(fake_users[:3]):
            target_comp = competitions[2 if pending_index < 2 else 4]
            request_team, _ = CompetitionTeam.objects.get_or_create(
                competition=target_comp,
                name=f"Review Queue Team {pending_index + 1}",
                defaults={"captain": pending_user, "status": "pending"},
            )
            request_team.captain = pending_user
            request_team.status = "pending"
            request_team.save(update_fields=["captain", "status"])
            CompetitionJoinRequest.objects.update_or_create(
                competition=target_comp,
                user=pending_user,
                role="team_member",
                defaults={
                    "status": "pending",
                    "team": request_team,
                    "team_name": request_team.name,
                    "message": f"Application from {pending_name} for organizer review.",
                },
            )
            CompetitionParticipant.objects.update_or_create(
                competition=target_comp,
                user=pending_user,
                defaults={
                    "display_name": pending_name,
                    "role": "team_member",
                    "status": "pending",
                    "team": request_team,
                    "is_active_now": False,
                },
            )

        distribution = {
            competitions[0]: fake_users[:6],
            competitions[1]: fake_users[2:7],
            competitions[3]: fake_users[:3],
            competitions[4]: fake_users[0:5],
            competitions[5]: fake_users[5:10],
            competitions[6]: fake_users[1:8],
            competitions[7]: fake_users[3:9],
            competitions[8]: fake_users[0:8],
            competitions[9]: fake_users[2:10],
        }
        for comp, people in distribution.items():
            for idx, (member_user, display_name) in enumerate(people):
                role = "participant" if comp.participation_type == "individual" else "team_member"
                team = None
                if role == "team_member":
                    team, _ = CompetitionTeam.objects.get_or_create(
                        competition=comp,
                        name=f"{comp.industry.title()} Team {idx // 3 + 1}",
                        defaults={"captain": member_user, "status": "approved"},
                    )
                CompetitionParticipant.objects.update_or_create(
                    competition=comp,
                    user=member_user,
                    defaults={
                        "display_name": display_name,
                        "role": role,
                        "status": "approved",
                        "team": team,
                        "is_active_now": comp.status == "active" and idx % 2 == 0,
                    },
                )
                if idx % 2 == 0:
                    RecentlyViewedCompetition.objects.get_or_create(user=member_user, competition=comp)

    def _refresh_competition_counters(self, competitions):
        for comp in competitions:
            comp.participants_count = CompetitionParticipant.objects.filter(
                competition=comp,
                status="approved",
                role__in=["participant", "team_member"],
            ).count()
            comp.views_count = max(comp.views_count, comp.participants_count * 30 + comp.followers_count)
            comp.trending_score = (
                comp.participants_count * 3
                + comp.views_count
                + comp.followers_count * 2
                + comp.comments_count * 0.5
            )
            comp.save(update_fields=["participants_count", "views_count", "trending_score"])

    def _create_awards_and_certificates(self, competitions, demo_users, fake_users):
        now = timezone.now()
        badge_defs = [
            ("first-join", "First Join", "Registered for a competition", "participation"),
            ("team-player", "Team Player", "Joined a team competition", "team"),
            ("round-finisher", "Round Finisher", "Completed an active round", "progress"),
            ("top-observer", "Top Observer", "Reviewed competition materials", "engagement"),
        ]
        badges = []
        for code, title, description, badge_type in badge_defs:
            badge, _ = Badge.objects.update_or_create(
                code=code,
                defaults={"title": title, "description": description, "badge_type": badge_type},
            )
            badges.append(badge)

        award_users = [user for user, _ in fake_users] + [
            user for key, user in demo_users.items() if key != "admin"
        ]
        for idx, award_user in enumerate(award_users):
            for offset, badge in enumerate(badges[: 2 + (idx % 3)]):
                UserBadge.objects.get_or_create(
                    user=award_user,
                    badge=badge,
                    competition=competitions[(idx + offset) % len(competitions)],
                )

            certificate_count = 2 + (idx % 2)
            for cert_idx in range(1, certificate_count + 1):
                cert_comp = competitions[(idx + cert_idx) % len(competitions)]
                cert_content = build_demo_pdf(
                    f"Certificate for {cert_comp.name}",
                    [
                        f"Issued to {award_user.get_full_name() or award_user.get_username()}",
                        f"Verification code: DEMO-{award_user.username.upper()}-{cert_idx}"[:120],
                        "This is a real downloadable demo certificate stored in the database.",
                    ],
                )
                cert_file, _ = UserFile.objects.update_or_create(
                    owner=award_user,
                    storage_key=f"demo/certificates/{award_user.username}-{cert_idx}.pdf",
                    defaults={
                        "original_name": f"{award_user.username}-certificate-{cert_idx}.pdf",
                        "mime_type": "application/pdf",
                        "size_bytes": len(cert_content),
                        "content": cert_content,
                        "file_type": "certificate",
                        "visibility": "private",
                        "public_url": "",
                    },
                )
                verification_code = f"DEMO-{award_user.username.upper()}-{cert_idx}"[:128]
                Certificate.objects.update_or_create(
                    verification_code=verification_code,
                    defaults={
                        "user": award_user,
                        "competition": cert_comp,
                        "file": cert_file,
                        "title": f"Certificate for {cert_comp.name}",
                        "issued_at": now - timedelta(days=idx + cert_idx),
                    },
                )
