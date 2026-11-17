from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0007_remove_notice_target_class_remove_notice_target_role_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='attendance',
            name='status',
            field=models.CharField(
                choices=[
                    ('PRESENT', 'Present'),
                    ('ABSENT', 'Absent'),
                    ('LATE', 'Late'),
                    ('MEDICAL', 'Medical'),
                ],
                default='PRESENT',
                max_length=10,
            ),
        ),
    ]
