import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { Theme, useTheme } from '../theme';
import { Card, Btn, FadeSlideIn } from '../components/UI';
import { useStore } from '../store';
import { Exercise } from '../gamification';

type Draft = { name: string; sets: { reps: string; weight: string }[] };
const emptySet = () => ({ reps: '', weight: '' });

export function WorkoutScreen({ onSaved }: { onSaved: (xp: number) => void }) {
  const { theme: T } = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const { addWorkout } = useStore();
  const [title, setTitle] = useState('');
  const [exercises, setExercises] = useState<Draft[]>([{ name: '', sets: [emptySet()] }]);

  // JSON clone: structuredClone não está disponível no Hermes (Android/iOS)
  const update = (fn: (d: Draft[]) => Draft[]) => setExercises((prev) => fn(JSON.parse(JSON.stringify(prev))));

  function save() {
    const clean: Exercise[] = exercises
      .map((e) => ({
        name: e.name.trim(),
        sets: e.sets
          .map((s) => ({ reps: parseInt(s.reps) || 0, weight: parseFloat(s.weight.replace(',', '.')) || 0 }))
          .filter((s) => s.reps > 0),
      }))
      .filter((e) => e.name && e.sets.length > 0);

    if (clean.length === 0) {
      const msg = 'Adicione ao menos um exercício com nome e uma série com repetições.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Treino vazio', msg);
      return;
    }
    const w = addWorkout(title, clean);
    setTitle('');
    setExercises([{ name: '', sets: [emptySet()] }]);
    onSaved(w.xp);
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
          onChangeText={setTitle}
        />
      </FadeSlideIn>

      {exercises.map((ex, i) => (
        <FadeSlideIn key={i} duration={320}>
          <Card style={{ gap: 10 }}>
            <View style={s.exHeader}>
              <TextInput
                style={[s.input, { flex: 1, marginBottom: 0 }]}
                placeholder={`Exercício ${i + 1} (ex: Supino reto)`}
                placeholderTextColor={T.textDim}
                value={ex.name}
                onChangeText={(v) => update((d) => ((d[i].name = v), d))}
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
              <FadeSlideIn key={j} duration={260}>
                <View style={s.setRow}>
                  <Text style={s.setNum}>{j + 1}</Text>
                  <TextInput
                    style={s.setInput} keyboardType="numeric" placeholder="12" placeholderTextColor={T.textDim}
                    value={st.reps} onChangeText={(v) => update((d) => ((d[i].sets[j].reps = v), d))}
                  />
                  <TextInput
                    style={s.setInput} keyboardType="numeric" placeholder="40" placeholderTextColor={T.textDim}
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

      <Btn label="+ Exercício" variant="ghost" onPress={() => update((d) => (d.push({ name: '', sets: [emptySet()] }), d))} />
      <Btn label="Concluir treino 💪" onPress={save} />
    </ScrollView>
  );
}

function makeStyles(T: Theme) {
  return StyleSheet.create({
    content: { padding: 16, gap: 14, paddingBottom: 32, maxWidth: 560, width: '100%', alignSelf: 'center' },
    title: { color: T.text, fontSize: 24, fontWeight: '800', marginTop: 8 },
    input: {
      backgroundColor: T.surface2, borderRadius: 14,
      color: T.text, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, marginBottom: 2,
    },
    exHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    setHeaderRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 4 },
    setLabel: { flex: 1, color: T.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
    setRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    setNum: { flex: 1, color: T.primary, fontWeight: '800', textAlign: 'center' },
    setInput: {
      flex: 1, backgroundColor: T.surface2, borderRadius: 12,
      color: T.text, paddingVertical: 11, textAlign: 'center',
    },
    remove: { color: T.textDim, fontSize: 16, width: 24, textAlign: 'center' },
  });
}
