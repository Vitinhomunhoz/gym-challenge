import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, StyleSheet,
  Animated, Image, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, useTheme, FONT } from '../theme';
import { Card, Btn, Avatar, FadeSlideIn } from '../components/UI';
import { InviteQr } from '../components/InviteQr';
import { useStore } from '../store';
import { daysRemaining } from '../gamification';
import { joinUrlForCode } from '../joinLink';
import {
  Group, GroupMember, GroupMessage, RuleType, RULE_LABELS,
  getGroup, subscribeMembers, subscribeMessages, sendMessage, leaveGroup,
} from '../groups';

const METRIC_FIELD: Record<RuleType, keyof GroupMember> = {
  checkins: 'checkinsCount',
  workouts: 'workoutsCount',
  volume: 'volumeKg',
};

type PlaceTone = { bg: string; ink: string; ring: string; row: string; pedestal: string };

function placeTones(dark: boolean): PlaceTone[] {
  if (dark) {
    return [
      { bg: '#E2B340', ink: '#2B1C00', ring: '#F0D078', row: '#3B2E12', pedestal: '#C9962A' },
      { bg: '#E4E9F2', ink: '#243044', ring: '#F4F7FB', row: '#2A3142', pedestal: '#8E98A8' },
      { bg: '#E0A36A', ink: '#3A1E0C', ring: '#F0C49A', row: '#3A2818', pedestal: '#A86B3C' },
    ];
  }
  return [
    { bg: '#F6C445', ink: '#5C3B00', ring: '#E3AE22', row: '#FFF8E4', pedestal: '#F0C14B' },
    { bg: '#E7EDF5', ink: '#2C3544', ring: '#C5CEDA', row: '#F4F6FA', pedestal: '#D5DCE6' },
    { bg: '#F0B27A', ink: '#5C3014', ring: '#D4925A', row: '#FFF1E4', pedestal: '#E39A62' },
  ];
}

function memberScore(member: GroupMember, metricKey: keyof GroupMember): number {
  const value = member[metricKey];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function PlaceMark({ index, plainColor, size = 34, tones }: {
  index: number; plainColor: string; size?: number; tones: PlaceTone[];
}) {
  if (index >= 3) {
    return <Text style={{ color: plainColor, fontFamily: FONT.extraBold, fontSize: 15, textAlign: 'center' }}>{index + 1}</Text>;
  }
  const tone = tones[index];
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: tone.bg, borderWidth: 2, borderColor: tone.ring,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: tone.ink, fontFamily: FONT.black, fontSize: size * 0.46, lineHeight: size * 0.52 }}>{index + 1}</Text>
    </View>
  );
}

