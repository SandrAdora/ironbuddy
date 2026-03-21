from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .serializers import UserSerializer, UserProfileSerializer, CustomWorkoutSerializer, CustomMealSerializer, UserRecipeSerializer, WorkoutVideoSerializer, PublicUserSerializer, ConversationSerializer, MessageSerializer, WorkoutSessionSerializer, WeightLogSerializer, BodyMeasurementSerializer
from .models import UserProfile, CustomWorkout, CustomMeal, UserRecipe, WorkoutVideo, Conversation, Message, WorkoutSession, MessageReaction, WeightLog, BodyMeasurement
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


def _call_anthropic(model, system, messages, max_tokens, temperature=0.4):
    import anthropic as _anthropic
    api_key = os.environ.get('ANTHROPIC_API_KEY', '')
    if not api_key:
        raise RuntimeError('ANTHROPIC_API_KEY not set')
    client = _anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=messages,
    )
    return next(b.text for b in response.content if b.type == 'text')


def _chat_completion(provider, api_key, model, system, messages, max_tokens=1024, temperature=0.4):
    """Call the appropriate AI provider, falling back to Haiku on Groq rate limit."""
    if provider == 'anthropic':
        return _call_anthropic(model, system, messages, max_tokens, temperature)

    # Groq — with automatic Haiku fallback on rate limit
    from groq import RateLimitError as _GroqRateLimitError
    try:
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[{"role": "system", "content": system}, *messages],
        )
        return response.choices[0].message.content
    except _GroqRateLimitError:
        try:
            return _call_anthropic('claude-haiku-4-5', system, messages, max_tokens, temperature)
        except Exception:
            raise RuntimeError("I'm a bit overloaded right now — please try again in a moment! 🙏")


class CoachChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import json, re as _re
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

        language_map = {
            'de': 'German',
            'fr': 'French',
            'es': 'Spanish',
            'hu': 'Hungarian',
            'en': 'English',
        }
        language_name = language_map.get(profile.get('language', 'en'), 'English')

        bmi = None
        if weight and height:
            bmi = round(weight / ((height / 100) ** 2), 1)

        system = f"""You are IRON, a highly personalized AI fitness coach inside the IronBuddy app.
You speak with energy, motivation and expertise. Keep responses concise and actionable.

LANGUAGE: You MUST respond exclusively in {language_name}. Every single message must be in {language_name}.

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

Always tailor advice to this profile. Account for injuries in all exercise recommendations.

══════════════════════════════════════════════
ANTI-HALLUCINATION RULES — follow strictly:

• Only state facts you are confident about. If you are unsure, say so explicitly
  (e.g. "I'm not certain, but…" or "You may want to verify this with a professional.").
• Never invent specific statistics, study citations, percentages, or scientific claims
  unless they are well-established general knowledge (e.g. "protein helps muscle repair").
• Never make up product names, supplement brands, or specific calorie counts for
  individual branded foods — use general estimates instead.
• Base all advice on the athlete profile above. Do not assume facts about the user
  that are not listed (e.g. do not assume their diet, sleep schedule, or other habits).
• If you don't know something relevant (e.g. a specific exercise for an unusual injury),
  say "I'm not sure about that specifically — please consult a physiotherapist."
• Keep responses grounded: prefer simple, proven advice over complex or trendy claims.

══════════════════════════════════════════════
STRICT CONTENT RULES — these override everything else:

RULE A — WORKOUT PLAN:
• You may ONLY output a workout plan (with exercises, sets, reps) AND the tag [SAVE_WORKOUT]
  when the user's message contains a DIRECT, UNAMBIGUOUS request such as:
  "give me a workout", "create a workout plan", "erstelle mir einen Trainingsplan",
  "I want to train today", "make me a workout", or equivalent phrasing in any language.
• Greetings ("hi", "hey", "hello", "hallo"), questions ("how are you?"), compliments,
  check-ins, or ANY message that does not explicitly ask for a workout → NO workout, NO [SAVE_WORKOUT].

RULE B — MEAL PLAN / RECIPE:
• You may ONLY output a meal, recipe, or nutrition plan AND the tag [SAVE_MEAL]
  when the user's message contains a DIRECT, UNAMBIGUOUS request such as:
  "give me a meal plan", "what should I eat", "create a recipe for me",
  "erstelle mir einen Ernährungsplan", "make me a healthy meal", or equivalent.
• Greetings, small talk, workout questions, or ANY message that does not explicitly ask
  for a meal/recipe → NO meal content, NO [SAVE_MEAL].

RULE C — DEFAULT BEHAVIOR:
• For greetings or small talk: respond warmly in 1–2 sentences. Nothing more.
• For fitness questions: answer concisely without offering unsolicited plans.
• NEVER proactively suggest creating a plan unless directly asked.
══════════════════════════════════════════════"""

        messages = [
            {"role": m['role'], "content": m['content']}
            for m in history
            if m.get('role') in ('user', 'assistant') and m.get('content')
        ]
        messages.append({"role": "user", "content": message})

        # ── Explicit-request detection ───────────────────────────────────────
        # Only inject recipes / allow [SAVE_*] tags when the user has made an
        # unambiguous request.  Greetings and general questions must NOT trigger plans.
        _EXPLICIT_MEAL_PATTERNS = (
            r'\b(erstell|mach|gib|zeig|schlage vor|ich will|ich möchte|kannst du mir).{0,30}(rezept|mahlzeit|ernährung|essen|plan)',
            r'\b(create|give me|make me|suggest|i want|i need|what should i eat|plan).{0,30}(meal|recipe|nutrition|food|eat)',
            r'\b(rezept|ernährungsplan|mahlzeitenplan|meal plan)\b',
            r'\bwas soll ich (heute |)essen\b',
        )
        _EXPLICIT_WORKOUT_PATTERNS = (
            r'\b(erstell|mach|gib|zeig|ich will|ich möchte|kannst du mir).{0,30}(workout|training|trainingsplan|übung)',
            r'\b(create|give me|make me|i want|i need).{0,30}(workout|training plan|exercise)',
            r'\b(trainingsplan|workout plan|workout routine)\b',
        )
        _MEAL_TYPE_MAP = {
            'frühstück': 'breakfast', 'breakfast': 'breakfast',
            'mittagessen': 'lunch',   'lunch': 'lunch',
            'abendessen': 'dinner',   'dinner': 'dinner',
            'snack': 'snack',
        }
        msg_lower = message.lower()
        is_explicit_meal    = any(_re.search(p, msg_lower) for p in _EXPLICIT_MEAL_PATTERNS)
        is_explicit_workout = any(_re.search(p, msg_lower) for p in _EXPLICIT_WORKOUT_PATTERNS)
        is_meal_request = is_explicit_meal

        recipe_context = ''
        if is_meal_request:
            detected_meal_type = next(
                (v for k, v in _MEAL_TYPE_MAP.items() if k in msg_lower),
                'dinner',
            )
            try:
                hits = _search_all_recipe_sites(
                    f'{goal} {_MEAL_TYPE_DE.get(detected_meal_type, detected_meal_type)}',
                    detected_meal_type,
                    count_per_site=4,
                )
                recipes_text = []
                for r in hits[:10]:
                    url = r.get('href', '')
                    title = r.get('title', '').strip()
                    data = _fetch_recipe(url)
                    if data:
                        recipes_text.append(_format_recipe(data, title))
                        if len(recipes_text) >= 3:
                            break
                    elif title and len(recipes_text) < 3:
                        recipes_text.append(f'RECIPE: {title}')
                if recipes_text:
                    recipe_context = (
                        '\n\n=== REAL RECIPES FROM THE WEB (use these, do not invent) ===\n'
                        + '\n\n'.join(recipes_text)
                        + '\n=== END OF RECIPES ==='
                    )
            except Exception:
                pass

        if recipe_context:
            # Inject recipe context into the last user message
            messages[-1]['content'] = message + recipe_context

        try:
            reply = _chat_completion(provider, api_key, main_model, system, messages, max_tokens=1024)

            # ── Server-side guard: strip tags the LLM produced without permission ──
            # If the user did not explicitly request a workout, remove [SAVE_WORKOUT]
            # and any accidental workout content the LLM hallucinated.
            if not is_explicit_workout:
                reply = _re.sub(r'\s*\[SAVE_WORKOUT\]\s*', '', reply).strip()
            if not is_explicit_meal:
                reply = _re.sub(r'\s*\[SAVE_MEAL\]\s*', '', reply).strip()

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


