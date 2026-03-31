import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFloppyDisk, faTriangleExclamation, faPills, faUtensils, faDumbbell } from '@fortawesome/free-solid-svg-icons';
import { apiChat, apiCreateCustomMeal, type ChatMessage, type SavePrompt } from '../api';
import type { UserProfile } from '../context/userContext';
import { useTheme } from '../context/themeContext';

// ── localStorage workout helpers (same storage as MyWorkouts.tsx) ──────────────
function saveWorkoutToStorage(token: string, workout: { name: string; description: string; exercises: unknown[] }) {
  try {
    const userId = JSON.parse(atob(token.split('.')[1])).user_id ?? 0;
    const key = `ironbuddy_workouts_${userId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const entry = { id: Date.now(), created_at: new Date().toISOString(), ...workout };
    localStorage.setItem(key, JSON.stringify([entry, ...existing]));
  } catch { /* ignore */ }
}

interface Props {
  profile: UserProfile;
  token?: string;
  activeSession?: boolean;
}

function getUserId(token?: string): number {
  if (!token) return 0;
  try { return JSON.parse(atob(token.split('.')[1])).user_id ?? 0; } catch { return 0; }
}


const SAVE_META: Record<string, { icon: string | React.ReactNode; tab: string; color: string }> = {
  workout:    { icon: <FontAwesomeIcon icon={faDumbbell} />, tab: 'My Workouts',    color: 'bg-blue-500/20 border-blue-400/30 text-blue-300' },
      meal:       { icon: <FontAwesomeIcon icon={faUtensils} />, tab: 'My Meals',        color: 'bg-green-500/20 border-green-400/30 text-green-300' },
      supplement: { icon: <FontAwesomeIcon icon={faPills} />, tab: 'My Meals',        color: 'bg-purple-500/20 border-purple-400/30 text-purple-300' },
};

function SaveCard({ prompt, token, onSaved }: { prompt: SavePrompt; token?: string; onSaved: () => void }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'declined'>('idle');
  const [savedAsRecipe, setSavedAsRecipe] = useState(false);
  const { theme } = useTheme();
  const meta = SAVE_META[prompt.type];
  const d = prompt.data as Record<string, unknown>;

  // Editable ingredients state for meal type
  const rawIngredients = Array.isArray(d.ingredients) ? (d.ingredients as string[]) : [];
  const [ingredients, setIngredients] = useState<string[]>(rawIngredients);
  const [newIngredient, setNewIngredient] = useState('');

  const addIngredient = useCallback(() => {
    const val = newIngredient.trim();
    if (!val) return;
    setIngredients((prev) => [...prev, val]);
    setNewIngredient('');
  }, [newIngredient]);

  const removeIngredient = useCallback((idx: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSave = async () => {
    if (!token || state !== 'idle') return;
    setState('saving');
    try {
      if (prompt.type === 'workout') {
        saveWorkoutToStorage(token, {
          name: String(d.name || prompt.label),
          description: String(d.description || ''),
          exercises: Array.isArray(d.exercises)
            ? (d.exercises as Record<string, unknown>[]).map((e) => ({
                name: String(e.name || ''),
                sets: Number(e.sets) || 3,
                reps: String(e.reps || '10'),
                rest: String(e.rest || '60s'),
                muscle: String(e.muscle || ''),
                notes: String(e.notes || ''),
              }))
            : [],
        });
      } else {
        await apiCreateCustomMeal(token, {
          name: String(d.name || prompt.label),
          description: String(d.description || ''),
          kcal: String(d.kcal || '0 kcal'),
          icon: String(d.icon || meta.icon),
          recipe_url: '',
          ingredients,
        });
      }
      setState('saved');
      onSaved();
    } catch {
      setState('idle');
    }
  };

  const handleSaveAsRecipe = () => {
    if (!token || savedAsRecipe) return;
    try {
      const userId = getUserId(token);
      const key = `ironbuddy_custom_recipes_${userId}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const steps = Array.isArray(d.steps) ? (d.steps as string[]) : [];
      const entry = {
        id: Date.now(),
        name: String(d.name || prompt.label),
        description: String(d.description || ''),
        icon: String(d.icon || meta.icon),
        prepTime: '',
        cookTime: '',
        servings: '',
        kcal: String(d.kcal || ''),
        ingredients,
        steps,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify([entry, ...existing]));
      setSavedAsRecipe(true);
    } catch { /* ignore */ }
  };

  if (state === 'declined') return null;

  const lightIngredientStyle = { background: 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.15)', color: '#166534' };
  const darkIngredientStyle = { background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)' };
  const lightBtnStyle = { color: '#fff', background: '#166534', border: '1px solid #14532d', boxShadow: 'none' };
  const darkBtnStyle = {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`ml-10 mt-1 rounded-2xl border px-4 py-3 flex flex-col gap-2 text-xs ${meta.color}`}
      style={theme === 'light' ? { color: '#166534' } : {}}
    >
      <p className="font-black uppercase tracking-wide">
        {meta.icon} Save "{prompt.label}" to {meta.tab}?
      </p>

      {/* Editable ingredients for meal type */}
      {prompt.type === 'meal' && state === 'idle' && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-wide opacity-70 font-bold">Ingredients</p>
          <div className="flex flex-wrap gap-1.5">
            {ingredients.map((ing, idx) => (
              <span
                key={idx}
                className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px]"
                style={theme === 'light' ? lightIngredientStyle : darkIngredientStyle}
              >
                {ing}
                <button
                  onClick={() => removeIngredient(idx)}
                  className="text-gray-400 hover:text-red-400 transition-colors ml-0.5 leading-none"
                >
                  remove
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={newIngredient}
              onChange={(e) => setNewIngredient(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIngredient(); } }}
              placeholder="Add ingredient…"
              className="flex-1 rounded-lg px-2.5 py-1 text-[11px] focus:outline-none"
              style={theme === 'light'
                ? { background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.15)', color: '#111', caretColor: '#166534' }
                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
            />
            <button
              onClick={addIngredient}
              className="btn-gold-send px-2.5 py-1 rounded-lg text-[11px] transition-all font-bold"
              style={theme === 'light' ? lightBtnStyle : darkBtnStyle}
            >
              +
            </button>
          </div>
        </div>
      )}

      {state === 'saved' && !savedAsRecipe ? (
        <p className="font-bold text-green-400">✓ Saved to {meta.tab}!</p>
      ) : state === 'saved' && savedAsRecipe ? (
        <p className="font-bold text-green-400">✓ Saved to {meta.tab} & My Recipes!</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            disabled={state === 'saving'}
            onClick={handleSave}
            className="btn-gold-send px-4 py-1.5 font-black rounded-lg uppercase text-[10px] tracking-wide active:scale-95 transition-all disabled:opacity-50"
            style={theme === 'light' ? lightBtnStyle : darkBtnStyle}
          >
            {state === 'saving' ? `Saving…to ${meta.tab}` : <FontAwesomeIcon icon={faFloppyDisk} />}
          </button>
          {prompt.type === 'meal' && (
            <button
              disabled={savedAsRecipe}
              onClick={handleSaveAsRecipe}
              className="btn-gold-send px-4 py-1.5 font-black rounded-lg uppercase text-[10px] tracking-wide active:scale-95 transition-all disabled:opacity-40"
              style={theme === 'light' ? lightBtnStyle : darkBtnStyle}
            >
              {savedAsRecipe ? '✓ Added to Recipes' : <FontAwesomeIcon icon={faFloppyDisk} />}
            </button>
          )}
          <button
            onClick={() => setState('declined')}
            className="btn-gold-send px-4 py-1.5 font-bold rounded-lg uppercase text-[10px] tracking-wide transition-all opacity-60"
            style={theme === 'light' ? { ...lightBtnStyle, opacity: 0.7 } : darkBtnStyle}
          >
            Not Now
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function CoachChat({ profile, token, activeSession }: Props) {
  const { t } = useTranslation();
  const storageKey = `ironbuddy_coach_${getUserId(token)}`;

  const welcome = t('coach.welcome', {
    name: profile.name?.split(' ')[0] || 'Athlete',
    goal: profile.fitnessGoals || 'getting fit',
    level: profile.experienceLevel || 'beginner',
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return [{ role: 'assistant', content: welcome }];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const chatSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (chatSaveTimer.current) clearTimeout(chatSaveTimer.current);
    chatSaveTimer.current = setTimeout(() => {
      try {
        // Strip save_prompt before persisting — the banner is one-time only
        const toStore = messages.map(({ save_prompt: _sp, ...m }) => m);
        localStorage.setItem(storageKey, JSON.stringify(toStore));
      } catch { /* ignore */ }
    }, 500);
    return () => { if (chatSaveTimer.current) clearTimeout(chatSaveTimer.current); };
  }, [messages, storageKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const history = messages.filter((m) => m.role !== 'assistant' || messages.indexOf(m) > 0);

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { reply, save_prompt, follow_ups } = await apiChat(text, profile as unknown as Record<string, unknown>, history, token);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, save_prompt, follow_ups }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: <FontAwesomeIcon icon={faTriangleExclamation} /> + (err instanceof Error ? err.message : 'Something went wrong. Try again.') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col md:h-[calc(100vh-9rem)] ${activeSession ? 'h-[calc(100dvh-12.75rem)]' : 'h-[calc(100dvh-9rem)]'}`}>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">{t('coach.subtitle')}</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase italic mt-1">🦾 {t('coach.title')}</h1>
        </div>
        {messages.length > 1 && (
          <button
            onClick={() => setMessages([{ role: 'assistant', content: welcome }])}
            className="text-xs font-black border-none outline-none bg-transparent active:scale-95 transition-colors"
            style={{ color: '#f87171', textShadow: '0 0 10px rgba(248,113,113,0.8), 0 0 24px rgba(248,113,113,0.4), 0 0 40px rgba(248,113,113,0.2)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.cssText = 'color:#fca5a5;text-shadow:0 0 12px rgba(248,113,113,1),0 0 28px rgba(248,113,113,0.6),0 0 50px rgba(248,113,113,0.3)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.cssText = 'color:#f87171;text-shadow:0 0 10px rgba(248,113,113,0.8),0 0 24px rgba(248,113,113,0.4),0 0 40px rgba(248,113,113,0.2)'; }}
          >
            {t('coach.clear')}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 pb-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <div key={i}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex mb-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-yellow-300/20 border border-yellow-300/50 flex items-center justify-center text-sm mr-2 mt-1 shrink-0 animate-coach-breathe">
                    🦾
                  </div>
                )}
                <div
                  className={`max-w-[88%] md:max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-yellow-300 text-black font-semibold rounded-br-sm whitespace-pre-wrap'
                      : 'coach-bubble-ai backdrop-blur-sm border border-white/10 rounded-bl-sm prose prose-invert prose-sm max-w-none'
                  }`}
                >
                  {msg.role === 'user' ? msg.content : (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                        li: ({ children }) => <li className="text-gray-100">{children}</li>,
                        strong: ({ children }) => <strong className="coach-md-accent font-black">{children}</strong>,
                        h1: ({ children }) => <p className="font-black coach-md-accent text-base mb-1">{children}</p>,
                        h2: ({ children }) => <p className="font-black coach-md-accent mb-1">{children}</p>,
                        h3: ({ children }) => <p className="font-bold coach-md-accent mb-1">{children}</p>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </motion.div>

              {/* Save prompt card */}
              {msg.role === 'assistant' && msg.save_prompt && token && (
                <SaveCard
                  prompt={msg.save_prompt}
                  token={token}
                  onSaved={() => {
                    setMessages((prev) =>
                      prev.map((m, idx) => idx === i ? { ...m, save_prompt: undefined } : m)
                    );
                  }}
                />
              )}

              {/* Follow-up suggestions — only on the last assistant message */}
              {msg.role === 'assistant' && msg.follow_ups?.length && i === messages.length - 1 && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="ml-10 mt-2 flex flex-wrap gap-2"
                >
                  {msg.follow_ups.map((fu) => (
                    <button
                      key={fu}
                      onClick={() => setInput(fu)}
                      className="btn-gold-chip text-[11px] px-3 py-1.5 rounded-full transition-all duration-200 active:scale-95 text-left"
                    >
                      {fu}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="w-8 h-8 rounded-full bg-yellow-300/20 border border-yellow-300/50 flex items-center justify-center text-sm mr-2 shrink-0">
              🦾
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-2 h-2 bg-yellow-300 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={t('coach.placeholder')}
          disabled={loading}
          className="flex-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-white text-sm
            focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-500
            disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="btn-gold-send px-3 py-2 sm:px-5 sm:py-3 font-black rounded-xl uppercase text-xs sm:text-sm hover:scale-[1.02] active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('coach.send')}
        </button>
      </div>

      {/* Quick prompts */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          t('coach.quick_workout', { goal: profile.fitnessGoals || 'fitness' }),
          t('coach.quick_eat'),
          t('coach.quick_recover'),
          t('coach.quick_progress'),
        ].map((prompt) => (
          <button
            key={prompt}
            onClick={() => { setInput(prompt); }}
            className="btn-gold-chip text-xs px-3 py-1.5 rounded-full transition-all duration-200 hover:scale-[1.02] shrink-0 whitespace-nowrap"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
