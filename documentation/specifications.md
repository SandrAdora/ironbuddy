
### 1. UI Design Specifications
- Dark gym aesthetic  
- Black background (#000000 or #0A0A0A)  
- Electric gold/yellow neon accents (#FFD700, #FFEA00)  
- Soft rounded shapes (border‑radius: 12–20px)  
- Sporty, bold typography  
- Smooth hover animations  
- Card‑based layout  

---

### 2.  Component Structure (High‑Level)
/components
/Onboarding
/Dashboard
/Workout
/Meals
/Recovery
/Notifications
/VoiceCoach

/utils
/ai
/storage


---

## 3. Future Enhancements
- Cloud sync (Supabase/Firebase)  
- Wearable integration (Fitbit, Apple Health)  
- Community challenges  
- AI‑generated grocery lists  
- Voice‑activated commands  

---

# 5. Advanced System Logic & Safety
5.1 AI Data Schema (JSON Contract)
To ensure the dashboard can process AI responses without errors, the AI must provide data in a strict JSON format.

```bash
{
  "workout_id": "unique_id",
  "title": "Upper Body Power",
  "exercises": [
    {
      "name": "Bench Press",
      "sets": 3,
      "reps": "8-10",
      "rest_seconds": 90,
      "youtube_id": "vthMCtgVTFw",
      "muscle_group": "Chest"
    }
  ]
}
```
## Meal Object Stucture
```bash
{
  "meal_name": "Power Oats",
  "calories": 450,
  "macros": { "p": 25, "c": 50, "f": 12 },
  "ingredients": ["Oats", "Whey", "Berries"],
  "instructions": "Mix and eat."
}

```

## 5.2 Safety & Liability (Disclaimer)
Since the app provides health and supplement advice, legal protection is mandatory.
Mandatory Disclaimer: Before completing the onboarding, the user must confirm via a checkbox:
"I understand that IronBuddy is an AI-powered tool and does not replace professional medical advice. I will consult a physician before starting any new training or supplement program."
Hard-Coded Safety Filters:
If injuries or physical limitations exist in the profile, every AI prompt must include: "Avoid exercises that strain [injury]."
Supplement recommendations are verified via a local whitelist/blacklist before being displayed in the UI (independent of the AI response).

## 5.3 Feedback Loop & Adaptation (Learning Logic)
For the app to feel "intelligent," adjustments must be stored over time.
Adjustment State: A user_feedback_history array is maintained in localStorage.
Feedback Categories:
TOO_HARD: Reduce volume (sets/reps) in the next prompt by 15%.
TOO_EASY: Increase intensity or add more complex exercises.
INJURY_FLARE_UP: Replace the affected muscle group with mobility training for 7 days.
Dynamic Prompting: The system prompt for the AI is generated dynamically:
Base Profile + Equipment + Last Feedback = New Plan.


## 5.4 Offline Resilience (Fallsafe)
Since the AI API costs money or may be unavailable, the app needs a "safety net."
Caching Strategy: The currently generated weekly plan is fully serialized in localStorage.
Fallback Content: If the API request fails, the dashboard displays the last successfully loaded plan with a notification: "You are offline. Using your saved plan."