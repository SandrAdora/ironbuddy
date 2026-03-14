import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UserRecipe } from '../api';

interface Props {
  token: string;
}

// ── localStorage helpers ───────────────────────────────────────────────────────
function getUserId(token: string): number {
  try { return JSON.parse(atob(token.split('.')[1])).user_id ?? 0; } catch { return 0; }
}
const storageKey = (token: string) => `ironbuddy_recipes_${getUserId(token)}`;

function loadRecipes(token: string): UserRecipe[] {
  try {
    const raw = localStorage.getItem(storageKey(token));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function persistRecipes(token: string, recipes: UserRecipe[]) {
  localStorage.setItem(storageKey(token), JSON.stringify(recipes));
}

// ── URL parser ─────────────────────────────────────────────────────────────────
type ParsedUrl =
  | { type: 'youtube'; embedUrl: string }
  | { type: 'recipe'; domain: string; slug: string; url: string }
  | { type: 'unknown'; url: string };

const RECIPE_SITES: { pattern: RegExp; domain: string }[] = [
  { pattern: /einfachbacken\.de\/rezepte\/([^/?#]+)/, domain: 'einfachbacken.de' },
  { pattern: /chefkoch\.de\/rezepte\/([^/?#]+)/,      domain: 'chefkoch.de' },
  { pattern: /allrecipes\.com\/recipe\/([^/?#]+)/,     domain: 'allrecipes.com' },
  { pattern: /bbcgoodfood\.com\/recipes\/([^/?#]+)/,   domain: 'bbcgoodfood.com' },
];

function parseUrl(url: string): ParsedUrl {
  const ytWatch = url.match(/[?&]v=([^&]+)/);
  if (ytWatch) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytWatch[1]}` };
  const ytShort = url.match(/youtu\.be\/([^?]+)/);
  if (ytShort) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytShort[1]}` };
  if (url.includes('youtube.com/embed/')) return { type: 'youtube', embedUrl: url };
  for (const site of RECIPE_SITES) {
    const match = url.match(site.pattern);
    if (match) return { type: 'recipe', domain: site.domain, slug: match[1], url };
  }
  return { type: 'unknown', url };
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function Recipes({ token }: Props) {
  const [recipes, setRecipes]       = useState<UserRecipe[]>([]);
  const [formOpen, setFormOpen]     = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [error, setError]           = useState('');
  const [title, setTitle]           = useState('');
  const [url, setUrl]               = useState('');

  useEffect(() => { setRecipes(loadRecipes(token)); }, [token]);

  const resetForm = () => {
    setTitle(''); setUrl(''); setFormOpen(false); setEditingId(null); setError('');
  };

  const openEdit = (r: UserRecipe) => {
    setTitle(r.title);
    setUrl(r.url);
    setEditingId(r.id);
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (!url.trim())   { setError('URL is required'); return; }
    setError('');

    setRecipes((prev) => {
      const updated = editingId !== null
        ? prev.map((r) => r.id === editingId ? { ...r, title: title.trim(), url: url.trim() } : r)
        : [{ id: Date.now(), title: title.trim(), url: url.trim(), created_at: new Date().toISOString() }, ...prev];
      persistRecipes(token, updated);
      return updated;
    });
    resetForm();
  };

  const handleDelete = (id: number) => {
    setRecipes((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      persistRecipes(token, updated);
      return updated;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Video</p>
          <h2 className="text-2xl font-black uppercase italic mt-1">🎬 Recipes</h2>
        </div>
        {!formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            className="w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 bg-yellow-300 text-black font-black rounded-xl uppercase text-xs sm:text-sm
              hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
          >
            + Add Recipe
          </button>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Add / Edit form */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="bg-white/5 backdrop-blur-md border border-yellow-300/20 rounded-2xl p-5 space-y-4"
          >
            <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">
              {editingId !== null ? '✏️ Edit Recipe' : 'Add Recipe'}
            </p>

            <div className="space-y-1">
              <label className="text-xs text-gray-500 uppercase font-bold">Recipe Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. High Protein Pasta"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500 uppercase font-bold">Video or Recipe URL</label>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-yellow-300/60 transition-all">
                <span className="text-gray-500 text-sm shrink-0">🔗</span>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  type="url"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-gray-600"
                />
              </div>
              <p className="text-xs text-gray-600">YouTube links will be embedded as a video player.</p>
            </div>

            <div className="flex gap-3 pt-1">
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
                {editingId !== null ? 'Update Recipe' : 'Save Recipe'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recipe list */}
      {recipes.length === 0 && !formOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4"
        >
          <span className="text-5xl">🎬</span>
          <p className="text-[--color-iron-gold] font-black uppercase text-lg">No recipes yet</p>
          <p className="text-gray-400 text-sm">Add a YouTube link and it will appear here as a video player.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recipes.map((r, i) => {
            const parsed = parseUrl(r.url);
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden
                  hover:border-yellow-300/20 transition-all duration-300 group"
              >
                {parsed.type === 'youtube' && (
                  <iframe
                    className="w-full aspect-video"
                    src={parsed.embedUrl}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
                {parsed.type === 'recipe' && (
                  <a href={parsed.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-4 px-5 py-5 hover:bg-white/5 transition-colors"
                  >
                    <div className="w-12 h-12 bg-yellow-300/10 border border-yellow-300/20 rounded-xl flex items-center justify-center text-2xl shrink-0">🍽️</div>
                    <div className="min-w-0">
                      <p className="text-white font-black text-sm uppercase truncate">{parsed.slug.replace(/-/g, ' ')}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{parsed.domain}</p>
                    </div>
                    <span className="ml-auto text-gray-600 text-sm shrink-0">↗</span>
                  </a>
                )}
                {parsed.type === 'unknown' && (
                  <a href={parsed.url} target="_blank" rel="noopener noreferrer"
                    className="w-full aspect-video bg-black/40 flex flex-col items-center justify-center gap-2 hover:bg-black/60 transition-colors"
                    style={{ display: 'flex' }}
                  >
                    <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-200">🔗</div>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Open Link</p>
                  </a>
                )}

                {/* Title + actions */}
                <div className="px-4 py-3 flex items-center justify-between border-t border-white/5">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-black text-sm uppercase truncate">{r.title}</p>
                    <p className="text-gray-600 text-xs mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => openEdit(r)}
                      className="text-gray-600 hover:text-yellow-300 p-1.5 rounded-lg hover:bg-yellow-300/10 transition-colors"
                      title="Edit recipe"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-gray-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-400/10 transition-colors"
                      title="Delete recipe"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
