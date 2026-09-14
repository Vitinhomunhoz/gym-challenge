import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Theme, ThemeMode, useTheme, FONT } from '../theme';
import { Avatar, Btn, Card, FadeSlideIn, SelectPill } from '../components/UI';
import { useStore } from '../store';
import { hasFirebase, signOut } from '../firebase';

function warn(msg: string) {
  Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Perfil', msg);
}

const MODE_OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Escuro' },
  { key: 'auto', label: 'Automático' },
];

export function ProfileScreen({ onBack }: { onBack: () => void }) {
  const { theme: T, mode, setMode } = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const { user, customPhoto, setCustomPhoto, logout } = useStore();
  const [busy, setBusy] = useState(false);

  async function fromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { warn('Precisamos da permissão da câmera pra trocar sua foto.'); return; }
    setBusy(true);
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true, allowsEditing: true, aspect: [1, 1] });
      if (!result.canceled && result.assets?.[0]?.base64) {
        setCustomPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch {
      warn('Não foi possível acessar a câmera. Tente escolher da galeria.');
    } finally {
      setBusy(false);
    }
  }

  async function fromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { warn('Precisamos da permissão de fotos pra trocar sua foto.'); return; }
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.5, base64: true, allowsEditing: true, aspect: [1, 1] });
      if (!result.canceled && result.assets?.[0]?.base64) {
        setCustomPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    const msg = 'Sair da conta? Seus dados locais continuam salvos neste aparelho.';
    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
      if (hasFirebase && !user?.demo) await signOut();
      logout();
      return;
    }
    Alert.alert('Sair da conta', msg, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair', style: 'destructive', onPress: async () => {
          if (hasFirebase && !user?.demo) await signOut();
          logout();
        },
      },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={s.content}>
      <FadeSlideIn>
        <View style={s.headerRow}>
          <Btn label="← Voltar" variant="ghost" onPress={onBack} />
          <Text style={s.title}>Perfil</Text>
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={60}>
        <Card style={s.photoCard}>
          <Avatar name={user?.name ?? '?'} photo={user?.photo} size={96} />
          <Text style={s.name}>{user?.name}</Text>
          <View style={s.photoActions}>
            <Btn label={busy ? 'Abrindo câmera…' : 'Tirar foto'} onPress={fromCamera} disabled={busy} />
            <Btn label="Escolher da galeria" variant="ghost" onPress={fromGallery} disabled={busy} />
            {!!customPhoto && (
              <Btn label="Remover foto" variant="ghost" onPress={() => setCustomPhoto(null)} disabled={busy} />
            )}
          </View>
        </Card>
      </FadeSlideIn>

      <FadeSlideIn delay={120}>
        <Card>
          <Text style={s.sectionTitle}>Aparência</Text>
          <View style={s.pillRow}>
            {MODE_OPTIONS.map((o) => (
              <SelectPill key={o.key} label={o.label} active={mode === o.key} onPress={() => setMode(o.key)} />
            ))}
          </View>
        </Card>
      </FadeSlideIn>

      <FadeSlideIn delay={180}>
        <Btn label="Sair da conta" variant="ghost" onPress={handleLogout} />
      </FadeSlideIn>
    </ScrollView>
  );
}

function makeStyles(T: Theme) {
  return StyleSheet.create({
    content: { padding: 16, gap: 14, paddingBottom: 32, maxWidth: 560, width: '100%', alignSelf: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: { color: T.text, fontSize: 20, fontFamily: FONT.extraBold },
    photoCard: { alignItems: 'center', gap: 12 },
    name: { color: T.text, fontSize: 17, fontFamily: FONT.extraBold },
    photoActions: { width: '100%', gap: 10, marginTop: 4 },
    sectionTitle: { color: T.text, fontFamily: FONT.extraBold, fontSize: 15, marginBottom: 10 },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });
}
