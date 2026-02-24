# 🏋️‍♂️ Use Case: IronBuddy — AI‑Powered Fitness Coach

## Use Case Name
**UC‑01: Personalized Fitness Coaching & Daily Guidance**

## Primary Actor
**User (Sandra or any fitness app user)**

## Stakeholders & Interests
- **User**  
  Wants personalized workouts, meal plans, safe supplement recommendations, and motivational coaching.
- **IronBuddy (AI Coach)**  
  Provides adaptive, safe, and personalized fitness guidance.
- **System**  
  Must store user data locally, generate plans, and deliver notifications reliably.

---

## Preconditions
- User has access to a browser (desktop or mobile).
- User has completed the multi‑step onboarding process.
- LocalStorage is available for storing user data.
- Internet connection is available for AI API calls.

---

## Postconditions
- User receives a personalized weekly workout plan.
- User receives a daily meal plan and post‑workout recommendations.
- User receives safe supplement suggestions (if applicable).
- User’s progress is tracked and stored.
- Notifications are scheduled.

---

## Main Success Scenario (Basic Flow)

1. **User opens IronBuddy**  
   The dashboard loads with dark gym aesthetics and electric gold/yellow accents.

2. **System loads user profile**  
   Retrieves onboarding data from localStorage.

3. **System displays dashboard**  
   Shows:
   - Today’s workout  
   - Weekly workout plan  
   - Daily meal plan  
   - Progress stats  
   - Motivational quote  
   - Recovery Zone (post‑workout food + supplement suggestions)

4. **User starts workout**  
   - IronBuddy provides voice coaching (TTS + optional audio clips).  
   - Embedded YouTube videos demonstrate exercises.

5. **User completes workout**  
   - User gives feedback (“too hard”, “too easy”, “just right”).  
   - IronBuddy adapts future workouts accordingly.

6. **System generates post‑workout recommendations**  
   - AI suggests recovery meals.  
   - AI suggests supplements **only if safe** (e.g., no creatine if kidney issues exist).  
   - Hydration reminder is displayed.

7. **User views meal plan**  
   - Breakfast, lunch, dinner, snacks  
   - Calories + macros  
   - Short recipes  
   - YouTube links (optional)

8. **System updates progress tracking**  
   - Calories burned  
   - Streaks  
   - Weight changes  
   - Completed workouts

9. **System sends notifications**  
   - Daily workout reminder  
   - Hydration reminder  
   - Streak celebration  

10. **User edits weekly plan (optional)**  
    - Adjusts exercises or meals  
    - Saves changes to localStorage

11. **User closes the app**  
    - All data remains stored locally  
    - Notifications remain scheduled  

---

## Alternative Flows

### A1 — User Skips Workout
1. User selects “Skip Workout”.
2. IronBuddy asks for a reason (optional).
3. System adjusts streaks and updates progress.
4. System offers a lighter alternative workout.

---

### A2 — User Has Dietary Restrictions
1. User indicates allergies or dietary preferences.
2. AI filters out unsafe foods.
3. Meal plan regenerates with safe alternatives.

---

### A3 — Unsafe Supplement Scenario
1. User reports kidney or heart issues during onboarding.
2. IronBuddy automatically disables unsafe supplements.
3. Recovery Zone displays safe alternatives only.

---

### A4 — No Internet Connection
1. AI features are unavailable.
2. Dashboard still loads:
   - Stored workouts  
   - Stored meal plans  
   - Progress stats  
3. System displays a message:  
   **“AI features require an internet connection.”**

---

## Trigger
- User opens the IronBuddy application.

---

## Frequency
- Daily usage for workouts and meal plans.
- Weekly usage for plan review and edits.

---

## Special Requirements
- Must support browser + mobile notifications.
- Must use localStorage for offline persistence.
- Must maintain a motivational, energetic tone.
- Must enforce supplement safety rules.
- Must embed YouTube videos for exercise demonstrations.
- Must support voice coaching (TTS + audio clips).

