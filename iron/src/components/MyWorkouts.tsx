import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CustomWorkout, CustomExercise } from '../api';

interface Props {
  token: string;
  onStartWorkout?: (name: string, type: 'ai' | 'custom') => void;
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

export default function MyWorkouts({ token, onStartWorkout }: Props) {
  const [workouts, setWorkouts]       = useState<CustomWorkout[]>([]);
  const [formOpen, setFormOpen]       = useState(false);
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [expandedId, setExpandedId]   = useState<number | null>(null);
  const [error, setError]             = useState('');

  // Form state
  const [workoutName, setWorkoutName] = useState('');
  const [workoutDesc, setWorkoutDesc] = useState('');
  const [exercises, setExercises]     = useState<CustomExercise[]>([emptyExercise()]);

  // Load from localStorage on mount
  useEffect(() => {
    setWorkouts(loadWorkouts(token));
  }, [token]);

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
          <h1 className="text-2xl md:text-3xl font-black uppercase italic mt-1">✏️ My Workouts</h1>
        </div>
        {!formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            className="w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 bg-yellow-300 text-black font-black rounded-xl uppercase text-xs sm:text-sm
              hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
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
              {editingId !== null ? '✏️ Edit Workout' : 'New Workout'}
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

              <button
                onClick={addExercise}
                className="w-full py-2.5 border border-dashed border-white/20 rounded-xl text-gray-500 hover:text-white hover:border-yellow-300/30 text-sm font-bold uppercase transition-all duration-200"
              >
                + Add Exercise
              </button>
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
                className="flex-1 py-2 sm:py-2.5 bg-yellow-300 text-black font-black rounded-xl uppercase text-xs sm:text-sm
                  hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all duration-200"
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
          <span className="text-5xl">✏️</span>
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
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden hover:border-yellow-300/20 transition-all duration-300"
            >
              <button
                onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <div>
                  <p className="text-white font-black uppercase tracking-wide">{w.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {w.exercises.length} exercise{w.exercises.length !== 1 ? 's' : ''}
                    {w.description ? ` · ${w.description}` : ''}
                    {' · '}{new Date(w.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {onStartWorkout && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onStartWorkout(w.name, 'custom'); }}
                      className="text-xs font-black text-black bg-yellow-300 hover:bg-yellow-200 px-3 py-1.5 rounded-lg transition-all active:scale-95"
                      title="Start workout"
                    >
                      ▶ Start
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(w); }}
                    className="text-gray-600 hover:text-yellow-300 text-xs font-bold transition-colors px-2 py-1 rounded-lg hover:bg-yellow-300/10"
                    title="Edit workout"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }}
                    className="text-gray-600 hover:text-red-400 text-xs font-bold transition-colors px-2 py-1 rounded-lg hover:bg-red-400/10"
                    title="Delete workout"
                  >
                    🗑
                  </button>
                  <span className={`text-gray-400 transition-transform duration-200 ${expandedId === w.id ? 'rotate-180' : ''}`}>▾</span>
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
                    <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-white/10 pt-4">
                      {w.exercises.map((ex, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                          <div>
                            <p className="text-white font-black text-sm uppercase">{ex.name}</p>
                            {ex.muscle && <p className="text-[--color-iron-gold] text-xs font-semibold">{ex.muscle}</p>}
                          </div>
                          <div className="flex gap-2">
                            <ExPill label="Sets" value={String(ex.sets)} />
                            <ExPill label="Reps" value={ex.reps} />
                            <ExPill label="Rest" value={ex.rest} />
                          </div>
                          {ex.notes && <p className="text-gray-500 text-xs">💡 {ex.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
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
