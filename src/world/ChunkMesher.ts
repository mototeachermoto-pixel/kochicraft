import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT } from '@/config/constants';
import { AIR, blockRegistry } from './BlockRegistry';
import type { Chunk } from './Chunk';

/**
 * チャンクのボクセルから描画用ジオメトリを生成する（グリーディメッシング方式）。
 *
 * - 隣り合う「同じブロック・同じ向き」の面を1枚の大きな矩形にまとめることで、
 *   平らな地面や壁の頂点数・三角形数を大幅に削減する（Phase 8 最適化）。
 * - 隣が透明（空気・水・ガラス）のときだけ面を出すフェイスカリングは維持。
 * - テクスチャは使わず、面の向きの陰影を頂点カラーに焼き込む。
 */

/** グローバル座標のブロックIDを返す関数の型 */
export type GetBlockFn = (gx: number, gy: number, gz: number) => number;

interface MeshBuffers {
  positions: number[];
  normals: number[];
  colors: number[];
  indices: number[];
}

function createBuffers(): MeshBuffers {
  return { positions: [], normals: [], colors: [], indices: [] };
}

function toGeometry(buf: MeshBuffers): THREE.BufferGeometry | null {
  if (buf.positions.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.colors, 3));
  geo.setIndex(buf.indices);
  geo.computeBoundingSphere();
  return geo;
}

/** あるブロックの、隣ブロックに面した面を出すべきか */
function isFaceVisible(currentId: number, neighborId: number): boolean {
  const currentTransparent = blockRegistry.isTransparent(currentId);
  if (!currentTransparent) {
    return blockRegistry.isTransparent(neighborId);
  }
  return neighborId !== currentId && blockRegistry.isTransparent(neighborId);
}

/** 面の向き(d=0:x,1:y,2:z)と符号から陰影を決める（上を明るく、下を暗く） */
function shadeFor(d: number, dir: number): number {
  if (d === 1) return dir > 0 ? 1.0 : 0.5; // 上 / 下
  if (d === 0) return 0.82; // 左右
  return 0.68; // 前後
}

export class ChunkMesher {
  /**
   * チャンクのジオメトリを生成する。
   * @param chunk    対象チャンク
   * @param getBlock 隣接判定のためのグローバル座標ブロック取得関数
   */
  static build(
    chunk: Chunk,
    getBlock: GetBlockFn,
  ): { opaque: THREE.BufferGeometry | null; transparent: THREE.BufferGeometry | null } {
    const opaque = createBuffers();
    const transparent = createBuffers();
    const color = new THREE.Color();

    const dims = [CHUNK_SIZE, WORLD_HEIGHT, CHUNK_SIZE];
    const ox = chunk.originX;
    const oz = chunk.originZ;
    // ローカル座標→グローバルでブロック取得（チャンク外は隣チャンク/ワールド境界を参照）
    const voxel = (lx: number, ly: number, lz: number): number => getBlock(ox + lx, ly, oz + lz);

    // 1枚の矩形（マージ済みの面）を出力
    const emit = (
      id: number,
      dir: number,
      d: number,
      p: number[],
      duVec: number[],
      dvVec: number[],
    ): void => {
      const target = blockRegistry.isTransparent(id) ? transparent : opaque;
      color.copy(blockRegistry.getColor(id)).multiplyScalar(shadeFor(d, dir));
      const base = target.positions.length / 3;

      const corners = [
        [p[0], p[1], p[2]],
        [p[0] + duVec[0], p[1] + duVec[1], p[2] + duVec[2]],
        [p[0] + duVec[0] + dvVec[0], p[1] + duVec[1] + dvVec[1], p[2] + duVec[2] + dvVec[2]],
        [p[0] + dvVec[0], p[1] + dvVec[1], p[2] + dvVec[2]],
      ];
      const nx = d === 0 ? dir : 0;
      const ny = d === 1 ? dir : 0;
      const nz = d === 2 ? dir : 0;
      for (const c of corners) {
        target.positions.push(c[0], c[1], c[2]);
        target.normals.push(nx, ny, nz);
        target.colors.push(color.r, color.g, color.b);
      }
      if (dir > 0) {
        target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      } else {
        target.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
      }
    };

    // 3つの軸それぞれでスライスを走査し、面マスクを作ってグリーディに矩形マージ
    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3;
      const v = (d + 2) % 3;
      const du = dims[u];
      const dv = dims[v];
      const dd = dims[d];
      const mask = new Int32Array(du * dv);
      const x = [0, 0, 0];
      const q = [0, 0, 0];
      q[d] = 1;

      for (x[d] = -1; x[d] < dd; ) {
        // --- 面マスクを作る ---
        let n = 0;
        for (x[v] = 0; x[v] < dv; x[v]++) {
          for (x[u] = 0; x[u] < du; x[u]++, n++) {
            const a = voxel(x[0], x[1], x[2]);
            const b = voxel(x[0] + q[0], x[1] + q[1], x[2] + q[2]);
            const aVis = a !== AIR && isFaceVisible(a, b);
            const bVis = b !== AIR && isFaceVisible(b, a);
            // 正=ブロックaの+d面 / 負=ブロックbの-d面 / 0=面なし
            mask[n] = aVis ? a : bVis ? -b : 0;
          }
        }

        x[d]++;

        // --- マスクを矩形にマージして面を出す ---
        n = 0;
        for (let j = 0; j < dv; j++) {
          for (let i = 0; i < du; ) {
            const c = mask[n];
            if (c !== 0) {
              // 横幅（u方向）
              let w = 1;
              while (i + w < du && mask[n + w] === c) w++;
              // 縦幅（v方向）
              let h = 1;
              let stop = false;
              while (j + h < dv) {
                for (let k = 0; k < w; k++) {
                  if (mask[n + k + h * du] !== c) {
                    stop = true;
                    break;
                  }
                }
                if (stop) break;
                h++;
              }

              x[u] = i;
              x[v] = j;
              const duVec = [0, 0, 0];
              duVec[u] = w;
              const dvVec = [0, 0, 0];
              dvVec[v] = h;
              emit(Math.abs(c), c > 0 ? 1 : -1, d, x, duVec, dvVec);

              // 使った範囲をクリア
              for (let l = 0; l < h; l++) {
                for (let k = 0; k < w; k++) mask[n + k + l * du] = 0;
              }
              i += w;
              n += w;
            } else {
              i++;
              n++;
            }
          }
        }
      }
    }

    return { opaque: toGeometry(opaque), transparent: toGeometry(transparent) };
  }
}
