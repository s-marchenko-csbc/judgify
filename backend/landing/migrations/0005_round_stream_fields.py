from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("landing", "0004_competition_access_mode_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="competitionround",
            name="is_stream_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="competitionround",
            name="stream_url",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="competitionround",
            name="stream_embed_url",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="competitionround",
            name="stream_label",
            field=models.CharField(blank=True, max_length=120),
        ),
    ]
