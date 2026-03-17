from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0015_meal_ingredients'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='workoutsession',
            name='notes',
            field=models.TextField(blank=True),
        ),
        migrations.CreateModel(
            name='BodyMeasurement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('chest', models.FloatField(blank=True, null=True)),
                ('waist', models.FloatField(blank=True, null=True)),
                ('hips', models.FloatField(blank=True, null=True)),
                ('arms', models.FloatField(blank=True, null=True)),
                ('logged_at', models.DateField()),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='body_measurements', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['logged_at'],
                'unique_together': {('user', 'logged_at')},
            },
        ),
    ]
