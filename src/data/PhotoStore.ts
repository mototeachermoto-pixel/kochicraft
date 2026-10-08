/**
 * 観光地オブジェクトの「写真」「英語音声」を localStorage に保存・取得する。
 * 先生がアップロードした実物写真・録音音声を、再読み込み後も使えるようにする。
 * いずれも dataURL（ローカル保存・外部送信なし）。
 * localStorage は端末・URLごとに約5MBしかないため、写真は保存前に小さく縮める。
 */
const PHOTO = 'kc.photo.';
const AUDIO = 'kc.audio.';

/** 縮めた写真の長い辺（px）と JPEG 画質。画質より保存できる枚数を優先する */
const MAX_SIDE = 480;
const JPEG_QUALITY = 0.6;

function read(prefix: string, spotId: string, objectId: string): string | undefined {
  try {
    return localStorage.getItem(`${prefix}${spotId}.${objectId}`) ?? undefined;
  } catch {
    return undefined;
  }
}

/** 保存できたら true。容量超過などで保存できなければ false */
function write(prefix: string, spotId: string, objectId: string, dataUrl: string): boolean {
  try {
    localStorage.setItem(`${prefix}${spotId}.${objectId}`, dataUrl);
    return true;
  } catch {
    return false;
  }
}

/** 写真を小さな JPEG に縮める。読めない画像や、縮めても小さくならない場合は元のまま返す */
function shrinkPhoto(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      // すでに小さい JPEG は作り直さない（開くたびに画質が落ちていくのを防ぐ）
      if (scale === 1 && dataUrl.startsWith('data:image/jpeg')) return resolve(dataUrl);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      // 透明部分が JPEG で黒くならないよう、白で下地を塗る
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const small = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      resolve(small.length < dataUrl.length ? small : dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** すでに保存済みの写真のキー一覧 */
function savedPhotoKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PHOTO)) keys.push(k);
    }
  } catch {
    // localStorage が使えない環境では何もしない
  }
  return keys;
}

export const PhotoStore = {
  getPhoto: (spotId: string, objectId: string) => read(PHOTO, spotId, objectId),
  setPhoto: (spotId: string, objectId: string, dataUrl: string) => write(PHOTO, spotId, objectId, dataUrl),
  getAudio: (spotId: string, objectId: string) => read(AUDIO, spotId, objectId),
  setAudio: (spotId: string, objectId: string, dataUrl: string) => write(AUDIO, spotId, objectId, dataUrl),
  shrinkPhoto,

  /**
   * 以前の版で縮めずに保存された写真を、縮めて保存し直す（空き容量を作る）。
   * 縮められなかった写真は元のまま残す（消さない）。
   */
  async shrinkSavedPhotos(): Promise<void> {
    for (const key of savedPhotoKeys()) {
      let original: string | null = null;
      try {
        original = localStorage.getItem(key);
      } catch {
        continue;
      }
      if (!original) continue;
      const small = await shrinkPhoto(original);
      if (small === original) continue;
      try {
        localStorage.setItem(key, small);
      } catch {
        // 書き直せなくても元の写真は残っている
      }
    }
  },
};
