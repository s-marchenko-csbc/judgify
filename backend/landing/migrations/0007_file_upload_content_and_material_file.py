from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("landing", "0006_competition_organizer_approval"),
    ]

    operations = [
        migrations.AlterField(
            model_name="competitionmaterial",
            name="url",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="userfile",
            name="content",
            field=models.BinaryField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="competitionmaterial",
            name="file",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="competition_materials",
                to="landing.userfile",
            ),
        ),
    ]
