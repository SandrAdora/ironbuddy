import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiWorkout, type WorkoutPlan, type WorkoutExercise, type CustomWorkout } from '../api';
import type { UserProfile } from '../context/userContext';

interface Props {
  profile: UserProfile;
  token?: string;
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

export default function WorkoutPlanView({ profile, token }: Props) {
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeDay, setActiveDay] = useState(0);
  const [imported, setImported]         = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

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
      const result = await apiWorkout(profile as unknown as Record<string, unknown>);
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
                    className="w-full py-3 bg-yellow-300 text-black font-black rounded-xl uppercase text-sm
                      hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all duration-200"
                  >
                    📥 Save Workouts
                  </button>
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="w-full py-3 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl uppercase text-sm
                      hover:text-white hover:border-white/20 transition-all duration-200"
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
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {plan && token && (
            <button
              onClick={() => plan && importToMyWorkouts(plan)}
              disabled={imported}
              className={`w-full sm:w-auto px-5 py-2.5 font-black rounded-xl uppercase text-sm
                flex items-center justify-center gap-2 transition-all duration-200
                ${imported
                  ? 'bg-green-500 text-white cursor-default'
                  : 'bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:border-yellow-300/40 hover:scale-[1.02] active:scale-95'
                }`}
            >
              {imported ? '✓ Saved to My Workouts' : '📥 Save to My Workouts'}
            </button>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 bg-yellow-300 text-black font-black rounded-xl uppercase text-sm
              hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all duration-200 ${
                    activeDay === i
                      ? 'bg-yellow-300 text-black shadow-[0_0_16px_rgba(253,224,71,0.3)]'
                      : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                  }`}
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
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-4">
                  <h2 className="text-lg font-black text-[--color-iron-gold] uppercase italic">{plan.days[activeDay].day}</h2>
                  <p className="text-gray-400 text-sm mt-0.5">Focus: {plan.days[activeDay].focus}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plan.days[activeDay].exercises.map((ex, i) => (
                    <ExerciseCard key={i} exercise={ex} index={i} />
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

function ExerciseCard({ exercise, index }: { exercise: WorkoutExercise; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden
        hover:border-yellow-300/20 hover:shadow-[0_0_20px_rgba(253,224,71,0.08)] transition-all duration-300"
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
            className="text-xs font-bold text-gray-400 hover:text-yellow-300 transition-colors px-2 py-1 rounded-lg hover:bg-yellow-300/10 shrink-0"
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

        {/* How-to steps (collapsible) */}
        <AnimatePresence>
          {expanded && exercise.how_to && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-white/10 pt-3 space-y-1.5">
                <p className="text-[--color-iron-gold] text-[10px] font-black uppercase tracking-widest mb-2">How to perform</p>
                {exercise.how_to.split(/\d+\.\s+/).filter(Boolean).map((step, i) => (
                  <div key={i} className="flex gap-2 text-xs text-gray-300 leading-relaxed">
                    <span className="text-[--color-iron-gold] font-black shrink-0">{i + 1}.</span>
                    <span>{step.trim()}</span>
                  </div>
                ))}
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
