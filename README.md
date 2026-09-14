# 🏋️ Gym Challenge

App mobile (React Native + Expo) de gamificação de treinos — TCC.
Roda no **PC (navegador)** e no **celular (Expo Go)** com o mesmo código.

## ▶️ Como rodar no PC

```bash
npm install
npm run web        # abre em http://localhost:8081
```

## 📱 Como rodar no celular

```bash
npm start          # escaneie o QR code com o app Expo Go
```

## 🔐 Login com Google (Firebase)

O app já funciona em **Modo Demo** sem configurar nada (dados salvos localmente).
Para ativar o login Google:

1. Crie um projeto em https://console.firebase.google.com
2. Adicione um app **Web** e copie o objeto `firebaseConfig`
3. Cole em `src/firebase.ts` (substituindo os placeholders)
4. Em **Authentication > Sign-in method**, habilite **Google**
5. Em **Authentication > Settings > Authorized domains**, confirme que `localhost` está na lista
6. Rode `npm run web` — o botão "Entrar com Google" fica ativo no navegador

> No celular, login Google via popup não funciona no Expo Go — use o Modo Demo
> ou gere um dev build com `@react-native-firebase` (ver conversa do projeto).

## 🧠 Por que a persistência é híbrida (local + Firebase)

O app usa **dois** mecanismos de persistência, de propósito:

- **AsyncStorage (local, por usuário)** guarda os dados pessoais e sensíveis —
  treinos, XP, streak e as fotos-prova de check-in. Ficam só no aparelho do usuário,
  não trafegam para nenhum servidor e não exigem conexão. É uma escolha de
  **privacidade por padrão**: ninguém além do próprio usuário tem acesso ao seu
  histórico completo de treinos.
- **Firebase (Auth + Firestore)** guarda só o que é **compartilhado por natureza**:
  identidade do usuário (login Google), grupos, mensagens do chat e os contadores
  agregados do ranking (check-ins, treinos e volume por período). Nada disso exige
  o histórico bruto do usuário — só os totais que ele mesmo optou por expor ao entrar
  num grupo.

Essa separação não é uma inconsistência entre "o que o diagrama diz" e "o que o
código faz" — é a decisão arquitetural em si: dado pessoal fica local, dado social
fica na nuvem. Ver [`src/store.tsx`](src/store.tsx) (persistência local) e
[`src/groups.ts`](src/groups.ts) (persistência em nuvem).

## 🛡️ Integridade do ranking

Os contadores de um grupo (`checkinsCount`, `workoutsCount`, `volumeKg`) ainda são
escritos pelo cliente (`src/groups.ts`), mas cada escrita passa pela validação das
[`firestore.rules`](firestore.rules) publicadas: o placar só pode subir em um passo
pequeno por escrita (no máximo +1 check-in, +1 treino, +50.000kg de volume) e nunca
diminuir, e só nome/foto podem ser alterados livremente. Isso bloqueia o ataque óbvio
— setar `checkinsCount: 999999` direto no documento — sem exigir nenhum serviço pago.

**Por que não é 100% à prova de trapaça:** a regra valida cada escrita isoladamente,
então nada impede alguém de repetir a mesma escrita pequena várias vezes na mão. A
solução completa pra isso — mover a validação pra um servidor que só aceita um
evento por dia por usuário — já está pronta e testada em `functions/src/index.ts`,
só não está publicada porque exige o **plano Blaze** do Firebase (pago por uso; a
tentativa de deploy nesse projeto falhou por conta disso, e ficou decidido não
insistir agora). Se um dia quiser ativar essa camada extra:

```bash
npx firebase-tools login
cd functions && npm run build && cd ..
npx firebase-tools deploy --only firestore:rules,functions
```

(vai pedir pra trocar as regras de `members/{uid}` pra bloquear escrita direta do
cliente nos campos de placar, já que quem passaria a somar seria só a Function).

## ✅ Testes

Regras de gamificação (XP, nível, streak, badges, desafios diários) são funções
puras e têm testes unitários com Jest:

```bash
npm test
```

## 🗂️ Estrutura

```
App.tsx                     # roteamento por auth + tabs + toast de XP
firestore.rules             # regras de segurança do Firestore
firebase.json, .firebaserc  # config do Firebase CLI (rules + functions)
functions/src/index.ts      # Cloud Functions: valida e soma o placar dos grupos
src/
  firebase.ts               # config Firebase + login Google
  gamification.ts           # XP, níveis, streak, badges, desafios diários, PRs
  gamification.test.ts      # testes unitários das regras de gamificação
  groups.ts                 # grupos, ranking (via eventos) e chat — Firestore
  store.tsx                 # estado global + persistência local (AsyncStorage por usuário)
  theme.ts                  # paleta "Ferro & Brasa"
  components/UI.tsx         # Card, Btn, Progress, LevelRing, Stat
  screens/
    LoginScreen.tsx         # Google + Modo Demo
    DashboardScreen.tsx     # nível, XP, streak, conquistas
    WorkoutScreen.tsx       # log de treino (exercícios, séries, reps, carga)
    ChallengesScreen.tsx    # desafios diários + resgate de XP
    HistoryScreen.tsx       # calendário do mês, PRs, últimos treinos
    CheckinScreen.tsx       # foto-prova do treino do dia
    GroupsScreen.tsx        # listar/criar/entrar em grupos
    GroupDetailScreen.tsx   # ranking do grupo + chat interno
```

## 🎮 Regras de gamificação

- **XP por treino:** 50 base + 10/exercício + volume/100 (teto de 150, evita farm)
- **Nível:** `nível = √(XP/150) + 1` (curva quadrática)
- **Streak:** dias consecutivos com treino registrado (não quebra se ainda for hoje)
- **Desafios diários:** 2 por dia, sorteados deterministicamente pela data
- **Badges:** 1º treino, 10 treinos, streak 7, Clube dos 100kg, 1 tonelada, nível 5
