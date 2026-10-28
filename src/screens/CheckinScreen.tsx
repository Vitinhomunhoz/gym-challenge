import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Theme, useTheme, FONT } from '../theme';
import { Card, Btn, FadeSlideIn } from '../components/UI';
import { useStore } from '../store';
import { photoFromAsset } from '../photos';

const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function formatDate(d: Date) {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function CheckinScreen() {
  const { theme: T, scheme } = useTheme();
  const s = useMemo(() => makeStyles(T, scheme === 'dark'), [T, scheme]);
  const { checkins, todaysCheckin, addCheckin } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const past = checkins.filter((c) => c.date !== todaysCheckin?.date);

  async function pick(source: 'camera' | 'gallery') {
    setError('');
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(source === 'camera'
        ? 'Precisamos da permissão da câmera para tirar a foto-prova.'
        : 'Precisamos da permissão de fotos para escolher a imagem.');
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
      addCheckin(photo);
    } catch {
      setError(source === 'camera'
        ? 'Não foi possível acessar a câmera. Tente escolher da galeria.'
        : 'Não foi possível abrir a galeria.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={s.content}>
      <FadeSlideIn>
        <Text style={s.title}>Check-in do treino</Text>
        <Text style={s.sub}>Tire uma foto na academia para comprovar que você foi treinar hoje.</Text>
      </FadeSlideIn>

      <FadeSlideIn delay={80}>
        <Card style={{ gap: 14, alignItems: 'center' }}>
          <Text style={s.today}>{formatDate(new Date())}</Text>

          {todaysCheckin ? (
            <>
              <Image source={{ uri: todaysCheckin.photoUri }} style={s.photo} />
              <View style={s.doneTag}><Text style={s.doneTagText}>✓ Comprovado hoje</Text></View>
            </>
          ) : (
            <View style={s.placeholder}>
              <Ionicons name="camera-outline" size={40} color={T.textDim} />
              <Text style={s.placeholderText}>Nenhuma foto ainda</Text>
            </View>
          )}
          <Btn label={busy ? 'Abrindo…' : todaysCheckin ? 'Tirar outra foto' : 'Tirar foto'} onPress={() => pick('camera')} disabled={busy} />
          <Btn label="Escolher da galeria" variant="ghost" onPress={() => pick('gallery')} disabled={busy} />
          {!!error && <Text style={s.error}>{error}</Text>}
        </Card>
      </FadeSlideIn>

      {past.length > 0 && (
        <FadeSlideIn delay={160}>
          <Card>
            <Text style={s.sectionTitle}>Check-ins anteriores</Text>
            <View style={s.grid}>
              {past.map((c, i) => (
                <FadeSlideIn key={c.date} delay={160 + i * 40}>
                  <View style={s.gridItem}>
                    {c.photoUri ? <Image source={{ uri: c.photoUri }} style={s.thumb} /> : <View style={s.thumb} />}
                    <Text style={s.thumbDate}>{c.date.split('-').reverse().join('/')}</Text>
                  </View>
                </FadeSlideIn>
              ))}
            </View>
          </Card>
        </FadeSlideIn>
      )}
    </ScrollView>
  );
}

function makeStyles(T: Theme, dark: boolean) {
  return StyleSheet.create({
    content: { padding: 16, gap: 14, paddingBottom: 32, maxWidth: 560, width: '100%', alignSelf: 'center' },
    title: { color: T.text, fontSize: 24, fontFamily: FONT.extraBold, marginTop: 8 },
    sub: { color: T.textDim, fontFamily: FONT.regular, fontSize: 13, lineHeight: 19 },
    today: { color: T.primary, fontFamily: FONT.extraBold, fontSize: 14 },
    placeholder: {
      width: 200, height: 200, borderRadius: 20, backgroundColor: T.surface2,
      alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderColor: T.border, borderStyle: 'dashed',
    },
    placeholderText: { color: T.textDim, fontFamily: FONT.regular, fontSize: 12 },
    photo: { width: 200, height: 200, borderRadius: 20 },
    doneTag: { backgroundColor: T.greenSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
    doneTagText: { color: dark ? T.green : '#146C36', fontFamily: FONT.extraBold, fontSize: 13 },
    error: { color: T.red, fontFamily: FONT.semiBold, fontSize: 13, textAlign: 'center' },
    sectionTitle: { color: T.text, fontFamily: FONT.extraBold, fontSize: 15, marginBottom: 10 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridItem: { width: 84, alignItems: 'center', gap: 4 },
    thumb: { width: 84, height: 84, borderRadius: 14, backgroundColor: T.surface2 },
    thumbDate: { color: T.textDim, fontFamily: FONT.regular, fontSize: 10 },
  });
}
