// Fotos de perfil e de check-in. No navegador a imagem é reduzida antes de ir
// pro AsyncStorage (limite ~5 MB) e pro Firestore (limite de 1 MB por documento).
// Sem isso, uma foto da câmera em base64 derruba o save local e a sincronização
// do ranking inteira — o contador nem chega a subir.

const FIRESTORE_PHOTO_MAX = 480_000;

export function firestorePhoto(photo?: string | null, maxLen = FIRESTORE_PHOTO_MAX): string | undefined {
  if (!photo) return undefined;
  if (photo.startsWith('data:') && photo.length > maxLen) return undefined;
  return photo;
}

export async function compressPhoto(dataUrl: string, maxEdge = 800, quality = 0.72): Promise<string> {
  if (!dataUrl.startsWith('data:image/') || typeof document === 'undefined') return dataUrl;
  try {
    const img = await loadImage(dataUrl);
    const longest = Math.max(img.width, img.height) || 1;
    const scale = Math.min(1, maxEdge / longest);
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, width, height);
    const out = canvas.toDataURL('image/jpeg', quality);
    return out.length < dataUrl.length ? out : dataUrl;
  } catch {
    return dataUrl;
  }
}

export async function photoFromAsset(asset: { uri?: string | null; base64?: string | null }): Promise<string | null> {
  try {
    let dataUrl: string | null = null;
    if (asset.base64) {
      dataUrl = asset.base64.startsWith('data:') ? asset.base64 : `data:image/jpeg;base64,${asset.base64}`;
    } else if (asset.uri?.startsWith('data:')) {
      dataUrl = asset.uri;
    } else if (asset.uri && typeof fetch === 'function') {
      const res = await fetch(asset.uri);
      const blob = await res.blob();
      dataUrl = await blobToDataUrl(blob);
    }
    if (dataUrl) return await compressPhoto(dataUrl);
    return asset.uri ?? null;
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
