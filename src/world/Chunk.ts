import * as THREE from 'three';
import { CHUNK_SIZE } from '@/config/constants';
import { AIR } from './BlockRegistry';
import { createEmptyVoxels, inChunkBounds, voxelIndex } from './VoxelData';

/**
 * チャンク：CHUNK_SIZE × WORLD_HEIGHT × CHUNK_SIZE のボクセルのまとまり。
 * 描画は不透明メッシュ・半透明メッシュの2つに分けて保持する。
 */
export class Chunk {
  /** チャンク座標（ブロック座標ではない） */
  readonly cx: number;
  readonly cz: number;

  /** ボクセルデータ（ブロックID） */
  readonly voxels: Uint8Array;

  /** メッシュの再生成が必要か */
  dirty = true;

  /** 描画メッシュ（不透明 / 半透明）。未生成時は null */
  opaqueMesh: THREE.Mesh | null = null;
  transparentMesh: THREE.Mesh | null = null;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.voxels = createEmptyVoxels();
  }

  /** ワールドX方向の原点ブロック座標 */
  get originX(): number {
    return this.cx * CHUNK_SIZE;
  }

  /** ワールドZ方向の原点ブロック座標 */
  get originZ(): number {
    return this.cz * CHUNK_SIZE;
  }

  /** ローカル座標のブロックIDを取得（範囲外は空気） */
  getLocal(x: number, y: number, z: number): number {
    if (!inChunkBounds(x, y, z)) return AIR;
    return this.voxels[voxelIndex(x, y, z)];
  }

  /** ローカル座標にブロックを設定。変化があれば dirty を立てて true を返す */
  setLocal(x: number, y: number, z: number, id: number): boolean {
    if (!inChunkBounds(x, y, z)) return false;
    const i = voxelIndex(x, y, z);
    if (this.voxels[i] === id) return false;
    this.voxels[i] = id;
    this.dirty = true;
    return true;
  }

  /** 保持しているメッシュ資源を解放する（メモリリーク防止） */
  disposeMeshes(): void {
    for (const mesh of [this.opaqueMesh, this.transparentMesh]) {
      if (!mesh) continue;
      mesh.geometry.dispose();
      mesh.removeFromParent();
    }
    this.opaqueMesh = null;
    this.transparentMesh = null;
  }
}
