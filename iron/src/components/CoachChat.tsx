import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiChat, apiCreateCustomMeal, type ChatMessage, type SavePrompt } from '../api';
import type { UserProfile } from '../context/userContext';

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
}

function getUserId(token?: string): number {
  if (!token) return 0;
  try { return JSON.parse(atob(token.split('.')[1])).user_id ?? 0; } catch { return 0; }
}

const WELCOME = (profile: UserProfile) =>
  `Hey ${profile.name?.split(' ')[0] || 'Athlete'}! 💪 I'm IRON, your personal AI coach. I know your goal is **${profile.fitnessGoals || 'getting fit'}** and you're at **${profile.experienceLevel || 'beginner'}** level. Ask me anything — workouts, nutrition, recovery, you name it!`;

const SAVE_META: Record<string, { icon: string; tab: string; color: string }> = {
  workout:    { icon: '💪', tab: 'My Workouts',    color: 'bg-blue-500/20 border-blue-400/30 text-blue-300' },
  meal:       { icon: '🥗', tab: 'My Meals',        color: 'bg-green-500/20 border-green-400/30 text-green-300' },
  supplement: { icon: '💊', tab: 'My Meals',        color: 'bg-purple-500/20 border-purple-400/30 text-purple-300' },
};

function SaveCard({ prompt, token, onSaved }: { prompt: SavePrompt; token?: string; onSaved: () => void }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'declined'>('idle');
  const meta = SAVE_META[prompt.type];

  const handleSave = async () => {
    if (!token || state !== 'idle') return;
    setState('saving');
    try {
      if (prompt.type === 'workout') {
        const d = prompt.data as Record<string, unknown>;
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
        // meal or supplement
        const d = prompt.data as Record<string, unknown>;
        await apiCreateCustomMeal(token, {
          name: String(d.name || prompt.label),
          description: String(d.description || ''),
          kcal: String(d.kcal || '0 kcal'),
          icon: String(d.icon || meta.icon),
          recipe_url: '',
        });
      }
      setState('saved');
      onSaved();
    } catch {
      setState('idle');
    }
  };

  if (state === 'declined') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`ml-10 mt-1 rounded-2xl border px-4 py-3 flex flex-col gap-2 text-xs ${meta.color}`}
    >
      <p className="font-black uppercase tracking-wide">
        {meta.icon} Save "{prompt.label}" to {meta.tab}?
      </p>
      {state === 'saved' ? (
        <p className="font-bold text-green-400">✓ Saved successfully!</p>
      ) : (
        <div className="flex gap-2">
          <button
            disabled={state === 'saving'}
            onClick={handleSave}
            className="px-4 py-1.5 bg-yellow-300 text-black font-black rounded-lg uppercase text-[10px] tracking-wide
              hover:bg-yellow-200 active:scale-95 transition-all disabled:opacity-50"
          >
            {state === 'saving' ? 'Saving…' : '💾 Yes, Save'}
          </button>
          <button
            onClick={() => setState('declined')}
            className="px-4 py-1.5 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-lg uppercase text-[10px] tracking-wide
              hover:text-white transition-all"
          >
            Not Now
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function CoachChat({ profile, token }: Props) {
  const storageKey = `ironbuddy_coach_${getUserId(token)}`;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return [{ role: 'assistant', content: WELCOME(profile) }];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); } catch { /* ignore */ }
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
      const { reply, save_prompt } = await apiChat(text, profile as unknown as Record<string, unknown>, history, token);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, save_prompt }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ ' + (err instanceof Error ? err.message : 'Something went wrong. Try again.') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100svh-17rem)] md:h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Personalized</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase italic mt-1">🦾 AI Coach</h1>
        </div>
        {messages.length > 1 && (
          <button
            onClick={() => setMessages([{ role: 'assistant', content: WELCOME(profile) }])}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-400/10 font-bold uppercase tracking-wide"
          >
            Clear
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
                  className={`max-w-[88%] md:max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-yellow-300 text-black font-semibold rounded-br-sm'
                      : 'bg-white/10 backdrop-blur-sm text-gray-100 border border-white/10 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>

              {/* Save prompt card */}
              {msg.role === 'assistant' && msg.save_prompt && token && (
                <SaveCard
                  prompt={msg.save_prompt}
                  token={token}
                  onSaved={() => {
                    // strip the save_prompt after saving so it doesn't re-show
                    setMessages((prev) =>
                      prev.map((m, idx) => idx === i ? { ...m, save_prompt: undefined } : m)
                    );
                  }}
                />
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
          placeholder="Ask your coach anything..."
          disabled={loading}
          className="flex-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-white text-sm
            focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-500
            disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-5 py-3 bg-yellow-300 text-black font-black rounded-xl uppercase text-sm
            hover:bg-yellow-200 hover:shadow-[0_0_20px_rgba(253,224,71,0.5)] hover:scale-[1.02]
            active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>

      {/* Quick prompts */}
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          `Give me a ${profile.fitnessGoals || 'fitness'} workout`,
          'What should I eat today?',
          'How do I recover faster?',
          'Rate my progress',
        ].map((prompt) => (
          <button
            key={prompt}
            onClick={() => { setInput(prompt); }}
            className="text-xs text-gray-400 bg-white/5 backdrop-blur-sm border border-white/10 px-3 py-1.5 rounded-full
              hover:border-yellow-300/40 hover:text-white transition-all duration-200"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
