import { firestorePhoto, compressPhoto } from './photos';

describe('foto enviada ao Firestore', () => {
  test('mantém URL curta e descarta data URL grande demais', () => {
    expect(firestorePhoto(undefined)).toBeUndefined();
    expect(firestorePhoto('https://lh3.googleusercontent.com/a/foto')).toBe('https://lh3.googleusercontent.com/a/foto');
    const huge = `data:image/jpeg;base64,${'a'.repeat(500_000)}`;
    expect(firestorePhoto(huge)).toBeUndefined();
    expect(firestorePhoto('data:image/jpeg;base64,abc')).toBe('data:image/jpeg;base64,abc');
  });

  test('sem DOM, a compressão devolve a imagem original', async () => {
    const photo = 'data:image/png;base64,abc';
    await expect(compressPhoto(photo)).resolves.toBe(photo);
    await expect(compressPhoto('https://exemplo/foto.jpg')).resolves.toBe('https://exemplo/foto.jpg');
  });
});
