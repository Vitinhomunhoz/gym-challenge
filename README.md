# Gym Challenge

Diário de treino com gamificação, feito em React Native e Expo. O mesmo código abre no navegador e no celular (Expo Go). O protótipo registra o treino, calcula XP, nível, streak e recordes, e deixa competir em grupo por código de convite.

Dá para usar sem conta. O **Modo Demo** guarda o diário neste aparelho e abre um grupo de exemplo (ranking e chat locais) para ver a tela social. O ranking entre pessoas de verdade usa login com Google e o Firestore.

## Como rodar

```bash
npm install
npm run web      # navegador, em http://localhost:8081
npm start        # servidor para o celular (Expo Go)
npm test         # Jest: XP, nível, datas, fotos
```

No navegador do celular o app também abre, no mesmo endereço da sua rede (o terminal mostra o IP). O formulário de treino cabe na largura da tela.

### No celular, com o Expo Go

O projeto usa o Expo SDK 52. O Expo Go da loja, em 2026, é de um SDK mais novo e recusa este projeto. No Android dá para instalar o Expo Go feito para o SDK 52:

1. Computador e celular na mesma rede Wi-Fi.
2. No Android, instale o Expo Go 2.32.20: [expo.dev/go](https://expo.dev/go?device=true&platform=android&sdkVersion=52) (o APK também está em [Expo-Go-2.32.20.apk](https://github.com/expo/expo-go-releases/releases/download/Expo-Go-2.32.20/Expo-Go-2.32.20.apk)).
3. Na pasta do projeto, `npm start`.
4. No Expo Go, escaneie o QR code do terminal. Se o celular não achar o computador, pare o servidor e rode `npx expo start --tunnel`.

Entre em **Modo Demo**. O login com Google não funciona dentro do Expo Go. Câmera e galeria do check-in funcionam.

No iPhone físico a Apple não deixa instalar essa versão antiga do Expo Go. Aí o caminho é o navegador (Safari) ou um build de desenvolvimento (`eas build`), que gera um app instalável e exige conta na Expo. Um build para iPhone também pede o programa de desenvolvedor da Apple.

## O que cada tela faz

| Tela | O que acontece |
| --- | --- |
| Início | Nível, XP até o próximo nível, streak, volume e conquistas. O nome abre o perfil (foto, tema claro/escuro/automático e sair). |
| Treino | Só salva se houver ao menos um exercício com nome e uma série com repetições. Volume e XP são calculados na hora. |
| Desafios | Dois desafios do dia, os mesmos para todo mundo naquela data. O bônus de XP é resgatado uma vez. |
| Check-in | Foto pela câmera ou pela galeria, como declaração de que treinou hoje. Não confere o local nem a data da foto. |
| Histórico | Calendário mês a mês (até o mês atual), recordes de carga e os treinos daquele dia. |
| Grupos | Criar ou entrar com um código. Dentro: pódio, ranking do período (7, 14 ou 30 dias) e chat. No grupo de verdade, um QR abre o convite no celular. No Modo Demo, o grupo **Galera da Academia** é um exemplo só deste aparelho. |

Sair da conta limpa a sessão na memória. O diário continua no aparelho e volta no próximo acesso da mesma conta (ou do demo).

## Na banca, entrar pelo QR

No grupo criado com a conta Google, a tela do ranking mostra um QR. O link é `https://gym-chalenge.web.app/?entrar=CODIGO` (também aceita `?join=`).

1. Crie o grupo na aula e deixe o QR no projetor.
2. O avaliador escaneia com a câmera do celular.
3. O site abre. Se ainda não houver sessão, a tela de login avisa o código. Entrar com Google guarda o convite na sessão do navegador (o redirect do Google recarrega a página) e o app entra no grupo sozinho.
4. Check-in e chat passam a aparecer no ranking ao vivo.

O Modo Demo não entra nesse grupo: o ranking compartilhado precisa da conta Google.

## Regras de jogo

**XP de um treino:** 50 + 10 por exercício + `volume / 100`, com o bônus de volume limitado a 150. Carga ou repetição inválida entra como zero, então o XP não fica abaixo da base.

**Nível:** `floor(√(XP / 150)) + 1`. O nível N começa em `150 × (N − 1)²` XP. Os títulos vão de Iniciante a Mestre de Ferro.

**Streak:** dias seguidos com pelo menos um treino. Se hoje ainda não teve treino, a sequência de ontem continua valendo.

**Recordes:** a maior carga de cada exercício com peso acima de zero. O nome é exibido com a capitalização em português (`Supino reto` vira `Supino Reto`).

**Conquistas**

| Nome | Quando abre |
| --- | --- |
| Primeiro Passo | 1 treino registrado |
| Frequente | 10 treinos |
| Semana de Fogo | streak de 7 dias |
| Clube dos 100kg | uma série com 100 kg ou mais |
| Uma Tonelada | 1.000 kg de volume acumulado |
| Nível 5 | chegar no nível 5 |

## Onde os dados ficam

O diário pessoal fica no aparelho (AsyncStorage, separado por usuário): treinos, XP, streak, desafios resgatados e as fotos de check-in. Isso não sobe para o servidor.

O Firestore guarda só o que o grupo precisa ver: perfil (nome e foto), código de convite, contadores do ranking e as mensagens do chat. Entrar num grupo publica esses totais, não a ficha de cada série.

Fotos grandes são reduzidas na web. Se ainda assim não couberem no documento (limite de 1 MB) ou no armazenamento local, o contador do grupo segue e a foto fica de fora daquela gravação.

## Ranking e o que a regra não cobre

Cada membro só aumenta o próprio placar, em um passo por escrita: no máximo +1 check-in, +1 treino e +50.000 kg, e o valor não pode cair. Nome e foto podem ser atualizados. A coleção de códigos de convite permite ler um código, não listar todos.

Isso impede gravar um placar absurdo num único pedido. Não impede repetir o mesmo incremento várias vezes. A validação de “um evento por dia” está em `functions/src/index.ts`, testada, e ainda não publicada: o deploy exige o plano Blaze do Firebase. Para publicar regras e functions juntas:

```bash
npx firebase-tools login
cd functions && npm run build && cd ..
npx firebase-tools deploy --only firestore:rules,functions
```

Ao publicar as functions, as regras de `members/{uid}` precisam passar a bloquear a escrita direta do placar, porque quem soma passa a ser só a Function.

O projeto Firebase já está apontado em `src/firebase.ts` (`gym-chalenge`). O botão **Entrar com Google** usa redirect e volta para o app. No console do Firebase, o domínio em que o app está aberto (por exemplo `localhost`) precisa estar em Authentication → Settings → Authorized domains, com o provedor Google ligado.

## Estrutura

```
App.tsx                  abas, sessão e aviso de XP
firestore.rules          regras do Firestore
functions/src/index.ts   soma do placar no servidor (não publicada)
src/firebase.ts          Auth e Firestore
src/store.tsx            estado e diário local
src/gamification.ts      XP, nível, streak, desafios, recordes e conquistas
src/groups.ts            grupos, ranking e chat
src/demoGroup.ts         grupo de exemplo do Modo Demo
src/photos.ts            foto que cabe no Firestore e no aparelho
src/theme.tsx            claro, escuro e automático
src/components/UI.tsx    cartão, botão, anel de nível
src/screens/             login, início, treino, desafios, check-in, histórico, grupos, perfil
```
