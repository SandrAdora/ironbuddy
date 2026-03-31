import { useState, useEffect, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGetCustomMeals, apiCreateCustomMeal, apiUpdateCustomMeal, apiDeleteCustomMeal, type CustomMeal } from '../api';
import { useTheme } from '../context/themeContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUtensils, faBowlFood, faEgg, faDrumstickBite, faBowlRice,
  faLeaf, faBreadSlice, faFish, faSeedling, faMortarPestle,
  faJar, faGlassWater, faBox, faCarrot, faBacon, faCheese,
  faAppleWhole, faLemon, faPen, faTrash,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface Props {
  token: string;
}

const ICON_OPTIONS: { id: string; icon: IconDefinition }[] = [
  { id: 'faUtensils',     icon: faUtensils },      // 🍽️
  { id: 'faBowlFood',     icon: faBowlFood },       // 🥗
  { id: 'faEgg',          icon: faEgg },            // 🍳 / 🥚
  { id: 'faDrumstickBite',icon: faDrumstickBite },  // 🥩 / 🍗
  { id: 'faBowlRice',     icon: faBowlRice },       // 🍝 / 🍜
  { id: 'faLeaf',         icon: faLeaf },           // 🥣 / 🥑
  { id: 'faBreadSlice',   icon: faBreadSlice },     // 🌯
  { id: 'faFish',         icon: faFish },           // 🐟
  { id: 'faSeedling',     icon: faSeedling },       // 🥦
  { id: 'faMortarPestle', icon: faMortarPestle },   // 🧆
  { id: 'faJar',          icon: faJar },            // 🫙
  { id: 'faGlassWater',   icon: faGlassWater },     // 🥛
  { id: 'faBox',          icon: faBox },            // 🍱
  { id: 'faCarrot',       icon: faCarrot },
  { id: 'faBacon',        icon: faBacon },
  { id: 'faCheese',       icon: faCheese },
  { id: 'faAppleWhole',   icon: faAppleWhole },
  { id: 'faLemon',        icon: faLemon },
];

const DEFAULT_ICON = 'faUtensils';

const CARD_COLORS = [
  { id: 'gold',   color: '#fde047', border: 'rgba(253,224,71,0.35)' },
  { id: 'orange', color: '#fb923c', border: 'rgba(251,146,60,0.35)' },
  { id: 'green',  color: '#4ade80', border: 'rgba(74,222,128,0.35)' },
  { id: 'blue',   color: '#60a5fa', border: 'rgba(96,165,250,0.35)' },
  { id: 'purple', color: '#c084fc', border: 'rgba(192,132,252,0.35)' },
  { id: 'red',    color: '#f87171', border: 'rgba(248,113,113,0.35)' },
  { id: 'pink',   color: '#f472b6', border: 'rgba(244,114,182,0.35)' },
  { id: 'teal',   color: '#2dd4bf', border: 'rgba(45,212,191,0.35)' },
];

function getUserIdFromToken(token: string): number {
  try { return JSON.parse(atob(token.split('.')[1])).user_id ?? 0; } catch { return 0; }
}
function colorMapKey(token: string) { return `ironbuddy_meal_colors_${getUserIdFromToken(token)}`; }
function loadColorMap(token: string): Record<number, string> {
  try { return JSON.parse(localStorage.getItem(colorMapKey(token)) ?? '{}'); } catch { return {}; }
}
function saveColorMap(token: string, map: Record<number, string>) {
  localStorage.setItem(colorMapKey(token), JSON.stringify(map));
}

/** Renders either a FA icon (new) or a legacy emoji string */
function MealIcon({ value, className, style }: { value: string; className?: string; style?: CSSProperties }) {
  const match = ICON_OPTIONS.find((o) => o.id === value);
  if (match) return <span style={style}><FontAwesomeIcon icon={match.icon} className={className} /></span>;
  return <span style={style}>{value}</span>; // legacy emoji fallback
}

