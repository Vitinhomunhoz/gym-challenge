import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppUser } from './firebase';
import {
  Workout, Checkin, computeStreak, computeBadges, computePRs, dailyChallenges,
  levelFromXp, todayKey, workoutXp, Challenge,
} from './gamification';
import { getUserGroupIds, syncCheckinToGroups, syncWorkoutToGroups } from './groups';

type State = {
  user: AppUser | null;
  workouts: Workout[];
  xp: number;
  claimedChallenges: string[]; // ids de desafios já premiados
  checkins: Checkin[]; // fotos-prova de presença no treino, por data
  customPhoto: string | null; // foto de perfil escolhida localmente, sobrepõe a do Google
};

type Store = State & {
  setUser: (u: AppUser | null) => void;
  addWorkout: (title: string, exercises: Workout['exercises']) => Workout;
  claimChallenge: (c: Challenge) => void;
  addCheckin: (photoUri: string) => void;
  setCustomPhoto: (uri: string | null) => void;
  logout: () => void;
  // derivados
  level: number;
  streak: number;
  badges: ReturnType<typeof computeBadges>;
  prs: ReturnType<typeof computePRs>;
  todaysChallenges: Challenge[];
  todaysWorkouts: Workout[];
  todaysCheckin: Checkin | undefined;
  refreshGroupIds: () => void;
};

const Ctx = createContext<Store>(null as any);
export const useStore = () => useContext(Ctx);

const keyFor = (uid: string) => `gymchallenge:${uid}`;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [xp, setXp] = useState(0);
  const [claimedChallenges, setClaimed] = useState<string[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [customPhoto, setCustomPhotoState] = useState<string | null>(null);

  // Refs para addWorkout/addCheckin (useCallback com deps vazias) lerem o valor
  // atual sem precisar virar dependência e mudar de identidade a cada render.
  const userRef = useRef<AppUser | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const groupIdsRef = useRef<string[]>([]);
  const refreshGroupIds = useCallback(() => {
    const u = userRef.current;
    if (!u || u.demo) { groupIdsRef.current = []; return; }
    getUserGroupIds(u.uid).then((ids) => { groupIdsRef.current = ids; }).catch(() => {});
  }, []);

  // Carrega dados do usuário ao logar
  useEffect(() => {
    if (!user) return;
    AsyncStorage.getItem(keyFor(user.uid)).then((raw) => {
      if (!raw) return;
      const data = JSON.parse(raw);
      setWorkouts(data.workouts ?? []);
      setXp(data.xp ?? 0);
      setClaimed(data.claimedChallenges ?? []);
      setCheckins(data.checkins ?? []);
      setCustomPhotoState(data.customPhoto ?? null);
    });
    refreshGroupIds();
  }, [user?.uid]);

  // Persiste a cada mudança
  useEffect(() => {
    if (!user) return;
    AsyncStorage.setItem(keyFor(user.uid), JSON.stringify({ workouts, xp, claimedChallenges, checkins, customPhoto }));
  }, [user?.uid, workouts, xp, claimedChallenges, checkins, customPhoto]);

  const setCustomPhoto = useCallback((uri: string | null) => setCustomPhotoState(uri), []);

  const addWorkout = useCallback((title: string, exercises: Workout['exercises']) => {
    const volume = exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.reps * s.weight, 0), 0);
    const w: Workout = {
      id: String(Date.now()),
      date: todayKey(),
      title: title.trim() || 'Treino',
      exercises,
      volume,
      xp: workoutXp(volume, exercises.length),
    };
    setWorkouts((prev) => [w, ...prev]);
    setXp((prev) => prev + w.xp);
    const u = userRef.current;
    if (u && !u.demo) syncWorkoutToGroups(u.uid, groupIdsRef.current, w.volume, w.date).catch(() => {});
    return w;
  }, []);

  const claimChallenge = useCallback((c: Challenge) => {
    setClaimed((prev) => (prev.includes(c.id) ? prev : [...prev, c.id]));
    setXp((prev) => prev + c.xp);
  }, []);

  const addCheckin = useCallback((photoUri: string) => {
    const date = todayKey();
    setCheckins((prev) => [{ date, photoUri, ts: Date.now() }, ...prev.filter((c) => c.date !== date)]);
    const u = userRef.current;
    if (u && !u.demo) syncCheckinToGroups(u.uid, groupIdsRef.current, date, photoUri).catch(() => {});
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setWorkouts([]);
    setXp(0);
    setClaimed([]);
    setCheckins([]);
    setCustomPhotoState(null);
    groupIdsRef.current = [];
  }, []);

  const streak = computeStreak(workouts);
  const todaysWorkouts = workouts.filter((w) => w.date === todayKey());

  // Expõe o usuário com a foto customizada sobreposta — assim todo consumidor
  // (Dashboard, grupos, chat) usa a foto certa sem precisar saber que ela existe.
  const effectiveUser = user ? { ...user, photo: customPhoto ?? user.photo } : null;

  const value: Store = {
    user: effectiveUser, workouts, xp, claimedChallenges, checkins, customPhoto,
    setUser, addWorkout, claimChallenge, addCheckin, setCustomPhoto, logout,
    level: levelFromXp(xp),
    streak,
    badges: computeBadges(workouts, streak, xp),
    prs: computePRs(workouts),
    todaysChallenges: dailyChallenges(todayKey()),
    todaysWorkouts,
    todaysCheckin: checkins.find((c) => c.date === todayKey()),
    refreshGroupIds,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
