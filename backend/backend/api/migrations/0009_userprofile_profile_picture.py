from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_message_file_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='profile_picture',
            field=models.URLField(blank=True),
        ),
    ]
