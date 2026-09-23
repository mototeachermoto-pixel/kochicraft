import { AIR } from '@/world/BlockRegistry';
import type { RaycastHit } from '../Raycaster';
import { Tool } from './Tool';

/** 一度に塗りつぶせる最大セル数（暴走防止） */
const MAX_FILL = 8000;

/**
 * 塗りつぶしツール（3Dフラッドフィル＝バケツ）。
 * 左クリック：クリックしたブロックと同じ種類でつながった範囲を、選択ブロックに置換。
 * 右クリック：同じくつながった範囲を空気に（くり抜き）。
 */
export class FillTool extends Tool {
  readonly id = 'fill';
  readonly name = 'ぬりつぶし';
  readonly icon = '🪣';

  onPrimary(hit: RaycastHit): void {
    this.fill(hit, this.editor.selectedBlockId);
  }

  onSecondary(hit: RaycastHit): void {
    this.fill(hit, AIR);
  }

  private fill(hit: RaycastHit, newId: number): void {
    const targetId = this.editor.getBlock(hit.x, hit.y, hit.z);
    if (targetId === newId) return;

    const visited = new Set<string>();
    const cells: { x: number; y: number; z: number; id: number }[] = [];
    const queue: [number, number, number][] = [[hit.x, hit.y, hit.z]];
    visited.add(`${hit.x},${hit.y},${hit.z}`);

    const neighbors = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];

    while (queue.length > 0 && cells.length < MAX_FILL) {
      const [x, y, z] = queue.shift()!;
      if (this.editor.getBlock(x, y, z) !== targetId) continue;
      cells.push({ x, y, z, id: newId });

      for (const [dx, dy, dz] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        const key = `${nx},${ny},${nz}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (this.editor.getBlock(nx, ny, nz) === targetId) {
          queue.push([nx, ny, nz]);
        }
      }
    }

    this.editor.applyChanges(cells);
  }
}
