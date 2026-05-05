# Manual migration for profile-oriented data model.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('landing', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='competition',
            name='status',
            field=models.CharField(choices=[('draft', 'Draft'), ('upcoming', 'Upcoming'), ('registration_open', 'Registration Open'), ('active', 'Active'), ('judging', 'Judging'), ('finished', 'Finished'), ('archived', 'Archived')], db_index=True, max_length=32),
        ),
        migrations.CreateModel(
            name='UserFile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('storage_key', models.CharField(max_length=512, unique=True)),
                ('original_name', models.CharField(max_length=255)),
                ('mime_type', models.CharField(blank=True, max_length=128)),
                ('size_bytes', models.PositiveBigIntegerField(default=0)),
                ('checksum', models.CharField(blank=True, max_length=128)),
                ('file_type', models.CharField(choices=[('avatar', 'Avatar'), ('certificate', 'Certificate'), ('badge_icon', 'Badge icon'), ('resource', 'Resource'), ('submission', 'Submission'), ('competition_cover', 'Competition cover'), ('competition_attachment', 'Competition attachment'), ('other', 'Other')], default='other', max_length=32)),
                ('visibility', models.CharField(choices=[('private', 'Private'), ('public', 'Public'), ('competition_only', 'Competition only')], default='private', max_length=32)),
                ('public_url', models.URLField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='files', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('display_name', models.CharField(blank=True, max_length=255)),
                ('primary_role', models.CharField(choices=[('admin', 'Administrator'), ('organizer', 'Organizer'), ('participant', 'Participant'), ('viewer', 'Viewer')], default='participant', max_length=32)),
                ('bio', models.TextField(blank=True)),
                ('organization', models.CharField(blank=True, max_length=255)),
                ('position', models.CharField(blank=True, max_length=255)),
                ('phone', models.CharField(blank=True, max_length=64)),
                ('country', models.CharField(blank=True, max_length=128)),
                ('city', models.CharField(blank=True, max_length=128)),
                ('skills', models.JSONField(blank=True, default=list)),
                ('interests', models.JSONField(blank=True, default=list)),
                ('links', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('avatar_file', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='avatar_profiles', to='landing.userfile')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='profile', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='RecentlyViewedCompetition',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('viewed_at', models.DateTimeField(auto_now=True)),
                ('view_count', models.PositiveIntegerField(default=1)),
                ('competition', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='recent_views', to='landing.competition')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='recent_competition_views', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-viewed_at'], 'unique_together': {('user', 'competition')}},
        ),
        migrations.CreateModel(
            name='Badge',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.SlugField(unique=True)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('badge_type', models.CharField(blank=True, max_length=64)),
                ('icon_file', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='badge_icons', to='landing.userfile')),
            ],
        ),
        migrations.CreateModel(
            name='UserBadge',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('awarded_at', models.DateTimeField(auto_now_add=True)),
                ('badge', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='awards', to='landing.badge')),
                ('competition', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='awarded_badges', to='landing.competition')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='badges', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-awarded_at']},
        ),
        migrations.CreateModel(
            name='Certificate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('issued_at', models.DateTimeField(blank=True, null=True)),
                ('verification_code', models.CharField(max_length=128, unique=True)),
                ('competition', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='certificates', to='landing.competition')),
                ('file', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='certificates', to='landing.userfile')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='certificates', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-issued_at', '-id']},
        ),
        migrations.CreateModel(
            name='UserMaterial',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('material_type', models.CharField(choices=[('certificate', 'Certificate'), ('resource', 'Resource'), ('submission', 'Submission'), ('note', 'Note'), ('feedback', 'Feedback')], default='resource', max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('competition', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='user_materials', to='landing.competition')),
                ('file', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='materials', to='landing.userfile')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='materials', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
