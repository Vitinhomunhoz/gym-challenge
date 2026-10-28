import React, { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from 'react-native';
import { Theme, useTheme, FONT } from '../theme';
import { Card, Btn, FadeSlideIn } from '../components/UI';
import { useStore } from '../store';
import { Exercise, parseReps, parseWeight } from '../gamification';

type DraftSet = { key: string; reps: string; weight: string };
type Draft = { key: string; name: string; sets: DraftSet[] };
const draftKey = () => Math.random().toString(36).slice(2, 9);
const emptySet = (): DraftSet => ({ key: draftKey(), reps: '', weight: '' });
const emptyExercise = (): Draft => ({ key: draftKey(), name: '', sets: [emptySet()] });

export function WorkoutScreen({ onSaved }: { onSaved: (xp: number) => void }) {
  const { theme: T } = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const { addWorkout } = useStore();
  const [title, setTitle] = useState('');
  const [exercises, setExercises] = useState<Draft[]>([emptyExercise()]);
  const [error, setError] = useState('');
  const saving = useRef(false);

  // JSON clone: structuredClone não está disponível no Hermes (Android/iOS)
  const update = (fn: (d: Draft[]) => Draft[]) => setExercises((prev) => fn(JSON.parse(JSON.stringify(prev))));

  function save() {
    if (saving.current) return;
    const clean: Exercise[] = exercises
      .map((e) => ({
        name: e.name.trim(),
        sets: e.sets
          .map((s) => ({ reps: parseReps(s.reps), weight: parseWeight(s.weight) }))
          .filter((s) => s.reps > 0),
      }))
      .filter((e) => e.name && e.sets.length > 0);

    if (clean.length === 0) {
      setError('Adicione ao menos um exercício com nome e uma série com repetições.');
      return;
    }
    saving.current = true;
    try {
      const w = addWorkout(title, clean);
      if (!w) {
        setError('Adicione ao menos um exercício com nome e uma série com repetições.');
        return;
      }
      setError('');
      setTitle('');
      setExercises([emptyExercise()]);
      onSaved(w.xp);
    } finally {
      saving.current = false;
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={s.content}>
      <FadeSlideIn>
        <Text style={s.title}>Registrar treino</Text>

        <TextInput
          style={s.input}
          placeholder="Nome do treino (ex: Treino A — Peito e Tríceps)"
          placeholderTextColor={T.textDim}
          value={title}
          onChangeText={(v) => { setTitle(v); setError(''); }}
        />
        {!!error && <Text style={s.error}>{error}</Text>}
      </FadeSlideIn>

      {exercises.map((ex, i) => (
        <FadeSlideIn key={ex.key} duration={320}>
          <Card style={{ gap: 10 }}>
            <View style={s.exHeader}>
              <TextInput
                style={[s.input, { flex: 1, marginBottom: 0 }]}
                placeholder={`Exercício ${i + 1} (ex: Supino reto)`}
                placeholderTextColor={T.textDim}
                value={ex.name}
                onChangeText={(v) => { setError(''); update((d) => ((d[i].name = v), d)); }}
              />
              {exercises.length > 1 && (
                <Pressable onPress={() => update((d) => (d.splice(i, 1), d))}>
                  <Text style={s.remove}>✕</Text>
                </Pressable>
              )}
            </View>

            <View style={s.setHeaderRow}>
              <Text style={s.setLabel}>SÉRIE</Text>
              <Text style={s.setLabel}>REPS</Text>
              <Text style={s.setLabel}>CARGA (KG)</Text>
              <View style={{ width: 24 }} />
            </View>

            {ex.sets.map((st, j) => (
              <FadeSlideIn key={st.key} duration={260}>
                <View style={s.setRow}>
                  <Text style={s.setNum}>{j + 1}</Text>
                  <TextInput
                    style={s.setInput} keyboardType="number-pad" placeholder="12" placeholderTextColor={T.textDim}
                    value={st.reps} onChangeText={(v) => update((d) => ((d[i].sets[j].reps = v), d))}
                  />
                  <TextInput
                    style={s.setInput} keyboardType="decimal-pad" placeholder="40" placeholderTextColor={T.textDim}
                    value={st.weight} onChangeText={(v) => update((d) => ((d[i].sets[j].weight = v), d))}
                  />
                  <Pressable onPress={() => update((d) => (d[i].sets.length > 1 && d[i].sets.splice(j, 1), d))}>
                    <Text style={s.remove}>✕</Text>
                  </Pressable>
                </View>
              </FadeSlideIn>
            ))}

            <Btn label="+ Série" variant="ghost" onPress={() => update((d) => (d[i].sets.push(emptySet()), d))} />
          </Card>
        </FadeSlideIn>
      ))}

      <Btn label="+ Exercício" variant="ghost" onPress={() => update((d) => (d.push(emptyExercise()), d))} />
      <Btn label="Concluir treino" onPress={save} />
    </ScrollView>
  );
}

function makeStyles(T: Theme) {
  return StyleSheet.create({
    content: { padding: 16, gap: 14, paddingBottom: 32, maxWidth: 560, width: '100%', alignSelf: 'center' },
    title: { color: T.text, fontSize: 24, fontFamily: FONT.extraBold, marginTop: 8 },
    input: {
      backgroundColor: T.surface2, borderRadius: 14,
      color: T.text, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, marginBottom: 2, fontFamily: FONT.regular,
    },
    exHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    setHeaderRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 4 },
    setLabel: { flex: 1, color: T.textDim, fontSize: 10, fontFamily: FONT.bold, letterSpacing: 1 },
    setRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    setNum: { flex: 1, color: T.primary, fontFamily: FONT.extraBold, textAlign: 'center' },
    setInput: {
      flex: 1, backgroundColor: T.surface2, borderRadius: 12,
      color: T.text, paddingVertical: 11, textAlign: 'center', fontFamily: FONT.semiBold,
    },
    remove: { color: T.textDim, fontFamily: FONT.regular, fontSize: 16, width: 24, textAlign: 'center' },
    error: { color: T.red, fontFamily: FONT.semiBold, fontSize: 13, lineHeight: 18 },
  });
}
