import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, StyleSheet,
  Animated, Image, Modal, ActivityIndicator,
} from 'react-native';
import { Theme, useTheme } from '../theme';
import { Card, Btn, Avatar, FadeSlideIn } from '../components/UI';
import { useStore } from '../store';
import {
  Group, GroupMember, GroupMessage, RuleType, RULE_LABELS,
  getGroup, subscribeMembers, subscribeMessages, sendMessage, leaveGroup,
} from '../groups';

const METRIC_FIELD: Record<RuleType, keyof GroupMember> = {
  checkins: 'checkinsCount',
  workouts: 'workoutsCount',
  volume: 'volumeKg',
};

function daysLeft(endKey: string): number {
  const end = new Date(`${endKey}T23:59:59`);
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
}

function rankBadge(i: number): string {
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return String(i + 1);
}

function formatDateLabel(dateKey: string): string {
  return dateKey.split('-').reverse().join('/');
}

function Toggle({ label, active, onPress, s }: { label: string; active: boolean; onPress: () => void; s: Styles }) {
  return (
    <Pressable onPress={onPress} style={[s.toggle, active && s.toggleActive]}>
      <Text style={[s.toggleText, active && s.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

function RankRow({ member, index, metricKey, unit, isMe, delta, flashAnim, onPressPhoto, T, s }: {
  member: GroupMember; index: number; metricKey: keyof GroupMember; unit: string;
  isMe: boolean; delta: number; flashAnim: Animated.Value; onPressPhoto: () => void; T: Theme; s: Styles;
}) {
  const bg = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isMe ? T.primarySoft : T.surface, T.goldSoft],
  });
  return (
    <Animated.View style={[s.rankRow, { backgroundColor: bg }]}>
      <Text style={s.rankNum}>{rankBadge(index)}</Text>
      <Pressable onPress={onPressPhoto} disabled={!member.lastCheckinPhoto}>
        {member.lastCheckinPhoto
          ? <Image source={{ uri: member.lastCheckinPhoto }} style={s.rankPhoto} />
          : <Avatar name={member.name} size={36} photo={member.photo} />}
      </Pressable>
      <Text style={s.rankName} numberOfLines={1}>{member.name}</Text>
      {delta > 0 && <Text style={s.deltaUp}>▲{delta}</Text>}
      {delta < 0 && <Text style={s.deltaDown}>▼{Math.abs(delta)}</Text>}
      <Text style={s.rankValue}>{(member[metricKey] as number).toLocaleString('pt-BR')}{unit}</Text>
    </Animated.View>
  );
}

export function GroupDetailScreen({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const { theme: T } = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const { user } = useStore();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [view, setView] = useState<'ranking' | 'chat'>('ranking');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [viewPhoto, setViewPhoto] = useState<{ uri: string; name: string; date?: string } | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const flashAnims = useRef<Record<string, Animated.Value>>({});
  const prevRankRef = useRef<Record<string, number>>({});
  const prevValueRef = useRef<Record<string, number>>({});

  function getFlashAnim(uid: string) {
    if (!flashAnims.current[uid]) flashAnims.current[uid] = new Animated.Value(0);
    return flashAnims.current[uid];
  }

  useEffect(() => { getGroup(groupId).then(setGroup); }, [groupId]);
  useEffect(() => subscribeMembers(groupId, setMembers), [groupId]);
  useEffect(() => subscribeMessages(groupId, setMessages), [groupId]);

  useEffect(() => {
    if (view === 'chat') requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages, view]);

  // Detecta quem subiu/desceu de posição e quem pontuou desde a última atualização,
  // pra dar aquele feedback de "competição ao vivo" quando o Firestore avisa uma mudança.
  useEffect(() => {
    if (!group || members.length === 0) return;
    const metricKey = METRIC_FIELD[group.ruleType];
    const ranked = [...members].sort((a, b) => (b[metricKey] as number) - (a[metricKey] as number));

    const newDeltas: Record<string, number> = {};
    ranked.forEach((m, i) => {
      const prevRank = prevRankRef.current[m.uid];
      if (prevRank !== undefined && prevRank !== i) newDeltas[m.uid] = prevRank - i;
      prevRankRef.current[m.uid] = i;

      const cur = m[metricKey] as number;
      const prevVal = prevValueRef.current[m.uid];
      if (prevVal !== undefined && cur > prevVal) {
        const anim = getFlashAnim(m.uid);
        anim.setValue(1);
        Animated.timing(anim, { toValue: 0, duration: 1400, useNativeDriver: false }).start();
      }
      prevValueRef.current[m.uid] = cur;
    });
    setDeltas(newDeltas);
  }, [members, group]);

  async function handleSend() {
    if (!user || !text.trim() || sending) return;
    const t = text;
    setText('');
    setSending(true);
    try {
      await sendMessage(groupId, user, t);
    } finally {
      setSending(false);
    }
  }

  async function handleLeave() {
    if (!user) return;
    await leaveGroup(user.uid, groupId);
    onBack();
  }

  if (!group) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={T.primary} />
      </View>
    );
  }

  const metricKey = METRIC_FIELD[group.ruleType];
  const unit = group.ruleType === 'volume' ? ' kg' : '';
  const ranked = [...members].sort((a, b) => (b[metricKey] as number) - (a[metricKey] as number));
  const myIndex = ranked.findIndex((m) => m.uid === user?.uid);
  const isOwner = user?.uid === group.ownerUid;
  const remaining = daysLeft(group.periodEndKey);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={s.header}>
        <Btn label="← Voltar" variant="ghost" onPress={onBack} />
        <Text style={s.title}>{group.name}</Text>
        <Text style={s.sub}>
          {RULE_LABELS[group.ruleType]} · {remaining > 0 ? `${remaining}d restantes` : 'Encerrado'}
        </Text>
        <View style={s.toggleRow}>
          <Toggle label="Ranking" active={view === 'ranking'} onPress={() => setView('ranking')} s={s} />
          <Toggle label="Chat" active={view === 'chat'} onPress={() => setView('chat')} s={s} />
        </View>
      </View>

      {view === 'ranking' ? (
        <ScrollView contentContainerStyle={s.content}>
          <FadeSlideIn>
            <Card>
              <Text style={s.inviteLabel}>Código do grupo — compartilhe pra convidar</Text>
              <Text style={s.inviteCode}>{group.inviteCode}</Text>
            </Card>
          </FadeSlideIn>

          {myIndex >= 0 && (
            <FadeSlideIn delay={40}>
              <Card style={s.heroCard}>
                <Text style={s.heroMedal}>{rankBadge(myIndex)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroLabel}>Sua posição</Text>
                  <Text style={s.heroRank}>{myIndex + 1}º de {ranked.length}</Text>
                </View>
                <Text style={s.heroValue}>
                  {(ranked[myIndex][metricKey] as number).toLocaleString('pt-BR')}{unit}
                </Text>
              </Card>
            </FadeSlideIn>
          )}

          {ranked.map((m, i) => (
            <FadeSlideIn key={m.uid} delay={90 + i * 50}>
              <RankRow
                member={m}
                index={i}
                metricKey={metricKey}
                unit={unit}
                isMe={m.uid === user?.uid}
                delta={deltas[m.uid] ?? 0}
                flashAnim={getFlashAnim(m.uid)}
                onPressPhoto={() => m.lastCheckinPhoto && setViewPhoto({
                  uri: m.lastCheckinPhoto, name: m.name, date: m.lastCheckinDate,
                })}
                T={T}
                s={s}
              />
            </FadeSlideIn>
          ))}

          {!isOwner && (
            <FadeSlideIn delay={90 + ranked.length * 50}>
              <Btn label="Sair do grupo" variant="ghost" onPress={handleLeave} />
            </FadeSlideIn>
          )}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scrollRef} contentContainerStyle={s.chatContent}>
            {messages.map((m) => {
              const mine = m.uid === user?.uid;
              return (
                <View key={m.id} style={[s.bubbleRow, mine && s.bubbleRowMine]}>
                  <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther]}>
                    {!mine && <Text style={s.bubbleName}>{m.name}</Text>}
                    <Text style={[s.bubbleText, mine && { color: '#fff' }]}>{m.text}</Text>
                  </View>
                </View>
              );
            })}
            {messages.length === 0 && <Text style={s.empty}>Nenhuma mensagem ainda. Diga oi! 👋</Text>}
          </ScrollView>
          <View style={s.inputRow}>
            <TextInput
              style={s.chatInput}
              placeholder="Mensagem…"
              placeholderTextColor={T.textDim}
              value={text}
              onChangeText={setText}
              onSubmitEditing={handleSend}
            />
            <Pressable onPress={handleSend} disabled={sending || !text.trim()} style={s.sendBtn}>
              <Text style={s.sendBtnText}>➤</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal visible={!!viewPhoto} transparent animationType="fade" onRequestClose={() => setViewPhoto(null)}>
        <Pressable style={s.modalBackdrop} onPress={() => setViewPhoto(null)}>
          {viewPhoto && (
            <View style={s.modalCard}>
              <Image source={{ uri: viewPhoto.uri }} style={s.modalPhoto} />
              <Text style={s.modalName}>{viewPhoto.name}</Text>
              {viewPhoto.date && <Text style={s.modalDate}>Check-in de {formatDateLabel(viewPhoto.date)}</Text>}
            </View>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(T: Theme) {
  return StyleSheet.create({
    header: {
      padding: 16, paddingBottom: 10, gap: 8, backgroundColor: T.surface,
      borderBottomWidth: 1, borderBottomColor: T.border, maxWidth: 560, width: '100%', alignSelf: 'center',
    },
    title: { color: T.text, fontSize: 20, fontWeight: '800' },
    sub: { color: T.textDim, fontSize: 12 },
    toggleRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    toggle: { flex: 1, paddingVertical: 8, borderRadius: 999, backgroundColor: T.surface2, alignItems: 'center' },
    toggleActive: { backgroundColor: T.primary },
    toggleText: { color: T.textDim, fontWeight: '700', fontSize: 13 },
    toggleTextActive: { color: '#fff' },
    content: { padding: 16, gap: 10, paddingBottom: 32, maxWidth: 560, width: '100%', alignSelf: 'center' },
    inviteLabel: { color: T.textDim, fontSize: 11, marginBottom: 4 },
    inviteCode: { color: T.primary, fontSize: 20, fontWeight: '800', letterSpacing: 4 },
    heroCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: T.primary, shadowColor: T.primary, shadowOpacity: 0.3,
    },
    heroMedal: { fontSize: 28 },
    heroLabel: { color: '#FFFFFFB0', fontSize: 11, fontWeight: '700' },
    heroRank: { color: '#fff', fontSize: 18, fontWeight: '800' },
    heroValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
    rankRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14,
      borderRadius: T.radius,
      shadowColor: T.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2,
    },
    rankNum: { width: 26, color: T.textDim, fontWeight: '800', fontSize: 15, textAlign: 'center' },
    rankPhoto: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.surface2 },
    rankName: { flex: 1, color: T.text, fontWeight: '700', fontSize: 14 },
    rankValue: { color: T.text, fontWeight: '800', fontSize: 14 },
    deltaUp: { color: T.green, fontWeight: '800', fontSize: 11 },
    deltaDown: { color: T.red, fontWeight: '800', fontSize: 11 },
    chatContent: { padding: 16, gap: 8, maxWidth: 560, width: '100%', alignSelf: 'center' },
    empty: { color: T.textDim, fontSize: 13, textAlign: 'center', marginTop: 20 },
    bubbleRow: { flexDirection: 'row' },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
    bubbleOther: { backgroundColor: T.surface2, alignSelf: 'flex-start' },
    bubbleMine: { backgroundColor: T.primary, alignSelf: 'flex-end' },
    bubbleName: { color: T.primary, fontWeight: '800', fontSize: 11, marginBottom: 2 },
    bubbleText: { color: T.text, fontSize: 14 },
    inputRow: {
      flexDirection: 'row', gap: 8, padding: 12, backgroundColor: T.surface,
      borderTopWidth: 1, borderTopColor: T.border, maxWidth: 560, width: '100%', alignSelf: 'center',
    },
    chatInput: {
      flex: 1, backgroundColor: T.surface2, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10,
      color: T.text, fontSize: 14,
    },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
    sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    modalBackdrop: { flex: 1, backgroundColor: '#000000CC', alignItems: 'center', justifyContent: 'center', padding: 24 },
    modalCard: { backgroundColor: T.surface, borderRadius: T.radius, padding: 18, alignItems: 'center', gap: 8, maxWidth: 340, width: '100%' },
    modalPhoto: { width: 280, height: 280, borderRadius: 16, backgroundColor: T.surface2 },
    modalName: { color: T.text, fontWeight: '800', fontSize: 16, marginTop: 4 },
    modalDate: { color: T.textDim, fontSize: 12 },
  });
}

type Styles = ReturnType<typeof makeStyles>;
