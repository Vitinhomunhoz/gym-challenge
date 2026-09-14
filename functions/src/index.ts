import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Transaction } from 'firebase-admin/firestore';
import { onDocumentWritten, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

initializeApp();
const db = getFirestore();

// Nenhum treino real chega perto disso — corta tentativas de forjar o próprio
// volume direto no evento antes de ele virar pontuação no placar do grupo.
const MAX_VOLUME_PER_WORKOUT = 50_000;

function inPeriod(dateKey: string, periodStartKey: string, periodEndKey: string): boolean {
  return dateKey >= periodStartKey && dateKey <= periodEndKey;
}

type CheckinEvent = { uid: string; dateKey: string; photoUri?: string };
type WorkoutEvent = { uid: string; dateKey: string; volume: number };
type GroupDoc = { periodStartKey: string; periodEndKey: string };

// Único lugar que efetivamente soma check-ins no placar de um grupo. O cliente só
// cria/atualiza o evento em groups/{groupId}/checkinEvents/{uid}_{dateKey} — as regras
// do Firestore proíbem update/delete nesse documento e proíbem o cliente de tocar nos
// campos de placar em members/{uid} diretamente.
export const onCheckinEventWritten = onDocumentWritten(
  'groups/{groupId}/checkinEvents/{eventId}',
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return; // evento apagado — regra já impede isso, ignora por segurança

    const { groupId } = event.params;
    const { uid, dateKey, photoUri } = after.data() as CheckinEvent;
    if (!uid || !dateKey) return;

    const groupSnap = await db.doc(`groups/${groupId}`).get();
    const group = groupSnap.data() as GroupDoc | undefined;
    if (!group || !inPeriod(dateKey, group.periodStartKey, group.periodEndKey)) return;

    const memberRef = db.doc(`groups/${groupId}/members/${uid}`);
    await db.runTransaction(async (tx: Transaction) => {
      const memberSnap = await tx.get(memberRef);
      if (!memberSnap.exists) return; // saiu do grupo entre o check-in e o processamento

      const counted: string[] = memberSnap.data()?.countedCheckinDates ?? [];
      const alreadyCounted = counted.includes(dateKey);
      tx.update(memberRef, {
        // a foto sempre atualiza (ex.: usuário troca a foto no mesmo dia),
        // mas o contador só sobe uma vez por dia — mesma regra que era do cliente
        ...(alreadyCounted ? {} : { checkinsCount: FieldValue.increment(1), countedCheckinDates: FieldValue.arrayUnion(dateKey) }),
        ...(photoUri ? { lastCheckinPhoto: photoUri, lastCheckinDate: dateKey } : {}),
      });
    });
  }
);

// Único lugar que soma treinos/volume no placar. O cliente só cria um evento em
// groups/{groupId}/workoutEvents/{eventId}; o volume é validado e limitado aqui
// antes de virar incremento real no documento do membro.
export const onWorkoutEventCreated = onDocumentCreated(
  'groups/{groupId}/workoutEvents/{eventId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const { groupId } = event.params;
    const { uid, dateKey, volume } = snap.data() as WorkoutEvent;
    if (!uid || !dateKey || typeof volume !== 'number' || !Number.isFinite(volume) || volume < 0) return;

    const groupSnap = await db.doc(`groups/${groupId}`).get();
    const group = groupSnap.data() as GroupDoc | undefined;
    if (!group || !inPeriod(dateKey, group.periodStartKey, group.periodEndKey)) return;

    const memberRef = db.doc(`groups/${groupId}/members/${uid}`);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) return;

    const safeVolume = Math.min(volume, MAX_VOLUME_PER_WORKOUT);
    await memberRef.update({
      workoutsCount: FieldValue.increment(1),
      volumeKg: FieldValue.increment(safeVolume),
    });

    if (safeVolume < volume) {
      logger.warn(`Volume de treino truncado (uid=${uid}, grupo=${groupId}): ${volume} → ${safeVolume}`);
    }
  }
);
