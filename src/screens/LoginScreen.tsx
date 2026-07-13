import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme, useTheme } from '../theme';
import { Btn, FadeSlideIn } from '../components/UI';
import { hasFirebase, signInWithGoogle } from '../firebase';
import { useStore } from '../store';

export function LoginScreen() {
  const { theme: T } = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const { setUser } = useStore();
  const [error, setError] = useState('');

  async function handleGoogle() {
    try {
      setError('');
      setUser(await signInWithGoogle());
    } catch (e: any) {
      if (e?.code !== 'auth/popup-closed-by-user') setError(e.message ?? 'Falha no login.');
    }
  }

  return (
    <View style={s.container}>
      <FadeSlideIn duration={520} style={{ width: '100%', alignItems: 'center' }}>
        <LinearGradient colors={[T.primary, '#9B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <View style={s.logoBadge}>
            <Text style={s.logoIcon}>🏋️</Text>
          </View>
          <Text style={s.title}>GYM CHALLENGE</Text>
          <Text style={s.subtitle}>Sua evolução vira jogo. Treine, complete{'\n'}desafios e suba de nível.</Text>
        </LinearGradient>
      </FadeSlideIn>

      <FadeSlideIn delay={160} style={s.actions}>
        <Btn label="Entrar com Google" onPress={handleGoogle} disabled={!hasFirebase} />
        <Btn label="Entrar em Modo Demo" variant="ghost"
          onPress={() => setUser({ uid: 'demo', name: 'Atleta Demo', demo: true })} />
      </FadeSlideIn>

      {!hasFirebase && (
        <Text style={s.hint}>
          Login Google desativado: configure suas credenciais em src/firebase.ts.{'\n'}O Modo Demo salva tudo localmente.
        </Text>
      )}
      {!!error && <Text style={[s.hint, { color: T.red }]}>{error}</Text>}
    </View>
  );
}

function makeStyles(T: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
    hero: {
      width: '100%', maxWidth: 380, borderRadius: 32, paddingVertical: 44, paddingHorizontal: 28, alignItems: 'center',
      shadowColor: T.primary, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 6,
    },
    logoBadge: {
      width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    logoIcon: { fontSize: 40 },
    title: { color: '#fff', fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
    subtitle: { color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 12, lineHeight: 20, fontSize: 13 },
    actions: { width: '100%', maxWidth: 340, gap: 12, marginTop: 32 },
    hint: { color: T.textDim, fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 18, maxWidth: 320 },
  });
}
