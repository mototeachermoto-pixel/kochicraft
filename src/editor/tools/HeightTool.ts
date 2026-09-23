import { AIR } from '@/world/BlockRegistry';
import type { RaycastHit } from '../Raycaster';
import { Tool } from './Tool';

/**
 * 高さ調整ツール（地面を盛る・削る）。
 * 左クリック：対象の列（とブラシ範囲）の表面に1段積む。
 * 右クリック：表面の1段を削る。
 * 範囲の広さはブラシサイズ（1=1マス, 2=3x3, 3=5x5 …）。
 */
export class HeightTool extends Tool {
  readonly id = 'height';
  readonly name = 'たかさ';
  readonly icon = '⛰️';
  readonly usesBrushSize = true;

  onPrimary(hit: RaycastHit): void {
    const rad = this.editor.brushSize - 1;
    const cells: { x: number; y: number; z: number; id: number }[] = [];
    for (let dz = -rad; dz <= rad; dz++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const x = hit.x + dx;
        const z = hit.z + dz;
        const top = this.editor.columnTop(x, z);
        const y = top + 1;
        if (this.editor.canPlaceAt(x, y, z)) {
          cells.push({ x, y, z, id: this.editor.selectedBlockId });
        }
      }
    }
    this.editor.applyChanges(cells);
  }

  onSecondary(hit: RaycastHit): void {
    const rad = this.editor.brushSize - 1;
    const cells: { x: number; y: number; z: number; id: number }[] = [];
    for (let dz = -rad; dz <= rad; dz++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const x = hit.x + dx;
        const z = hit.z + dz;
        const top = this.editor.columnTop(x, z);
        if (top >= 0) {
          cells.push({ x, y: top, z, id: AIR });
        }
      }
    }
    this.editor.applyChanges(cells);
  }
}
