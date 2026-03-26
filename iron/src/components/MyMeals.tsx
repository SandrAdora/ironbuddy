import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGetCustomMeals, apiCreateCustomMeal, apiUpdateCustomMeal, apiDeleteCustomMeal, type CustomMeal } from '../api';

interface Props {
  token: string;
}

const EMOJI_OPTIONS = ['🍽️','🥗','🍳','🥩','🍝','🥣','🥑','🌯','🍌','🐟','🍗','🥦','🧆','🥚','🍜','🫙','🥛','🍱'];

export default function MyMeals({ token }: Props) {
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
  const [icon, setIcon] = useState('🍽️');

  useEffect(() => {
    apiGetCustomMeals(token)
      .then(setMeals)
      .catch(() => setError('Failed to load meals'))
      .finally(() => setLoading(false));
  }, [token]);

  const resetForm = () => {
    setName(''); setDescription(''); setKcal(''); setIcon('🍽️');
    setFormOpen(false); setEditingId(null); setError('');
  };

  const openEdit = (m: CustomMeal) => {
    setName(m.name);
    setDescription(m.description);
    setKcal(m.kcal);
    setIcon(m.icon || '🍽️');
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
          <h2 className="text-2xl font-black uppercase italic mt-1">🍽️ My Meals</h2>
        </div>
        {!formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            aria-label="Add new meal"
            className="w-7 h-7 rounded-lg text-base font-black active:scale-95 transition-all duration-200 flex items-center justify-center"
            style={{ background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 10px rgba(250,204,21,0.35), 0 0 24px rgba(250,204,21,0.15)' }}
          >
            +
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

            {/* Emoji picker */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase font-bold">Icon</label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setIcon(e)}
                    aria-label={`Select icon ${e}`}
                    aria-pressed={icon === e}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all duration-150 ${
                      icon === e
                        ? 'bg-yellow-300/20 border-2 border-yellow-300 scale-110'
                        : 'bg-white/5 border border-white/10 hover:border-white/30'
                    }`}
                  >
                    {e}
                  </button>
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
                className="flex-1 py-1.5 font-black rounded-xl uppercase text-xs active:scale-95 transition-all duration-200 disabled:opacity-50"
                style={{ background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 10px rgba(250,204,21,0.35), 0 0 24px rgba(250,204,21,0.15)' }}
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
          <span className="text-5xl">🍽️</span>
          <p className="text-[--color-iron-gold] font-black uppercase text-lg">No meals yet</p>
          <p className="text-gray-400 text-sm">Click <strong className="text-white">Add Meal</strong> to save your favourite meals and recipes.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {meals.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col gap-3
                hover:border-yellow-300/30 hover:shadow-[0_0_20px_rgba(253,224,71,0.08)] transition-all duration-300 group"
            >
              <div className="flex items-start justify-between">
                <span className="text-4xl">{m.icon}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(m)}
                    className="text-yellow-300 p-1.5 rounded-lg hover:bg-yellow-300/10 transition-colors text-sm"
                    title="Edit meal"
                    aria-label={`Edit meal: ${m.name}`}
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-gray-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-400/10 transition-colors"
                    title="Delete meal"
                    aria-label={`Delete meal: ${m.name}`}
                  >
                    🗑
                  </button>
                </div>
              </div>
              <div>
                <p className="font-black text-[--color-iron-gold] uppercase text-sm">{m.name}</p>
                {m.description && <p className="text-gray-400 text-xs mt-1">{m.description}</p>}
              </div>
              <div className="flex items-center justify-between mt-auto">
                {m.kcal ? (
                  <span className="text-xs bg-yellow-300/10 text-yellow-300 font-bold px-3 py-1 rounded-full">{m.kcal}</span>
                ) : <span />}
              </div>
            </motion.div>
          ))}
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
