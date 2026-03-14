from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_conversation_message'),
    ]

    operations = [
        migrations.AddField(
            model_name='message',
            name='file_url',
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name='message',
            name='file_type',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='message',
            name='file_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AlterField(
            model_name='message',
            name='content',
            field=models.TextField(blank=True),
        ),
    ]
