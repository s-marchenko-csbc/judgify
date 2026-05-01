from django.contrib import admin
from .models import Competition, UserSavedCompetition, UserCompetitionWatch


@admin.register(Competition)
class CompetitionAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'name', 'status', 'event_type', 'participation_type', 'industry',
        'difficulty', 'is_online_now', 'submissions_open', 'created_at'
    )
    list_filter = (
        'status', 'event_type', 'participation_type', 'industry', 'difficulty',
        'is_online_now', 'submissions_open'
    )
    search_fields = ('name', 'short_description', 'slug')


@admin.register(UserSavedCompetition)
class UserSavedCompetitionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'competition', 'created_at')


@admin.register(UserCompetitionWatch)
class UserCompetitionWatchAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'competition', 'watch_live', 'watch_rounds', 'watch_updates', 'created_at')
