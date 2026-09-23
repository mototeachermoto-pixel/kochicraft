import * as THREE from 'three';
import type { Vec3 } from '@/types';

/** クリップボード（コピーした直方体領域のブロックデータ） */
export interface Clipboard {
  w: number;
  h: number;
  d: number;
  /** 添字 = (y*d + z)*w + x のブロックID配列 */
  data: Uint8Array;
}

/**
 * 範囲選択（2隅で定義する直方体）とクリップボードの管理。
 * 選択中はワイヤーフレームの黄色いボックスを表示する。
 */
export class Selection {
  /** 選択の2隅（ブロック座標） */
  a: Vec3 | null = null;
  b: Vec3 | null = null;

  /** コピー内容 */
  clipboard: Clipboard | null = null;

  private readonly boxMesh: THREE.LineSegments;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const mat = new THREE.LineBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.95 });
    this.boxMesh = new THREE.LineSegments(geo, mat);
    this.boxMesh.visible = false;
    this.boxMesh.renderOrder = 998;
    scene.add(this.boxMesh);
  }

  /** 隅を打つ。1隅目→2隅目→（次は新しい1隅目）と切り替わる */
  setCorner(p: Vec3): void {
    if (!this.a || (this.a && this.b)) {
      this.a = { ...p };
      this.b = null;
    } else {
      this.b = { ...p };
    }
    this.updateMesh();
  }

  clear(): void {
    this.a = null;
    this.b = null;
    this.updateMesh();
  }

  hasBox(): boolean {
    return this.a !== null && this.b !== null;
  }

  hasClipboard(): boolean {
    return this.clipboard !== null;
  }

  /** 選択範囲の最小・最大座標 */
  bounds(): { min: Vec3; max: Vec3 } | null {
    if (!this.a) return null;
    const b = this.b ?? this.a;
    return {
      min: { x: Math.min(this.a.x, b.x), y: Math.min(this.a.y, b.y), z: Math.min(this.a.z, b.z) },
      max: { x: Math.max(this.a.x, b.x), y: Math.max(this.a.y, b.y), z: Math.max(this.a.z, b.z) },
    };
  }

  /** 選択ボックスの表示を更新 */
  private updateMesh(): void {
    const bb = this.bounds();
    if (!bb) {
      this.boxMesh.visible = false;
      return;
    }
    const w = bb.max.x - bb.min.x + 1;
    const h = bb.max.y - bb.min.y + 1;
    const d = bb.max.z - bb.min.z + 1;
    this.boxMesh.scale.set(w, h, d);
    this.boxMesh.position.set(bb.min.x + w / 2, bb.min.y + h / 2, bb.min.z + d / 2);
    this.boxMesh.visible = true;
  }

  /** 現在の選択範囲をクリップボードへコピー */
  copyFrom(getBlock: (x: number, y: number, z: number) => number): void {
    const bb = this.bounds();
    if (!bb) return;
    const w = bb.max.x - bb.min.x + 1;
    const h = bb.max.y - bb.min.y + 1;
    const d = bb.max.z - bb.min.z + 1;
    const data = new Uint8Array(w * h * d);
    for (let y = 0; y < h; y++) {
      for (let z = 0; z < d; z++) {
        for (let x = 0; x < w; x++) {
          data[(y * d + z) * w + x] = getBlock(bb.min.x + x, bb.min.y + y, bb.min.z + z);
        }
      }
    }
    this.clipboard = { w, h, d, data };
  }

  /** クリップボードをY軸まわりに90°回転する */
  rotateClipboardY(): void {
    const c = this.clipboard;
    if (!c) return;
    const { w, h, d, data } = c;
    const nw = d;
    const nd = w;
    const nData = new Uint8Array(nw * h * nd);
    for (let y = 0; y < h; y++) {
      for (let z = 0; z < d; z++) {
        for (let x = 0; x < w; x++) {
          const id = data[(y * d + z) * w + x];
          // 90°回転（時計回り）：newX = z, newZ = (w-1) - x
          const nx = z;
          const nz = w - 1 - x;
          nData[(y * nd + nz) * nw + nx] = id;
        }
      }
    }
    this.clipboard = { w: nw, h, d: nd, data: nData };
  }
}
