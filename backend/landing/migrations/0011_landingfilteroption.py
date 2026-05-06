from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("landing", "0010_replace_demo_material_placeholders"),
    ]

    operations = [
        migrations.CreateModel(
            name="LandingFilterOption",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("group", models.CharField(db_index=True, max_length=64)),
                ("value", models.CharField(max_length=64)),
                ("label_en", models.CharField(blank=True, max_length=255)),
                ("label_uk", models.CharField(blank=True, max_length=255)),
                ("is_hidden", models.BooleanField(default=False)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["group", "sort_order", "value"],
                "unique_together": {("group", "value")},
            },
        ),
    ]
