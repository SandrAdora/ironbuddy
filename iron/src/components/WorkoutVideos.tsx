import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGetWorkoutVideos, apiCreateWorkoutVideo, apiDeleteWorkoutVideo, type WorkoutVideo } from '../api';
import { useTheme } from '../context/themeContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashCan, faClapperboard, faPlus } from '@fortawesome/free-solid-svg-icons';

interface Props {
  token: string;
}
// chef koch: https://www.einfachbacken.de/rezepte/kaesekuchen-so-cremig-und-lecker
function getEmbedUrl(url: string): string | null {
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  const shortMatch = url.match(/youtu\.be\/([^?]+)/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
  if (url.includes('youtube.com/embed/')) return url;
  
  return null;
}

export default function WorkoutVideos({ token }: Props) {
  const { theme } = useTheme();
  const [videos, setVideos] = useState<WorkoutVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    apiGetWorkoutVideos(token)
      .then(setVideos)
      .catch(() => setError('Failed to load videos'))
      .finally(() => setLoading(false));
  }, [token]);

  const resetForm = () => { setTitle(''); setUrl(''); setAdding(false); };

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (!url.trim()) { setError('URL is required'); return; }
    setError('');
    setSaving(true);
    try {
      const created = await apiCreateWorkoutVideo(token, { title: title.trim(), url: url.trim() });
      setVideos((prev) => [created, ...prev]);
      resetForm();
    } catch {
      setError('Failed to save video');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiDeleteWorkoutVideo(token, id);
      setVideos((prev) => prev.filter((v) => v.id !== id));
    } catch {
      setError('Failed to delete video');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Video Library</p>
          <h2 className="text-2xl font-black uppercase italic mt-1"><FontAwesomeIcon icon={faClapperboard} /> Workout Videos</h2>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="font-black text-xs sm:text-sm border-none outline-none bg-transparent active:scale-95 transition-colors"
            style={{ color: theme === 'light' ? '#d97415' : '#facc15', textShadow: theme === 'light' ? 'none' : '0 0 10px rgba(250,204,21,0.7), 0 0 20px rgba(250,204,21,0.4)' }}
          >
             <FontAwesomeIcon icon={faPlus} /> Add Video
          </button>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Add form */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="bg-white/5 backdrop-blur-md border border-yellow-300/20 rounded-2xl p-5 space-y-4"
          >
            <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest">Add Workout Video</p>

            <div className="space-y-1">
              <label className="text-xs text-gray-500 uppercase font-bold">Video Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Full Body HIIT – Day 1"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500 uppercase font-bold">Video URL (YouTube)</label>
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
              <p className="text-xs text-gray-600">YouTube links are embedded as a video player directly in the app.</p>
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
                disabled={saving}
                className="flex-1 py-1.5 font-black rounded-xl uppercase text-xs active:scale-95 transition-all duration-200 disabled:opacity-50"
                style={{ background: '#060608', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', boxShadow: '0 0 10px rgba(250,204,21,0.35), 0 0 24px rgba(250,204,21,0.15)' }}
              >
                {saving ? 'Saving...' : 'Save Video'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video list */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-video bg-white/10" />
              <div className="p-4"><div className="h-4 bg-white/10 rounded w-2/3" /></div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 && !adding ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4"
        >
          <span className="text-5xl">🎬</span>
          <p className="text-[--color-iron-gold] font-black uppercase text-lg">No videos yet</p>
          <p className="text-gray-400 text-sm">Paste a YouTube link and it will appear here as an embedded video player.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {videos.map((v, i) => {
            const embedUrl = getEmbedUrl(v.url);
            return (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden
                  hover:border-yellow-300/20 transition-all duration-300 group"
              >
                {embedUrl ? (
                  <iframe
                    className="w-full aspect-video"
                    src={embedUrl}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full aspect-video bg-black/40 flex flex-col items-center justify-center gap-2 hover:bg-black/60 transition-colors"
                    style={{ display: 'flex' }}
                  >
                    <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center text-2xl
                      group-hover:scale-110 transition-transform duration-200">
                      🔗
                    </div>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Open Link</p>
                  </a>
                )}

                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-white font-black text-sm uppercase truncate">{v.title}</p>
                    <p className="text-gray-600 text-xs mt-0.5">{new Date(v.created_at).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(v.id)}
                    className="text-gray-700 hover:text-red-400 text-sm transition-colors opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-400/10 ml-3 shrink-0"
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
