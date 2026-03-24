import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ──────────────────────────────────────────────────────────────────────
interface CustomRecipe {
  id: number;
  name: string;
  description: string;
  icon: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  kcal: string;
  ingredients: string[];
  steps: string[];
  created_at: string;
}

interface Props {
  token: string;
}

// ── localStorage helpers ───────────────────────────────────────────────────────
function getUserId(token: string): number {
  try { return JSON.parse(atob(token.split('.')[1])).user_id ?? 0; } catch { return 0; }
}
const storageKey = (token: string) => `ironbuddy_custom_recipes_${getUserId(token)}`;

function load(token: string): CustomRecipe[] {
  try {
    const raw = localStorage.getItem(storageKey(token));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function persist(token: string, recipes: CustomRecipe[]) {
  localStorage.setItem(storageKey(token), JSON.stringify(recipes));
}

// ── Constants ─────────────────────────────────────────────────────────────────
const EMOJI_OPTIONS = ['🍽️','🥗','🍳','🥩','🍝','🥣','🥑','🌯','🍌','🐟','🍗','🥦','🧆','🥚','🍜','🫙','🥛','🍱','🧁','🍕','🌮','🥘','🫕','🍲'];

// ── Component ─────────────────────────────────────────────────────────────────
export default function CustomRecipeBuilder({ token }: Props) {
  const [recipes, setRecipes]     = useState<CustomRecipe[]>([]);
  const [formOpen, setFormOpen]   = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError]         = useState('');

  // Form fields
  const [name, setName]           = useState('');
  const [description, setDesc]    = useState('');
  const [icon, setIcon]           = useState('🍽️');
  const [prepTime, setPrepTime]   = useState('');
  const [cookTime, setCookTime]   = useState('');
  const [servings, setServings]   = useState('');
  const [kcal, setKcal]           = useState('');
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [steps, setSteps]         = useState<string[]>(['']);

  useEffect(() => { setRecipes(load(token)); }, [token]);

  const resetForm = () => {
    setName(''); setDesc(''); setIcon('🍽️'); setPrepTime(''); setCookTime('');
    setServings(''); setKcal(''); setIngredients(['']); setSteps(['']);
    setFormOpen(false); setEditingId(null); setError('');
  };

  const openEdit = (r: CustomRecipe) => {
    setName(r.name); setDesc(r.description); setIcon(r.icon);
    setPrepTime(r.prepTime); setCookTime(r.cookTime);
    setServings(r.servings); setKcal(r.kcal);
    setIngredients(r.ingredients.length ? r.ingredients : ['']);
    setSteps(r.steps.length ? r.steps : ['']);
    setEditingId(r.id); setFormOpen(true); setExpandedId(null);
  };

  const handleSave = () => {
    if (!name.trim()) { setError('Recipe name is required'); return; }
    const cleanIngredients = ingredients.filter((i) => i.trim());
    const cleanSteps       = steps.filter((s) => s.trim());
    if (cleanIngredients.length === 0) { setError('Add at least one ingredient'); return; }
    if (cleanSteps.length === 0)       { setError('Add at least one step'); return; }
    setError('');

    const recipe: CustomRecipe = {
      id: editingId ?? Date.now(),
      name: name.trim(),
      description: description.trim(),
      icon,
      prepTime: prepTime.trim(),
      cookTime: cookTime.trim(),
      servings: servings.trim(),
      kcal: kcal.trim(),
      ingredients: cleanIngredients,
      steps: cleanSteps,
      created_at: editingId
        ? (recipes.find((r) => r.id === editingId)?.created_at ?? new Date().toISOString())
        : new Date().toISOString(),
    };

    setRecipes((prev) => {
      const updated = editingId !== null
        ? prev.map((r) => r.id === editingId ? recipe : r)
        : [recipe, ...prev];
      persist(token, updated);
      return updated;
    });
    resetForm();
  };

  const handleDelete = (id: number) => {
    setRecipes((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      persist(token, updated);
      return updated;
    });
    if (expandedId === id) setExpandedId(null);
  };

  // ── Ingredient / step list helpers ────────────────────────────────────────
  const updateLine = (list: string[], setList: (v: string[]) => void, i: number, val: string) =>
    setList(list.map((x, idx) => idx === i ? val : x));

  const addLine = (list: string[], setList: (v: string[]) => void) =>
    setList([...list, '']);

  const removeLine = (list: string[], setList: (v: string[]) => void, i: number) =>
    setList(list.filter((_, idx) => idx !== i));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Custom</p>
          <h2 className="text-2xl font-black uppercase italic mt-1">👨‍🍳 Recipe Builder</h2>
        </div>
        {!formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            className="font-black text-xs sm:text-sm no-underline border-none outline-none bg-transparent transition-colors active:scale-95"
            style={{ color: '#facc15', textShadow: '0 0 10px rgba(250,204,21,0.7), 0 0 20px rgba(250,204,21,0.4)' }}
          >
            + New Recipe
          </button>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* ── Form ── */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="bg-white/5 backdrop-blur-md border border-yellow-300/20 rounded-2xl p-5 space-y-5"
          >
            <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">
              {editingId !== null ? <><span style={{ color: '#facc15' }}>✎</span> Edit Recipe</> : '👨‍🍳 New Recipe'}
            </p>

            {/* Icon picker */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase font-bold">Icon</label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((e) => (
                  <button key={e} onClick={() => setIcon(e)}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all duration-150 ${
                      icon === e ? 'bg-yellow-300/20 border-2 border-yellow-300 scale-110' : 'bg-white/5 border border-white/10 hover:border-white/30'
                    }`}
                  >{e}</button>
                ))}
              </div>
            </div>

            {/* Name + description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Recipe Name *" value={name} onChange={setName} placeholder="e.g. High-Protein Pasta" />
              <Field label="Short Description" value={description} onChange={setDesc} placeholder="e.g. Quick weeknight dinner" />
            </div>

            {/* Meta row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Prep Time" value={prepTime} onChange={setPrepTime} placeholder="e.g. 10 min" />
              <Field label="Cook Time" value={cookTime} onChange={setCookTime} placeholder="e.g. 20 min" />
              <Field label="Servings" value={servings} onChange={setServings} placeholder="e.g. 2" />
              <Field label="Calories" value={kcal} onChange={setKcal} placeholder="e.g. 480 kcal" />
            </div>

            {/* Ingredients */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase font-bold">Ingredients *</label>
              {ingredients.map((ing, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-gray-600 text-xs font-bold w-5 shrink-0 text-right">{i + 1}.</span>
                  <input
                    value={ing}
                    onChange={(e) => updateLine(ingredients, setIngredients, i, e.target.value)}
                    placeholder={`e.g. 200g chicken breast`}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600"
                  />
                  {ingredients.length > 1 && (
                    <button onClick={() => removeLine(ingredients, setIngredients, i)}
                      className="text-gray-600 hover:text-red-400 text-sm transition-colors shrink-0">✕</button>
                  )}
                </div>
              ))}
              <button onClick={() => addLine(ingredients, setIngredients)}
                className="text-xs text-gray-500 hover:text-yellow-300 font-bold uppercase transition-colors flex items-center gap-1 mt-1">
                + Add Ingredient
              </button>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase font-bold">Steps *</label>
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[--color-iron-gold] text-xs font-black w-5 shrink-0 text-right mt-2.5">{i + 1}.</span>
                  <textarea
                    value={step}
                    rows={2}
                    onChange={(e) => updateLine(steps, setSteps, i, e.target.value)}
                    placeholder={`e.g. Boil pasta until al dente`}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600 resize-none"
                  />
                  {steps.length > 1 && (
                    <button onClick={() => removeLine(steps, setSteps, i)}
                      className="text-gray-600 hover:text-red-400 text-sm transition-colors shrink-0 mt-2">✕</button>
                  )}
                </div>
              ))}
              <button onClick={() => addLine(steps, setSteps)}
                className="text-xs text-gray-500 hover:text-yellow-300 font-bold uppercase transition-colors flex items-center gap-1 mt-1">
                + Add Step
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={resetForm}
                className="flex-1 py-2 sm:py-2.5 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl uppercase text-xs sm:text-sm hover:text-white transition-all">
                Cancel
              </button>
              <button onClick={handleSave}
                className="flex-1 py-1.5 font-black rounded-xl uppercase text-xs active:scale-95 transition-all duration-200"
                style={{ background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 10px rgba(250,204,21,0.35), 0 0 24px rgba(250,204,21,0.15)' }}>
                {editingId !== null ? 'Update Recipe' : 'Save Recipe'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Recipe list ── */}
      {recipes.length === 0 && !formOpen ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4">
          <span className="text-5xl">👨‍🍳</span>
          <p className="text-[--color-iron-gold] font-black uppercase text-lg">No recipes yet</p>
          <p className="text-gray-400 text-sm">Click <strong className="text-white">New Recipe</strong> to build your first custom recipe.</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {recipes.map((r) => (
            <motion.div key={r.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden hover:border-yellow-300/20 transition-all duration-300">

              {/* Card header — click to expand */}
              <button
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
              >
                <span className="text-3xl shrink-0">{r.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black uppercase tracking-wide truncate">{r.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {r.description && <p className="text-gray-500 text-xs truncate">{r.description}</p>}
                    <div className="flex gap-3">
                      {r.prepTime  && <span className="text-gray-600 text-xs">⏱ {r.prepTime}</span>}
                      {r.cookTime  && <span className="text-gray-600 text-xs">🔥 {r.cookTime}</span>}
                      {r.servings  && <span className="text-gray-600 text-xs">🍽 {r.servings}</span>}
                      {r.kcal      && <span className="text-yellow-400/70 text-xs font-bold">{r.kcal}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(r); }}
                    className="text-yellow-300 text-sm p-1.5 rounded-lg hover:bg-yellow-300/10 transition-colors"
                    title="Edit recipe">✎</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                    className="text-gray-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-400/10 transition-colors"
                    title="Delete recipe">🗑</button>
                  <span className={`text-gray-400 transition-transform duration-200 ml-1 ${expandedId === r.id ? 'rotate-180' : ''}`}>▾</span>
                </div>
              </button>

              {/* Expanded details */}
              <AnimatePresence>
                {expandedId === r.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 border-t border-white/10 pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Ingredients */}
                      <div className="space-y-2">
                        <p className="text-[--color-iron-gold] font-black uppercase text-xs tracking-widest">🛒 Ingredients</p>
                        <ul className="space-y-1.5">
                          {r.ingredients.map((ing, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                              <span className="text-[--color-iron-gold] font-black text-xs mt-0.5 shrink-0">{i + 1}.</span>
                              {ing}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Steps */}
                      <div className="space-y-2">
                        <p className="text-[--color-iron-gold] font-black uppercase text-xs tracking-widest">📋 Instructions</p>
                        <ol className="space-y-2">
                          {r.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="bg-yellow-300/10 text-[--color-iron-gold] text-xs font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                              <p className="text-gray-300 text-sm leading-relaxed">{step}</p>
                            </li>
                          ))}
                        </ol>
                      </div>
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

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
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
