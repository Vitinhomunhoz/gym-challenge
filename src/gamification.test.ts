import {
  levelFromXp, xpForLevel, levelTitle, workoutXp, computeStreak, computePRs, computeBadges,
  dailyChallenges, toKey, todayKey, Workout,
} from './gamification';

function makeWorkout(date: string, overrides: Partial<Workout> = {}): Workout {
  return { id: date, date, title: 'Treino', volume: 0, xp: 0, exercises: [], ...overrides };
}

describe('níveis e XP', () => {
  test('nível 1 no XP zero', () => {
    expect(levelFromXp(0)).toBe(1);
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
});

describe('conquistas', () => {
  test('desbloqueia "Primeiro Passo" a partir de 1 treino', () => {
    const badges = computeBadges([makeWorkout(todayKey())], 0, 0);
    expect(badges.find((b) => b.id === 'first')?.unlocked).toBe(true);
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
});
