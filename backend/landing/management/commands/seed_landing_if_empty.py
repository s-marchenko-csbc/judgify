from django.core.management import BaseCommand, call_command
from django.utils import timezone

from landing.models import Competition
from landing.management.commands.seed_landing import Command as SeedLandingCommand


class Command(BaseCommand):
    help = "Seed demo data when empty and keep the public demo catalog topped up."

    def handle(self, *args, **kwargs):
        if not Competition.objects.exists():
            call_command("seed_landing")
            return

        seeder = SeedLandingCommand()
        now = timezone.now()
        demo_users = seeder._ensure_demo_users()
        fake_users = seeder._ensure_fake_participants()
        judge_users = seeder._ensure_demo_judges()
        competitions = seeder._create_competitions(now, upsert=True)
        seeder._assign_all_competitions_to_demo_organizer(competitions, demo_users["organizer"])
        seeder._create_rounds_and_schedule(competitions, now)
        seeder._create_submission_settings_and_criteria(competitions)
        seeder._create_materials(competitions, demo_users["organizer"])
        seeder._create_saved_and_recent(competitions, demo_users["participant"], demo_users["viewer"])
        seeder._create_team_memberships_and_pending_requests(competitions, demo_users, fake_users)
        seeder._create_announcements_and_comments(competitions, demo_users, fake_users)
        seeder._create_demo_submissions_scores_and_metrics(
            competitions,
            fake_users,
            judge_users,
            demo_users["organizer"],
            now,
        )
        seeder._refresh_competition_counters(competitions)

        self.stdout.write(self.style.SUCCESS(
            f"Demo catalog refreshed; {len(competitions)} public demo competitions are available."
        ))
