// Paleta inspirada no GymRats: fundo claro, cards brancos com sombra,
// azul/roxo vibrante como cor de ação e laranja para streak/energia.
// A versão escura não é um simples inverter — foi pensada pra manter contraste legível.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const lightTheme = {
  bg: '#F3F4FB',
  surface: '#FFFFFF',
  surface2: '#F0F1F8',
  border: '#E9EAF4',
  text: '#171A2B',
  textDim: '#8C90A8',
  primary: '#5B5FEF',      // ação principal / navegação ativa
  primarySoft: '#EAEAFD',
  ember: '#FF6B35',        // streak / energia (mantém o conceito de "chama")
  emberSoft: '#FFE7DC',
  gold: '#FFB020',         // conquistas / XP
  goldSoft: '#FFF3DC',
  goldText: '#8A5A00',     // texto sobre goldSoft — T.gold puro não tem contraste suficiente como texto
  green: '#22C55E',
  greenSoft: '#DFFBEA',
  red: '#EF4444',
  radius: 20,
  shadow: '#171A2B',
};

export const darkTheme = {
  bg: '#0F1117',
  surface: '#1A1D29',
  surface2: '#242837',
  border: '#323748',
  text: '#F1F2F8',
  textDim: '#8B90A8',
  primary: '#7B7FFF',
  primarySoft: '#252A4A',
  ember: '#FF8659',
  emberSoft: '#3A2418',
  gold: '#FFC94D',
  goldSoft: '#3B2E12',
  goldText: '#FFD980',
  green: '#3ED67A',
  greenSoft: '#153A26',
  red: '#FF6B6B',
  radius: 20,
  shadow: '#000000',
};

export type Theme = typeof lightTheme;
export type ThemeMode = 'light' | 'dark' | 'auto';

// Mapeia cada peso usado nos estilos pro arquivo estático correspondente da Poppins
// (carregada em App.tsx via useFonts) — fontWeight sozinho não troca a face de uma
// fonte customizada, cada peso é uma fontFamily própria.
export const FONT = {
  regular: 'Poppins_400Regular',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extraBold: 'Poppins_800ExtraBold',
  black: 'Poppins_900Black',
};

const MODE_KEY = 'gymchallenge:themeMode';

type ThemeCtx = { theme: Theme; mode: ThemeMode; scheme: 'light' | 'dark'; setMode: (m: ThemeMode) => void };
const Ctx = createContext<ThemeCtx>(null as any);
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('auto');

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY).then((raw) => {
      if (raw === 'light' || raw === 'dark' || raw === 'auto') setModeState(raw);
    });
  }, []);

  function setMode(m: ThemeMode) {
    setModeState(m);
    AsyncStorage.setItem(MODE_KEY, m);
  }

  const scheme: 'light' | 'dark' = mode === 'auto' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  const theme = scheme === 'dark' ? darkTheme : lightTheme;

  return <Ctx.Provider value={{ theme, mode, scheme, setMode }}>{children}</Ctx.Provider>;
}
