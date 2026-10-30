import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppUser } from './firebase';
import {
  Workout, Checkin, computeStreak, computeBadges, computePRs, dailyChallenges,
  levelFromXp, todayKey, workoutXp, Challenge, claimChallengeReward,
  sanitizeWorkouts, sanitizeCheckins, sanitizeClaimed,
} from './gamification';
import { getUserGroupIds, syncCheckinToGroups, syncProfileToGroups, syncWorkoutToGroups } from './groups';
import { firestorePhoto } from './photos';

type State = {
  user: AppUser | null;
  workouts: Workout[];
  xp: number;
  claimedChallenges: string[]; // ids de desafios já premiados
  checkins: Checkin[]; // fotos-prova de presença no treino, por data
  customPhoto: string | null; // foto de perfil escolhida localmente, sobrepõe a do Google
};

type Store = State & {
  setUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  addWorkout: (title: string, exercises: Workout['exercises']) => Workout | null;
  claimChallenge: (c: Challenge) => void;
  addCheckin: (photoUri: string) => void;
  setCustomPhoto: (uri: string | null) => void;
  logout: () => void;
  ready: boolean;
  // derivados
  level: number;
  streak: number;
  badges: ReturnType<typeof computeBadges>;
  prs: ReturnType<typeof computePRs>;
  todaysChallenges: Challenge[];
  todaysWorkouts: Workout[];
  todaysCheckin: Checkin | undefined;
  refreshGroupIds: () => Promise<void>;
  noteGroupJoined: (groupId: string) => void;
  noteGroupLeft: (groupId: string) => void;
};

const Ctx = createContext<Store>(null as any);
export const useStore = () => useContext(Ctx);

