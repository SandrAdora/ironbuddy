import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faShareFromSquare, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { CustomWorkout, CustomExercise, Exercise, PublicUser } from '../api';
import { apiGetExercises, apiGetUsers, apiStartConversation, apiSendMessage, apiGetYouTubeVideo } from '../api';
import { savePR } from '../prStorage';
import { useTheme } from '../context/themeContext';

interface Props {
  token: string;
  onStartWorkout?: (name: string, type: 'ai' | 'custom') => void;
  autoStartName?: string;
  onAutoStartConsumed?: () => void;
  onAchievementUnlocked?: () => void;
}

// ── localStorage helpers ───────────────────────────────────────────────────────
function getUserId(token: string): number {
  try { return JSON.parse(atob(token.split('.')[1])).user_id ?? 0; } catch { return 0; }
}
const storageKey = (token: string) => `ironbuddy_workouts_${getUserId(token)}`;

function loadWorkouts(token: string): CustomWorkout[] {
  try {
    const raw = localStorage.getItem(storageKey(token));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistWorkouts(token: string, workouts: CustomWorkout[]) {
  localStorage.setItem(storageKey(token), JSON.stringify(workouts));
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const emptyExercise = (): CustomExercise => ({
  name: '', sets: 3, reps: '8-12', rest: '60s', muscle: '', notes: '',
});

export default function MyWorkouts({ token, onStartWorkout, autoStartName, onAutoStartConsumed, onAchievementUnlocked }: Props) {
  const { theme } = useTheme();
  const [workouts, setWorkouts]       = useState<CustomWorkout[]>([]);
  const [formOpen, setFormOpen]       = useState(false);
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [expandedId, setExpandedId]   = useState<number | null>(null);
  const [menuId, setMenuId]           = useState<number | null>(null);
  const [menuPos, setMenuPos]         = useState({ top: 0, right: 0 });
  const [activeWorkoutId, setActiveWorkoutId] = useState<number | null>(null);
  const [workoutPaused, setWorkoutPaused] = useState(false);

  // Set tracker & logs  — key: `${workoutId}_${exIdx}`, value: boolean[] per set
  const [completedSets, setCompletedSets] = useState<Record<string, boolean[]>>({});
  // Weight/reps log     — key: `${workoutId}_${exIdx}_${setIdx}`
  // Extra sets added manually — key: `${workoutId}_${exIdx}`
  const [extraSets, setExtraSets] = useState<Record<string, number>>({});
  const [setLogs, setSetLogs] = useState<Record<string, { weight: string; reps: string }>>({});

  // Rest timer between sets
  const [restActive, setRestActive]   = useState(false);
  const [restLeft, setRestLeft]       = useState(0);
  const restRef                       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restWasActive                 = useRef(false);
  const alarmWasActive                = useRef(false);

  // Stop alarm
  const [alarmMins, setAlarmMins]       = useState(0);
  const [alarmSecInput, setAlarmSecInput] = useState(0);
  const [alarmActive, setAlarmActive]   = useState(false);
  const [alarmLeft, setAlarmLeft]       = useState(0);
  const alarmRef                        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alarmTotal                      = alarmMins * 60 + alarmSecInput;
  const [error, setError]             = useState('');

  // Form state
  const [workoutName, setWorkoutName] = useState('');
  const [workoutDesc, setWorkoutDesc] = useState('');
  const [exercises, setExercises]     = useState<CustomExercise[]>([emptyExercise()]);

  // YouTube video cache — key: exercise name (lowercase)
  const [videoMap, setVideoMap]   = useState<Record<string, string | null>>({});
  const [videoOpen, setVideoOpen] = useState<Set<string>>(new Set());

  // Share state
  const [shareWorkout, setShareWorkout] = useState<CustomWorkout | null>(null);
  const [shareUsers, setShareUsers]     = useState<PublicUser[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSending, setShareSending] = useState(false);
  const [shareSent, setShareSent]       = useState<number | null>(null); // userId just sent to

  async function fetchVideo(name: string) {
    const key = name.toLowerCase();
    // Toggle closed if already open
    if (videoOpen.has(key)) {
      setVideoOpen(prev => { const s = new Set(prev); s.delete(key); return s; });
      return;
    }
    setVideoOpen(prev => new Set(prev).add(key));
    if (key in videoMap) return;
    setVideoMap(prev => ({ ...prev, [key]: null }));
    const id = await apiGetYouTubeVideo(token, name).catch(() => '');
    setVideoMap(prev => ({ ...prev, [key]: id }));
  }

  async function retryVideo(name: string) {
    const key = name.toLowerCase();
    setVideoMap(prev => ({ ...prev, [key]: null }));
    const id = await apiGetYouTubeVideo(token, name).catch(() => '');
    setVideoMap(prev => ({ ...prev, [key]: id }));
  }

  const openShare = async (w: CustomWorkout) => {
    setShareWorkout(w);
    setShareLoading(true);
    setShareSent(null);
    try { setShareUsers(await apiGetUsers(token)); } catch { setShareUsers([]); }
    finally { setShareLoading(false); }
  };

  const sendShare = async (user: PublicUser) => {
    if (!shareWorkout || shareSending) return;
    setShareSending(true);
    try {
      const convo = await apiStartConversation(token, user.id);
      const payload = JSON.stringify({ name: shareWorkout.name, description: shareWorkout.description, exercises: shareWorkout.exercises });
      await apiSendMessage(token, convo.id, `[WORKOUT_SHARE]${payload}`);
      setShareSent(user.id);
    } catch { /* silent */ }
    finally { setShareSending(false); }
  };

  // Library picker state
  const [libOpen, setLibOpen]         = useState(false);
  const [libSearch, setLibSearch]     = useState('');
  const [libResults, setLibResults]   = useState<Exercise[]>([]);
  const [libLoading, setLibLoading]   = useState(false);
  const [libError, setLibError]       = useState('');
  const libTimer                       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef                        = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setWorkouts(loadWorkouts(token));
  }, [token]);

  // Auto-start a workout when navigated from dashboard
  useEffect(() => {
    if (!autoStartName || activeWorkoutId !== null) return;
    const all = loadWorkouts(token);
    const target = all.find(w => w.name === autoStartName);
    if (target) {
      startActiveWorkout(target);
      onAutoStartConsumed?.();
    }
  }, [autoStartName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (menuId === null) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuId]);

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

  function startAlarm(overrideSecs?: number) {
    if (alarmRef.current) clearTimeout(alarmRef.current);
    if (overrideSecs !== undefined) {
      // Fresh start with explicit duration
      if (overrideSecs < 1) return;
      const mins = Math.floor(overrideSecs / 60);
      const sec  = overrideSecs % 60;
      setAlarmMins(mins);
      setAlarmSecInput(sec);
      setAlarmLeft(overrideSecs);
    }
    // Resume from current alarmLeft (or alarmTotal if starting fresh via button)
    setAlarmActive(true);
  }

  function firstExerciseSecs(w: CustomWorkout): number {
    const ex = w.exercises[0];
    if (!ex) return 0;
    const nums = String(ex.reps).match(/\d+/g) ?? ['10'];
    const avg  = nums.reduce((a, b) => a + Number(b), 0) / nums.length;
    return Math.max(20, Math.min(45, Math.round(ex.sets * avg * 2)));
  }

  function stopAlarm() {
    setAlarmActive(false);
    if (alarmRef.current) clearTimeout(alarmRef.current);
  }

  // Rest timer
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

  function parseRestSecs(rest: string): number {
    const min = rest.match(/(\d+)\s*min/i);
    const sec = rest.match(/(\d+)\s*s/i);
    if (min) return Math.min(180, Number(min[1]) * 60);
    if (sec) return Math.min(180, Number(sec[1]));
    return 60;
  }

  function tickSet(wid: number, ei: number, si: number, restSecs: number) {
    const key = `${wid}_${ei}`;
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

  function logSet(wid: number, ei: number, si: number, field: 'weight' | 'reps', val: string) {
    const key = `${wid}_${ei}_${si}`;
    setSetLogs(prev => ({ ...prev, [key]: { ...(prev[key] ?? { weight: '', reps: '' }), [field]: val } }));
  }

  function startActiveWorkout(w: CustomWorkout) {
    setActiveWorkoutId(w.id);
    setWorkoutPaused(false);
    restWasActive.current = false;
    alarmWasActive.current = false;
    setExpandedId(w.id);
    setCompletedSets({});
    setExtraSets({});
    setSetLogs({});
    setRestActive(false);
    if (restRef.current) clearTimeout(restRef.current);
    if (onStartWorkout) onStartWorkout(w.name, 'custom');
    startAlarm(firstExerciseSecs(w));
  }

  // Fetch library exercises with debounce
  useEffect(() => {
    if (!libOpen) return;
    if (libTimer.current) clearTimeout(libTimer.current);
    libTimer.current = setTimeout(async () => {
      setLibLoading(true);
      try {
        const page = await apiGetExercises(token, { search: libSearch, limit: 30 });
        setLibResults(page.results);
        setLibError('');
      } catch (e) { setLibResults([]); setLibError(e instanceof Error ? e.message : 'Failed to load exercises'); }
      finally { setLibLoading(false); }
    }, 300);
    return () => { if (libTimer.current) clearTimeout(libTimer.current); };
  }, [libOpen, libSearch, token]);

  const pickFromLibrary = (ex: Exercise) => {
    setExercises((prev) => [...prev, { ...emptyExercise(), name: ex.name, muscle: ex.target }]);
    setLibOpen(false);
    setLibSearch('');
  };

  const addExercise = () => setExercises((prev) => [...prev, emptyExercise()]);

  const removeExercise = (i: number) =>
    setExercises((prev) => prev.filter((_, idx) => idx !== i));

  const updateExercise = (i: number, field: keyof CustomExercise, value: string | number) =>
    setExercises((prev) => prev.map((ex, idx) => idx === i ? { ...ex, [field]: value } : ex));

  const resetForm = () => {
    setWorkoutName(''); setWorkoutDesc(''); setExercises([emptyExercise()]);
    setFormOpen(false); setEditingId(null); setError('');
  };

  const openEdit = (w: CustomWorkout) => {
    setWorkoutName(w.name);
    setWorkoutDesc(w.description);
    setExercises(w.exercises.length > 0 ? w.exercises : [emptyExercise()]);
    setEditingId(w.id);
    setFormOpen(true);
    setExpandedId(null);
  };

  const handleSave = () => {
    if (!workoutName.trim()) { setError('Workout name is required'); return; }
    const validExercises = exercises.filter((e) => e.name.trim());
    if (validExercises.length === 0) { setError('Add at least one exercise'); return; }
    setError('');

    setWorkouts((prev) => {
      let updated: CustomWorkout[];
      if (editingId !== null) {
        // Update existing workout, preserve original id and created_at
        updated = prev.map((w) =>
          w.id === editingId
            ? { ...w, name: workoutName.trim(), description: workoutDesc.trim(), exercises: validExercises }
            : w
        );
      } else {
        // Create new
        const newWorkout: CustomWorkout = {
          id: Date.now(),
          name: workoutName.trim(),
          description: workoutDesc.trim(),
          exercises: validExercises,
          created_at: new Date().toISOString(),
        };
        updated = [newWorkout, ...prev];
      }
      persistWorkouts(token, updated);
      return updated;
    });
    resetForm();
    if (onAchievementUnlocked) onAchievementUnlocked();
  };

  const handleDelete = (id: number) => {
    setWorkouts((prev) => {
      const updated = prev.filter((w) => w.id !== id);
      persistWorkouts(token, updated);
      return updated;
    });
    if (expandedId === id) setExpandedId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Custom</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase italic mt-1"><span style={{ color: '#facc15' }}>✎</span> My Workouts</h1>
        </div>
        {!formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            className="font-black uppercase text-xs sm:text-sm border-none outline-none bg-transparent active:scale-95 transition-colors"
            style={{ color: theme === 'light' ? '#d97706' : '#facc15', textShadow: theme === 'light' ? 'none' : '0 0 10px rgba(250,204,21,0.7), 0 0 20px rgba(250,204,21,0.4)' }}
          >
            + Create Workout
          </button>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* ── CREATE / EDIT FORM ── */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="bg-white/5 backdrop-blur-md border border-yellow-300/20 rounded-2xl p-5 space-y-5"
          >
            <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">
              {editingId !== null ? <><span style={{ color: '#facc15' }}>✎</span> Edit Workout</> : 'New Workout'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 uppercase font-bold">Workout Name *</label>
                <input
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                  placeholder="e.g. Push Day A"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 uppercase font-bold">Description</label>
                <input
                  value={workoutDesc}
                  onChange={(e) => setWorkoutDesc(e.target.value)}
                  placeholder="e.g. Chest, Shoulders, Triceps"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600"
                />
              </div>
            </div>

            {/* Exercises */}
            <div className="space-y-3">
              <p className="text-xs text-gray-500 uppercase font-bold">Exercises</p>
              {exercises.map((ex, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[--color-iron-gold] font-black uppercase">Exercise {i + 1}</span>
                    {exercises.length > 1 && (
                      <button
                        onClick={() => removeExercise(i)}
                        className="text-gray-600 hover:text-red-400 text-xs transition-colors"
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Exercise Name *" value={ex.name} onChange={(v) => updateExercise(i, 'name', v)} placeholder="e.g. Bench Press" />
                    <FormField label="Muscle Group" value={ex.muscle} onChange={(v) => updateExercise(i, 'muscle', v)} placeholder="e.g. Chest" />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500 uppercase font-bold">Sets</label>
                      <input
                        type="number"
                        min={1}
                        value={ex.sets}
                        onChange={(e) => updateExercise(i, 'sets', parseInt(e.target.value) || 1)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all text-center"
                      />
                    </div>
                    <FormField label="Reps" value={ex.reps} onChange={(v) => updateExercise(i, 'reps', v)} placeholder="8-12" />
                    <FormField label="Rest" value={ex.rest} onChange={(v) => updateExercise(i, 'rest', v)} placeholder="60s" />
                  </div>

                  <FormField label="Notes (optional)" value={ex.notes} onChange={(v) => updateExercise(i, 'notes', v)} placeholder="e.g. Keep back straight" />
                </motion.div>
              ))}

              <div className="flex gap-2">
                <button
                  onClick={addExercise}
                  className="flex-1 py-1.5 border border-dashed border-white/20 rounded-xl text-gray-500 hover:text-white hover:border-yellow-300/30 text-xs font-bold uppercase transition-all duration-200"
                >
                  + Add Exercise
                </button>
                <button
                  onClick={() => { setLibOpen((v) => !v); setLibSearch(''); }}
                  className={`flex-1 py-1.5 border border-dashed rounded-xl text-xs font-bold uppercase transition-all duration-200 hover:border-yellow-300/60 ${theme === 'light' ? 'border-yellow-600/50 text-gray-800 hover:text-gray-900' : 'border-yellow-300/30 text-yellow-400/70 hover:text-yellow-300'}`}
                >
                  From Library
                </button>
              </div>

              {/* Library Picker */}
              <AnimatePresence>
                {libOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-white/5 border border-yellow-300/20 rounded-xl p-4 space-y-3">
                      <p className="text-xs text-[--color-iron-gold] font-black uppercase tracking-widest">📚 Workout Library</p>
                      <input
                        autoFocus
                        value={libSearch}
                        onChange={(e) => setLibSearch(e.target.value)}
                        placeholder="Search exercises…"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600"
                      />
                      <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                        {libLoading ? (
                          <p className="text-gray-500 text-xs text-center py-4">Loading…</p>
                        ) : libError ? (
                          <p className="text-red-400 text-xs text-center py-4">{libError}</p>
                        ) : libResults.length === 0 ? (
                          <p className="text-gray-500 text-xs text-center py-4">No exercises found</p>
                        ) : libResults.map((ex) => (
                          <button
                            key={ex.id}
                            onClick={() => pickFromLibrary(ex)}
                            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-yellow-300/10 transition-colors group"
                          >
                            <p className="text-white text-sm font-semibold group-hover:text-yellow-300 transition-colors capitalize">{ex.name}</p>
                            <p className="text-gray-500 text-xs capitalize">{ex.target} · {ex.body_part}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={resetForm}
                className="flex-1 py-2 sm:py-2.5 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl uppercase text-xs sm:text-sm hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-1.5 font-black rounded-xl uppercase text-xs active:scale-95 transition-all duration-200"
                style={{ background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 10px rgba(250,204,21,0.35), 0 0 24px rgba(250,204,21,0.15)' }}
              >
                {editingId !== null ? 'Update Workout' : 'Save Workout'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── WORKOUT LIST ── */}
      {workouts.length === 0 && !formOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4"
        >
          <span className="text-5xl" style={{ color: '#facc15' }}>✎</span>
          <p className="text-[--color-iron-gold] font-black uppercase text-lg">No workouts yet</p>
          <p className="text-gray-400 text-sm">Click <strong className="text-white">Create Workout</strong> to build your first custom plan.</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {workouts.map((w) => (
            <motion.div
              key={w.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover:border-yellow-300/20 transition-all duration-300"
            >
              <button
                onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
                className="w-full flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 text-left"
              >
                <div>
                  <p className="font-black uppercase tracking-wide" style={{ color: theme === 'light' ? '#111' : '#fff' }}>{w.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: theme === 'light' ? '#888' : 'rgb(107,114,128)' }}>
                    {w.exercises.length} exercise{w.exercises.length !== 1 ? 's' : ''}
                    {w.description ? ` · ${w.description}` : ''}
                    {' · '}{new Date(w.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {onStartWorkout && activeWorkoutId === w.id ? (
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      {/* Pause / Resume */}
                      <button
                        onClick={() => {
                          if (workoutPaused) {
                            setWorkoutPaused(false);
                            if (alarmWasActive.current) startAlarm();
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
                        onClick={() => { setActiveWorkoutId(null); setWorkoutPaused(false); setRestActive(false); stopAlarm(); }}
                        className="text-[10px] font-black px-2.5 py-1.5 rounded-lg border-none outline-none transition-all active:scale-95"
                        style={{ background: '#060608', color: '#4ade80', boxShadow: '0 0 10px rgba(74,222,128,0.45), 0 0 24px rgba(74,222,128,0.2)' }}
                        title="Finish workout"
                      >
                        ✓
                      </button>
                    </div>
                  ) : onStartWorkout ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); startActiveWorkout(w); }}
                      className="text-sm font-black border-none outline-none bg-transparent active:scale-95 transition-colors"
                      style={{ color: '#facc15' }}
                      title="Start workout"
                    >
                      ▶
                    </button>
                  ) : null}
                  {/* Gear menu */}
                  <div ref={menuId === w.id ? menuRef : undefined} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        if (menuId === w.id) { setMenuId(null); return; }
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setMenuPos({ top: rect.bottom + window.scrollY + 4, right: window.innerWidth - rect.right });
                        setMenuId(w.id);
                      }}
                      className="text-gray-400 hover:text-yellow-300 text-base px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                      title="Options"
                    >
                      <FontAwesomeIcon icon={faGear} />
                    </button>
                  </div>
                  <span className={`text-gray-400 text-xl transition-transform duration-200 ${expandedId === w.id ? 'rotate-180' : ''}`}>▾</span>
                </div>
              </button>

              <AnimatePresence>
                {expandedId === w.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-3 border-t border-white/10 pt-4">
                      {/* Rest timer banner */}
                      {activeWorkoutId === w.id && restActive && (
                        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-400/30 rounded-xl px-3 py-2">
                          <span className="text-blue-300 text-xs font-black uppercase tracking-widest shrink-0">Rest</span>
                          <button
                            onClick={() => setRestLeft(t => Math.max(0, t - 10))}
                            className="text-[10px] font-black px-2 py-1 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 transition-colors shrink-0"
                          >−10s</button>
                          <span className="text-blue-300 font-black text-xl tabular-nums mx-auto">
                            {String(Math.floor(restLeft / 60)).padStart(2,'0')}:{String(restLeft % 60).padStart(2,'0')}
                          </span>
                          <button
                            onClick={() => setRestLeft(t => t + 10)}
                            className="text-[10px] font-black px-2 py-1 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 transition-colors shrink-0"
                          >+10s</button>
                          <button onClick={() => setRestActive(false)} className="text-xs text-blue-400 hover:text-white font-bold transition-colors shrink-0">Skip</button>
                        </div>
                      )}

                      {w.exercises.map((ex, i) => {
                        const isActive = activeWorkoutId === w.id;
                        const isExpanded = expandedId === w.id;
                        const key = `${w.id}_${i}`;
                        const done = completedSets[key] ?? [];
                        const totalSets = ex.sets + (extraSets[key] ?? 0);
                        const doneCount = done.filter(Boolean).length;
                        return (
                          <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-white font-black text-sm uppercase">{ex.name}</p>
                                {ex.muscle && <p className="text-[--color-iron-gold] text-xs font-semibold">{ex.muscle}</p>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {isActive && (
                                  <span className="text-xs font-bold tabular-nums" style={{ color: doneCount === totalSets ? '#4ade80' : '#facc15' }}>
                                    {doneCount}/{totalSets} sets
                                  </span>
                                )}
                                <button
                                  onClick={() => fetchVideo(ex.name)}
                                  className="text-xs font-black border-none outline-none bg-transparent transition-colors"
                                  style={{ color: '#facc15', textShadow: '0 0 8px rgba(250,204,21,0.5)' }}
                                >
                                  ▶ Tutorial
                                </button>
                              </div>
                            </div>

                            {/* YouTube video embed (collapsible) */}
                            {videoOpen.has(ex.name.toLowerCase()) && (
                              <>
                                {videoMap[ex.name.toLowerCase()] === null && (
                                  <p className="text-gray-500 text-xs">Loading video…</p>
                                )}
                                {ex.name.toLowerCase() in videoMap && videoMap[ex.name.toLowerCase()] === '' && (
                                  <button
                                    onClick={() => retryVideo(ex.name)}
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
                                {videoMap[ex.name.toLowerCase()] && (
                                  <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingTop: '56.25%' }}>
                                    <iframe
                                      className="absolute inset-0 w-full h-full"
                                      src={`https://www.youtube.com/embed/${videoMap[ex.name.toLowerCase()]}?rel=0`}
                                      title={ex.name}
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                  </div>
                                )}
                              </>
                            )}

                            {/* Pills (static info) */}
                            {!isExpanded && (
                              <div className="flex gap-2">
                                <ExPill label="Sets" value={String(ex.sets)} />
                                <ExPill label="Reps" value={ex.reps} />
                                <ExPill label="Rest" value={ex.rest} />
                              </div>
                            )}

                            {/* Set rows (shown when card is expanded) */}
                            {isExpanded && (
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
                                {Array.from({ length: totalSets }).map((_, si) => {
                                  const log = setLogs[`${w.id}_${i}_${si}`] ?? { weight: '', reps: '' };
                                  const checked = done[si] ?? false;
                                  return (
                                    <div key={si} className={`grid grid-cols-[20px_1fr_1fr_28px] gap-2 items-center rounded-lg px-1 py-1 transition-colors ${checked ? 'bg-green-500/10' : 'bg-white/3'}`}>
                                      <span className="text-xs font-black text-gray-500">{si + 1}</span>
                                      <input
                                        type="text" inputMode="decimal" placeholder="kg"
                                        value={log.weight}
                                        onChange={e => logSet(w.id, i, si, 'weight', e.target.value)}
                                        className={`bg-black/40 border border-white/10 rounded-lg text-center text-xs font-bold py-1 px-1 focus:outline-none focus:border-yellow-300/40 w-full transition-all ${checked ? 'line-through text-green-400/60' : 'text-white'}`}
                                      />
                                      <input
                                        type="text" inputMode="numeric" placeholder={ex.reps}
                                        value={log.reps}
                                        onChange={e => logSet(w.id, i, si, 'reps', e.target.value)}
                                        className={`bg-black/40 border border-white/10 rounded-lg text-center text-xs font-bold py-1 px-1 focus:outline-none focus:border-yellow-300/40 w-full transition-all ${checked ? 'line-through text-green-400/60' : 'text-white'}`}
                                      />
                                      <button
                                        onClick={() => {
                                          tickSet(w.id, i, si, parseRestSecs(ex.rest));
                                          if (!checked) {
                                            const w_ = parseFloat(log.weight);
                                            const r_ = parseFloat(log.reps);
                                            savePR(getUserId(token), ex.name, ex.muscle, w_, r_);
                                          }
                                        }}
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
                                {/* Add / Remove set buttons */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setExtraSets(prev => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }))}
                                    className="flex-1 text-xs font-black border-none outline-none bg-transparent active:scale-95 transition-colors"
                                    style={{ color: 'rgba(156,163,175,0.6)' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.cssText = 'color:#facc15;text-shadow:0 0 10px rgba(250,204,21,0.7)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.cssText = 'color:rgba(156,163,175,0.6)'; }}
                                  >
                                    + Add Set
                                  </button>
                                  {totalSets > 1 && (
                                    <button
                                      onClick={() => {
                                        const lastIdx = totalSets - 1;
                                        setExtraSets(prev => ({ ...prev, [key]: (prev[key] ?? 0) - 1 }));
                                        setCompletedSets(prev => {
                                          const arr = [...(prev[key] ?? [])];
                                          arr.splice(lastIdx, 1);
                                          return { ...prev, [key]: arr };
                                        });
                                        setSetLogs(prev => {
                                          const next = { ...prev };
                                          delete next[`${w.id}_${i}_${lastIdx}`];
                                          return next;
                                        });
                                      }}
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

                            {ex.notes && <p className="text-gray-500 text-xs">💡 {ex.notes}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Share Modal */}
      <AnimatePresence>
        {shareWorkout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)' }}
            onClick={() => setShareWorkout(null)}
          >
            <motion.div
              initial={{ scale: 0.93, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.93, y: 16 }}
              transition={{ duration: 0.18 }}
              className="share-modal-card w-full max-w-sm rounded-2xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">📤 Share Workout</p>
                  <p className="text-white font-bold mt-0.5">{shareWorkout.name}</p>
                </div>
                <button onClick={() => setShareWorkout(null)} className="text-gray-600 hover:text-white transition-colors text-lg">✕</button>
              </div>

              {shareLoading ? (
                <p className="text-gray-500 text-sm text-center py-4">Loading athletes…</p>
              ) : shareUsers.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No community athletes found.<br/>Make sure you have community visibility enabled.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {shareUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-3">
                        {user.profile_picture ? (
                          <img src={user.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-black text-gray-400">
                            {(user.name || user.username).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-white text-sm font-semibold">{user.name || user.username}</p>
                          <p className="text-gray-500 text-xs">@{user.username}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => sendShare(user)}
                        disabled={shareSending || shareSent === user.id}
                        className={`text-xs font-black px-3 py-1.5 rounded-lg transition-all disabled:opacity-60 ${shareSent === user.id ? '' : 'btn-gold-send'}`}
                        style={shareSent === user.id
                          ? { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }
                          : undefined
                        }
                      >
                        {shareSent === user.id ? '✓ Sent' : shareSending ? '…' : 'Send'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gear dropdown — rendered at body level so it's never clipped by card stacking contexts */}
      {menuId !== null && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'absolute', top: menuPos.top, right: menuPos.right }}
          className="z-[9999] bg-[#12121f] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[130px]"
        >
          {(() => {
            const w = workouts.find(x => x.id === menuId);
            if (!w) return null;
            return (
              <>
                <button onClick={() => { setMenuId(null); openShare(w); }} className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors hover:bg-white/5 hover:text-blue-400 ${theme === 'light' ? 'text-gray-800' : 'text-gray-300'}`}>
                  <FontAwesomeIcon icon={faShareFromSquare} /> Share
                </button>
                <button onClick={() => { setMenuId(null); openEdit(w); }} className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors hover:bg-white/5 hover:text-yellow-600 ${theme === 'light' ? 'text-gray-800' : 'text-gray-300'}`}>
                  <FontAwesomeIcon icon={faEdit} /> Edit
                </button>
                <button onClick={() => { setMenuId(null); handleDelete(w.id); }} className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors hover:bg-white/5 hover:text-red-400 ${theme === 'light' ? 'text-gray-800' : 'text-gray-300'}`}>
                  <FontAwesomeIcon icon={faTrash} /> Delete
                </button>
              </>
            );
          })()}
        </div>,
        document.body
      )}
    </div>
  );
}

function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 uppercase font-bold">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600"
      />
    </div>
  );
}

function ExPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-center">
      <p className="text-gray-500 text-[10px] uppercase font-bold">{label}</p>
      <p className="text-white text-xs font-black">{value}</p>
    </div>
  );
}
