import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, useTheme, FONT } from '../theme';
import { Avatar, Card, FadeSlideIn, LevelRing, Progress, Stat } from '../components/UI';
import { useStore } from '../store';
import { levelTitle, xpForLevel } from '../gamification';
import { ProfileScreen } from './ProfileScreen';

export function DashboardScreen() {
  const { theme: T } = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const { user, xp, level, streak, workouts, badges, todaysChallenges, todaysWorkouts, claimedChallenges } = useStore();
  const [showProfile, setShowProfile] = useState(false);

  const currentBase = xpForLevel(level);
  const nextTarget = xpForLevel(level + 1);
  const pct = (xp - currentBase) / (nextTarget - currentBase);
  const totalVolume = workouts.reduce((a, w) => a + w.volume, 0);
  const unlocked = badges.filter((b) => b.unlocked);
  const challengesDone = todaysChallenges.filter(
    (c) => claimedChallenges.includes(c.id) || c.progress(todaysWorkouts) >= c.target
  ).length;

  if (showProfile) return <ProfileScreen onBack={() => setShowProfile(false)} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={s.content}>
      <FadeSlideIn>
        <Pressable style={s.greetingRow} onPress={() => setShowProfile(true)}>
          <Avatar name={user?.name ?? '?'} photo={user?.photo} />
          <View>
            <Text style={s.greetingHi}>Olá,</Text>
            <Text style={s.greeting}>{user?.name.split(' ')[0]}</Text>
          </View>
        </Pressable>
      </FadeSlideIn>

      <FadeSlideIn delay={70}>
        <Card style={s.hero}>
          <LevelRing level={level} pct={pct} />
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={s.levelTitle}>{levelTitle(level)}</Text>
            <Progress value={xp - currentBase} max={nextTarget - currentBase} />
            <Text style={s.xpText}>{xp} XP · faltam {nextTarget - xp} para o nível {level + 1}</Text>
          </View>
        </Card>
      </FadeSlideIn>

      <FadeSlideIn delay={140}>
        <Card style={{ flexDirection: 'row' }}>
          <Stat icon="flame" iconColor={T.ember} value={String(streak)} label={streak === 1 ? 'dia de streak' : 'dias de streak'} tint={T.emberSoft} />
          <Stat icon="barbell" iconColor={T.primary} value={String(workouts.length)} label="treinos" tint={T.primarySoft} />
          <Stat icon="stats-chart" iconColor={T.goldText} value={totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${totalVolume}kg`} label="volume total" tint={T.goldSoft} />
        </Card>
      </FadeSlideIn>

      <FadeSlideIn delay={210}>
        <Card>
          <Text style={s.sectionTitle}>Desafios de hoje</Text>
          <Text style={s.sectionSub}>
            {challengesDone}/{todaysChallenges.length} concluídos — veja a aba Desafios
          </Text>
          <Progress value={challengesDone} max={todaysChallenges.length} color={T.gold} />
        </Card>
      </FadeSlideIn>

      <FadeSlideIn delay={280}>
        <Card>
          <Text style={s.sectionTitle}>Conquistas · {unlocked.length}/{badges.length}</Text>
          <View style={s.badgeRow}>
            {badges.map((b, i) => (
              <FadeSlideIn key={b.id} delay={280 + i * 40}>
                <View style={s.badge}>
                  <View style={[s.badgeIcon, !b.unlocked && s.badgeIconLocked]}>
                    <Ionicons name={b.icon as keyof typeof Ionicons.glyphMap} size={24} color={b.unlocked ? T.goldText : T.textDim} />
                  </View>
                  <Text style={[s.badgeName, !b.unlocked && { opacity: 0.4 }]}>{b.name}</Text>
                </View>
              </FadeSlideIn>
            ))}
          </View>
        </Card>
      </FadeSlideIn>
    </ScrollView>
  );
}

function makeStyles(T: Theme) {
  return StyleSheet.create({
    content: { padding: 16, gap: 14, paddingBottom: 32, maxWidth: 560, width: '100%', alignSelf: 'center' },
    greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 2 },
    greetingHi: { color: T.textDim, fontSize: 13, fontFamily: FONT.semiBold },
    greeting: { color: T.text, fontSize: 22, fontFamily: FONT.extraBold },
    hero: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    levelTitle: { color: T.primary, fontFamily: FONT.extraBold, fontSize: 17 },
    xpText: { color: T.textDim, fontFamily: FONT.regular, fontSize: 12 },
    sectionTitle: { color: T.text, fontFamily: FONT.extraBold, fontSize: 15, marginBottom: 6 },
    sectionSub: { color: T.textDim, fontFamily: FONT.regular, fontSize: 12, marginBottom: 10 },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
    badge: { width: 88, alignItems: 'center', gap: 6 },
    badgeIcon: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: T.goldSoft,
      alignItems: 'center', justifyContent: 'center',
    },
    badgeIconLocked: { backgroundColor: T.surface2 },
    badgeName: { color: T.textDim, fontFamily: FONT.regular, fontSize: 10, textAlign: 'center' },
  });
}
