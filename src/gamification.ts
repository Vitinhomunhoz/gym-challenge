// ---------- Tipos ----------
export type SetEntry = { reps: number; weight: number };
export type Exercise = { name: string; sets: SetEntry[] };
export type Workout = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  exercises: Exercise[];
  volume: number; // kg total (reps * carga)
  xp: number;
};

export type Checkin = { date: string; photoUri: string; ts: number };

export type Challenge = {
  id: string;
  label: string;
  target: number;
  unit: 'kg' | 'exercícios' | 'séries';
  xp: number;
  progress: (workouts: Workout[]) => number; // progresso no dia
};

// ---------- Datas ----------
export const todayKey = () => toKey(new Date());
export const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------- XP / Nível ----------
// Nível cresce de forma quadrática: nível N exige 150*N² XP acumulado.
export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(xp / 150)) + 1;
export const xpForLevel = (level: number) => 150 * (level - 1) ** 2;
export const levelTitle = (level: number) => {
  if (level >= 20) return 'Mestre de Ferro';
  if (level >= 12) return 'Veterano';
  if (level >= 7) return 'Intermediário';
  if (level >= 3) return 'Aprendiz';
  return 'Iniciante';
};

export const workoutXp = (volume: number, exercises: number) =>
  50 + exercises * 10 + Math.min(150, Math.round(volume / 100)); // teto evita farm de XP

// ---------- Streak ----------
export function computeStreak(workouts: Workout[]): number {
  const days = new Set(workouts.map((w) => w.date));
  let streak = 0;
  const cursor = new Date();
  if (!days.has(toKey(cursor))) cursor.setDate(cursor.getDate() - 1); // hoje ainda conta se treinou ontem
  while (days.has(toKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ---------- PRs (recorde de carga por exercício) ----------
export function computePRs(workouts: Workout[]): { name: string; weight: number }[] {
  const prs = new Map<string, number>();
  for (const w of workouts)
    for (const ex of w.exercises)
      for (const s of ex.sets) {
        const key = ex.name.trim().toLowerCase();
        if (s.weight > (prs.get(key) ?? 0)) prs.set(key, s.weight);
      }
  return [...prs.entries()]
    .map(([name, weight]) => ({ name: name.replace(/\b\w/g, (c) => c.toUpperCase()), weight }))
    .sort((a, b) => b.weight - a.weight);
}

// ---------- Badges ----------
// icon: nome de ícone do Ionicons (@expo/vector-icons), não emoji — renderizado em
// DashboardScreen via <Ionicons name={badge.icon} />.
export type Badge = { id: string; icon: string; name: string; desc: string; unlocked: boolean };

export function computeBadges(workouts: Workout[], streak: number, xp: number): Badge[] {
  const totalVolume = workouts.reduce((a, w) => a + w.volume, 0);
  const maxWeight = Math.max(0, ...workouts.flatMap((w) => w.exercises.flatMap((e) => e.sets.map((s) => s.weight))));
  return [
    { id: 'first', icon: 'footsteps', name: 'Primeiro Passo', desc: 'Registre seu 1º treino', unlocked: workouts.length >= 1 },
    { id: 'ten', icon: 'calendar', name: 'Frequente', desc: 'Complete 10 treinos', unlocked: workouts.length >= 10 },
    { id: 'streak7', icon: 'flame', name: 'Semana de Fogo', desc: 'Streak de 7 dias', unlocked: streak >= 7 },
    { id: 'club100', icon: 'barbell', name: 'Clube dos 100kg', desc: 'Série com 100kg ou mais', unlocked: maxWeight >= 100 },
    { id: 'ton', icon: 'cube', name: 'Uma Tonelada', desc: '10.000 kg de volume total', unlocked: totalVolume >= 10000 },
    { id: 'lvl5', icon: 'star', name: 'Nível 5', desc: 'Alcance o nível 5', unlocked: levelFromXp(xp) >= 5 },
  ];
}

// ---------- Desafios diários (determinísticos pela data) ----------
const POOL: Omit<Challenge, 'id'>[] = [
  { label: 'Levante 3.000 kg de volume', target: 3000, unit: 'kg', xp: 80, progress: (ws) => ws.reduce((a, w) => a + w.volume, 0) },
  { label: 'Complete 5 exercícios', target: 5, unit: 'exercícios', xp: 60, progress: (ws) => ws.reduce((a, w) => a + w.exercises.length, 0) },
  { label: 'Faça 15 séries', target: 15, unit: 'séries', xp: 70, progress: (ws) => ws.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.length, 0), 0) },
  { label: 'Levante 5.000 kg de volume', target: 5000, unit: 'kg', xp: 120, progress: (ws) => ws.reduce((a, w) => a + w.volume, 0) },
  { label: 'Complete 8 exercícios', target: 8, unit: 'exercícios', xp: 100, progress: (ws) => ws.reduce((a, w) => a + w.exercises.length, 0) },
  { label: 'Faça 20 séries', target: 20, unit: 'séries', xp: 110, progress: (ws) => ws.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.length, 0), 0) },
];

export function dailyChallenges(dateKey: string): Challenge[] {
  // seed simples pela data → mesmos desafios o dia todo, diferentes a cada dia
  let seed = [...dateKey].reduce((a, c) => a + c.charCodeAt(0), 0);
  const pick = () => POOL[(seed = (seed * 9301 + 49297) % 233280) % POOL.length];
  const a = pick();
  let b = pick();
  while (b === a) b = pick();
  return [a, b].map((c, i) => ({ ...c, id: `${dateKey}-${i}` }));
}
