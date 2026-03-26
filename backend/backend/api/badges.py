"""
Achievement badge registry and evaluation logic.
Each badge has an id, title, description, icon (emoji), and a check function
that receives (user) and returns True if the badge should be awarded.
"""
from django.utils import timezone
from datetime import timedelta

BADGE_REGISTRY = [
    # ── Workouts ──────────────────────────────────────────────────────────────
    {
        'id': 'first_workout',
        'icon': '🏋️',
        'title_key': 'achievements.first_workout.title',
        'desc_key': 'achievements.first_workout.desc',
    },
    {
        'id': 'workout_10',
        'icon': '🔟',
        'title_key': 'achievements.workout_10.title',
        'desc_key': 'achievements.workout_10.desc',
    },
    {
        'id': 'workout_50',
        'icon': '💪',
        'title_key': 'achievements.workout_50.title',
        'desc_key': 'achievements.workout_50.desc',
    },
    # ── Streaks ───────────────────────────────────────────────────────────────
    {
        'id': 'streak_3',
        'icon': '🔥',
        'title_key': 'achievements.streak_3.title',
        'desc_key': 'achievements.streak_3.desc',
    },
    {
        'id': 'streak_7',
        'icon': '🌟',
        'title_key': 'achievements.streak_7.title',
        'desc_key': 'achievements.streak_7.desc',
    },
    # ── Tracking ──────────────────────────────────────────────────────────────
    {
        'id': 'first_weight_log',
        'icon': '⚖️',
        'title_key': 'achievements.first_weight_log.title',
        'desc_key': 'achievements.first_weight_log.desc',
    },
    {
        'id': 'weight_log_10',
        'icon': '📊',
        'title_key': 'achievements.weight_log_10.title',
        'desc_key': 'achievements.weight_log_10.desc',
    },
    {
        'id': 'first_measurement',
        'icon': '📏',
        'title_key': 'achievements.first_measurement.title',
        'desc_key': 'achievements.first_measurement.desc',
    },
    # ── Nutrition ─────────────────────────────────────────────────────────────
    {
        'id': 'first_meal_plan',
        'icon': '🥗',
        'title_key': 'achievements.first_meal_plan.title',
        'desc_key': 'achievements.first_meal_plan.desc',
    },
    {
        'id': 'meal_plan_5',
        'icon': '🍽️',
        'title_key': 'achievements.meal_plan_5.title',
        'desc_key': 'achievements.meal_plan_5.desc',
    },
    {
        'id': 'first_custom_meal',
        'icon': '👨‍🍳',
        'title_key': 'achievements.first_custom_meal.title',
        'desc_key': 'achievements.first_custom_meal.desc',
    },
    # ── Social ────────────────────────────────────────────────────────────────
    {
        'id': 'first_message',
        'icon': '💬',
        'title_key': 'achievements.first_message.title',
        'desc_key': 'achievements.first_message.desc',
    },
    # ── Milestones ────────────────────────────────────────────────────────────
    {
        'id': 'first_login',
        'icon': '🎉',
        'title_key': 'achievements.first_login.title',
        'desc_key': 'achievements.first_login.desc',
    },
    {
        'id': 'profile_complete',
        'icon': '✅',
        'title_key': 'achievements.profile_complete.title',
        'desc_key': 'achievements.profile_complete.desc',
    },
    {
        'id': 'custom_workout_created',
        'icon': '📝',
        'title_key': 'achievements.custom_workout_created.title',
        'desc_key': 'achievements.custom_workout_created.desc',
    },
    {
        'id': 'week_warrior',
        'icon': '🗓️',
        'title_key': 'achievements.week_warrior.title',
        'desc_key': 'achievements.week_warrior.desc',
    },
]

# Map badge id → metadata for quick lookup
BADGE_MAP = {b['id']: b for b in BADGE_REGISTRY}


def _check(user, badge_id: str) -> bool:
    """Return True if the user qualifies for this badge."""
    from .models import WorkoutSession, WeightLog, BodyMeasurement, CustomMeal, CustomWorkout, Message

    if badge_id == 'first_login':
        return True  # always award on first check

    if badge_id == 'first_workout':
        return WorkoutSession.objects.filter(user=user).exists()

    if badge_id == 'workout_10':
        return WorkoutSession.objects.filter(user=user).count() >= 10

    if badge_id == 'workout_50':
        return WorkoutSession.objects.filter(user=user).count() >= 50

    if badge_id == 'streak_3':
        return _workout_streak(user) >= 3

    if badge_id == 'streak_7':
        return _workout_streak(user) >= 7

    if badge_id == 'week_warrior':
        return _workout_streak(user) >= 7  # alias — same criterion

    if badge_id == 'first_weight_log':
        return WeightLog.objects.filter(user=user).exists()

    if badge_id == 'weight_log_10':
        return WeightLog.objects.filter(user=user).count() >= 10

    if badge_id == 'first_measurement':
        return BodyMeasurement.objects.filter(user=user).exists()

    if badge_id == 'first_meal_plan':
        try:
            return user.profile.ai_meal_plans_generated >= 1
        except Exception:
            return False

    if badge_id == 'meal_plan_5':
        try:
            return user.profile.ai_meal_plans_generated >= 5
        except Exception:
            return False

    if badge_id == 'first_custom_meal':
        return CustomMeal.objects.filter(user=user).exists()

    if badge_id == 'first_message':
        return Message.objects.filter(sender=user).exists()

    if badge_id == 'custom_workout_created':
        return CustomWorkout.objects.filter(user=user).exists()

    if badge_id == 'profile_complete':
        try:
            p = user.profile
            return bool(p.name and p.birthdate and p.gender and p.weight and p.height and p.fitness_goals)
        except Exception:
            return False

    return False


def _workout_streak(user) -> int:
    """Return the current consecutive-day workout streak."""
    from .models import WorkoutSession
    from django.utils import timezone

    sessions = (
        WorkoutSession.objects
        .filter(user=user)
        .values_list('started_at', flat=True)
        .order_by('-started_at')
    )
    if not sessions:
        return 0

    unique_days = sorted(
        {s.date() for s in sessions},
        reverse=True,
    )

    today = timezone.now().date()
    streak = 0
    expected = today

    for day in unique_days:
        if day == expected or (streak == 0 and day == today - timedelta(days=1)):
            streak += 1
            expected = day - timedelta(days=1)
        else:
            break

    return streak


def check_and_award(user, badge_id: str):
    """
    Award badge_id to user if they qualify and don't already have it.
    Returns the badge metadata dict if newly awarded, else None.
    """
    from .models import UserAchievement

    if badge_id not in BADGE_MAP:
        return None
    if UserAchievement.objects.filter(user=user, badge_id=badge_id).exists():
        return None
    if not _check(user, badge_id):
        return None

    UserAchievement.objects.create(user=user, badge_id=badge_id)
    return BADGE_MAP[badge_id]


def evaluate_all(user) -> list:
    """
    Check every badge for the user. Returns a list of newly awarded badge dicts.
    Safe to call after any significant action.
    """
    newly_awarded = []
    for badge in BADGE_REGISTRY:
        result = check_and_award(user, badge['id'])
        if result:
            newly_awarded.append(result)
    return newly_awarded
