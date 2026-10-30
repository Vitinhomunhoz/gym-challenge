// Convite por link/QR. O login do Google recarrega a página (redirect), então o
// código precisa sobreviver fora da memória: fica no sessionStorage até a pessoa
// entrar no grupo.
const STORAGE_KEY = 'gymchallenge:pendingJoin';
const CODE_PATTERN = /^[A-Z0-9]{6}$/;

export const HOSTED_APP_URL = 'https://gym-chalenge.web.app';

export function normalizeInviteCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export function inviteCodeFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return normalizeInviteCode(params.get('entrar') || params.get('join'));
}

function storage(): Storage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

export function readPendingJoin(): string | null {
  return normalizeInviteCode(storage()?.getItem(STORAGE_KEY));
}

export function savePendingJoin(code: string): void {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return;
  storage()?.setItem(STORAGE_KEY, normalized);
}

export function clearPendingJoin(): void {
  storage()?.removeItem(STORAGE_KEY);
}

export function captureJoinFromLocation(): string | null {
  if (typeof window === 'undefined' || !window.location) return readPendingJoin();
  const fromUrl = inviteCodeFromSearch(window.location.search || '');
  if (!fromUrl) return readPendingJoin();
  savePendingJoin(fromUrl);
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('entrar');
    url.searchParams.delete('join');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // O código já está salvo. Se a URL ficar com o parâmetro, a próxima abertura lê de novo.
  }
  return fromUrl;
}

export function joinUrlForCode(code: string): string {
  const normalized = normalizeInviteCode(code) ?? code.trim().toUpperCase();
  let origin = HOSTED_APP_URL;
  if (typeof window !== 'undefined' && window.location?.origin) {
    const host = window.location.hostname;
    const local = host === 'localhost' || host === '127.0.0.1';
    const hosted = host.endsWith('.web.app') || host.endsWith('.firebaseapp.com');
    if (local || hosted) origin = window.location.origin;
  }
  return `${origin}/?entrar=${encodeURIComponent(normalized)}`;
}
