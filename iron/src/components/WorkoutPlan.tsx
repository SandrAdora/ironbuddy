import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiWorkout, apiGetExercises, type WorkoutPlan, type WorkoutExercise, type CustomWorkout } from '../api';
import type { UserProfile } from '../context/userContext';

interface Props {
  profile: UserProfile;
  token?: string;
  onStartSession?: () => void;
  onFinishSession?: () => void;
}

function playBeep(freq = 880, duration = 0.4) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch { /* silent fail */ }
}

function workSeconds(ex: WorkoutExercise): number {
  const nums = ex.reps.match(/\d+/g) ?? ['10'];
  const avg = nums.reduce((a, b) => a + Number(b), 0) / nums.length;
  return Math.max(20, Math.min(45, Math.round(ex.sets * avg * 2)));
}

function restSeconds(ex: WorkoutExercise): number {
  const sec = ex.rest.match(/(\d+)\s*s/i);
  const min = ex.rest.match(/(\d+)\s*min/i);
  if (min) return Math.min(60, Number(min[1]) * 60);
  if (sec) return Math.min(60, Number(sec[1]));
  return 20;
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

export default function WorkoutPlanView({ profile, token, onStartSession, onFinishSession }: Props) {
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeDay, setActiveDay] = useState(0);
  const [imported, setImported]         = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [numDays, setNumDays] = useState(4);
  const [videoMap, setVideoMap] = useState<Record<string, string>>({});

  // Timer
  const [timerActive, setTimerActive] = useState(false);
  const [timerExIdx, setTimerExIdx]   = useState(0);
  const [timeLeft, setTimeLeft]       = useState(0);
  const [phase, setPhase]             = useState<'work' | 'rest'>('work');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const dayExercises = plan ? plan.days[activeDay].exercises : [];

  useEffect(() => {
    if (!timerActive) return;
    if (timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
    // time's up
    if (phase === 'work') {
      playBeep(880);
      setPhase('rest');
      setTimeLeft(restSeconds(dayExercises[timerExIdx]));
    } else {
      const next = timerExIdx + 1;
      if (next >= dayExercises.length) {
        playBeep(660, 0.8);
        setTimerActive(false);
        onFinishSession?.();
      } else {
        playBeep(1100, 0.2);
        setTimerExIdx(next);
        setPhase('work');
        setTimeLeft(workSeconds(dayExercises[next]));
      }
    }
  }, [timerActive, timeLeft, phase, timerExIdx, dayExercises, onFinishSession]);

  function startTimer() {
    if (!dayExercises.length) return;
    setTimerExIdx(0);
    setPhase('work');
    setTimeLeft(workSeconds(dayExercises[0]));
    setTimerActive(true);
    onStartSession?.();
  }

  function stopTimer() {
    setTimerActive(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    onFinishSession?.();
  }

  function skipCurrent() {
    const next = timerExIdx + 1;
    if (next >= dayExercises.length) {
      playBeep(660, 0.8);
      setTimerActive(false);
      onFinishSession?.();
    } else {
      playBeep(1100, 0.2);
      setTimerExIdx(next);
      setPhase('work');
      setTimeLeft(workSeconds(dayExercises[next]));
    }
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

  const fetchVideos = async (p: WorkoutPlan) => {
    if (!token) return;
    try {
      const res = await apiGetExercises(token, { limit: 200 });
      const map: Record<string, string> = {};

      const stopWords = new Set(['a', 'an', 'the', 'with', 'and', 'or', 'of', 'to', 'in', 'v', 'v2']);
      const words = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));

      const aiNames = [...new Set(p.days.flatMap(d => d.exercises.map(e => e.name)))];

      for (const name of aiNames) {
        // 1. exact match
        const exact = res.results.find(ex => ex.name.toLowerCase() === name.toLowerCase());
        if (exact?.youtube_video_id) { map[name.toLowerCase()] = exact.youtube_video_id; continue; }

        // 2. word-overlap fallback
        const aiWords = words(name);
        let best: typeof res.results[0] | null = null;
        let bestScore = 0;
        for (const ex of res.results.filter(e => e.youtube_video_id)) {
          const score = aiWords.filter(w => words(ex.name).includes(w)).length;
          if (score > bestScore) { bestScore = score; best = ex; }
        }
        if (best && bestScore >= 1) map[name.toLowerCase()] = best.youtube_video_id;
      }
      setVideoMap(map);
    } catch { /* ignore */ }
  };

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiWorkout(profile as unknown as Record<string, unknown>, numDays);
      setPlan(result);
      setActiveDay(0);
      fetchVideos(result);
      if (token) setShowSaveModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Save-to-My-Workouts modal (portal so fixed positioning works inside motion parents) ── */}
      {createPortal(
        <AnimatePresence>
          {showSaveModal && plan && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
                onClick={() => setShowSaveModal(false)}
              />

              {/* Modal */}
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
                    📥 Save Workouts
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
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">AI Generated</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase italic mt-1">💪 Workout Plan</h1>
          {/* Days selector */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wide">Days:</span>
            <select
              value={numDays}
              onChange={e => setNumDays(Number(e.target.value))}
              className="bg-white/5 border border-white/10 text-white text-xs font-black rounded-lg px-3 py-1.5 focus:outline-none focus:border-yellow-300/50 cursor-pointer"
              style={{ background: '#060608' }}
            >
              {[2, 3, 4, 5, 6].map(d => (
                <option key={d} value={d} style={{ background: '#060608' }}>{d} days / week</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-row gap-2 items-start">
          {plan && token && (
            <button
              onClick={() => plan && importToMyWorkouts(plan)}
              disabled={imported}
              className="px-4 py-2 font-black rounded-xl uppercase text-xs flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-95"
              style={imported
                ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', boxShadow: 'none', cursor: 'default' }
                : { background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 12px rgba(250,204,21,0.3), 0 0 28px rgba(250,204,21,0.12)' }
              }
            >
              {imported ? '✓ Saved to My Workouts' : '📥 Save to My Workouts'}
            </button>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="w-auto px-4 py-2 bg-black text-yellow-300 font-black rounded-xl uppercase text-xs
              border border-yellow-300/40
              hover:border-yellow-300 hover:scale-[1.02] active:scale-95 transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ boxShadow: '0 0 12px rgba(253,224,71,0.35), 0 0 28px rgba(253,224,71,0.15)' }}
          >
            {loading ? (
              <>
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⚙️</motion.span>
                Generating...
              </>
            ) : plan ? '🔄 Regenerate' : '✨ Generate My Plan'}
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
          <p className="text-[--color-iron-gold] font-black uppercase text-xl">Ready to train?</p>
          <p className="text-gray-400 text-sm max-w-sm">
            Click <strong className="text-white">Generate My Plan</strong> and IRON will build a personalized
            workout program based on your goal, level and equipment.
          </p>
        </motion.div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/3 mb-3" />
              <div className="h-3 bg-white/5 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Plan */}
      {plan && !loading && (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* Plan summary */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <PlanStat icon="📋" label="Plan" value={plan.plan_name} />
              <PlanStat icon="📅" label="Frequency" value={plan.frequency} />
              <PlanStat icon="🎯" label="Goal" value={plan.goal} />
            </div>

            {/* Day tabs */}
            <div className="flex gap-2 flex-wrap">
              {plan.days.map((_d, i) => (
                <button
                  key={i}
                  onClick={() => setActiveDay(i)}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all duration-200"
                  style={activeDay === i
                    ? { background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.65)', boxShadow: '0 0 14px rgba(250,204,21,0.4), 0 0 28px rgba(250,204,21,0.15)' }
                    : { background: '#060608', color: 'rgba(156,163,175,1)', border: '1px solid rgba(250,204,21,0.2)', boxShadow: '0 0 6px rgba(250,204,21,0.1)' }
                  }
                >
                  Day {i + 1}
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
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-[--color-iron-gold] uppercase italic">{plan.days[activeDay].day}</h2>
                    <p className="text-gray-400 text-sm mt-0.5">Focus: {plan.days[activeDay].focus}</p>
                  </div>
                  {!timerActive && (
                    <button
                      onClick={startTimer}
                      className="shrink-0 px-4 py-2 bg-black text-yellow-300 font-black rounded-xl uppercase text-xs border border-yellow-300/40 hover:border-yellow-300 hover:scale-105 active:scale-95 transition-all duration-200"
                      style={{ boxShadow: '0 0 12px rgba(253,224,71,0.35), 0 0 28px rgba(253,224,71,0.15)' }}
                    >
                      ▶ Start
                    </button>
                  )}
                </div>

                {/* Timer bar */}
                <AnimatePresence>
                  {timerActive && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="bg-black border border-yellow-300/30 rounded-2xl px-5 py-4 flex items-center gap-4"
                      style={{ boxShadow: '0 0 20px rgba(253,224,71,0.2)' }}
                    >
                      {/* Phase badge */}
                      <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                        phase === 'work' ? 'bg-yellow-300/20 text-yellow-300' : 'bg-blue-400/20 text-blue-300'
                      }`}>
                        {phase === 'work' ? 'Work' : 'Rest'}
                      </span>

                      {/* Exercise name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-black text-sm truncate">{dayExercises[timerExIdx]?.name}</p>
                        <p className="text-gray-500 text-xs">{timerExIdx + 1} / {dayExercises.length}</p>
                      </div>

                      {/* Countdown */}
                      <span className="shrink-0 text-yellow-300 font-black text-2xl tabular-nums" style={{ textShadow: '0 0 12px rgba(253,224,71,0.6)' }}>
                        {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                      </span>

                      {/* Controls */}
                      <button onClick={skipCurrent} className="shrink-0 text-sm font-bold px-2 py-1 rounded-lg transition-all duration-200" style={{ background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.3)', boxShadow: '0 0 8px rgba(250,204,21,0.2)' }}>⏭</button>
                      <button onClick={stopTimer}   className="shrink-0 text-sm font-bold px-2 py-1 rounded-lg transition-all duration-200" style={{ background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.3)', boxShadow: '0 0 8px rgba(250,204,21,0.2)' }}>✕</button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plan.days[activeDay].exercises.map((ex, i) => (
                    <ExerciseCard
                      key={i}
                      exercise={ex}
                      index={i}
                      active={timerActive && timerExIdx === i}
                      videoId={videoMap[ex.name.toLowerCase()] ?? ''}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function PlanStat({ icon, label, value }: { icon: string; label: string; value: string }) {
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

function ExerciseCard({ exercise, index, active, videoId }: { exercise: WorkoutExercise; index: number; active?: boolean; videoId?: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className={`backdrop-blur-md rounded-2xl overflow-hidden transition-all duration-300 ${
        active
          ? 'border-2 border-yellow-300 shadow-[0_0_24px_rgba(253,224,71,0.3)] bg-yellow-300/5'
          : 'bg-white/5 border border-white/10 hover:border-yellow-300/20 hover:shadow-[0_0_20px_rgba(253,224,71,0.08)]'
      }`}
    >
      <div className="p-4 space-y-3">
        {/* Name + muscle */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-white font-black text-sm uppercase tracking-wide">{exercise.name}</h3>
            <p className="text-[--color-iron-gold] text-xs font-semibold mt-0.5">{exercise.muscle}</p>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-bold px-2 py-1 rounded-lg transition-all duration-200 shrink-0"
            style={{ background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.25)', boxShadow: '0 0 8px rgba(250,204,21,0.15)' }}
          >
            {expanded ? 'Hide ▲' : 'How to ▼'}
          </button>
        </div>

        {/* Sets / Reps / Rest */}
        <div className="flex gap-3">
          <Pill label="Sets" value={String(exercise.sets)} />
          <Pill label="Reps" value={exercise.reps} />
          <Pill label="Rest" value={exercise.rest} />
        </div>

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
                {/* YouTube video */}
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
            💡 {exercise.tip}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-center">
      <p className="text-gray-500 text-xs uppercase font-bold">{label}</p>
      <p className="text-white text-xs font-black">{value}</p>
    </div>
  );
}
