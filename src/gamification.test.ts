import {
  levelFromXp, xpForLevel, levelTitle, workoutXp, computeStreak, computePRs, computeBadges,
  dailyChallenges, toKey, todayKey, Workout, addDaysKey, daysRemaining, monthCells,
  parseReps, parseWeight, claimChallengeReward, sanitizeWorkouts,
} from './gamification';

function makeWorkout(date: string, overrides: Partial<Workout> = {}): Workout {
  return { id: date, date, title: 'Treino', volume: 0, xp: 0, exercises: [], ...overrides };
}

describe('níveis e XP', () => {
  test('nível 1 no XP zero, negativo ou inválido', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(-40)).toBe(1);
    expect(levelFromXp(Number.NaN)).toBe(1);
  });

  test('XP exato de um nível gera aquele nível', () => {
    expect(levelFromXp(xpForLevel(5))).toBe(5);
  });

  test('título de nível segue as faixas definidas', () => {
    expect(levelTitle(1)).toBe('Iniciante');
    expect(levelTitle(3)).toBe('Aprendiz');
    expect(levelTitle(7)).toBe('Intermediário');
    expect(levelTitle(12)).toBe('Veterano');
    expect(levelTitle(20)).toBe('Mestre de Ferro');
  });
});

describe('XP por treino', () => {
  test('XP mínimo é o valor-base mesmo sem volume nem exercícios', () => {
    expect(workoutXp(0, 0)).toBe(50);
  });

  test('bônus de volume tem teto de 150', () => {
    const bonusNormal = workoutXp(10_000, 0) - 50;
    const bonusEstourado = workoutXp(1_000_000, 0) - 50;
    expect(bonusNormal).toBeLessThan(150);
    expect(bonusEstourado).toBe(150);
  });

  test('volume negativo não reduz o XP abaixo da base', () => {
    expect(workoutXp(-50_000, 1)).toBe(60);
  });
});

describe('carga e repetições digitadas', () => {
  test('aceita vírgula decimal e rejeita negativo ou não finito', () => {
    expect(parseWeight('40,5')).toBe(40.5);
    expect(parseWeight('-10')).toBe(0);
    expect(parseWeight('Infinity')).toBe(0);
    expect(parseReps('12')).toBe(12);
    expect(parseReps('-3')).toBe(0);
    expect(parseReps('')).toBe(0);
  });
});

describe('resgate de desafio', () => {
  test('soma o XP uma vez só', () => {
    const challenge = { id: '2026-10-28:meta', xp: 80 };
    const first = claimChallengeReward([], 100, challenge);
    const second = claimChallengeReward(first.claimed, first.xp, challenge);
    expect(first).toEqual({ claimed: ['2026-10-28:meta'], xp: 180 });
    expect(second).toEqual(first);
  });
});

describe('streak', () => {
  test('sem treinos, streak é zero', () => {
    expect(computeStreak([])).toBe(0);
  });

  test('treino hoje e ontem conta como streak de 2', () => {
    const hoje = new Date();
    const ontem = new Date(Date.now() - 86_400_000);
    expect(computeStreak([makeWorkout(toKey(hoje)), makeWorkout(toKey(ontem))])).toBe(2);
  });

  test('treino de dois dias atrás, sem hoje nem ontem, não conta streak', () => {
    const doisDiasAtras = new Date(Date.now() - 2 * 86_400_000);
    expect(computeStreak([makeWorkout(toKey(doisDiasAtras))])).toBe(0);
  });
});

describe('recordes (PRs)', () => {
  test('mantém a maior carga por exercício, ignorando caixa e espaços no nome', () => {
    const workouts = [
      makeWorkout('2024-01-01', { exercises: [{ name: 'Supino Reto', sets: [{ reps: 10, weight: 40 }] }] }),
      makeWorkout('2024-01-02', { exercises: [{ name: '  supino reto  ', sets: [{ reps: 8, weight: 60 }] }] }),
    ];
    expect(computePRs(workouts)).toEqual([{ name: 'Supino Reto', weight: 60 }]);
  });

  test('não capitaliza a letra depois de um acento', () => {
    const workouts = [
      makeWorkout('2024-01-01', { exercises: [{ name: 'elevação lateral', sets: [{ reps: 12, weight: 8 }] }] }),
      makeWorkout('2024-01-02', { exercises: [{ name: 'tríceps testa', sets: [{ reps: 10, weight: 20 }] }] }),
    ];
    expect(computePRs(workouts)).toEqual([
      { name: 'Tríceps Testa', weight: 20 },
      { name: 'Elevação Lateral', weight: 8 },
    ]);
  });
});

