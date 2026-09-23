import type { RaycastHit } from '../Raycaster';
import { Tool } from './Tool';

/**
 * 範囲選択ツール。
 * 左クリック：1隅目→2隅目を打って直方体を選択 / 右クリック：選択解除。
 * 選択後は右パネルの「コピー・はりつけ・回転・けす」やキー(C/V/R/Del)で操作する。
 */
export class SelectTool extends Tool {
  readonly id = 'select';
  readonly name = 'はんい';
  readonly icon = '🔲';

  onPrimary(hit: RaycastHit): void {
    this.editor.selectionSetCorner({ x: hit.x, y: hit.y, z: hit.z });
  }

  onSecondary(_hit: RaycastHit): void {
    this.editor.selectionClear();
  }
}
