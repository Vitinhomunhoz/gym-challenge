import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, SafeAreaView, Animated, Easing } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Theme, ThemeProvider, useTheme } from './src/theme';
import { StoreProvider, useStore } from './src/store';
import { watchAuth } from './src/firebase';
import { FadeSlideIn } from './src/components/UI';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { ChallengesScreen } from './src/screens/ChallengesScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { CheckinScreen } from './src/screens/CheckinScreen';
import { GroupsScreen } from './src/screens/GroupsScreen';

type Tab = 'home' | 'treino' | 'checkin' | 'desafios' | 'grupos' | 'historico';
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'home', icon: '🏠', label: 'Início' },
  { key: 'treino', icon: '💪', label: 'Treino' },
  { key: 'checkin', icon: '📸', label: 'Check-in' },
  { key: 'desafios', icon: '🎯', label: 'Desafios' },
  { key: 'grupos', icon: '👥', label: 'Grupos' },
  { key: 'historico', icon: '📅', label: 'Histórico' },
];

function Main() {
  const { theme: T, scheme } = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const { user, setUser } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const tabAnims = useRef<Record<Tab, Animated.Value>>({
    home: new Animated.Value(1), treino: new Animated.Value(0), checkin: new Animated.Value(0),
    desafios: new Animated.Value(0), grupos: new Animated.Value(0), historico: new Animated.Value(0),
  }).current;

  // Restaura sessão do Firebase (se configurado)
  useEffect(() => watchAuth((u) => u && setUser(u)), []);

  useEffect(() => {
    TABS.forEach((t) => {
      Animated.spring(tabAnims[t.key], {
        toValue: t.key === tab ? 1 : 0,
        useNativeDriver: false, // anima cor de fundo/texto, incompatível com o native driver
        speed: 20, bounciness: 8,
      }).start();
    });
  }, [tab]);

  useEffect(() => {
    if (!toast) return;
    setToastVisible(true);
    Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 10 }).start();
    const t = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start(() => { setToastVisible(false); setToast(''); });
    }, 2200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!user) {
    return (
      <>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <LoginScreen />
      </>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        <FadeSlideIn key={tab} style={{ flex: 1 }} duration={260}>
          {tab === 'home' && <DashboardScreen />}
          {tab === 'treino' && (
            <WorkoutScreen onSaved={(xp) => { setToast(`Treino salvo! +${xp} XP 🔥`); setTab('home'); }} />
          )}
          {tab === 'checkin' && <CheckinScreen />}
          {tab === 'desafios' && <ChallengesScreen />}
          {tab === 'grupos' && <GroupsScreen />}
          {tab === 'historico' && <HistoryScreen />}
        </FadeSlideIn>
      </View>

      {toastVisible && (
        <Animated.View
          style={[
            s.toast,
            {
              opacity: toastAnim,
              transform: [
                { translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                { scale: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
              ],
            },
          ]}
        >
          <Text style={s.toastText}>{toast}</Text>
        </Animated.View>
      )}

      <View style={s.tabBar}>
        {TABS.map((t) => {
          const active = tabAnims[t.key];
          return (
            <Pressable key={t.key} style={s.tab} onPress={() => setTab(t.key)}>
              <Animated.View
                style={[
                  s.tabPill,
                  { backgroundColor: active.interpolate({ inputRange: [0, 1], outputRange: ['#FFFFFF00', T.primarySoft] }) },
                ]}
              >
                <Animated.Text
                  style={{ fontSize: 18, transform: [{ scale: active.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }] }}
                >
                  {t.icon}
                </Animated.Text>
              </Animated.View>
              <Animated.Text
                style={[s.tabLabel, { color: active.interpolate({ inputRange: [0, 1], outputRange: [T.textDim, T.primary] }) }, tab === t.key && { fontWeight: '800' }]}
              >
                {t.label}
              </Animated.Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <StoreProvider>
        <Main />
      </StoreProvider>
    </ThemeProvider>
  );
}

function makeStyles(T: Theme) {
  return StyleSheet.create({
    tabBar: {
      flexDirection: 'row', backgroundColor: T.surface,
      paddingVertical: 8, paddingBottom: 14, maxWidth: 560, width: '100%', alignSelf: 'center',
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      shadowColor: T.shadow, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 8,
    },
    tab: { flex: 1, alignItems: 'center', gap: 3 },
    tabPill: { paddingHorizontal: 16, paddingVertical: 5, borderRadius: 999 },
    tabLabel: { color: T.textDim, fontSize: 11 },
    toast: {
      position: 'absolute', bottom: 90, alignSelf: 'center', backgroundColor: T.gold,
      paddingVertical: 12, paddingHorizontal: 22, borderRadius: 999,
      shadowColor: T.gold, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 4,
    },
    toastText: { color: '#3D2600', fontWeight: '800' },
  });
}
