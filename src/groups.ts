// Grupos: competição entre usuários (ranking) + chat, via Firestore.
// Guarda só contadores agregados por membro — nunca os treinos/check-ins completos
// (mais privado, leituras baratas, regras de segurança simples).
import {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection,
  query, orderBy, limit, onSnapshot, addDoc, serverTimestamp,
  runTransaction, increment, arrayUnion, arrayRemove, Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { AppUser } from './firebase';
import { addDaysKey, todayKey } from './gamification';
import { firestorePhoto } from './photos';

export type RuleType = 'checkins' | 'workouts' | 'volume';

export const RULE_LABELS: Record<RuleType, string> = {
  checkins: 'Mais check-ins',
  workouts: 'Mais treinos registrados',
  volume: 'Maior volume total (kg)',
};

export type Group = {
  id: string;
  name: string;
  ownerUid: string;
  ownerName: string;
  inviteCode: string;
  ruleType: RuleType;
  periodDays: 7 | 14 | 30;
  periodStartKey: string;
  periodEndKey: string;
  createdAt: number;
};

export type GroupMember = {
  uid: string;
  name: string;
  photo?: string;
  joinedAt: number;
  checkinsCount: number;
  workoutsCount: number;
  volumeKg: number;
  countedCheckinDates: string[];
  lastCheckinPhoto?: string; // foto-prova mais recente, visível pro grupo todo
  lastCheckinDate?: string;
};

export type GroupMessage = {
  id: string;
  uid: string;
  name: string;
  photo?: string;
  text: string;
  createdAt: number | null; // null enquanto o serverTimestamp() ainda não resolveu
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I, evita confusão

function randomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

function requireDb() {
  if (!db) throw new Error('Firestore não configurado.');
  return db;
}

export async function getUserGroupIds(uid: string): Promise<string[]> {
  const d = requireDb();
  const snap = await getDoc(doc(d, 'users', uid));
  return (snap.data()?.groupIds as string[] | undefined) ?? [];
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const d = requireDb();
  const snap = await getDoc(doc(d, 'groups', groupId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Group) : null;
}

export async function getMemberCount(groupId: string): Promise<number> {
  const d = requireDb();
  const snap = await getDocs(collection(d, 'groups', groupId, 'members'));
  return snap.size;
}

export async function createGroup(
  user: AppUser, name: string, ruleType: RuleType, periodDays: 7 | 14 | 30
): Promise<Group> {
  const d = requireDb();
  const groupRef = doc(collection(d, 'groups'));
  const periodStartKey = todayKey();
  // Inclusivo: "7 dias" a partir de hoje termina daqui a 6 dias de calendário,
  // não em now+7*24h (isso mostrava 8 dias e escorregava com horário de verão).
  const periodEndKey = addDaysKey(periodStartKey, periodDays - 1);
  let inviteCode = randomCode();

  const group: Omit<Group, 'id'> = {
    name: name.trim() || 'Meu grupo',
    ownerUid: user.uid,
    ownerName: user.name,
    inviteCode,
    ruleType,
    periodDays,
    periodStartKey,
    periodEndKey,
    createdAt: Date.now(),
  };
  // 1) o grupo precisa existir ANTES do código de convite — a regra de segurança do
  // inviteCode confere a posse do grupo com get(groups/{groupId}).data.ownerUid
  await setDoc(groupRef, group);

  // 2) cria o código; a regra bloqueia (permission-denied) se o código já existir —
  // nessa colisão raríssima, gera outro e atualiza o grupo. setDoc em documento
  // existente é update, e update está negado: por isso a colisão cai no catch.
  let savedCode = false;
  for (let attempt = 0; attempt < 5 && !savedCode; attempt++) {
    try {
      await setDoc(doc(d, 'inviteCodes', inviteCode), { groupId: groupRef.id });
      savedCode = true;
    } catch {
      inviteCode = randomCode();
      await updateDoc(groupRef, { inviteCode });
    }
  }
  if (!savedCode) {
    throw new Error('Não foi possível gerar um código de convite. Tente de novo.');
  }
  group.inviteCode = inviteCode;

  await joinAsMember(d, groupRef.id, user);

  return { id: groupRef.id, ...group };
}

export async function joinGroupByCode(user: AppUser, rawCode: string): Promise<string> {
  const d = requireDb();
  const code = rawCode.trim().toUpperCase();
  const codeSnap = await getDoc(doc(d, 'inviteCodes', code));
  if (!codeSnap.exists()) throw new Error('Código inválido. Confira e tente de novo.');
  const groupId = codeSnap.data().groupId as string;

  // Não dá pra ler groups/{groupId} aqui — a regra só libera leitura pra quem já é
  // membro, e é justamente isso que ainda não somos. A checagem de existência do
  // grupo acontece pelo lado do servidor (exists()) dentro da própria regra de
  // criação do membro, então só tentamos entrar e traduzimos a falha.
  const memberSnap = await getDoc(doc(d, 'groups', groupId, 'members', user.uid));
  if (!memberSnap.exists()) {
    try {
      await joinAsMember(d, groupId, user);
    } catch {
      throw new Error('Não foi possível entrar nesse grupo. Confira o código.');
    }
  } else {
    // Entrou pela metade numa tentativa anterior: o membro existe, mas a lista
    // do usuário não. Sem esse reparo o grupo some no próximo carregamento.
    await setDoc(doc(d, 'users', user.uid), { groupIds: arrayUnion(groupId) }, { merge: true });
  }
  return groupId;
}

async function joinAsMember(d: NonNullable<typeof db>, groupId: string, user: AppUser) {
  // `photo: undefined` é rejeitado pelo SDK ("Unsupported field value") e a
  // pessoa sem foto do Google não conseguia criar nem entrar em grupo.
  const photo = firestorePhoto(user.photo);
  const member: Omit<GroupMember, 'photo'> & { photo?: string } = {
    uid: user.uid,
    name: (user.name || 'Atleta').slice(0, 80),
    joinedAt: Date.now(),
    checkinsCount: 0,
    workoutsCount: 0,
    volumeKg: 0,
    countedCheckinDates: [],
    ...(photo ? { photo } : {}),
  };
  await setDoc(doc(d, 'groups', groupId, 'members', user.uid), member);
  await setDoc(doc(d, 'users', user.uid), { groupIds: arrayUnion(groupId) }, { merge: true });
}

export async function leaveGroup(uid: string, groupId: string): Promise<void> {
  const d = requireDb();
  await deleteDoc(doc(d, 'groups', groupId, 'members', uid));
  await setDoc(doc(d, 'users', uid), { groupIds: arrayRemove(groupId) }, { merge: true });
}

export function subscribeMembers(groupId: string, cb: (members: GroupMember[]) => void): Unsubscribe {
  const d = requireDb();
  return onSnapshot(collection(d, 'groups', groupId, 'members'), (snap) => {
    cb(snap.docs.map((doc) => doc.data() as GroupMember));
  });
}

export function subscribeMessages(groupId: string, cb: (messages: GroupMessage[]) => void): Unsubscribe {
  const d = requireDb();
  const q = query(collection(d, 'groups', groupId, 'messages'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snap) => {
    const messages = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toMillis?.() ?? null } as GroupMessage))
      .reverse();
    cb(messages);
  });
}

