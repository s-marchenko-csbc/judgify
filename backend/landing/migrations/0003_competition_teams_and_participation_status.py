# Generated manually for role-based team participation workflow.
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('landing', '0002_profile_data_model'),
    ]

    operations = [
        migrations.CreateModel(
            name='CompetitionTeam',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('pending', 'Pending review'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('archived', 'Archived')], db_index=True, default='pending', max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('captain', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='captained_competition_teams', to=settings.AUTH_USER_MODEL)),
                ('competition', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='teams', to='landing.competition')),
            ],
            options={'ordering': ['name'], 'unique_together': {('competition', 'name')}},
        ),
        migrations.AddField(
            model_name='competitionparticipant',
            name='status',
            field=models.CharField(choices=[('pending', 'Pending review'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('withdrawn', 'Withdrawn')], db_index=True, default='approved', max_length=32),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='competitionparticipant',
            name='team',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='members', to='landing.competitionteam'),
        ),
        migrations.AlterField(
            model_name='competitionparticipant',
            name='role',
            field=models.CharField(choices=[('participant', 'Participant'), ('team_member', 'Team member'), ('observer', 'Observer'), ('judge', 'Judge'), ('organizer', 'Organizer')], default='participant', max_length=32),
        ),
        migrations.AlterUniqueTogether(
            name='competitionparticipant',
            unique_together={('competition', 'user')},
        ),
        migrations.AddField(
            model_name='competitionjoinrequest',
            name='message',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='competitionjoinrequest',
            name='reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='competitionjoinrequest',
            name='reviewed_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_competition_join_requests', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='competitionjoinrequest',
            name='team',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='join_requests', to='landing.competitionteam'),
        ),
        migrations.AddField(
            model_name='competitionjoinrequest',
            name='team_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AlterField(
            model_name='competitionjoinrequest',
            name='role',
            field=models.CharField(choices=[('participant', 'Participant'), ('team_member', 'Team member'), ('observer', 'Observer')], max_length=32),
        ),
        migrations.AlterField(
            model_name='competitionjoinrequest',
            name='status',
            field=models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', max_length=16),
        ),
    ]
