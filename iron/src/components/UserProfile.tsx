import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/userContext';
import { apiUploadFile, apiChangePassword, apiDeleteAccount, apiDeactivateAccount, apiGetAIMealPlan, apiGetSessions, apiStartSession, apiFinishSession, apiCreateCustomMeal, type AIMealItem, type AIMealPlan, type WorkoutSession } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import CoachChat from './CoachChat';
import WorkoutPlanView from './WorkoutPlan';
import MyWorkouts from './MyWorkouts';
import MyMeals from './MyMeals';
import Recipes from './Recipes';
import CustomRecipeBuilder from './CustomRecipeBuilder';
import WorkoutVideos from './WorkoutVideos';
import CommunityChat from './CommunityChat';
import ProgressTab from './ProgressTab';

function getUserIdFromToken(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.user_id ?? null;
  } catch {
    return null;
  }
}

// ── Sidebar nav items ──────────────────────────────────────────
const NAV = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'coach',     icon: '🦾', label: 'AI Coach' },
  { id: 'goals',     icon: '🎯', label: 'Goals' },
  { id: 'meals',     icon: '🥗', label: 'AI Meals' },
  { id: 'workouts',  icon: '💪', label: 'Workouts' },
  { id: 'community', icon: '💬', label: 'Community' },
  { id: 'progress',  icon: '📈', label: 'Progress' },
  { id: 'settings',  icon: '⚙️', label: 'Settings' },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay },
});

// ── Donut data ─────────────────────────────────────────────────
function buildGoalData(goal: string) {
  const map: Record<string, { name: string; value: number; color: string }[]> = {
    'Weight Loss':    [{ name: 'Fat Loss', value: 60, color: '#facc15' }, { name: 'Cardio', value: 25, color: '#a3e635' }, { name: 'Strength', value: 15, color: '#38bdf8' }],
    'Muscle Gain':   [{ name: 'Strength', value: 55, color: '#facc15' }, { name: 'Hypertrophy', value: 30, color: '#fb923c' }, { name: 'Recovery', value: 15, color: '#a78bfa' }],
    'Endurance':     [{ name: 'Cardio', value: 60, color: '#facc15' }, { name: 'Stamina', value: 25, color: '#34d399' }, { name: 'Mobility', value: 15, color: '#60a5fa' }],
    'General Fitness':[{ name: 'Cardio', value: 35, color: '#facc15' }, { name: 'Strength', value: 35, color: '#34d399' }, { name: 'Flexibility', value: 30, color: '#f472b6' }],
  };
  return map[goal] ?? [{ name: 'Set a Goal', value: 100, color: '#374151' }];
}

// ── AI Meal Plan cache ──────────────────────────────────────────
const MEAL_CACHE_DAYS = 7;

function mealCacheKey(userId: number) {
  return `ironbuddy_ai_meals_${userId}`;
}

interface MealCache {
  plan: AIMealPlan;
  goal: string;
  generated_at: string; // ISO date string
}

function loadMealCache(userId: number, goal: string): AIMealPlan | null {
  try {
    const raw = localStorage.getItem(mealCacheKey(userId));
    if (!raw) return null;
    const cache: MealCache = JSON.parse(raw);
    if (cache.goal !== goal) return null;
    const ageMs = Date.now() - new Date(cache.generated_at).getTime();
    if (ageMs > MEAL_CACHE_DAYS * 24 * 60 * 60 * 1000) return null;
    return cache.plan;
  } catch { return null; }
}

function saveMealCache(userId: number, goal: string, plan: AIMealPlan) {
  const cache: MealCache = { plan, goal, generated_at: new Date().toISOString() };
  localStorage.setItem(mealCacheKey(userId), JSON.stringify(cache));
}

function getMealCacheAge(userId: number): number | null {
  try {
    const raw = localStorage.getItem(mealCacheKey(userId));
    if (!raw) return null;
    const cache: MealCache = JSON.parse(raw);
    return Math.floor((Date.now() - new Date(cache.generated_at).getTime()) / (24 * 60 * 60 * 1000));
  } catch { return null; }
}

// ── Serving scaler ─────────────────────────────────────────────
const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1/3, '⅔': 2/3,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

function fmtNum(n: number): string {
  const snaps: [number, string][] = [
    [0.125,'⅛'],[0.25,'¼'],[0.333,'⅓'],[0.375,'⅜'],[0.5,'½'],
    [0.625,'⅝'],[0.667,'⅔'],[0.75,'¾'],[0.875,'⅞'],
    [1.5,'1½'],[2.5,'2½'],[3.5,'3½'],
  ];
  for (const [val, sym] of snaps) if (Math.abs(n - val) < 0.04) return sym;
  if (n === Math.round(n)) return String(Math.round(n));
  return String(Math.round(n * 10) / 10);
}

function scaleIngredient(ing: string, multiplier: number): string {
  if (multiplier === 1) return ing;
  let result = ing;
  // Replace unicode fractions first
  for (const [sym, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (result.includes(sym)) result = result.replace(new RegExp(sym, 'g'), fmtNum(val * multiplier));
  }
  // Replace text fractions like "1/2", "3/4"
  result = result.replace(/\b(\d+)\/(\d+)\b/g, (_, num, den) =>
    fmtNum((parseInt(num) / parseInt(den)) * multiplier)
  );
  // Replace all numbers (including "100g", "200ml" — no word-boundary needed)
  result = result.replace(/(\d+(?:\.\d+)?)/g, (_, n) => fmtNum(parseFloat(n) * multiplier));
  return result;
}

function scaleKcal(kcal: string, multiplier: number): string {
  return kcal.replace(/\d+/, (n) => String(Math.round(parseInt(n) * multiplier)));
}

// ══════════════════════════════════════════════════════════════
function calcBMI(weight: number | null, height: number | null) {
  if (!weight || !height) return null;
  return weight / Math.pow(height / 100, 2);
}

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: '#60a5fa' };
  if (bmi < 25)   return { label: 'Normal',      color: '#4ade80' };
  if (bmi < 30)   return { label: 'Overweight',  color: '#fb923c' };
  return               { label: 'Obese',         color: '#f87171' };
}

