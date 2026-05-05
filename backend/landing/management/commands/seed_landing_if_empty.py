from django.core.management import BaseCommand, call_command

from landing.models import Competition


class Command(BaseCommand):
    help = "Seed demo data only when the competition catalog is empty."

    def handle(self, *args, **kwargs):
        if Competition.objects.exists():
            self.stdout.write(self.style.SUCCESS("Demo seed skipped; competitions already exist."))
            return

        call_command("seed_landing")
