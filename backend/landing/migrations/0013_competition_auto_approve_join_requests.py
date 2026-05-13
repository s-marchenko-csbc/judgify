from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("landing", "0012_platformsetting"),
    ]

    operations = [
        migrations.AddField(
            model_name="competition",
            name="auto_approve_join_requests",
            field=models.BooleanField(default=False),
        ),
    ]
