import { useState, useEffect } from 'react';
import { useTheme } from '../context/themeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpFromBracket, faDownload, faDumbbell, faClock, faFire, faTrophy, faBullseye, faAnglesDown, faThumbsUp, faGauge, faCalendarDays, faWeightHanging, faRuler } from '@fortawesome/free-solid-svg-icons';
import {
  LineChart, Line, ReferenceLine,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

import {
  apiGetWeightLogs, apiAddWeightLog, apiDeleteWeightLog,
  apiGetBodyMeasurements, apiAddBodyMeasurement, apiDeleteBodyMeasurement,
  apiDeleteSession, apiGetAchievements,
  type WorkoutSession, type WeightLog, type BodyMeasurement, type BadgeMeta, type AchievementsData,
} from '../api';
import { useTranslation } from 'react-i18next';
import { getPRs, getMuscleData, type PR } from '../prStorage';

interface Props {
  token: string;
  sessions: WorkoutSession[];
  onDeleteSession?: (id: number) => void;
  currentWeight?: number | null;
  height?: number | null;
  userId?: number;
  onAchievementUnlocked?: () => void;
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


function WeightTooltip({ active, payload, label }: { active?: boolean; payload?: {value: number}[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a2e] border border-white/15 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className="text-yellow-300 font-black">{payload[0].value} kg</p>
    </div>
  );
}

// ── Weekly Goal Ring ──────────────────────────────────────────────────────────

function GoalRing({ done, goal, theme }: { done: number; goal: number; theme: string }) {
  const r = 44, stroke = 8;
  const circ = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(done / goal, 1) : 0;
  const dash = pct * circ;
  const isLight = theme === 'light';
  const activeColor = pct >= 1
    ? (isLight ? '#06963b' : '#4ade80')
    : (isLight ? '#ea580c' : '#fde047');
  const glowColor = pct >= 1
    ? (isLight ? 'rgba(22,163,74,0.4)' : 'rgba(74,222,128,0.7)')
    : (isLight ? 'rgba(234,88,12,0.4)' : 'rgba(253,224,71,0.7)');
  const trackColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.06)';
  const subTextColor = isLight ? 'rgba(107,114,128,1)' : 'rgba(156,163,175,0.6)';
  return (
    <svg viewBox="0 0 110 110" className="w-28 h-28">
      <circle cx={55} cy={55} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle
        cx={55} cy={55} r={r} fill="none"
        stroke={activeColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform="rotate(-90 55 55)"
        style={{ transition: 'stroke-dasharray 0.5s ease', filter: `drop-shadow(0 0 6px ${glowColor})` }}
      />
      <text x={55} y={51} textAnchor="middle" fill={activeColor} fontSize="18" fontWeight="900" fontFamily="helvetica">{done}</text>
      <text x={55} y={64} textAnchor="middle" fill={subTextColor} fontSize="9" fontFamily="helvetica">of {goal}</text>
    </svg>
  );
}

// ── Muscle Heatmap ────────────────────────────────────────────────────────────

const MUSCLE_GROUPS = [
  // front
  { id: 'chest',      label: 'Chest',      cx: 55, cy: 105, rx: 20, ry: 13 },
  { id: 'biceps',     label: 'Biceps',     cx: 22, cy: 108, rx: 10, ry: 13 },
  { id: 'biceps_r',   label: 'Biceps',     cx: 88, cy: 108, rx: 10, ry: 13 },
  { id: 'abs',        label: 'Abs',        cx: 55, cy: 140, rx: 14, ry: 18 },
  { id: 'quads',      label: 'Quads',      cx: 40, cy: 185, rx: 13, ry: 22 },
  { id: 'quads_r',    label: 'Quads',      cx: 70, cy: 185, rx: 13, ry: 22 },
  { id: 'calves',     label: 'Calves',     cx: 40, cy: 235, rx: 9,  ry: 16 },
  { id: 'calves_r',   label: 'Calves',     cx: 70, cy: 235, rx: 9,  ry: 16 },
  // back (right side)
  { id: 'back',       label: 'Back',       cx: 165, cy: 105, rx: 20, ry: 18 },
  { id: 'shoulders',  label: 'Shoulders',  cx: 139, cy:  92, rx: 11, ry: 11 },
  { id: 'shoulders_r',label: 'Shoulders',  cx: 191, cy:  92, rx: 11, ry: 11 },
  { id: 'triceps',    label: 'Triceps',    cx: 132, cy: 112, rx: 9,  ry: 13 },
  { id: 'triceps_r',  label: 'Triceps',    cx: 198, cy: 112, rx: 9,  ry: 13 },
  { id: 'glutes',     label: 'Glutes',     cx: 155, cy: 148, rx: 13, ry: 12 },
  { id: 'glutes_r',   label: 'Glutes',     cx: 175, cy: 148, rx: 13, ry: 12 },
  { id: 'hamstrings', label: 'Hamstrings', cx: 153, cy: 190, rx: 12, ry: 22 },
  { id: 'hamstrings_r',label:'Hamstrings', cx: 177, cy: 190, rx: 12, ry: 22 },
];

function muscleColor(lastDate: string | undefined): { fill: string; stroke: string } {
  if (!lastDate) return { fill: 'rgba(255,255,255,0.04)', stroke: 'rgba(255,255,255,0.1)' };
  const daysAgo = (Date.now() - new Date(lastDate).getTime()) / 86400000;
  if (daysAgo < 1)  return { fill: 'rgba(74,222,128,0.35)',  stroke: 'rgba(74,222,128,0.7)' };
  if (daysAgo < 3)  return { fill: 'rgba(253,224,71,0.30)',  stroke: 'rgba(253,224,71,0.65)' };
  if (daysAgo < 7)  return { fill: 'rgba(253,224,71,0.14)',  stroke: 'rgba(253,224,71,0.35)' };
  return { fill: 'rgba(255,255,255,0.07)', stroke: 'rgba(255,255,255,0.18)' };
}

function MuscleHeatmap({ muscleData }: { muscleData: Record<string, string> }) {
  // normalise muscle data keys for fuzzy matching
  const match = (id: string) => {
    const base = id.replace(/_r$/, '');
    const entry = Object.entries(muscleData).find(([k]) => k.toLowerCase().includes(base) || base.includes(k.toLowerCase()));
    return entry?.[1];
  };

  return (
    <div className="space-y-3">
      <svg viewBox="0 0 220 260" className="w-full max-w-[280px] mx-auto">
        {/* body outlines */}
        {/* front torso */}
        <ellipse cx={55} cy={108} rx={28} ry={50} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* front legs */}
        <ellipse cx={40} cy={200} rx={16} ry={48} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <ellipse cx={70} cy={200} rx={16} ry={48} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* front arms */}
        <ellipse cx={22} cy={115} rx={12} ry={30} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <ellipse cx={88} cy={115} rx={12} ry={30} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* back torso */}
        <ellipse cx={165} cy={108} rx={28} ry={50} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* back legs */}
        <ellipse cx={152} cy={200} rx={16} ry={48} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <ellipse cx={178} cy={200} rx={16} ry={48} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* back arms */}
        <ellipse cx={132} cy={115} rx={12} ry={30} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <ellipse cx={198} cy={115} rx={12} ry={30} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* heads */}
        <circle cx={55}  cy={65} r={16} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <circle cx={165} cy={65} r={16} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* front / back labels */}
        <text x={55}  y={255} textAnchor="middle" fill="rgba(156,163,175,0.4)" fontSize="7" fontFamily="helvetica" fontWeight="700" letterSpacing="2">FRONT</text>
        <text x={165} y={255} textAnchor="middle" fill="rgba(156,163,175,0.4)" fontSize="7" fontFamily="helvetica" fontWeight="700" letterSpacing="2">BACK</text>
        {/* muscle group highlights */}
        {MUSCLE_GROUPS.map((m) => {
          const { fill, stroke } = muscleColor(match(m.id));
          return <ellipse key={m.id} cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} fill={fill} stroke={stroke} strokeWidth="1.2" />;
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center text-[10px]">
        {[
          { color: 'bg-green-400/70',         label: 'Today' },
          { color: 'bg-yellow-300/60',        label: '1–2 days' },
          { color: 'bg-yellow-300/30',        label: '3–6 days' },
          { color: 'bg-white/20',             label: '7+ days / never' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-gray-500">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Activity Circle ───────────────────────────────────────────────────────────

function ActivityCircle({ data }: { data: { week: string; workouts: number }[] }) {
  const total  = data.reduce((s, d) => s + d.workouts, 0);
  const max    = Math.max(...data.map((d) => d.workouts), 1);
  const n      = data.length;
  const cx = 160, cy = 160, orbitR = 108;

  return (
    <svg viewBox="0 0 320 320" className="w-full max-w-xs mx-auto" style={{ maxHeight: 260 }}>
      <defs>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde047" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* orbit track */}
      <circle cx={cx} cy={cy} r={orbitR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4" />

      {/* center glow */}
      <circle cx={cx} cy={cy} r={44} fill="url(#centerGlow)" />
      {/* center ring */}
      <circle cx={cx} cy={cy} r={38} fill="rgba(10,10,20,0.9)" stroke="rgba(253,224,71,0.35)" strokeWidth="1.5" />
      {/* center total */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#fde047" fontSize="22" fontWeight="900" fontFamily="helvetica">{total}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(156,163,175,0.7)" fontSize="8" fontWeight="700" fontFamily="helvetica" letterSpacing="2">WORKOUTS</text>

      {/* week nodes */}
      {data.map((d, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        const bx = cx + orbitR * Math.cos(angle);
        const by = cy + orbitR * Math.sin(angle);
        const minR = 10, maxR = 22;
        const r = d.workouts === 0 ? 7 : minR + ((d.workouts - 1) / max) * (maxR - minR);
        const alpha = d.workouts === 0 ? 0.06 : 0.15 + (d.workouts / max) * 0.65;
        const strokeAlpha = d.workouts === 0 ? 0.12 : 0.35 + (d.workouts / max) * 0.45;

        // label position — push further from center
        const labelDist = orbitR + r + 14;
        const lx = cx + labelDist * Math.cos(angle);
        const ly = cy + labelDist * Math.sin(angle);

        return (
          <g key={i}>
            {/* glow behind active nodes */}
            {d.workouts > 0 && (
              <circle cx={bx} cy={by} r={r + 6} fill={`rgba(253,224,71,${alpha * 0.5})`} />
            )}
            {/* node circle */}
            <circle
              cx={bx} cy={by} r={r}
              fill={`rgba(253,224,71,${alpha})`}
              stroke={`rgba(253,224,71,${strokeAlpha})`}
              strokeWidth={d.workouts > 0 ? 1.5 : 1}
            />
            {/* workout count inside node */}
            {d.workouts > 0 && (
              <text x={bx} y={by + 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="900" fontFamily="helvetica">
                {d.workouts}
              </text>
            )}
            {/* week label outside orbit */}
            <text
              x={lx} y={ly + 3.5}
              textAnchor="middle"
              fill="rgba(107,114,128,0.8)"
              fontSize="7.5"
              fontFamily="helvetica"
              fontWeight="700"
            >
              {d.week}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const MEASURE_FIELDS: { key: keyof Omit<BodyMeasurement, 'id' | 'logged_at'>; label: string; color: string }[] = [
  { key: 'chest', label: 'Chest', color: '#f472b6' },
  { key: 'waist', label: 'Waist', color: '#fde047' },
  { key: 'hips',  label: 'Hips',  color: '#a78bfa' },
  { key: 'arms',  label: 'Arms',  color: '#34d399' },
];

function MeasureTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a2e] border border-white/15 rounded-xl px-3 py-2 text-xs shadow-xl space-y-0.5">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-black">{p.name}: {p.value} cm</p>
      ))}
    </div>
  );
}

export default function ProgressTab({ token, sessions, onDeleteSession, currentWeight, height, userId = 0, onAchievementUnlocked: _onAchievementUnlocked }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [achievements, setAchievements] = useState<AchievementsData | null>(null);
  const [achievementsOpen, setAchievementsOpen] = useState(true);

  useEffect(() => {
    apiGetAchievements(token).then(setAchievements).catch(() => {});
  }, [token]);
  const [weightLogs, setWeightLogs]   = useState<WeightLog[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput]     = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving]           = useState(false);
  const [weightError, setWeightError] = useState('');

  const [measurements, setMeasurements]     = useState<BodyMeasurement[]>([]);
  const [measureDate, setMeasureDate]       = useState(new Date().toISOString().split('T')[0]);
  const [measureInputs, setMeasureInputs]   = useState<Record<string, string>>({ chest: '', waist: '', hips: '', arms: '' });
  const [measureSaving, setMeasureSaving]   = useState(false);
  const [measureError, setMeasureError]     = useState('');
  const [pdfLoading, setPdfLoading]         = useState(false);
  const [openCards, setOpenCards]           = useState<Set<string>>(new Set(['goal', 'prs', 'bmi', 'muscles', 'activity', 'weight', 'measurements', 'history']));
  const [historyEditing, setHistoryEditing] = useState(false);
  const [deletingIds, setDeletingIds]       = useState<Set<number>>(new Set());

  // Weekly goal
  const goalKey = `ironbuddy_weekly_goal_${userId}`;
  const [weeklyGoal, setWeeklyGoal] = useState<number>(() => parseInt(localStorage.getItem(goalKey) ?? '4', 10));
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const saveGoal = (val: number) => {
    const v = Math.max(1, Math.min(14, val));
    setWeeklyGoal(v);
    localStorage.setItem(goalKey, String(v));
    setEditingGoal(false);
  };

  // PRs
  const [prs, setPrs] = useState<Record<string, PR>>({});
  useEffect(() => { setPrs(getPRs(userId)); }, [userId]);

  // Muscle data
  const [muscleData, setMuscleData] = useState<Record<string, string>>({});
  useEffect(() => { setMuscleData(getMuscleData(userId)); }, [userId]);
  const toggleCard = (key: string) => setOpenCards(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  useEffect(() => {
    apiGetWeightLogs(token).then(setWeightLogs).catch(() => {});
    apiGetBodyMeasurements(token).then(setMeasurements).catch(() => {});
  }, [token]);

  const finished   = sessions.filter((s) => s.finished_at);
  const totalMins  = finished.reduce((s, x) => s + (x.duration_min ?? 0), 0);
  const curStreak  = calcCurrentStreak(sessions);
  const bestStreak = calcBestStreak(sessions);
  const weeklyData = buildWeeklyData(sessions);

  // This week's workout count
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
  const thisWeekDone = finished.filter(s => new Date(s.finished_at!) >= weekStart).length;

  // BMI
  const latestWeightForBmi = weightLogs.length ? weightLogs[weightLogs.length - 1].weight : (currentWeight ?? null);
  const bmi = latestWeightForBmi && height ? +(latestWeightForBmi / ((height / 100) ** 2)).toFixed(1) : null;
  const bmiCategory = bmi === null ? '' : bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
  const bmiColor    = bmi === null ? '' : bmi < 18.5 ? '#60a5fa' : bmi < 25 ? '#4ade80' : bmi < 30 ? '#fde047' : '#f87171';

  // PRs sorted by date
  const prList = Object.entries(prs).sort((a, b) => b[1].date.localeCompare(a[1].date));

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

  const handleAddMeasurement = async () => {
    const data: Omit<BodyMeasurement, 'id'> = { logged_at: measureDate };
    let hasAny = false;
    for (const f of MEASURE_FIELDS) {
      const v = parseFloat(measureInputs[f.key] || '');
      if (!isNaN(v) && v > 0) { (data as Record<string, unknown>)[f.key] = v; hasAny = true; }
    }
    if (!hasAny) { setMeasureError('Enter at least one measurement.'); return; }
    setMeasureSaving(true); setMeasureError('');
    try {
      const saved = await apiAddBodyMeasurement(token, data);
      setMeasurements((prev) => {
        const filtered = prev.filter((m) => m.logged_at !== saved.logged_at);
        return [...filtered, saved].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
      });
      setMeasureInputs({ chest: '', waist: '', hips: '', arms: '' });
    } catch (e) {
      setMeasureError(e instanceof Error ? e.message : 'Failed to save');
    } finally { setMeasureSaving(false); }
  };

  const handleDeleteMeasurement = async (id: number) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
    try { await apiDeleteBodyMeasurement(token, id); } catch {
      apiGetBodyMeasurements(token).then(setMeasurements).catch(() => {});
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

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210, margin = 16;
      let y = margin;

      const gold  = [253, 224, 71]  as [number, number, number];
      const white = [255, 255, 255] as [number, number, number];
      const grey  = [120, 120, 140] as [number, number, number];
      const dark  = [10, 10, 20]    as [number, number, number];

      // background
      pdf.setFillColor(...dark);
      pdf.rect(0, 0, W, 297, 'F');

      // header
      pdf.setFontSize(22);
      pdf.setTextColor(...gold);
      pdf.setFont('helvetica', 'bold');
      pdf.text('IRONBUDDY', margin, y + 7);
      pdf.setFontSize(10);
      pdf.setTextColor(...grey);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Progress Report  ·  ' + new Date().toLocaleDateString(), margin, y + 14);
      y += 24;

      // divider
      pdf.setDrawColor(...gold);
      pdf.setLineWidth(0.4);
      pdf.line(margin, y, W - margin, y);
      y += 8;

      // stat chips
      const stats = [
        ['Workouts Completed', String(finished.length)],
        ['Total Training Time', totalMins >= 60 ? `${Math.floor(totalMins / 60)}h ${totalMins % 60}m` : `${totalMins}m`],
        ['Current Streak',     `${curStreak} day${curStreak !== 1 ? 's' : ''}`],
        ['Best Streak',        `${bestStreak} day${bestStreak !== 1 ? 's' : ''}`],
        ...(latestWeight ? [['Current Weight', `${latestWeight} kg`]] as [string,string][] : []),
        ...(weightDelta !== null ? [[weightDelta < 0 ? 'Weight Lost' : 'Weight Gained', `${Math.abs(weightDelta)} kg`]] as [string,string][] : []),
      ];

      pdf.setFontSize(9);
      const colW = (W - margin * 2) / 2;
      stats.forEach(([label, value], i) => {
        const cx = margin + (i % 2) * colW;
        const cy = y + Math.floor(i / 2) * 14;
        pdf.setFillColor(255, 255, 255, 8);
        pdf.setFillColor(30, 30, 50);
        pdf.roundedRect(cx, cy, colW - 4, 12, 2, 2, 'F');
        pdf.setTextColor(...grey);
        pdf.setFont('helvetica', 'normal');
        pdf.text(label.toUpperCase(), cx + 3, cy + 4.5);
        pdf.setTextColor(...gold);
        pdf.setFont('helvetica', 'bold');
        pdf.text(value, cx + 3, cy + 9.5);
      });
      y += Math.ceil(stats.length / 2) * 14 + 8;

      // divider
      pdf.setDrawColor(40, 40, 60);
      pdf.setLineWidth(0.3);
      pdf.line(margin, y, W - margin, y);
      y += 8;

      // weight history
      if (weightLogs.length > 0) {
        pdf.setFontSize(11);
        pdf.setTextColor(...gold);
        pdf.setFont('helvetica', 'bold');
        pdf.text('WEIGHT HISTORY', margin, y);
        y += 7;
        pdf.setFontSize(8);
        weightLogs.slice(-20).forEach((l) => {
          if (y > 275) { pdf.addPage(); pdf.setFillColor(...dark); pdf.rect(0, 0, W, 297, 'F'); y = margin; }
          pdf.setTextColor(...grey);
          pdf.setFont('helvetica', 'normal');
          pdf.text(l.logged_at, margin, y);
          pdf.setTextColor(...white);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${l.weight} kg`, margin + 40, y);
          y += 5.5;
        });
        y += 4;
      }

      // body measurements
      if (measurements.length > 0) {
        if (y > 250) { pdf.addPage(); pdf.setFillColor(...dark); pdf.rect(0, 0, W, 297, 'F'); y = margin; }
        pdf.setFontSize(11);
        pdf.setTextColor(...gold);
        pdf.setFont('helvetica', 'bold');
        pdf.text('BODY MEASUREMENTS (cm)', margin, y);
        y += 7;
        pdf.setFontSize(8);
        measurements.slice(-20).forEach((m) => {
          if (y > 275) { pdf.addPage(); pdf.setFillColor(...dark); pdf.rect(0, 0, W, 297, 'F'); y = margin; }
          const parts = MEASURE_FIELDS
            .filter((f) => m[f.key] != null)
            .map((f) => `${f.label}: ${m[f.key]}`)
            .join('   ');
          pdf.setTextColor(...grey);
          pdf.setFont('helvetica', 'normal');
          pdf.text(m.logged_at, margin, y);
          pdf.setTextColor(...white);
          pdf.text(parts, margin + 40, y);
          y += 5.5;
        });
        y += 4;
      }

      // recent workouts
      if (finished.length > 0) {
        if (y > 250) { pdf.addPage(); pdf.setFillColor(...dark); pdf.rect(0, 0, W, 297, 'F'); y = margin; }
        pdf.setFontSize(11);
        pdf.setTextColor(...gold);
        pdf.setFont('helvetica', 'bold');
        pdf.text('RECENT WORKOUTS', margin, y);
        y += 7;
        pdf.setFontSize(8);
        [...finished]
          .sort((a, b) => new Date(b.finished_at!).getTime() - new Date(a.finished_at!).getTime())
          .slice(0, 20)
          .forEach((s) => {
            if (y > 275) { pdf.addPage(); pdf.setFillColor(...dark); pdf.rect(0, 0, W, 297, 'F'); y = margin; }
            const date = new Date(s.finished_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            pdf.setTextColor(...grey);
            pdf.setFont('helvetica', 'normal');
            pdf.text(date, margin, y);
            pdf.setTextColor(...white);
            pdf.setFont('helvetica', 'bold');
            pdf.text(s.workout_name, margin + 28, y);
            if (s.duration_min) {
              pdf.setTextColor(...gold);
              pdf.setFont('helvetica', 'normal');
              pdf.text(`${s.duration_min} min`, W - margin - 20, y);
            }
            y += 5.5;
          });
      }

      // footer
      pdf.setFontSize(7);
      pdf.setTextColor(...grey);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Generated by IronBuddy', margin, 291);

      pdf.save('ironbuddy-progress.pdf');
    } catch (err) {
      console.error('PDF error:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full overflow-x-hidden">

      {/* ── Action links ── */}
      <div className="flex justify-end gap-5">
        <button
          onClick={() => {
            const text = [
              '🦾 My IronBuddy Progress',
              `Workouts completed: ${finished.length}`,
              totalMins >= 60 ? `⏱ Total time: ${Math.floor(totalMins/60)}h ${totalMins%60}m` : `⏱ Total time: ${totalMins}m`,
              `Current streak: ${curStreak} day${curStreak !== 1 ? 's' : ''}`,
              ` Best streak: ${bestStreak} day${bestStreak !== 1 ? 's' : ''}`,
              latestWeight ? `Current weight: ${latestWeight} kg` : '',
              weightDelta !== null ? ` Change: ${weightDelta > 0 ? '+' : ''}${weightDelta} kg` : '',
            ].filter(Boolean).join('\n');
            if (navigator.share) {
              navigator.share({ title: 'My IronBuddy Progress', text }).catch(() => {});
            } else {
              navigator.clipboard.writeText(text).then(() => alert('Progress copied to clipboard!')).catch(() => {});
            }
          }}
          className="font-black text-xs border-none outline-none bg-transparent active:scale-95 transition-colors"
          style={{ color: 'rgba(156,163,175,0.6)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.cssText = 'color:#facc15;text-shadow:0 0 10px rgba(250,204,21,0.7),0 0 20px rgba(250,204,21,0.4)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.cssText = 'color:rgba(156,163,175,0.6)'; }}
        >
          <FontAwesomeIcon icon={faArrowUpFromBracket} /> Share Progress
        </button>
        <button
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          className="font-black text-xs border-none outline-none bg-transparent active:scale-95 transition-colors disabled:opacity-40"
          style={{ color: 'rgba(156,163,175,0.6)' }}
          onMouseEnter={e => { if (!pdfLoading) (e.currentTarget as HTMLButtonElement).style.cssText = 'color:#facc15;text-shadow:0 0 10px rgba(250,204,21,0.7),0 0 20px rgba(250,204,21,0.4)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.cssText = 'color:rgba(156,163,175,0.6)'; }}
        >
          {pdfLoading ? 'Generating...' : <><FontAwesomeIcon icon={faDownload} /> Download Progress</>}
        </button>
      </div>

      {/* ── Stat chips ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <FontAwesomeIcon icon={faDumbbell} />, label: 'Workouts', value: String(finished.length) },
          { icon: <FontAwesomeIcon icon={faClock} />, label: 'Total Time', value: totalMins >= 60 ? `${Math.floor(totalMins / 60)}h ${totalMins % 60}m` : `${totalMins}m` },
          { icon: <FontAwesomeIcon icon={faFire} />, label: 'Current Streak', value: `${curStreak} day${curStreak !== 1 ? 's' : ''}` },
          { icon: <FontAwesomeIcon icon={faTrophy} />, label: 'Best Streak', value: `${bestStreak} day${bestStreak !== 1 ? 's' : ''}` },
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

      {/* ── Weekly Goal ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
        <button onClick={() => toggleCard('goal')} className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors">
          <div className="text-left">
            <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Goal</p>
            <h2 className="text-lg font-black uppercase italic mt-0.5" style={{ color: theme === 'light' ? '#111827' : '#f9fafb' }}><FontAwesomeIcon icon={faBullseye} /> Weekly Goal</h2>
          </div>
          <span className="text-gray-500 text-lg transition-transform duration-300" style={{ display: 'inline-block', transform: openCards.has('goal') ? 'rotate(0deg)' : 'rotate(-90deg)' }}><FontAwesomeIcon icon={faAnglesDown} /></span>
        </button>
        <AnimatePresence initial={false}>
          {openCards.has('goal') && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden px-6 pb-6">
              <div className="flex items-center gap-6 flex-wrap">
                <GoalRing done={thisWeekDone} goal={weeklyGoal} theme={theme} />
                <div className="flex-1 min-w-[160px] space-y-3">
                  <div>
                    <p className="text-white font-black text-2xl">{thisWeekDone}<span className="text-gray-500 text-base font-bold"> / {weeklyGoal}</span></p>
                    <p className="text-gray-400 text-xs mt-0.5">workouts this week</p>
                    {thisWeekDone >= weeklyGoal && <p className="text-green-400 text-xs font-black mt-1"> <FontAwesomeIcon icon={faThumbsUp} />Goal reached!</p>}
                  </div>
                  {editingGoal ? (
                    <div className="flex gap-2 items-center">
                      <input
                        type="number" min={1} max={14} value={goalDraft}
                        onChange={e => setGoalDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveGoal(parseInt(goalDraft)); if (e.key === 'Escape') setEditingGoal(false); }}
                        className="w-16 rounded-lg px-2 py-1 text-sm text-center focus:outline-none"
                        style={{ background: theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)', border: theme === 'light' ? '1px solid rgba(0,0,0,0.15)' : '1px solid rgba(255,255,255,0.1)', color: theme === 'light' ? '#111827' : '#ffffff' }}
                        autoFocus
                      />
                      <button onClick={() => saveGoal(parseInt(goalDraft))} className="text-xs font-black" style={{ color: theme === 'light' ? '#ea580c' : '#fde047' }}>Save</button>
                      <button onClick={() => setEditingGoal(false)} className="text-xs" style={{ color: theme === 'light' ? '#6b7280' : '#6b7280' }}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setGoalDraft(String(weeklyGoal)); setEditingGoal(true); }}
                      className="text-xs font-black border-none outline-none bg-transparent"
                      style={{ color: theme === 'light' ? 'rgba(107,114,128,0.9)' : 'rgba(156,163,175,0.6)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.cssText = theme === 'light' ? 'color:#ea580c;text-shadow:0 0 8px rgba(234,88,12,0.4)' : 'color:#facc15;text-shadow:0 0 10px rgba(250,204,21,0.7)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.cssText = theme === 'light' ? 'color:rgba(107,114,128,0.9)' : 'color:rgba(156,163,175,0.6)'; }}
                    >✎ Change goal</button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Personal Records ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
        <button onClick={() => toggleCard('prs')} className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors">
          <div className="text-left">
            <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Strength</p>
            <h2 className="text-lg font-black uppercase italic mt-0.5"><FontAwesomeIcon icon={faTrophy} /> Personal Records</h2>
          </div>
          <span className="text-gray-500 text-lg transition-transform duration-300" style={{ display: 'inline-block', transform: openCards.has('prs') ? 'rotate(0deg)' : 'rotate(-90deg)' }}>⌄</span>
        </button>
        <AnimatePresence initial={false}>
          {openCards.has('prs') && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden px-6 pb-6">
              {prList.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No PRs yet. Log sets with weight and reps to track your records.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {prList.map(([name, pr]) => {
                    const isToday = new Date(pr.date).toDateString() === new Date().toDateString();
                    return (
                      <div key={name} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/3 border border-white/5 hover:border-yellow-300/15 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-bold truncate">{name}</p>
                          <p className="text-gray-500 text-[10px]">{new Date(pr.date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {isToday && <span className="text-[9px] font-black bg-yellow-300/15 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-300/30">NEW PR</span>}
                          <span className="text-[--color-iron-gold] font-black text-sm">{pr.weight}kg × {pr.reps}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── BMI Card ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.095 }}
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
        <button onClick={() => toggleCard('bmi')} className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors">
          <div className="text-left">
            <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Body</p>
            <h2 className="text-lg font-black uppercase italic mt-0.5"><FontAwesomeIcon icon={faGauge} /> BMI & Body Stats</h2>
          </div>
          <span className="text-gray-500 text-lg transition-transform duration-300" style={{ display: 'inline-block', transform: openCards.has('bmi') ? 'rotate(0deg)' : 'rotate(-90deg)' }}>⌄</span>
        </button>
        <AnimatePresence initial={false}>
          {openCards.has('bmi') && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden px-6 pb-6 space-y-4">
              {!bmi ? (
                <p className="text-gray-500 text-sm text-center py-4">Add your height in your profile and log your weight to see BMI.</p>
              ) : (
                <>
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="text-center">
                      <p className="text-5xl font-black" style={{ color: bmiColor }}>{bmi}</p>
                      <p className="text-xs font-black uppercase tracking-widest mt-1" style={{ color: bmiColor }}>{bmiCategory}</p>
                    </div>
                    <div className="flex-1 space-y-2 min-w-[160px]">
                      {latestWeightForBmi && <div className="flex justify-between text-sm"><span className="text-gray-400">Weight</span><span className="text-white font-black">{latestWeightForBmi} kg</span></div>}
                      {height && <div className="flex justify-between text-sm"><span className="text-gray-400">Height</span><span className="text-white font-black">{height} cm</span></div>}
                    </div>
                  </div>
                  {/* BMI scale bar */}
                  <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #60a5fa 0%, #4ade80 27%, #fde047 55%, #f87171 100%)' }}>
                    <div className="absolute top-0 w-1 h-full bg-white rounded-full shadow-lg" style={{ left: `${Math.min(Math.max((bmi - 15) / 25, 0), 1) * 100}%`, transform: 'translateX(-50%)' }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-500 font-bold">
                    <span>15 Underweight</span><span>18.5</span><span>25 Overweight</span><span>30 Obese</span><span>40</span>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Muscle Heatmap ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
        <button onClick={() => toggleCard('muscles')} className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors">
          <div className="text-left">
            <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Recovery</p>
            <h2 className="text-lg font-black uppercase italic mt-0.5"><FontAwesomeIcon icon={faFire} /> Muscle Heatmap</h2>
          </div>
          <span className="text-gray-500 text-lg transition-transform duration-300" style={{ display: 'inline-block', transform: openCards.has('muscles') ? 'rotate(0deg)' : 'rotate(-90deg)' }}>⌄</span>
        </button>
        <AnimatePresence initial={false}>
          {openCards.has('muscles') && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden px-6 pb-6">
              {Object.keys(muscleData).length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">Complete sets to see which muscles you've been training.</p>
              ) : (
                <MuscleHeatmap muscleData={muscleData} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Weekly workouts circle ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden"
      >
        <button
          onClick={() => toggleCard('activity')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
        >
          <div className="text-left">
            <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Activity</p>
            <h2 className="text-lg font-black uppercase italic mt-0.5"><FontAwesomeIcon icon={faCalendarDays} /> Workouts per Week</h2>
          </div>
          <span className="text-gray-500 text-lg transition-transform duration-300" style={{ display: 'inline-block', transform: openCards.has('activity') ? 'rotate(0deg)' : 'rotate(-90deg)' }}>⌄</span>
        </button>
        <AnimatePresence initial={false}>
          {openCards.has('activity') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden px-6 pb-6"
            >
              {finished.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">Complete your first workout to see your activity chart.</p>
              ) : (
                <ActivityCircle data={weeklyData} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Weight tracker ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden"
      >
        <button
          onClick={() => toggleCard('weight')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
        >
          <div className="text-left">
            <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Body</p>
            <h2 className="text-lg font-black uppercase italic mt-0.5"><FontAwesomeIcon icon={faWeightHanging} /> Weight Tracker</h2>
          </div>
          <div className="flex items-center gap-3">
            {weightDelta !== null && (
              <div className={`px-3 py-1.5 rounded-xl text-sm font-black border ${
                weightDelta < 0
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : weightDelta > 0
                    ? 'bg-red-400/10 border-red-400/30 text-red-400'
                    : 'bg-white/5 border-white/10 text-gray-400'
              }`}>
                {weightDelta > 0 ? '+' : ''}{weightDelta} kg
              </div>
            )}
            <span className="text-gray-500 text-lg transition-transform duration-300" style={{ display: 'inline-block', transform: openCards.has('weight') ? 'rotate(0deg)' : 'rotate(-90deg)' }}>⌄</span>
          </div>
        </button>
        <AnimatePresence initial={false}>
          {openCards.has('weight') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden px-6 pb-6 space-y-5"
            >

        {/* Log form */}
        <div className="flex gap-2 flex-wrap">
          <input
            type="number"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder="Weight (kg)"
            step="0.1"
            className="flex-1 min-w-[120px] rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all"
            style={{
              background: theme === 'light' ? '#fff' : 'rgba(255,255,255,0.05)',
              border: theme === 'light' ? '1px solid rgba(0,0,0,0.15)' : '1px solid rgba(255,255,255,0.1)',
              color: theme === 'light' ? '#111' : '#fff',
            }}
          />
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all"
            style={{
              background: theme === 'light' ? '#fff' : 'rgba(255,255,255,0.05)',
              border: theme === 'light' ? '1px solid rgba(0,0,0,0.15)' : '1px solid rgba(255,255,255,0.1)',
              color: theme === 'light' ? '#111' : '#fff',
            }}
          />
          <button
            onClick={handleAddWeight}
            disabled={saving || !weightInput}
            className="px-3 py-2 sm:px-5 sm:py-2.5 bg-yellow-300 text-black font-black rounded-xl uppercase text-xs sm:text-sm
              hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? '…' : 'Log'}
          </button>
        </div>
        <p className="text-gray-600 text-xs">One entry per day — logging the same date again updates that day's value.</p>
        {weightError && <p className="text-red-400 text-xs">{weightError}</p>}

        {/* Chart */}
        {weightChartData.length < 2 ? (
          <p className="text-gray-500 text-sm text-center py-6">
            {weightChartData.length === 0
              ? 'Log your weight to start tracking your progress.'
              : 'Add one more entry to see your weight trend.'}
          </p>
        ) : (
          <ResponsiveContainer width="99%" height={200}>
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
                stroke={theme === 'light' ? '#d97706' : '#fde047'}
                strokeWidth={2.5}
                dot={{ fill: theme === 'light' ? '#d97706' : '#fde047', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: theme === 'light' ? '#d97706' : '#fde047', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Log history */}
        {weightLogs.length > 0 && (
          <div className="pt-4 space-y-2 max-h-48 overflow-y-auto" style={{ borderTop: theme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-[10px] uppercase font-black tracking-widest mb-3" style={{ color: theme === 'light' ? '#888' : 'rgba(107,114,128,1)' }}>Log history</p>
            <AnimatePresence>
              {[...weightLogs].reverse().map((l) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center justify-between text-sm px-3 py-1.5 rounded-lg"
                  style={{
                    background: theme === 'light' ? 'rgba(217,119,6,0.06)' : 'rgba(250,204,21,0.05)',
                    border: theme === 'light' ? '1px solid rgba(217,119,6,0.15)' : '1px solid rgba(250,204,21,0.1)',
                  }}
                >
                  <span style={{ color: theme === 'light' ? '#666' : 'rgba(253,230,138,0.7)' }}>{l.logged_at}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-black" style={{ color: theme === 'light' ? '#d97706' : 'rgba(253,224,71,1)' }}>{l.weight} kg</span>
                    <button
                      onClick={() => handleDeleteWeight(l.id)}
                      className="text-xs transition-colors hover:text-red-400"
                      style={{ color: theme === 'light' ? '#aaa' : 'rgba(75,85,99,1)' }}
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
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Body measurements ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden"
      >
        <button
          onClick={() => toggleCard('measurements')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
        >
          <div className="text-left">
            <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Body</p>
            <h2 className="text-lg font-black uppercase italic mt-0.5"><FontAwesomeIcon icon={faRuler} /> Body Measurements</h2>
          </div>
          <span className="text-gray-500 text-lg transition-transform duration-300" style={{ display: 'inline-block', transform: openCards.has('measurements') ? 'rotate(0deg)' : 'rotate(-90deg)' }}>⌄</span>
        </button>
        <AnimatePresence initial={false}>
          {openCards.has('measurements') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden px-6 pb-6 space-y-5"
            >

        {/* Log form */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {MEASURE_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: f.color }}>{f.label} (cm)</label>
              <input
                type="number"
                value={measureInputs[f.key]}
                onChange={(e) => setMeasureInputs((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder="—"
                step="0.1"
                className="rounded-xl px-3 py-2 text-sm focus:outline-none transition-all"
                style={{
                  background: theme === 'light' ? '#fff' : 'rgba(255,255,255,0.05)',
                  border: theme === 'light' ? '1px solid rgba(0,0,0,0.15)' : '1px solid rgba(255,255,255,0.1)',
                  color: theme === 'light' ? '#111' : '#fff',
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="date"
            value={measureDate}
            onChange={(e) => setMeasureDate(e.target.value)}
            className="rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all"
            style={{
              background: theme === 'light' ? '#fff' : 'rgba(255,255,255,0.05)',
              border: theme === 'light' ? '1px solid rgba(0,0,0,0.15)' : '1px solid rgba(255,255,255,0.1)',
              color: theme === 'light' ? '#111' : '#fff',
            }}
          />
          <button
            onClick={handleAddMeasurement}
            disabled={measureSaving}
            className="px-3 py-2 sm:px-5 sm:py-2.5 bg-yellow-300 text-black font-black rounded-xl uppercase text-xs sm:text-sm
              hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
          >
            {measureSaving ? '…' : 'Log'}
          </button>
        </div>
        {measureError && <p className="text-red-400 text-xs">{measureError}</p>}

        {/* Chart */}
        {measurements.length >= 2 && (
          <ResponsiveContainer width="99%" height={200}>
            <LineChart data={measurements.map((m) => ({
              date:  m.logged_at.slice(5),
              chest: m.chest ?? undefined,
              waist: m.waist ?? undefined,
              hips:  m.hips  ?? undefined,
              arms:  m.arms  ?? undefined,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<MeasureTooltip />} />
              {MEASURE_FIELDS.map((f) => (
                <Line key={f.key} type="monotone" dataKey={f.key} name={f.label} stroke={f.color} strokeWidth={2} dot={{ fill: f.color, r: 3, strokeWidth: 0 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Log history */}
        {measurements.length > 0 && (
          <div className="pt-4 space-y-2 max-h-40 overflow-y-auto" style={{ borderTop: theme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-[10px] uppercase font-black tracking-widest mb-3" style={{ color: theme === 'light' ? '#888' : 'rgba(107,114,128,1)' }}>Log history</p>
            <AnimatePresence>
              {[...measurements].reverse().map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center justify-between text-xs"
                >
                  <span style={{ color: theme === 'light' ? '#666' : 'rgba(156,163,175,1)' }}>{m.logged_at}</span>
                  <div className="flex items-center gap-3">
                    {MEASURE_FIELDS.filter((f) => m[f.key] != null).map((f) => (
                      <span key={f.key} style={{ color: f.color }} className="font-bold">{f.label[0]}: {m[f.key]}cm</span>
                    ))}
                    <button onClick={() => handleDeleteMeasurement(m.id)} className="transition-colors hover:text-red-400" style={{ color: theme === 'light' ? '#aaa' : 'rgba(75,85,99,1)' }}>✕</button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Session history ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <button onClick={() => toggleCard('history')} className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity">
            <div>
              <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">History</p>
              <h2 className="text-lg font-black uppercase italic mt-0.5"><FontAwesomeIcon icon={faCalendarDays} /> Recent Workouts</h2>
            </div>
          </button>
          <div className="flex items-center gap-4">
            {finished.length > 0 && (
              <button
                onClick={() => setHistoryEditing(e => !e)}
                className="text-xs font-black border-none outline-none bg-transparent transition-colors"
                style={{ color: historyEditing ? '#facc15' : 'rgba(156,163,175,0.6)',
                  textShadow: historyEditing ? '0 0 10px rgba(250,204,21,0.7)' : 'none' }}
              >
                {historyEditing ? 'Done' : 'Edit'}
              </button>
            )}
            <span className="text-gray-500 text-lg transition-transform duration-300" style={{ display: 'inline-block', transform: openCards.has('history') ? 'rotate(0deg)' : 'rotate(-90deg)', cursor: 'pointer' }}
              onClick={() => toggleCard('history')}>⌄</span>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {openCards.has('history') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden px-6 pb-6"
            >
              {finished.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No completed workouts yet. Start one from the Workouts tab!</p>
              ) : (
                <div className="space-y-1">
                  <AnimatePresence>
                    {[...finished]
                      .sort((a, b) => new Date(b.finished_at!).getTime() - new Date(a.finished_at!).getTime())
                      .map((s) => {
                        const date = new Date(s.finished_at!);
                        const dur  = s.duration_min ? `${s.duration_min} min` : '—';
                        const isAI = s.workout_type === 'ai';
                        const isDeleting = deletingIds.has(s.id);
                        return (
                          <motion.div
                            key={s.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 24, height: 0, marginBottom: 0 }}
                            transition={{ duration: 0.2 }}
                            className="py-2.5 px-3 rounded-xl hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <AnimatePresence mode="wait">
                                {historyEditing ? (
                                  <motion.button
                                    key="del"
                                    initial={{ opacity: 0, scale: 0.7 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.7 }}
                                    transition={{ duration: 0.15 }}
                                    disabled={isDeleting}
                                    onClick={async () => {
                                      setDeletingIds(p => new Set(p).add(s.id));
                                      try {
                                        await apiDeleteSession(token, s.id);
                                        onDeleteSession?.(s.id);
                                      } catch {
                                        setDeletingIds(p => { const n = new Set(p); n.delete(s.id); return n; });
                                      }
                                    }}
                                    className="w-5 h-5 rounded-full bg-red-500/20 border border-red-400/40 flex items-center justify-center text-red-400 text-xs font-black shrink-0 hover:bg-red-500/40 transition-colors disabled:opacity-40"
                                  >
                                    {isDeleting ? '…' : '−'}
                                  </motion.button>
                                ) : (
                                  <motion.span
                                    key="icon"
                                    initial={{ opacity: 0, scale: 0.7 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.7 }}
                                    transition={{ duration: 0.15 }}
                                    className="text-lg shrink-0"
                                  >
                                    {isAI ? '🤖' : <span style={{ color: '#facc15', fontSize: '1.1rem' }}>✎</span>}
                                  </motion.span>
                                )}
                              </AnimatePresence>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-bold truncate">{s.workout_name}</p>
                                <p className="text-gray-500 text-xs">{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                              </div>
                              <span className="text-[--color-iron-gold] text-xs font-black shrink-0">{dur}</span>
                            </div>
                            {s.notes && (
                              <p className="text-gray-400 text-xs mt-1.5 ml-8 italic leading-relaxed">"{s.notes}"</p>
                            )}
                          </motion.div>
                        );
                      })}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Achievements / Badges ── */}
      {achievements && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden"
        >
          <button
            onClick={() => setAchievementsOpen(o => !o)}
            className="w-full flex items-center justify-between p-5 text-left"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <span className="text-sm font-black uppercase tracking-widest text-[--color-iron-gold]">
              {t('achievements.title', 'Achievements')}
              <span className="ml-2 text-xs font-normal text-gray-400 normal-case tracking-normal">
                {achievements.earned_ids.length} / {achievements.all_badges.length}
              </span>
            </span>
            <span style={{ color: theme === 'light' ? '#d97706' : '#fbbf24', fontSize: 12, transition: 'transform 0.2s', display: 'inline-block', transform: achievementsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
          </button>

          <AnimatePresence initial={false}>
          {achievementsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: 'hidden' }}
            >
          <div className="px-5 pb-5 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {achievements.all_badges.map((badge: BadgeMeta) => {
              const earned = achievements.earned_ids.includes(badge.id);
              return (
                <div
                  key={badge.id}
                  title={t(badge.title_key, badge.id) + (earned ? '' : ' (locked)')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    opacity: earned ? 1 : 0.3,
                    filter: earned ? 'none' : 'grayscale(1)',
                    cursor: 'default',
                  }}
                >
                  <div style={{
                    fontSize: 32,
                    lineHeight: 1,
                    background: earned
                      ? theme === 'light' ? 'rgba(217,119,6,0.12)' : 'rgba(251,191,36,0.12)'
                      : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${earned
                      ? theme === 'light' ? '#d97706' : '#fbbf24'
                      : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 12,
                    padding: '8px 10px',
                  }}>
                    {badge.icon}
                  </div>
                  <span style={{
                    fontSize: 9,
                    textAlign: 'center',
                    color: earned
                      ? theme === 'light' ? '#d97706' : '#fbbf24'
                      : theme === 'light' ? '#999' : '#555',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    maxWidth: 64,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {t(badge.title_key, badge.id)}
                  </span>
                </div>
              );
            })}
          </div>
            </motion.div>
          )}
          </AnimatePresence>
        </motion.div>
      )}

    </div>
  );
}