import re as _re
import random
import json as _json
import requests as _requests

# Rotates each call so the AI is forced to explore different cuisines
_CUISINE_POOL = [
    'Mediterranean', 'Asian', 'Mexican', 'Middle Eastern', 'Japanese',
    'Indian', 'Italian', 'Greek', 'Thai', 'Turkish', 'Korean', 'French',
    'American', 'Spanish', 'Moroccan', 'Vietnamese', 'Lebanese',
]


def _extract_recipe_jsonld(html: str) -> dict | None:
    """Extract schema.org/Recipe JSON-LD from a page's HTML."""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = _json.loads(script.string or '')
                # Unwrap @graph arrays
                if isinstance(data, dict) and data.get('@graph'):
                    data = next((x for x in data['@graph'] if x.get('@type') == 'Recipe'), None)
                if isinstance(data, list):
                    data = next((x for x in data if isinstance(x, dict) and x.get('@type') == 'Recipe'), None)
                if isinstance(data, dict) and data.get('@type') == 'Recipe':
                    return data
            except Exception:
                continue
    except Exception:
        pass
    return None


def _fetch_recipe(url: str) -> dict | None:
    """Fetch a URL and try to extract a structured recipe from it."""
    try:
        resp = _requests.get(
            url, timeout=5,
            headers={'User-Agent': 'Mozilla/5.0 (compatible; IronBuddy/1.0; recipe-fetcher)'},
            allow_redirects=True,
        )
        if not resp.ok:
            return None
        return _extract_recipe_jsonld(resp.text)
    except Exception:
        return None


def _format_recipe(data: dict, fallback_title: str = '') -> str:
    """Convert a schema.org Recipe dict into a compact text block for the prompt."""
    name = data.get('name') or fallback_title
    raw_ingredients = data.get('recipeIngredient') or []
    ingredients = raw_ingredients[:16]

    raw_instructions = data.get('recipeInstructions') or []
    steps = []
    for instr in raw_instructions[:6]:
        if isinstance(instr, str):
            steps.append(instr.strip())
        elif isinstance(instr, dict):
            text = (instr.get('text') or '').strip()
            if text:
                steps.append(text)

    lines = [f'RECIPE: {name}']
    if ingredients:
        lines.append('Ingredients: ' + ' | '.join(ingredients))
    if steps:
        lines.append('Steps: ' + ' → '.join(steps))
    return '\n'.join(lines)


def _search_google(query: str, count: int = 6) -> list:
    """Search Google via Serper.dev. Returns list of {title, href} dicts, or [] if no key."""
    api_key = os.environ.get('SERPER_API_KEY', '').strip()
    if not api_key:
        return []
    try:
        resp = _requests.post(
            'https://google.serper.dev/search',
            headers={'X-API-KEY': api_key, 'Content-Type': 'application/json'},
            json={'q': query, 'num': count},
            timeout=8,
        )
        if not resp.ok:
            return []
        return [
            {'title': item.get('title', ''), 'href': item.get('link', '')}
            for item in resp.json().get('organic', [])[:count]
            if item.get('link')
        ]
    except Exception:
        return []


