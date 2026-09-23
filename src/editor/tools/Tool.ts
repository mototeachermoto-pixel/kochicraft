import type { RaycastHit } from '../Raycaster';
import type { EditorManager } from '../EditorManager';

/**
 * 編集ツールの基底クラス。
 * 左クリック=onPrimary / 右クリック=onSecondary を各ツールが実装する。
 * スポイト（中クリック）はツールに関係なく EditorManager が共通処理する。
 */
export abstract class Tool {
  /** 内部ID（'build' など） */
  abstract readonly id: string;
  /** 表示名（日本語） */
  abstract readonly name: string;
  /** アイコン（絵文字） */
  abstract readonly icon: string;
  /** ブラシサイズのスライダーを使うツールか（右パネル表示制御に使用） */
  readonly usesBrushSize: boolean = false;

  constructor(protected readonly editor: EditorManager) {}

  /** 左クリック時 */
  onPrimary(_hit: RaycastHit): void {}
  /** 右クリック時 */
  onSecondary(_hit: RaycastHit): void {}
}
