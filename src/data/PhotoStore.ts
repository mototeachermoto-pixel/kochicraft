/**
 * 観光地オブジェクトの「写真」「英語音声」を localStorage に保存・取得する。
 * 先生がアップロードした実物写真・録音音声を、再読み込み後も使えるようにする。
 * いずれも dataURL（ローカル保存・外部送信なし）。
 */
const PHOTO = 'kc.photo.';
const AUDIO = 'kc.audio.';

function read(prefix: string, spotId: string, objectId: string): string | undefined {
  try {
    return localStorage.getItem(`${prefix}${spotId}.${objectId}`) ?? undefined;
  } catch {
    return undefined;
  }
}
function write(prefix: string, spotId: string, objectId: string, dataUrl: string): void {
  try {
    localStorage.setItem(`${prefix}${spotId}.${objectId}`, dataUrl);
  } catch {
    // 容量超過などは無視（その場の表示・再生は継続）
  }
}

export const PhotoStore = {
  getPhoto: (spotId: string, objectId: string) => read(PHOTO, spotId, objectId),
  setPhoto: (spotId: string, objectId: string, dataUrl: string) => write(PHOTO, spotId, objectId, dataUrl),
  getAudio: (spotId: string, objectId: string) => read(AUDIO, spotId, objectId),
  setAudio: (spotId: string, objectId: string, dataUrl: string) => write(AUDIO, spotId, objectId, dataUrl),
};