def _search_ddg(query: str, count: int = 6) -> list:
    """Search DuckDuckGo. Returns list of {title, href} dicts."""
    try:
        from ddgs import DDGS
        results = DDGS().text(query, max_results=count, region='wt-wt', safesearch='moderate')
        return [
            {'title': r.get('title', ''), 'href': r.get('href', '')}
            for r in (results or [])
            if r.get('href')
        ]
    except Exception:
        return []


_MEAL_TYPE_DE = {
    'breakfast': 'Frühstück',
    'lunch':     'Mittagessen',
    'dinner':    'Abendessen',
    'snack':     'Snack',
}


# ── Multi-site recipe scraper ─────────────────────────────────────────────────

# eat.de category pages by meal type (static, no search needed)
_EAT_DE_CATEGORIES = {
    'breakfast': 'https://eat.de/rezeptidee/fruehstueck/',
    'lunch':     'https://eat.de/rezeptidee/mittagessen/',
    'dinner':    'https://eat.de/rezeptidee/abendessen/',
    'snack':     'https://eat.de/rezeptidee/snacks/',
}


def _scrape_links(url: str, pattern: str, base: str = '', count: int = 8,
                  strip_params: bool = False) -> list:
    """Fetch a page and extract all links matching `pattern`."""
    try:
        from bs4 import BeautifulSoup
        resp = _requests.get(
            url, timeout=10,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': 'de-DE,de;q=0.9',
            },
            allow_redirects=True,
        )
        if not resp.ok:
            return []
        soup = BeautifulSoup(resp.text, 'html.parser')
        results, seen = [], set()
        for a in soup.find_all('a', href=True):
            href = a['href']
            full = href if href.startswith('http') else (base + href)
            if strip_params:
                full = full.split('#')[0]
                full = _re.sub(r'\?ck_.*', '', full)
            if _re.search(pattern, full) and full not in seen:
                seen.add(full)
                slug = full.rstrip('/').split('/')[-1].replace('.html', '').replace('-', ' ')
                results.append({'title': slug.strip(), 'href': full})
                if len(results) >= count:
                    break
        return results
    except Exception:
        return []


def _search_chefkoch(query: str, count: int = 8) -> list:
    slug = _re.sub(r'\s+', '+', query.strip())
    return _scrape_links(
        f'https://www.chefkoch.de/rs/s0/{slug}/Rezepte.html',
        pattern=r'https://www\.chefkoch\.de/rezepte/\d+/',
        base='https://www.chefkoch.de',
        count=count, strip_params=True,
    )


def _search_eat_de(meal_type: str, count: int = 6) -> list:
    cat_url = _EAT_DE_CATEGORIES.get(meal_type.lower(), 'https://eat.de/rezeptidee/mittagessen/')
    return _scrape_links(
        cat_url,
        pattern=r'https://eat\.de/rezept/[a-z0-9-]+/',
        base='https://eat.de',
        count=count,
    )


def _search_via_ddg_google(query: str, site: str, count: int = 5) -> list:
    """Search a specific site via DuckDuckGo + Google."""
    q = f'site:{site} {query}'
    return _search_ddg(q, count=count) + _search_google(q, count=count)


def _search_all_recipe_sites(query: str, meal_type: str, count_per_site: int = 6) -> list:
    """Parallel search across chefkoch.de, eat.de, lecker-rezepte.de, penny.de."""
    import concurrent.futures as _futures

    def ck():  return _search_chefkoch(query, count=count_per_site)
    def eat(): return _search_eat_de(meal_type, count=count_per_site)
    def lecker(): return _search_via_ddg_google(query, 'lecker-rezepte.de', count=count_per_site)
    def penny():  return _search_via_ddg_google(query, 'penny.de/clever-kochen', count=count_per_site)

    with _futures.ThreadPoolExecutor(max_workers=4) as ex:
        futs = [ex.submit(fn) for fn in (ck, eat, lecker, penny)]
        site_results = [f.result() for f in futs]

    # Round-robin interleave so no site dominates
    combined, seen = [], set()
    max_len = max((len(r) for r in site_results), default=0)
    for i in range(max_len):
        for bucket in site_results:
            if i < len(bucket):
                url = bucket[i].get('href', '')
                if url and url not in seen:
                    seen.add(url)
                    combined.append(bucket[i])
    return combined


