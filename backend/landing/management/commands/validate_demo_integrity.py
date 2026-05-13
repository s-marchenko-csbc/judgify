from django.core.management.base import BaseCommand, CommandError
from django.db.models import Count, F

from landing.models import (
    Competition,
    CompetitionInvitation,
    CompetitionJudgeAssignment,
    CompetitionParticipant,
    CompetitionScore,
    CompetitionSubmission,
    CompetitionTeam,
    OutboundMessage,
    UserFile,
)


class Command(BaseCommand):
    help = "Validate Judgify demo data consistency across competitions, rounds, teams, submissions, judging and files."

    def add_arguments(self, parser):
        parser.add_argument(
            "--warnings-as-errors",
            action="store_true",
            help="Return a failing exit code when warnings are present.",
        )

    def handle(self, *args, **options):
        errors = []
        warnings = []

        self._validate_competitions(errors, warnings)
        self._validate_participants_and_teams(errors, warnings)
        self._validate_submissions(errors, warnings)
        self._validate_scores(errors, warnings)
        self._validate_invitations_and_messages(errors, warnings)
        self._validate_files(errors, warnings)

        for message in warnings:
            self.stdout.write(self.style.WARNING(f"WARNING: {message}"))
        for message in errors:
            self.stdout.write(self.style.ERROR(f"ERROR: {message}"))

        if errors or (warnings and options["warnings_as_errors"]):
            raise CommandError(
                f"Integrity validation failed with {len(errors)} errors and {len(warnings)} warnings."
            )

        self.stdout.write(self.style.SUCCESS(
            f"Integrity validation passed with {len(warnings)} warnings."
        ))

    def _validate_competitions(self, errors, warnings):
        for competition in Competition.objects.prefetch_related("rounds"):
            rounds = list(competition.rounds.all().order_by("sort_order", "id"))
            if competition.total_rounds != len(rounds):
                errors.append(
                    f"{competition.name}: total_rounds={competition.total_rounds}, actual rounds={len(rounds)}."
                )
            if competition.status == "archived" and (competition.registration_open or competition.submissions_open):
                errors.append(f"{competition.name}: archived competition has open registration/submissions.")
            if competition.status == "active" and competition.submissions_open:
                if not any(round_obj.status == "active" and round_obj.submission_required for round_obj in rounds):
                    errors.append(f"{competition.name}: submissions_open without an active submission round.")
            if competition.current_round > max(competition.total_rounds, 1):
                errors.append(f"{competition.name}: current_round exceeds total_rounds.")

            previous_end = None
            seen_sort_orders = set()
            for round_obj in rounds:
                if round_obj.sort_order in seen_sort_orders:
                    errors.append(f"{competition.name}: duplicate round sort_order={round_obj.sort_order}.")
                seen_sort_orders.add(round_obj.sort_order)
                if round_obj.starts_at and round_obj.ends_at and round_obj.ends_at <= round_obj.starts_at:
                    errors.append(f"{competition.name} / {round_obj.title}: round ends before it starts.")
                if competition.starts_at and round_obj.starts_at and round_obj.starts_at < competition.starts_at:
                    errors.append(f"{competition.name} / {round_obj.title}: round starts before competition.")
                if competition.ends_at and round_obj.ends_at and round_obj.ends_at > competition.ends_at:
                    errors.append(f"{competition.name} / {round_obj.title}: round ends after competition.")
                if previous_end and round_obj.starts_at and round_obj.starts_at <= previous_end:
                    errors.append(f"{competition.name} / {round_obj.title}: round overlaps or touches previous round.")
                if round_obj.ends_at:
                    previous_end = round_obj.ends_at

            participant_count = CompetitionParticipant.objects.filter(
                competition=competition,
                status="approved",
                role__in=["participant", "team_member"],
            ).count()
            if competition.participants_count != participant_count:
                errors.append(
                    f"{competition.name}: participants_count={competition.participants_count}, actual={participant_count}."
                )

            organizer_count = CompetitionParticipant.objects.filter(
                competition=competition,
                role="organizer",
                status="approved",
            ).count()
            if competition.status != "draft" and organizer_count == 0:
                errors.append(f"{competition.name}: no approved organizer.")

    def _validate_participants_and_teams(self, errors, warnings):
        for participant in CompetitionParticipant.objects.select_related("competition", "team", "user"):
            label = f"{participant.competition.name} / {participant.display_name}"
            if participant.role in {"organizer", "judge"} and participant.team_id:
                errors.append(f"{label}: {participant.role} cannot be assigned to a team.")
            if participant.role == "team_member" and not participant.team_id:
                errors.append(f"{label}: team_member has no team.")
            if participant.team_id and participant.team.competition_id != participant.competition_id:
                errors.append(f"{label}: team belongs to another competition.")

        for team in CompetitionTeam.objects.select_related("competition", "captain").prefetch_related("members"):
            member_count = team.members.count()
            if member_count == 0:
                errors.append(f"{team.competition.name} / {team.name}: team has no members.")
            if team.captain_id:
                captain_member = team.members.filter(user_id=team.captain_id).first()
                if not captain_member:
                    warnings.append(f"{team.competition.name} / {team.name}: captain is not listed as member.")
                elif captain_member.status not in {"pending", "approved"}:
                    warnings.append(f"{team.competition.name} / {team.name}: captain membership is {captain_member.status}.")

        conflicts = CompetitionParticipant.objects.filter(
            role__in=["participant", "team_member"],
            status__in=["pending", "approved"],
            user__isnull=False,
            user__competition_judge_assignments__competition_id=F("competition_id"),
        )
        for participant in conflicts:
            errors.append(
                f"{participant.competition.name} / {participant.user}: user participates and has judge assignment."
            )

        duplicate_roles = CompetitionParticipant.objects.values("competition_id", "user_id").exclude(
            user_id=None
        ).annotate(total=Count("id")).filter(total__gt=1)
        for item in duplicate_roles:
            errors.append(
                f"CompetitionParticipant duplicate membership: competition={item['competition_id']} user={item['user_id']}."
            )

    def _validate_submissions(self, errors, warnings):
        for submission in CompetitionSubmission.objects.select_related("competition", "round", "participant", "team", "file"):
            label = f"{submission.competition.name} / {submission.title or submission.id}"
            has_participant = bool(submission.participant_id)
            has_team = bool(submission.team_id)
            if has_participant == has_team:
                errors.append(f"{label}: submission must have exactly one participant or team subject.")
            if submission.round.competition_id != submission.competition_id:
                errors.append(f"{label}: round belongs to another competition.")
            if submission.participant_id and submission.participant.competition_id != submission.competition_id:
                errors.append(f"{label}: participant belongs to another competition.")
            if submission.team_id and submission.team.competition_id != submission.competition_id:
                errors.append(f"{label}: team belongs to another competition.")
            if submission.status == "locked" and not submission.locked_at:
                errors.append(f"{label}: locked submission has no locked_at.")
            if submission.status != "locked" and submission.locked_at:
                warnings.append(f"{label}: unlocked submission still has locked_at.")
            if not any([submission.description, submission.repository_url, submission.demo_url, submission.file_id]):
                warnings.append(f"{label}: submission has no content payload.")

    def _validate_scores(self, errors, warnings):
        for score in CompetitionScore.objects.select_related(
            "competition", "round", "criterion", "submission", "subject_participant", "subject_team", "judge"
        ):
            label = f"{score.competition.name} / score {score.id}"
            if score.round.competition_id != score.competition_id:
                errors.append(f"{label}: round belongs to another competition.")
            if score.criterion.competition_id != score.competition_id:
                errors.append(f"{label}: criterion belongs to another competition.")
            if score.score < 0 or score.score > score.criterion.max_score:
                errors.append(f"{label}: score {score.score} outside 0..{score.criterion.max_score}.")
            if score.review_type in {"manual", "peer_review"} and not score.judge_id:
                errors.append(f"{label}: {score.review_type} score has no judge/reviewer.")
            if score.review_type == "automatic" and score.judge_id:
                warnings.append(f"{label}: automatic score has a judge attached.")
            if score.submission_id:
                if score.submission.competition_id != score.competition_id:
                    errors.append(f"{label}: submission belongs to another competition.")
                if score.submission.round_id != score.round_id:
                    errors.append(f"{label}: submission round does not match score round.")
                if score.subject_participant_id != score.submission.participant_id:
                    errors.append(f"{label}: participant subject does not match submission.")
                if score.subject_team_id != score.submission.team_id:
                    errors.append(f"{label}: team subject does not match submission.")

        for assignment in CompetitionJudgeAssignment.objects.select_related("competition", "round", "judge"):
            label = f"{assignment.competition.name} / judge {assignment.judge_id}"
            if assignment.round_id and assignment.round.competition_id != assignment.competition_id:
                errors.append(f"{label}: assignment round belongs to another competition.")
            if assignment.status in {"accepted", "completed"}:
                membership = CompetitionParticipant.objects.filter(
                    competition=assignment.competition,
                    user=assignment.judge,
                    role="judge",
                    status="approved",
                ).exists()
                if not membership:
                    errors.append(f"{label}: accepted/completed assignment without approved judge membership.")

    def _validate_invitations_and_messages(self, errors, warnings):
        for invitation in CompetitionInvitation.objects.select_related("competition"):
            label = f"{invitation.competition.name} / invitation {invitation.email}"
            if invitation.status in {"accepted", "declined"} and not invitation.responded_at:
                errors.append(f"{label}: {invitation.status} invitation has no responded_at.")
            if invitation.status in {"sent", "accepted", "declined", "expired"} and not invitation.sent_at:
                warnings.append(f"{label}: {invitation.status} invitation has no sent_at.")
            if invitation.target_type == "individual" and invitation.team_name:
                errors.append(f"{label}: individual invitation has team_name.")

        for message in OutboundMessage.objects.select_related("competition", "invitation"):
            label = f"OutboundMessage {message.id}"
            if message.invitation_id and message.competition_id != message.invitation.competition_id:
                errors.append(f"{label}: message competition does not match invitation.")
            if message.status == "failed" and not message.error_message:
                warnings.append(f"{label}: failed message has no error_message.")
            if message.status == "sent" and not message.sent_at:
                warnings.append(f"{label}: sent message has no sent_at.")

    def _validate_files(self, errors, warnings):
        for file_obj in UserFile.objects.all():
            if not file_obj.content and not file_obj.public_url:
                errors.append(f"UserFile {file_obj.id} / {file_obj.original_name}: no stored content or public_url.")
            if file_obj.content and file_obj.size_bytes != len(file_obj.content):
                errors.append(
                    f"UserFile {file_obj.id} / {file_obj.original_name}: size_bytes={file_obj.size_bytes}, actual={len(file_obj.content)}."
                )
            if file_obj.public_url and "placeholder" in file_obj.public_url.lower():
                warnings.append(f"UserFile {file_obj.id} / {file_obj.original_name}: placeholder public_url.")
