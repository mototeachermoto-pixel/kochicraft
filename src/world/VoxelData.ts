import { CHUNK_SIZE, WORLD_HEIGHT } from '@/config/constants';

/**
 * チャンク内のボクセル配列に関する補助関数。
 * 配列は1次元 Uint8Array で、添字は index(x, y, z) で求める。
 * レイアウト: x が最内、その次 z、最外 y（上方向のスライスが連続）。
 */

/** 1チャンクが持つボクセル数 */
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT;

/** ローカル座標 (x,y,z) → 1次元添字 */
export function voxelIndex(x: number, y: number, z: number): number {
  return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
}

/** チャンク内のローカル座標として有効か */
export function inChunkBounds(x: number, y: number, z: number): boolean {
  return (
    x >= 0 &&
    x < CHUNK_SIZE &&
    z >= 0 &&
    z < CHUNK_SIZE &&
    y >= 0 &&
    y < WORLD_HEIGHT
  );
}

/** 空のボクセル配列を生成（すべて空気=0） */
export function createEmptyVoxels(): Uint8Array {
  return new Uint8Array(CHUNK_VOLUME);
}

/**
 * ランレングス圧縮（RLE）でボクセル配列を [id, 連続数, id, 連続数, ...] に変換。
 * 空気が多いボクセル世界では保存サイズが大きく減る。
 */
export function rleEncode(voxels: Uint8Array): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < voxels.length) {
    const value = voxels[i];
    let count = 1;
    while (i + count < voxels.length && voxels[i + count] === value) count++;
    out.push(value, count);
    i += count;
  }
  return out;
}

/** RLEを展開して既存のボクセル配列に書き戻す（配列長に合わせて切り詰め） */
export function rleDecodeInto(rle: number[], target: Uint8Array): void {
  let idx = 0;
  for (let i = 0; i + 1 < rle.length; i += 2) {
    const value = rle[i];
    const count = rle[i + 1];
    for (let k = 0; k < count && idx < target.length; k++) {
      target[idx++] = value;
    }
  }
  // 余りは空気で埋める
  while (idx < target.length) target[idx++] = 0;
}
