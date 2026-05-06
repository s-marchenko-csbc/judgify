from django.conf import settings
from django.db import migrations
from django.utils.text import slugify

import io
import zipfile


def pdf_escape(value):
    return str(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_pdf(title, lines):
    commands = ["BT", "/F1 14 Tf", "72 760 Td"]
    for index, line in enumerate([title, *lines]):
        if index:
            commands.append("0 -22 Td")
        commands.append(f"({pdf_escape(line)}) Tj")
    commands.append("ET")
    stream = "\n".join(commands).encode("utf-8")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    content = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(content))
        content.extend(f"{index} 0 obj\n".encode("ascii"))
        content.extend(obj)
        content.extend(b"\nendobj\n")
    xref_offset = len(content)
    content.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    content.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        content.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    content.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("ascii")
    )
    return bytes(content)


def build_starter_zip(competition_name):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as package:
        package.writestr(
            "README.md",
            "\n".join([
                f"# Starter package for {competition_name}",
                "",
                "This real downloadable package replaces the previous placeholder URL.",
                "It contains a basic submission template for the competition.",
            ]),
        )
        package.writestr(
            "submission-template.md",
            "\n".join([
                f"# {competition_name} submission",
                "",
                "Team or participant:",
                "Repository:",
                "Demo link:",
                "Notes:",
            ]),
        )
    return buffer.getvalue()


def auth_user_model(apps):
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    return apps.get_model(app_label, model_name)


def material_owner(User, CompetitionParticipant, competition_id):
    organizer = CompetitionParticipant.objects.filter(
        competition_id=competition_id,
        role="organizer",
        user_id__isnull=False,
    ).order_by("id").first()
    if organizer:
        return organizer.user_id
    first_user = User.objects.order_by("id").first()
    return first_user.id if first_user else None


def replace_material_placeholders(apps, schema_editor):
    CompetitionMaterial = apps.get_model("landing", "CompetitionMaterial")
    CompetitionParticipant = apps.get_model("landing", "CompetitionParticipant")
    UserFile = apps.get_model("landing", "UserFile")
    User = auth_user_model(apps)

    placeholders = CompetitionMaterial.objects.filter(url__icontains="example.com/materials/").select_related("competition")
    for material in placeholders:
        owner_id = material_owner(User, CompetitionParticipant, material.competition_id)
        if not owner_id:
            continue
        competition = material.competition
        key_base = slugify(getattr(competition, "slug", "") or competition.name or f"competition-{competition.id}")
        is_starter = material.material_type == "template" or "starter" in material.name.lower()
        if is_starter:
            content = build_starter_zip(competition.name)
            original_name = f"{key_base}-starter.zip"
            mime_type = "application/zip"
            storage_key = f"demo/materials/{key_base}/starter.zip"
        else:
            content = build_pdf(
                f"{competition.name} rules",
                [
                    "This file is stored by Judgify and replaces the previous placeholder URL.",
                    "Participants should review deadlines, rounds, and submission policy before joining.",
                ],
            )
            original_name = f"{key_base}-rules.pdf"
            mime_type = "application/pdf"
            storage_key = f"demo/materials/{key_base}/rules.pdf"

        user_file, _ = UserFile.objects.update_or_create(
            storage_key=storage_key,
            defaults={
                "owner_id": owner_id,
                "original_name": original_name,
                "mime_type": mime_type,
                "size_bytes": len(content),
                "content": content,
                "file_type": "competition_attachment",
                "visibility": "competition_only",
                "public_url": "",
            },
        )
        material.file_id = user_file.id
        material.url = ""
        material.save(update_fields=["file", "url"])


def repair_demo_certificates(apps, schema_editor):
    UserFile = apps.get_model("landing", "UserFile")
    Certificate = apps.get_model("landing", "Certificate")
    demo_files = UserFile.objects.filter(storage_key__startswith="demo/certificates/").filter(content__isnull=True)
    for user_file in demo_files:
        certificate = Certificate.objects.filter(file_id=user_file.id).select_related("competition", "user").first()
        title = certificate.title if certificate else user_file.original_name
        owner_name = getattr(certificate.user, "username", "") if certificate and certificate.user_id else "participant"
        competition_name = certificate.competition.name if certificate and certificate.competition_id else "Judgify"
        verification_code = certificate.verification_code if certificate else user_file.storage_key
        content = build_pdf(
            title,
            [
                f"Issued to {owner_name}",
                f"Competition: {competition_name}",
                f"Verification code: {verification_code}",
            ],
        )
        user_file.content = content
        user_file.size_bytes = len(content)
        user_file.mime_type = user_file.mime_type or "application/pdf"
        user_file.public_url = ""
        user_file.save(update_fields=["content", "size_bytes", "mime_type", "public_url"])


def forwards(apps, schema_editor):
    replace_material_placeholders(apps, schema_editor)
    repair_demo_certificates(apps, schema_editor)


class Migration(migrations.Migration):

    dependencies = [
        ("landing", "0009_competitionscore_uniq_score_by_submission_and_more"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
