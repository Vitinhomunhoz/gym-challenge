import React, { useMemo, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, useTheme, FONT } from '../theme';
import { Card, FadeSlideIn } from '../components/UI';
import { useStore } from '../store';
import { monthCells, todayKey, Checkin } from '../gamification';

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function CalendarCell({ date, trained, isToday, checkin, s }: {
  date: string; trained: boolean; isToday: boolean; checkin?: Checkin; s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={s.cell}>
      <View style={[s.shape, trained && !checkin && s.shapeTrained, isToday && s.shapeToday]}>
        {checkin ? (
          <>
            <Image source={{ uri: checkin.photoUri }} style={s.cellPhoto} />
            <View style={s.photoOverlay}>
              <Text style={s.photoText}>{parseInt(date.slice(-2))}</Text>
            </View>
          </>
        ) : (
          <Text style={[s.cellText, trained && { color: '#fff', fontFamily: FONT.extraBold }]}>
            {parseInt(date.slice(-2))}
          </Text>
        )}
      </View>
    </View>
  );
}

export function HistoryScreen() {
  const { theme: T } = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const { workouts, checkins, prs } = useStore();
  const trained = new Set(workouts.map((w) => w.date));
  const checkinDays = new Set(checkins.map((c) => c.date));

  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const isCurrentMonth = cursor.y === now.getFullYear() && cursor.m === now.getMonth();
  const cells = monthCells(cursor.y, cursor.m);

  function shiftMonth(delta: number) {
    setCursor(({ y, m }) => {
      const next = new Date(y, m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={s.content}>
      <FadeSlideIn><Text style={s.title}>Histórico</Text></FadeSlideIn>

      <FadeSlideIn delay={70}>
        <Card>
          <View style={s.monthRow}>
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={8} accessibilityLabel="Mês anterior">
              <Ionicons name="chevron-back" size={20} color={T.primary} />
            </Pressable>
            <Text style={s.month}>{MONTHS[cursor.m]} {cursor.y}</Text>
            <Pressable
              onPress={() => shiftMonth(1)}
              disabled={isCurrentMonth}
              hitSlop={8}
              accessibilityLabel="Próximo mês"
            >
              <Ionicons name="chevron-forward" size={20} color={isCurrentMonth ? T.border : T.primary} />
            </Pressable>
          </View>
          <View style={s.grid}>
            {WEEK.map((d, i) => <Text key={`w${i}`} style={s.weekday}>{d}</Text>)}
            {cells.map((key, i) => {
              const photo = key ? checkins.find((c) => c.date === key && c.photoUri) : undefined;
              return key === null ? <View key={`e${i}`} style={s.cell} /> : (
                <CalendarCell
                  key={key}
                  date={key}
                  trained={trained.has(key) || checkinDays.has(key)}
                  isToday={key === todayKey()}
                  checkin={photo}
                  s={s}
                />
              );
            })}
          </View>
        </Card>
      </FadeSlideIn>

      <FadeSlideIn delay={140}>
        <Card>
          <View style={s.sectionRow}>
            <Ionicons name="trophy" size={16} color={T.gold} />
            <Text style={[s.section, { marginBottom: 0 }]}>Recordes pessoais (PRs)</Text>
          </View>
          {prs.length === 0
            ? <Text style={s.empty}>Registre treinos com carga para ver seus recordes aqui.</Text>
            : prs.slice(0, 8).map((p) => (
                <View key={p.name} style={s.prRow}>
                  <Text style={s.prName}>{p.name}</Text>
                  <Text style={s.prWeight}>{p.weight} kg</Text>
                </View>
              ))}
        </Card>
      </FadeSlideIn>

      <FadeSlideIn delay={210}>
        <Card>
          <Text style={s.section}>Últimos treinos</Text>
          {workouts.length === 0
            ? <Text style={s.empty}>Nenhum treino ainda. Bora começar?</Text>
            : workouts.slice(0, 10).map((w) => (
                <View key={w.id} style={s.prRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.prName}>{w.title}</Text>
                    <Text style={s.workoutMeta}>
                      {w.date.split('-').reverse().join('/')} · {w.exercises?.length ?? 0} exercícios · {(w.volume || 0).toLocaleString('pt-BR')} kg
                    </Text>
                  </View>
                  <Text style={s.xp}>+{w.xp} XP</Text>
                </View>
              ))}
        </Card>
      </FadeSlideIn>
    </ScrollView>
  );
}

function makeStyles(T: Theme) {
  return StyleSheet.create({
    content: { padding: 16, gap: 14, paddingBottom: 32, maxWidth: 560, width: '100%', alignSelf: 'center' },
    title: { color: T.text, fontSize: 24, fontFamily: FONT.extraBold, marginTop: 8 },
    monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    month: { color: T.text, fontFamily: FONT.extraBold, fontSize: 15, textAlign: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    weekday: { width: `${100 / 7}%`, textAlign: 'center', color: T.textDim, fontSize: 11, fontFamily: FONT.bold, marginBottom: 6 },
    cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    shape: {
      width: '82%', height: '82%', borderRadius: 999, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    shapeTrained: { backgroundColor: T.ember },
    shapeToday: { borderWidth: 2, borderColor: T.gold },
    cellText: { color: T.textDim, fontFamily: FONT.regular, fontSize: 13 },
    cellPhoto: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    photoOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(10,12,20,0.32)', alignItems: 'center', justifyContent: 'center',
    },
    photoText: { color: '#fff', fontFamily: FONT.extraBold, fontSize: 13 },
    section: { color: T.text, fontFamily: FONT.extraBold, fontSize: 15, marginBottom: 10 },
    sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    empty: { color: T.textDim, fontFamily: FONT.regular, fontSize: 13 },
    prRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: T.border },
    prName: { color: T.text, fontFamily: FONT.semiBold, fontSize: 14 },
    prWeight: { color: T.goldText, fontFamily: FONT.extraBold },
    workoutMeta: { color: T.textDim, fontFamily: FONT.regular, fontSize: 11, marginTop: 2 },
    xp: { color: T.goldText, fontFamily: FONT.bold, fontSize: 13 },
  });
}
