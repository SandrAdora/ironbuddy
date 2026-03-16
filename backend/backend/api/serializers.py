from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from .models import UserProfile, CustomWorkout, Conversation, Message, MessageReaction, WeightLog


class PublicUserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'profile_picture']

    def get_name(self, obj):
        try:
            return obj.profile.name or obj.username
        except Exception:
            return obj.username

    def get_profile_picture(self, obj):
        try:
            return obj.profile.profile_picture or None
        except Exception:
            return None


class MessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(source='sender.id', read_only=True)
    sender_name = serializers.SerializerMethodField()
    sender_profile_picture = serializers.SerializerMethodField()
    reactions = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'sender_id', 'sender_name', 'sender_profile_picture', 'content', 'file_url', 'file_type', 'file_name', 'created_at', 'reactions']
        read_only_fields = ['id', 'sender_id', 'sender_name', 'sender_profile_picture', 'created_at', 'reactions']

    def get_sender_name(self, obj):
        try:
            return obj.sender.profile.name or obj.sender.username
        except Exception:
            return obj.sender.username

    def get_sender_profile_picture(self, obj):
        try:
            return obj.sender.profile.profile_picture or None
        except Exception:
            return None

    def get_reactions(self, obj):
        from collections import defaultdict
        grouped = defaultdict(list)
        for r in obj.reactions.select_related('user').all():
            grouped[r.emoji].append(r.user.id)
        return [{'emoji': e, 'count': len(uids), 'user_ids': uids} for e, uids in grouped.items()]


class ConversationSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'other_user', 'last_message', 'unread_count', 'updated_at']

    def get_other_user(self, obj):
        request = self.context.get('request')
        other = obj.participants.exclude(id=request.user.id).first()
        return PublicUserSerializer(other).data if other else None

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if msg:
            display = msg.content or (f'Sent a {msg.file_type}' if msg.file_type else 'Sent a file')
            return {'content': display, 'sender_id': msg.sender.id, 'created_at': str(msg.created_at)}
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        return obj.messages.exclude(sender=request.user).exclude(read_by=request.user).count()


class UserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        validators=[UniqueValidator(queryset=User.objects.all(), message="This email is already registered.")]
    )

    class Meta:
        model = User
        fields = ["id", "username", "email", "password"]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    # Map camelCase frontend names to snake_case model fields
    fitnessGoals = serializers.CharField(source='fitness_goals', allow_blank=True, required=False)
    experienceLevel = serializers.CharField(source='experience_level', allow_blank=True, required=False)
    disclaimerAcceptedAt = serializers.DateTimeField(source='disclaimer_accepted_at', allow_null=True, required=False)
    profilePicture = serializers.URLField(source='profile_picture', allow_blank=True, required=False)
    communityVisible = serializers.BooleanField(source='community_visible', required=False)
    preferredIngredients = serializers.JSONField(source='preferred_ingredients', required=False)
    excludedIngredients = serializers.JSONField(source='excluded_ingredients', required=False)

    class Meta:
        model = UserProfile
        fields = [
            'name', 'birthdate', 'gender', 'weight', 'height',
            'fitnessGoals', 'experienceLevel', 'equipments',
            'allergies', 'injuries', 'disclaimerAcceptedAt', 'profilePicture',
            'communityVisible', 'preferredIngredients', 'excludedIngredients',
        ]
        extra_kwargs = {
            'name': {'allow_blank': True, 'required': False},
            'birthdate': {'allow_null': True, 'required': False},
            'gender': {'allow_blank': True, 'required': False},
            'weight': {'allow_null': True, 'required': False},
            'height': {'allow_null': True, 'required': False},
            'equipments': {'allow_blank': True, 'required': False},
            'allergies': {'required': False},
            'injuries': {'required': False},
            'profile_picture': {'allow_blank': True, 'required': False},
        }


class CustomWorkoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomWorkout
        fields = ['id', 'name', 'description', 'exercises', 'created_at']
        read_only_fields = ['id', 'created_at']


from .models import CustomMeal

class CustomMealSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomMeal
        fields = ['id', 'name', 'description', 'kcal', 'icon', 'recipe_url', 'ingredients', 'created_at']
        read_only_fields = ['id', 'created_at']


from .models import UserRecipe

class UserRecipeSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRecipe
        fields = ['id', 'title', 'url', 'created_at']
        read_only_fields = ['id', 'created_at']


from .models import WorkoutVideo

class WorkoutVideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutVideo
        fields = ['id', 'title', 'url', 'created_at']
        read_only_fields = ['id', 'created_at']


from .models import WorkoutSession

class WorkoutSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutSession
        fields = ['id', 'workout_name', 'workout_type', 'started_at', 'finished_at', 'duration_min']
        read_only_fields = ['id', 'started_at']


class WeightLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeightLog
        fields = ['id', 'weight', 'logged_at']
        read_only_fields = ['id']