const keyFor = (uid: string) => `gymchallenge:${uid}`;

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizePhoto(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw || raw.length > 2_000_000) return null;
  if (
    raw.startsWith('data:image/')
    || raw.startsWith('https://')
    || raw.startsWith('http://')
    || raw.startsWith('file:')
  ) return raw;
  return null;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [xp, setXp] = useState(0);
  const [claimedChallenges, setClaimed] = useState<string[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [customPhoto, setCustomPhotoState] = useState<string | null>(null);
  const [hydratedUid, setHydratedUid] = useState<string | null>(null);
  const [groupIds, setGroupIds] = useState<string[]>([]);

  // Atualizado no render: callbacks e efeitos enxergam o usuário desta pintura,
  // sem depender da ordem entre effects.
  const rawUserRef = useRef<AppUser | null>(null);
  rawUserRef.current = user;
  const claimedRef = useRef<string[]>([]);
  claimedRef.current = claimedChallenges;
  const groupIdsRef = useRef<string[]>([]);
  groupIdsRef.current = groupIds;
  const lastSyncedProfile = useRef('');
  const groupRefreshGen = useRef(0);

  const applyGroupIds = useCallback((ids: string[]) => {
    groupIdsRef.current = ids;
    setGroupIds(ids);
  }, []);

  const refreshGroupIds = useCallback((): Promise<void> => {
    const gen = ++groupRefreshGen.current;
    const u = rawUserRef.current;
    if (!u || u.demo) {
      applyGroupIds([]);
      return Promise.resolve();
    }
    const uid = u.uid;
    // Foto dos ids no instante da leitura, para não apagar um grupo em que a
    // pessoa entrou enquanto o getDoc ainda estava no ar — e também para não
    // repor um grupo que ela acabou de deixar.
    const snapshot = groupIdsRef.current.slice();
    return getUserGroupIds(uid).then((ids) => {
      if (groupRefreshGen.current !== gen || rawUserRef.current?.uid !== uid) return;
      const extra = groupIdsRef.current.filter((id) => !snapshot.includes(id));
      const left = snapshot.filter((id) => !groupIdsRef.current.includes(id));
      applyGroupIds([...new Set([...ids.filter((id) => !left.includes(id)), ...extra])]);
    }).catch(() => {});
  }, [applyGroupIds]);

  const noteGroupJoined = useCallback((id: string) => {
    if (!id || groupIdsRef.current.includes(id)) return;
    applyGroupIds([...groupIdsRef.current, id]);
  }, [applyGroupIds]);

  const noteGroupLeft = useCallback((id: string) => {
    applyGroupIds(groupIdsRef.current.filter((g) => g !== id));
  }, [applyGroupIds]);

  // Carrega o documento do usuário só depois de descartar o estado anterior.
  // Gravar antes disso misturava treinos entre contas e, no pior caso,
  // substituía o save por um JSON vazio.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setHydratedUid(null);
      return;
    }
    const uid = user.uid;
    setHydratedUid(null);
    setWorkouts([]);
    setXp(0);
    setClaimed([]);
    setCheckins([]);
    setCustomPhotoState(null);
    claimedRef.current = [];
    lastSyncedProfile.current = '';
    // Zera antes da rede: um treino salvo nesse intervalo não pode ir para
    // os grupos da conta anterior. A geração invalida um refresh ainda em voo.
    groupRefreshGen.current += 1;
    applyGroupIds([]);

    AsyncStorage.getItem(keyFor(uid)).then((raw) => {
      if (cancelled) return;
      let data: Record<string, unknown> = {};
      if (raw) {
        try { data = JSON.parse(raw) as Record<string, unknown>; } catch { data = {}; }
      }
      const loadedWorkouts = sanitizeWorkouts(data.workouts);
      const loadedXp = typeof data.xp === 'number' && Number.isFinite(data.xp) ? Math.max(0, data.xp) : 0;
      const loadedClaimed = sanitizeClaimed(data.claimedChallenges);
      const loadedCheckins = sanitizeCheckins(data.checkins);
      const loadedPhoto = sanitizePhoto(data.customPhoto);
      claimedRef.current = loadedClaimed;
      setWorkouts(loadedWorkouts);
      setXp(loadedXp);
      setClaimed(loadedClaimed);
      setCheckins(loadedCheckins);
      setCustomPhotoState(loadedPhoto);
      setHydratedUid(uid);
    }).catch(() => {
      if (!cancelled) setHydratedUid(uid);
    });
    refreshGroupIds();
    return () => { cancelled = true; };
  }, [user?.uid]);

  useEffect(() => {
    if (!user || hydratedUid !== user.uid) return;
    const payload = { workouts, xp, claimedChallenges, checkins, customPhoto };
    const key = keyFor(user.uid);
    AsyncStorage.setItem(key, JSON.stringify(payload)).catch(() => {
      // Estourou a cota (foto grande demais): guarda o diário sem as imagens
      // em vez de perder XP e treinos.
      const slim = {
        ...payload,
        customPhoto: null,
        checkins: checkins.map((c) => ({ ...c, photoUri: '' })),
      };
      return AsyncStorage.setItem(key, JSON.stringify(slim)).catch(() => {});
    });
  }, [user?.uid, hydratedUid, workouts, xp, claimedChallenges, checkins, customPhoto]);

  // Nome/foto que o grupo vê. customPhoto null cai na foto do Google.
  useEffect(() => {
    const raw = rawUserRef.current;
    if (!raw || raw.demo || hydratedUid !== raw.uid || groupIds.length === 0) return;
    const cloudPhoto = firestorePhoto(customPhoto) ?? firestorePhoto(raw.photo);
    const signature = JSON.stringify({ name: raw.name, photo: cloudPhoto ?? null, groupIds });
    if (lastSyncedProfile.current === signature) return;
    lastSyncedProfile.current = signature;
    syncProfileToGroups(raw.uid, groupIds, raw.name, cloudPhoto).catch(() => {
      lastSyncedProfile.current = '';
    });
  }, [customPhoto, hydratedUid, groupIds, user?.name, user?.photo]);

  const setCustomPhoto = useCallback((uri: string | null) => setCustomPhotoState(uri), []);

  const addWorkout = useCallback((title: string, exercises: Workout['exercises']) => {
    const clean = exercises
      .map((e) => ({
        name: e.name.trim().slice(0, 80),
        sets: e.sets
          .map((s) => ({
            reps: Number.isFinite(s.reps) && s.reps > 0 ? Math.floor(s.reps) : 0,
            weight: Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 0,
          }))
          .filter((s) => s.reps > 0),
      }))
      .filter((e) => e.name && e.sets.length > 0);
    if (clean.length === 0) return null;

    const volume = clean.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.reps * s.weight, 0), 0);
    const w: Workout = {
      id: newId(),
      date: todayKey(),
      title: title.trim().slice(0, 80) || 'Treino',
      exercises: clean,
      volume,
      xp: workoutXp(volume, clean.length),
    };
    setWorkouts((prev) => [w, ...prev]);
    setXp((prev) => prev + w.xp);
    const u = rawUserRef.current;
    if (u && !u.demo) syncWorkoutToGroups(u.uid, groupIdsRef.current, w.volume, w.date).catch(() => {});
    return w;
  }, []);

  const claimChallenge = useCallback((c: Challenge) => {
    const before = claimedRef.current;
    const next = claimChallengeReward(before, 0, c);
    if (next.claimed === before) return;
    claimedRef.current = next.claimed;
    setClaimed(next.claimed);
    setXp((prev) => prev + next.xp);
  }, []);

  const addCheckin = useCallback((photoUri: string) => {
    const date = todayKey();
    setCheckins((prev) => [{ date, photoUri, ts: Date.now() }, ...prev.filter((c) => c.date !== date)]);
    const u = rawUserRef.current;
    if (u && !u.demo) syncCheckinToGroups(u.uid, groupIdsRef.current, date, photoUri).catch(() => {});
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setWorkouts([]);
    setXp(0);
    setClaimed([]);
    claimedRef.current = [];
    setCheckins([]);
    setCustomPhotoState(null);
    setHydratedUid(null);
    applyGroupIds([]);
    lastSyncedProfile.current = '';
  }, [applyGroupIds]);

  const streak = computeStreak(workouts);
  const todaysWorkouts = workouts.filter((w) => w.date === todayKey());
  const ready = !user || hydratedUid === user.uid;

  // Foto customizada por cima da do Google. O documento cru continua em `user`
  // (estado) para o fallback da nuvem quando a foto local não cabe no Firestore.
  const effectiveUser = user ? { ...user, photo: customPhoto ?? user.photo } : null;

  const value: Store = {
    user: effectiveUser, workouts, xp, claimedChallenges, checkins, customPhoto,
    setUser, addWorkout, claimChallenge, addCheckin, setCustomPhoto, logout, ready,
    level: levelFromXp(xp),
    streak,
    badges: computeBadges(workouts, streak, xp),
    prs: computePRs(workouts),
    todaysChallenges: dailyChallenges(todayKey()),
    todaysWorkouts,
    todaysCheckin: checkins.find((c) => c.date === todayKey()),
    refreshGroupIds,
    noteGroupJoined,
    noteGroupLeft,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
