import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n, { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';
import { useUser } from '../context/userContext';
import { apiUploadFile, apiChangePassword, apiDeleteAccount, apiDeactivateAccount, apiGetAIMealPlan, apiGetSessions, apiStartSession, apiFinishSession, apiCreateCustomMeal, apiSaveProfile, type AIMealItem, type AIMealPlan, type WorkoutSession } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import CoachChat from './CoachChat';
import WorkoutPlanView from './WorkoutPlan';
import MyWorkouts from './MyWorkouts';
import MyMeals from './MyMeals';
import Recipes from './Recipes';
import CustomRecipeBuilder from './CustomRecipeBuilder';
import WorkoutVideos from './WorkoutVideos';
import ExerciseLibrary from './ExerciseLibrary';
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

// ── Sidebar nav ids (labels are computed inside the component via t()) ──────────
const NAV_IDS = [
  { id: 'dashboard', icon: '📊', key: 'nav.dashboard' },
  { id: 'coach',     icon: '🦾', key: 'nav.coach' },
  { id: 'goals',     icon: '🎯', key: 'nav.goals' },
  { id: 'meals',     icon: '🥗', key: 'nav.meals' },
  { id: 'workouts',  icon: '💪', key: 'nav.workouts' },
  { id: 'community', icon: '💬', key: 'nav.community' },
  { id: 'progress',  icon: '📈', key: 'nav.progress' },
  { id: 'settings',  icon: '⚙️', key: 'nav.settings' },
] as const;

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay },
});

// ── Donut data ─────────────────────────────────────────────────
function buildGoalData(goal: string) {
  const map: Record<string, { key: string; value: number; color: string }[]> = {
    'Weight Loss':    [{ key: 'goals.seg.fat_loss', value: 60, color: '#facc15' }, { key: 'goals.seg.cardio', value: 25, color: '#a3e635' }, { key: 'goals.seg.strength', value: 15, color: '#38bdf8' }],
    'Muscle Gain':   [{ key: 'goals.seg.strength', value: 55, color: '#facc15' }, { key: 'goals.seg.hypertrophy', value: 30, color: '#fb923c' }, { key: 'goals.seg.recovery', value: 15, color: '#a78bfa' }],
    'Endurance':     [{ key: 'goals.seg.cardio', value: 60, color: '#facc15' }, { key: 'goals.seg.stamina', value: 25, color: '#34d399' }, { key: 'goals.seg.mobility', value: 15, color: '#60a5fa' }],
    'General Fitness':[{ key: 'goals.seg.cardio', value: 35, color: '#facc15' }, { key: 'goals.seg.strength', value: 35, color: '#34d399' }, { key: 'goals.seg.flexibility', value: 30, color: '#f472b6' }],
  };
  return map[goal] ?? [{ key: 'goals.seg.set_goal', value: 100, color: '#374151' }];
}

// ── AI Meal Plan cache ──────────────────────────────────────────
const MEAL_CACHE_DAYS = 7;

function mealCacheKey(userId: number) {
  return `ironbuddy_ai_meals_${userId}`;
}

interface MealCache {
  plan: AIMealPlan;
  goal: string;
  language: string;
  generated_at: string; // ISO date string
}

function loadMealCache(userId: number, goal: string, language: string): AIMealPlan | null {
  try {
    const raw = localStorage.getItem(mealCacheKey(userId));
    if (!raw) return null;
    const cache: MealCache = JSON.parse(raw);
    if (cache.goal !== goal) return null;
    if ((cache.language ?? 'en') !== language) return null;
    const ageMs = Date.now() - new Date(cache.generated_at).getTime();
    if (ageMs > MEAL_CACHE_DAYS * 24 * 60 * 60 * 1000) return null;
    return cache.plan;
  } catch { return null; }
}