export async function sendMessage(groupId: string, user: AppUser, text: string): Promise<void> {
  const d = requireDb();
  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) return;
  await addDoc(collection(d, 'groups', groupId, 'messages'), {
    uid: user.uid,
    name: (user.name || 'Atleta').slice(0, 80),
    photo: firestorePhoto(user.photo) ?? null,
    text: trimmed,
    createdAt: serverTimestamp(),
  });
}

export async function syncProfileToGroups(uid: string, groupIds: string[], name: string, photo?: string): Promise<void> {
  const d = requireDb();
  const safeName = (name || 'Atleta').slice(0, 80);
  const safePhoto = firestorePhoto(photo);
  await Promise.all(groupIds.map(async (groupId) => {
    try {
      await updateDoc(doc(d, 'groups', groupId, 'members', uid), {
        name: safeName,
        ...(safePhoto ? { photo: safePhoto } : {}),
      });
    } catch {
      // saiu do grupo ou está offline
    }
  }));
}

// ---------- Sincronização automática (chamada pelo store ao registrar treino/check-in) ----------
//
// O cliente ainda escreve o placar diretamente (Cloud Functions exigem o plano Blaze
// do Firebase, que ficou de fora por decisão do projeto). Como mitigação sem custo,
// as firestore.rules validam cada escrita: o placar só pode subir em um passo pequeno
// e nunca diminuir — não impede repetição, mas impede setar um valor arbitrário
// direto no documento. Ver "Integridade do ranking" no README para o caminho mais
// robusto (Cloud Functions já prontas em functions/src/index.ts, é só publicar).

const MAX_VOLUME_PER_WORKOUT = 50_000; // mesmo teto validado em firestore.rules

export async function syncCheckinToGroups(
  uid: string, groupIds: string[], dateKey: string, photoUri: string
): Promise<void> {
  const d = requireDb();
  await Promise.all(groupIds.map(async (groupId) => {
    try {
      const groupSnap = await getDoc(doc(d, 'groups', groupId));
      const group = groupSnap.data() as Group | undefined;
      if (!group || dateKey < group.periodStartKey || dateKey > group.periodEndKey) return;

      const memberRef = doc(d, 'groups', groupId, 'members', uid);
      const photo = firestorePhoto(photoUri);
      await runTransaction(d, async (tx) => {
        const snap = await tx.get(memberRef);
        if (!snap.exists()) return;
        const counted: string[] = snap.data()?.countedCheckinDates ?? [];
        const alreadyCounted = counted.includes(dateKey);
        tx.update(memberRef, {
          // a foto sempre atualiza (ex.: usuário tira outra foto no mesmo dia),
          // mas o contador só sobe uma vez por dia. Foto grande demais é omitida
          // para o incremento não falhar junto com ela.
          ...(alreadyCounted ? {} : { checkinsCount: increment(1), countedCheckinDates: arrayUnion(dateKey) }),
          ...(photo ? { lastCheckinPhoto: photo } : {}),
          lastCheckinDate: dateKey,
        });
      });
    } catch {
      // offline, sem permissão, ou ainda não é membro — falha silenciosa, não afeta o uso local
    }
  }));
}

export async function syncWorkoutToGroups(uid: string, groupIds: string[], volume: number, dateKey: string): Promise<void> {
  const d = requireDb();
  const safeVolume = Math.max(0, Math.min(Number.isFinite(volume) ? volume : 0, MAX_VOLUME_PER_WORKOUT));
  await Promise.all(groupIds.map(async (groupId) => {
    try {
      const groupSnap = await getDoc(doc(d, 'groups', groupId));
      const group = groupSnap.data() as Group | undefined;
      if (!group || dateKey < group.periodStartKey || dateKey > group.periodEndKey) return;

      const memberRef = doc(d, 'groups', groupId, 'members', uid);
      await updateDoc(memberRef, { workoutsCount: increment(1), volumeKg: increment(safeVolume) });
    } catch {
      // idem
    }
  }));
}
