from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .serializers import UserSerializer, UserProfileSerializer, CustomWorkoutSerializer, CustomMealSerializer, UserRecipeSerializer, WorkoutVideoSerializer, PublicUserSerializer, ConversationSerializer, MessageSerializer, WorkoutSessionSerializer, WeightLogSerializer
from .models import UserProfile, CustomWorkout, CustomMeal, UserRecipe, WorkoutVideo, Conversation, Message, WorkoutSession, MessageReaction, WeightLog
from groq import Groq
import os


class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]


def _get_ai_provider():
    """Returns (provider, api_key, main_model, fast_model) based on env config."""
    provider = os.environ.get('AI_PROVIDER', 'groq').lower()
    model_override = os.environ.get('AI_MODEL', '').strip()

    if provider == 'anthropic':
        api_key = os.environ.get('ANTHROPIC_API_KEY', '')
        main_model = model_override or 'claude-haiku-4-5'
        fast_model = 'claude-haiku-4-5'
        return provider, api_key, main_model, fast_model
    else:
        api_key = os.environ.get('GROQ_API_KEY', '')
        main_model = model_override or 'llama-3.3-70b-versatile'
        fast_model = 'llama-3.1-8b-instant'
        return 'groq', api_key, main_model, fast_model


def _call_anthropic(model, system, messages, max_tokens):
    import anthropic as _anthropic
    api_key = os.environ.get('ANTHROPIC_API_KEY', '')
    if not api_key:
        raise RuntimeError('ANTHROPIC_API_KEY not set')
    client = _anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=messages,
    )
    return next(b.text for b in response.content if b.type == 'text')


def _chat_completion(provider, api_key, model, system, messages, max_tokens=1024):
    """Call the appropriate AI provider, falling back to Haiku on Groq rate limit."""
    if provider == 'anthropic':
        return _call_anthropic(model, system, messages, max_tokens)

    # Groq — with automatic Haiku fallback on rate limit
    from groq import RateLimitError as _GroqRateLimitError
    try:
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{"role": "system", "content": system}, *messages],
        )
        return response.choices[0].message.content
    except _GroqRateLimitError:
        # Groq rate limit hit — try Claude Haiku, but handle missing credits gracefully
        try:
            return _call_anthropic('claude-haiku-4-5', system, messages, max_tokens)
        except Exception:
            raise RuntimeError("I'm a bit overloaded right now — please try again in a moment! 🙏")


class CoachChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = request.data.get('message', '').strip()
        profile = request.data.get('profile', {})
        history = request.data.get('history', [])

        if not message:
            return Response({'error': 'Message is required'}, status=400)

        provider, api_key, main_model, fast_model = _get_ai_provider()
        if not api_key:
            return Response({'error': f'AI coach is not configured. Set {"ANTHROPIC_API_KEY" if provider == "anthropic" else "GROQ_API_KEY"}.'}, status=500)

        name = profile.get('name') or 'Athlete'
        goal = profile.get('fitnessGoals') or 'General Fitness'
        level = profile.get('experienceLevel') or 'Beginner'
        weight = profile.get('weight')
        height = profile.get('height')
        equipment = profile.get('equipments') or 'No Equipment'
        allergies = ', '.join(profile.get('allergies') or []) or 'None'
        injuries = ', '.join(profile.get('injuries') or []) or 'None'

        bmi = None
        if weight and height:
            bmi = round(weight / ((height / 100) ** 2), 1)

        system = f"""You are IRON, a highly personalized AI fitness coach inside the IronBuddy app.
You speak with energy, motivation and expertise. Keep responses concise and actionable.

Athlete profile:
- Name: {name}
- Goal: {goal}
- Experience level: {level}
- Weight: {f'{weight} kg' if weight else 'unknown'}
- Height: {f'{height} cm' if height else 'unknown'}
- BMI: {bmi if bmi else 'unknown'}
- Equipment: {equipment}
- Allergies: {allergies}
- Injuries: {injuries}

Always tailor advice to this specific profile. Reference the athlete's name occasionally.
If injuries are present, always account for them in any exercise recommendations.

CRITICAL RULES — follow these strictly:
1. NEVER provide a workout plan, exercise routine, or meal plan unless the user's current message explicitly and directly asks for one. Greetings, small talk, questions, or feedback do NOT count as a request for a workout or meal plan.
2. Do NOT reference or continue any previous workout plan or meal plan from the chat history unless the user asks about it.
3. If the user just says "hi", "hello", or makes small talk — respond warmly and briefly. Nothing more.
4. Only when the user explicitly requests a workout, provide it with sets/reps AND append [SAVE_WORKOUT] on its own line at the very end.
5. Only when the user explicitly requests a meal or meal plan, provide it with a full ingredient list (including spices, seasonings, and cooking staples like salt, pepper, oil, garlic, etc.) AND step-by-step preparation instructions. Append [SAVE_MEAL] on its own line at the very end."""

        messages = [
            {"role": m['role'], "content": m['content']}
            for m in history
            if m.get('role') in ('user', 'assistant') and m.get('content')
        ]
        messages.append({"role": "user", "content": message})

        try:
            import json, re as _re
            reply = _chat_completion(provider, api_key, main_model, system, messages, max_tokens=1024)

            # ── Tag-based detection ──
            _has_workout_content = bool(
                _re.search(r'\b\d+\s*(sets?|sätze|wiederholungen|reps?)\b', reply, _re.IGNORECASE) or
                _re.search(r'\b(sets?|sätze)\s*[xX×]\s*\d+', reply, _re.IGNORECASE) or
                _re.search(r'\b\d+\s*[xX×]\s*\d+', reply)
            )
            save_prompt = None
            if '[SAVE_WORKOUT]' in reply and _has_workout_content:
                clean_reply = _re.sub(r'\s*\[SAVE_WORKOUT\]\s*', '', reply).strip()
                extract_prompt = f"""Extract the workout from this coach message and return ONLY valid JSON, no markdown:
{{"type":"workout","label":"<short workout name>","data":{{"name":"<name>","description":"<muscle focus>","exercises":[{{"name":"<exercise name>","sets":<number>,"reps":"<reps>","rest":"<rest>","muscle":"<muscle group>","notes":""}}]}}}}
Coach message:
{clean_reply}"""
                save_prompt = {
                    "type": "workout",
                    "label": "Coach Workout",
                    "data": {"name": "Coach Workout", "description": clean_reply[:200], "exercises": []}
                }
                try:
                    raw = _chat_completion(provider, api_key, fast_model, 'Return ONLY valid JSON, no markdown, no extra text.', [{"role": "user", "content": extract_prompt}], max_tokens=1200)
                    raw = _re.sub(r'^```(?:json)?\s*', '', raw.strip())
                    raw = _re.sub(r'\s*```$', '', raw)
                    save_prompt = json.loads(raw)
                except Exception:
                    pass
                reply = clean_reply

            elif '[SAVE_MEAL]' in reply:
                clean_reply = _re.sub(r'\s*\[SAVE_MEAL\]\s*', '', reply).strip()
                extract_prompt = f"""Extract the meal from this coach message and return ONLY valid JSON, no markdown:
{{"type":"meal","label":"<short meal name>","data":{{"name":"<meal name>","description":"<brief description>","kcal":"<kcal estimate, e.g. 450 kcal>","icon":"<single food emoji>","ingredients":["<ingredient 1>","<ingredient 2>","<...>"],"steps":["<step 1>","<step 2>","<...>"]}}}}
Include ALL ingredients — main items, seasonings, and basics like salt, pepper, oil, etc. even if implied.
Include ALL preparation steps in order, as numbered or listed in the message.
Coach message:
{clean_reply}"""
                save_prompt = {
                    "type": "meal",
                    "label": "Coach Meal",
                    "data": {"name": "Coach Meal", "description": clean_reply[:200], "kcal": "—", "icon": "🍽️", "ingredients": [], "steps": []}
                }
                try:
                    raw = _chat_completion(provider, api_key, fast_model, 'Return ONLY valid JSON, no markdown, no extra text.', [{"role": "user", "content": extract_prompt}], max_tokens=1200)
                    raw = _re.sub(r'^```(?:json)?\s*', '', raw.strip())
                    raw = _re.sub(r'\s*```$', '', raw)
                    save_prompt = json.loads(raw)
                except Exception:
                    pass
                reply = clean_reply

            return Response({'reply': reply, 'save_prompt': save_prompt})
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class WorkoutPlanView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        profile = request.data.get('profile', {})

        api_key = os.environ.get('GROQ_API_KEY', '')
        if not api_key:
            return Response({'error': 'AI coach is not configured.'}, status=500)

        name   = profile.get('name') or 'Athlete'
        goal   = profile.get('fitnessGoals') or 'General Fitness'
        level  = profile.get('experienceLevel') or 'Beginner'
        equipment = profile.get('equipments') or 'No Equipment'
        injuries  = ', '.join(profile.get('injuries') or []) or 'None'

        prompt = f"""Create a personalized weekly workout plan for:
- Name: {name}
- Goal: {goal}
- Level: {level}
- Equipment: {equipment}
- Injuries: {injuries}

Return ONLY valid JSON in this exact format, no extra text:
{{
  "plan_name": "...",
  "frequency": "X days/week",
  "goal": "{goal}",
  "days": [
    {{
      "day": "Day 1 - ...",
      "focus": "...",
      "exercises": [
        {{
          "name": "...",
          "sets": 3,
          "reps": "8-12",
          "rest": "60s",
          "muscle": "...",
          "tip": "Form cue or common mistake to avoid",
          "how_to": "Step-by-step instructions: 1. Starting position. 2. The movement. 3. Return phase. Keep each step concise."
        }}
      ]
    }}
  ]
}}
Include 3-5 workout days with 4-6 exercises each. For how_to, write 2-4 clear numbered steps explaining how to perform the exercise correctly."""

        import json, re
        try:
            client = Groq(api_key=api_key)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=5000,
                messages=[
                    {"role": "system", "content": "You are a professional fitness coach. Always respond with valid JSON only, no markdown, no explanation."},
                    {"role": "user", "content": prompt},
                ],
            )
            raw = response.choices[0].message.content.strip()
            # Strip markdown code fences if present
            raw = re.sub(r'^```(?:json)?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw).strip()
            plan = json.loads(raw)
            return Response({'plan': plan})
        except json.JSONDecodeError as e:
            return Response({'error': f'AI returned invalid JSON: {str(e)}'}, status=500)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data)

    def put(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


class CustomWorkoutListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workouts = CustomWorkout.objects.filter(user=request.user)
        serializer = CustomWorkoutSerializer(workouts, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CustomWorkoutSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class CustomWorkoutDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        try:
            return CustomWorkout.objects.get(pk=pk, user=user)
        except CustomWorkout.DoesNotExist:
            return None

    def put(self, request, pk):
        workout = self.get_object(pk, request.user)
        if not workout:
            return Response({'error': 'Not found'}, status=404)
        serializer = CustomWorkoutSerializer(workout, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        workout = self.get_object(pk, request.user)
        if not workout:
            return Response({'error': 'Not found'}, status=404)
        workout.delete()
        return Response(status=204)


class CustomMealListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        meals = CustomMeal.objects.filter(user=request.user)
        serializer = CustomMealSerializer(meals, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CustomMealSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class CustomMealDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        try:
            return CustomMeal.objects.get(pk=pk, user=user)
        except CustomMeal.DoesNotExist:
            return None

    def put(self, request, pk):
        meal = self.get_object(pk, request.user)
        if not meal:
            return Response({'error': 'Not found'}, status=404)
        serializer = CustomMealSerializer(meal, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        meal = self.get_object(pk, request.user)
        if not meal:
            return Response({'error': 'Not found'}, status=404)
        meal.delete()
        return Response(status=204)


class UserRecipeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        recipes = UserRecipe.objects.filter(user=request.user)
        serializer = UserRecipeSerializer(recipes, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = UserRecipeSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class UserRecipeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            recipe = UserRecipe.objects.get(pk=pk, user=request.user)
        except UserRecipe.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        recipe.delete()
        return Response(status=204)


class WorkoutVideoListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        videos = WorkoutVideo.objects.filter(user=request.user)
        serializer = WorkoutVideoSerializer(videos, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = WorkoutVideoSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class WorkoutVideoDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            video = WorkoutVideo.objects.get(pk=pk, user=request.user)
        except WorkoutVideo.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        video.delete()
        return Response(status=204)


class AIMealPlanView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        profile = request.data.get('profile', {})

        provider, api_key, main_model, _ = _get_ai_provider()
        if not api_key:
            return Response({'error': 'AI coach is not configured.'}, status=500)

        goal       = profile.get('fitnessGoals') or 'General Fitness'
        allergies  = ', '.join(profile.get('allergies') or []) or 'None'
        injuries   = ', '.join(profile.get('injuries') or []) or 'None'
        preferred  = ', '.join(profile.get('preferredIngredients') or []) or 'None'
        excluded   = ', '.join(profile.get('excludedIngredients') or []) or 'None'
        weight     = profile.get('weight')
        height     = profile.get('height')

        bmi = None
        if weight and height:
            bmi = round(weight / ((height / 100) ** 2), 1)

        prompt = f"""Create a healthy weekly meal plan for someone with the following profile:
- Fitness Goal: {goal}
- Allergies / Intolerances: {allergies}
- Injuries / Health Notes: {injuries}
- BMI: {bmi if bmi else 'unknown'}
- Preferred Ingredients (prioritise these): {preferred}
- Excluded Ingredients (never use these): {excluded}

Generate 3 options for each meal category: breakfast, lunch, dinner, and snacks.
Each meal must include exact ingredient quantities (grams, ml, pieces, tbsp etc.).

Return ONLY valid JSON in this exact format, no extra text:
{{
  "breakfast": [
    {{
      "meal": "...",
      "icon": "<single emoji>",
      "kcal": "... kcal",
      "desc": "one short sentence",
      "servings": "1 serving",
      "ingredients": ["quantity ingredient", "quantity ingredient"],
      "steps": ["Step one instruction.", "Step two instruction.", "Step three instruction."]
    }}
  ],
  "lunch": [ ...same structure, 3 items... ],
  "dinner": [ ...same structure, 3 items... ],
  "snacks": [ ...same structure, 3 items... ]
}}

Rules:
- Tailor every meal to the goal ({goal}) and avoid allergens ({allergies})
- Breakfast options should be filling and energising
- Lunch options should be balanced and practical
- Dinner options should support recovery and the fitness goal
- Snacks should be healthy and portion-controlled
- Use realistic, affordable ingredients
- Prioritise preferred ingredients ({preferred}) wherever suitable
- Never use excluded ingredients ({excluded}) or allergens ({allergies})
- Include exact gram/ml amounts for every ingredient
- Always include spices, seasonings, and cooking staples in the ingredients list (e.g. salt, black pepper, olive oil, garlic, paprika, cumin, etc.) — never omit them even if implied
- steps: 3-5 clear, numbered preparation steps written in plain language, each as a complete sentence. Include specific cooking times, temperatures, and techniques"""

        import json, re
        try:
            raw = _chat_completion(
                provider, api_key, main_model,
                "You are a professional sports nutritionist. Always respond with valid JSON only, no markdown, no explanation.",
                [{"role": "user", "content": prompt}],
                max_tokens=6000,
            ).strip()
            raw = re.sub(r'^```(?:json)?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw).strip()
            plan = json.loads(raw)
            return Response({'plan': plan})
        except json.JSONDecodeError as e:
            return Response({'error': f'AI returned invalid JSON: {str(e)}'}, status=500)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class WorkoutSessionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = WorkoutSession.objects.filter(user=request.user)
        serializer = WorkoutSessionSerializer(sessions, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = WorkoutSessionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class WorkoutSessionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        try:
            return WorkoutSession.objects.get(pk=pk, user=user)
        except WorkoutSession.DoesNotExist:
            return None

    def put(self, request, pk):
        session = self.get_object(pk, request.user)
        if not session:
            return Response({'error': 'Not found'}, status=404)
        serializer = WorkoutSessionSerializer(session, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        session = self.get_object(pk, request.user)
        if not session:
            return Response({'error': 'Not found'}, status=404)
        session.delete()
        return Response(status=204)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()
        if not email:
            return Response({'error': 'Email is required'}, status=400)
        try:
            user = User.objects.get(email__iexact=email)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            frontend_url = request.data.get('frontend_url', 'http://localhost:5173')
            reset_url = f"{frontend_url}/reset-password?uid={uid}&token={token}"
            send_mail(
                subject='IronBuddy — Password Reset',
                message=f'Hi {user.username},\n\nClick the link below to reset your IronBuddy password:\n\n{reset_url}\n\nThis link expires in 24 hours. If you did not request this, ignore this email.',
                from_email=None,  # uses DEFAULT_FROM_EMAIL from settings
                recipient_list=[user.email],
                fail_silently=False,
            )
        except User.DoesNotExist:
            pass  # Don't reveal whether the email exists
        return Response({'message': 'If that email is registered, a reset link has been sent.'})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get('uid', '')
        token = request.data.get('token', '')
        password = request.data.get('password', '')
        if not uid or not token or not password:
            return Response({'error': 'uid, token and password are required'}, status=400)
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'error': 'Invalid reset link'}, status=400)
        if not default_token_generator.check_token(user, token):
            return Response({'error': 'Reset link is invalid or has expired'}, status=400)
        user.set_password(password)
        user.save()
        return Response({'message': 'Password reset successfully'})


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get('current_password', '')
        new_password = request.data.get('new_password', '')
        if not current_password or not new_password:
            return Response({'error': 'Both current and new password are required'}, status=400)
        if not request.user.check_password(current_password):
            return Response({'error': 'Current password is incorrect'}, status=400)
        request.user.set_password(new_password)
        request.user.save()
        return Response({'message': 'Password changed successfully'})


class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        password = request.data.get('password', '')
        if not password:
            return Response({'error': 'Password is required to delete your account'}, status=400)
        if not request.user.check_password(password):
            return Response({'error': 'Incorrect password'}, status=400)
        request.user.delete()
        return Response({'message': 'Account deleted successfully'}, status=200)


class DeactivateAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = request.data.get('password', '')
        if not password:
            return Response({'error': 'Password is required to deactivate your account'}, status=400)
        if not request.user.check_password(password):
            return Response({'error': 'Incorrect password'}, status=400)
        request.user.is_active = False
        request.user.save()
        return Response({'message': 'Account deactivated successfully'}, status=200)


class ReactivatingTokenView(APIView):
    """Custom login that reactivates deactivated accounts on sign-in."""
    permission_classes = [AllowAny]

    def post(self, request):
        from rest_framework_simplejwt.tokens import RefreshToken
        username = request.data.get('username', '')
        password = request.data.get('password', '')
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'detail': 'No active account found with the given credentials'}, status=401)
        if not user.check_password(password):
            return Response({'detail': 'No active account found with the given credentials'}, status=401)
        # Reactivate if deactivated
        if not user.is_active:
            user.is_active = True
            user.save()
        refresh = RefreshToken.for_user(user)
        return Response({'access': str(refresh.access_token), 'refresh': str(refresh)})


class UserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.exclude(id=request.user.id).select_related('profile').filter(profile__community_visible=True)
        serializer = PublicUserSerializer(users, many=True)
        return Response(serializer.data)


class UserSearchView(APIView):
    """Find a user by exact email address."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        email = request.query_params.get('email', '').strip()
        if not email:
            return Response({'error': 'email parameter is required'}, status=400)
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({'error': 'No user found with that email'}, status=404)
        if user == request.user:
            return Response({'error': 'That is your own account'}, status=400)
        serializer = PublicUserSerializer(user)
        return Response(serializer.data)


class UserDetailView(APIView):
    """Get a single user's public info by ID (used after QR scan)."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)
        if user == request.user:
            return Response({'error': 'That is your own account'}, status=400)
        serializer = PublicUserSerializer(user)
        return Response(serializer.data)


class ConversationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        convos = Conversation.objects.filter(participants=request.user)
        serializer = ConversationSerializer(convos, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        other_user_id = request.data.get('user_id')
        try:
            other_user = User.objects.get(id=other_user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)
        convo = Conversation.objects.filter(participants=request.user).filter(participants=other_user).first()
        if not convo:
            convo = Conversation.objects.create()
            convo.participants.add(request.user, other_user)
        serializer = ConversationSerializer(convo, context={'request': request})
        return Response(serializer.data)


class MessageListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            convo = Conversation.objects.get(pk=pk, participants=request.user)
        except Conversation.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        for msg in convo.messages.exclude(sender=request.user).exclude(read_by=request.user):
            msg.read_by.add(request.user)
        serializer = MessageSerializer(convo.messages.all(), many=True)
        return Response(serializer.data)

    def post(self, request, pk):
        try:
            convo = Conversation.objects.get(pk=pk, participants=request.user)
        except Conversation.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        content   = request.data.get('content', '').strip()
        file_url  = request.data.get('file_url', '').strip()
        file_type = request.data.get('file_type', '').strip()
        file_name = request.data.get('file_name', '').strip()
        if not content and not file_url:
            return Response({'error': 'Content or file is required'}, status=400)
        msg = Message.objects.create(
            conversation=convo,
            sender=request.user,
            content=content,
            file_url=file_url,
            file_type=file_type,
            file_name=file_name,
        )
        convo.save()
        serializer = MessageSerializer(msg)
        return Response(serializer.data, status=201)



class MessageReactionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """Toggle a reaction. Adds if not present, removes if already reacted with same emoji."""
        try:
            msg = Message.objects.get(pk=pk, conversation__participants=request.user)
        except Message.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        emoji = request.data.get('emoji', '').strip()
        if not emoji:
            return Response({'error': 'emoji is required'}, status=400)
        reaction, created = MessageReaction.objects.get_or_create(
            message=msg, user=request.user, emoji=emoji
        )
        if not created:
            reaction.delete()
        # Return updated reactions for this message
        from collections import defaultdict
        grouped = defaultdict(list)
        for r in msg.reactions.select_related('user').all():
            grouped[r.emoji].append(r.user.id)
        reactions = [{'emoji': e, 'count': len(uids), 'user_ids': uids} for e, uids in grouped.items()]
        return Response({'message_id': msg.id, 'reactions': reactions})


class ConversationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            convo = Conversation.objects.get(pk=pk, participants=request.user)
        except Conversation.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        convo.participants.remove(request.user)
        # If no participants remain, delete the conversation entirely
        if convo.participants.count() == 0:
            convo.delete()
        return Response(status=204)


class MessageDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            msg = Message.objects.get(pk=pk, sender=request.user)
        except Message.DoesNotExist:
            return Response({'error': 'Not found or not your message'}, status=404)
        conversation_id = msg.conversation_id
        msg.delete()
        return Response({'conversation_id': conversation_id})


class WeightLogListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logs = WeightLog.objects.filter(user=request.user)
        return Response(WeightLogSerializer(logs, many=True).data)

    def post(self, request):
        serializer = WeightLogSerializer(data=request.data)
        if serializer.is_valid():
            # upsert: update if entry for this date already exists
            obj, _ = WeightLog.objects.update_or_create(
                user=request.user,
                logged_at=serializer.validated_data['logged_at'],
                defaults={'weight': serializer.validated_data['weight']},
            )
            return Response(WeightLogSerializer(obj).data, status=201)
        return Response(serializer.errors, status=400)


class WeightLogDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            log = WeightLog.objects.get(pk=pk, user=request.user)
        except WeightLog.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        log.delete()
        return Response(status=204)