function saveMealCache(userId: number, goal: string, language: string, plan: AIMealPlan) {
  const cache: MealCache = { plan, goal, language, generated_at: new Date().toISOString() };
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

function scaleKcal(kcal: number | string, multiplier: number): string {
  const num = typeof kcal === 'number' ? kcal : parseInt(String(kcal).replace(/\D/g, '')) || 0;
  return `${Math.round(num * multiplier)} kcal`;
}

function scaleMacro(val: number | undefined, multiplier: number): number {
  return Math.round((val ?? 0) * multiplier);
}

// ══════════════════════════════════════════════════════════════
function calcBMI(weight: number | null, height: number | null) {
  if (!weight || !height) return null;
  return weight / Math.pow(height / 100, 2);
}

function bmiCategory(bmi: number): { key: string; color: string } {
  if (bmi < 18.5) return { key: 'bmi.underweight', color: '#60a5fa' };
  if (bmi < 25)   return { key: 'bmi.normal',      color: '#4ade80' };
  if (bmi < 30)   return { key: 'bmi.overweight',  color: '#fb923c' };
  return               { key: 'bmi.obese',         color: '#f87171' };
}

export default function UserProfile() {
  const { profile, token, setProfile } = useUser();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Sync i18n language with profile on mount
  useEffect(() => {
    if (profile.language && profile.language !== i18n.language) {
      i18n.changeLanguage(profile.language);
    }
  }, [profile.language]);
  const [active, setActive] = useState('dashboard');
  const [communityUnread, setCommunityUnread] = useState(0);
  const [workoutTab, setWorkoutTab] = useState<'ai' | 'my' | 'library'>('ai');
  const [mealTab, setMealTab] = useState<'ai' | 'my' | 'recipes' | 'custom' | 'ingredients'>('ai');
  const [settingsTab, setSettingsTab] = useState<'account' | 'password' | 'legal' | 'delete_account' | 'languages'>('account');
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightInput, setWeightInput] = useState(String(profile.weight ?? ''));
  const [editingGoal, setEditingGoal] = useState(false);
  const [editingLevel, setEditingLevel] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [viewingAvatar, setViewingAvatar] = useState(false);
  const [mealServings, setMealServings] = useState<Record<string, number>>({});
  const [savedMeals, setSavedMeals] = useState<Record<string, boolean>>({});
  const [loggedMeals, setLoggedMeals] = useState<Record<string, boolean>>({});
  const [savedAsRecipes, setSavedAsRecipes] = useState<Record<string, boolean>>({});
  const getSrv = (name: string) => mealServings[name] ?? 1;
  const setSrv = (name: string, n: number) =>
    setMealServings((p) => ({ ...p, [name]: Math.max(1, Math.min(10, n)) }));
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [mealTimeTab, setMealTimeTab] = useState<'breakfast' | 'lunch' | 'dinner' | 'snacks'>('breakfast');
  const [mealSuggIdx, setMealSuggIdx] = useState<Record<string, number>>({});
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [closedMealCards, setClosedMealCards] = useState<Set<string>>(new Set());

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
  const todayKey = `ironbuddy_daily_log_${userId}_${new Date().toISOString().split('T')[0]}`;

  function getDailyLog(): { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }[] {
    try { return JSON.parse(localStorage.getItem(todayKey) || '[]'); } catch { return []; }
  }
  function logMealToday(meal: AIMealItem, servings: number) {
    const log = getDailyLog();
    const kcalNum = typeof meal.kcal === 'number' ? meal.kcal : parseInt(String(meal.kcal).replace(/\D/g, '')) || 0;
    const entry = {
      name: meal.meal,
      kcal: Math.round(kcalNum * servings),
      protein_g: Math.round((meal.protein_g ?? 0) * servings),
      carbs_g: Math.round((meal.carbs_g ?? 0) * servings),
      fat_g: Math.round((meal.fat_g ?? 0) * servings),
    };
    localStorage.setItem(todayKey, JSON.stringify([...log.filter((e) => e.name !== meal.meal), entry]));
  }

  const fetchAIMeals = async (force = false) => {
    const lang = profile.language ?? 'en';
    if (!force) {
      const cached = loadMealCache(userId ?? 0, profile.fitnessGoals, lang);
      if (cached) { setAiMealPlan(cached); return; }
    }
    setAiMealLoading(true);
    setAiMealError('');
    try {
      const { email: _e, password: _p, onboarded: _o, ...profileData } = profile;
      const plan = await apiGetAIMealPlan(profileData as Record<string, unknown>);
      setAiMealPlan(plan);
      saveMealCache(userId ?? 0, profile.fitnessGoals, lang, plan);
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
  const [notesInput, setNotesInput] = useState('');
  const [showNotesPrompt, setShowNotesPrompt] = useState(false);

  const handleAvatarClick = () => {
    if (profile.profilePicture && !avatarError) {
      setViewingAvatar(true);
    } else {
      avatarInputRef.current?.click();
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setUploadError('');
    setViewingAvatar(false);
    try {
      const result = await apiUploadFile(file, token ?? '');
      setAvatarError(false);
      setProfile((p) => ({ ...p, profilePicture: result.file_url }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
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
      const cached = loadMealCache(userId, profile.fitnessGoals, profile.language ?? 'en');
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

  const finishWorkout = async (notes?: string) => {
    if (!token || !activeSession) return;
    setFinishing(true);
    setShowNotesPrompt(false);
    try {
      const duration = Math.round(elapsedSec / 60);
      const finished = await apiFinishSession(token, activeSession.id, duration, notes);
      setSessions((p) => p.map((s) => s.id === finished.id ? finished : s));
      setActiveSession(null);
      setElapsedSec(0);
      setNotesInput('');
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

      {/* Hidden file input — outside sidebar so it works on mobile too */}
      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

      {/* ── Sidebar (desktop only) ───────────────────────── */}
      <motion.aside
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="hidden md:flex flex-col w-64 h-[calc(100vh-4rem)] overflow-y-auto bg-white/5 backdrop-blur-xl border-r border-white/10 px-4 py-8 fixed top-16 left-0 shadow-[4px_0_30px_rgba(0,0,0,0.3)]"
      >
        {/* Avatar */}
        <div className="flex flex-col items-center mb-8">
          <button
            onClick={handleAvatarClick}
            disabled={avatarUploading}
            className="relative w-24 h-24 rounded-2xl border-2 border-yellow-300 overflow-hidden group focus:outline-none shadow-[0_0_20px_rgba(250,204,21,0.2)]"
            title={profile.profilePicture && !avatarError ? t('profile.view_photo') : t('profile.upload_photo')}
          >
            {profile.profilePicture && !avatarError ? (
              <img src={profile.profilePicture} alt="avatar" className="absolute inset-0 w-full h-full object-cover" onError={() => setAvatarError(true)} />
            ) : (
              <div className="absolute inset-0 bg-yellow-300/20 flex items-center justify-center text-4xl animate-coach-breathe">
                🦾
              </div>
            )}
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {avatarUploading ? (
                <span className="text-white text-xs font-bold">{t('common.uploading')}</span>
              ) : profile.profilePicture && !avatarError ? (
                <>
                  <span className="text-lg">🔍</span>
                  <span className="text-white text-[10px] font-bold uppercase tracking-wide">{t('common.view')}</span>
                </>
              ) : (
                <>
                  <span className="text-lg">📷</span>
                  <span className="text-white text-[10px] font-bold uppercase tracking-wide">{t('common.upload')}</span>
                </>
              )}
            </div>
          </button>
          <p className="mt-3 font-black text-[--color-iron-gold] uppercase text-sm tracking-widest text-center">
            {profile.name || t('common.athlete')}
          </p>
          {uploadError && (
            <p className="mt-1 text-red-400 text-xs text-center">{uploadError}</p>
          )}
        </div>

        {/* BMI Badge */}
        {bmi && bmiInfo && (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 mb-4 border border-white/10 flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase font-bold">{t('sidebar.bmi')}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white">{bmi.toFixed(1)}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: bmiInfo.color, background: `${bmiInfo.color}22` }}>
                {t(bmiInfo.key)}
              </span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          {NAV_IDS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all duration-200
                ${active === item.id
                  ? 'bg-yellow-300/15 text-[--color-iron-gold] shadow-[0_0_12px_rgba(250,204,21,0.2)]'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
              <span className="text-lg">{item.icon}</span>
              {t(item.key)}
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
          className="mt-6 w-full py-1.5 sm:py-2.5 text-black font-bold rounded-lg uppercase text-xs sm:text-sm"
        >
          {t('common.sign_out')}
        </Link>
      </motion.aside>


      {/* ── Mobile bottom nav (mobile only) ─────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[--color-gym-dark]/95 backdrop-blur-xl border-t border-white/10 flex items-center gap-1 px-2 py-2 overflow-x-auto">
        {NAV_IDS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            className={`shrink-0 flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-200 min-w-0 relative
              ${active === item.id
                ? 'text-[--color-iron-gold]'
                : 'text-gray-500'}`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide">{t(item.key)}</span>
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
          <span className="text-[10px] font-bold uppercase tracking-wide">{t('common.out')}</span>
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
                <p className="text-black/60 text-xs font-bold">{t('session.in_progress')}{fmtElapsed(elapsedSec)}</p>
              </div>
            </div>
            <button
              onClick={() => setShowNotesPrompt(true)}
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
      <main className={`flex-1 md:ml-64 px-3 md:px-6 pt-3 pb-24 md:pt-6 md:pb-8 space-y-4 md:space-y-8 overflow-x-hidden ${activeSession ? 'mt-[44px]' : ''}`}>
        <AnimatePresence mode="wait">

          {/* ── DASHBOARD ── */}
          {active === 'dashboard' && (
            <motion.div key="dashboard" {...fadeUp(0)} className="space-y-4 md:space-y-8">
              <motion.div {...fadeUp(0)} className="flex items-center gap-4">
                {/* Avatar — left side, mobile only */}
                <button
                  onClick={handleAvatarClick}
                  disabled={avatarUploading}
                  className="md:hidden relative shrink-0 w-14 h-14 rounded-2xl border-2 border-yellow-300 overflow-hidden focus:outline-none shadow-[0_0_14px_rgba(250,204,21,0.2)]"
                  title={profile.profilePicture && !avatarError ? t('profile.view_photo') : t('profile.upload_photo')}
                >
                  {profile.profilePicture && !avatarError ? (
                    <img src={profile.profilePicture} alt="avatar" className="absolute inset-0 w-full h-full object-cover" onError={() => setAvatarError(true)} />
                  ) : (
                    <div className="absolute inset-0 bg-yellow-300/20 flex items-center justify-center text-2xl">
                      🦾
                    </div>
                  )}
                </button>
                {/* Welcome text — right of avatar */}
                <div>
                  <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">{t('dashboard.title')}</p>
                  <h1 className="text-xl md:text-3xl font-black uppercase italic mt-1">
                    {t('dashboard.welcome')} <span className="text-[--color-iron-gold]">{profile.name?.split(' ')[0] || t('common.athlete')}</span> 💪
                  </h1>
                </div>
              </motion.div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                {[
                  { label: t('dashboard.workouts'), value: String(totalWorkouts), icon: '🏋️' },
                  { label: t('dashboard.streak'), value: streak > 0 ? `${streak} ${streak !== 1 ? t('dashboard.days') : t('dashboard.day')}` : '—', icon: '🔥' },
                  { label: t('dashboard.goal'), value: profile.fitnessGoals || '—', icon: '🎯' },
                  { label: t('dashboard.bmi'), value: bmi ? `${bmi.toFixed(1)} — ${bmiInfo ? t(bmiInfo.key) : ''}` : '—', icon: '⚖️' },
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                <GoalDonut goalData={goalData} goal={profile.fitnessGoals} />
                <MealCard
                  meals={aiMealPlan
                    ? [...(aiMealPlan.breakfast.slice(0,1)), ...(aiMealPlan.lunch.slice(0,1)), ...(aiMealPlan.dinner.slice(0,1))]
                    : null}
                  onNavigate={() => { setActive('meals'); setMealTab('ai'); }}
                />
              </div>

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
            <motion.div key="goals" {...fadeUp(0)} className="space-y-3 md:space-y-6">
              <SectionHeader title={t('goals.title')} sub={t('goals.subtitle')} />
              <GoalDonut goalData={goalData} goal={profile.fitnessGoals} large />
            </motion.div>
          )}

          {/* ── MEALS ── */}
          {active === 'meals' && (
            <motion.div key="meals" {...fadeUp(0)} className="space-y-3 md:space-y-6">
              {/* Sub-tabs */}
              <div className="flex border-b border-white/10">
                {([
                  { id: 'ai', label: t('meals.ai_tab') },
                  { id: 'my', label: t('meals.my_tab') },
                  { id: 'custom', label: t('meals.recipes_tab') },
                  { id: 'recipes', label: t('meals.videos_tab') },
                  { id: 'ingredients', label: t('meals.prefs_tab') },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMealTab(tab.id)}
                    style={{ fontSize: '0.65rem' }}
                    className={`flex-1 py-1.5 sm:py-2.5 text-center font-black uppercase tracking-wide transition-all duration-200 border-b-2 -mb-px truncate px-1 ${
                      mealTab === tab.id
                        ? 'border-[--color-iron-gold] text-[--color-iron-gold]'
                        : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-white/20'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {mealTab === 'ai' && (
                  <motion.div key="ai-meals" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="space-y-4">

                    {/* ── Today's Macro Tracker ── */}
                    {(() => {
                      const log = getDailyLog();
                      if (log.length === 0) return null;
                      const totKcal = log.reduce((s, e) => s + e.kcal, 0);
                      const totP    = log.reduce((s, e) => s + e.protein_g, 0);
                      const totC    = log.reduce((s, e) => s + e.carbs_g, 0);
                      const totF    = log.reduce((s, e) => s + e.fat_g, 0);
                      return (
                        <div className="bg-teal-500/5 border border-teal-500/20 rounded-2xl px-4 py-3 flex items-center gap-4 flex-wrap">
                          <span className="text-sm font-black text-teal-300 uppercase tracking-wide">📊 Today's Log</span>
                          <div className="flex items-center gap-3 flex-wrap text-xs font-bold">
                            <span className="text-white">{totKcal} kcal</span>
                            <span className="text-gray-600">·</span>
                            <span className="text-red-300">P {totP}g</span>
                            <span className="text-sky-300">C {totC}g</span>
                            <span className="text-orange-300">F {totF}g</span>
                            <span className="text-gray-500 text-[10px]">({log.length} meal{log.length !== 1 ? 's' : ''} logged)</span>
                          </div>
                          <button
                            onClick={() => { localStorage.removeItem(todayKey); setLoggedMeals({}); }}
                            className="ml-auto text-[10px] text-gray-600 hover:text-red-400 transition-colors font-bold uppercase tracking-wide"
                          >
                            Clear
                          </button>
                        </div>
                      );
                    })()}

                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">{t('meals.weekly_plan')} · {profile.fitnessGoals || '—'}</p>
                        <h2 className="text-2xl font-black uppercase italic mt-1">🥗 {t('meals.title')}</h2>
                        {getMealCacheAge(userId ?? 0) !== null && (
                          <p className="text-gray-500 text-xs mt-1">
                            {getMealCacheAge(userId ?? 0) === 1 ? t('meals.day_ago', { count: 1 }) : t('meals.days_ago', { count: getMealCacheAge(userId ?? 0) ?? 0 })}
                            {' · '}{t('meals.refreshes_weekly')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => fetchAIMeals(true)}
                        disabled={aiMealLoading}
                        className="shrink-0 px-4 py-2 text-yellow-300 font-black rounded-xl uppercase text-xs tracking-wide border border-yellow-300/40
                          hover:border-yellow-300 hover:scale-[1.04] active:scale-95
                          transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                        style={{ background: '#060608', boxShadow: '0 0 12px rgba(253,224,71,0.25)' }}
                      >
                        {aiMealLoading ? `⏳ ${t('meals.generating')}` : `🔄 ${t('meals.regenerate')}`}
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
                        <div className="flex gap-1.5 p-1 bg-white/5 border border-white/10 rounded-2xl">
                          {([
                            { id: 'breakfast', emoji: '☀️', label: t('meals.breakfast') },
                            { id: 'lunch',     emoji: '🌤️', label: t('meals.lunch') },
                            { id: 'dinner',    emoji: '🌙', label: t('meals.dinner') },
                            { id: 'snacks',    emoji: '🍎', label: t('meals.snacks') },
                          ] as const).map((tab) => (
                            <button
                              key={tab.id}
                              onClick={() => { setMealTimeTab(tab.id); setClosedMealCards(s => { const n = new Set(s); n.delete(tab.id); return n; }); }}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wide transition-all duration-200 ${
                                mealTimeTab === tab.id
                                  ? 'bg-gradient-to-br from-yellow-400/90 to-amber-500/80 text-black shadow-[0_2px_12px_rgba(251,191,36,0.4)]'
                                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                              }`}
                            >
                              <span>{tab.emoji}</span>
                              <span className="hidden sm:inline">{tab.label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Daily nutrition summary — collapsible dropdown */}
                        {(() => {
                          const dayMeals = [
                            (aiMealPlan.breakfast ?? [])[0],
                            (aiMealPlan.lunch ?? [])[0],
                            (aiMealPlan.dinner ?? [])[0],
                            (aiMealPlan.snacks ?? [])[0],
                          ].filter(Boolean);
                          const hasNutrition = dayMeals.some(m => m.protein_g || m.carbs_g || m.fat_g);
                          if (!hasNutrition) return null;
                          const totalKcal = dayMeals.reduce((s, m) => s + (typeof m.kcal === 'number' ? m.kcal : parseInt(String(m.kcal)) || 0), 0);
                          const totalP = dayMeals.reduce((s, m) => s + (m.protein_g ?? 0), 0);
                          const totalC = dayMeals.reduce((s, m) => s + (m.carbs_g ?? 0), 0);
                          const totalF = dayMeals.reduce((s, m) => s + (m.fat_g ?? 0), 0);
                          const pct = (val: number, total: number) => total ? Math.round((val / total) * 100) : 0;
                          const kcalFromP = totalP * 4;
                          const kcalFromC = totalC * 4;
                          const kcalFromF = totalF * 9;
                          return (
                            <div className="border border-white/10 rounded-2xl overflow-hidden">
                              {/* Header / toggle */}
                              <button
                                onClick={() => setNutritionOpen(o => !o)}
                                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white/5 hover:bg-white/8 transition-colors"
                              >
                                <div className="flex flex-col gap-1 min-w-0">
                                  <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{t('meals.daily_total')}</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className="text-xs bg-yellow-400/15 text-yellow-300 font-black px-2.5 py-0.5 rounded-full border border-yellow-400/20">🔥 {totalKcal} kcal</span>
                                    <span className="text-xs bg-red-500/10 text-red-300 font-bold px-2 py-0.5 rounded-full">P {totalP}g</span>
                                    <span className="text-xs bg-sky-500/10 text-sky-300 font-bold px-2 py-0.5 rounded-full">C {totalC}g</span>
                                    <span className="text-xs bg-orange-500/10 text-orange-300 font-bold px-2 py-0.5 rounded-full">F {totalF}g</span>
                                  </div>
                                </div>
                                <span className={`text-gray-400 transition-transform duration-300 text-xs ${nutritionOpen ? 'rotate-180' : ''}`}>▼</span>
                              </button>

                              {/* Expandable body */}
                              <AnimatePresence initial={false}>
                                {nutritionOpen && (
                                  <motion.div
                                    key="nutrition-body"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                  >
                                    <div className="px-4 py-4 space-y-4 border-t border-white/10 bg-black/20">
                                      {/* Macro bars */}
                                      {[
                                        { label: 'Protein', val: totalP, kcal: kcalFromP, pct: pct(kcalFromP, totalKcal), color: 'bg-red-400', text: 'text-red-300', border: 'border-red-400/30', bg: 'bg-red-500/10', emoji: '🥩' },
                                        { label: 'Carbs',   val: totalC, kcal: kcalFromC, pct: pct(kcalFromC, totalKcal), color: 'bg-sky-400',  text: 'text-sky-300',  border: 'border-sky-400/30',  bg: 'bg-sky-500/10',  emoji: '🌾' },
                                        { label: 'Fat',     val: totalF, kcal: kcalFromF, pct: pct(kcalFromF, totalKcal), color: 'bg-orange-400', text: 'text-orange-300', border: 'border-orange-400/30', bg: 'bg-orange-500/10', emoji: '🫒' },
                                      ].map(macro => (
                                        <div key={macro.label}>
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className={`text-xs font-black ${macro.text} flex items-center gap-1.5`}>
                                              {macro.emoji} {macro.label}
                                            </span>
                                            <div className="flex items-center gap-2">
                                              <span className={`text-[11px] font-bold ${macro.text} ${macro.bg} border ${macro.border} px-2 py-0.5 rounded-full`}>{macro.val}g</span>
                                              <span className="text-[11px] text-gray-500 font-bold">{macro.kcal} kcal · {macro.pct}%</span>
                                            </div>
                                          </div>
                                          <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                                            <motion.div
                                              initial={{ width: 0 }}
                                              animate={{ width: `${macro.pct}%` }}
                                              transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                                              className={`h-full ${macro.color} rounded-full`}
                                            />
                                          </div>
                                        </div>
                                      ))}

                                      {/* Per-meal breakdown */}
                                      <div className="pt-2 border-t border-white/10">
                                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Per Meal</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                          {[
                                            { label: t('meals.breakfast'), emoji: '☀️', meal: (aiMealPlan.breakfast ?? [])[0] },
                                            { label: t('meals.lunch'),     emoji: '🌤️', meal: (aiMealPlan.lunch ?? [])[0] },
                                            { label: t('meals.dinner'),    emoji: '🌙', meal: (aiMealPlan.dinner ?? [])[0] },
                                            { label: t('meals.snacks'),    emoji: '🍎', meal: (aiMealPlan.snacks ?? [])[0] },
                                          ].filter(x => x.meal).map(({ label, emoji, meal }) => {
                                            const k = typeof meal!.kcal === 'number' ? meal!.kcal : parseInt(String(meal!.kcal)) || 0;
                                            return (
                                              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                                                <div className="text-lg mb-0.5">{emoji}</div>
                                                <div className="text-[10px] text-gray-400 font-black uppercase mb-1">{label}</div>
                                                <div className="text-xs text-yellow-300 font-black">{k} kcal</div>
                                                <div className="text-[10px] text-gray-500 mt-0.5">
                                                  P{meal!.protein_g ?? '—'} · C{meal!.carbs_g ?? '—'} · F{meal!.fat_g ?? '—'}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })()}

                        <AnimatePresence mode="wait">
                          <motion.div
                            key={mealTimeTab}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                            transition={{ duration: 0.18 }}
                            className="space-y-3"
                          >
                            {/* Suggestion dropdown */}
                            {(aiMealPlan[mealTimeTab] ?? []).length > 1 && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest shrink-0">Suggestion</span>
                                <select
                                  value={mealSuggIdx[mealTimeTab] ?? 0}
                                  onChange={e => {
                                    setMealSuggIdx(p => ({ ...p, [mealTimeTab]: Number(e.target.value) }));
                                    setClosedMealCards(s => { const n = new Set(s); n.delete(mealTimeTab); return n; });
                                  }}
                                  className="flex-1 text-sm font-bold text-white border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-yellow-300/50 cursor-pointer"
                                  style={{ background: '#060608' }}
                                >
                                  {(aiMealPlan[mealTimeTab] ?? []).map((m, i) => (
                                    <option key={i} value={i} style={{ background: '#060608' }}>
                                      {m.icon} {m.meal}
                                    </option>
                                  ))}
                                </select>
                                {/* Delete current suggestion */}
                                <button
                                  onClick={() => {
                                    const idx = mealSuggIdx[mealTimeTab] ?? 0;
                                    setAiMealPlan(prev => {
                                      if (!prev) return prev;
                                      const list = [...(prev[mealTimeTab] ?? [])];
                                      list.splice(idx, 1);
                                      return { ...prev, [mealTimeTab]: list };
                                    });
                                    setMealSuggIdx(p => ({ ...p, [mealTimeTab]: Math.max(0, idx - 1) }));
                                    setClosedMealCards(s => { const n = new Set(s); n.delete(mealTimeTab); return n; });
                                  }}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 border border-white/10 hover:border-red-400/30 transition-all shrink-0"
                                  style={{ background: '#060608' }}
                                  title="Delete this suggestion"
                                >🗑</button>
                              </div>
                            )}

                            {(() => {
                              const meals = aiMealPlan[mealTimeTab] ?? [];
                              const idx = mealSuggIdx[mealTimeTab] ?? 0;
                              const m = meals[Math.min(idx, meals.length - 1)];
                              if (!m) return null;
                              if (closedMealCards.has(mealTimeTab)) return (
                                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                                  <span className="text-xs text-gray-400 font-bold">{m.icon} {m.meal}</span>
                                  <button
                                    onClick={() => setClosedMealCards(s => { const n = new Set(s); n.delete(mealTimeTab); return n; })}
                                    className="text-xs text-gray-500 hover:text-yellow-300 font-black uppercase tracking-wide transition-colors"
                                  >Show</button>
                                </div>
                              );
                              const srv = getSrv(m.meal);
                              return (
                                <motion.div key={m.meal} {...fadeUp(0)}
                                  className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-6 flex flex-col gap-4
                                    hover:border-yellow-300/30 hover:shadow-[0_0_20px_rgba(253,224,71,0.12)] transition-all duration-300">
                                  <div className="flex items-start gap-3">
                                    <span className="text-4xl shrink-0">{m.icon}</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-black text-[--color-iron-gold] uppercase text-sm">{m.meal}</p>
                                      <p className="text-gray-400 text-xs mt-0.5">{m.desc}</p>
                                    </div>
                                    <button
                                      onClick={() => setClosedMealCards(s => new Set(s).add(mealTimeTab))}
                                      className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all text-base leading-none"
                                      title="Close"
                                    >×</button>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between gap-2 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5">
                                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{t('meals.servings')}</span>
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <button onClick={() => setSrv(m.meal, srv - 1)} disabled={srv <= 1}
                                          className="w-7 h-7 rounded-lg bg-white/10 border border-white/10 hover:bg-red-500/20 hover:border-red-400/40 hover:text-red-300 text-gray-300 font-black text-sm
                                            flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed active:scale-90">−</button>
                                        <span className="text-white font-black text-sm w-5 text-center tabular-nums">{srv}</span>
                                        <button onClick={() => setSrv(m.meal, srv + 1)} disabled={srv >= 10}
                                          className="w-7 h-7 rounded-lg bg-white/10 border border-white/10 hover:bg-green-500/20 hover:border-green-400/40 hover:text-green-300 text-gray-300 font-black text-sm
                                            flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed active:scale-90">+</button>
                                      </div>
                                      <span className="text-xs bg-yellow-400/15 text-yellow-300 font-black px-3 py-1 rounded-full border border-yellow-400/20 shrink-0">
                                        {scaleKcal(m.kcal, srv)}
                                      </span>
                                    </div>
                                  </div>
                                  {(m.protein_g || m.carbs_g || m.fat_g) && (
                                    <div className="flex flex-wrap gap-1.5">
                                      <span className="text-[11px] bg-red-500/10 text-red-300 font-bold px-2 py-0.5 rounded-full">P {scaleMacro(m.protein_g, srv)}g</span>
                                      <span className="text-[11px] bg-sky-500/10 text-sky-300 font-bold px-2 py-0.5 rounded-full">C {scaleMacro(m.carbs_g, srv)}g</span>
                                      <span className="text-[11px] bg-orange-500/10 text-orange-300 font-bold px-2 py-0.5 rounded-full">F {scaleMacro(m.fat_g, srv)}g</span>
                                    </div>
                                  )}
                                  <div className="border-t border-white/10 pt-3 space-y-1.5">
                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">{t('meals.ingredients')}</p>
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
                                        placeholder={t('meals.add_ingredient')}
                                        className="flex-1 bg-black/30 border border-white/15 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder:text-gray-500 focus:outline-none focus:border-yellow-300/50"
                                      />
                                      <button
                                        onClick={() => {
                                          const val = (newIngInputs[m.meal] ?? '').trim();
                                          if (!val) return;
                                          setEditedIngredients((prev) => ({ ...prev, [m.meal]: [...getMealIngredients(m), val] }));
                                          setNewIngInputs((p) => ({ ...p, [m.meal]: '' }));
                                        }}
                                        className="px-3 py-1 bg-yellow-400/15 border border-yellow-400/30 text-yellow-300 rounded-lg text-[11px] hover:bg-yellow-400/25 transition-all font-black"
                                      >+</button>
                                    </div>
                                  </div>
                                  {m.steps && m.steps.length > 0 && <MealSteps steps={m.steps} />}
                                  {token && (
                                    <div className="flex flex-wrap gap-2 pt-1">
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
                                              ingredients: [],
                                            });
                                            setSavedMeals(prev => ({ ...prev, [m.meal]: true }));
                                          } catch { /* ignore */ }
                                        }}
                                        className="flex-1 py-1 rounded-xl font-black uppercase tracking-wide transition-all duration-200 active:scale-95"
                                        style={savedMeals[m.meal]
                                          ? { fontSize: '0.6rem', background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', boxShadow: 'none', cursor: 'default' }
                                          : { fontSize: '0.6rem', background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 10px rgba(250,204,21,0.25), 0 0 24px rgba(250,204,21,0.08)' }
                                        }
                                      >
                                        {savedMeals[m.meal] ? '✓ Saved' : t('meals.save_meal')}
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
                                        className="px-2.5 py-1 rounded-lg font-black transition-all duration-200 active:scale-95 flex items-center gap-1 shrink-0 text-[10px] uppercase tracking-wide"
                                        style={savedAsRecipes[m.meal]
                                          ? { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', boxShadow: 'none', cursor: 'default' }
                                          : { background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 10px rgba(250,204,21,0.35), 0 0 24px rgba(250,204,21,0.15)' }
                                        }
                                        title="Save to My Recipes"
                                      >
                                        {savedAsRecipes[m.meal] ? '✓ Saved' : '📋 Recipe'}
                                      </button>
                                      <button
                                        onClick={() => {
                                          logMealToday(m, getSrv(m.meal));
                                          setLoggedMeals(prev => ({ ...prev, [m.meal]: true }));
                                        }}
                                        className="px-2 py-0.5 rounded-lg font-black uppercase tracking-wide transition-all duration-200 active:scale-95 shrink-0"
                                        style={{
                                          fontSize: '0.6rem',
                                          ...(loggedMeals[m.meal]
                                            ? { background: 'rgba(20,184,166,0.12)', color: '#2dd4bf', border: '1px solid rgba(20,184,166,0.3)', boxShadow: 'none', cursor: 'default' }
                                            : { background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 10px rgba(250,204,21,0.25), 0 0 24px rgba(250,204,21,0.08)' })
                                        }}
                                        title="Log to today's macro tracker"
                                      >
                                        {loggedMeals[m.meal] ? '✓' : 'Log'}
                                      </button>
                                    </div>
                                  )}
                                </motion.div>
                              );
                            })()}
                          </motion.div>
                        </AnimatePresence>
                      </>
                    )}

                    {!aiMealLoading && !aiMealPlan && !aiMealError && (
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-12 flex flex-col items-center gap-4 text-center">
                        <span className="text-5xl">🥗</span>
                        <p className="text-[--color-iron-gold] font-black uppercase">{t('meals.no_plan')}</p>
                        <p className="text-gray-400 text-sm">{t('meals.no_plan_desc')}</p>
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
                  <motion.div key="ingredients" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }} className="space-y-3 md:space-y-6">
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-6 space-y-3 md:space-y-4">
                      <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">{t('meals.ingredient_prefs')}</p>
                      <p className="text-gray-400 text-xs">{t('meals.ingredient_prefs_desc')}</p>

                      {/* Preferred */}
                      <div className="space-y-2">
                        <p className="text-xs font-black uppercase text-green-400 tracking-wide">{t('meals.preferred')}</p>
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
                        <p className="text-xs font-black uppercase text-red-400 tracking-wide">{t('meals.disliked')}</p>
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
                          placeholder={t('meals.prefs_placeholder')}
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
                        >{t('meals.like_btn')}</button>
                        <button
                          onClick={() => {
                            const val = prefIngNew.trim();
                            if (!val) return;
                            setProfile((p) => ({ ...p, preferredIngredients: [...(p.preferredIngredients ?? []).filter((x) => x !== val && x !== `!${val}`), `!${val}`] }));
                            setPrefIngNew('');
                          }}
                          className="px-4 py-2 bg-red-500/20 border border-red-400/30 text-red-300 font-black rounded-xl text-xs hover:bg-red-500/30 transition-all"
                        >{t('meals.dislike_btn')}</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── WORKOUTS ── */}
          {active === 'workouts' && (
            <motion.div key="workouts" {...fadeUp(0)} className="space-y-3 md:space-y-6">
              {/* Sub-tabs */}
              <div className="flex border-b border-white/10">
                {([
                  { id: 'ai', key: 'workouts.ai_tab' },
                  { id: 'my', key: 'workouts.my_tab' },
                  { id: 'library', key: 'workouts.library_tab' },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setWorkoutTab(tab.id)}
                    style={{ fontSize: '0.75rem' }}
                    className={`flex-1 py-1.5 sm:py-2.5 text-xs font-black uppercase tracking-wide transition-all duration-200 border-b-2 -mb-px ${
                      workoutTab === tab.id
                        ? 'border-[--color-iron-gold] text-[--color-iron-gold]'
                        : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-white/20'
                    }`}
                  >
                    {tab.id === 'ai'
                      ? <><span style={{ filter: 'sepia(1) saturate(4) hue-rotate(5deg) brightness(1.1)' }}>🤖</span> {t(tab.key)}</>
                      : tab.id === 'my'
                        ? <><span style={{ color: '#facc15' }}>✎</span> {t(tab.key)}</>
                        : tab.id === 'library'
                          ? <><span style={{ filter: 'sepia(1) saturate(4) hue-rotate(5deg) brightness(1.1)' }}>📚</span> {t(tab.key)}</>
                          : t(tab.key)
                    }
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {workoutTab === 'ai' && (
                  <motion.div key="ai" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="space-y-4">
                    <WorkoutPlanView
                      profile={profile}
                      token={token ?? undefined}
                      onStartSession={() => startWorkout('AI Workout Plan', 'ai')}
                      onFinishSession={finishWorkout}
                    />
                  </motion.div>
                )}
                {workoutTab === 'my' && (
                  <motion.div key="my" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                    <MyWorkouts token={token!} onStartWorkout={activeSession ? undefined : startWorkout} />
                  </motion.div>
                )}
                {workoutTab === 'library' && (
                  <motion.div key="library" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                    <ExerciseLibrary token={token!} language={profile.language ?? 'en'} />
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
            <motion.div key="progress" {...fadeUp(0)} className="space-y-3 md:space-y-6">
              <SectionHeader title={t('progress.title')} sub={t('progress.subtitle')} />
              <ProgressTab
                token={token!}
                sessions={sessions}
                currentWeight={profile.weight ?? null}
              />
            </motion.div>
          )}

          {/* ── SETTINGS ── */}
          {active === 'settings' && (
            <motion.div key="settings" {...fadeUp(0)} className="space-y-3 md:space-y-6">
              <SectionHeader title={t('settings.title')} sub={t('settings.sub')} />

              <div className="flex flex-col lg:flex-row gap-6">
                {/* ── Settings sidebar nav ── */}
                <div className="flex lg:flex-col gap-2 flex-wrap lg:w-52 shrink-0">
                  {([
                    { id: 'account',        icon: '👤', label: t('settings.tabs.account'),  desc: t('settings.tabs.account_desc') },
                    { id: 'password',       icon: '🔑', label: t('settings.tabs.password'), desc: t('settings.tabs.password_desc') },
                    { id: 'legal',          icon: '📜', label: t('settings.tabs.legal'),    desc: t('settings.tabs.legal_desc') },
                    { id: 'languages',      icon: '🌍', label: t('settings.tabs.languages'),desc: t('settings.tabs.languages_desc') },
                    { id: 'delete_account', icon: '⚠️', label: t('settings.tabs.danger'),   desc: t('settings.tabs.danger_desc') },
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
                    {/* Mobile avatar — hidden on md+ where sidebar already shows it */}
                    <div className="md:hidden flex flex-col items-center mb-4">
                      <button
                        onClick={handleAvatarClick}
                        disabled={avatarUploading}
                        className="relative w-20 h-20 rounded-2xl border-2 border-yellow-300 overflow-hidden focus:outline-none shadow-[0_0_20px_rgba(250,204,21,0.2)]"
                        title={profile.profilePicture && !avatarError ? t('profile.view_photo') : t('profile.upload_photo')}
                      >
                        {profile.profilePicture && !avatarError ? (
                          <img src={profile.profilePicture} alt="avatar" className="absolute inset-0 w-full h-full object-cover" onError={() => setAvatarError(true)} />
                        ) : (
                          <div className="absolute inset-0 bg-yellow-300/20 flex items-center justify-center text-3xl">
                            🦾
                          </div>
                        )}
                        <div className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 transition-opacity duration-200 ${profile.profilePicture && !avatarError && !avatarUploading ? 'opacity-0 active:opacity-100' : 'opacity-100'}`}>
                          {avatarUploading ? (
                            <span className="text-white text-xs font-bold">{t('common.uploading')}</span>
                          ) : (
                            <>
                              <span className="text-base">📷</span>
                              <span className="text-white text-[10px] font-bold uppercase tracking-wide">
                                {profile.profilePicture && !avatarError ? t('common.view') : t('common.upload')}
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                      <p className="mt-2 font-black text-[--color-iron-gold] uppercase text-xs tracking-widest text-center">
                        {profile.name || t('common.athlete')}
                      </p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-6 space-y-3 md:space-y-5">
                      {/* Header row */}
                      <div className="flex items-center justify-between">
                        <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">{t('profile.details')}</p>
                        {!editingAccount ? (
                          <button
                            onClick={openAccountEdit}
                            className="px-4 py-1.5 bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 font-bold rounded-xl uppercase text-xs transition-all"
                          >
                            <span style={{ color: '#facc15' }}>✎</span> {t('common.edit')}
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingAccount(false)}
                              className="px-4 py-1.5 bg-white/5 border border-white/10 text-gray-400 hover:text-white font-bold rounded-xl uppercase text-xs transition-all"
                            >
                              {t('common.cancel')}
                            </button>
                            <button
                              onClick={saveAccount}
                              className="px-4 py-1.5 font-black rounded-xl uppercase text-xs active:scale-95 transition-all"
                              style={{ background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 10px rgba(250,204,21,0.35), 0 0 24px rgba(250,204,21,0.15)' }}
                            >
                              {t('common.save')}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Email — always read-only */}
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-xs text-gray-500 uppercase font-bold">{t('profile.email')}</span>
                        <span className="text-sm text-gray-400 font-semibold truncate max-w-[60%] text-right">{profile.email || '—'}</span>
                      </div>

                      {editingAccount ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <AccountField label={t('profile.name')} value={accountDraft.name} onChange={(v) => setAccountDraft((d) => ({ ...d, name: v }))} placeholder={t('profile.name')} />
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-500 uppercase font-bold">{t('profile.goal')}</label>
                            <select
                              value={accountDraft.fitnessGoals}
                              onChange={(e) => setAccountDraft((d) => ({ ...d, fitnessGoals: e.target.value }))}
                              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all [&>option]:bg-gray-900"
                            >
                              <option value="">{t('common.select')}</option>
                              <option value="Weight Loss">{t('goals.weight_loss')}</option>
                              <option value="Muscle Gain">{t('goals.muscle_gain')}</option>
                              <option value="Endurance">{t('goals.endurance')}</option>
                              <option value="General Fitness">{t('goals.general_fitness')}</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-500 uppercase font-bold">{t('profile.level')}</label>
                            <select
                              value={accountDraft.experienceLevel}
                              onChange={(e) => setAccountDraft((d) => ({ ...d, experienceLevel: e.target.value }))}
                              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all [&>option]:bg-gray-900"
                            >
                              <option value="">{t('common.select')}</option>
                              <option value="Beginner">{t('level.beginner')}</option>
                              <option value="Intermediate">{t('level.intermediate')}</option>
                              <option value="Advanced">{t('level.advanced')}</option>
                              <option value="Unsure">{t('level.unsure')}</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-500 uppercase font-bold">{t('profile.gender')}</label>
                            <select
                              value={accountDraft.gender}
                              onChange={(e) => setAccountDraft((d) => ({ ...d, gender: e.target.value }))}
                              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all [&>option]:bg-gray-900"
                            >
                              <option value="">{t('common.select')}</option>
                              <option value="Male">{t('gender.male')}</option>
                              <option value="Female">{t('gender.female')}</option>
                              <option value="Other">{t('gender.other')}</option>
                              <option value="Prefer not to say">{t('gender.prefer_not')}</option>
                            </select>
                          </div>
                          <AccountField label={t('profile.height_cm')} value={accountDraft.height} onChange={(v) => setAccountDraft((d) => ({ ...d, height: v }))} placeholder={t('profile.height_placeholder')} type="number" />
                          <AccountField label={t('profile.weight_kg')} value={accountDraft.weight} onChange={(v) => setAccountDraft((d) => ({ ...d, weight: v }))} placeholder={t('profile.weight_placeholder')} type="number" />
                          <AccountField label={t('profile.dob')} value={accountDraft.birthdate} onChange={(v) => setAccountDraft((d) => ({ ...d, birthdate: v }))} type="date" />
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-500 uppercase font-bold">{t('profile.equipment')}</label>
                            <select
                              value={accountDraft.equipments}
                              onChange={(e) => setAccountDraft((d) => ({ ...d, equipments: e.target.value }))}
                              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all [&>option]:bg-gray-900"
                            >
                              <option value="">{t('common.select')}</option>
                              <option value="No Equipment">{t('equipment.none')}</option>
                              <option value="Dumbbells">{t('equipment.dumbbells')}</option>
                              <option value="Barbell & Rack">{t('equipment.barbell')}</option>
                              <option value="Full Gym">{t('equipment.full_gym')}</option>
                              <option value="Resistance Bands">{t('equipment.bands')}</option>
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {[
                            { label: t('profile.name'), value: profile.name || '—' },
                            { label: t('profile.goal'), value: profile.fitnessGoals || '—' },
                            { label: t('profile.level'), value: profile.experienceLevel || '—' },
                            { label: t('profile.gender'), value: profile.gender || '—' },
                            { label: t('sidebar.height'), value: profile.height ? `${profile.height} cm` : '—' },
                            { label: t('sidebar.weight'), value: profile.weight ? `${profile.weight} kg` : '—' },
                            { label: t('profile.dob'), value: profile.birthdate || '—' },
                            { label: t('profile.equipment'), value: profile.equipments || '—' },
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
                          <p className="text-sm font-black text-white uppercase tracking-wide">{t('profile.community_visible')}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {profile.communityVisible
                              ? t('profile.visible_desc')
                              : t('profile.hidden_desc')}
                          </p>
                        </div>
                      </div>
                      <button
                        disabled={visibilityLoading}
                        onClick={async () => {
                          const next = !profile.communityVisible;
                          setProfile((p) => ({ ...p, communityVisible: next }));
                          setVisibilityLoading(true);
                          try {
                            const { email: _e, password: _p, onboarded: _o, ...profileData } = { ...profile, communityVisible: next };
                            await apiSaveProfile(token!, profileData as Record<string, unknown>);
                          } catch { /* revert on failure */
                            setProfile((p) => ({ ...p, communityVisible: !next }));
                          } finally {
                            setVisibilityLoading(false);
                          }
                        }}
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
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-6 space-y-3 md:space-y-4 max-w-sm">
                      {pwSuccess ? (
                        <motion.p
                          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                          className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3"
                        >
                          {t('password.success')}
                        </motion.p>
                      ) : (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            setPwError('');
                            if (pwNew.length < 8) { setPwError(t('password.error_length')); return; }
                            if (pwNew !== pwConfirm) { setPwError(t('password.error_match')); return; }
                            setPwSaving(true);
                            try {
                              await apiChangePassword(token!, pwCurrent, pwNew);
                              setPwSuccess(true);
                              setPwCurrent(''); setPwNew(''); setPwConfirm('');
                              setTimeout(() => setPwSuccess(false), 4000);
                            } catch (err: unknown) {
                              setPwError(err instanceof Error ? err.message : t('password.error_failed'));
                            } finally {
                              setPwSaving(false);
                            }
                          }}
                          className="space-y-3"
                        >
                          <PwField label={t('password.current')} value={pwCurrent} onChange={setPwCurrent} />
                          <PwField label={t('password.new')} value={pwNew} onChange={setPwNew} placeholder={t('password.new_placeholder')} />
                          <PwField label={t('password.confirm')} value={pwConfirm} onChange={setPwConfirm} placeholder={t('password.confirm_placeholder')} />
                          {pwError && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2">{pwError}</p>}
                          <button
                            type="submit"
                            disabled={pwSaving}
                            className="w-full py-2 sm:py-2.5 bg-yellow-300 text-black font-black rounded-xl uppercase text-xs sm:text-sm
                              hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 mt-1"
                          >
                            {pwSaving ? t('common.saving') : t('password.update')}
                          </button>
                        </form>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Legal tab */}
                {settingsTab === 'legal' && (
                  <motion.div key="legal" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-6 space-y-3 md:space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">{t('legal.title')}</p>
                        {profile.disclaimerAcceptedAt ? (
                          <span className="text-xs bg-green-400/10 text-green-400 border border-green-400/20 font-bold px-3 py-1 rounded-full">
                            {t('legal.agreed')}
                          </span>
                        ) : (
                          <span className="text-xs bg-red-400/10 text-red-400 border border-red-400/20 font-bold px-3 py-1 rounded-full">
                            {t('legal.not_signed')}
                          </span>
                        )}
                      </div>
                      {profile.disclaimerAcceptedAt && (
                        <p className="text-xs text-gray-500">
                          {t('legal.accepted_on')}{' '}
                          <span className="text-gray-300 font-semibold">
                            {new Date(profile.disclaimerAcceptedAt).toLocaleString()}
                          </span>
                        </p>
                      )}
                      <div className="text-xs text-gray-500 leading-relaxed space-y-3 border-t border-white/10 pt-4">
                        <p>
                          {t('legal.intro')}{' '}
                          <span className="text-gray-300 font-semibold">{t('legal.informational')}</span>{t('legal.intro2')}{' '}
                          <span className="text-gray-300 font-semibold">{t('legal.not_substitute')}</span>
                          {t('legal.intro3')}
                        </p>
                        <ul className="space-y-1.5 list-none">
                          {[0, 1, 2, 3].map((i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-[--color-iron-gold] shrink-0">▸</span>
                              <span>{t(`legal.item_${i}`)}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="border-t border-white/10 pt-3">
                          {t('legal.outro')}{' '}
                          <span className="text-gray-300">{t('legal.no_liability')}</span>{' '}
                          {t('legal.outro2')}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Language tab */}
                {settingsTab === 'languages' && (
                  <motion.div key="languages" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="space-y-4">
                    {/* App Language */}
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-6 space-y-3 md:space-y-5">
                      <div>
                        <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">{t('language.app_language')}</p>
                        <p className="text-gray-400 text-xs mt-1">{t('language.app_language_desc')}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(SUPPORTED_LANGUAGES as readonly SupportedLanguage[]).map((code) => {
                          const isActive = (profile.language || 'en') === code;
                          const flag = t(`language.flags.${code}`);
                          const name = t(`language.languages.${code}`);
                          return (
                            <button
                              key={code}
                              onClick={() => {
                                setProfile((p) => ({ ...p, language: code }));
                                i18n.changeLanguage(code);
                              }}
                              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all duration-200 ${
                                isActive
                                  ? 'bg-yellow-300/15 border-yellow-300/50 text-yellow-300 shadow-[0_0_16px_rgba(253,224,71,0.15)]'
                                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 hover:text-white'
                              }`}
                            >
                              <span className="text-2xl shrink-0">{flag}</span>
                              <div className="min-w-0">
                                <p className="font-black uppercase text-xs tracking-wide leading-none">{name}</p>
                                <p className="text-[10px] uppercase opacity-50 mt-0.5 font-bold">{code.toUpperCase()}</p>
                              </div>
                              {isActive && (
                                <span className="ml-auto text-yellow-300 text-sm shrink-0">✓</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* AI Coach Language */}
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-6 space-y-3">
                      <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">🦾 {t('language.coach_language')}</p>
                      <p className="text-gray-400 text-xs">{t('language.coach_language_desc')}</p>
                      <div className="flex items-center gap-3 bg-yellow-300/5 border border-yellow-300/20 rounded-xl px-4 py-3">
                        <span className="text-2xl">{t(`language.flags.${profile.language || 'en'}`)}</span>
                        <div>
                          <p className="text-white font-black text-sm">{t(`language.languages.${profile.language || 'en'}`)}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{t('language.coach_language_note')}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Danger Zone tab */}
                {settingsTab === 'delete_account' && (
                  <motion.div key="danger" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                    <div className="bg-red-900/10 backdrop-blur-md border border-red-500/20 rounded-2xl p-4 md:p-6 space-y-3 md:space-y-6">
                      <p className="text-red-400 font-black uppercase text-sm tracking-widest">{t('danger.title')}</p>

                      {/* Deactivate */}
                      <div className="space-y-2">
                        <p className="text-white font-bold text-sm">{t('danger.deactivate')}</p>
                        <p className="text-gray-400 text-xs">{t('danger.deactivate_desc')}</p>
                        {dangerAction !== 'deactivate' ? (
                          <button onClick={() => { setDangerAction('deactivate'); setDangerError(''); setDangerPassword(''); }}
                            className="px-3 py-1.5 sm:px-5 sm:py-2 bg-orange-500/20 border border-orange-400/30 text-orange-300 font-black rounded-xl uppercase text-xs hover:bg-orange-500/30 transition-all">
                            {t('danger.deactivate_btn')}
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <PwField label={t('danger.password_label')} value={dangerPassword} onChange={setDangerPassword} placeholder={t('danger.password_placeholder')} />
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
                              }} className="px-3 py-1.5 sm:px-5 sm:py-2 bg-orange-500 text-black font-black rounded-xl uppercase text-xs hover:bg-orange-400 active:scale-95 transition-all disabled:opacity-50">
                                {dangerLoading ? t('common.processing') : t('danger.confirm_deactivate')}
                              </button>
                              <button onClick={() => setDangerAction(null)} className="px-3 py-1.5 sm:px-5 sm:py-2 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl uppercase text-xs hover:text-white transition-all">{t('danger.cancel')}</button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-red-500/20" />

                      {/* Delete */}
                      <div className="space-y-2">
                        <p className="text-white font-bold text-sm">{t('danger.delete')}</p>
                        <p className="text-gray-400 text-xs">{t('danger.delete_desc')}</p>
                        {dangerAction !== 'delete' ? (
                          <button onClick={() => { setDangerAction('delete'); setDangerError(''); setDangerPassword(''); }}
                            className="px-3 py-1.5 sm:px-5 sm:py-2 bg-red-500/20 border border-red-400/30 text-red-300 font-black rounded-xl uppercase text-xs hover:bg-red-500/30 transition-all">
                            {t('danger.delete_btn')}
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <PwField label={t('danger.password_label')} value={dangerPassword} onChange={setDangerPassword} placeholder={t('danger.password_placeholder')} />
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
                              }} className="px-3 py-1.5 sm:px-5 sm:py-2 bg-red-600 text-white font-black rounded-xl uppercase text-xs hover:bg-red-500 active:scale-95 transition-all disabled:opacity-50">
                                {dangerLoading ? t('common.processing') : t('danger.confirm_delete')}
                              </button>
                              <button onClick={() => setDangerAction(null)} className="px-3 py-1.5 sm:px-5 sm:py-2 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl uppercase text-xs hover:text-white transition-all">{t('danger.cancel')}</button>
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

      {/* ── Finish workout notes prompt ────────────────────── */}
      <AnimatePresence>
        {showNotesPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="card-gold max-w-sm w-full"
            >
              <div className="bg-[#0d0d10] p-6 rounded-[calc(1.25rem-1px)] space-y-4">
                <div>
                  <p className="text-[--color-iron-gold] text-[10px] font-black tracking-[0.3em] uppercase">Workout Complete 🎉</p>
                  <h3 className="text-lg font-black uppercase italic mt-0.5">How did it go?</h3>
                </div>
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Optional notes — e.g. felt strong, increased bench to 80kg…"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm
                    focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600 resize-none"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => finishWorkout()}
                    className="flex-1 py-2 sm:py-3 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl uppercase text-xs hover:text-white transition-all"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => finishWorkout(notesInput.trim() || undefined)}
                    className="flex-1 py-2 sm:py-3 font-black rounded-xl uppercase text-xs active:scale-95 transition-all"
                    style={{ background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 10px rgba(250,204,21,0.35), 0 0 24px rgba(250,204,21,0.15)' }}
                  >
                    Save & Finish ✓
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Profile photo lightbox ────────────────────────── */}
      <AnimatePresence>
        {viewingAvatar && profile.profilePicture && !avatarError && (
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
                {profile.name || t('common.athlete')}
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => { setViewingAvatar(false); avatarInputRef.current?.click(); }}
                  className="flex-1 py-2 sm:py-2.5 bg-yellow-300 text-black font-black rounded-xl uppercase text-xs
                    hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all duration-200"
                >
                  📷 {t('profile.upload_photo')}
                </button>
                <button
                  onClick={() => setViewingAvatar(false)}
                  className="flex-1 py-1.5 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl uppercase text-xs
                    hover:text-white transition-all"
                >
                  {t('common.close')}
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
      <h1 className="text-xl md:text-3xl font-black uppercase italic mt-1">{title}</h1>
    </div>
  );
}

function GoalDonut({ goalData, goal, large }: { goalData: { key: string; value: number; color: string }[]; goal: string; large?: boolean }) {
  const { t } = useTranslation();
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
          <span key={d.key} className="flex items-center gap-1.5 text-xs text-gray-300 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: d.color }} />
            {t(d.key)}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {goal ? t(`goals.${goal.toLowerCase().replace(/ /g, '_')}`) : t('goals.no_goal')}
      </p>
    </motion.div>
  );
}

function MealSteps({ steps }: { steps: string[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-white/10 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-yellow-300 transition-colors"
      >
        {t('meals.how_to_prepare')}
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
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col gap-4
        hover:border-yellow-300/30 hover:shadow-[0_0_20px_rgba(253,224,71,0.12)] transition-all duration-300"
    >
      <button onClick={onNavigate} className="flex items-center justify-between group text-left">
        <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">{t('meals.ai_tab')}</p>
        <span className="text-gray-600 group-hover:text-yellow-300 text-xs font-bold uppercase tracking-wide transition-colors">
          {t('meals.view_all')}
        </span>
      </button>
      {meals === null ? (
        <button
          onClick={onNavigate}
          className="flex flex-col items-center gap-2 py-6 text-center bg-white/5 border border-white/10 rounded-xl
            hover:border-yellow-300/30 hover:bg-yellow-300/5 transition-all duration-150"
        >
          <span className="text-3xl">🥗</span>
          <p className="text-gray-400 text-xs">{t('meals.tap_to_generate')}</p>
        </button>
      ) : (
        <>
          {[
            { label: `☀️ ${t('meals.breakfast')}`, meal: meals[0] },
            { label: `🌤️ ${t('meals.lunch')}`,     meal: meals[1] },
            { label: `🌙 ${t('meals.dinner')}`,    meal: meals[2] },
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

