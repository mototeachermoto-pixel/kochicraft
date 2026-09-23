import { AIR } from '@/world/BlockRegistry';
import type { RaycastHit } from '../Raycaster';
import { Tool } from './Tool';

/**
 * ブラシツール。球状にまとめて設置・削除する。
 * 左クリック：対象面の隣を中心に球状に設置 / 右クリック：対象を中心に球状に削除。
 * 半径はブラシサイズ（1〜4）で調整。
 */
export class BrushTool extends Tool {
  readonly id = 'brush';
  readonly name = 'ブラシ';
  readonly icon = '🖌️';
  readonly usesBrushSize = true;

  onPrimary(hit: RaycastHit): void {
    const cx = hit.x + hit.nx;
    const cy = hit.y + hit.ny;
    const cz = hit.z + hit.nz;
    const cells = this.sphere(cx, cy, cz, (x, y, z) => this.editor.canPlaceAt(x, y, z));
    this.editor.applyChanges(cells.map((c) => ({ ...c, id: this.editor.selectedBlockId })));
  }

  onSecondary(hit: RaycastHit): void {
    const cells = this.sphere(hit.x, hit.y, hit.z, (x, y, z) => this.editor.isSolid(x, y, z));
    this.editor.applyChanges(cells.map((c) => ({ ...c, id: AIR })));
  }

  /** 中心 (cx,cy,cz) から半径 brushSize の球内で、条件を満たすセルを集める */
  private sphere(
    cx: number,
    cy: number,
    cz: number,
    accept: (x: number, y: number, z: number) => boolean,
  ): { x: number; y: number; z: number }[] {
    const r = this.editor.brushSize;
    const r2 = (r + 0.25) * (r + 0.25);
    const out: { x: number; y: number; z: number }[] = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy + dz * dz > r2) continue;
          const x = cx + dx;
          const y = cy + dy;
          const z = cz + dz;
          if (accept(x, y, z)) out.push({ x, y, z });
        }
      }
    }
    return out;
  }
}
