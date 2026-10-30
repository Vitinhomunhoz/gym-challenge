import {
  captureJoinFromLocation, clearPendingJoin, inviteCodeFromSearch, joinUrlForCode,
  normalizeInviteCode, readPendingJoin, savePendingJoin, HOSTED_APP_URL,
} from './joinLink';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
  get length() { return this.map.size; }
  key() { return null; }
  clear() { this.map.clear(); }
}

function installBrowser(search: string) {
  const store = new MemoryStorage();
  const loc = {
    href: `https://gym.test/${search}`,
    search,
    pathname: '/',
    hash: '',
    hostname: 'gym.test',
    origin: 'https://gym.test',
  };
  (global as unknown as { sessionStorage: MemoryStorage }).sessionStorage = store;
  (global as unknown as { window: unknown }).window = {
    location: loc,
    history: {
      state: null,
      replaceState: (_state: unknown, _title: string, next: string) => {
        loc.href = `https://gym.test${next}`;
        const q = next.indexOf('?');
        loc.search = q >= 0 ? next.slice(q).split('#')[0] : '';
        loc.hash = next.includes('#') ? next.slice(next.indexOf('#')) : '';
      },
    },
  };
  return loc;
}

afterEach(() => {
  delete (global as { sessionStorage?: unknown }).sessionStorage;
  delete (global as { window?: unknown }).window;
});

test('normaliza o código e ignora lixo', () => {
  expect(normalizeInviteCode(' ab12cd ')).toBe('AB12CD');
  expect(normalizeInviteCode('ABC')).toBeNull();
  expect(normalizeInviteCode('ABC12!')).toBeNull();
  expect(normalizeInviteCode(null)).toBeNull();
});

test('lê entrar e join na query', () => {
  expect(inviteCodeFromSearch('?entrar=gym7k2')).toBe('GYM7K2');
  expect(inviteCodeFromSearch('?join=ab12cd&outro=1')).toBe('AB12CD');
  expect(inviteCodeFromSearch('?entrar=curto')).toBeNull();
  expect(inviteCodeFromSearch('')).toBeNull();
});

test('guarda o código da URL e tira o parâmetro', () => {
  const loc = installBrowser('?entrar=ab12cd');
  expect(captureJoinFromLocation()).toBe('AB12CD');
  expect(loc.search).toBe('');
  expect(readPendingJoin()).toBe('AB12CD');
  clearPendingJoin();
  expect(readPendingJoin()).toBeNull();
});

test('sem código na URL, reaproveita o que já estava salvo', () => {
  installBrowser('');
  savePendingJoin('zz99yy');
  expect(captureJoinFromLocation()).toBe('ZZ99YY');
});

test('o link publicado aponta para o site hospedado', () => {
  expect(joinUrlForCode('gym7k2')).toBe(`${HOSTED_APP_URL}/?entrar=GYM7K2`);
});

test('no localhost o QR aponta para a origem local', () => {
  installBrowser('');
  (global as unknown as { window: { location: { hostname: string; origin: string } } }).window.location.hostname = 'localhost';
  (global as unknown as { window: { location: { origin: string } } }).window.location.origin = 'http://localhost:8081';
  expect(joinUrlForCode('GYM7K2')).toBe('http://localhost:8081/?entrar=GYM7K2');
});