def _search_meal_recipes(meal_type: str, goal: str, cuisine: str, allergies: str) -> str:
    """Search all recipe sites in parallel, fall back to DDG/Google if needed."""
    allergy_part = f' ohne {allergies}' if allergies and allergies != 'None' else ''
    meal_de = _MEAL_TYPE_DE.get(meal_type.lower(), meal_type)
    query = f'{cuisine} {meal_de}{allergy_part}'

    combined = _search_all_recipe_sites(query, meal_type, count_per_site=6)

    # Deduplicate by URL
    seen_urls = set()
    deduped = []
    for r in combined:
        url = r.get('href', '')
        if url and url not in seen_urls:
            seen_urls.add(url)
            deduped.append(r)
    combined = deduped

    recipes_text = []
    for r in combined[:10]:
        url   = r.get('href', '')
        title = r.get('title', '').strip()
        data  = _fetch_recipe(url)
        if data:
            recipes_text.append(_format_recipe(data, title))
            if len(recipes_text) >= 3:
                break
        elif title and len(recipes_text) < 3:
            recipes_text.append(f'RECIPE: {title}')

    return '\n\n'.join(recipes_text) if recipes_text else ''


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
        language   = profile.get('language') or 'en'
        LANGUAGE_NAMES = {'en': 'English', 'de': 'German', 'fr': 'French', 'es': 'Spanish', 'hu': 'Hungarian'}
        language_name = LANGUAGE_NAMES.get(language, 'English')

        bmi = None
        if weight and height:
            bmi = round(weight / ((height / 100) ** 2), 1)

        # Pick 3 different cuisines at random to force variety across meal types
        cuisines = random.sample(_CUISINE_POOL, 3)

        # Search the web for real recipe ideas — one query per meal type
        breakfast_hits = _search_meal_recipes('breakfast', goal, cuisines[0], allergies)
        lunch_hits     = _search_meal_recipes('lunch',     goal, cuisines[1], allergies)
        dinner_hits    = _search_meal_recipes('dinner',    goal, cuisines[2], allergies)
        snack_hits     = _search_meal_recipes('snack',     goal, random.choice(_CUISINE_POOL), allergies)

        prompt = f"""You are a world-class sports nutritionist. Your job is to turn real internet recipes into a structured meal plan.

CRITICAL: Respond entirely in {language_name}. Every word — names, ingredients, steps — must be in {language_name}.

=== USER PROFILE ===
- Goal: {goal}  |  BMI: {bmi if bmi else 'unknown'}
- Allergies (NEVER use): {allergies}
- Excluded ingredients (NEVER use): {excluded}
- Preferred ingredients (use when possible): {preferred}
- Injuries: {injuries}

=== REAL RECIPES FROM THE INTERNET ===
Below are actual recipes scraped from the web right now.
YOUR TASK: convert these exact recipes into the JSON format.
- Keep the original recipe name (translated to {language_name})
- Keep the original ingredients — just add exact gram/ml quantities if missing
- Keep the original preparation steps — just translate them to {language_name}
- If an ingredient conflicts with allergies/excluded list, substitute a safe alternative

--- BREAKFAST recipes (cuisine: {cuisines[0]}) ---
{breakfast_hits or f'Create 3 original {cuisines[0]}-style healthy breakfast recipes for {goal}'}

--- LUNCH recipes (cuisine: {cuisines[1]}) ---
{lunch_hits or f'Create 3 original {cuisines[1]}-style healthy lunch recipes for {goal}'}

--- DINNER recipes (cuisine: {cuisines[2]}) ---
{dinner_hits or f'Create 3 original {cuisines[2]}-style healthy dinner recipes for {goal}'}

--- SNACK recipes ---
{snack_hits or f'Create 3 original healthy snack recipes for {goal}'}

=== OUTPUT FORMAT ===
Pick 3 recipes per category from the above. Return ONLY valid JSON, no markdown:
{{
  "breakfast": [
    {{
      "meal": "recipe name in {language_name}",
      "icon": "<single relevant emoji>",
      "kcal": <integer, total calories calculated from ingredients>,
      "protein_g": <integer, total protein in grams>,
      "carbs_g": <integer, total carbohydrates in grams>,
      "fat_g": <integer, total fat in grams>,
      "desc": "one appetising sentence in {language_name}",
      "servings": "1 serving",
      "ingredients": ["200g chicken breast", "2 tbsp olive oil", "1 tsp cumin", "..."],
      "steps": ["Heat pan over medium heat for 2 min.", "Add oil and chicken, cook 6 min per side.", "..."]
    }}
  ],
  "lunch": [ ...same structure, 3 items... ],
  "dinner": [ ...same structure, 3 items... ],
  "snacks": [ ...same structure, 3 items... ]
}}

RULES:
- ingredients: always include exact amounts (g, ml, tbsp, tsp, pieces) — never omit spices/oils/seasonings
- steps: 3–5 steps, each a full sentence with cooking time and temperature where relevant
- 3 distinct dishes per category — no repetition across the whole plan
- CALORIE CALCULATION: for each ingredient, estimate its calories using standard nutritional data.
  Use these macronutrient densities: protein = 4 kcal/g, carbohydrates = 4 kcal/g, fat = 9 kcal/g.
  Sum all ingredients → that total is "kcal". Also output the summed protein_g, carbs_g, fat_g.
  Example: 200g chicken breast (31g protein/100g → 62g protein = 248 kcal) + 15ml olive oil (100% fat → 14g fat = 126 kcal) = 374 kcal total.
  kcal, protein_g, carbs_g, fat_g must all be plain integers — no units, no strings."""

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


