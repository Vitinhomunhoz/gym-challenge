import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, StyleSheet, Alert, Platform,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Theme, useTheme, FONT } from '../theme';
import { Card, Btn, FadeSlideIn, SelectPill } from '../components/UI';
import { useStore } from '../store';
import { hasFirebase } from '../firebase';
import {
  Group, RuleType, RULE_LABELS, getUserGroupIds, getGroup, getMemberCount,
  createGroup, joinGroupByCode,
} from '../groups';
import { GroupDetailScreen } from './GroupDetailScreen';

const RULE_TYPES: RuleType[] = ['checkins', 'workouts', 'volume'];
const PERIODS: (7 | 14 | 30)[] = [7, 14, 30];

function warn(msg: string) {
  Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Grupos', msg);
}

function daysLeft(endKey: string): number {
  const end = new Date(`${endKey}T23:59:59`);
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
}

type GroupWithCount = Group & { memberCount: number };

export function GroupsScreen() {
  const { theme: T } = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const { user, refreshGroupIds } = useStore();
  const [groups, setGroups] = useState<GroupWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState('');
  const [ruleType, setRuleType] = useState<RuleType>('checkins');
  const [periodDays, setPeriodDays] = useState<7 | 14 | 30>(7);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const loadGroups = useCallback(async () => {
    // Modo Demo / sem Firebase não tem grupos de verdade — evita bater no Firestore
    // sem sessão autenticada (o que só resultaria em "Missing or insufficient permissions").
    if (!user || !hasFirebase || user.demo) return;
    const ids = await getUserGroupIds(user.uid);
    const details = await Promise.all(ids.map(async (id) => {
      const g = await getGroup(id);
      if (!g) return null;
      const memberCount = await getMemberCount(id);
      return { ...g, memberCount };
    }));
    setGroups(details.filter((g): g is GroupWithCount => g !== null));
  }, [user?.uid, user?.demo]);

  useEffect(() => {
    setLoading(true);
    loadGroups().catch(() => {}).finally(() => setLoading(false));
  }, [loadGroups]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadGroups().catch(() => {});
    setRefreshing(false);
  }

  async function handleCreate() {
    if (!user || !name.trim()) { warn('Dê um nome para o grupo.'); return; }
    setBusy(true);
    try {
      const g = await createGroup(user, name, ruleType, periodDays);
      refreshGroupIds();
      setName('');
      setShowCreate(false);
      await loadGroups();
      setSelectedGroupId(g.id);
    } catch (e: any) {
      warn(e?.message ?? 'Não foi possível criar o grupo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!user || !code.trim()) return;
    setBusy(true);
    try {
      const groupId = await joinGroupByCode(user, code);
      refreshGroupIds();
      setCode('');
      setShowJoin(false);
      await loadGroups();
      setSelectedGroupId(groupId);
    } catch (e: any) {
      warn(e?.message ?? 'Não foi possível entrar no grupo.');
    } finally {
      setBusy(false);
    }
  }

  if (selectedGroupId) {
    return (
      <GroupDetailScreen
        groupId={selectedGroupId}
        onBack={() => { setSelectedGroupId(null); loadGroups().catch(() => {}); }}
      />
    );
  }

  if (!hasFirebase || user?.demo) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={s.content}>
        <FadeSlideIn><Text style={s.title}>Grupos</Text></FadeSlideIn>
        <FadeSlideIn delay={80}>
          <Card>
            <Text style={s.hint}>
              {!hasFirebase
                ? 'Grupos precisam do Firebase configurado (src/firebase.ts).'
                : 'Grupos exigem login com sua conta Google — o Modo Demo salva tudo só neste aparelho e não tem identidade entre dispositivos. Saia do Modo Demo e entre com sua conta Google para competir com amigos.'}
            </Text>
          </Card>
        </FadeSlideIn>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.bg }}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={T.primary} />}
    >
      <FadeSlideIn>
        <Text style={s.title}>Grupos</Text>
        <Text style={s.sub}>Crie ou entre num grupo e compita com amigos por check-ins, treinos ou volume.</Text>
      </FadeSlideIn>

      {loading && (
        <View style={s.loadingBox}><ActivityIndicator color={T.primary} /></View>
      )}

      {!loading && groups.length === 0 && (
        <FadeSlideIn delay={80}>
          <Card><Text style={s.hint}>Você ainda não participa de nenhum grupo. Crie um ou entre com um código de convite.</Text></Card>
        </FadeSlideIn>
      )}

      {!loading && groups.map((g, i) => (
        <FadeSlideIn key={g.id} delay={80 + i * 60}>
          <Pressable onPress={() => setSelectedGroupId(g.id)}>
            <Card style={s.groupRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.groupName}>{g.name}</Text>
                <Text style={s.groupMeta}>
                  {RULE_LABELS[g.ruleType]} · {g.memberCount} {g.memberCount === 1 ? 'membro' : 'membros'}
                </Text>
              </View>
              <Text style={s.groupDays}>
                {daysLeft(g.periodEndKey) > 0 ? `${daysLeft(g.periodEndKey)}d restantes` : 'Encerrado'}
              </Text>
            </Card>
          </Pressable>
        </FadeSlideIn>
      ))}

      <FadeSlideIn delay={80 + groups.length * 60}>
        <Btn label={showCreate ? 'Cancelar' : '+ Criar grupo'} variant={showCreate ? 'ghost' : 'primary'}
          onPress={() => { setShowCreate((v) => !v); setShowJoin(false); }} />
      </FadeSlideIn>

      {showCreate && (
        <FadeSlideIn duration={280}>
          <Card style={{ gap: 12 }}>
            <TextInput
              style={s.input}
              placeholder="Nome do grupo (ex: Galera da Academia)"
              placeholderTextColor={T.textDim}
              value={name}
              onChangeText={setName}
            />
            <View>
              <Text style={s.label}>REGRA</Text>
              <View style={s.pillRow}>
                {RULE_TYPES.map((rt) => (
                  <SelectPill key={rt} label={RULE_LABELS[rt]} active={ruleType === rt} onPress={() => setRuleType(rt)} />
                ))}
              </View>
            </View>
            <View>
              <Text style={s.label}>PERÍODO</Text>
              <View style={s.pillRow}>
                {PERIODS.map((p) => (
                  <SelectPill key={p} label={`${p} dias`} active={periodDays === p} onPress={() => setPeriodDays(p)} />
                ))}
              </View>
            </View>
            <Btn label={busy ? 'Criando…' : 'Criar grupo'} onPress={handleCreate} disabled={busy} />
          </Card>
        </FadeSlideIn>
      )}

      <FadeSlideIn delay={140 + groups.length * 60}>
        <Btn label={showJoin ? 'Cancelar' : 'Entrar com código'} variant="ghost"
          onPress={() => { setShowJoin((v) => !v); setShowCreate(false); }} />
      </FadeSlideIn>

      {showJoin && (
        <FadeSlideIn duration={280}>
          <Card style={{ gap: 12 }}>
            <TextInput
              style={[s.input, { textAlign: 'center', letterSpacing: 4, fontFamily: FONT.extraBold }]}
              placeholder="CÓDIGO"
              placeholderTextColor={T.textDim}
              autoCapitalize="characters"
              maxLength={6}
              value={code}
              onChangeText={setCode}
            />
            <Btn label={busy ? 'Entrando…' : 'Entrar'} variant="gold" onPress={handleJoin} disabled={busy} />
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
    hint: { color: T.textDim, fontFamily: FONT.regular, fontSize: 13, lineHeight: 19 },
    loadingBox: { paddingVertical: 24, alignItems: 'center' },
    groupRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    groupName: { color: T.text, fontFamily: FONT.extraBold, fontSize: 15 },
    groupMeta: { color: T.textDim, fontFamily: FONT.regular, fontSize: 12 },
    groupDays: { color: T.primary, fontFamily: FONT.bold, fontSize: 12 },
    input: {
      backgroundColor: T.surface2, borderRadius: 14,
      color: T.text, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: FONT.regular,
    },
    label: { color: T.textDim, fontSize: 10, fontFamily: FONT.bold, letterSpacing: 1, marginBottom: 8 },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });
}