export default function MyMeals({ token }: Props) {
  const { theme } = useTheme();
  const [meals, setMeals] = useState<CustomMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kcal, setKcal] = useState('');
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [cardColor, setCardColor] = useState('gold');
  const [colorMap, setColorMap] = useState<Record<number, string>>(() => loadColorMap(token));

  useEffect(() => {
    apiGetCustomMeals(token)
      .then(setMeals)
      .catch(() => setError('Failed to load meals'))
      .finally(() => setLoading(false));
  }, [token]);

  const resetForm = () => {
    setName(''); setDescription(''); setKcal(''); setIcon(DEFAULT_ICON); setCardColor('gold');
    setFormOpen(false); setEditingId(null); setError('');
  };

  const openEdit = (m: CustomMeal) => {
    setName(m.name);
    setDescription(m.description);
    setKcal(m.kcal);
    setIcon(m.icon || DEFAULT_ICON);
    setCardColor(colorMap[m.id] ?? 'gold');
    setEditingId(m.id);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Meal name is required'); return; }
    setError('');
    setSaving(true);
    try {
      if (editingId !== null) {
        const updated = await apiUpdateCustomMeal(token, editingId, {
          name: name.trim(),
          description: description.trim(),
          kcal: kcal.trim(),
          icon,
          recipe_url: '',
        });
        setMeals((prev) => prev.map((m) => m.id === editingId ? updated : m));
        const newMap = { ...colorMap, [editingId]: cardColor };
        setColorMap(newMap);
        saveColorMap(token, newMap);
      } else {
        const created = await apiCreateCustomMeal(token, {
          name: name.trim(),
          description: description.trim(),
          kcal: kcal.trim(),
          icon,
          recipe_url: '',
          ingredients: [],
        });
        setMeals((prev) => [created, ...prev]);
        const newMap = { ...colorMap, [created.id]: cardColor };
        setColorMap(newMap);
        saveColorMap(token, newMap);
      }
      resetForm();
    } catch {
      setError(editingId !== null ? 'Failed to update meal' : 'Failed to save meal');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setError('');
    setMeals((prev) => prev.filter((m) => m.id !== id));
    try {
      await apiDeleteCustomMeal(token, id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meal');
      setMeals((prev) => [...prev]); // trigger re-fetch on error
      apiGetCustomMeals(token).then(setMeals).catch(() => {});
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Custom</p>
          <h2 className="text-2xl font-black uppercase italic mt-1">My Meals</h2>
        </div>
        {!formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            aria-label="Add new meal"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide active:scale-95 transition-all duration-200"
            style={theme === 'light'
              ? { background: '#fff7ed', color: '#c2410c', border: '1px solid rgba(194,65,12,0.4)', boxShadow: '0 0 10px rgba(194,65,12,0.15)' }
              : { background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 10px rgba(250,204,21,0.25), 0 0 20px rgba(250,204,21,0.1)' }}
          >
            + Add Meal
          </button>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Create / Edit form */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="bg-white/5 backdrop-blur-md border border-yellow-300/20 rounded-2xl p-5 space-y-5"
          >
            <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">
              {editingId !== null ? <><span style={{ color: '#facc15' }}>✎</span> Edit Meal</> : 'New Meal'}
            </p>

            {/* Icon picker */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase font-bold">Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setIcon(o.id)}
                    aria-label={`Select icon ${o.id}`}
                    aria-pressed={icon === o.id}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 ${
                      icon === o.id
                        ? 'bg-yellow-300/20 border-2 border-yellow-300 scale-110 text-yellow-300'
                        : 'bg-white/5 border border-white/10 hover:border-white/30 text-gray-400 hover:text-white'
                    }`}
                  >
                    <FontAwesomeIcon icon={o.icon} className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Card color picker */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase font-bold">Card Color</label>
              <div className="flex flex-wrap gap-2">
                {CARD_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCardColor(c.id)}
                    aria-label={`Color ${c.id}`}
                    className="w-7 h-7 rounded-lg transition-all duration-150 hover:scale-110"
                    style={{
                      background: c.color,
                      border: cardColor === c.id ? '2px solid white' : '2px solid transparent',
                      boxShadow: cardColor === c.id ? `0 0 6px ${c.color}` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Name + kcal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Meal Name *" value={name} onChange={setName} placeholder="e.g. Protein Bowl" />
              <Field label="Calories" value={kcal} onChange={setKcal} placeholder="e.g. 520 kcal" />
            </div>

            {/* Description */}
            <Field label="Description" value={description} onChange={setDescription} placeholder="e.g. Brown rice, grilled chicken, avocado" />

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={resetForm}
                className="flex-1 py-2 sm:py-2.5 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl uppercase text-xs sm:text-sm hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 sm:py-2.5 font-black rounded-xl uppercase text-xs sm:text-sm active:scale-95 transition-all duration-200 disabled:opacity-50"
                style={theme === 'light'
                  ? { background: 'rgba(250,204,21,0.15)', color: '#92600a', border: '1px solid rgba(180,120,0,0.3)' }
                  : { background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 10px rgba(250,204,21,0.35), 0 0 24px rgba(250,204,21,0.15)' }}
              >
                {saving ? 'Saving...' : editingId !== null ? 'Update Meal' : 'Save Meal'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meal list */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-white/10" />
                <div className="flex gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/10" />
                  <div className="w-7 h-7 rounded-lg bg-white/10" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3.5 bg-white/10 rounded w-3/5" />
                <div className="h-2.5 bg-white/5 rounded w-4/5" />
              </div>
              <div className="flex items-center justify-between mt-auto pt-1">
                <div className="h-5 bg-white/10 rounded-full w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : meals.length === 0 && !formOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4"
        >
          <FontAwesomeIcon icon={faUtensils} className="w-12 h-12 text-[--color-iron-gold] opacity-40" />
          <p className="text-[--color-iron-gold] font-black uppercase text-lg">No meals yet</p>
          <p className="text-gray-400 text-sm">Click <strong className="text-white">Add Meal</strong> to save your favourite meals and recipes.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {meals.map((m, i) => {
            const accent = CARD_COLORS.find(c => c.id === (colorMap[m.id] ?? 'gold')) ?? CARD_COLORS[0];
            return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/5 backdrop-blur-md border rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 group"
              style={{ borderColor: accent.border }}
            >
              <div className="flex items-start justify-between">
                <MealIcon value={m.icon || DEFAULT_ICON} className="w-8 h-8" style={{ color: accent.color }} />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(m)}
                    className="p-1.5 rounded-lg transition-colors text-sm"
                    style={{ color: theme === 'light' ? '#c2410c' : '#fde047' }}
                    title="Edit meal"
                    aria-label={`Edit meal: ${m.name}`}
                  >
                    <FontAwesomeIcon icon={faPen} />
                  </button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-400/10 transition-colors"
                    title="Delete meal"
                    aria-label={`Delete meal: ${m.name}`}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
              <div>
                <p className="font-black uppercase text-sm" style={{ color: accent.color }}>{m.name}</p>
                {m.description && <p className="text-gray-400 text-xs mt-1">{m.description}</p>}
              </div>
              <div className="flex items-center justify-between mt-auto">
                {m.kcal ? (
                  <span className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{
                      background: `${accent.color}18`,
                      color: accent.color,
                    }}
                  >{m.kcal}</span>
                ) : <span />}
              </div>
            </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 uppercase font-bold">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600"
      />
    </div>
  );
}
