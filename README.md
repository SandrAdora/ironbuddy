# 🏋️‍♂️ IRONBUDDY — AI-Powered Fitness Coach

IronBuddy is a next-generation AI fitness coaching web application. It delivers highly personalized workout plans, nutrition guidance, and post-workout recovery strategies by combining **Large Language Models (AI)** with **Strict Local Safety Logic**.

---
![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)

🌐 **Live Demo:** [ironbuddy](https://ironbuddy-1.onrender.com)
---

##  Overview
IronBuddy adapts to your progress, equipment, and physical limitations. Designed with **tailwindcss**, it features high-contrast neon accents when using *darkmode* and beautiful lightweight looking 
constrast in *lightmode*. It is a mobile-first interface to keep you motivated during every session.

### Key Compoents:
- **Hybrid AI Approach:**
-    Uses Groqo AI and Antropy AI as a fallback for creative **meal** or **workout** generation while enforcing safety and structure via local validation using JWT.
-    The AIs are only instructed to function as a Fitnesstrainer not a medical supervisor or personal. 
- **Privacy First:**
-    All user data, workout history, and meal plans are stored in **localStorage**.
-    Only the user's email and password is stored in the database provided by render. 
- **Adaptive Coaching:** The system learns from your feedback ("Too easy", "Too hard") to refine future routines.


## Features

### 1. Smart Onboarding
A multi-step, energetic flow collecting:
- Biometrics (Age, Height, Weight, Gender)
- Fitness Goals & Experience Level
- Available Equipment (Bodyweight, Dumbbells, Full Gym)
- Medical Constraints (Injuries, Allergies, Kidney/Heart issues)

### 2. AI Workout & Nutrition
- **Dynamic Workouts:** Weekly and daily plans covering Strength, HIIT, Cardio, and Stretching.
- **Smart Meals:** Personalized recipes based on dietary preferences (Vegan, Keto, etc.) and calorie targets.
- **Interactive Content:** Embedded YouTube demonstrations for every exercise.

### 3. The Recovery Zone
Post-workout recommendations including:
- Intensity-based meal suggestions.
- **Safe Supplementation:** Automated safety filters (e.g., no creatine for reported kidney issues).
- Hydration tracking and motivational voice coaching.

### 4. Dashboard & Analytics
- Progress visualization (Calories, Streaks, Weight changes).
- Daily motivational quotes.
- Dark Mode by default for that "Iron" feel.

---

## 🛠 Tech Stack

- **Frontend:** React (Vite)
- **Styling:** Tailwind CSS v4 (Dark Gym Theme)
- **State Management:** React Context API & LocalStorage
- **AI Integration:** OpenAI API / LangChain
- **Visuals:** Chart.js (Progress) & YouTube API (Exercises)
- **Deployment:** Netlify

---

## Safety & AI Logic

IronBuddy implements a **Safety-First Wrapper** around AI responses:
- **JSON Schema Enforcement:** Ensures AI responses always match the app's UI structure.
- **Medical Hard-Filters:** Local logic overrides AI suggestions if they conflict with user-reported health risks (e.g., heart conditions or pregnancy).
- **Offline Resilience:** Cached plans allow training even without an internet connection.

---

## 🛠 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/SandrAdora/ironbuddy.git
   cd ironbuddy
   ```



# Disclaimer
IronBuddy is an AI-powered tool and does not replace professional medical advice. Always consult a physician before starting a new training or supplement program.
