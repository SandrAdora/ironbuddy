import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiWorkout, apiGetYouTubeVideo, type WorkoutPlan, type WorkoutExercise, type CustomWorkout } from '../api';
import type { UserProfile } from '../context/userContext';
import { useTheme } from '../context/themeContext';
import { useTranslation } from 'react-i18next';
import { savePR } from '../prStorage';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faArrowsRotate, faDumbbell, faCalendarDays, faBullseye, faLightbulb, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';

interface Props {
  profile: UserProfile;
  token?: string;
  onStartSession?: () => void;
  onFinishSession?: () => void;
}

// ── localStorage helpers (mirrors MyWorkouts.tsx) ─────────────────────────────
function getUserId(token: string): number {
  try { return JSON.parse(atob(token.split('.')[1])).user_id ?? 0; } catch { return 0; }
}
function loadWorkouts(token: string): CustomWorkout[] {
  try {
    const raw = localStorage.getItem(`ironbuddy_workouts_${getUserId(token)}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function persistWorkouts(token: string, workouts: CustomWorkout[]) {
  localStorage.setItem(`ironbuddy_workouts_${getUserId(token)}`, JSON.stringify(workouts));
}

function playAlarm() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    for (let i = 0; i < 12; i++) {
      const delay = i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = i % 2 === 0 ? 1400 : 1050;
      gain.gain.setValueAtTime(0.55, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.18);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.18);
    }
  } catch { /* silent fail */ }
}

function parseRestSecs(rest: string): number {
  const min = rest.match(/(\d+)\s*min/i);
  const sec = rest.match(/(\d+)\s*s/i);
  if (min) return Math.min(180, Number(min[1]) * 60);
  if (sec) return Math.min(180, Number(sec[1]));
  return 60;
}

export default function WorkoutPlanView({ profile, token, onStartSession, onFinishSession }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeDay, setActiveDay] = useState(0);
  const [imported, setImported]         = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [numDays, setNumDays] = useState(4);

  // YouTube video cache — key: exercise name (lowercase)
  const [videoMap, setVideoMap] = useState<Record<string, string | null>>({});

  async function fetchVideo(name: string) {
    if (!token) return;
    const key = name.toLowerCase();
    if (key in videoMap) return;
    setVideoMap(prev => ({ ...prev, [key]: null }));
    const id = await apiGetYouTubeVideo(token, name).catch(() => '');
    setVideoMap(prev => ({ ...prev, [key]: id }));
  }

  async function retryVideo(name: string) {
    if (!token) return;
    const key = name.toLowerCase();
    setVideoMap(prev => ({ ...prev, [key]: null }));
    const id = await apiGetYouTubeVideo(token, name).catch(() => '');
    setVideoMap(prev => ({ ...prev, [key]: id }));
  }

  // Workout active state
  const [timerActive, setTimerActive] = useState(false);
  const [workoutPaused, setWorkoutPaused] = useState(false);

  // Set tracking — key: `${activeDay}_${exIdx}`
  const [completedSets, setCompletedSets] = useState<Record<string, boolean[]>>({});
  const [extraSets, setExtraSets] = useState<Record<string, number>>({});
  const [setLogs, setSetLogs] = useState<Record<string, { weight: string; reps: string }>>({});

  // Rest timer
  const [restActive, setRestActive] = useState(false);
  const [restLeft, setRestLeft] = useState(0);
  const restRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restWasActive = useRef(false);
  const alarmWasActive = useRef(false);

  // Alarm
  const [alarmMins, setAlarmMins] = useState(0);
  const [alarmSecInput, setAlarmSecInput] = useState(0);
  const [alarmActive, setAlarmActive] = useState(false);
  const [alarmLeft, setAlarmLeft] = useState(0);
  const alarmRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alarmTotal = alarmMins * 60 + alarmSecInput;

  const dayExercises = plan ? plan.days[activeDay].exercises : [];

  // Alarm countdown
  useEffect(() => {
    if (!alarmActive || workoutPaused) return;
    if (alarmLeft > 0) {
      alarmRef.current = setTimeout(() => setAlarmLeft(t => t - 1), 1000);
      return () => { if (alarmRef.current) clearTimeout(alarmRef.current); };
    }
    playAlarm();
    setAlarmActive(false);
    setAlarmLeft(alarmTotal);
  }, [alarmActive, alarmLeft, alarmTotal, workoutPaused]);

  // Rest timer countdown
  useEffect(() => {
    if (!restActive || workoutPaused) return;
    if (restLeft > 0) {
      restRef.current = setTimeout(() => setRestLeft(t => t - 1), 1000);
      return () => { if (restRef.current) clearTimeout(restRef.current); };
    }
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    } catch { /* silent */ }
    setRestActive(false);
  }, [restActive, restLeft, workoutPaused]);

  function startAlarmFn(overrideSecs?: number) {
    if (alarmRef.current) clearTimeout(alarmRef.current);
    if (overrideSecs !== undefined) {
      if (overrideSecs < 1) return;
      setAlarmMins(Math.floor(overrideSecs / 60));
      setAlarmSecInput(overrideSecs % 60);
      setAlarmLeft(overrideSecs);
    }
    setAlarmActive(true);
  }

  function stopAlarmFn() {
    setAlarmActive(false);
    if (alarmRef.current) clearTimeout(alarmRef.current);
  }

  function tickSet(dayIdx: number, ei: number, si: number, restSecs: number) {
    const key = `${dayIdx}_${ei}`;
    setCompletedSets(prev => {
      const arr = [...(prev[key] ?? [])];
      arr[si] = !arr[si];
      const nowDone = arr[si];
      if (nowDone && restSecs > 0) {
        if (restRef.current) clearTimeout(restRef.current);
        setRestLeft(restSecs);
        setRestActive(true);
      } else if (!nowDone) {
        setRestActive(false);
      }
      return { ...prev, [key]: arr };
    });
  }

  function logSet(dayIdx: number, ei: number, si: number, field: 'weight' | 'reps', val: string) {
    const key = `${dayIdx}_${ei}_${si}`;
    setSetLogs(prev => ({ ...prev, [key]: { ...(prev[key] ?? { weight: '', reps: '' }), [field]: val } }));
  }

  function startWorkout() {
    if (!dayExercises.length) return;
    setTimerActive(true);
    setWorkoutPaused(false);
    restWasActive.current = false;
    alarmWasActive.current = false;
    setCompletedSets({});
    setExtraSets({});
    setSetLogs({});
    setRestActive(false);
    if (restRef.current) clearTimeout(restRef.current);
    onStartSession?.();
  }

  function finishWorkout() {
    setTimerActive(false);
    setWorkoutPaused(false);
    setRestActive(false);
    stopAlarmFn();
    onFinishSession?.();
  }

  const importToMyWorkouts = (planToSave: WorkoutPlan) => {
    if (!token) return;
    const existing = loadWorkouts(token);
    const now = new Date().toISOString();
    const newWorkouts: CustomWorkout[] = planToSave.days.map((day, i) => ({
      id: Date.now() + i,
      name: `${planToSave.plan_name} — ${day.day}`,
      description: day.focus,
      exercises: day.exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest: ex.rest,
        muscle: ex.muscle,
        notes: [ex.tip, ex.how_to].filter(Boolean).join(' | '),
      })),
      created_at: now,
    }));
    persistWorkouts(token, [...newWorkouts, ...existing]);
    setImported(true);
    setTimeout(() => setImported(false), 3000);
  };


  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiWorkout(profile as unknown as Record<string, unknown>, numDays);
      setPlan(result);
      setActiveDay(0);
      if (token) setShowSaveModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Save-to-My-Workouts modal ── */}
      {createPortal(
        <AnimatePresence>
          {showSaveModal && plan && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
                onClick={() => setShowSaveModal(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 20 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[9999] max-w-sm mx-auto
                  bg-[#12121f] border border-yellow-300/30 rounded-3xl p-8 shadow-[0_0_60px_rgba(253,224,71,0.15)]
                  flex flex-col items-center gap-6 text-center"
              >
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
                  className="text-6xl"
                >
                  💪
                </motion.span>
                <div className="space-y-2">
                  <p className="text-[--color-iron-gold] font-black uppercase text-xs tracking-[0.3em]">Plan Ready</p>
                  <h2 className="text-white font-black text-xl uppercase italic">{plan.plan_name}</h2>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Save all <strong className="text-white">{plan.days.length} workout days</strong> to your
                    My Workouts so you can access them anytime, even offline.
                  </p>
                </div>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={() => { importToMyWorkouts(plan); setShowSaveModal(false); }}
                    className="w-full py-3 font-black rounded-xl uppercase text-sm hover:scale-[1.02] active:scale-95 transition-all duration-200"
                    style={{ background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 12px rgba(250,204,21,0.3), 0 0 28px rgba(250,204,21,0.12)' }}
                  >
                    <FontAwesomeIcon icon={faSave} /> Save Workouts
                  </button>
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="w-full py-3 font-bold rounded-xl uppercase text-sm hover:scale-[1.02] active:scale-95 transition-all duration-200"
                    style={{ background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.25)', boxShadow: '0 0 8px rgba(250,204,21,0.15)' }}
                  >
                    Not Now
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">{t('workouts.ai_plan')}</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase italic mt-1">💪 {t('workoutplan.title')}</h1>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wide">{t('workoutplan.days')}:</span>
            <select
              value={numDays}
              onChange={e => setNumDays(Number(e.target.value))}
              className="text-xs font-black rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer"
              style={{
                background: theme === 'light' ? '#ffffff' : '#060608',
                color: theme === 'light' ? '#111111' : '#ffffff',
                border: theme === 'light' ? '1px solid rgba(0,0,0,0.15)' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {[2, 3, 4, 5, 6].map(d => (
                <option key={d} value={d} style={{ background: theme === 'light' ? '#ffffff' : '#060608', color: theme === 'light' ? '#111111' : '#ffffff' }}>{d} {t('workoutplan.days_per_week')}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-row gap-2 items-start">
          {plan && token && (
            <button
              onClick={() => plan && importToMyWorkouts(plan)}
              disabled={imported}
              className="font-black text-xs border-none outline-none bg-transparent transition-colors active:scale-95 disabled:cursor-default flex items-center gap-1"
              style={imported
                ? { color: '#4ade80', textShadow: '0 0 10px rgba(74,222,128,0.7), 0 0 20px rgba(34,211,238,0.4)' }
                : { color: '#4ade80', textShadow: '0 0 10px rgba(74,222,128,0.7), 0 0 20px rgba(34,211,238,0.4)' }
              }
            >
              {imported ? `✓ ${t('workoutplan.saved')}` : <FontAwesomeIcon icon={faSave} /> + ` ${t('workoutplan.save')}`}
            </button>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="font-black text-xs no-underline border-none outline-none bg-transparent transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ color: theme === 'light' ? '#d97706' : '#facc15', textShadow: theme === 'light' ? 'none' : '0 0 10px rgba(250,204,21,0.7), 0 0 20px rgba(250,204,21,0.4)' }}
          >
            {loading ? (
              <>
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⚙️</motion.span>
                {t('workoutplan.generating')}
              </>
            ) : plan ? <><FontAwesomeIcon icon={faArrowsRotate} /> {t('workoutplan.regenerate')}</> : <><FontAwesomeIcon icon={faWandMagicSparkles} /> {t('workoutplan.generate')}</>}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>}

      {/* Empty state */}
      {!plan && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 md:p-16
            flex flex-col items-center justify-center text-center gap-4"
        >
          <span className="text-6xl animate-coach-breathe">🏋️</span>
          <p className="text-[--color-iron-gold] font-black uppercase text-xl">{t('workoutplan.ready_title')}</p>
          <p className="text-gray-400 text-sm max-w-sm">
            {t('workoutplan.ready_desc', { button: t('workoutplan.generate') })}
          </p>
        </motion.div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-5 animate-pulse">
          {/* Stat grid */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-2.5 bg-white/10 rounded w-1/2" />
                <div className="h-4 bg-white/10 rounded w-3/4" />
              </div>
            ))}
          </div>
          {/* Day tabs */}
          <div className="flex gap-2 border-b border-white/10 pb-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-6 w-12 bg-white/10 rounded-lg" />
            ))}
          </div>
          {/* Day header */}
          <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-5 bg-white/10 rounded w-24" />
              <div className="h-3 bg-white/5 rounded w-36" />
            </div>
            <div className="h-7 w-16 bg-white/10 rounded-lg" />
          </div>
          {/* Exercise cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/10 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-white/10 rounded w-2/3" />
                    <div className="h-2.5 bg-white/5 rounded w-1/3" />
                  </div>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="h-8 flex-1 bg-white/5 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan */}
      {plan && !loading && (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* Plan summary */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <PlanStat icon={<FontAwesomeIcon icon={faDumbbell} />} label="Plan" value={plan.plan_name} />
              <PlanStat icon={<FontAwesomeIcon icon={faCalendarDays} />} label="Frequency" value={plan.frequency} />
              <PlanStat icon={<FontAwesomeIcon icon={faBullseye} />}  label="Goal" value={plan.goal} />
            </div>

            {/* Day tabs */}
            <div className="flex border-b border-white/10">
              {plan.days.map((_d, i) => (
                <button
                  key={i}
                  onClick={() => { setActiveDay(i); if (timerActive) finishWorkout(); }}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wide transition-all duration-200 border-none outline-none bg-transparent relative"
                  style={activeDay === i
                    ? { color: '#facc15', textShadow: '0 0 8px rgba(250,204,21,0.6)' }
                    : { color: 'rgba(156,163,175,0.6)' }
                  }
                >
                  Day {i + 1}
                  {activeDay === i && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ background: '#facc15', boxShadow: '0 0 6px rgba(250,204,21,0.8)' }} />
                  )}
                </button>
              ))}
            </div>

            {/* Active day */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeDay}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {/* Day header */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-[--color-iron-gold] uppercase italic">{plan.days[activeDay].day}</h2>
                    <p className="text-gray-400 text-sm mt-0.5">Focus: {plan.days[activeDay].focus}</p>
                  </div>
                  {timerActive ? (
                    <div className="flex items-center gap-1.5">
                      {/* Pause / Resume */}
                      <button
                        onClick={() => {
                          if (workoutPaused) {
                            setWorkoutPaused(false);
                            if (alarmWasActive.current) startAlarmFn();
                            if (restWasActive.current) setRestActive(true);
                          } else {
                            alarmWasActive.current = alarmActive;
                            restWasActive.current = restActive;
                            setWorkoutPaused(true);
                          }
                        }}
                        className="text-[10px] font-black px-2.5 py-1.5 rounded-lg border-none outline-none transition-all active:scale-95"
                        style={{ background: '#060608', color: '#facc15', boxShadow: '0 0 10px rgba(250,204,21,0.45), 0 0 24px rgba(250,204,21,0.2)' }}
                        title={workoutPaused ? 'Resume workout' : 'Pause workout'}
                      >
                        {workoutPaused ? '▶' : '⏸'}
                      </button>
                      {/* Finish */}
                      <button
                        onClick={finishWorkout}
                        className="text-[10px] font-black px-2.5 py-1.5 rounded-lg border-none outline-none transition-all active:scale-95"
                        style={{ background: '#060608', color: '#4ade80', boxShadow: '0 0 10px rgba(74,222,128,0.45), 0 0 24px rgba(74,222,128,0.2)' }}
                        title="Finish workout"
                      >
                        ✓
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={startWorkout}
                      className="shrink-0 font-black text-xs border-none outline-none bg-transparent active:scale-95 transition-colors"
                      style={{ color: '#facc15', textShadow: '0 0 10px rgba(250,204,21,0.7), 0 0 20px rgba(250,204,21,0.4)' }}
                    >
                      ▶ Start
                    </button>
                  )}
                </div>

                {/* Rest timer banner */}
                {timerActive && restActive && (
                  <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-400/30 rounded-xl px-3 py-2">
                    <span className="text-blue-300 text-xs font-black uppercase tracking-widest shrink-0">Rest</span>
                    <button
                      onClick={() => setRestLeft(t => Math.max(0, t - 10))}
                      className="text-[10px] font-black px-2 py-1 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 transition-colors shrink-0"
                    >−10s</button>
                    <span className="text-blue-300 font-black text-xl tabular-nums mx-auto">
                      {String(Math.floor(restLeft / 60)).padStart(2, '0')}:{String(restLeft % 60).padStart(2, '0')}
                    </span>
                    <button
                      onClick={() => setRestLeft(t => t + 10)}
                      className="text-[10px] font-black px-2 py-1 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 transition-colors shrink-0"
                    >+10s</button>
                    <button onClick={() => setRestActive(false)} className="text-xs text-blue-400 hover:text-white font-bold transition-colors shrink-0">Skip</button>
                  </div>
                )}

                {/* Exercise cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plan.days[activeDay].exercises.map((ex, i) => {
                    const key = `${activeDay}_${i}`;
                    const done = completedSets[key] ?? [];
                    const totalSets = ex.sets + (extraSets[key] ?? 0);
                    const doneCount = done.filter(Boolean).length;
                    return (
                      <ExerciseCard
                        key={i}
                        exercise={ex}
                        index={i}
                        videoId={videoMap[ex.name.toLowerCase()]}
                        onFetchVideo={() => fetchVideo(ex.name)}
                        onRetryVideo={() => retryVideo(ex.name)}
                        isActive={timerActive}
                        done={done}
                        totalSets={totalSets}
                        doneCount={doneCount}
                        logs={setLogs}
                        logKey={`${activeDay}_${i}`}
                        workoutKey={`${activeDay}_${i}`}
                        onTickSet={(si) => {
                          tickSet(activeDay, i, si, parseRestSecs(ex.rest));
                          const logEntry = setLogs[`${activeDay}_${i}_${si}`] ?? { weight: '', reps: '' };
                          const isDone = completedSets[`${activeDay}_${i}`]?.[si] ?? false;
                          if (!isDone && logEntry.weight && logEntry.reps) {
                            savePR(getUserId(token ?? ''), ex.name, ex.muscle, parseFloat(logEntry.weight), parseFloat(logEntry.reps));
                          }
                        }}
                        onLogSet={(si, field, val) => logSet(activeDay, i, si, field, val)}
                        onAddSet={() => setExtraSets(prev => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }))}
                        onRemoveSet={() => {
                          const lastIdx = totalSets - 1;
                          setExtraSets(prev => ({ ...prev, [key]: (prev[key] ?? 0) - 1 }));
                          setCompletedSets(prev => {
                            const arr = [...(prev[key] ?? [])];
                            arr.splice(lastIdx, 1);
                            return { ...prev, [key]: arr };
                          });
                          setSetLogs(prev => {
                            const next = { ...prev };
                            delete next[`${activeDay}_${i}_${lastIdx}`];
                            return next;
                          });
                        }}
                      />
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>

          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function PlanStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs text-gray-500 uppercase font-bold">{label}</p>
        <p className="text-white text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  index: number;
  videoId?: string | null;
  onFetchVideo: () => void;
  onRetryVideo: () => void;
  isActive: boolean;
  done: boolean[];
  totalSets: number;
  doneCount: number;
  logs: Record<string, { weight: string; reps: string }>;
  logKey: string;
  workoutKey: string;
  onTickSet: (si: number) => void;
  onLogSet: (si: number, field: 'weight' | 'reps', val: string) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
}

function ExerciseCard({ exercise, index, videoId, onFetchVideo, onRetryVideo, isActive, done, totalSets, doneCount, logs, workoutKey, onTickSet, onLogSet, onAddSet, onRemoveSet }: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="backdrop-blur-md rounded-2xl overflow-hidden transition-all duration-300 bg-white/5 border border-white/10 hover:border-yellow-300/20"
    >
      <div className="p-4 space-y-3">
        {/* Name + muscle + set counter */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-white font-black text-sm uppercase tracking-wide">{exercise.name}</h3>
            <p className="text-[--color-iron-gold] text-xs font-semibold mt-0.5">{exercise.muscle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isActive && (
              <span className="text-xs font-bold tabular-nums" style={{ color: doneCount === totalSets ? '#4ade80' : '#facc15' }}>
                {doneCount}/{totalSets} sets
              </span>
            )}
            <button
              onClick={() => { setExpanded((v) => !v); if (!expanded) onFetchVideo(); }}
              className="text-xs font-bold border-none outline-none bg-transparent transition-colors"
              style={{ color: '#facc15' }}
            >
              {expanded ? 'Hide ▲' : 'How to ▼'}
            </button>
          </div>
        </div>

        {/* Static pills when not active */}
        {!isActive && (
          <div className="flex gap-3">
            <Pill label="Sets" value={String(exercise.sets)} />
            <Pill label="Reps" value={exercise.reps} />
            <Pill label="Rest" value={exercise.rest} />
          </div>
        )}

        {/* Set rows when active */}
        {isActive && (
          <div className="space-y-2">
            {/* Barbell progress */}
            <div className="flex items-center gap-1 px-1 my-1" style={{ height: 24 }}>
              <div className="flex items-center gap-[2px]">
                {Array.from({ length: totalSets }).map((_, pi) => {
                  const plateIdx = totalSets - 1 - pi;
                  const filled = done[plateIdx] ?? false;
                  const allDone = doneCount === totalSets;
                  return (
                    <div key={pi} className="rounded-[2px] transition-all duration-300 shrink-0" style={{
                      width: 6,
                      height: filled ? 22 : 10,
                      background: filled ? (allDone ? '#4ade80' : '#facc15') : 'rgba(255,255,255,0.12)',
                      boxShadow: filled ? `0 0 6px ${allDone ? 'rgba(74,222,128,0.8)' : 'rgba(250,204,21,0.8)'}` : 'none',
                    }} />
                  );
                })}
              </div>
              <div className="flex-1 h-[3px] rounded-full transition-all duration-500" style={{
                background: doneCount > 0 ? (doneCount === totalSets ? '#4ade80' : '#facc15') : 'rgba(255,255,255,0.1)',
                boxShadow: doneCount > 0 ? `0 0 8px ${doneCount === totalSets ? 'rgba(74,222,128,0.6)' : 'rgba(250,204,21,0.6)'}` : 'none',
              }} />
              <div className="flex items-center gap-[2px]">
                {Array.from({ length: totalSets }).map((_, pi) => {
                  const filled = done[pi] ?? false;
                  const allDone = doneCount === totalSets;
                  return (
                    <div key={pi} className="rounded-[2px] transition-all duration-300 shrink-0" style={{
                      width: 6,
                      height: filled ? 22 : 10,
                      background: filled ? (allDone ? '#4ade80' : '#facc15') : 'rgba(255,255,255,0.12)',
                      boxShadow: filled ? `0 0 6px ${allDone ? 'rgba(74,222,128,0.8)' : 'rgba(250,204,21,0.8)'}` : 'none',
                    }} />
                  );
                })}
              </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[20px_1fr_1fr_28px] gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">
              <span>#</span><span>Weight</span><span>Reps</span><span></span>
            </div>

            {/* Set rows */}
            {Array.from({ length: totalSets }).map((_, si) => {
              const log = logs[`${workoutKey}_${si}`] ?? { weight: '', reps: '' };
              const checked = done[si] ?? false;
              return (
                <div key={si} className={`grid grid-cols-[20px_1fr_1fr_28px] gap-2 items-center rounded-lg px-1 py-1 transition-colors ${checked ? 'bg-green-500/10' : 'bg-white/3'}`}>
                  <span className="text-xs font-black text-gray-500">{si + 1}</span>
                  <input
                    type="text" inputMode="decimal" placeholder="kg"
                    value={log.weight}
                    onChange={e => onLogSet(si, 'weight', e.target.value)}
                    className={`bg-black/40 border border-white/10 rounded-lg text-center text-xs font-bold py-1 px-1 focus:outline-none focus:border-yellow-300/40 w-full transition-all ${checked ? 'line-through text-green-400/60' : 'text-white'}`}
                  />
                  <input
                    type="text" inputMode="numeric" placeholder={exercise.reps}
                    value={log.reps}
                    onChange={e => onLogSet(si, 'reps', e.target.value)}
                    className={`bg-black/40 border border-white/10 rounded-lg text-center text-xs font-bold py-1 px-1 focus:outline-none focus:border-yellow-300/40 w-full transition-all ${checked ? 'line-through text-green-400/60' : 'text-white'}`}
                  />
                  <button
                    onClick={() => onTickSet(si)}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-sm text-xs font-black transition-all flex items-center justify-center border-none outline-none"
                    style={checked
                      ? { background: '#060608', color: '#4ade80', boxShadow: '0 0 10px rgba(74,222,128,0.6), 0 0 20px rgba(74,222,128,0.3)', border: '2px solid rgba(74,222,128,0.8)' }
                      : { background: '#060608', color: 'rgba(255,255,255,0.3)', boxShadow: '0 0 8px rgba(250,204,21,0.25)', border: '2px solid rgba(250,204,21,0.4)' }
                    }
                  >
                    {checked ? '✓' : ''}
                  </button>
                </div>
              );
            })}

            {/* Add / Remove set */}
            <div className="flex gap-2">
              <button
                onClick={onAddSet}
                className="flex-1 text-xs font-black border-none outline-none bg-transparent active:scale-95 transition-colors hover:text-yellow-300 group"
                style={{ color: 'rgba(156,163,175,0.6)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.cssText = 'color:#facc15;text-shadow:0 0 10px rgba(250,204,21,0.7)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.cssText = 'color:rgba(156,163,175,0.6)'; }}
              >
                + Add Set
              </button>
              {totalSets > 1 && (
                <button
                  onClick={onRemoveSet}
                  className="flex-1 text-xs font-black border-none outline-none bg-transparent active:scale-95 transition-colors"
                  style={{ color: 'rgba(156,163,175,0.6)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.cssText = 'color:#f87171;text-shadow:0 0 10px rgba(248,113,113,0.7)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.cssText = 'color:rgba(156,163,175,0.6)'; }}
                >
                  − Remove Set
                </button>
              )}
            </div>
          </div>
        )}

        {/* How-to steps + video (collapsible) */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-white/10 pt-3 space-y-3">
                {videoId === null && (
                  <p className="text-gray-500 text-xs">Loading video…</p>
                )}
                {videoId === '' && (
                  <button
                    onClick={onRetryVideo}
                    className="relative w-full rounded-xl overflow-hidden border-none outline-none cursor-pointer group"
                    style={{ paddingTop: '56.25%', background: '#0f0f0f', display: 'block' }}
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                        style={{ background: '#ff0000', boxShadow: '0 0 20px rgba(255,0,0,0.5)' }}>
                        <span className="text-white text-xl ml-1">▶</span>
                      </div>
                      <p className="text-gray-500 text-[10px] uppercase tracking-widest">Tap to load video</p>
                    </div>
                  </button>
                )}
                {videoId && (
                  <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingTop: '56.25%' }}>
                    <iframe
                      className="absolute inset-0 w-full h-full"
                      src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                      title={exercise.name}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                {exercise.how_to && (
                  <>
                    <p className="text-[--color-iron-gold] text-[10px] font-black uppercase tracking-widest">How to perform</p>
                    {exercise.how_to.split(/\d+\.\s+/).filter(Boolean).map((step, i) => (
                      <div key={i} className="flex gap-2 text-xs text-gray-300 leading-relaxed">
                        <span className="text-[--color-iron-gold] font-black shrink-0">{i + 1}.</span>
                        <span>{step.trim()}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tip */}
        {exercise.tip && (
          <p className="text-gray-400 text-xs leading-relaxed border-t border-white/5 pt-2">
            <FontAwesomeIcon icon={faLightbulb} /> {exercise.tip}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <div className="rounded-lg px-2.5 py-1.5 text-center" style={theme === 'light'
      ? { background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.1)' }
      : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p className="text-xs uppercase font-bold" style={{ color: theme === 'light' ? '#999' : '#6b7280' }}>{label}</p>
      <p className="text-xs font-black" style={{ color: theme === 'light' ? '#111' : '#fff' }}>{value}</p>
    </div>
  );
}
