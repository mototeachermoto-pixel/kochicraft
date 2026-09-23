import { AIR } from '@/world/BlockRegistry';
import type { RaycastHit } from '../Raycaster';
import { Tool } from './Tool';

/**
 * 基本のブロックツール。
 * 左クリック：対象面の隣に1つ設置 / 右クリック：対象を1つ削除。
 */
export class BuildTool extends Tool {
  readonly id = 'build';
  readonly name = 'ブロック';
  readonly icon = '🧱';

  onPrimary(hit: RaycastHit): void {
    const x = hit.x + hit.nx;
    const y = hit.y + hit.ny;
    const z = hit.z + hit.nz;
    if (this.editor.canPlaceAt(x, y, z)) {
      this.editor.applyChanges([{ x, y, z, id: this.editor.selectedBlockId }]);
    }
  }

  onSecondary(hit: RaycastHit): void {
    this.editor.applyChanges([{ x: hit.x, y: hit.y, z: hit.z, id: AIR }]);
  }
}