function MemberFace({ member, size }: { member: GroupMember; size: number }) {
  if (member.lastCheckinPhoto) {
    return <Image source={{ uri: member.lastCheckinPhoto }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return <Avatar name={member.name} size={size} photo={member.photo} />;
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

function RankRow({ member, index, metricKey, unit, isMe, delta, flashAnim, onPressPhoto, T, s, tones }: {
  member: GroupMember; index: number; metricKey: keyof GroupMember; unit: string;
  isMe: boolean; delta: number; flashAnim: Animated.Value; onPressPhoto: () => void; T: Theme; s: Styles;
  tones: PlaceTone[];
}) {
  const tone = index < 3 ? tones[index] : null;
  const resting = tone ? tone.row : (isMe ? T.primarySoft : T.surface);
  const bg = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [resting, T.goldSoft],
  });
  return (
    <Animated.View style={[s.rankRow, { backgroundColor: bg }, tone && { borderLeftWidth: 4, borderLeftColor: tone.bg }]}>
      <View style={s.rankNum}><PlaceMark index={index} plainColor={T.textDim} tones={tones} /></View>
      <Pressable onPress={onPressPhoto} disabled={!member.lastCheckinPhoto}>
        {member.lastCheckinPhoto
          ? <Image source={{ uri: member.lastCheckinPhoto }} style={s.rankPhoto} />
          : <Avatar name={member.name} size={36} photo={member.photo} />}
      </Pressable>
      <Text style={s.rankName} numberOfLines={1}>{member.name}</Text>
      {delta > 0 && <Text style={s.deltaUp}>▲{delta}</Text>}
      {delta < 0 && <Text style={s.deltaDown}>▼{Math.abs(delta)}</Text>}
      <Text style={s.rankValue}>{memberScore(member, metricKey).toLocaleString('pt-BR')}{unit}</Text>
    </Animated.View>
  );
}

export type GroupPreview = {
  group: Group;
  members: GroupMember[];
  messages: GroupMessage[];
  onSend: (text: string) => Promise<void> | void;
};

export function GroupDetailScreen({ groupId, onBack, preview }: {
  groupId: string;
  onBack: () => void;
  preview?: GroupPreview;
}) {
  const { theme: T, scheme } = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const tones = useMemo(() => placeTones(scheme === 'dark'), [scheme]);
  const { user, refreshGroupIds, noteGroupLeft } = useStore();
  const [group, setGroup] = useState<Group | null>(null);
  const [groupMissing, setGroupMissing] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [view, setView] = useState<'ranking' | 'chat'>('ranking');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [viewPhoto, setViewPhoto] = useState<{ uri: string; name: string; date?: string } | null>(null);
  const [actionError, setActionError] = useState('');
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copiar link');
  const scrollRef = useRef<ScrollView>(null);

  const flashAnims = useRef<Record<string, Animated.Value>>({});
  const prevRankRef = useRef<Record<string, number>>({});
  const prevValueRef = useRef<Record<string, number>>({});

  function getFlashAnim(uid: string) {
    if (!flashAnims.current[uid]) flashAnims.current[uid] = new Animated.Value(0);
    return flashAnims.current[uid];
  }

  useEffect(() => {
    if (preview) {
      setGroup(preview.group);
      setGroupMissing(false);
      return;
    }
    let cancelled = false;
    setGroup(null);
    setGroupMissing(false);
    getGroup(groupId).then((g) => {
      if (cancelled) return;
      setGroup(g);
      setGroupMissing(!g);
    }).catch(() => {
      if (!cancelled) setGroupMissing(true);
    });
    return () => { cancelled = true; };
  }, [groupId, preview?.group]);
  useEffect(() => {
    if (preview) {
      setMembers(preview.members);
      return;
    }
    try { return subscribeMembers(groupId, setMembers); } catch { return undefined; }
  }, [groupId, preview?.members]);
  useEffect(() => {
    if (preview) {
      setMessages(preview.messages);
      return;
    }
    try { return subscribeMessages(groupId, setMessages); } catch { return undefined; }
  }, [groupId, preview?.messages]);

  useEffect(() => {
    if (view === 'chat') requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages, view]);

  // Detecta quem subiu/desceu de posição e quem pontuou desde a última atualização,
  // pra dar aquele feedback de "competição ao vivo" quando o Firestore avisa uma mudança.
  useEffect(() => {
    if (!group || members.length === 0) return;
    const metricKey = METRIC_FIELD[group.ruleType];
    const ranked = [...members].sort((a, b) => memberScore(b, metricKey) - memberScore(a, metricKey));

    const newDeltas: Record<string, number> = {};
    ranked.forEach((m, i) => {
      const prevRank = prevRankRef.current[m.uid];
      if (prevRank !== undefined && prevRank !== i) newDeltas[m.uid] = prevRank - i;
      prevRankRef.current[m.uid] = i;

      const cur = memberScore(m, metricKey);
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
    setActionError('');
    setSending(true);
    try {
      if (preview) await preview.onSend(t.trim());
      else await sendMessage(groupId, user, t);
    } catch {
      setText(t);
      setActionError('Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  }

  async function handleLeave() {
    if (!user) return;
    if (preview) {
      onBack();
      return;
    }
    setActionError('');
    try {
      await leaveGroup(user.uid, groupId);
      noteGroupLeft(groupId);
      await refreshGroupIds();
      onBack();
    } catch (e: any) {
      setActionError(e?.message ?? 'Não foi possível sair do grupo.');
    }
  }

  if (!group) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        {groupMissing ? (
          <>
            <Text style={{ color: T.text, fontFamily: FONT.bold, textAlign: 'center' }}>Não foi possível abrir esse grupo.</Text>
            <Btn label="Voltar" onPress={onBack} />
          </>
        ) : (
          <ActivityIndicator color={T.primary} />
        )}
      </View>
    );
  }

  const metricKey = METRIC_FIELD[group.ruleType];
  const unit = group.ruleType === 'volume' ? ' kg' : '';
  const ranked = [...members].sort((a, b) => memberScore(b, metricKey) - memberScore(a, metricKey));
  const myIndex = ranked.findIndex((m) => m.uid === user?.uid);
  const remaining = daysRemaining(group.periodEndKey);
  const inviteLink = joinUrlForCode(group.inviteCode);
  const showQr = !preview;
  const podiumOrder = ranked.length >= 3 ? [1, 0, 2] : ranked.length === 2 ? [1, 0] : ranked.length === 1 ? [0] : [];

  async function copyInviteLink() {
    if (!inviteLink) return;
    const mark = (label: string) => {
      setCopyLabel(label);
      setTimeout(() => setCopyLabel('Copiar link'), 2000);
    };
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink);
        mark('Link copiado');
        return;
      }
    } catch { /* alguns navegadores bloqueiam a área de transferência */ }
    try {
      if (typeof document === 'undefined') throw new Error('sem documento');
      const area = document.createElement('textarea');
      area.value = inviteLink;
      area.setAttribute('readonly', 'true');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      mark(ok ? 'Link copiado' : 'Selecione o link acima');
    } catch {
      mark('Selecione o link acima');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={s.header}>
        <Btn label="← Voltar" variant="ghost" onPress={onBack} />
        <Text style={s.title}>{group.name}</Text>
        <Text style={s.sub}>
          {RULE_LABELS[group.ruleType]} · {remaining > 0 ? `${remaining}d restantes` : 'Encerrado'}
        </Text>
        {preview && (
          <Text style={s.demoNote}>
            Exemplo do Modo Demo, só neste aparelho. Com a conta Google, o ranking e o chat são entre os amigos de verdade.
          </Text>
        )}
        <View style={s.toggleRow}>
          <Toggle label="Ranking" active={view === 'ranking'} onPress={() => setView('ranking')} s={s} />
          <Toggle label="Chat" active={view === 'chat'} onPress={() => setView('chat')} s={s} />
        </View>
      </View>

      {view === 'ranking' ? (
        <ScrollView contentContainerStyle={s.content}>
          <FadeSlideIn>
            <Card style={s.inviteCard}>
              <Text style={s.inviteLabel}>
                {preview ? 'Código do grupo — compartilhe pra convidar' : 'Convite da banca'}
              </Text>
              {showQr && (
                <>
                  <InviteQr value={inviteLink} />
                  <Text style={s.inviteHint}>
                    Mostre este QR na banca. Quem escanear com a câmera do celular abre o app e entra no grupo com a conta Google.
                  </Text>
                  <Text style={s.inviteUrl} selectable>{inviteLink}</Text>
                  <Pressable onPress={copyInviteLink} style={s.copyBtn}>
                    <Text style={s.copyBtnText}>{copyLabel}</Text>
                  </Pressable>
                </>
              )}
              <Text style={s.inviteCode}>{group.inviteCode}</Text>
            </Card>
          </FadeSlideIn>

          {podiumOrder.length > 0 && (
            <FadeSlideIn delay={40}>
              <Card style={s.podiumCard}>
                <Text style={s.podiumTitle}>Pódio</Text>
                <View style={s.podiumRow}>
                  {podiumOrder.map((place) => {
                    const member = ranked[place];
                    const tone = tones[place];
                    const height = place === 0 ? 92 : place === 1 ? 68 : 54;
                    return (
                      <View key={member.uid} style={s.podiumSlot}>
                        <MemberFace member={member} size={place === 0 ? 52 : 42} />
                        <Text style={s.podiumName} numberOfLines={1}>{member.name}</Text>
                        <Text style={s.podiumScore}>
                          {memberScore(member, metricKey).toLocaleString('pt-BR')}{unit}
                        </Text>
                        <View style={[s.pedestal, { height, backgroundColor: tone.pedestal }]}>
                          <Text style={[s.pedestalPlace, { color: tone.ink }]}>{place + 1}º</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Card>
            </FadeSlideIn>
          )}

          {myIndex >= 0 && (
            <FadeSlideIn delay={70}>
              <Card style={s.heroCard}>
                <View style={s.heroMedal}>
                  <PlaceMark index={myIndex} plainColor="#fff" size={36} tones={tones} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroLabel}>Sua posição</Text>
                  <Text style={s.heroRank}>{myIndex + 1}º de {ranked.length}</Text>
                </View>
                <Text style={s.heroValue}>
                  {memberScore(ranked[myIndex], metricKey).toLocaleString('pt-BR')}{unit}
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
                tones={tones}
              />
            </FadeSlideIn>
          ))}

          <FadeSlideIn delay={90 + ranked.length * 50}>
            {confirmingLeave ? (
              <Card style={{ gap: 10 }}>
                <Text style={s.leaveText}>Sair deste grupo? Seu placar aqui deixa de ser atualizado.</Text>
                <Btn label="Confirmar saída" onPress={handleLeave} />
                <Btn label="Cancelar" variant="ghost" onPress={() => setConfirmingLeave(false)} />
              </Card>
            ) : (
              <Btn label="Sair do grupo" variant="ghost" onPress={() => setConfirmingLeave(true)} />
            )}
            {!!actionError && <Text style={s.actionError}>{actionError}</Text>}
          </FadeSlideIn>
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
            {messages.length === 0 && <Text style={s.empty}>Nenhuma mensagem ainda. Diga oi!</Text>}
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
            <Pressable onPress={handleSend} disabled={sending || !text.trim()} style={s.sendBtn} accessibilityLabel="Enviar mensagem">
              <Ionicons name="send" size={16} color="#fff" />
            </Pressable>
          </View>
          {!!actionError && <Text style={s.actionError}>{actionError}</Text>}
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
    title: { color: T.text, fontSize: 20, fontFamily: FONT.extraBold },
    sub: { color: T.textDim, fontFamily: FONT.regular, fontSize: 12 },
    demoNote: { color: T.textDim, fontFamily: FONT.regular, fontSize: 11, lineHeight: 16 },
    toggleRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    toggle: { flex: 1, paddingVertical: 8, borderRadius: 999, backgroundColor: T.surface2, alignItems: 'center' },
    toggleActive: { backgroundColor: T.primary },
    toggleText: { color: T.textDim, fontFamily: FONT.bold, fontSize: 13 },
    toggleTextActive: { color: '#fff' },
    content: { padding: 16, gap: 10, paddingBottom: 32, maxWidth: 560, width: '100%', alignSelf: 'center' },
    inviteCard: { alignItems: 'center', gap: 10 },
    inviteLabel: { color: T.textDim, fontFamily: FONT.regular, fontSize: 11, alignSelf: 'flex-start' },
    inviteHint: { color: T.textDim, fontFamily: FONT.regular, fontSize: 12, lineHeight: 18, textAlign: 'center' },
    inviteUrl: { color: T.text, fontFamily: FONT.semiBold, fontSize: 11, textAlign: 'center' },
    copyBtn: { backgroundColor: T.primarySoft, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
    copyBtnText: { color: T.primary, fontFamily: FONT.extraBold, fontSize: 13 },
    inviteCode: { color: T.primary, fontSize: 20, fontFamily: FONT.extraBold, letterSpacing: 4 },
    podiumCard: { gap: 12 },
    podiumTitle: { color: T.text, fontFamily: FONT.extraBold, fontSize: 15 },
    podiumRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    podiumSlot: { flex: 1, alignItems: 'center', gap: 6 },
    podiumName: { color: T.text, fontFamily: FONT.bold, fontSize: 12, textAlign: 'center', width: '100%' },
    podiumScore: { color: T.textDim, fontFamily: FONT.semiBold, fontSize: 11 },
    pedestal: { width: '100%', borderTopLeftRadius: 14, borderTopRightRadius: 14, alignItems: 'center', justifyContent: 'center' },
    pedestalPlace: { fontFamily: FONT.black, fontSize: 22 },
    heroCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: T.primary, shadowColor: T.primary, shadowOpacity: 0.3,
    },
    heroMedal: { width: 40, alignItems: 'center', justifyContent: 'center' },
    heroLabel: { color: '#FFFFFFB0', fontSize: 11, fontFamily: FONT.bold },
    heroRank: { color: '#fff', fontSize: 18, fontFamily: FONT.extraBold },
    heroValue: { color: '#fff', fontSize: 20, fontFamily: FONT.extraBold },
    rankRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14,
      borderRadius: T.radius,
      shadowColor: T.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2,
    },
    rankNum: { width: 40, alignItems: 'center', justifyContent: 'center' },
    rankPhoto: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.surface2 },
    rankName: { flex: 1, color: T.text, fontFamily: FONT.bold, fontSize: 14 },
    rankValue: { color: T.text, fontFamily: FONT.extraBold, fontSize: 14 },
    deltaUp: { color: T.green, fontFamily: FONT.extraBold, fontSize: 11 },
    deltaDown: { color: T.red, fontFamily: FONT.extraBold, fontSize: 11 },
    chatContent: { padding: 16, gap: 8, maxWidth: 560, width: '100%', alignSelf: 'center' },
    empty: { color: T.textDim, fontFamily: FONT.regular, fontSize: 13, textAlign: 'center', marginTop: 20 },
    bubbleRow: { flexDirection: 'row' },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
    bubbleOther: { backgroundColor: T.surface2, alignSelf: 'flex-start' },
    bubbleMine: { backgroundColor: T.primary, alignSelf: 'flex-end' },
    bubbleName: { color: T.primary, fontFamily: FONT.extraBold, fontSize: 11, marginBottom: 2 },
    bubbleText: { color: T.text, fontFamily: FONT.regular, fontSize: 14 },
    inputRow: {
      flexDirection: 'row', gap: 8, padding: 12, backgroundColor: T.surface,
      borderTopWidth: 1, borderTopColor: T.border, maxWidth: 560, width: '100%', alignSelf: 'center',
    },
    chatInput: {
      flex: 1, flexBasis: 0, minWidth: 0, maxWidth: '100%',
      backgroundColor: T.surface2, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10,
      color: T.text, fontSize: 16, fontFamily: FONT.regular,
    },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
    leaveText: { color: T.text, fontFamily: FONT.regular, fontSize: 14, lineHeight: 20 },
    actionError: { color: T.red, fontFamily: FONT.semiBold, fontSize: 13, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 8 },
    modalBackdrop: { flex: 1, backgroundColor: '#000000CC', alignItems: 'center', justifyContent: 'center', padding: 24 },
    modalCard: { backgroundColor: T.surface, borderRadius: T.radius, padding: 18, alignItems: 'center', gap: 8, maxWidth: 340, width: '100%' },
    modalPhoto: { width: 280, height: 280, borderRadius: 16, backgroundColor: T.surface2 },
    modalName: { color: T.text, fontFamily: FONT.extraBold, fontSize: 16, marginTop: 4 },
    modalDate: { color: T.textDim, fontFamily: FONT.regular, fontSize: 12 },
  });
}

type Styles = ReturnType<typeof makeStyles>;
