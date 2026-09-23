/**
 * 子どもが「工作ひろば」で積んだ/消したブロックの差分を保存・復元する。
 * - 端末内 localStorage に**自動保存**（オフライン・外部送信なし）。
 * - さらに `.kcw` ファイル（JSON）として**書き出し/読み込み**できる。
 *   iPad では共有シート経由で「ファイル」/iCloud に保存でき、消えない・先生へ共有・他端末へ移せる。
 *
 * 差分は「観光地の build() で作る景観」との差分（＝ユーザーが変えたセルだけ）。
 * id=0（空気）は「消したマス」を表す。再入場時に build() の後で重ねて適用する。
 */

/** 1マスの編集（id=0 は削除＝空気） */
export interface EditCell {
  x: number;
  y: number;
  z: number;
  id: number;
}

/** localStorage に保存する1マスの圧縮形（タプル）：[x, y, z, id] */
type CellTuple = [number, number, number, number];

const PREFIX = 'kc.edits.';
const FILE_FORMAT = 'kochicraft-edits';
const FILE_VERSION = 1;

function toTuples(cells: EditCell[]): CellTuple[] {
  return cells.map((c) => [c.x, c.y, c.z, c.id]);
}
function fromTuples(tuples: CellTuple[] | undefined): EditCell[] {
  if (!Array.isArray(tuples)) return [];
  return tuples
    .filter((t) => Array.isArray(t) && t.length === 4)
    .map(([x, y, z, id]) => ({ x, y, z, id }));
}

export const EditStore = {
  /** localStorage が使えるか（プライベートモード等で使えないことがある） */
  isAvailable(): boolean {
    try {
      const k = '__kc_edit_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  },

  /** その観光地の編集差分を取得 */
  load(spotId: string): EditCell[] {
    try {
      const raw = localStorage.getItem(PREFIX + spotId);
      if (!raw) return [];
      const data = JSON.parse(raw) as { cells?: CellTuple[] };
      return fromTuples(data.cells);
    } catch {
      return [];
    }
  },

  /** その観光地の編集差分を保存（自動保存で都度呼ぶ） */
  save(spotId: string, cells: EditCell[]): void {
    try {
      const data = { v: 1, cells: toTuples(cells), updatedAt: new Date().toISOString() };
      localStorage.setItem(PREFIX + spotId, JSON.stringify(data));
    } catch {
      // 容量超過などは無視（その場の表示は継続）
    }
  },

  /** その観光地の編集を消す */
  clear(spotId: string): void {
    try {
      localStorage.removeItem(PREFIX + spotId);
    } catch {
      // 無視
    }
  },

  /** 編集が保存されている観光地ID一覧 */
  listSpotIds(): string[] {
    const ids: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PREFIX)) ids.push(key.slice(PREFIX.length));
      }
    } catch {
      // 無視
    }
    return ids;
  },

  /** 全観光地の編集を1つの .kcw（JSON文字列）にまとめる */
  exportText(): string {
    const spots: Record<string, { cells: CellTuple[] }> = {};
    for (const id of this.listSpotIds()) {
      spots[id] = { cells: toTuples(this.load(id)) };
    }
    const file = {
      format: FILE_FORMAT,
      version: FILE_VERSION,
      meta: { title: 'KochiCraft worlds', updatedAt: new Date().toISOString() },
      spots,
    };
    return JSON.stringify(file);
  },

  /**
   * .kcw ファイルとして書き出す（ダウンロード）。
   * iPad では共有シート/「ファイル」アプリへ保存できる。
   */
  download(filename = 'kochicraft.kcw'): void {
    const blob = new Blob([this.exportText()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // すぐ revoke すると一部端末で失敗するため少し遅らせる
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },

  /**
   * .kcw のテキストを読み込んで localStorage へ取り込む。
   * @returns 取り込めた観光地IDの一覧（呼び出し側が現在地なら再適用する）
   */
  importText(text: string): string[] {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('ファイルを読み取れませんでした（JSONではありません）。');
    }
    const d = data as { format?: string; spots?: Record<string, { cells?: CellTuple[] }> };
    if (!d || d.format !== FILE_FORMAT || !d.spots) {
      throw new Error('KochiCraft の保存ファイル（.kcw）ではありません。');
    }
    const affected: string[] = [];
    for (const [spotId, payload] of Object.entries(d.spots)) {
      const cells = fromTuples(payload?.cells);
      this.save(spotId, cells);
      affected.push(spotId);
    }
    return affected;
  },
};
