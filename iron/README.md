# IronBuddy

A full-stack AI-powered fitness companion web app. Includes an AI coach, workout planning, meal planning, progress tracking, community chat, and wearable integration.

---

## Tech Stack

**Frontend**
- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Framer Motion (animations)
- Recharts (charts)
- i18next (internationalization)
- FontAwesome icons

**Backend**
- Django 6 + Django REST Framework
- SimpleJWT authentication
- Groq (llama-3.3-70b-versatile) for all AI features
- SQLite database
- Socket.IO Node server for real-time community chat and file uploads

---

## Getting Started

### Backend

```bash
cd backend/backend
source ../.iron/bin/activate
python manage.py runserver 8001
```

Requires a `.env` file at `backend/backend/.env` with:
```
GROQ_API_KEY=your_key_here
```

### Frontend

```bash
cd iron
npm install
npm run dev
```

Vite proxies `/api` to Django on port 8001, and `/upload`, `/uploads`, `/socket.io` to the Node socket server on port 3001.

---

## Features

### Authentication
- JWT-based login (access + refresh tokens)
- Auto token refresh every 25 minutes and on startup if expired
- Multi-step registration with onboarding profile setup
- Password reset via email (token-based)
- Password change from settings
- Account deactivation and permanent deletion

### User Profile
- Stores: name, birthdate, gender, weight, height, fitness goals, experience level, available equipment, allergies, injuries
- Profile auto-saved to localStorage and backend on every change
- Profile picture upload with lightbox preview
- Community visibility toggle (show/hide in public user list)

### AI Coach
- Chat interface with IRON, powered by Groq
- Context-aware responses based on user profile
- Coach can suggest workouts and meals, which can be saved directly from the chat

### AI Workout Planner
- Generates multi-day workout plans based on profile and selected number of days
- Each plan can be imported into My Workouts with one click

### My Workouts
- Create, edit, and delete custom workouts (stored in localStorage)
- Add exercises manually or from the exercise library
- Exercise library with search, filter by body part / muscle / equipment
- YouTube tutorial lookup per exercise (cached in DB)
- Full set tracking UI: weight + reps logging per set, barbell progress indicator, rest timer, alarm
- Import workouts from the AI plan or from the Coach chat
- Share workouts with other users via direct message

### Workout Sessions
- Starting a workout creates a session record in the database
- Active session sticky banner at the top of the screen with live timer
- Finish button triggers a notes prompt and saves duration to DB
- Unfinished sessions are restored on login

