// ============================================================
// CONFIGURE AQUI: cole as credenciais do seu projeto Firebase
// (Console Firebase > Configurações do projeto > Seus apps > Web)
// Depois habilite Authentication > Sign-in method > Google.
// Sem configurar, o app roda 100% em Modo Demo (dados locais).
// ============================================================
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut as fbSignOut, Auth, User,
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyBGbEsMuyMYmr_M_vqtrEYjRnwImhr26os',
  // Igual ao domínio do Firebase Hosting (não o .firebaseapp.com padrão): com
  // signInWithRedirect, o login passa por esse domínio no meio do caminho antes de
  // voltar pro app. Se for um domínio diferente do app hospedado, navegadores com
  // proteção de rastreamento entre sites (Safari, principalmente) descartam o
  // estado da sessão nessa troca de domínio e o login volta silenciosamente sem
  // logar ninguém. Mantendo os dois iguais, o handler de login roda no mesmo
  // domínio do app (Firebase Hosting já serve isso automaticamente em /__/auth/*).
  authDomain: 'gym-chalenge.web.app',
  projectId: 'gym-chalenge',
  storageBucket: 'gym-chalenge.firebasestorage.app',
  messagingSenderId: '717351756908',
  appId: '1:717351756908:web:9c866f3be0b55ed99ea449',
};

export const hasFirebase = !firebaseConfig.apiKey.startsWith('COLE_');

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
export let db: Firestore | null = null;
if (hasFirebase) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export type AppUser = { uid: string; name: string; photo?: string; demo: boolean };

// Redirect em vez de popup: no Safari (iOS e outros navegadores mobile), o popup de
// login costuma "resolver" sem persistir sessão nenhuma — bloqueio de armazenamento
// de terceiros faz o app achar que logou, mas nenhuma escrita no Firestore tem uma
// sessão autenticada de verdade por trás (some como "Missing or insufficient
// permissions" na primeira operação). Redirect navega a página inteira pro login do
// Google e volta, o que evita esse problema de armazenamento particionado.
export async function signInWithGoogle(): Promise<void> {
  if (!auth) throw new Error('Firebase não configurado (src/firebase.ts).');
  if (Platform.OS !== 'web') {
    throw new Error('No celular, o login Google exige dev build. Use o Modo Demo ou rode no navegador (npm run web).');
  }
  await signInWithRedirect(auth, new GoogleAuthProvider());
}

// Chamar uma vez ao iniciar o app: captura erro de um redirect de login que acabou
// de voltar (ex: usuário cancelou no Google). Sucesso não precisa ser tratado aqui —
// onAuthStateChanged (watchAuth) já dispara com o usuário assim que a sessão resolve.
export async function consumeRedirectError(): Promise<string | null> {
  if (!auth) return null;
  try {
    await getRedirectResult(auth);
    return null;
  } catch (e: any) {
    return e?.code === 'auth/popup-closed-by-user' ? null : (e?.message ?? 'Falha no login.');
  }
}

export function watchAuth(cb: (u: AppUser | null) => void): () => void {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, (u) => cb(u ? toAppUser(u) : null));
}

export async function signOut() {
  if (auth) await fbSignOut(auth);
}

function toAppUser(u: User): AppUser {
  return { uid: u.uid, name: u.displayName ?? 'Atleta', photo: u.photoURL ?? undefined, demo: false };
}
