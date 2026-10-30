// Grupo fictício do Modo Demo. O ranking e o chat de verdade ficam no Firestore
// e exigem a conta Google; este exemplo só existe neste aparelho, para mostrar
// a tela sem misturar dados de outra pessoa.
import { addDaysKey, todayKey } from './gamification';
import type { Group, GroupMember, GroupMessage } from './groups';

export const DEMO_GROUP_ID = 'demo-exemplo';

export function demoGroup(): Group {
  const start = todayKey();
  return {
    id: DEMO_GROUP_ID,
    name: 'Galera da Academia',
    ownerUid: 'marina',
    ownerName: 'Marina',
    inviteCode: 'GYM7K2',
    ruleType: 'checkins',
    periodDays: 7,
    periodStartKey: start,
    periodEndKey: addDaysKey(start, 6),
    createdAt: Date.now(),
  };
}

export function demoMembers(): GroupMember[] {
  const today = todayKey();
  const yesterday = addDaysKey(today, -1);
  return [
    { uid: 'marina', name: 'Marina', joinedAt: 1, checkinsCount: 5, workoutsCount: 4, volumeKg: 8200, countedCheckinDates: [], lastCheckinDate: today },
    { uid: 'demo', name: 'Atleta Demo', joinedAt: 2, checkinsCount: 3, workoutsCount: 3, volumeKg: 5400, countedCheckinDates: [], lastCheckinDate: today },
    { uid: 'lucas', name: 'Lucas', joinedAt: 3, checkinsCount: 2, workoutsCount: 2, volumeKg: 3100, countedCheckinDates: [], lastCheckinDate: yesterday },
    { uid: 'rafael', name: 'Rafael', joinedAt: 4, checkinsCount: 1, workoutsCount: 1, volumeKg: 1400, countedCheckinDates: [], lastCheckinDate: yesterday },
  ];
}

export function demoMessageSeed(): GroupMessage[] {
  const now = Date.now();
  return [
    { id: 'demo-m1', uid: 'marina', name: 'Marina', text: 'Fechei o check-in de hoje. Quem vem amanhã às 18h?', createdAt: now - 40 * 60 * 1000 },
    { id: 'demo-m2', uid: 'lucas', name: 'Lucas', text: 'Eu vou. O código pra convidar é GYM7K2.', createdAt: now - 25 * 60 * 1000 },
    { id: 'demo-m3', uid: 'rafael', name: 'Rafael', text: 'Tô em 1 check-in ainda. Semana que vem eu alcanço vocês.', createdAt: now - 8 * 60 * 1000 },
  ];
}