class ContactView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        name    = request.data.get('name', '').strip()
        email   = request.data.get('email', '').strip()
        message = request.data.get('message', '').strip()

        if not name or not email or not message:
            return Response({'error': 'All fields are required.'}, status=400)

        contact_email = os.environ.get('CONTACT_EMAIL') or os.environ.get('EMAIL_HOST_USER', '')
        if not contact_email:
            return Response({'error': 'Contact email not configured.'}, status=500)

        try:
            send_mail(
                subject=f'IronBuddy Contact — {name}',
                message=f'From: {name} <{email}>\n\n{message}',
                from_email=None,
                recipient_list=[contact_email],
                fail_silently=False,
            )
        except Exception as e:
            return Response({'error': str(e)}, status=500)

        return Response({'message': 'Your message has been sent!'})


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
            profile = getattr(request.user, 'profile', None)
            if profile and not profile.community_visible:
                return Response({'error': 'You cannot start new conversations while your profile is hidden.'}, status=403)
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


class BodyMeasurementListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        measurements = BodyMeasurement.objects.filter(user=request.user)
        return Response(BodyMeasurementSerializer(measurements, many=True).data)

    def post(self, request):
        serializer = BodyMeasurementSerializer(data=request.data)
        if serializer.is_valid():
            obj, _ = BodyMeasurement.objects.update_or_create(
                user=request.user,
                logged_at=serializer.validated_data['logged_at'],
                defaults={k: v for k, v in serializer.validated_data.items() if k != 'logged_at'},
            )
            return Response(BodyMeasurementSerializer(obj).data, status=201)
        return Response(serializer.errors, status=400)


class BodyMeasurementDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            m = BodyMeasurement.objects.get(pk=pk, user=request.user)
        except BodyMeasurement.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        m.delete()
        return Response(status=204)


