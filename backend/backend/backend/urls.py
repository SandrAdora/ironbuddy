"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from api.views import CreateUserView, CoachChatView, WorkoutPlanView, AIMealPlanView, UserProfileView, CustomWorkoutListView, CustomWorkoutDetailView, CustomMealListView, CustomMealDetailView, UserRecipeListView, UserRecipeDetailView, WorkoutVideoListView, WorkoutVideoDetailView, UserListView, UserSearchView, UserDetailView, ConversationListView, ConversationDetailView, MessageListView, MessageDetailView, WorkoutSessionListView, WorkoutSessionDetailView, PasswordResetRequestView, PasswordResetConfirmView, PasswordChangeView, MessageReactionView, WeightLogListView, WeightLogDetailView, DeleteAccountView, DeactivateAccountView, ReactivatingTokenView, ContactView, BodyMeasurementListView, BodyMeasurementDetailView, ExerciseListView, ExerciseDetailView, ExerciseMetaView, ExerciseFetchMediaView, YouTubeVideoView, UploadFileView, TranslateInstructionsView, AnalyzeMealPhotoView, ImportRecipeView, WearableAuthUrlView, WearableConnectView, WearableDataView, WearableDisconnectView, WearableStatusView, AchievementListView, AchievementCheckView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


# linking the views 
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/user/register/', CreateUserView.as_view(), name="register"),
    path("api/token/", ReactivatingTokenView.as_view(), name="get_token"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="refresh_token"),
    path("api-auth/", include("rest_framework.urls")),
    path("api/chat/", CoachChatView.as_view(), name="coach_chat"),
    path("api/workout/", WorkoutPlanView.as_view(), name="workout_plan"),
    path("api/meals/ai-plan/", AIMealPlanView.as_view(), name="ai_meal_plan"),
    path("api/user/profile/", UserProfileView.as_view(), name="user_profile"),
    path("api/workouts/custom/", CustomWorkoutListView.as_view(), name="custom_workouts"),
    path("api/workouts/custom/<int:pk>/", CustomWorkoutDetailView.as_view(), name="custom_workout_detail"),
    path("api/meals/custom/", CustomMealListView.as_view(), name="custom_meals"),
    path("api/meals/custom/<int:pk>/", CustomMealDetailView.as_view(), name="custom_meal_detail"),
    path("api/recipes/", UserRecipeListView.as_view(), name="user_recipes"),
    path("api/recipes/<int:pk>/", UserRecipeDetailView.as_view(), name="user_recipe_detail"),
    path("api/workout-videos/", WorkoutVideoListView.as_view(), name="workout_videos"),
    path("api/workout-videos/<int:pk>/", WorkoutVideoDetailView.as_view(), name="workout_video_detail"),
    path("api/users/", UserListView.as_view(), name="user_list"),
    path("api/users/search/", UserSearchView.as_view(), name="user_search"),
    path("api/users/<int:pk>/", UserDetailView.as_view(), name="user_detail"),
    path("api/conversations/", ConversationListView.as_view(), name="conversations"),
    path("api/conversations/<int:pk>/", ConversationDetailView.as_view(), name="conversation_detail"),
    path("api/conversations/<int:pk>/messages/", MessageListView.as_view(), name="messages"),
    path("api/messages/<int:pk>/", MessageDetailView.as_view(), name="message_detail"),
    path("api/sessions/", WorkoutSessionListView.as_view(), name="workout_sessions"),
    path("api/sessions/<int:pk>/", WorkoutSessionDetailView.as_view(), name="workout_session_detail"),
    path("api/password-reset/", PasswordResetRequestView.as_view(), name="password_reset"),
    path("api/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    path("api/password-change/", PasswordChangeView.as_view(), name="password_change"),
    path("api/messages/<int:pk>/react/", MessageReactionView.as_view(), name="message_react"),
    path("api/weight-log/", WeightLogListView.as_view(), name="weight_log"),
    path("api/weight-log/<int:pk>/", WeightLogDetailView.as_view(), name="weight_log_detail"),
    path("api/account/delete/", DeleteAccountView.as_view(), name="delete_account"),
    path("api/account/deactivate/", DeactivateAccountView.as_view(), name="deactivate_account"),
    path("api/contact/", ContactView.as_view(), name="contact"),
    path("api/body-measurements/", BodyMeasurementListView.as_view(), name="body_measurements"),
    path("api/body-measurements/<int:pk>/", BodyMeasurementDetailView.as_view(), name="body_measurement_detail"),
    path("api/exercises/", ExerciseListView.as_view(), name="exercises"),
    path("api/exercises/meta/", ExerciseMetaView.as_view(), name="exercises_meta"),
    path("api/exercises/fetch-media/", ExerciseFetchMediaView.as_view(), name="exercises_fetch_media"),
    path("api/exercises/<str:exercise_id>/", ExerciseDetailView.as_view(), name="exercise_detail"),
    path("api/youtube-video/", YouTubeVideoView.as_view(), name="youtube_video"),
    path("api/upload/", UploadFileView.as_view(), name="upload_file"),
    path("api/translate-instructions/", TranslateInstructionsView.as_view(), name="translate_instructions"),
    path("api/meals/analyze-photo/", AnalyzeMealPhotoView.as_view(), name="analyze_meal_photo"),
    path("api/meals/import-recipe/", ImportRecipeView.as_view(), name="import_recipe"),
    path("api/wearable/auth-url/", WearableAuthUrlView.as_view(), name="wearable_auth_url"),
    path("api/wearable/connect/", WearableConnectView.as_view(), name="wearable_connect"),
    path("api/wearable/data/", WearableDataView.as_view(), name="wearable_data"),
    path("api/wearable/disconnect/", WearableDisconnectView.as_view(), name="wearable_disconnect"),
    path("api/wearable/status/", WearableStatusView.as_view(), name="wearable_status"),
    path("api/achievements/", AchievementListView.as_view(), name="achievements"),
    path("api/achievements/check/", AchievementCheckView.as_view(), name="achievements_check"),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
