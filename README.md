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

## 🗂️ Estrutura

```
App.tsx                     # roteamento por auth + tabs + toast de XP
src/
  firebase.ts               # config Firebase + login Google
  gamification.ts           # XP, níveis, streak, badges, desafios diários, PRs
  store.tsx                 # estado global + persistência (AsyncStorage por usuário)
  theme.ts                  # paleta "Ferro & Brasa"
  components/UI.tsx         # Card, Btn, Progress, LevelRing, Stat
  screens/
    LoginScreen.tsx         # Google + Modo Demo
    DashboardScreen.tsx     # nível, XP, streak, conquistas
    WorkoutScreen.tsx       # log de treino (exercícios, séries, reps, carga)
    ChallengesScreen.tsx    # desafios diários + resgate de XP
    HistoryScreen.tsx       # calendário do mês, PRs, últimos treinos
```

## 🎮 Regras de gamificação

- **XP por treino:** 50 base + 10/exercício + volume/100 (teto de 150, evita farm)
- **Nível:** `nível = √(XP/150) + 1` (curva quadrática)
- **Streak:** dias consecutivos com treino registrado (não quebra se ainda for hoje)
- **Desafios diários:** 2 por dia, sorteados deterministicamente pela data
- **Badges:** 1º treino, 10 treinos, streak 7, Clube dos 100kg, 1 tonelada, nível 5
