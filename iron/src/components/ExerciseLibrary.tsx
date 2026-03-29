import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  apiGetExercises, apiGetExerciseMeta, apiGetCustomWorkouts, apiUpdateCustomWorkout,
  apiFetchExerciseMedia, apiTranslateInstructions, apiGetYouTubeVideo,
} from '../api';
import type { Exercise, ExerciseMeta, CustomWorkout } from '../api';
import MuscleMap from './MuscleMap';
import { useTheme } from '../context/themeContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLungs, faShieldHalved, faDumbbell, faHandFist, faPersonRunning,
  faBolt, faHeartPulse, faBrain, faHand,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

// ── Custom dropdown (fully dark, no browser flash) ──────────────────────────
interface SelectOption { value: string; label: string }
interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  gold?: boolean;
}

function CustomSelect({ value, onChange, options, placeholder = 'Select…', className = '', gold = false }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isLight = theme === 'light';
  const triggerColor = gold
    ? (isLight ? '#d97706' : 'rgba(253,230,138,1)')
    : (isLight ? '#333' : 'rgba(209,213,219,1)');
  const triggerBorder = gold
    ? (isLight ? '1px solid rgba(217,119,6,0.3)' : '1px solid rgba(253,224,71,0.2)')
    : (isLight ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.1)');

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm transition-colors"
        style={{ background: isLight ? '#fff' : '#060608', color: triggerColor, border: triggerBorder }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={placeholder}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <span className={`text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''} shrink-0`} aria-hidden="true">▼</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden overflow-y-auto max-h-56"
            style={{ background: isLight ? '#fff' : '#060608', border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)', transformOrigin: 'top' }}
          >
            {options.map(opt => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors"
                  style={opt.value === value
                    ? { background: 'rgba(250,204,21,0.1)', color: isLight ? '#d97706' : 'rgba(253,224,71,1)' }
                    : { color: isLight ? '#444' : 'rgba(209,213,219,1)' }
                  }
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

interface Props { token: string; language?: string }

const PAGE_SIZE = 20;

function capitalize(s: string) {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

// Map CustomWorkout exercise muscle strings → ExerciseDB body_part
const MUSCLE_TO_BODYPART: Record<string, string> = {
  chest: 'chest', pectorals: 'chest',
  back: 'back', lats: 'back', 'upper back': 'back',
  biceps: 'upper arms', triceps: 'upper arms', arms: 'upper arms',
  shoulders: 'shoulders', delts: 'shoulders',
  abs: 'waist', core: 'waist', obliques: 'waist',
  quads: 'upper legs', hamstrings: 'upper legs', legs: 'upper legs',
  glutes: 'upper legs', 'hip flexors': 'upper legs',
  calves: 'lower legs',
  forearms: 'lower arms',
  neck: 'neck',
  cardio: 'cardio',
};

const BODY_PART_STYLE: Record<string, { gradient: string; lightGradient?: string; icon: IconDefinition }> = {
  chest:        { gradient: 'from-red-900/60 to-red-700/30',       icon: faLungs },
  back:         { gradient: 'from-blue-900/60 to-blue-700/30',     icon: faShieldHalved },
  shoulders:    { gradient: 'from-purple-900/60 to-purple-700/30', icon: faDumbbell },
  'upper arms': { gradient: 'from-orange-900/60 to-orange-700/30', icon: faDumbbell },
  'lower arms': { gradient: 'from-amber-900/60 to-amber-700/30',   icon: faHandFist },
  'upper legs': { gradient: 'from-green-900/60 to-green-700/30',   icon: faPersonRunning },
  'lower legs': { gradient: 'from-teal-900/60 to-teal-700/30',     icon: faPersonRunning },
  waist:        { gradient: 'from-yellow-900/60 to-yellow-700/30', lightGradient: 'from-yellow-700 to-yellow-500', icon: faBolt },
  cardio:       { gradient: 'from-pink-900/60 to-pink-700/30',     icon: faHeartPulse },
  neck:         { gradient: 'from-indigo-900/60 to-indigo-700/30', icon: faBrain },
};
const DEFAULT_STYLE = { gradient: 'from-gray-800/60 to-gray-700/30', icon: faHand };

function ExerciseCardVisual({ bodyPart, target }: { bodyPart: string; target: string }) {
  const { theme } = useTheme();
  const style = BODY_PART_STYLE[bodyPart.toLowerCase()] ?? DEFAULT_STYLE;
  const gradient = theme === 'light' && style.lightGradient ? style.lightGradient : style.gradient;
  return (
    <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-1 p-2`}>
      <FontAwesomeIcon icon={style.icon} className="w-8 h-8 text-yellow-300/80" />
      <span className="text-yellow-300 text-[10px] font-bold uppercase tracking-wider text-center leading-tight">
        {capitalize(target)}
      </span>
    </div>
  );
}

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 text-xs text-yellow-300 bg-yellow-300/10 border border-yellow-300/20 px-2.5 py-1 rounded-full">
      {label}
      <button onClick={onRemove} aria-label={`Remove filter: ${label}`} className="ml-0.5 text-yellow-400 hover:text-white leading-none">✕</button>
    </span>
  );
}

const ExerciseLibrary: React.FC<Props> = ({ token, language = 'en' }) => {
  const { theme } = useTheme();
  const [meta, setMeta]               = useState<ExerciseMeta | null>(null);
  const [exercises, setExercises]     = useState<Exercise[]>([]);
  const [total, setTotal]             = useState(0);
  const [offset, setOffset]           = useState(0);
  const [loading, setLoading]         = useState(false);
  const [seeding, setSeeding]         = useState(false);
  const [error, setError]             = useState('');

  // Filters
  const [bodyPart, setBodyPart]       = useState('');
  const [target, setTarget]           = useState('');
  const [equipment, setEquipment]     = useState('');
  const [search, setSearch]           = useState('');

  // Feature A — workout filter
  const [workouts, setWorkouts]           = useState<CustomWorkout[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | ''>('');
  const [workoutFilterLabel, setWorkoutFilterLabel] = useState('');

  // Filter panel
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Detail modal
  const [selected, setSelected]       = useState<Exercise | null>(null);

  // Feature B — add to workout
  const [addToWorkoutId, setAddToWorkoutId] = useState<number | ''>('');
  const [addStatus, setAddStatus]           = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  // Translated instructions cache: exerciseId -> string[]
  const [translatedInstructions, setTranslatedInstructions] = useState<Record<string, string[]>>({});

  // YouTube video cache: exerciseId -> videoId (null = loading, '' = not found)
  const [videoCache, setVideoCache] = useState<Record<string, string | null>>({});


  // Load meta + workouts once, and kick off background media fetch
  useEffect(() => {
    apiGetExerciseMeta(token).then(setMeta).catch(() => setError('Failed to load filter options'));
    apiGetCustomWorkouts(token).then(setWorkouts).catch(() => {});
    apiFetchExerciseMedia(token).catch(() => {});
  }, [token]);

  const loadExercises = useCallback(async (currentOffset: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGetExercises(token, {
        body_part: bodyPart || undefined,
        target:    target || undefined,
        equipment: equipment || undefined,
        search:    search || undefined,
        limit:     PAGE_SIZE,
        offset:    currentOffset,
      });
      setSeeding(data.count === 0 && currentOffset === 0 && !bodyPart && !equipment && !search);
      setExercises(data.results);
      setTotal(data.count);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load exercises');
    } finally {
      setLoading(false);
    }
  }, [token, bodyPart, target, equipment, search]);

  useEffect(() => {
    setOffset(0);
    loadExercises(0);
  }, [bodyPart, target, equipment, search, loadExercises]);

  // Feature A: apply workout filter
  function applyWorkoutFilter(workoutId: number | '') {
    setSelectedWorkoutId(workoutId);
    if (!workoutId) {
      setWorkoutFilterLabel('');
      setBodyPart('');
      return;
    }
    const workout = workouts.find(w => w.id === workoutId);
    if (!workout) return;
    setWorkoutFilterLabel(workout.name);
    // Extract muscle groups from workout exercises
    const muscles = workout.exercises.map(e => e.muscle?.toLowerCase() ?? '');
    const bodyParts = [...new Set(muscles.map(m => MUSCLE_TO_BODYPART[m] ?? '').filter(Boolean))];
    // Set the first matching body_part as filter (most common)
    if (bodyParts.length > 0) setBodyPart(bodyParts[0]);
    else setBodyPart('');
    setSearch('');
  }

  function resetFilters() {
    setBodyPart('');
    setTarget('');
    setEquipment('');
    setSearch('');
    setSelectedWorkoutId('');
    setWorkoutFilterLabel('');
  }

  // Feature B: add exercise to workout
  async function handleAddToWorkout() {
    if (!selected || !addToWorkoutId) return;
    const workout = workouts.find(w => w.id === addToWorkoutId);
    if (!workout) return;
    setAddStatus('saving');
    try {
      const newExercise = {
        name: capitalize(selected.name),
        sets: 3,
        reps: '10',
        rest: '60s',
        muscle: selected.target,
        notes: '',
      };
      const alreadyIn = workout.exercises.some(
        e => e.name.toLowerCase() === selected.name.toLowerCase()
      );
      if (!alreadyIn) {
        await apiUpdateCustomWorkout(token, workout.id, {
          name: workout.name,
          description: workout.description,
          exercises: [...workout.exercises, newExercise],
        });
        // Update local workouts state
        setWorkouts(prev => prev.map(w =>
          w.id === workout.id ? { ...w, exercises: [...w.exercises, newExercise] } : w
        ));
      }
      setAddStatus('done');
      setTimeout(() => setAddStatus('idle'), 2500);
    } catch {
      setAddStatus('error');
      setTimeout(() => setAddStatus('idle'), 2500);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  function goPage(page: number) {
    const newOffset = (page - 1) * PAGE_SIZE;
    setOffset(newOffset);
    loadExercises(newOffset);
  }

  const activeFilterCount = [bodyPart, target, equipment, selectedWorkoutId ? '1' : ''].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* ── Filter button ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setFiltersOpen(o => !o)}
          className="relative font-black text-xs sm:text-sm border-none outline-none bg-transparent transition-colors"
          style={filtersOpen || activeFilterCount > 0 ? { color: '#facc15', textShadow: '0 0 10px rgba(250,204,21,0.7)' } : { color: 'rgba(156,163,175,0.8)' }}
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-3 w-4 h-4 bg-yellow-400 text-black text-[10px] font-black rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        {(activeFilterCount > 0 || search) && (
          <button type="button" onClick={resetFilters} className="text-xs text-gray-500 hover:text-white border-none outline-none bg-transparent transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* ── Expandable filter panel ── */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-white/3 border border-white/10 rounded-2xl">
              <div className="space-y-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Workout</p>
                <CustomSelect
                  value={String(selectedWorkoutId)}
                  onChange={val => applyWorkoutFilter(val ? Number(val) : '')}
                  options={[
                    { value: '', label: 'All Workouts' },
                    ...workouts.map(w => ({ value: String(w.id), label: w.name })),
                  ]}
                  placeholder="All Workouts"
                  gold
                />
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Body Part</p>
                <CustomSelect
                  value={bodyPart}
                  onChange={val => { setBodyPart(val); setTarget(''); setSelectedWorkoutId(''); setWorkoutFilterLabel(''); }}
                  options={[
                    { value: '', label: 'All' },
                    ...(meta?.body_parts ?? []).map(bp => ({ value: bp, label: capitalize(bp) })),
                  ]}
                  placeholder="All"
                />
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Muscle</p>
                <CustomSelect
                  value={target}
                  onChange={val => { setTarget(val); setBodyPart(''); setSelectedWorkoutId(''); setWorkoutFilterLabel(''); }}
                  options={[
                    { value: '', label: 'All' },
                    ...(meta?.targets ?? []).map(t => ({ value: t, label: capitalize(t) })),
                  ]}
                  placeholder="All"
                />
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Equipment</p>
                <CustomSelect
                  value={equipment}
                  onChange={setEquipment}
                  options={[
                    { value: '', label: 'All' },
                    ...(meta?.equipment ?? []).map(eq => ({ value: eq, label: capitalize(eq) })),
                  ]}
                  placeholder="All"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active filter badges */}
      {(workoutFilterLabel || bodyPart || target || equipment) && (
        <div className="flex gap-2 flex-wrap">
          {workoutFilterLabel && <FilterBadge label={`Workout: ${workoutFilterLabel}`} onRemove={() => { setSelectedWorkoutId(''); setWorkoutFilterLabel(''); setBodyPart(''); }} />}
          {bodyPart  && <FilterBadge label={`Body: ${capitalize(bodyPart)}`}    onRemove={() => setBodyPart('')} />}
          {target    && <FilterBadge label={`Muscle: ${capitalize(target)}`}    onRemove={() => setTarget('')} />}
          {equipment && <FilterBadge label={`Equipment: ${capitalize(equipment)}`} onRemove={() => setEquipment('')} />}
        </div>
      )}

      {/* Results count */}
      {!loading && !seeding && total > 0 && (
        <p className="text-xs text-gray-500">{total.toLocaleString()} exercise{total !== 1 ? 's' : ''} found</p>
      )}

      {/* States */}
      {seeding && (
        <>
          <div className="flex flex-col items-center gap-2 py-6 text-gray-400">
            <p className="text-sm font-bold">Loading exercise library for the first time…</p>
            <p className="text-xs text-gray-600">This may take 10–15 seconds</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden animate-pulse">
                <div className="aspect-square bg-white/10" />
                <div className="p-2.5 space-y-2">
                  <div className="h-3 bg-white/10 rounded w-3/4" />
                  <div className="h-2.5 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {loading && !seeding && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-white/10" />
              <div className="p-2.5 space-y-2">
                <div className="h-3 bg-white/10 rounded w-3/4" />
                <div className="h-2.5 bg-white/5 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
      )}
      {!loading && !seeding && !error && exercises.length === 0 && (
        <div className="text-center py-10 text-gray-500 text-sm">No exercises found.</div>
      )}

      {/* Exercise Grid */}
      {!loading && !seeding && exercises.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {exercises.map(ex => (
            <motion.button
              key={ex.exercise_id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setSelected(ex);
                setAddToWorkoutId('');
                setAddStatus('idle');
                if (language !== 'en' && ex.instructions.length > 0 && !translatedInstructions[ex.exercise_id]) {
                  apiTranslateInstructions(token, ex.instructions, language).then(translated => {
                    setTranslatedInstructions(prev => ({ ...prev, [ex.exercise_id]: translated }));
                  });
                }
                if (!(ex.exercise_id in videoCache)) {
                  setVideoCache(prev => ({ ...prev, [ex.exercise_id]: null }));
                  apiGetYouTubeVideo(token, ex.name).then(id => {
                    setVideoCache(prev => ({ ...prev, [ex.exercise_id]: id }));
                  }).catch(() => {
                    setVideoCache(prev => ({ ...prev, [ex.exercise_id]: '' }));
                  });
                }
              }}
              className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden text-left hover:border-yellow-300/30 transition-colors"
            >
              <div className="aspect-square overflow-hidden relative">
                {ex.gif_url ? (
                  <img src={ex.gif_url} alt={ex.name} className="w-full h-full object-cover" loading="lazy" />
                ) : ex.wger_image_url ? (
                  <img src={ex.wger_image_url} alt={ex.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <ExerciseCardVisual bodyPart={ex.body_part} target={ex.target} />
                )}
              </div>
              <div className="p-2.5 space-y-1">
                <p className="text-white text-xs font-bold leading-tight line-clamp-2">{capitalize(ex.name)}</p>
                <div className="flex flex-wrap gap-1">
                  <span className="bg-yellow-300/10 text-yellow-300 text-[10px] px-1.5 py-0.5 rounded-full">{capitalize(ex.body_part)}</span>
                  <span className="bg-white/5 text-gray-400 text-[10px] px-1.5 py-0.5 rounded-full">{capitalize(ex.equipment)}</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && !seeding && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => goPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page"
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">←</button>
          <span className="text-sm text-gray-400" aria-live="polite">{currentPage} / {totalPages}</span>
          <button onClick={() => goPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page"
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">→</button>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
              style={{
                background: theme === 'light' ? '#ffffff' : '#111827',
                border: theme === 'light' ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
              }}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between p-5" style={{ borderBottom: theme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)' }}>
                <div>
                  <h2 className="font-black text-lg" style={{ color: theme === 'light' ? '#111' : '#fff' }}>{capitalize(selected.name)}</h2>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(250,204,21,0.1)', color: theme === 'light' ? '#d97706' : 'rgba(253,224,71,1)' }}>{capitalize(selected.body_part)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', color: theme === 'light' ? '#555' : 'rgba(156,163,175,1)' }}>{capitalize(selected.equipment)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', color: theme === 'light' ? '#444' : 'rgba(209,213,219,1)' }}>Target: {capitalize(selected.target)}</span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} aria-label="Close exercise details" className="transition-colors text-xl leading-none p-1" style={{ color: theme === 'light' ? '#999' : 'rgba(107,114,128,1)' }}>✕</button>
              </div>

              <div className="p-5 space-y-5">
                {/* Visual + Muscle Map */}
                <div className="flex flex-col sm:flex-row gap-5 items-start">
                  <div className="w-full sm:w-80 shrink-0 rounded-xl overflow-hidden">
                    {/* Loading */}
                    {videoCache[selected.exercise_id] === null && (
                      <div className="relative w-full rounded-xl overflow-hidden animate-pulse bg-white/5" style={{ paddingTop: '56.25%' }}>
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-white/10" />
                          <div className="h-2.5 bg-white/10 rounded w-1/3" />
                        </div>
                      </div>
                    )}
                    {/* Embedded video */}
                    {videoCache[selected.exercise_id] && (
                      <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingTop: '56.25%' }}>
                        <iframe
                          className="absolute inset-0 w-full h-full"
                          src={`https://www.youtube.com/embed/${videoCache[selected.exercise_id]}?rel=0`}
                          title={selected.name}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                    {/* No video found: retry button */}
                    {videoCache[selected.exercise_id] === '' && (
                      <button
                        onClick={() => {
                          setVideoCache(prev => ({ ...prev, [selected.exercise_id]: null }));
                          apiGetYouTubeVideo(token, selected.name).then(id => {
                            setVideoCache(prev => ({ ...prev, [selected.exercise_id]: id }));
                          }).catch(() => {
                            setVideoCache(prev => ({ ...prev, [selected.exercise_id]: '' }));
                          });
                        }}
                        className="relative w-full rounded-xl overflow-hidden border-none outline-none cursor-pointer group"
                        style={{ paddingTop: '56.25%', background: '#0f0f0f', display: 'block' }}
                      >
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                          <div
                            className="w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                            style={{ background: '#ff0000', boxShadow: '0 0 24px rgba(255,0,0,0.5)' }}
                          >
                            <span className="text-white text-2xl ml-1">▶</span>
                          </div>
                          <p className="text-white text-xs font-bold text-center px-4 leading-snug">{capitalize(selected.name)}</p>
                          <p className="text-gray-500 text-[10px] uppercase tracking-widest">Tap to load video</p>
                        </div>
                      </button>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center bg-white/3 rounded-xl p-4 min-h-[220px]">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Muscles Targeted</p>
                    <MuscleMap primaryMuscles={[selected.target]} secondaryMuscles={selected.secondary_muscles} />
                    {selected.secondary_muscles.length > 0 && (
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        Secondary: {selected.secondary_muscles.map(capitalize).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Feature B: Add to Workout */}
                {workouts.length > 0 && (
                  <div className="rounded-xl p-4 space-y-3" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)', border: theme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)' }}>
                    <p className="text-sm font-bold" style={{ color: theme === 'light' ? '#111' : '#fff' }}>Add to Workout</p>
                    <div className="flex gap-2">
                      <CustomSelect
                        value={String(addToWorkoutId)}
                        onChange={val => setAddToWorkoutId(val ? Number(val) : '')}
                        options={[
                          { value: '', label: 'Select a workout…' },
                          ...workouts.map(w => ({ value: String(w.id), label: w.name })),
                        ]}
                        placeholder="Select a workout…"
                        className="flex-1"
                      />
                      <button
                        onClick={handleAddToWorkout}
                        disabled={!addToWorkoutId || addStatus === 'saving'}
                        className="px-4 py-2 bg-yellow-300 text-black rounded-xl text-sm font-black hover:bg-yellow-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                      >
                        {addStatus === 'saving' ? '…' : addStatus === 'done' ? '✓ Added' : addStatus === 'error' ? '✗ Error' : '+ Add'}
                      </button>
                    </div>
                    {addStatus === 'done' && (
                      <p className="text-xs text-green-400">Exercise added to {workouts.find(w => w.id === addToWorkoutId)?.name ?? 'workout'}!</p>
                    )}
                    {addStatus === 'error' && (
                      <p className="text-xs text-red-400">Failed to add exercise. Try again.</p>
                    )}
                  </div>
                )}

                {/* Instructions */}
                {selected.instructions.length > 0 && (
                  <div>
                    <h3 className="font-bold text-sm mb-2" style={{ color: theme === 'light' ? '#111' : '#fff' }}>How to perform</h3>
                    {language !== 'en' && !translatedInstructions[selected.exercise_id] && (
                      <p className="text-xs text-gray-500 mb-2 animate-pulse">Translating…</p>
                    )}
                    <ol className="space-y-2">
                      {(translatedInstructions[selected.exercise_id] ?? selected.instructions).map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm" style={{ color: theme === 'light' ? '#444' : 'rgba(209,213,219,1)' }}>
                          <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(250,204,21,0.1)', color: theme === 'light' ? '#d97706' : 'rgba(253,224,71,1)' }}>{i + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExerciseLibrary;
