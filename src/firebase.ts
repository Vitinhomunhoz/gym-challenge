// ============================================================
// CONFIGURE AQUI: cole as credenciais do seu projeto Firebase
// (Console Firebase > Configurações do projeto > Seus apps > Web)
// Depois habilite Authentication > Sign-in method > Google.
// Sem configurar, o app roda 100% em Modo Demo (dados locais).
// ============================================================
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  onAuthStateChanged, signOut as fbSignOut, Auth, User,
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyBGbEsMuyMYmr_M_vqtrEYjRnwImhr26os',
  authDomain: 'gym-chalenge.firebaseapp.com',
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

export async function signInWithGoogle(): Promise<AppUser> {
  if (!auth) throw new Error('Firebase não configurado (src/firebase.ts).');
  if (Platform.OS !== 'web') {
    throw new Error('No celular, o login Google exige dev build. Use o Modo Demo ou rode no navegador (npm run web).');
  }
  const res = await signInWithPopup(auth, new GoogleAuthProvider());
  return toAppUser(res.user);
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