describe('conquistas', () => {
  test('desbloqueia "Primeiro Passo" a partir de 1 treino', () => {
    const badges = computeBadges([makeWorkout(todayKey())], 0, 0);
    expect(badges.find((b) => b.id === 'first')?.unlocked).toBe(true);
  });

  test('Uma Tonelada desbloqueia em 1.000 kg', () => {
    const below = computeBadges([makeWorkout(todayKey(), { volume: 999 })], 0, 0);
    const above = computeBadges([makeWorkout(todayKey(), { volume: 1000 })], 0, 0);
    expect(below.find((b) => b.id === 'ton')?.unlocked).toBe(false);
    expect(above.find((b) => b.id === 'ton')?.unlocked).toBe(true);
    expect(above.find((b) => b.id === 'ton')?.desc).toBe('1.000 kg de volume total');
  });

  test('não desbloqueia "Clube dos 100kg" sem nenhuma série de 100kg ou mais', () => {
    const workouts = [makeWorkout(todayKey(), { exercises: [{ name: 'Agachamento', sets: [{ reps: 5, weight: 99 }] }] })];
    expect(computeBadges(workouts, 0, 0).find((b) => b.id === 'club100')?.unlocked).toBe(false);
  });
});

describe('desafios diários', () => {
  test('a mesma data sempre gera os mesmos dois desafios', () => {
    const a = dailyChallenges('2024-05-10');
    const b = dailyChallenges('2024-05-10');
    expect(a.map((c) => c.label)).toEqual(b.map((c) => c.label));
  });

  test('os dois desafios do dia são diferentes entre si', () => {
    const [c1, c2] = dailyChallenges('2024-05-10');
    expect(c1.label).not.toBe(c2.label);
  });

  test('os dois desafios medem unidades diferentes', () => {
    for (let day = 1; day <= 28; day++) {
      const key = `2026-05-${String(day).padStart(2, '0')}`;
      const [a, b] = dailyChallenges(key);
      expect(a.unit).not.toBe(b.unit);
      expect(a.id).toBe(`${key}:${a.label}`);
    }
  });
});

describe('período e calendário', () => {
  test('7 dias a partir de 28/10 inclui exatamente 7 datas', () => {
    expect(addDaysKey('2026-10-28', 6)).toBe('2026-11-03');
    expect(addDaysKey('2026-12-30', 6)).toBe('2027-01-05');
  });

  test('no último dia ainda resta 1, e no dia seguinte encerra', () => {
    const morning = new Date(2026, 9, 28, 9, 0, 0).getTime();
    const nextDay = new Date(2026, 9, 29, 0, 0, 1).getTime();
    expect(daysRemaining('2026-10-28', morning)).toBe(1);
    expect(daysRemaining('2026-10-28', nextDay)).toBe(0);
    expect(daysRemaining('data-ruim', morning)).toBe(0);
  });

  test('outubro de 2026 começa na quinta e tem 31 dias', () => {
    const cells = monthCells(2026, 9);
    expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cells[4]).toBe('2026-10-01');
    expect(cells[cells.length - 1]).toBe('2026-10-31');
    expect(cells.filter(Boolean)).toHaveLength(31);
  });
});

describe('dados salvos corrompidos', () => {
  test('descarta treino sem data ou sem série válida e zera volume negativo', () => {
    const clean = sanitizeWorkouts([
      { id: 'ok', date: '2026-10-28', title: 'A', volume: -10, xp: 50, exercises: [{ name: 'Supino', sets: [{ reps: 8, weight: 40 }] }] },
      { id: 'ruim', date: 'ontem', title: 'B', exercises: [] },
      null,
      { date: '2026-10-01', exercises: [{ name: '  ', sets: [{ reps: 5, weight: 10 }] }] },
    ]);
    expect(clean).toHaveLength(1);
    expect(clean[0].volume).toBe(320);
    expect(clean[0].exercises[0].name).toBe('Supino');
  });
});
