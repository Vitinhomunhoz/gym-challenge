import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, SafeAreaView, Animated, Easing, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold, Poppins_900Black,
} from '@expo-google-fonts/poppins';
import { Theme, ThemeProvider, useTheme, FONT } from './src/theme';
import { StoreProvider, useStore } from './src/store';
import { watchAuth, consumeRedirectError } from './src/firebase';
import { FadeSlideIn } from './src/components/UI';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { ChallengesScreen } from './src/screens/ChallengesScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { CheckinScreen } from './src/screens/CheckinScreen';
import { GroupsScreen } from './src/screens/GroupsScreen';

type Tab = 'home' | 'treino' | 'checkin' | 'desafios' | 'grupos' | 'historico';
const TABS: { key: Tab; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: 'home', icon: 'home-outline', iconActive: 'home', label: 'Início' },
  { key: 'treino', icon: 'barbell-outline', iconActive: 'barbell', label: 'Treino' },
  { key: 'checkin', icon: 'camera-outline', iconActive: 'camera', label: 'Check-in' },
  { key: 'desafios', icon: 'flag-outline', iconActive: 'flag', label: 'Desafios' },
  { key: 'grupos', icon: 'people-outline', iconActive: 'people', label: 'Grupos' },
  { key: 'historico', icon: 'calendar-outline', iconActive: 'calendar', label: 'Histórico' },
];

function Main() {
  const { theme: T, scheme } = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const { user, setUser } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [loginError, setLoginError] = useState('');
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const tabAnims = useRef<Record<Tab, Animated.Value>>({
    home: new Animated.Value(1), treino: new Animated.Value(0), checkin: new Animated.Value(0),
    desafios: new Animated.Value(0), grupos: new Animated.Value(0), historico: new Animated.Value(0),
  }).current;

  // Restaura sessão do Firebase (se configurado). Propaga null também — se a sessão
  // cair (token expirado, logout em outra aba), a tela precisa voltar pro login em
  // vez de continuar "presa" mostrando um usuário sem sessão real por trás (o que só
  // aparece depois, como "Missing or insufficient permissions" numa escrita).
  useEffect(() => watchAuth((u) => setUser(u)), []);

  // Login com Google usa redirect (mais confiável no Safari/mobile que popup) — ao
  // voltar do Google, o app recarrega e aqui a gente pega se deu erro (ex: usuário
  // cancelou). Sucesso não precisa de tratamento: watchAuth acima já cobre. Isso
  // acontece com o usuário ainda deslogado, então mostra na tela de login (o toast
  // abaixo só existe na árvore de quem já está logado).
  useEffect(() => {
    consumeRedirectError().then((err) => { if (err) setLoginError(err); });
  }, []);

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
        <LoginScreen externalError={loginError} />
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
            <WorkoutScreen onSaved={(xp) => { setToast(`Treino salvo! +${xp} XP`); setTab('home'); }} />
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
                <Animated.View style={{ transform: [{ scale: active.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }] }}>
                  <Ionicons
                    name={tab === t.key ? t.iconActive : t.icon}
                    size={20}
                    color={tab === t.key ? T.primary : T.textDim}
                  />
                </Animated.View>
              </Animated.View>
              <Animated.Text
                style={[s.tabLabel, { color: active.interpolate({ inputRange: [0, 1], outputRange: [T.textDim, T.primary] }) }, tab === t.key && { fontFamily: FONT.extraBold }]}
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
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold, Poppins_900Black,
    // Na web, o Ionicons não vem pré-registrado como nas plataformas nativas — sem
    // isto, cada ícone renderiza como um quadrado vazio (glifo não encontrado).
    ...Ionicons.font,
  });
  // Trava de segurança: se o carregamento da fonte nunca resolver por algum motivo
  // (rede lenta, navegador específico), depois de 4s libera o app mesmo assim com a
  // fonte do sistema — uma fonte "errada" é sempre melhor que a tela travada pra sempre.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // Sem tela de loading própria (T.bg) aqui: o ThemeProvider ainda não montou nesse
  // ponto, então usa só a cor de fundo clara padrão até a fonte carregar (é rápido).
  if (!fontsLoaded && !fontError && !timedOut) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F3F4FB', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#5B5FEF" />
      </View>
    );
  }

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
    tabLabel: { color: T.textDim, fontSize: 11, fontFamily: FONT.regular },
    toast: {
      position: 'absolute', bottom: 90, alignSelf: 'center', backgroundColor: T.gold,
      paddingVertical: 12, paddingHorizontal: 22, borderRadius: 999,
      shadowColor: T.gold, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 4,
    },
    toastText: { color: '#3D2600', fontFamily: FONT.extraBold },
  });
}