# ── Exercise Library ──────────────────────────────────────────────────────────

import requests as _http

BODY_PARTS = [
    'back', 'cardio', 'chest', 'lower arms', 'lower legs',
    'neck', 'shoulders', 'upper arms', 'upper legs', 'waist',
]

def _fetch_all_exercises_from_api():
    """Fetch exercises from ExerciseDB per body part and save to local DB."""
    from .models import Exercise

    api_key = os.environ.get('EXERCISE_DB', '')
    if not api_key:
        return False, 'EXERCISE_DB API key not set'

    headers = {
        'X-RapidAPI-Key': api_key,
        'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
    }

    all_exercises = []
    for body_part in BODY_PARTS:
        try:
            resp = _http.get(
                f'https://exercisedb.p.rapidapi.com/exercises/bodyPart/{body_part.replace(" ", "%20")}',
                headers=headers,
                params={'limit': '50', 'offset': '0'},
                timeout=15,
            )
            if resp.ok:
                all_exercises.extend(resp.json() if isinstance(resp.json(), list) else [])
        except Exception:
            continue

    if not all_exercises:
        return False, 'No exercises returned from ExerciseDB API'

    to_create = []
    for ex in all_exercises:
        to_create.append(Exercise(
            exercise_id=ex.get('id', ''),
            name=ex.get('name', ''),
            body_part=ex.get('bodyPart', ''),
            target=ex.get('target', ''),
            secondary_muscles=ex.get('secondaryMuscles', []),
            equipment=ex.get('equipment', ''),
            gif_url=ex.get('gifUrl', ''),
            instructions=ex.get('instructions', []),
        ))

    Exercise.objects.bulk_create(to_create, ignore_conflicts=True)
    return True, len(to_create)


class ExerciseListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import Exercise
        from .serializers import ExerciseSerializer

        # Seed DB on first use
        if not Exercise.objects.exists():
            ok, result = _fetch_all_exercises_from_api()
            if not ok:
                return Response({'error': result}, status=502)

        qs = Exercise.objects.all()

        body_part = request.query_params.get('body_part', '').strip()
        target    = request.query_params.get('target', '').strip()
        equipment = request.query_params.get('equipment', '').strip()
        search    = request.query_params.get('search', '').strip()

        if body_part:
            qs = qs.filter(body_part__iexact=body_part)
        if target:
            qs = qs.filter(target__iexact=target)
        if equipment:
            qs = qs.filter(equipment__iexact=equipment)
        if search:
            qs = qs.filter(name__icontains=search)

        # Pagination
        limit  = int(request.query_params.get('limit', 20))
        offset = int(request.query_params.get('offset', 0))
        total  = qs.count()
        page   = qs[offset:offset + limit]

        serializer = ExerciseSerializer(page, many=True)
        return Response({'count': total, 'results': serializer.data})


class ExerciseDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, exercise_id):
        from .models import Exercise
        from .serializers import ExerciseSerializer
        try:
            ex = Exercise.objects.get(exercise_id=exercise_id)
        except Exercise.DoesNotExist:
            return Response({'error': 'Exercise not found'}, status=404)
        return Response(ExerciseSerializer(ex).data)


class ExerciseMetaView(APIView):
    """Returns lists of unique body_parts, targets, and equipment for filter dropdowns."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import Exercise
        from django.db.models import functions

        if not Exercise.objects.exists():
            ok, result = _fetch_all_exercises_from_api()
            if not ok:
                return Response({'error': result}, status=502)

        body_parts = sorted(set(Exercise.objects.values_list('body_part', flat=True)))
        targets    = sorted(set(Exercise.objects.values_list('target', flat=True)))
        equipment  = sorted(set(Exercise.objects.values_list('equipment', flat=True)))

        return Response({
            'body_parts': [b for b in body_parts if b],
            'targets':    [t for t in targets if t],
            'equipment':  [e for e in equipment if e],
        })
