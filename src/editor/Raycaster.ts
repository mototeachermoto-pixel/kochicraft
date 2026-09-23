import * as THREE from 'three';
import type { World } from '@/world/World';

/**
 * ボクセル空間に対するレイキャスト（Amanatides & Woo の DDA アルゴリズム）。
 * カメラから視線方向に進み、最初に当たった固体ブロックを返す。
 * 当たった面の法線も返すので、設置位置（隣の空きマス）を求められる。
 */

export interface RaycastHit {
  hit: boolean;
  /** 当たったブロックの座標 */
  x: number;
  y: number;
  z: number;
  /** 当たった面の法線（設置位置 = ヒット + 法線） */
  nx: number;
  ny: number;
  nz: number;
}

const MISS: RaycastHit = { hit: false, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0 };

export class VoxelRaycaster {
  /**
   * @param world    対象ワールド
   * @param origin   レイの始点（カメラ位置）
   * @param dir      正規化された視線方向
   * @param maxDist  最大到達距離（ブロック数）
   */
  static cast(
    world: World,
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
  ): RaycastHit {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = Math.sign(dir.x);
    const stepY = Math.sign(dir.y);
    const stepZ = Math.sign(dir.z);

    // 各軸で次のグリッド境界に達するまでの距離
    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

    let tMaxX = VoxelRaycaster.firstBoundary(origin.x, dir.x, tDeltaX);
    let tMaxY = VoxelRaycaster.firstBoundary(origin.y, dir.y, tDeltaY);
    let tMaxZ = VoxelRaycaster.firstBoundary(origin.z, dir.z, tDeltaZ);

    let nx = 0;
    let ny = 0;
    let nz = 0;
    let t = 0;

    // 始点がすでにブロック内なら即ヒット
    if (world.isSolid(x, y, z)) {
      return { hit: true, x, y, z, nx: 0, ny: 0, nz: 0 };
    }

    // 安全のため十分な反復回数で打ち切る
    const maxSteps = Math.ceil(maxDist * 3) + 3;
    for (let i = 0; i < maxSteps; i++) {
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
        nx = -stepX;
        ny = 0;
        nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }

      if (t > maxDist) break;
      if (world.isSolid(x, y, z)) {
        return { hit: true, x, y, z, nx, ny, nz };
      }
    }

    return { ...MISS };
  }

  /** 始点から最初のグリッド境界までの距離を計算 */
  private static firstBoundary(origin: number, dir: number, tDelta: number): number {
    if (dir === 0) return Infinity;
    const cell = Math.floor(origin);
    if (dir > 0) {
      return (cell + 1 - origin) * tDelta;
    }
    return (origin - cell) * tDelta;
  }
}
