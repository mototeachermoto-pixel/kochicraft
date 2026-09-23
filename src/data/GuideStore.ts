/**
 * 情報パネルの「付け足し文」を localStorage に保存・取得する。
 * 基本の英文（コード内の guide）はそのまま残し、先生や子どもが「＋」ボタンで
 * 書き足した文だけをここに保存する（消せるのは足した分だけ＝付け足し方式）。
 * 完全ローカル保存・外部送信なし。
 */
const GUIDE = 'kc.guide.';

/** 付け足しできる欄（You can／Special／About） */
export type GuideField = 'canDo' | 'feature' | 'about';

function key(spotId: string, objectId: string, field: GuideField): string {
  return `${GUIDE}${spotId}.${objectId}.${field}`;
}

export const GuideStore = {
  /** 付け足し文を取得（無ければ空文字） */
  get(spotId: string, objectId: string, field: GuideField): string {
    try {
      return localStorage.getItem(key(spotId, objectId, field)) ?? '';
    } catch {
      return '';
    }
  },
  /** 付け足し文を保存（空文字なら削除） */
  set(spotId: string, objectId: string, field: GuideField, text: string): void {
    try {
      const t = text.trim();
      if (t) localStorage.setItem(key(spotId, objectId, field), t);
      else localStorage.removeItem(key(spotId, objectId, field));
    } catch {
      // 容量超過などは無視（その場の表示は継続）
    }
  },
};
