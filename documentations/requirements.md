# 🏋️‍♂️ IRONBUDDY — AI‑POWERED FITNESS COACH  
### Requirements & Specifications Document

---

## 1. Overview
IronBuddy is an AI‑powered fitness coaching web application designed to deliver personalized workout plans, nutrition guidance, post‑workout recovery recommendations, and motivational coaching. The system adapts to user feedback, supports both bodyweight and equipment‑based training, and provides a dynamic dashboard with workouts, meal plans, progress tracking, and notifications.

IronBuddy uses a **hybrid AI approach**:
- **AI API** for personalized content  
- **Local logic** for safety, structure, and consistency  

The UI follows a **dark gym aesthetic** with **electric gold/yellow neon accents** and **soft rounded shapes**.

---

## 2. Functional Requirements

### 2.1 User Onboarding
The system must provide a multi‑step onboarding flow that collects:
- Basic info (age, height, weight, gender)
- Fitness level (beginner → advanced)
- Fitness goals (weight loss, muscle gain, tone, endurance)
- Available equipment
- Workout schedule (days per week)
- Preferred workout duration
- Dietary preferences (vegan, low‑carb, etc.)
- Allergies
- Injuries or physical limitations

The onboarding must feel energetic, sporty, and motivational.

---

### 2.2 AI Workout Plan Generation
The system must:
- Generate a **weekly workout plan** based on onboarding data  
- Allow users to **edit** the weekly plan  
- Provide **daily workout routines**  
- Support:
  - Strength training  
  - Cardio  
  - HIIT  
  - Stretching  
  - Upper/lower body splits  
  - Bodyweight + equipment exercises  
- Include **embedded YouTube videos** and images for exercise demonstrations  
- Adapt difficulty based on user feedback (“too hard”, “too easy”, “just right”)

---

### 2.3 AI Nutrition & Meal Planning
The system must:
- Generate a **daily meal plan**  
- Provide a **weekly meal plan** (editable by user)  
- Respect:
  - dietary preferences  
  - allergies  
  - calorie targets  
  - fitness goals  
- Include:
  - Breakfast  
  - Lunch  
  - Dinner  
  - Snacks  
  - Hydration goals  
- Provide short recipes and optional YouTube links

---

### 2.4 Post‑Workout Food & Supplement Recommendations
The system must:
- Recommend **post‑workout meals** based on workout intensity  
- Suggest **safe supplements**, including:
  - Creatine  
  - Whey protein  
  - BCAAs  
  - Electrolytes  
  - Omega‑3  
  - Vitamin D  
- Apply safety rules:
  - No creatine if kidney issues are reported  
  - No stimulants if heart issues are reported  
  - No supplements if pregnancy is reported  
  - Avoid allergens  
- Provide hydration reminders  
- Deliver motivational recovery messages  
- Present recommendations in a “Recovery Zone” dashboard card

---

### 2.5 Dashboard
The dashboard must display:
- Today’s workout  
- Weekly workout plan  
- Daily meal plan  
- Weekly meal plan  
- Progress stats (calories burned, streaks, weight changes, completed workouts)  
- Motivational quote  
- Recovery Zone (post‑workout food + supplement suggestions)

The dashboard must support both **dark mode** and **light mode**, with dark mode as the default.

---

### 2.6 Notifications
The system must support:
- Browser notifications  
- Mobile notifications  
- Daily workout reminders  
- Hydration reminders  
- Streak celebration messages  
- Post‑workout recovery notifications  

Users must be able to enable/disable notifications.

---

### 2.7 Voice Coaching
The system must provide:
- Text‑to‑speech instructions  
- Optional pre‑recorded motivational audio clips  
- Voice feedback during workouts and recovery  
- A motivational personality consistent with IronBuddy’s identity

---

### 2.8 Data Storage
- Use **localStorage** for:
  - user profile  
  - weekly workout plan  
  - weekly meal plan  
  - progress tracking  
- Allow future expansion to cloud sync

---

## 3. Non‑Functional Requirements

### 3.1 Performance
- App must load in under 2 seconds on modern devices  
- Smooth animations and transitions  
- Efficient rendering of dashboard components  

---

### 3.2 Usability
- Mobile‑friendly responsive design  
- Clear navigation  
- Accessible color contrast  
- Simple, energetic onboarding flow  
- Motivational tone throughout the UI  

---

### 3.3 Security
- No sensitive personal data stored externally  
- All data stored locally unless user opts into cloud sync  
- HTTPS enforced (Netlify default)  

---

### 3.4 Reliability
- App must function offline for:
  - dashboard  
  - stored plans  
  - progress tracking  
- AI features require internet connection  

---

### 3.5 Maintainability
- Use a scalable component‑based architecture  
- Clean separation between:
  - AI logic  
  - UI components  
  - Data storage  
  - Workout/meal databases  

---

## 4. Technical Specifications

### 4.1 Tech Stack
- **React** (recommended for scalability and component structure)  
- HTML5  
- CSS3 (Tailwind or custom)  
- JavaScript  
- AI API (OpenAI or similar)  
- Chart.js for progress visualization  
- YouTube embeds for exercise videos  
- Netlify for deployment  

---

### 4.2 AI Logic
Hybrid approach:
- **AI API** generates:
  - workout descriptions  
  - meal ideas  
  - supplement explanations  
  - motivational messages  
- **Local logic** handles:
  - safety rules  
  - structure of plans  
  - filtering by preferences/allergies  
  - difficulty scaling  
  - calorie calculations  

---

