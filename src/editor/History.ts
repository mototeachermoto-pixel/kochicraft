/**
 * Undo / Redo のための編集履歴。
 * 1回の操作（設置・削除・ブラシ・塗りつぶし・貼り付けなど）を
 * 「変更セル群」のまとまり(EditBatch)として記録する。
 * 適用はまとめて行うため、大量セルでも再メッシュは一括で済む。
 */

/** 1セルの変更内容 */
export interface CellChange {
  x: number;
  y: number;
  z: number;
  /** 変更前のブロックID */
  prev: number;
  /** 変更後のブロックID */
  next: number;
}

/** 1操作分の変更のまとまり */
export type EditBatch = CellChange[];

/** セル群へまとめてブロックを適用する関数（World.setBlocksBatch を包んで渡す） */
export type ApplyBatchFn = (cells: { x: number; y: number; z: number; id: number }[]) => void;

export class History {
  private undoStack: EditBatch[] = [];
  private redoStack: EditBatch[] = [];

  /** 履歴の最大保持数（メモリ保護） */
  private readonly limit: number;

  /** 状態変化を通知するコールバック（ボタンの有効/無効更新に使用） */
  onChange?: () => void;

  constructor(limit = 100) {
    this.limit = limit;
  }

  /** 新しい操作を記録する（redo履歴はクリアされる） */
  push(batch: EditBatch): void {
    if (batch.length === 0) return;
    this.undoStack.push(batch);
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.onChange?.();
  }

  /** 直前の操作を取り消す */
  undo(apply: ApplyBatchFn): boolean {
    const batch = this.undoStack.pop();
    if (!batch) return false;
    apply(batch.map((c) => ({ x: c.x, y: c.y, z: c.z, id: c.prev })));
    this.redoStack.push(batch);
    this.onChange?.();
    return true;
  }

  /** 取り消した操作をやり直す */
  redo(apply: ApplyBatchFn): boolean {
    const batch = this.redoStack.pop();
    if (!batch) return false;
    apply(batch.map((c) => ({ x: c.x, y: c.y, z: c.z, id: c.next })));
    this.undoStack.push(batch);
    this.onChange?.();
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
