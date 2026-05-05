from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("landing", "0005_round_stream_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="competition",
            name="organizer_approval_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending administrator approval"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                ],
                db_index=True,
                default="pending",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="competition",
            name="organizer_approved_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="approved_competitions",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="competition",
            name="organizer_approved_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunSQL(
            sql=(
                "UPDATE landing_competition "
                "SET organizer_approval_status = 'approved' "
                "WHERE status <> 'draft'"
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