export default function UserProfile() {
  const { profile, token, setProfile } = useUser();
  const navigate = useNavigate();
  const [active, setActive] = useState('dashboard');
  const [communityUnread, setCommunityUnread] = useState(0);
  const [workoutTab, setWorkoutTab] = useState<'ai' | 'my' | 'videos'>('ai');
  const [mealTab, setMealTab] = useState<'ai' | 'my' | 'recipes' | 'custom' | 'ingredients'>('ai');
  const [settingsTab, setSettingsTab] = useState<'account' | 'password' | 'legal' | 'delete_account' | 'languages'>('account');
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightInput, setWeightInput] = useState(String(profile.weight ?? ''));
  const [editingGoal, setEditingGoal] = useState(false);
  const [editingLevel, setEditingLevel] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [viewingAvatar, setViewingAvatar] = useState(false);
  const [mealServings, setMealServings] = useState<Record<string, number>>({});
  const [savedMeals, setSavedMeals] = useState<Record<string, boolean>>({});
  const [savedAsRecipes, setSavedAsRecipes] = useState<Record<string, boolean>>({});
  const getSrv = (name: string) => mealServings[name] ?? 1;
  const setSrv = (name: string, n: number) =>
    setMealServings((p) => ({ ...p, [name]: Math.max(1, Math.min(10, n)) }));
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [mealTimeTab, setMealTimeTab] = useState<'breakfast' | 'lunch' | 'dinner' | 'snacks'>('breakfast');

  // AI Meal Plan state
  const [aiMealPlan, setAiMealPlan] = useState<AIMealPlan | null>(null);
  const [aiMealLoading, setAiMealLoading] = useState(false);
  const [aiMealError, setAiMealError] = useState('');

  // Account edit state
  const [editingAccount, setEditingAccount] = useState(false);
  const [accountDraft, setAccountDraft] = useState({ name: '', gender: '', height: '', weight: '', fitnessGoals: '', experienceLevel: '', equipments: '', birthdate: '' });

  const openAccountEdit = () => {
    setAccountDraft({
      name: profile.name,
      gender: profile.gender,
      height: profile.height ? String(profile.height) : '',
      weight: profile.weight ? String(profile.weight) : '',
      fitnessGoals: profile.fitnessGoals,
      experienceLevel: profile.experienceLevel,
      equipments: profile.equipments,
      birthdate: profile.birthdate ?? '',
    });
    setEditingAccount(true);
  };

  const saveAccount = () => {
    setProfile((p) => ({
      ...p,
      name: accountDraft.name.trim(),
      gender: accountDraft.gender,
      height: accountDraft.height ? parseFloat(accountDraft.height) : null,
      weight: accountDraft.weight ? parseFloat(accountDraft.weight) : null,
      fitnessGoals: accountDraft.fitnessGoals,
      experienceLevel: accountDraft.experienceLevel,
      equipments: accountDraft.equipments,
      birthdate: accountDraft.birthdate || null,
    }));
    setEditingAccount(false);
  };

  // Password change state
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  // Danger zone state
  const [dangerPassword, setDangerPassword] = useState('');
  const [dangerAction, setDangerAction] = useState<'deactivate' | 'delete' | null>(null);
  const [dangerLoading, setDangerLoading] = useState(false);
  const [dangerError, setDangerError] = useState('');

  // Community visibility toggle
  const [visibilityLoading, setVisibilityLoading] = useState(false);

  // Editable ingredients in AI Meals
  const [editedIngredients, setEditedIngredients] = useState<Record<string, string[]>>({});
  const [newIngInputs, setNewIngInputs] = useState<Record<string, string>>({});

  function getMealIngredients(meal: AIMealItem): string[] {
    return editedIngredients[meal.meal] ?? meal.ingredients;
  }

  // Preferred ingredients tab
  const [prefIngNew, setPrefIngNew] = useState('');

  const userId = getUserIdFromToken(token ?? '');

  const fetchAIMeals = async (force = false) => {
    if (!force) {
      const cached = loadMealCache(userId ?? 0, profile.fitnessGoals);
      if (cached) { setAiMealPlan(cached); return; }
    }
    setAiMealLoading(true);
    setAiMealError('');
    try {
      const { email: _e, password: _p, onboarded: _o, ...profileData } = profile;
      const plan = await apiGetAIMealPlan(profileData as Record<string, unknown>);
      setAiMealPlan(plan);
      saveMealCache(userId ?? 0, profile.fitnessGoals, plan);
    } catch (err: unknown) {
      setAiMealError(err instanceof Error ? err.message : 'Failed to generate meal plan');
    } finally {
      setAiMealLoading(false);
    }
  };

  // Workout session state
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const handleAvatarClick = () => {
    if (profile.profilePicture) {
      setViewingAvatar(true);
    } else {
      avatarInputRef.current?.click();
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setViewingAvatar(false);
    try {
      const result = await apiUploadFile(file);
      setProfile((p) => ({ ...p, profilePicture: result.file_url }));
    } catch {
      // silently ignore
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!token) navigate('/');
  }, [token]);

  // On mount: load meal plan from cache so the dashboard card is populated immediately
  useEffect(() => {
    if (!aiMealPlan && userId) {
      const cached = loadMealCache(userId, profile.fitnessGoals);
      if (cached) setAiMealPlan(cached);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-load AI meal plan when meals tab is opened (fetches from API if not cached)
  useEffect(() => {
    if (active === 'meals' && mealTab === 'ai' && !aiMealPlan && !aiMealLoading) {
      fetchAIMeals();
    }
  }, [active, mealTab]);

  // Load sessions on mount; restore any unfinished session
  useEffect(() => {
    if (!token) return;
    apiGetSessions(token).then((all) => {
      setSessions(all);
      const unfinished = all.find((s) => !s.finished_at) ?? null;
      if (unfinished) {
        setActiveSession(unfinished);
        setElapsedSec(Math.floor((Date.now() - new Date(unfinished.started_at).getTime()) / 1000));
      }
    }).catch(() => {});
  }, [token]);

  // Live timer
  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  const startWorkout = async (name: string, type: 'ai' | 'custom') => {
    if (!token) return;
    try {
      const session = await apiStartSession(token, name, type);
      setActiveSession(session);
      setElapsedSec(0);
      setSessions((p) => [session, ...p]);
    } catch { /* silently ignore */ }
  };

  const finishWorkout = async () => {
    if (!token || !activeSession) return;
    setFinishing(true);
    try {
      const duration = Math.round(elapsedSec / 60);
      const finished = await apiFinishSession(token, activeSession.id, duration);
      setSessions((p) => p.map((s) => s.id === finished.id ? finished : s));
      setActiveSession(null);
      setElapsedSec(0);
    } catch { /* silently ignore */ }
    finally { setFinishing(false); }
  };

  // Dashboard stats derived from sessions
  const finishedSessions = sessions.filter((s) => s.finished_at);
  const totalWorkouts = finishedSessions.length;

  function calcStreak(): number {
    if (finishedSessions.length === 0) return 0;
    const days = new Set(finishedSessions.map((s) => new Date(s.finished_at!).toLocaleDateString()));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (days.has(d.toLocaleDateString())) { streak++; } else { break; }
    }
    return streak;
  }
  const streak = calcStreak();

  function fmtElapsed(sec: number) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  if (!token) return null;

  const saveWeight = () => {
    const val = parseFloat(weightInput);
    if (!isNaN(val) && val > 0) setProfile((p) => ({ ...p, weight: val }));
    setEditingWeight(false);
  };

  const bmi = calcBMI(profile.weight, profile.height);
  const bmiInfo = bmi ? bmiCategory(bmi) : null;
  const goalData = buildGoalData(profile.fitnessGoals);

  return (
    <div className="flex min-h-screen bg-[--color-gym-dark] text-white pt-16">

      {/* ── Sidebar (desktop only) ───────────────────────── */}
      <motion.aside
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="hidden md:flex flex-col w-64 h-[calc(100vh-4rem)] overflow-y-auto bg-white/5 backdrop-blur-xl border-r border-white/10 px-4 py-8 fixed top-16 left-0 shadow-[4px_0_30px_rgba(0,0,0,0.3)]"
      >
        {/* Avatar */}
        <div className="flex flex-col items-center mb-8">
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          <button
            onClick={handleAvatarClick}
            disabled={avatarUploading}
            className="relative w-24 h-24 rounded-2xl border-2 border-yellow-300 overflow-hidden group focus:outline-none shadow-[0_0_20px_rgba(250,204,21,0.2)]"
            title={profile.profilePicture ? 'View photo' : 'Upload photo'}
          >
            {profile.profilePicture ? (
              <img src={profile.profilePicture} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-yellow-300/20 flex items-center justify-center text-4xl animate-coach-breathe">
                🦾
              </div>
            )}
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {avatarUploading ? (
                <span className="text-white text-xs font-bold">Uploading…</span>
              ) : profile.profilePicture ? (
                <>
                  <span className="text-lg">🔍</span>
                  <span className="text-white text-[10px] font-bold uppercase tracking-wide">View</span>
                </>
              ) : (
                <>
                  <span className="text-lg">📷</span>
                  <span className="text-white text-[10px] font-bold uppercase tracking-wide">Upload</span>
                </>
              )}
            </div>
          </button>
          <p className="mt-3 font-black text-[--color-iron-gold] uppercase text-sm tracking-widest text-center">
            {profile.name || 'Athlete'}
          </p>
          <p className="text-gray-500 text-xs mt-0.5 text-center truncate w-full px-2">{profile.email}</p>
        </div>

        {/* Credentials */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 mb-4 space-y-2 border border-white/10">
          {/* Editable Goal */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 uppercase font-bold">Goal</span>
            {editingGoal ? (
              <select
                autoFocus
                value={profile.fitnessGoals}
                onChange={(e) => { setProfile((p) => ({ ...p, fitnessGoals: e.target.value })); setEditingGoal(false); }}
                onBlur={() => setEditingGoal(false)}
                className="text-xs bg-gray-900 border border-yellow-300/50 rounded px-1.5 py-1 text-white outline-none [&>option]:bg-gray-900 [&>option]:text-white"
              >
                <option value="Weight Loss">Weight Loss</option>
                <option value="Muscle Gain">Muscle Gain</option>
                <option value="Endurance">Endurance</option>
                <option value="General Fitness">General Fitness</option>
              </select>
            ) : (
              <button
                onClick={() => setEditingGoal(true)}
                className="text-xs text-white font-semibold hover:text-[--color-iron-gold] transition-colors flex items-center gap-1 group"
              >
                {profile.fitnessGoals || '—'}
                <span className="text-gray-600 group-hover:text-yellow-400 text-xs">✏️</span>
              </button>
            )}
          </div>
          {/* Editable Level */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 uppercase font-bold">Level</span>
            {editingLevel ? (
              <select
                autoFocus
                value={profile.experienceLevel}
                onChange={(e) => { setProfile((p) => ({ ...p, experienceLevel: e.target.value })); setEditingLevel(false); }}
                onBlur={() => setEditingLevel(false)}
                className="text-xs bg-gray-900 border border-yellow-300/50 rounded px-1.5 py-1 text-white outline-none [&>option]:bg-gray-900 [&>option]:text-white"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Unsure">Unsure</option>
              </select>
            ) : (
              <button
                onClick={() => setEditingLevel(true)}
                className="text-xs text-white font-semibold hover:text-[--color-iron-gold] transition-colors flex items-center gap-1 group"
              >
                {profile.experienceLevel || '—'}
                <span className="text-gray-600 group-hover:text-yellow-400 text-xs">✏️</span>
              </button>
            )}
          </div>
          <SidebarStat label="Height" value={profile.height ? `${profile.height} cm` : '—'} />
          <SidebarStat label="Gender" value={profile.gender || '—'} />

          {/* Editable Weight */}
          <div className="flex justify-between items-center pt-1">
            <span className="text-xs text-gray-500 uppercase font-bold">Weight</span>
            {editingWeight ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="number"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveWeight(); if (e.key === 'Escape') setEditingWeight(false); }}
                  className="w-16 text-xs bg-gray-700 border border-yellow-300/50 rounded px-1.5 py-1 text-white outline-none text-right"
                />
                <span className="text-xs text-gray-400">kg</span>
                <button onClick={saveWeight} className="text-green-400 hover:text-green-300 text-xs font-bold ml-1">✓</button>
                <button onClick={() => setEditingWeight(false)} className="text-gray-500 hover:text-gray-300 text-xs ml-0.5">✕</button>
              </div>
            ) : (
              <button
                onClick={() => { setWeightInput(String(profile.weight ?? '')); setEditingWeight(true); }}
                className="text-xs text-white font-semibold hover:text-[--color-iron-gold] transition-colors flex items-center gap-1 group"
              >
                {profile.weight ? `${profile.weight} kg` : '—'}
                <span className="text-gray-600 group-hover:text-yellow-400 text-xs">✏️</span>
              </button>
            )}
          </div>
        </div>

        {/* BMI Badge */}
        {bmi && bmiInfo && (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 mb-4 border border-white/10 flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase font-bold">BMI</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white">{bmi.toFixed(1)}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: bmiInfo.color, background: `${bmiInfo.color}22` }}>
                {bmiInfo.label}
              </span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all duration-200
                ${active === item.id
                  ? 'bg-yellow-300/15 text-[--color-iron-gold] shadow-[0_0_12px_rgba(250,204,21,0.2)]'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
              {item.id === 'community' && communityUnread > 0 && (
                <span className="ml-auto bg-yellow-300 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  {communityUnread > 99 ? '99+' : communityUnread}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <Link 
          to={"/" }
          className="mt-6 w-full py-2.5 text-black font-bold rounded-lg uppercase text-sm"
        >
          Sign Out
        </Link>
      </motion.aside>

      {/* ── Mobile profile strip (mobile only) ─────────── */}
      <div className="md:hidden fixed top-16 left-0 right-0 z-30 bg-[--color-gym-dark]/95 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        {/* Avatar + name row */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={handleAvatarClick}
            disabled={avatarUploading}
            className="relative w-12 h-12 rounded-xl border-2 border-yellow-300 overflow-hidden shrink-0 group focus:outline-none"
            title={profile.profilePicture ? 'View photo' : 'Upload photo'}
          >
            {profile.profilePicture ? (
              <img src={profile.profilePicture} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-yellow-300/20 flex items-center justify-center text-xl animate-coach-breathe">
                🦾
              </div>
            )}
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="text-white text-xs font-bold">{avatarUploading ? '…' : profile.profilePicture ? '🔍' : '📷'}</span>
            </div>
          </button>
          <div className="min-w-0">
            <p className="font-black text-[--color-iron-gold] uppercase text-sm tracking-widest truncate">
              {profile.name || 'Athlete'}
            </p>
            <p className="text-gray-500 text-xs truncate">{profile.email}</p>
          </div>
        </div>
        {/* Stats chips row */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { label: 'Goal', value: profile.fitnessGoals || '—' },
            { label: 'Level', value: profile.experienceLevel || '—' },
            { label: 'Weight', value: profile.weight ? `${profile.weight} kg` : '—' },
            { label: 'Height', value: profile.height ? `${profile.height} cm` : '—' },
            ...(bmi && bmiInfo ? [{ label: 'BMI', value: `${bmi.toFixed(1)} · ${bmiInfo.label}` }] : []),
          ].map((s) => (
            <div key={s.label} className="shrink-0 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 flex flex-col items-center">
              <span className="text-[10px] text-gray-500 uppercase font-bold">{s.label}</span>
              <span className="text-xs text-white font-semibold whitespace-nowrap">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Mobile bottom nav (mobile only) ─────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[--color-gym-dark]/95 backdrop-blur-xl border-t border-white/10 flex items-center gap-1 px-2 py-2 overflow-x-auto">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            className={`shrink-0 flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-200 min-w-0 relative
              ${active === item.id
                ? 'text-[--color-iron-gold]'
                : 'text-gray-500'}`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide">{item.label}</span>
            {item.id === 'community' && communityUnread > 0 && (
              <span className="absolute -top-0.5 right-0 bg-yellow-300 text-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">
                {communityUnread > 9 ? '9+' : communityUnread}
              </span>
            )}
          </button>
        ))}
        <Link
          to="/"
          className="shrink-0 flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-gray-500 transition-all duration-200"
        >
          <span className="text-xl">🚪</span>
          <span className="text-[10px] font-bold uppercase tracking-wide">Out</span>
        </Link>
      </nav>

      {/* ── Active session banner ────────────────────── */}
      <AnimatePresence>
        {activeSession && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed top-16 left-0 right-0 z-40 md:left-64 bg-yellow-300 text-black px-4 py-2.5 flex items-center justify-between gap-3 shadow-[0_4px_20px_rgba(253,224,71,0.4)]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl shrink-0 animate-pulse">🏋️</span>
              <div className="min-w-0">
                <p className="font-black uppercase text-xs tracking-wide truncate">{activeSession.workout_name}</p>
                <p className="text-black/60 text-xs font-bold">In progress · {fmtElapsed(elapsedSec)}</p>
              </div>
            </div>
            <button
              onClick={finishWorkout}
              disabled={finishing}
              className="shrink-0 px-4 py-1.5 bg-black text-yellow-300 font-black rounded-xl uppercase text-xs
                hover:bg-gray-900 active:scale-95 transition-all disabled:opacity-50"
            >
              {finishing ? 'Saving…' : '✓ Finish'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content ─────────────────────────────── */}
      <main className={`flex-1 md:ml-64 px-4 md:px-6 py-4 md:py-8 space-y-8 mt-[108px] md:mt-0 pb-24 md:pb-8 ${activeSession ? 'mt-[152px] md:mt-[44px]' : ''}`}>
        <AnimatePresence mode="wait">

          {/* ── DASHBOARD ── */}
          {active === 'dashboard' && (
            <motion.div key="dashboard" {...fadeUp(0)} className="space-y-8">
              <motion.div {...fadeUp(0)}>
                <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Overview</p>
                <h1 className="text-2xl md:text-3xl font-black uppercase italic mt-1">
                  Welcome back, <span className="text-[--color-iron-gold]">{profile.name?.split(' ')[0] || 'Athlete'}</span> 💪
                </h1>
              </motion.div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {[
                  { label: 'Workouts', value: String(totalWorkouts), icon: '🏋️' },
                  { label: 'Streak', value: streak > 0 ? `${streak} day${streak !== 1 ? 's' : ''}` : '—', icon: '🔥' },
                  { label: 'Goal', value: profile.fitnessGoals || '—', icon: '🎯' },
                  { label: 'BMI', value: bmi ? `${bmi.toFixed(1)} — ${bmiInfo?.label}` : '—', icon: '⚖️' },
                ].map((s, i) => (
                  <motion.div key={s.label} {...fadeUp(0.1 + i * 0.08)}
                    className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 flex items-center gap-3
                      hover:border-yellow-300/30 hover:shadow-[0_0_16px_rgba(253,224,71,0.12)] transition-all duration-300">
                    <span className="text-2xl md:text-3xl">{s.icon}</span>
                    <div className="min-w-0">
                      <p className="text-base md:text-xl font-black text-[--color-iron-gold] truncate">{s.value}</p>
                      <p className="text-xs text-gray-400 uppercase font-bold">{s.label}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Donut + Meals side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <GoalDonut goalData={goalData} goal={profile.fitnessGoals} />
                <MealCard
                  meals={aiMealPlan
                    ? [...(aiMealPlan.breakfast.slice(0,1)), ...(aiMealPlan.lunch.slice(0,1)), ...(aiMealPlan.dinner.slice(0,1))]
                    : null}
                  onNavigate={() => { setActive('meals'); setMealTab('ai'); }}
                />
              </div>

              {/* Achievements */}
              <AchievementsCard onboarded={profile.onboarded} />

              {/* Workout Starter */}
              <motion.div {...fadeUp(0.35)}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6
                  hover:border-yellow-300/30 hover:shadow-[0_0_20px_rgba(253,224,71,0.12)] transition-all duration-300">
                <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest mb-4">🏋️ Start a Workout</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => { setActive('workouts'); setWorkoutTab('ai'); }}
                    className="flex items-center gap-4 bg-yellow-300/10 border border-yellow-300/20 rounded-xl p-4
                      hover:bg-yellow-300/20 hover:border-yellow-300/40 hover:scale-[1.02] active:scale-95 transition-all duration-200 text-left"
                  >
                    <span className="text-3xl">🤖</span>
                    <div>
                      <p className="font-black text-[--color-iron-gold] uppercase text-sm">AI Workout Plan</p>
                      <p className="text-gray-400 text-xs mt-0.5">Generated for your goal</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setActive('workouts'); setWorkoutTab('my'); }}
                    className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-4
                      hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-95 transition-all duration-200 text-left"
                  >
                    <span className="text-3xl">✏️</span>
                    <div>
                      <p className="font-black text-white uppercase text-sm">My Workouts</p>
                      <p className="text-gray-400 text-xs mt-0.5">Your custom routines</p>
                    </div>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ── COACH ── */}
          {active === 'coach' && (
            <motion.div key="coach" {...fadeUp(0)}>
              <CoachChat profile={profile} token={token} />
            </motion.div>
          )}

          {/* ── GOALS ── */}
          {active === 'goals' && (
            <motion.div key="goals" {...fadeUp(0)} className="space-y-6">
              <SectionHeader title="Goals" sub="Your fitness focus breakdown" />
              <GoalDonut goalData={goalData} goal={profile.fitnessGoals} large />
            </motion.div>
          )}

          {/* ── MEALS ── */}
          {active === 'meals' && (
            <motion.div key="meals" {...fadeUp(0)} className="space-y-6">
              {/* Sub-tabs */}
              <div className="flex gap-2 flex-wrap">
                {([
                  { id: 'ai', label: '🥗 AI Suggestions' },
                  { id: 'my', label: '🍽️ My Meals' },
                  { id: 'custom', label: '👨‍🍳 My Recipes' },
                  { id: 'recipes', label: '🎬 Recipe Videos' },
                  { id: 'ingredients', label: '🧂 Preferences' },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMealTab(tab.id)}
                    className={`px-3 py-1.5 sm:px-5 sm:py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wide transition-all duration-200 ${
                      mealTab === tab.id
                        ? 'bg-yellow-300 text-black shadow-[0_0_16px_rgba(253,224,71,0.3)]'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {mealTab === 'ai' && (
                  <motion.div key="ai-meals" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="space-y-4">

                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Weekly Plan · {profile.fitnessGoals || 'Your Goal'}</p>
                        <h2 className="text-2xl font-black uppercase italic mt-1">🥗 AI Meal Plan</h2>
                        {getMealCacheAge(userId ?? 0) !== null && (
                          <p className="text-gray-500 text-xs mt-1">
                            Generated {getMealCacheAge(userId ?? 0)} day{getMealCacheAge(userId ?? 0) === 1 ? '' : 's'} ago
                            · refreshes weekly
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => fetchAIMeals(true)}
                        disabled={aiMealLoading}
                        className="shrink-0 px-4 py-2 bg-yellow-300/10 border border-yellow-300/30 text-yellow-300 font-black rounded-xl uppercase text-xs
                          hover:bg-yellow-300/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
                      >
                        {aiMealLoading ? '⏳ Generating…' : '🔄 Regenerate'}
                      </button>
                    </div>

                    {aiMealError && (
                      <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{aiMealError}</p>
                    )}

                    {aiMealLoading && (
                      <div className="space-y-4">
                        {/* Meal time tabs skeleton */}
                        <div className="flex gap-2">
                          {['Breakfast','Lunch','Dinner','Snacks'].map((l) => (
                            <div key={l} className="h-9 w-24 bg-white/5 rounded-xl animate-pulse" />
                          ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {[1,2,3].map((i) => <div key={i} className="bg-white/5 border border-white/10 rounded-2xl h-64 animate-pulse" />)}
                        </div>
                      </div>
                    )}

                    {!aiMealLoading && aiMealPlan && (
                      <>
                        {/* Meal time sub-tabs */}
                        <div className="flex gap-2 flex-wrap">
                          {([
                            { id: 'breakfast', label: '☀️ Breakfast' },
                            { id: 'lunch',     label: '🌤️ Lunch' },
                            { id: 'dinner',    label: '🌙 Dinner' },
                            { id: 'snacks',    label: '🍎 Snacks' },
                          ] as const).map((tab) => (
                            <button
                              key={tab.id}
                              onClick={() => setMealTimeTab(tab.id)}
                              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wide transition-all duration-200 ${
                                mealTimeTab === tab.id
                                  ? 'bg-yellow-300 text-black shadow-[0_0_16px_rgba(253,224,71,0.3)]'
                                  : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        <AnimatePresence mode="wait">
                          <motion.div
                            key={mealTimeTab}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                            transition={{ duration: 0.18 }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-4"
                          >
                            {(aiMealPlan[mealTimeTab] ?? []).map((m, i) => {
                              const srv = getSrv(m.meal);
                              return (
                                <motion.div key={m.meal} {...fadeUp(0.05 * i)}
                                  className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col gap-4
                                    hover:border-yellow-300/30 hover:shadow-[0_0_20px_rgba(253,224,71,0.12)] transition-all duration-300">
                                  <div className="flex items-start gap-3">
                                    <span className="text-4xl shrink-0">{m.icon}</span>
                                    <div className="min-w-0">
                                      <p className="font-black text-[--color-iron-gold] uppercase text-sm">{m.meal}</p>
                                      <p className="text-gray-400 text-xs mt-0.5">{m.desc}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                                    <span className="text-xs text-gray-500 uppercase font-bold">Servings</span>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => setSrv(m.meal, srv - 1)} disabled={srv <= 1}
                                        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-yellow-300/20 hover:text-yellow-300 text-white font-black text-sm
                                          flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-90">−</button>
                                      <span className="text-white font-black text-sm w-4 text-center">{srv}</span>
                                      <button onClick={() => setSrv(m.meal, srv + 1)} disabled={srv >= 10}
                                        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-yellow-300/20 hover:text-yellow-300 text-white font-black text-sm
                                          flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-90">+</button>
                                      {srv > 1 && <span className="text-xs text-gray-500 font-bold ml-1">× {srv}</span>}
                                    </div>
                                    <span className="text-xs bg-yellow-300/10 text-yellow-300 font-bold px-2.5 py-1 rounded-full shrink-0">
                                      {scaleKcal(m.kcal, srv)}
                                    </span>
                                  </div>
                                  <div className="border-t border-white/10 pt-3 space-y-1.5">
                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">🛒 Ingredients</p>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                      {getMealIngredients(m).map((ing, j) => (
                                        <span key={j} className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-full px-2.5 py-0.5 text-[11px] text-gray-300">
                                          {scaleIngredient(ing, srv)}
                                          <button
                                            onClick={() => setEditedIngredients((prev) => ({
                                              ...prev,
                                              [m.meal]: getMealIngredients(m).filter((_, i) => i !== j),
                                            }))}
                                            className="text-gray-500 hover:text-red-400 transition-colors ml-0.5 leading-none"
                                          >×</button>
                                        </span>
                                      ))}
                                    </div>
                                    <div className="flex gap-1.5">
                                      <input
                                        type="text"
                                        value={newIngInputs[m.meal] ?? ''}
                                        onChange={(e) => setNewIngInputs((p) => ({ ...p, [m.meal]: e.target.value }))}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const val = (newIngInputs[m.meal] ?? '').trim();
                                            if (!val) return;
                                            setEditedIngredients((prev) => ({ ...prev, [m.meal]: [...getMealIngredients(m), val] }));
                                            setNewIngInputs((p) => ({ ...p, [m.meal]: '' }));
                                          }
                                        }}
                                        placeholder="Add ingredient…"
                                        className="flex-1 bg-black/30 border border-white/15 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder:text-gray-500 focus:outline-none focus:border-yellow-300/50"
                                      />
                                      <button
                                        onClick={() => {
                                          const val = (newIngInputs[m.meal] ?? '').trim();
                                          if (!val) return;
                                          setEditedIngredients((prev) => ({ ...prev, [m.meal]: [...getMealIngredients(m), val] }));
                                          setNewIngInputs((p) => ({ ...p, [m.meal]: '' }));
                                        }}
                                        className="px-2.5 py-1 bg-white/10 border border-white/15 rounded-lg text-[11px] hover:bg-white/20 transition-all font-bold"
                                      >+</button>
                                    </div>
                                  </div>
                                  {m.steps && m.steps.length > 0 && <MealSteps steps={m.steps} />}
                                  {token && (
                                    <div className="flex flex-col gap-2">
                                      <button
                                        disabled={!!savedMeals[m.meal]}
                                        onClick={async () => {
                                          try {
                                            await apiCreateCustomMeal(token, {
                                              name: m.meal,
                                              icon: m.icon,
                                              kcal: scaleKcal(m.kcal, getSrv(m.meal)),
                                              description: m.desc,
                                              recipe_url: '',
                                            });
                                            setSavedMeals(prev => ({ ...prev, [m.meal]: true }));
                                          } catch { /* ignore */ }
                                        }}
                                        className={`w-full py-2.5 rounded-xl font-black uppercase text-xs tracking-wide transition-all duration-200
                                          ${savedMeals[m.meal]
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default'
                                            : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-yellow-300/10 hover:text-yellow-300 hover:border-yellow-300/30 active:scale-95'
                                          }`}
                                      >
                                        {savedMeals[m.meal] ? '✓ Saved to My Meals' : '💾 Save to My Meals'}
                                      </button>
                                      <button
                                        disabled={!!savedAsRecipes[m.meal]}
                                        onClick={() => {
                                          const key = `ironbuddy_custom_recipes_${userId}`;
                                          const existing = JSON.parse(localStorage.getItem(key) || '[]');
                                          const entry = {
                                            id: Date.now(),
                                            name: m.meal,
                                            description: m.desc,
                                            icon: m.icon,
                                            prepTime: '',
                                            cookTime: '',
                                            servings: m.servings ?? String(getSrv(m.meal)),
                                            kcal: scaleKcal(m.kcal, getSrv(m.meal)),
                                            ingredients: getMealIngredients(m),
                                            steps: Array.isArray(m.steps) ? m.steps : [],
                                            created_at: new Date().toISOString(),
                                          };
                                          localStorage.setItem(key, JSON.stringify([entry, ...existing]));
                                          setSavedAsRecipes(prev => ({ ...prev, [m.meal]: true }));
                                          setMealTab('custom');
                                        }}
                                        className={`w-full py-2.5 rounded-xl font-black uppercase text-xs tracking-wide transition-all duration-200
                                          ${savedAsRecipes[m.meal]
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default'
                                            : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-yellow-300/10 hover:text-yellow-300 hover:border-yellow-300/30 active:scale-95'
                                          }`}
                                      >
                                        {savedAsRecipes[m.meal] ? '✓ Saved to My Recipes' : '👨‍🍳 Add to My Recipes'}
                                      </button>
                                    </div>
                                  )}
                                </motion.div>
                              );
                            })}
                          </motion.div>
                        </AnimatePresence>
                      </>
                    )}

                    {!aiMealLoading && !aiMealPlan && !aiMealError && (
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
                        <span className="text-5xl">🥗</span>
                        <p className="text-[--color-iron-gold] font-black uppercase">No plan yet</p>
                        <p className="text-gray-400 text-sm">Click <strong className="text-white">Regenerate</strong> to generate your personalised weekly meal plan.</p>
                      </div>
                    )}
                  </motion.div>
                )}
                {mealTab === 'my' && (
                  <motion.div key="my-meals" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                    <MyMeals token={token!} />
                  </motion.div>
                )}
                {mealTab === 'recipes' && (
                  <motion.div key="recipes" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                    <Recipes token={token!} />
                  </motion.div>
                )}
                {mealTab === 'custom' && (
                  <motion.div key="custom" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                    <CustomRecipeBuilder token={token!} />
                  </motion.div>
                )}
                {mealTab === 'ingredients' && (
                  <motion.div key="ingredients" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }} className="space-y-6">
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4">
                      <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">🧂 Ingredient Preferences</p>
                      <p className="text-gray-400 text-xs">Add ingredients you love or dislike — the AI will use these when generating your meal plan.</p>

                      {/* Preferred */}
                      <div className="space-y-2">
                        <p className="text-xs font-black uppercase text-green-400 tracking-wide">✅ Preferred</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(profile.preferredIngredients ?? []).filter((_, i, a) => a.indexOf(_) === i && !_.startsWith('!')).map((ing, i) => (
                            <span key={i} className="flex items-center gap-1 bg-green-500/10 border border-green-400/20 text-green-300 rounded-full px-3 py-1 text-xs font-semibold">
                              {ing}
                              <button onClick={() => setProfile((p) => ({ ...p, preferredIngredients: (p.preferredIngredients ?? []).filter((x) => x !== ing) }))}
                                className="text-green-500 hover:text-red-400 transition-colors ml-0.5">×</button>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Disliked */}
                      <div className="space-y-2">
                        <p className="text-xs font-black uppercase text-red-400 tracking-wide">❌ Disliked / Avoid</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(profile.preferredIngredients ?? []).filter((x) => x.startsWith('!')).map((ing, i) => (
                            <span key={i} className="flex items-center gap-1 bg-red-500/10 border border-red-400/20 text-red-300 rounded-full px-3 py-1 text-xs font-semibold">
                              {ing.slice(1)}
                              <button onClick={() => setProfile((p) => ({ ...p, preferredIngredients: (p.preferredIngredients ?? []).filter((x) => x !== ing) }))}
                                className="text-red-500 hover:text-red-300 transition-colors ml-0.5">×</button>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Add input */}
                      <div className="flex gap-2 pt-2">
                        <input
                          type="text"
                          value={prefIngNew}
                          onChange={(e) => setPrefIngNew(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('pref-add-btn')?.click(); } }}
                          placeholder="e.g. chicken, broccoli…"
                          className="flex-1 bg-black/30 border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-yellow-300/50"
                        />
                        <button id="pref-add-btn"
                          onClick={() => {
                            const val = prefIngNew.trim();
                            if (!val) return;
                            setProfile((p) => ({ ...p, preferredIngredients: [...(p.preferredIngredients ?? []).filter((x) => x !== val && x !== `!${val}`), val] }));
                            setPrefIngNew('');
                          }}
                          className="px-4 py-2 bg-green-500/20 border border-green-400/30 text-green-300 font-black rounded-xl text-xs hover:bg-green-500/30 transition-all"
                        >✅ Like</button>
                        <button
                          onClick={() => {
                            const val = prefIngNew.trim();
                            if (!val) return;
                            setProfile((p) => ({ ...p, preferredIngredients: [...(p.preferredIngredients ?? []).filter((x) => x !== val && x !== `!${val}`), `!${val}`] }));
                            setPrefIngNew('');
                          }}
                          className="px-4 py-2 bg-red-500/20 border border-red-400/30 text-red-300 font-black rounded-xl text-xs hover:bg-red-500/30 transition-all"
                        >❌ Dislike</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── WORKOUTS ── */}
          {active === 'workouts' && (
            <motion.div key="workouts" {...fadeUp(0)} className="space-y-6">
              {/* Sub-tabs */}
              <div className="flex gap-2 flex-wrap">
                {([
                  { id: 'ai', label: '🤖 AI Plan' },
                  { id: 'my', label: '✏️ My Workouts' },
                  { id: 'videos', label: '🎬 Videos' },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setWorkoutTab(tab.id)}
                    className={`px-3 py-1.5 sm:px-5 sm:py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wide transition-all duration-200 ${
                      workoutTab === tab.id
                        ? 'bg-yellow-300 text-black shadow-[0_0_16px_rgba(253,224,71,0.3)]'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {workoutTab === 'ai' && (
                  <motion.div key="ai" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="space-y-4">
                    {!activeSession ? (
                      <button
                        onClick={() => startWorkout('AI Workout Plan', 'ai')}
                        className="w-full py-3 bg-yellow-300 text-black font-black rounded-xl uppercase text-sm
                          hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        ▶ Start AI Workout
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 bg-yellow-300/10 border border-yellow-300/30 rounded-xl px-4 py-3">
                        <span className="text-yellow-300 font-black text-sm">🏋️ Workout in progress — {fmtElapsed(elapsedSec)}</span>
                      </div>
                    )}
                    <WorkoutPlanView profile={profile} token={token ?? undefined} />
                  </motion.div>
                )}
                {workoutTab === 'my' && (
                  <motion.div key="my" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                    <MyWorkouts token={token!} onStartWorkout={activeSession ? undefined : startWorkout} />
                  </motion.div>
                )}
                {workoutTab === 'videos' && (
                  <motion.div key="videos" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                    <WorkoutVideos token={token!} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── COMMUNITY ── */}
          {active === 'community' && (
            <motion.div key="community" {...fadeUp(0)}>
              <CommunityChat
                token={token!}
                currentUserId={getUserIdFromToken(token!) ?? 0}
                onUnreadChange={setCommunityUnread}
              />
            </motion.div>
          )}

          {/* ── PROGRESS ── */}
          {active === 'progress' && (
            <motion.div key="progress" {...fadeUp(0)} className="space-y-6">
              <SectionHeader title="Progress" sub="Track your transformation" />
              <ProgressTab
                token={token!}
                sessions={sessions}
                currentWeight={profile.weight ?? null}
              />
            </motion.div>
          )}

          {/* ── SETTINGS ── */}
          {active === 'settings' && (
            <motion.div key="settings" {...fadeUp(0)} className="space-y-6">
              <SectionHeader title="Settings" sub="Account & Security" />

              <div className="flex flex-col lg:flex-row gap-6">
                {/* ── Settings sidebar nav ── */}
                <div className="flex lg:flex-col gap-2 flex-wrap lg:w-52 shrink-0">
                  {([
                    { id: 'account',        icon: '👤', label: 'Account',       desc: 'Profile & visibility' },
                    { id: 'password',       icon: '🔑', label: 'Password',      desc: 'Change credentials' },
                    { id: 'legal',          icon: '📜', label: 'Legal',         desc: 'Disclaimer & terms' },
                    { id: 'delete_account', icon: '⚠️', label: 'Danger Zone',   desc: 'Deactivate or delete' },
                  ] as const).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSettingsTab(tab.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all duration-200 w-full ${
                        settingsTab === tab.id
                          ? tab.id === 'delete_account'
                            ? 'bg-red-500/20 border border-red-400/40 text-red-300 shadow-[0_0_16px_rgba(239,68,68,0.15)]'
                            : 'bg-yellow-300/15 border border-yellow-300/40 text-yellow-300 shadow-[0_0_16px_rgba(253,224,71,0.15)]'
                          : tab.id === 'delete_account'
                            ? 'bg-white/3 border border-red-500/10 text-gray-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-400/20'
                            : 'bg-white/3 border border-white/8 text-gray-400 hover:bg-white/8 hover:text-white hover:border-white/15'
                      }`}
                    >
                      <span className="text-xl shrink-0">{tab.icon}</span>
                      <div className="min-w-0">
                        <p className="font-black uppercase text-xs tracking-wide leading-none">{tab.label}</p>
                        <p className="text-[10px] opacity-60 mt-0.5 font-medium leading-none">{tab.desc}</p>
                      </div>
                      {settingsTab === tab.id && <span className="ml-auto text-xs opacity-60">▸</span>}
                    </button>
                  ))}
                </div>

                {/* ── Settings content panel ── */}
                <div className="flex-1 min-w-0">

              <AnimatePresence mode="wait">
                {/* Account tab */}
                {settingsTab === 'account' && (
                  <motion.div key="account" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-5">
                      {/* Header row */}
                      <div className="flex items-center justify-between">
                        <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">Profile Details</p>
                        {!editingAccount ? (
                          <button
                            onClick={openAccountEdit}
                            className="px-4 py-1.5 bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 font-bold rounded-xl uppercase text-xs transition-all"
                          >
                            ✏️ Edit
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingAccount(false)}
                              className="px-4 py-1.5 bg-white/5 border border-white/10 text-gray-400 hover:text-white font-bold rounded-xl uppercase text-xs transition-all"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={saveAccount}
                              className="px-4 py-1.5 bg-yellow-300 text-black font-black rounded-xl uppercase text-xs hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all"
                            >
                              Save
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Email — always read-only */}
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-xs text-gray-500 uppercase font-bold">Email</span>
                        <span className="text-sm text-gray-400 font-semibold truncate max-w-[60%] text-right">{profile.email || '—'}</span>
                      </div>

                      {editingAccount ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <AccountField label="Name" value={accountDraft.name} onChange={(v) => setAccountDraft((d) => ({ ...d, name: v }))} placeholder="Your name" />
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-500 uppercase font-bold">Goal</label>
                            <select
                              value={accountDraft.fitnessGoals}
                              onChange={(e) => setAccountDraft((d) => ({ ...d, fitnessGoals: e.target.value }))}
                              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all [&>option]:bg-gray-900"
                            >
                              <option value="">— Select —</option>
                              <option value="Weight Loss">Weight Loss</option>
                              <option value="Muscle Gain">Muscle Gain</option>
                              <option value="Endurance">Endurance</option>
                              <option value="General Fitness">General Fitness</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-500 uppercase font-bold">Level</label>
                            <select
                              value={accountDraft.experienceLevel}
                              onChange={(e) => setAccountDraft((d) => ({ ...d, experienceLevel: e.target.value }))}
                              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all [&>option]:bg-gray-900"
                            >
                              <option value="">— Select —</option>
                              <option value="Beginner">Beginner</option>
                              <option value="Intermediate">Intermediate</option>
                              <option value="Advanced">Advanced</option>
                              <option value="Unsure">Unsure</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-500 uppercase font-bold">Gender</label>
                            <select
                              value={accountDraft.gender}
                              onChange={(e) => setAccountDraft((d) => ({ ...d, gender: e.target.value }))}
                              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all [&>option]:bg-gray-900"
                            >
                              <option value="">— Select —</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                              <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                          </div>
                          <AccountField label="Height (cm)" value={accountDraft.height} onChange={(v) => setAccountDraft((d) => ({ ...d, height: v }))} placeholder="e.g. 175" type="number" />
                          <AccountField label="Weight (kg)" value={accountDraft.weight} onChange={(v) => setAccountDraft((d) => ({ ...d, weight: v }))} placeholder="e.g. 75" type="number" />
                          <AccountField label="Date of Birth" value={accountDraft.birthdate} onChange={(v) => setAccountDraft((d) => ({ ...d, birthdate: v }))} type="date" />
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-500 uppercase font-bold">Equipment</label>
                            <select
                              value={accountDraft.equipments}
                              onChange={(e) => setAccountDraft((d) => ({ ...d, equipments: e.target.value }))}
                              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all [&>option]:bg-gray-900"
                            >
                              <option value="">— Select —</option>
                              <option value="No Equipment">No Equipment</option>
                              <option value="Dumbbells">Dumbbells</option>
                              <option value="Barbell & Rack">Barbell & Rack</option>
                              <option value="Full Gym">Full Gym</option>
                              <option value="Resistance Bands">Resistance Bands</option>
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {[
                            { label: 'Name', value: profile.name || '—' },
                            { label: 'Goal', value: profile.fitnessGoals || '—' },
                            { label: 'Level', value: profile.experienceLevel || '—' },
                            { label: 'Gender', value: profile.gender || '—' },
                            { label: 'Height', value: profile.height ? `${profile.height} cm` : '—' },
                            { label: 'Weight', value: profile.weight ? `${profile.weight} kg` : '—' },
                            { label: 'Date of Birth', value: profile.birthdate || '—' },
                            { label: 'Equipment', value: profile.equipments || '—' },
                          ].map((item) => (
                            <div key={item.label} className="flex justify-between items-center py-2 border-b border-white/5">
                              <span className="text-xs text-gray-500 uppercase font-bold">{item.label}</span>
                              <span className="text-sm text-white font-semibold truncate max-w-[60%] text-right">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>

                    {/* Community visibility — standalone card */}
                    <div className={`mt-4 rounded-2xl border p-5 flex items-center justify-between gap-4 transition-all duration-300 ${
                      profile.communityVisible
                        ? 'bg-yellow-300/8 border-yellow-300/30 shadow-[0_0_20px_rgba(253,224,71,0.08)]'
                        : 'bg-white/5 border-white/10'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{profile.communityVisible ? '👁️' : '🫥'}</span>
                        <div>
                          <p className="text-sm font-black text-white uppercase tracking-wide">Community Visibility</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {profile.communityVisible
                              ? 'You are visible — others can find and message you.'
                              : 'You are hidden — no one can find you in the community.'}
                          </p>
                        </div>
                      </div>
                      <button
                        disabled={visibilityLoading}
                        onClick={() => setProfile((p) => ({ ...p, communityVisible: !p.communityVisible }))}
                        className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none shrink-0 ${
                          profile.communityVisible ? 'bg-yellow-300 shadow-[0_0_12px_rgba(253,224,71,0.4)]' : 'bg-white/10 border border-white/20'
                        }`}
                      >
                        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
                          profile.communityVisible ? 'translate-x-7' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Password tab */}
                {settingsTab === 'password' && (
                  <motion.div key="password" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4 max-w-sm">
                      {pwSuccess ? (
                        <motion.p
                          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                          className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3"
                        >
                          Password changed successfully!
                        </motion.p>
                      ) : (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            setPwError('');
                            if (pwNew.length < 8) { setPwError('New password must be at least 8 characters'); return; }
                            if (pwNew !== pwConfirm) { setPwError('Passwords do not match'); return; }
                            setPwSaving(true);
                            try {
                              await apiChangePassword(token!, pwCurrent, pwNew);
                              setPwSuccess(true);
                              setPwCurrent(''); setPwNew(''); setPwConfirm('');
                              setTimeout(() => setPwSuccess(false), 4000);
                            } catch (err: unknown) {
                              setPwError(err instanceof Error ? err.message : 'Failed to change password');
                            } finally {
                              setPwSaving(false);
                            }
                          }}
                          className="space-y-3"
                        >
                          <PwField label="Current Password" value={pwCurrent} onChange={setPwCurrent} />
                          <PwField label="New Password" value={pwNew} onChange={setPwNew} placeholder="Min. 8 characters" />
                          <PwField label="Confirm New Password" value={pwConfirm} onChange={setPwConfirm} placeholder="Repeat new password" />
                          {pwError && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2">{pwError}</p>}
                          <button
                            type="submit"
                            disabled={pwSaving}
                            className="w-full py-2.5 bg-yellow-300 text-black font-black rounded-xl uppercase text-sm
                              hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 mt-1"
                          >
                            {pwSaving ? 'Saving…' : 'Update Password'}
                          </button>
                        </form>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Legal tab */}
                {settingsTab === 'legal' && (
                  <motion.div key="legal" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">Health & Liability Disclaimer</p>
                        {profile.disclaimerAcceptedAt ? (
                          <span className="text-xs bg-green-400/10 text-green-400 border border-green-400/20 font-bold px-3 py-1 rounded-full">
                            ✓ Agreed
                          </span>
                        ) : (
                          <span className="text-xs bg-red-400/10 text-red-400 border border-red-400/20 font-bold px-3 py-1 rounded-full">
                            Not signed
                          </span>
                        )}
                      </div>
                      {profile.disclaimerAcceptedAt && (
                        <p className="text-xs text-gray-500">
                          Accepted on{' '}
                          <span className="text-gray-300 font-semibold">
                            {new Date(profile.disclaimerAcceptedAt).toLocaleString()}
                          </span>
                        </p>
                      )}
                      <div className="text-xs text-gray-500 leading-relaxed space-y-3 border-t border-white/10 pt-4">
                        <p>
                          IronBuddy provides AI-generated fitness and nutrition suggestions for{' '}
                          <span className="text-gray-300 font-semibold">informational purposes only</span>. The content
                          produced by IRON does not constitute medical advice, diagnosis, or treatment and is{' '}
                          <span className="text-gray-300 font-semibold">
                            not a substitute for professional medical, nutritional, or fitness guidance
                          </span>{' '}
                          from a qualified practitioner.
                        </p>
                        <ul className="space-y-1.5 list-none">
                          {[
                            'You are 18 years of age or older, or have obtained parental/guardian consent.',
                            'You have consulted a physician before beginning any exercise or diet program, or accept full responsibility for not doing so.',
                            'You understand that physical exercise carries inherent risk of injury or death and voluntarily assume all such risks.',
                            'You understand that recommendations are generated by an AI and may not account for your full medical history.',
                          ].map((item, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-[--color-iron-gold] shrink-0">▸</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="border-t border-white/10 pt-3">
                          The developer of IronBuddy accepts{' '}
                          <span className="text-gray-300">no liability</span> for any injury, illness, loss, or damage
                          arising directly or indirectly from use of this application or its AI-generated content.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Danger Zone tab */}
                {settingsTab === 'delete_account' && (
                  <motion.div key="danger" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                    <div className="bg-red-900/10 backdrop-blur-md border border-red-500/20 rounded-2xl p-6 space-y-6">
                      <p className="text-red-400 font-black uppercase text-sm tracking-widest">⚠️ Danger Zone</p>

                      {/* Deactivate */}
                      <div className="space-y-2">
                        <p className="text-white font-bold text-sm">Deactivate Account</p>
                        <p className="text-gray-400 text-xs">Your account will be hidden. You can reactivate it by signing in again.</p>
                        {dangerAction !== 'deactivate' ? (
                          <button onClick={() => { setDangerAction('deactivate'); setDangerError(''); setDangerPassword(''); }}
                            className="px-5 py-2 bg-orange-500/20 border border-orange-400/30 text-orange-300 font-black rounded-xl uppercase text-xs hover:bg-orange-500/30 transition-all">
                            Deactivate
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <PwField label="Confirm your password" value={dangerPassword} onChange={setDangerPassword} placeholder="Enter password" />
                            {dangerError && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{dangerError}</p>}
                            <div className="flex gap-2">
                              <button disabled={dangerLoading} onClick={async () => {
                                setDangerLoading(true); setDangerError('');
                                try {
                                  await apiDeactivateAccount(token!, dangerPassword);
                                  setProfile((p) => ({ ...p, onboarded: false }));
                                  navigate('/');
                                } catch (err: unknown) {
                                  setDangerError(err instanceof Error ? err.message : 'Failed');
                                } finally { setDangerLoading(false); }
                              }} className="px-5 py-2 bg-orange-500 text-black font-black rounded-xl uppercase text-xs hover:bg-orange-400 active:scale-95 transition-all disabled:opacity-50">
                                {dangerLoading ? 'Processing…' : 'Confirm Deactivate'}
                              </button>
                              <button onClick={() => setDangerAction(null)} className="px-5 py-2 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl uppercase text-xs hover:text-white transition-all">Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-red-500/20" />

                      {/* Delete */}
                      <div className="space-y-2">
                        <p className="text-white font-bold text-sm">Delete Account</p>
                        <p className="text-gray-400 text-xs">Permanently delete your account and all data. This cannot be undone.</p>
                        {dangerAction !== 'delete' ? (
                          <button onClick={() => { setDangerAction('delete'); setDangerError(''); setDangerPassword(''); }}
                            className="px-5 py-2 bg-red-500/20 border border-red-400/30 text-red-300 font-black rounded-xl uppercase text-xs hover:bg-red-500/30 transition-all">
                            Delete Account
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <PwField label="Confirm your password" value={dangerPassword} onChange={setDangerPassword} placeholder="Enter password" />
                            {dangerError && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{dangerError}</p>}
                            <div className="flex gap-2">
                              <button disabled={dangerLoading} onClick={async () => {
                                setDangerLoading(true); setDangerError('');
                                try {
                                  await apiDeleteAccount(token!, dangerPassword);
                                  setProfile((p) => ({ ...p, onboarded: false }));
                                  navigate('/');
                                } catch (err: unknown) {
                                  setDangerError(err instanceof Error ? err.message : 'Failed');
                                } finally { setDangerLoading(false); }
                              }} className="px-5 py-2 bg-red-600 text-white font-black rounded-xl uppercase text-xs hover:bg-red-500 active:scale-95 transition-all disabled:opacity-50">
                                {dangerLoading ? 'Deleting…' : '🗑️ Permanently Delete'}
                              </button>
                              <button onClick={() => setDangerAction(null)} className="px-5 py-2 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl uppercase text-xs hover:text-white transition-all">Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
                </div>{/* end content panel */}
              </div>{/* end sidebar + content flex */}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ── Profile photo lightbox ────────────────────────── */}
      <AnimatePresence>
        {viewingAvatar && profile.profilePicture && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setViewingAvatar(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative flex flex-col items-center gap-4 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={profile.profilePicture}
                alt="Profile photo"
                className="w-full max-h-[70vh] object-contain rounded-2xl border-2 border-yellow-300/40 shadow-[0_0_40px_rgba(250,204,21,0.2)]"
              />
              <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">
                {profile.name || 'Athlete'}
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => { setViewingAvatar(false); avatarInputRef.current?.click(); }}
                  className="flex-1 py-2.5 bg-yellow-300 text-black font-black rounded-xl uppercase text-xs
                    hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all duration-200"
                >
                  📷 Change Photo
                </button>
                <button
                  onClick={() => setViewingAvatar(false)}
                  className="flex-1 py-2.5 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl uppercase text-xs
                    hover:text-white transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function SidebarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500 uppercase font-bold">{label}</span>
      <span className="text-white text-xs font-semibold truncate max-w-28 text-right">{value}</span>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">{sub}</p>
      <h1 className="text-3xl font-black uppercase italic mt-1">{title}</h1>
    </div>
  );
}

function GoalDonut({ goalData, goal, large }: { goalData: { name: string; value: number; color: string }[]; goal: string; large?: boolean }) {
  const size = large ? 280 : 200;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4
        hover:border-yellow-300/30 hover:shadow-[0_0_20px_rgba(253,224,71,0.12)] transition-all duration-300"
    >
      <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest self-start">🎯 Goal Focus</p>
      <ResponsiveContainer width="100%" height={size}>
        <PieChart>
          <Pie data={goalData} cx="50%" cy="50%" innerRadius={size * 0.28} outerRadius={size * 0.42}
            paddingAngle={4} dataKey="value" animationBegin={0} animationDuration={900}>
            {goalData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }}
            formatter={(v) => [`${v}%`, '']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 justify-center">
        {goalData.map((d) => (
          <span key={d.name} className="flex items-center gap-1.5 text-xs text-gray-300 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: d.color }} />
            {d.name}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-500">{goal || 'No goal set yet'}</p>
    </motion.div>
  );
}

function MealSteps({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-white/10 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-yellow-300 transition-colors"
      >
        👨‍🍳 How to prepare
        <span className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-2 text-xs text-gray-300 leading-relaxed">
                  <span className="text-[--color-iron-gold] font-black shrink-0 mt-px">{i + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MealCard({ meals, onNavigate }: { meals: AIMealItem[] | null; onNavigate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col gap-4
        hover:border-yellow-300/30 hover:shadow-[0_0_20px_rgba(253,224,71,0.12)] transition-all duration-300"
    >
      <button onClick={onNavigate} className="flex items-center justify-between group text-left">
        <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">🥗 AI Meal Suggestions</p>
        <span className="text-gray-600 group-hover:text-yellow-300 text-xs font-bold uppercase tracking-wide transition-colors">
          View all →
        </span>
      </button>
      {meals === null ? (
        <button
          onClick={onNavigate}
          className="flex flex-col items-center gap-2 py-6 text-center bg-white/5 border border-white/10 rounded-xl
            hover:border-yellow-300/30 hover:bg-yellow-300/5 transition-all duration-150"
        >
          <span className="text-3xl">🥗</span>
          <p className="text-gray-400 text-xs">Tap to generate your AI meal plan</p>
        </button>
      ) : (
        <>
          {[
            { label: '☀️ Breakfast', meal: meals[0] },
            { label: '🌤️ Lunch',     meal: meals[1] },
            { label: '🌙 Dinner',    meal: meals[2] },
          ].map(({ label, meal }) => meal && (
            <button
              key={meal.meal}
              onClick={onNavigate}
              className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3
                hover:border-yellow-300/30 hover:bg-yellow-300/5 active:scale-[0.98] transition-all duration-150 text-left w-full"
            >
              <span className="text-xl shrink-0">{meal.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-500 uppercase font-bold">{label}</p>
                <p className="text-white text-sm font-bold truncate leading-tight">{meal.meal}</p>
              </div>
              <span className="text-yellow-300 text-xs font-bold shrink-0">{meal.kcal}</span>
            </button>
          ))}
        </>
      )}
    </motion.div>
  );
}

function AccountField({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 uppercase font-bold">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600"
      />
    </div>
  );
}

function PwField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 uppercase font-bold">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-white text-sm
            focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors text-sm"
        >
          {show ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  );
}

function AchievementsCard({ onboarded }: { onboarded: boolean }) {
  const achievements = [
    { icon: '🏋️', label: 'First Login', done: true },
    { icon: '📋', label: 'Profile Complete', done: onboarded },
    { icon: '🔥', label: '7-Day Streak', done: false },
    { icon: '💪', label: '10 Workouts', done: false },
    { icon: '🥗', label: 'Nutrition Set', done: false },
    { icon: '🏆', label: 'First Goal', done: false },
  ];
  return (
    <motion.div {...fadeUp(0.3)}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6
        hover:border-yellow-300/30 hover:shadow-[0_0_20px_rgba(253,224,71,0.12)] transition-all duration-300">
      <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest mb-5">🏆 Achievements</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {achievements.map((a, i) => (
          <motion.div key={a.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: 0.35 + i * 0.06 }}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all duration-300 ${
              a.done ? 'bg-yellow-300/10 border-yellow-300/30 shadow-[0_0_10px_rgba(253,224,71,0.15)]' : 'bg-white/5 border-white/5 opacity-30'}`}>
            <span className="text-2xl">{a.icon}</span>
            <p className={`text-xs font-bold uppercase leading-tight ${a.done ? 'text-[--color-iron-gold]' : 'text-gray-400'}`}>{a.label}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
