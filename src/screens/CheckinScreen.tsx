import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Theme, useTheme, FONT } from '../theme';
import { Card, Btn, FadeSlideIn } from '../components/UI';
import { useStore } from '../store';

const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function formatDate(d: Date) {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

function warn(msg: string) {
  Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Check-in', msg);
}

export function CheckinScreen() {
  const { theme: T } = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const { checkins, todaysCheckin, addCheckin } = useStore();
  const [busy, setBusy] = useState(false);
  const past = checkins.filter((c) => c.date !== todaysCheckin?.date);

  async function fromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      warn('Precisamos da permissão da câmera para tirar a foto-prova.');
      return;
    }
    setBusy(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.5,
        base64: true,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!result.canceled && result.assets?.[0]?.base64) {
        addCheckin(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch {
      warn('Não foi possível acessar a câmera. Tente escolher da galeria.');
    } finally {
      setBusy(false);
    }
  }

  async function fromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      warn('Precisamos da permissão de fotos para escolher a imagem.');
      return;
    }
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.5,
        base64: true,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!result.canceled && result.assets?.[0]?.base64) {
        addCheckin(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
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
              <Btn label="Tirar outra foto" variant="ghost" onPress={fromCamera} disabled={busy} />
            </>
          ) : (
            <>
              <View style={s.placeholder}>
                <Ionicons name="camera-outline" size={40} color={T.textDim} />
                <Text style={s.placeholderText}>Nenhuma foto ainda</Text>
              </View>
              <Btn label={busy ? 'Abrindo câmera…' : 'Tirar foto'} onPress={fromCamera} disabled={busy} />
              <Btn label="Escolher da galeria" variant="ghost" onPress={fromGallery} disabled={busy} />
            </>
          )}
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
                    <Image source={{ uri: c.photoUri }} style={s.thumb} />
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

function makeStyles(T: Theme) {
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
    doneTagText: { color: '#0F7A3D', fontFamily: FONT.extraBold, fontSize: 13 },
    sectionTitle: { color: T.text, fontFamily: FONT.extraBold, fontSize: 15, marginBottom: 10 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridItem: { width: 84, alignItems: 'center', gap: 4 },
    thumb: { width: 84, height: 84, borderRadius: 14, backgroundColor: T.surface2 },
    thumbDate: { color: T.textDim, fontFamily: FONT.regular, fontSize: 10 },
  });
}
