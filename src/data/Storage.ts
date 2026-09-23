import type { SaveFileV1, SaveSlotInfo } from '@/types';

/** localStorage のキー接頭辞 */
const PREFIX = 'kochicraft.save.';

/**
 * localStorage を使った保存スロットの読み書き（薄いラッパ）。
 * 将来 IndexedDB 等へ差し替えやすいよう、ここに保存先を集約する。
 */
export class Storage {
  /** localStorage が使えるか（プライベートモード等で使えない場合がある） */
  isAvailable(): boolean {
    try {
      const k = '__kc_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  save(slot: string, data: SaveFileV1): void {
    localStorage.setItem(PREFIX + slot, JSON.stringify(data));
  }

  load(slot: string): SaveFileV1 | null {
    const raw = localStorage.getItem(PREFIX + slot);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SaveFileV1;
    } catch {
      return null;
    }
  }

  remove(slot: string): void {
    localStorage.removeItem(PREFIX + slot);
  }

  /** 保存スロット一覧（更新日時の新しい順） */
  list(): SaveSlotInfo[] {
    const out: SaveSlotInfo[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      try {
        const data = JSON.parse(localStorage.getItem(key) ?? '') as SaveFileV1;
        out.push({
          slot: key.slice(PREFIX.length),
          title: data.meta?.title ?? '(なまえなし)',
          updatedAt: data.meta?.updatedAt ?? '',
        });
      } catch {
        // 壊れたデータは無視
      }
    }
    out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return out;
  }
}
