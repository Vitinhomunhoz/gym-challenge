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

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function addDaysKey(dateKey: string, days: number): string {
  const match = DATE_KEY.exec(dateKey);
  const year = match ? Number(match[1]) : 1970;
  const month = match ? Number(match[2]) : 1;
  const day = match ? Number(match[3]) : 1;
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toKey(date);
}

// Dias de calendário que ainda faltam até o fim do dia `endKey` (no fuso local).
// Constrói a data pelos componentes — `new Date('YYYY-MM-DDTHH:mm:ss')` é lido
// como UTC em alguns navegadores e encerrava o grupo algumas horas mais cedo.
export function daysRemaining(endKey: string, now = Date.now()): number {
  const match = DATE_KEY.exec(endKey);
  if (!match) return 0;
  const end = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999);
  return Math.max(0, Math.ceil((end.getTime() - now) / 86_400_000));
}

export function monthCells(year: number, monthIndex: number): (string | null)[] {
  const first = new Date(year, monthIndex, 1);
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  for (let day = 1; day <= days; day++) cells.push(toKey(new Date(year, monthIndex, day)));
  return cells;
}

// ---------- Números digitados no treino ----------
export function parseReps(raw: string): number {
  const n = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

export function parseWeight(raw: string): number {
  const n = parseFloat(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

// ---------- XP / Nível ----------
// Nível cresce de forma quadrática: nível N exige 150*(N-1)² XP acumulado.
export const levelFromXp = (xp: number) => {
  const safe = Number.isFinite(xp) && xp > 0 ? xp : 0;
  return Math.floor(Math.sqrt(safe / 150)) + 1;
};
export const xpForLevel = (level: number) => 150 * (level - 1) ** 2;
export const levelTitle = (level: number) => {
  if (level >= 20) return 'Mestre de Ferro';
  if (level >= 12) return 'Veterano';
  if (level >= 7) return 'Intermediário';
  if (level >= 3) return 'Aprendiz';
  return 'Iniciante';
};

export const workoutXp = (volume: number, exercises: number) => {
  const vol = Number.isFinite(volume) && volume > 0 ? volume : 0;
  const ex = Number.isFinite(exercises) && exercises > 0 ? exercises : 0;
  // O teto de 150 vale só para o bônus de volume (evita farm); base + exercícios ficam de fora.
  return 50 + ex * 10 + Math.min(150, Math.round(vol / 100));
};

export function claimChallengeReward(
  claimed: string[],
  xp: number,
  challenge: { id: string; xp: number },
): { claimed: string[]; xp: number } {
  if (claimed.includes(challenge.id)) return { claimed, xp };
  const bonus = Number.isFinite(challenge.xp) && challenge.xp > 0 ? challenge.xp : 0;
  return { claimed: [...claimed, challenge.id], xp: xp + bonus };
}

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
// Title case por palavra. `\b\w` não enxerga acento e virava "ElevaçãO" / "TríCeps".
export function titleCaseExercise(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1))
    .join(' ');
}

export function computePRs(workouts: Workout[]): { name: string; weight: number }[] {
  const prs = new Map<string, number>();
  for (const w of workouts)
    for (const ex of w.exercises ?? [])
      for (const s of ex.sets ?? []) {
        const key = ex.name?.trim().toLowerCase();
        if (!key || !Number.isFinite(s.weight) || s.weight <= 0) continue;
        if (s.weight > (prs.get(key) ?? 0)) prs.set(key, s.weight);
      }
  return [...prs.entries()]
    .map(([name, weight]) => ({ name: titleCaseExercise(name), weight }))
    .sort((a, b) => b.weight - a.weight);
}

// ---------- Badges ----------
// icon: nome de ícone do Ionicons (@expo/vector-icons), não emoji — renderizado em
// DashboardScreen via <Ionicons name={badge.icon} />.
export type Badge = { id: string; icon: string; name: string; desc: string; unlocked: boolean };

export function computeBadges(workouts: Workout[], streak: number, xp: number): Badge[] {
  const totalVolume = workouts.reduce((a, w) => a + (Number.isFinite(w.volume) ? w.volume : 0), 0);
  const maxWeight = Math.max(0, ...workouts.flatMap((w) => (w.exercises ?? []).flatMap((e) => (e.sets ?? []).map((s) => s.weight))));
  return [
    { id: 'first', icon: 'footsteps', name: 'Primeiro Passo', desc: 'Registre seu 1º treino', unlocked: workouts.length >= 1 },
    { id: 'ten', icon: 'calendar', name: 'Frequente', desc: 'Complete 10 treinos', unlocked: workouts.length >= 10 },
    { id: 'streak7', icon: 'flame', name: 'Semana de Fogo', desc: 'Streak de 7 dias', unlocked: streak >= 7 },
    { id: 'club100', icon: 'barbell', name: 'Clube dos 100kg', desc: 'Série com 100kg ou mais', unlocked: maxWeight >= 100 },
    { id: 'ton', icon: 'cube', name: 'Uma Tonelada', desc: '1.000 kg de volume total', unlocked: totalVolume >= 1000 },
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
  // seed simples pela data → mesmos desafios o dia todo, diferentes a cada dia.
  // O segundo desafio sai de outra unidade (kg / exercícios / séries): dois de volume
  // no mesmo dia não davam duas metas de verdade.
  let seed = [...dateKey].reduce((a, c) => a + c.charCodeAt(0), 0);
  const next = () => (seed = (seed * 9301 + 49297) % 233280);
  const first = POOL[next() % POOL.length];
  const others = POOL.filter((c) => c.unit !== first.unit);
  const second = others[next() % others.length];
  // Id pela meta, não pela posição: trocar a ordem do sorteio não pode
  // marcar o desafio errado como já resgatado.
  return [first, second].map((c) => ({ ...c, id: `${dateKey}:${c.label}` }));
}

export function sanitizeWorkouts(raw: unknown): Workout[] {
  if (!Array.isArray(raw)) return [];
  const out: Workout[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const w = item as Partial<Workout>;
    if (typeof w.date !== 'string' || !DATE_KEY.test(w.date)) continue;
    const exercises: Exercise[] = [];
    if (Array.isArray(w.exercises)) {
      for (const ex of w.exercises) {
        if (!ex || typeof ex.name !== 'string' || !ex.name.trim() || !Array.isArray(ex.sets)) continue;
        const sets = ex.sets
          .map((s) => ({
            reps: Number.isFinite(s?.reps) ? Math.max(0, Math.floor(s.reps)) : 0,
            weight: Number.isFinite(s?.weight) ? Math.max(0, s.weight) : 0,
          }))
          .filter((s) => s.reps > 0);
        if (sets.length) exercises.push({ name: ex.name.trim(), sets });
      }
    }
    if (!exercises.length) continue;
    const volume = exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.reps * s.weight, 0), 0);
    out.push({
      id: typeof w.id === 'string' && w.id ? w.id : `legacy-${w.date}-${out.length}`,
      date: w.date,
      title: typeof w.title === 'string' && w.title.trim() ? w.title.trim() : 'Treino',
      exercises,
      volume: typeof w.volume === 'number' && Number.isFinite(w.volume) && w.volume >= 0 ? w.volume : volume,
      xp: typeof w.xp === 'number' && Number.isFinite(w.xp) && w.xp >= 0 ? w.xp : workoutXp(volume, exercises.length),
    });
  }
  return out;
}

export function sanitizeCheckins(raw: unknown): Checkin[] {
  if (!Array.isArray(raw)) return [];
  const byDate = new Map<string, Checkin>();
  for (const item of raw as Partial<Checkin>[]) {
    if (!item || typeof item.date !== 'string' || !DATE_KEY.test(item.date)) continue;
    byDate.set(item.date, {
      date: item.date,
      photoUri: typeof item.photoUri === 'string' ? item.photoUri : '',
      ts: typeof item.ts === 'number' && Number.isFinite(item.ts) ? item.ts : 0,
    });
  }
  return [...byDate.values()].sort((a, b) => b.ts - a.ts);
}

export function sanitizeClaimed(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length < 200))];
}
