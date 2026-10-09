import { SaveStorage } from './SaveStorage';

/**
 * 情報パネルの「付け足し文」を保存・取得する（保存先は SaveStorage が決める）。
 * 基本の英文（コード内の guide）はそのまま残し、先生や子どもが「＋」ボタンで
 * 書き足した文だけをここに保存する（消せるのは足した分だけ＝付け足し方式）。
 * GAS 版は大学の Google に子どもの番号ごと、それ以外は端末内 localStorage。
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
    return SaveStorage.get(key(spotId, objectId, field)) ?? '';
  },
  /** 付け足し文を保存（空文字なら削除） */
  set(spotId: string, objectId: string, field: GuideField, text: string): void {
    // 容量超過などは無視（その場の表示は継続）
    const t = text.trim();
    if (t) SaveStorage.set(key(spotId, objectId, field), t);
    else SaveStorage.remove(key(spotId, objectId, field));
  },
};
