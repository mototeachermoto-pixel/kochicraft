import * as THREE from 'three';
import {
  PLAYER_HALF_WIDTH,
  PLAYER_HEIGHT,
  REACH,
  WORLD_DEPTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@/config/constants';
import type { Vec3 } from '@/types';
import type { Player } from '@/player/Player';
import type { InputManager } from '@/core/InputManager';
import type { World } from '@/world/World';
import { AIR, blockRegistry } from '@/world/BlockRegistry';
import { bus } from '@/state/EventBus';
import { History } from './History';
import { VoxelRaycaster, type RaycastHit } from './Raycaster';
import { Selection } from './Selection';
import { Tool } from './tools/Tool';
import { BuildTool } from './tools/BuildTool';
import { BrushTool } from './tools/BrushTool';
import { FillTool } from './tools/FillTool';
import { SelectTool } from './tools/SelectTool';
import { HeightTool } from './tools/HeightTool';

/** 操作モード：あるく（移動）／つくる（建築） */
export type EditMode = 'play' | 'build';

/** 編集対象セル（適用前の指定） */
export interface CellInput {
  x: number;
  y: number;
  z: number;
  id: number;
}

/** ツールのメタ情報（右パネル表示用） */
export interface ToolMeta {
  id: string;
  name: string;
  icon: string;
  usesBrushSize: boolean;
}

const BTN_LEFT = 0;
const BTN_MIDDLE = 1;
const BTN_RIGHT = 2;

/**
 * 建築・編集の中枢。
 * ツール（ブロック/ブラシ/塗りつぶし/範囲選択/高さ）を切り替えて操作し、
 * 範囲選択のコピー・貼り付け・回転・削除、グリッド表示、Undo/Redo を統括する。
 */
export class EditorManager {
  /** 現在選択中のブロックID */
  selectedBlockId: number;
  /** 現在の操作モード */
  mode: EditMode = 'build';
  /** ブラシ／高さツールの大きさ（1〜4） */
  brushSize = 1;
  /** 現在のツールID */
  currentToolId = 'build';
  /** グリッド表示中か */
  gridVisible = false;

  readonly history = new History();
  /** パレットで選べるブロック一覧（空気を除く） */
  readonly blocks = blockRegistry.all();

  // ===== UIへ通知するコールバック =====
  onSelectionChange?: (id: number) => void;
  onModeChange?: (mode: EditMode) => void;
  onToolChange?: (toolId: string) => void;
  /** 範囲選択/クリップボードの状態が変わった（ボタンの有効化に使用） */
  onSelectionStateChange?: () => void;

  private readonly tools = new Map<string, Tool>();
  private readonly selection: Selection;
  private readonly grid: THREE.GridHelper;
  private readonly highlight: THREE.LineSegments;
  private readonly dirTmp = new THREE.Vector3();

  constructor(
    private readonly world: World,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly player: Player,
    private readonly input: InputManager,
    scene: THREE.Scene,
  ) {
    this.selectedBlockId = blockRegistry.getByKey('stone')?.id ?? this.blocks[0].id;

    // 対象ブロックの白いワイヤーフレーム
    const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(box);
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    this.highlight = new THREE.LineSegments(edges, mat);
    this.highlight.visible = false;
    this.highlight.renderOrder = 999;
    scene.add(this.highlight);
    box.dispose();

    // 整列補助のグリッド（初期は非表示）
    this.grid = new THREE.GridHelper(64, 64, 0xffffff, 0x99a0a8);
    const gmat = this.grid.material as THREE.Material;
    gmat.transparent = true;
    gmat.opacity = 0.35;
    this.grid.visible = false;
    scene.add(this.grid);

    // 範囲選択
    this.selection = new Selection(scene);

    // ツール登録
    for (const tool of [
      new BuildTool(this),
      new BrushTool(this),
      new FillTool(this),
      new SelectTool(this),
      new HeightTool(this),
    ]) {
      this.tools.set(tool.id, tool);
    }

    this.input.setPointerActionHandler((button) => this.handlePointer(button));
    window.addEventListener('keydown', this.onKeyDown);
  }

  // ===== モード・ツール・設定 =====
  setMode(mode: EditMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode !== 'build') this.highlight.visible = false;
    this.onModeChange?.(mode);
  }

  setSelectedBlock(id: number): void {
    if (this.selectedBlockId === id) return;
    this.selectedBlockId = id;
    this.onSelectionChange?.(id);
  }

  setTool(id: string): void {
    if (!this.tools.has(id) || this.currentToolId === id) return;
    this.currentToolId = id;
    this.onToolChange?.(id);
  }

  setBrushSize(n: number): void {
    this.brushSize = Math.max(1, Math.min(4, Math.round(n)));
  }

  toggleGrid(): void {
    this.gridVisible = !this.gridVisible;
    this.grid.visible = this.gridVisible;
  }

  /** ツール一覧のメタ情報（登録順） */
  getTools(): ToolMeta[] {
    return [...this.tools.values()].map((t) => ({
      id: t.id,
      name: t.name,
      icon: t.icon,
      usesBrushSize: t.usesBrushSize,
    }));
  }

  // ===== 範囲選択・クリップボード操作 =====
  selectionSetCorner(p: Vec3): void {
    this.selection.setCorner(p);
    this.onSelectionStateChange?.();
  }

  selectionClear(): void {
    this.selection.clear();
    this.onSelectionStateChange?.();
  }

  hasSelection(): boolean {
    return this.selection.hasBox();
  }

  hasClipboard(): boolean {
    return this.selection.hasClipboard();
  }

  /** 選択範囲をコピー */
  copySelection(): void {
    if (!this.selection.hasBox()) return;
    this.selection.copyFrom((x, y, z) => this.world.getBlock(x, y, z));
    this.onSelectionStateChange?.();
  }

  /** クリップボードを視線先に貼り付け（空気セルは無視してスタンプ） */
  pasteAtTarget(): void {
    const cb = this.selection.clipboard;
    if (!cb) return;
    const hit = this.raycast();
    if (!hit.hit) return;
    const ax = hit.x + hit.nx;
    const ay = hit.y + hit.ny;
    const az = hit.z + hit.nz;

    const cells: CellInput[] = [];
    for (let y = 0; y < cb.h; y++) {
      for (let z = 0; z < cb.d; z++) {
        for (let x = 0; x < cb.w; x++) {
          const id = cb.data[(y * cb.d + z) * cb.w + x];
          if (id === AIR) continue;
          const tx = ax + x;
          const ty = ay + y;
          const tz = az + z;
          if (!this.overlapsPlayer(tx, ty, tz)) cells.push({ x: tx, y: ty, z: tz, id });
        }
      }
    }
    this.applyChanges(cells);
  }

  /** クリップボードを90°回転 */
  rotateClipboard(): void {
    this.selection.rotateClipboardY();
    this.onSelectionStateChange?.();
  }

  /** 選択範囲を空気にして削除 */
  deleteSelection(): void {
    const bb = this.selection.bounds();
    if (!this.selection.hasBox() || !bb) return;
    const cells: CellInput[] = [];
    for (let y = bb.min.y; y <= bb.max.y; y++) {
      for (let z = bb.min.z; z <= bb.max.z; z++) {
        for (let x = bb.min.x; x <= bb.max.x; x++) {
          cells.push({ x, y, z, id: AIR });
        }
      }
    }
    this.applyChanges(cells);
  }

  // ===== ツールが使う共通ヘルパ =====
  getBlock(x: number, y: number, z: number): number {
    return this.world.getBlock(x, y, z);
  }

  isSolid(x: number, y: number, z: number): boolean {
    return this.world.isSolid(x, y, z);
  }

  /** その座標に設置可能か（範囲内・固体でない・プレイヤーに重ならない） */
  canPlaceAt(x: number, y: number, z: number): boolean {
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= WORLD_DEPTH) {
      return false;
    }
    if (this.world.isSolid(x, y, z)) return false;
    return !this.overlapsPlayer(x, y, z);
  }

  /** 列の最上段の固体ブロックの高さ（無ければ -1） */
  columnTop(x: number, z: number): number {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      if (this.world.isSolid(x, y, z)) return y;
    }
    return -1;
  }

  /** セル群をまとめて適用し、1操作として履歴に積む */
  applyChanges(cells: CellInput[]): void {
    if (cells.length === 0) return;
    const diff = this.world.setBlocksBatch(cells);
    if (diff.length > 0) {
      this.history.push(diff);
      bus.emit('edit:done', undefined); // 操作フィードバック用
    }
  }

  // ===== 履歴 =====
  undo(): void {
    this.history.undo((cells) => this.world.setBlocksBatch(cells));
  }

  redo(): void {
    this.history.redo((cells) => this.world.setBlocksBatch(cells));
  }

  // ===== 毎フレーム =====
  update(): void {
    // グリッドはプレイヤーに追従（足元の高さに合わせる）
    if (this.gridVisible) {
      this.grid.position.set(
        Math.floor(this.camera.position.x),
        Math.floor(this.player.position.y),
        Math.floor(this.camera.position.z),
      );
    }

    if (this.mode !== 'build') {
      this.highlight.visible = false;
      return;
    }
    const hit = this.raycast();
    if (hit.hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.highlight.visible = false;
    }
  }

  /** マウスボタンに応じた建築アクション（0=左, 1=中=スポイト, 2=右） */
  handlePointer(button: number): void {
    if (this.mode !== 'build') return;
    if (button === BTN_MIDDLE) {
      this.pickBlock();
      return;
    }
    const hit = this.raycast();
    if (!hit.hit) return;
    const tool = this.tools.get(this.currentToolId);
    if (!tool) return;
    if (button === BTN_LEFT) tool.onPrimary(hit);
    else if (button === BTN_RIGHT) tool.onSecondary(hit);
  }

  // ===== 内部 =====
  private raycast(): RaycastHit {
    this.camera.getWorldDirection(this.dirTmp);
    return VoxelRaycaster.cast(this.world, this.camera.position, this.dirTmp, REACH);
  }

  /** スポイト（対象ブロックの種類を選択中にする） */
  private pickBlock(): void {
    const hit = this.raycast();
    if (!hit.hit) return;
    const cur = this.world.getBlock(hit.x, hit.y, hit.z);
    if (cur !== AIR) this.setSelectedBlock(cur);
  }

  /** 指定マスがプレイヤーのAABPと重なるか */
  private overlapsPlayer(x: number, y: number, z: number): boolean {
    const p = this.player.position;
    const minX = Math.floor(p.x - PLAYER_HALF_WIDTH);
    const maxX = Math.floor(p.x + PLAYER_HALF_WIDTH);
    const minY = Math.floor(p.y);
    const maxY = Math.floor(p.y + PLAYER_HEIGHT - 1e-3);
    const minZ = Math.floor(p.z - PLAYER_HALF_WIDTH);
    const maxZ = Math.floor(p.z + PLAYER_HALF_WIDTH);
    return x >= minX && x <= maxX && y >= minY && y <= maxY && z >= minZ && z <= maxZ;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Undo / Redo
    if (e.ctrlKey || e.metaKey) {
      if (e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      } else if (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey)) {
        e.preventDefault();
        this.redo();
      }
      return;
    }

    switch (e.code) {
      case 'KeyB':
        this.setMode(this.mode === 'build' ? 'play' : 'build');
        return;
      case 'KeyG':
        this.toggleGrid();
        return;
      case 'KeyC':
        this.copySelection();
        return;
      case 'KeyV':
        this.pasteAtTarget();
        return;
      case 'KeyR':
        this.rotateClipboard();
        return;
      case 'Delete':
      case 'Backspace':
        this.deleteSelection();
        return;
    }

    // 数字キー 1〜9：ブロックの素早い選択
    if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      if (n >= 1 && n <= 9 && this.blocks[n - 1]) {
        this.setSelectedBlock(this.blocks[n - 1].id);
      }
    }
  };
}
