import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { apiImportRecipe, type UserRecipe } from '../api';
import { useTheme } from '../context/themeContext';

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
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [recipes, setRecipes]       = useState<UserRecipe[]>([]);
  const [formOpen, setFormOpen]     = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [error, setError]           = useState('');
  const [title, setTitle]           = useState('');
  const [url, setUrl]               = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Recipe import
  const [importUrl, setImportUrl]         = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError]     = useState('');
  const [importOpen, setImportOpen]       = useState(false);

  useEffect(() => { setRecipes(loadRecipes(token)); }, [token]);

  const resetForm = () => {
    setTitle(''); setUrl(''); setFormOpen(false); setEditingId(null); setError('');
  };

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setImportLoading(true); setImportError('');
    try {
      const data = await apiImportRecipe(token, importUrl.trim());
      // Pre-fill the add form with the imported data
      setTitle(data.name || '');
      setUrl(data.source_url || importUrl.trim());
      setImportUrl('');
      setImportOpen(false);
      setFormOpen(true);
      setEditingId(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
    }
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
      <div className="space-y-3">
        <div>
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Video</p>
          <h2 className="text-2xl font-black uppercase italic mt-1" style={{ color: theme === 'light' ? '#111' : '#fff' }}>🎬 Video Recipes</h2>
        </div>
        {!formOpen && !importOpen && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportOpen(v => !v)}
              className="px-3 py-1.5 rounded-lg text-xs font-black active:scale-95 transition-all duration-200"
              style={theme === 'light'
                ? { background: 'rgba(250,204,21,0.15)', color: '#92600a', border: '1px solid rgba(180,120,0,0.3)' }
                : { background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 10px rgba(250,204,21,0.35), 0 0 24px rgba(250,204,21,0.15)' }}
              title="Import from URL"
            >
              🔗 {t('recipes.import_btn')}
            </button>
            <button
              onClick={() => setFormOpen(true)}
              aria-label="Add new recipe"
              className="px-3 py-1.5 rounded-lg text-xs font-black active:scale-95 transition-all duration-200 flex items-center gap-1"
              style={theme === 'light'
                ? { background: 'rgba(250,204,21,0.15)', color: '#92600a', border: '1px solid rgba(180,120,0,0.3)' }
                : { background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 10px rgba(250,204,21,0.35), 0 0 24px rgba(250,204,21,0.15)' }}
            >
              + Add Video
            </button>
          </div>
        )}
      </div>

      {/* Import form */}
      <AnimatePresence>
        {importOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-white/5 backdrop-blur-md border border-yellow-300/20 rounded-2xl p-5 space-y-3"
          >
            <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">🔗 {t('recipes.import_title')}</p>
            <div className="flex gap-2">
              <input
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleImport(); if (e.key === 'Escape') setImportOpen(false); }}
                placeholder={t('recipes.import_placeholder')}
                type="url"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-300/60 focus:outline-none placeholder:text-gray-600"
                autoFocus
              />
              <button
                onClick={handleImport}
                disabled={importLoading || !importUrl.trim()}
                className="px-4 py-2 rounded-xl font-black text-xs uppercase active:scale-95 transition-all disabled:opacity-50"
                style={{ background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 8px rgba(250,204,21,0.3)' }}
              >
                {importLoading ? '…' : t('recipes.import_go')}
              </button>
              <button onClick={() => { setImportOpen(false); setImportError(''); }} aria-label="Close import dialog" className="px-3 py-2 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl text-xs hover:text-white transition-all">✕</button>
            </div>
            {importError && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{importError}</p>}
            <p className="text-gray-600 text-xs">{t('recipes.import_hint')}</p>
          </motion.div>
        )}
      </AnimatePresence>

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
              {editingId !== null ? <><span style={{ color: '#facc15' }}>✎</span> Edit Recipe</> : 'Add Recipe'}
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
                className="flex-1 py-1.5 font-black rounded-xl uppercase text-xs active:scale-95 transition-all duration-200"
                style={{ background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 10px rgba(250,204,21,0.35), 0 0 24px rgba(250,204,21,0.15)' }}
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
        <div className="space-y-2">
          {recipes.map((r, i) => {
            const parsed = parseUrl(r.url);
            const ytId = parsed.type === 'youtube' ? parsed.embedUrl.split('/embed/')[1]?.split('?')[0] : null;
            const isExpanded = expandedId === r.id;
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden hover:border-yellow-300/20 transition-all duration-300"
              >
                {/* List row */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  {/* Thumbnail / icon */}
                  {parsed.type === 'youtube' && ytId ? (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      className="shrink-0 relative w-20 h-12 rounded-xl overflow-hidden group/thumb"
                    >
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                        alt={r.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover/thumb:bg-black/20 transition-colors">
                        <span className="text-white text-lg">{isExpanded ? '⏸' : '▶'}</span>
                      </div>
                    </button>
                  ) : parsed.type === 'recipe' ? (
                    <div className="shrink-0 w-12 h-12 bg-yellow-300/10 border border-yellow-300/20 rounded-xl flex items-center justify-center text-xl">🍽️</div>
                  ) : (
                    <div className="shrink-0 w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-xl">🔗</div>
                  )}

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-sm uppercase truncate">{r.title}</p>
                    <p className="text-gray-600 text-[10px] mt-0.5">
                      {parsed.type === 'youtube' ? 'YouTube' : parsed.type === 'recipe' ? parsed.domain : new URL(r.url.startsWith('http') ? r.url : `https://${r.url}`).hostname}
                      {' · '}{new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {(parsed.type === 'recipe' || parsed.type === 'unknown') && (
                      <a
                        href={r.url} target="_blank" rel="noopener noreferrer"
                        className="text-gray-500 hover:text-yellow-300 p-1.5 rounded-lg hover:bg-yellow-300/10 transition-colors text-sm"
                        title="Open link"
                      >↗</a>
                    )}
                    <button onClick={() => openEdit(r)} className="text-sm p-1.5 rounded-lg transition-colors" style={theme === 'light' ? { color: '#92600a' } : { color: '#fde047' }} title="Edit">✎</button>
                    <button onClick={() => handleDelete(r.id)} className="text-gray-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-400/10 transition-colors" title="Delete">🗑</button>
                  </div>
                </div>

                {/* Inline YouTube player (expanded) */}
                <AnimatePresence>
                  {isExpanded && parsed.type === 'youtube' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-white/5"
                    >
                      <iframe
                        className="w-full aspect-video"
                        src={parsed.embedUrl + '?autoplay=1'}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
