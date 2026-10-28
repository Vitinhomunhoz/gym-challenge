import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Theme, ThemeMode, useTheme, FONT } from '../theme';
import { Avatar, Btn, Card, FadeSlideIn, SelectPill } from '../components/UI';
import { useStore } from '../store';
import { hasFirebase, signOut } from '../firebase';
import { photoFromAsset } from '../photos';

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
  const [error, setError] = useState('');
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  async function pick(source: 'camera' | 'gallery') {
    setError('');
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(source === 'camera'
        ? 'Precisamos da permissão da câmera pra trocar sua foto.'
        : 'Precisamos da permissão de fotos pra trocar sua foto.');
      return;
    }
    setBusy(true);
    try {
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true, allowsEditing: true, aspect: [1, 1] })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.5, base64: true, allowsEditing: true, aspect: [1, 1] });
      if (result.canceled || !result.assets?.[0]) return;
      const photo = await photoFromAsset(result.assets[0]);
      if (!photo) {
        setError('Não foi possível ler essa foto. Tente outra.');
        return;
      }
      setCustomPhoto(photo);
    } catch {
      setError(source === 'camera'
        ? 'Não foi possível acessar a câmera. Tente escolher da galeria.'
        : 'Não foi possível abrir a galeria.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    if (hasFirebase && !user?.demo) await signOut();
    logout();
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
            <Btn label={busy ? 'Abrindo…' : 'Tirar foto'} onPress={() => pick('camera')} disabled={busy} />
            <Btn label="Escolher da galeria" variant="ghost" onPress={() => pick('gallery')} disabled={busy} />
            {!!customPhoto && (
              <Btn label="Remover foto" variant="ghost" onPress={() => setCustomPhoto(null)} disabled={busy} />
            )}
            {!!error && <Text style={s.error}>{error}</Text>}
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
        {confirmingLogout ? (
          <Card style={{ gap: 10 }}>
            <Text style={s.confirmText}>Sair da conta? Seus dados locais continuam salvos neste aparelho.</Text>
            <Btn label="Confirmar saída" onPress={handleLogout} />
            <Btn label="Cancelar" variant="ghost" onPress={() => setConfirmingLogout(false)} />
          </Card>
        ) : (
          <Btn label="Sair da conta" variant="ghost" onPress={() => setConfirmingLogout(true)} />
        )}
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
    error: { color: T.red, fontFamily: FONT.semiBold, fontSize: 13, textAlign: 'center' },
    confirmText: { color: T.text, fontFamily: FONT.regular, fontSize: 14, lineHeight: 20 },
  });
}
