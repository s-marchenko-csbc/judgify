from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from landing.models import Competition, UserSavedCompetition

User = get_user_model()


class Command(BaseCommand):
    help = "Seed landing page demo data with dynamic timers and statuses"

    def handle(self, *args, **kwargs):
        now = timezone.now()

        Competition.objects.all().delete()

        competitions = [
            {
                "name": "AI Battle 2026",
                "short_description": "Machine learning competition for student teams",
                "cover_image": "https://picsum.photos/seed/ai-battle/900/500",
                "status": "active",
                "event_type": "online",
                "participation_type": "team",
                "industry": "programming",
                "difficulty": "mixed",
                "current_round": 2,
                "total_rounds": 6,
                "participants_count": 17,
                "comments_count": 200,
                "views_count": 1300,
                "followers_count": 320,
                "is_live_stream_enabled": True,
                "is_online_now": True,
                "registration_open": True,
                "submissions_open": True,
                "trending_score": 99.5,
                "is_public": True,
                "starts_at": now - timedelta(hours=2),
                "ends_at": now + timedelta(hours=3),
                "timer_deadline": now + timedelta(hours=2, minutes=15),
            },
            {
                "name": "Last Minute Design Sprint",
                "short_description": "Design sprint challenge close to deadline",
                "cover_image": "https://picsum.photos/seed/design-last-minute/900/500",
                "status": "active",
                "event_type": "hybrid",
                "participation_type": "team",
                "industry": "design",
                "difficulty": "intermediate",
                "current_round": 3,
                "total_rounds": 5,
                "participants_count": 11,
                "comments_count": 48,
                "views_count": 720,
                "followers_count": 150,
                "is_live_stream_enabled": True,
                "is_online_now": True,
                "registration_open": False,
                "submissions_open": True,
                "trending_score": 94.1,
                "is_public": True,
                "starts_at": now - timedelta(hours=1, minutes=30),
                "ends_at": now + timedelta(minutes=4, seconds=20),
                "timer_deadline": now + timedelta(minutes=4, seconds=20),
            },
            {
                "name": "Cyber Cup Open Registration",
                "short_description": "Cybersecurity event with open registration",
                "cover_image": "https://picsum.photos/seed/cyber-cup/900/500",
                "status": "registration_open",
                "event_type": "online",
                "participation_type": "team",
                "industry": "cybersecurity",
                "difficulty": "mixed",
                "current_round": 0,
                "total_rounds": 4,
                "participants_count": 29,
                "comments_count": 61,
                "views_count": 980,
                "followers_count": 205,
                "is_live_stream_enabled": False,
                "is_online_now": False,
                "registration_open": True,
                "submissions_open": False,
                "trending_score": 86.2,
                "is_public": True,
                "starts_at": now + timedelta(days=1),
                "ends_at": now + timedelta(days=3),
                "timer_deadline": now + timedelta(hours=12),
            },
            {
                "name": "Future Robotics League",
                "short_description": "Upcoming robotics tournament",
                "cover_image": "https://picsum.photos/seed/future-robotics/900/500",
                "status": "upcoming",
                "event_type": "offline",
                "participation_type": "team",
                "industry": "robotics",
                "difficulty": "advanced",
                "current_round": 0,
                "total_rounds": 6,
                "participants_count": 8,
                "comments_count": 15,
                "views_count": 420,
                "followers_count": 98,
                "is_live_stream_enabled": False,
                "is_online_now": False,
                "registration_open": False,
                "submissions_open": False,
                "trending_score": 73.8,
                "is_public": True,
                "starts_at": now + timedelta(days=2, hours=3),
                "ends_at": now + timedelta(days=5),
                "timer_deadline": now + timedelta(days=2, hours=3),
            },
            {
                "name": "Prototype Finals Review",
                "short_description": "Judging stage for finalist projects",
                "cover_image": "https://picsum.photos/seed/prototype-finals/900/500",
                "status": "judging",
                "event_type": "hybrid",
                "participation_type": "team",
                "industry": "programming",
                "difficulty": "advanced",
                "current_round": 5,
                "total_rounds": 5,
                "participants_count": 10,
                "comments_count": 124,
                "views_count": 1110,
                "followers_count": 310,
                "is_live_stream_enabled": False,
                "is_online_now": False,
                "registration_open": False,
                "submissions_open": False,
                "trending_score": 90.4,
                "is_public": True,
                "starts_at": now - timedelta(days=1),
                "ends_at": now + timedelta(hours=1),
                "timer_deadline": now + timedelta(minutes=18),
            },
            {
                "name": "Mobile App Showdown",
                "short_description": "Competition recently finished",
                "cover_image": "https://picsum.photos/seed/mobile-showdown/900/500",
                "status": "finished",
                "event_type": "online",
                "participation_type": "individual",
                "industry": "programming",
                "difficulty": "beginner",
                "current_round": 4,
                "total_rounds": 4,
                "participants_count": 23,
                "comments_count": 89,
                "views_count": 860,
                "followers_count": 170,
                "is_live_stream_enabled": False,
                "is_online_now": False,
                "registration_open": False,
                "submissions_open": False,
                "trending_score": 67.0,
                "is_public": True,
                "starts_at": now - timedelta(days=3),
                "ends_at": now - timedelta(hours=2),
                "timer_deadline": now - timedelta(hours=2),
            },
            {
                "name": "Legacy Innovation Archive",
                "short_description": "Archived competition for reference",
                "cover_image": "https://picsum.photos/seed/legacy-archive/900/500",
                "status": "archived",
                "event_type": "offline",
                "participation_type": "team",
                "industry": "design",
                "difficulty": "mixed",
                "current_round": 6,
                "total_rounds": 6,
                "participants_count": 31,
                "comments_count": 142,
                "views_count": 1650,
                "followers_count": 390,
                "is_live_stream_enabled": False,
                "is_online_now": False,
                "registration_open": False,
                "submissions_open": False,
                "trending_score": 50.0,
                "is_public": True,
                "starts_at": now - timedelta(days=20),
                "ends_at": now - timedelta(days=15),
                "timer_deadline": now - timedelta(days=15),
            },
        ]

        created = []
        for item in competitions:
            created.append(Competition.objects.create(**item))

        user, _ = User.objects.get_or_create(
            username="demo_user",
            defaults={"email": "demo@example.com"}
        )
        user.set_password("demo12345")
        user.save()

        for comp in created[:3]:
            UserSavedCompetition.objects.get_or_create(user=user, competition=comp)

        self.stdout.write(self.style.SUCCESS("Dynamic seed data created successfully"))