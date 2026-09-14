import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Theme, useTheme, FONT } from '../theme';
import { Card, Btn, FadeSlideIn, Progress } from '../components/UI';
import { useStore } from '../store';

export function ChallengesScreen() {
  const { theme: T } = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const { todaysChallenges, todaysWorkouts, claimedChallenges, claimChallenge } = useStore();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={s.content}>
      <FadeSlideIn>
        <Text style={s.title}>Desafios de hoje</Text>
        <Text style={s.sub}>Novos desafios todo dia. Complete treinos para avançar e resgate o XP bônus.</Text>
      </FadeSlideIn>

      {todaysChallenges.length === 0 && (
        <FadeSlideIn delay={90}>
          <Card><Text style={s.sub}>Nenhum desafio disponível hoje. Volte amanhã!</Text></Card>
        </FadeSlideIn>
      )}

      {todaysChallenges.map((c, i) => {
        const progress = c.progress(todaysWorkouts);
        const done = progress >= c.target;
        const claimed = claimedChallenges.includes(c.id);
        return (
          <FadeSlideIn key={c.id} delay={90 + i * 80}>
            <Card style={{ gap: 10 }}>
              <View style={s.row}>
                <Text style={s.label}>{c.label}</Text>
                <View style={s.xpTag}><Text style={s.xp}>+{c.xp} XP</Text></View>
              </View>
              <Progress value={progress} max={c.target} color={done ? T.green : T.primary} />
              <View style={s.row}>
                <Text style={s.progressText}>
                  {Math.min(progress, c.target).toLocaleString('pt-BR')} / {c.target.toLocaleString('pt-BR')} {c.unit}
                </Text>
                {claimed ? (
                  <FadeSlideIn duration={280}><Text style={s.claimed}>✓ Resgatado</Text></FadeSlideIn>
                ) : done ? (
                  <Btn label="Resgatar XP" variant="gold" onPress={() => claimChallenge(c)} />
                ) : null}
              </View>
            </Card>
          </FadeSlideIn>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(T: Theme) {
  return StyleSheet.create({
    content: { padding: 16, gap: 14, paddingBottom: 32, maxWidth: 560, width: '100%', alignSelf: 'center' },
    title: { color: T.text, fontSize: 24, fontFamily: FONT.extraBold, marginTop: 8 },
    sub: { color: T.textDim, fontFamily: FONT.regular, fontSize: 13, lineHeight: 19 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { color: T.text, fontFamily: FONT.bold, fontSize: 15, flex: 1, paddingRight: 8 },
    xpTag: { backgroundColor: T.goldSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    xp: { color: T.goldText, fontFamily: FONT.extraBold, fontSize: 12 },
    progressText: { color: T.textDim, fontFamily: FONT.regular, fontSize: 12 },
    claimed: { color: T.green, fontFamily: FONT.bold, fontSize: 13 },
  });
}
