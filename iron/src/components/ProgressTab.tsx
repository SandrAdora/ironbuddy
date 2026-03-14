import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, ReferenceLine,
} from 'recharts';
import {
  apiGetWeightLogs, apiAddWeightLog, apiDeleteWeightLog,
  type WorkoutSession, type WeightLog,
} from '../api';

interface Props {
  token: string;
  sessions: WorkoutSession[];
  currentWeight?: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcBestStreak(sessions: WorkoutSession[]): number {
  const days = new Set(
    sessions.filter((s) => s.finished_at)
      .map((s) => new Date(s.finished_at!).toLocaleDateString())
  );
  if (days.size === 0) return 0;
  const sorted = [...days].map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
  let best = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = (sorted[i].getTime() - sorted[i - 1].getTime()) / 86400000;
    if (diff === 1) { cur++; best = Math.max(best, cur); } else { cur = 1; }
  }
  return best;
}

function calcCurrentStreak(sessions: WorkoutSession[]): number {
  const days = new Set(
    sessions.filter((s) => s.finished_at)
      .map((s) => new Date(s.finished_at!).toLocaleDateString())
  );
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    if (days.has(d.toLocaleDateString())) { streak++; }
    else if (i > 0) break;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** Build last N weeks of bar chart data */
function buildWeeklyData(sessions: WorkoutSession[], weeks = 8) {
  const finished = sessions.filter((s) => s.finished_at);
  const result = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end   = new Date(); end.setDate(end.getDate() - w * 7); end.setHours(23, 59, 59);
    const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0);
    const count = finished.filter((s) => {
      const d = new Date(s.finished_at!);
      return d >= start && d <= end;
    }).length;
    const label = `${start.getMonth() + 1}/${start.getDate()}`;
    result.push({ week: label, workouts: count });
  }
  return result;
}

// ── Custom Recharts tooltip ───────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: {value: number}[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a2e] border border-white/15 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-0.5">w/c {label}</p>
      <p className="text-yellow-300 font-black">{payload[0].value} workout{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  );
}

