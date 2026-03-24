from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    name = models.CharField(max_length=200, blank=True)
    birthdate = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=50, blank=True)
    weight = models.FloatField(null=True, blank=True)
    height = models.FloatField(null=True, blank=True)
    fitness_goals = models.CharField(max_length=100, blank=True)
    experience_level = models.CharField(max_length=50, blank=True)
    equipments = models.CharField(max_length=100, blank=True)
    allergies = models.JSONField(default=list, blank=True)
    injuries = models.JSONField(default=list, blank=True)
    disclaimer_accepted_at = models.DateTimeField(auto_now_add=True)
    profile_picture = models.TextField(blank=True)
    community_visible = models.BooleanField(default=False)
    preferred_ingredients = models.JSONField(default=list, blank=True)
    excluded_ingredients = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.user.username} – {self.name or 'no name'}"


class CustomWorkout(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='custom_workouts')
    name = models.CharField(max_length=200)
    description = models.CharField(max_length=500, blank=True)
    exercises = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} – {self.name}"


class CustomMeal(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='custom_meals')
    name = models.CharField(max_length=200)
    description = models.CharField(max_length=500, blank=True)
    kcal = models.CharField(max_length=50, blank=True)
    icon = models.CharField(max_length=10, default='🍽️')
    recipe_url = models.URLField(blank=True)
    ingredients = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} – {self.name}"


class UserRecipe(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='recipes')
    title = models.CharField(max_length=200)
    url = models.URLField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} – {self.title}"


class WorkoutVideo(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workout_videos')
    title = models.CharField(max_length=200)
    url = models.URLField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} – {self.title}"


class Conversation(models.Model):
    participants = models.ManyToManyField(User, related_name='conversations')
    is_group = models.BooleanField(default=False)
    group_name = models.CharField(max_length=100, blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='created_conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.group_name or f"Conversation {self.pk}"


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField(blank=True)
    file_url = models.URLField(blank=True)
    file_type = models.CharField(max_length=20, blank=True)   # image | video | pdf | file
    file_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read_by = models.ManyToManyField(User, related_name='read_messages', blank=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender.username}: {self.content[:40] or '[file]'}"


class MessageReaction(models.Model):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='reactions')
    user    = models.ForeignKey(User, on_delete=models.CASCADE, related_name='message_reactions')
    emoji   = models.CharField(max_length=10)

    class Meta:
        unique_together = ('message', 'user', 'emoji')

    def __str__(self):
        return f"{self.user.username} reacted {self.emoji} to msg {self.message_id}"


class WorkoutSession(models.Model):
    WORKOUT_TYPES = [('ai', 'AI Plan'), ('custom', 'Custom')]

    user         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workout_sessions')
    workout_name = models.CharField(max_length=200)
    workout_type = models.CharField(max_length=10, choices=WORKOUT_TYPES, default='ai')
    started_at   = models.DateTimeField(auto_now_add=True)
    finished_at  = models.DateTimeField(null=True, blank=True)
    duration_min = models.IntegerField(null=True, blank=True)
    notes        = models.TextField(blank=True)

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.user.username} – {self.workout_name} ({self.started_at.date()})"


class BodyMeasurement(models.Model):
    user      = models.ForeignKey(User, on_delete=models.CASCADE, related_name='body_measurements')
    chest     = models.FloatField(null=True, blank=True)
    waist     = models.FloatField(null=True, blank=True)
    hips      = models.FloatField(null=True, blank=True)
    arms      = models.FloatField(null=True, blank=True)
    logged_at = models.DateField()

    class Meta:
        ordering = ['logged_at']
        unique_together = ('user', 'logged_at')

    def __str__(self):
        return f"{self.user.username} – measurements on {self.logged_at}"


class WeightLog(models.Model):
    user      = models.ForeignKey(User, on_delete=models.CASCADE, related_name='weight_logs')
    weight    = models.FloatField()
    logged_at = models.DateField()

    class Meta:
        ordering = ['logged_at']
        unique_together = ('user', 'logged_at')

    def __str__(self):
        return f"{self.user.username} – {self.weight} kg on {self.logged_at}"


class Exercise(models.Model):
    exercise_id = models.CharField(max_length=50, unique=True)  # ExerciseDB id
    name = models.CharField(max_length=200)
    body_part = models.CharField(max_length=100, blank=True)
    target = models.CharField(max_length=100, blank=True)       # primary muscle
    secondary_muscles = models.JSONField(default=list)
    equipment = models.CharField(max_length=100, blank=True)
    gif_url = models.URLField(max_length=500, blank=True)
    instructions = models.JSONField(default=list)
    youtube_video_id = models.CharField(max_length=20, blank=True)
    wger_image_url = models.URLField(max_length=500, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
