// ── PR & Muscle tracking helpers (localStorage) ───────────────────────────────

export interface PR {
  weight: number;
  reps: number;
  date: string; // ISO
}

export function getPRs(userId: number): Record<string, PR> {
  try { return JSON.parse(localStorage.getItem(`ironbuddy_prs_${userId}`) ?? '{}'); }
  catch { return {}; }
}

/** Save a PR if it beats the existing record. Returns true if new PR. */
export function savePR(
  userId: number,
  exerciseName: string,
  muscle: string,
  weight: number,
  reps: number,
): boolean {
  if (!weight || !reps || weight <= 0 || reps <= 0) return false;
  const prs = getPRs(userId);
  const existing = prs[exerciseName];
  const isNew = !existing || weight > existing.weight || (weight === existing.weight && reps > existing.reps);
  if (isNew) {
    prs[exerciseName] = { weight, reps, date: new Date().toISOString() };
    localStorage.setItem(`ironbuddy_prs_${userId}`, JSON.stringify(prs));
  }
  saveMuscleTraining(userId, muscle);
  return isNew;
}

// ── Muscle last-trained tracking ──────────────────────────────────────────────

export function getMuscleData(userId: number): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(`ironbuddy_muscles_${userId}`) ?? '{}'); }
  catch { return {}; }
}

export function saveMuscleTraining(userId: number, muscle: string) {
  if (!muscle) return;
  const data = getMuscleData(userId);
  data[muscle.toLowerCase()] = new Date().toISOString();
  localStorage.setItem(`ironbuddy_muscles_${userId}`, JSON.stringify(data));
}