function WeightTooltip({ active, payload, label }: { active?: boolean; payload?: {value: number}[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a2e] border border-white/15 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className="text-yellow-300 font-black">{payload[0].value} kg</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProgressTab({ token, sessions, currentWeight }: Props) {
  const [weightLogs, setWeightLogs]   = useState<WeightLog[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput]     = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving]           = useState(false);
  const [weightError, setWeightError] = useState('');

  useEffect(() => {
    apiGetWeightLogs(token).then(setWeightLogs).catch(() => {});
  }, [token]);

  const finished   = sessions.filter((s) => s.finished_at);
  const totalMins  = finished.reduce((s, x) => s + (x.duration_min ?? 0), 0);
  const curStreak  = calcCurrentStreak(sessions);
  const bestStreak = calcBestStreak(sessions);
  const weeklyData = buildWeeklyData(sessions);

  const handleAddWeight = async () => {
    const val = parseFloat(weightInput);
    if (!val || val < 20 || val > 500) { setWeightError('Enter a valid weight (20–500 kg)'); return; }
    setSaving(true); setWeightError('');
    try {
      const log = await apiAddWeightLog(token, val, dateInput);
      setWeightLogs((prev) => {
        const filtered = prev.filter((l) => l.logged_at !== log.logged_at);
        return [...filtered, log].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
      });
      setWeightInput('');
    } catch (e) {
      setWeightError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWeight = async (id: number) => {
    setWeightLogs((prev) => prev.filter((l) => l.id !== id));
    try { await apiDeleteWeightLog(token, id); } catch {
      apiGetWeightLogs(token).then(setWeightLogs).catch(() => {});
    }
  };

  const weightChartData = weightLogs.map((l) => ({
    date: l.logged_at.slice(5), // MM-DD
    weight: l.weight,
    id: l.id,
  }));

  const latestWeight = weightLogs.length ? weightLogs[weightLogs.length - 1].weight : currentWeight;
  const firstWeight  = weightLogs.length ? weightLogs[0].weight : null;
  const weightDelta  = latestWeight && firstWeight ? +(latestWeight - firstWeight).toFixed(1) : null;

  return (
    <div className="space-y-6">

      {/* ── Stat chips ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: '🏋️', label: 'Workouts', value: String(finished.length) },
          { icon: '⏱️', label: 'Total Time', value: totalMins >= 60 ? `${Math.floor(totalMins / 60)}h ${totalMins % 60}m` : `${totalMins}m` },
          { icon: '🔥', label: 'Current Streak', value: `${curStreak} day${curStreak !== 1 ? 's' : ''}` },
          { icon: '🏆', label: 'Best Streak', value: `${bestStreak} day${bestStreak !== 1 ? 's' : ''}` },
        ].map((s) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-3
              hover:border-yellow-300/30 transition-all duration-300"
          >
            <span className="text-2xl">{s.icon}</span>
            <div>
              <p className="text-lg font-black text-[--color-iron-gold]">{s.value}</p>
              <p className="text-xs text-gray-400 uppercase font-bold">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Weekly workouts bar chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4"
      >
        <div>
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Activity</p>
          <h2 className="text-lg font-black uppercase italic mt-0.5">📅 Workouts per Week</h2>
        </div>
        {finished.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">Complete your first workout to see your activity chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="workouts" fill="#fde047" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* ── Weight tracker ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Body</p>
            <h2 className="text-lg font-black uppercase italic mt-0.5">⚖️ Weight Tracker</h2>
          </div>
          {weightDelta !== null && (
            <div className={`px-3 py-1.5 rounded-xl text-sm font-black border ${
              weightDelta < 0
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : weightDelta > 0
                  ? 'bg-red-400/10 border-red-400/30 text-red-400'
                  : 'bg-white/5 border-white/10 text-gray-400'
            }`}>
              {weightDelta > 0 ? '+' : ''}{weightDelta} kg overall
            </div>
          )}
        </div>

        {/* Log form */}
        <div className="flex gap-2 flex-wrap">
          <input
            type="number"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder="Weight (kg)"
            step="0.1"
            className="flex-1 min-w-[120px] bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
              focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600"
          />
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
              focus:border-yellow-300/60 focus:outline-none transition-all"
          />
          <button
            onClick={handleAddWeight}
            disabled={saving || !weightInput}
            className="px-5 py-2.5 bg-yellow-300 text-black font-black rounded-xl uppercase text-sm
              hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? '…' : 'Log'}
          </button>
        </div>
        {weightError && <p className="text-red-400 text-xs">{weightError}</p>}

        {/* Chart */}
        {weightChartData.length < 2 ? (
          <p className="text-gray-500 text-sm text-center py-6">
            {weightChartData.length === 0
              ? 'Log your weight to start tracking your progress.'
              : 'Add one more entry to see your weight trend.'}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weightChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v) => `${v}kg`}
              />
              <Tooltip content={<WeightTooltip />} />
              {currentWeight && (
                <ReferenceLine y={currentWeight} stroke="rgba(253,224,71,0.3)" strokeDasharray="4 4" label={{ value: 'Profile', fill: '#6b7280', fontSize: 10 }} />
              )}
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#fde047"
                strokeWidth={2.5}
                dot={{ fill: '#fde047', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#fde047', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Log history */}
        {weightLogs.length > 0 && (
          <div className="border-t border-white/10 pt-4 space-y-2 max-h-48 overflow-y-auto">
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3">Log history</p>
            <AnimatePresence>
              {[...weightLogs].reverse().map((l) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-400">{l.logged_at}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-black">{l.weight} kg</span>
                    <button
                      onClick={() => handleDeleteWeight(l.id)}
                      className="text-gray-600 hover:text-red-400 text-xs transition-colors"
                      title="Remove entry"
                    >
                      ✕
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* ── Session history ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4"
      >
        <div>
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">History</p>
          <h2 className="text-lg font-black uppercase italic mt-0.5">🗓️ Recent Workouts</h2>
        </div>
        {finished.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No completed workouts yet. Start one from the Workouts tab!</p>
        ) : (
          <div className="space-y-2">
            {[...finished]
              .sort((a, b) => new Date(b.finished_at!).getTime() - new Date(a.finished_at!).getTime())
              .slice(0, 15)
              .map((s) => {
                const date   = new Date(s.finished_at!);
                const dur    = s.duration_min ? `${s.duration_min} min` : '—';
                const isAI   = s.workout_type === 'ai';
                return (
                  <div key={s.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/5 transition-colors">
                    <span className="text-lg shrink-0">{isAI ? '🤖' : '✏️'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-bold truncate">{s.workout_name}</p>
                      <p className="text-gray-500 text-xs">{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <span className="text-[--color-iron-gold] text-xs font-black shrink-0">{dur}</span>
                  </div>
                );
              })}
          </div>
        )}
      </motion.div>

    </div>
  );
}