### Exercise Library
- Searchable database of exercises with body part, muscle, and equipment filters
- GIF demonstrations and step-by-step instructions
- Instruction translation via AI (matches the app's selected language)
- YouTube tutorial embed per exercise

### Personal Records (PRs)
- Automatically tracked when logging set weight/reps during a workout
- Stored per user in localStorage
- Viewable in the Progress tab

### AI Meal Planner
- Generates a full weekly meal plan (breakfast, lunch, dinner, snacks)
- Respects user allergies and dietary preferences from profile
- 7-day localStorage cache with manual regenerate option
- Serving scaler per meal

### My Meals
- Create, edit, and delete custom meals stored in the backend
- Emoji picker for meal icons

### Recipes
- Save recipe URLs with titles
- Custom recipe builder: import from a URL (AI-parsed ingredients, instructions, macros) or build manually
- Ingredient editor with add/remove per recipe

### Meal Photo Analysis
- Upload a photo of a meal for AI calorie and macro estimation
- Returns meal name, description, calories, protein, carbs, fat, ingredients, and confidence level

### Progress Tab
- Workout session history with delete
- Weight log: add entries with date, view as line chart, export as CSV
- Body measurements log: track multiple measurement types over time, view as chart
- Personal records display per exercise
- Achievements / badges display

### Achievements
- Badge system awarded for milestones (workouts completed, streaks, etc.)
- Toast notification when a new badge is unlocked
- Full badge list viewable in the Progress tab

### Community
- Real-time direct messaging via Socket.IO
- Group conversations
- File and image attachments
- Message reactions
- Delete messages and conversations
- Search users by email to start a conversation
- Shared workout cards: share a workout from My Workouts to any user's DM

### Wearable Integration (Google Fit)
- Connect Google Fit via OAuth from Settings > Wearable
- Syncs steps, calories burned, and active minutes
- Disconnect option available in the same settings tab

### Settings
- Account: edit all profile fields
- Password: change password
- Wearable: connect / disconnect Google Fit
- Languages: switch app language (English, German, French, Spanish, Hungarian)
- Appearance: toggle dark / light theme
- Legal: disclaimer
- Danger zone: deactivate or permanently delete account

### Internationalization
- Supported languages: English, German, French, Spanish, Hungarian
- Language auto-detected from browser, manually overridable in Settings
- Stored in localStorage

### Theme
- Dark mode (default) and light mode
- Persisted in localStorage

---

## Project Structure

```
ironbuddy/
  iron/               # React frontend
    src/
      api.ts          # All API functions and TypeScript interfaces
      i18n.ts         # i18next setup and language config
      prStorage.ts    # Personal records localStorage helpers
      context/
        userContext.tsx     # JWT auth, profile state, auto-save
        themeContext.tsx    # Dark/light theme
      components/
        UserProfile.tsx         # Main app shell and all tab routing
        MyWorkouts.tsx          # Custom workout CRUD and set tracking
        WorkoutPlan.tsx         # AI workout plan view
        CoachChat.tsx           # AI coach chat
        ExerciseLibrary.tsx     # Exercise browser with filters
        MyMeals.tsx             # Custom meal CRUD
        Recipes.tsx             # Recipe saving and builder
        CustomRecipeBuilder.tsx # Import or build recipes manually
        ProgressTab.tsx         # Weight log, body measurements, PRs, achievements
        CommunityChat.tsx       # Real-time DM and group chat
        BadgeToast.tsx          # Achievement unlock notification
        pages/
          HomePage.tsx              # Sign-in + forgot password
          ResetPasswordPage.tsx     # Password reset confirm
          WearableCallbackPage.tsx  # Google Fit OAuth callback
  backend/
    backend/
      api/
        models.py     # All database models
        views.py      # All API views
        serializers.py
      backend/
        urls.py       # URL routing
```

---

## API Endpoints (Backend)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/user/register/` | Register new user |
| POST | `/api/token/` | Login (get JWT) |
| POST | `/api/token/refresh/` | Refresh JWT |
| GET/PUT | `/api/user/profile/` | Get or update profile |
| POST | `/api/chat/` | AI coach message |
| POST | `/api/workout/` | Generate AI workout plan |
| POST | `/api/meals/ai-plan/` | Generate AI meal plan |
| POST | `/api/meals/photo-analyze/` | Analyze meal photo |
| GET/POST | `/api/workouts/custom/` | List or create custom workouts |
| PUT/DELETE | `/api/workouts/custom/<id>/` | Update or delete workout |
| GET/POST | `/api/sessions/` | List or start workout sessions |
| PUT/DELETE | `/api/sessions/<id>/` | Finish or delete session |
| GET/POST | `/api/meals/custom/` | List or create custom meals |
| PUT/DELETE | `/api/meals/custom/<id>/` | Update or delete meal |
| GET/POST | `/api/recipes/` | List or save recipes |
| DELETE | `/api/recipes/<id>/` | Delete recipe |
| GET/POST | `/api/workout-videos/` | List or save workout videos |
| DELETE | `/api/workout-videos/<id>/` | Delete video |
| GET | `/api/exercises/` | Exercise library (filterable, paginated) |
| GET | `/api/exercises/meta/` | Filter options (body parts, muscles, equipment) |
| GET | `/api/youtube-video/` | YouTube video ID lookup |
| GET/POST | `/api/weight-log/` | Weight log entries |
| DELETE | `/api/weight-log/<id>/` | Delete weight entry |
| GET/POST | `/api/body-measurements/` | Body measurement entries |
| DELETE | `/api/body-measurements/<id>/` | Delete measurement |
| GET | `/api/achievements/` | Fetch all badges and earned status |
| POST | `/api/achievements/check/` | Check and award new badges |
| GET/POST | `/api/conversations/` | List or create conversations |
| GET/POST | `/api/conversations/<id>/messages/` | Get or send messages |
| GET | `/api/users/` | List public users |
| GET | `/api/users/search/?email=` | Search user by email |
| POST | `/api/password-reset/` | Request password reset email |
| POST | `/api/password-reset/confirm/` | Confirm password reset |
| POST | `/api/password-change/` | Change password |
| GET | `/api/wearable/auth-url/` | Get Google Fit OAuth URL |
| POST | `/api/wearable/connect/` | Complete OAuth connection |
| GET | `/api/wearable/data/` | Fetch synced fitness data |
| GET | `/api/wearable/status/` | Check connection status |
| DELETE | `/api/wearable/disconnect/` | Disconnect wearable |
