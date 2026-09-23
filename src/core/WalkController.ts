import * as THREE from 'three';
import { PLAYER_HALF_WIDTH } from '@/config/constants';
import type { MoveInput, Vec3 } from '@/types';
import type { Player } from '@/player/Player';
import type { World } from '@/world/World';
import type { Region } from '@/spots/SpotDefinition';

/**
 * 観光地ワールドを「歩き回る」ためのコントローラ（マウス不使用）。
 * キーは「英単語の頭文字」に合わせている（子どもが覚えやすいように）。
 * - 移動：**矢印キー** ／ 画面の方向ボタン（タッチ）
 * - 視点：**Shift＋矢印キー**（左右＝振り向く／上下＝見上げる・見下ろす）
 *         ＋ **U＝Up（見上げる）／D＝Down（見下ろす）** ／ 画面ドラッグ（タッチ）
 * - ジャンプ：**J＝Jump** ／ スペース
 * - タップ（ドラッグせず離す）で構造物を選択（onTap）
 * 既存の Player（物理・衝突）を再利用する。
 */
const PITCH_LIMIT = 1.45;

type MoveKey = 'forward' | 'back' | 'left' | 'right' | 'jump';

/**
 * カメラの見え方（4種類）。
 *  first  = 一人称（自分の目。キャラクターは見えない）
 *  back   = うしろ視点（キャラクターの背中を見る）
 *  third  = 三人称（もっと引いて全体を見る）
 *  front  = 正面視点（キャラクターの顔をこちら側から見る）
 */
export type ViewMode = 'first' | 'back' | 'third' | 'front';

/** 視点の切り替え順（ボタン／Vキーでこの順に回る） */
export const VIEW_ORDER: ViewMode[] = ['first', 'back', 'third', 'front'];

/** 画面に出す名前（英語・小5） */
export const VIEW_LABEL: Record<ViewMode, string> = {
  first: 'Eyes',
  back: 'Back',
  third: 'Far',
  front: 'Face',
};

/** それぞれの視点でカメラを置く距離・高さ */
const VIEW_SETUP: Record<ViewMode, { dist: number; up: number }> = {
  first: { dist: 0, up: 0 },
  back: { dist: 3.2, up: 0.35 },
  third: { dist: 5.8, up: 1.1 },
  front: { dist: 3.0, up: 0.25 },
};

export class WalkController {
  enabled = false;
  onTap?: (ndcX: number, ndcY: number) => void;
  /** D＝Down（見下ろす）を使うか。編集モードでは D＝Done（編集をやめる）なので false */
  useDForLookDown = true;
  /** いまの視点（一人称／うしろ／三人称／正面） */
  view: ViewMode = 'first';
  /** 一時的に視点を固定する（編集モードは一人称固定）。null なら view を使う */
  viewOverride: ViewMode | null = null;
  /** 動いているか（キャラクターの歩行アニメ用に Engine が読む） */
  moving = false;

  private readonly keys = new Set<string>();
  private readonly pad: Record<MoveKey, boolean> = {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
  };
  private dragging = false;
  private moved = false;
  private lastX = 0;
  private lastY = 0;
  private readonly eye = new THREE.Vector3();
  /** 歩ける範囲（見えない壁）。プレイヤー中心が動ける x/z の最小・最大 */
  private bounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null;

  constructor(
    private readonly player: Player,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly world: World,
    private readonly el: HTMLElement,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  /** スポーン（位置・向き・上下の見上げ角）を設定 */
  spawn(pos: Vec3, yaw = 0, pitch = 0): void {
    this.player.spawn(pos);
    this.player.yaw = yaw;
    this.player.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
    this.sync();
  }

  /**
   * 歩ける範囲（見えない壁）を設定する。
   * 作り込んだ地面の外周（field）に合わせて、その外＝周りの空中へ出られなくする。
   * null で制限なし。
   */
  setBounds(field: Region | null): void {
    if (!field) {
      this.bounds = null;
      return;
    }
    const m = PLAYER_HALF_WIDTH;
    this.bounds = {
      minX: field.min.x + m,
      maxX: field.max.x + 1 - m,
      minZ: field.min.z + m,
      maxZ: field.max.z + 1 - m,
    };
  }

  /** 画面の方向ボタンから移動入力を受け取る */
  setMove(key: MoveKey, on: boolean): void {
    this.pad[key] = on;
  }

  /**
   * 編集モードに入るとき、少し下を向かせる。
   * 正面（空や遠く）を見たままだと中央カーソルがどのブロックにも届かず、
   * 「置くキーを押しても何も起きない」状態になるため。
   */
  lookDownForBuild(): void {
    if (this.player.pitch > -0.3) {
      this.player.pitch = -0.6;
      this.sync();
    }
  }

  update(dt: number): void {
    if (!this.enabled) return;

    const look = 1.9 * dt;
    const shift = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    // 視点：Shift＋矢印キー（左右＝振り向く／上下＝見上げる・見下ろす）
    if (shift) {
      if (this.keys.has('ArrowLeft')) this.player.yaw += look;
      if (this.keys.has('ArrowRight')) this.player.yaw -= look;
      if (this.keys.has('ArrowUp')) this.player.pitch += look;
      if (this.keys.has('ArrowDown')) this.player.pitch -= look;
    }
    // 視点：U＝Up（見上げる）／D＝Down（見下ろす）＝Shift を押さなくても片手で使える
    if (this.keys.has('KeyU')) this.player.pitch += look;
    if (this.useDForLookDown && this.keys.has('KeyD')) this.player.pitch -= look;
    this.clampPitch();

    // 移動：矢印キー（Shift を押していないとき）／画面の方向ボタン
    const arrows = !shift;
    const input: MoveInput = {
      forward: this.pad.forward || (arrows && this.keys.has('ArrowUp')),
      back: this.pad.back || (arrows && this.keys.has('ArrowDown')),
      left: this.pad.left || (arrows && this.keys.has('ArrowLeft')),
      right: this.pad.right || (arrows && this.keys.has('ArrowRight')),
      // ジャンプ：J＝Jump ／ スペース ／ 画面のJUMPボタン
      jump: this.pad.jump || this.keys.has('Space') || this.keys.has('KeyJ'),
      sprint: false,
    };
    // キャラクターの歩行アニメ用に「動いているか」を覚えておく
    this.moving = input.forward || input.back || input.left || input.right;

    this.player.update(dt, input, this.world);
    this.clampToBounds();
    this.sync();
  }

  /** プレイヤーをフィールド内へ押し戻す（見えない壁） */
  private clampToBounds(): void {
    const b = this.bounds;
    if (!b) return;
    const p = this.player.position;
    if (p.x < b.minX) p.x = b.minX;
    else if (p.x > b.maxX) p.x = b.maxX;
    if (p.z < b.minZ) p.z = b.minZ;
    else if (p.z > b.maxZ) p.z = b.maxZ;
  }

  private clampPitch(): void {
    this.player.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.player.pitch));
  }

  /**
   * カメラを今の視点に合わせて置く。
   * 一人称＝目の位置。ほかは目の位置から後ろ／前へ離す（壁にめり込まないよう手前で止める）。
   */
  private sync(): void {
    this.player.getEyePosition(this.eye);
    const { pitch, yaw } = this.player;
    const view = this.viewOverride ?? this.view;

    if (view === 'first') {
      this.camera.position.copy(this.eye);
      this.camera.rotation.set(pitch, yaw, 0, 'YXZ');
      return;
    }

    const setup = VIEW_SETUP[view];
    const front = view === 'front';
    // 視線の水平方向（-Z が前）。正面視点は前へ、それ以外は後ろへ離す
    const sign = front ? 1 : -1;
    const dirX = -Math.sin(yaw) * sign;
    const dirZ = -Math.cos(yaw) * sign;

    const dist = this.clampCameraDist(dirX, dirZ, setup.dist);
    this.camera.position.set(
      this.eye.x + dirX * dist,
      this.eye.y + setup.up,
      this.eye.z + dirZ * dist,
    );
    // 正面視点はキャラクターの方（真後ろ向き）を見る。上下は控えめに追従させる
    this.camera.rotation.set(front ? -pitch * 0.5 : pitch, front ? yaw + Math.PI : yaw, 0, 'YXZ');
  }

  /**
   * カメラを離す距離を、壁や地面にめり込まない範囲に縮める。
   * 目の位置から少しずつ進み、ブロックに当たったらその手前で止める。
   */
  private clampCameraDist(dirX: number, dirZ: number, want: number): number {
    for (let d = 0.5; d <= want; d += 0.25) {
      const x = Math.floor(this.eye.x + dirX * d);
      const y = Math.floor(this.eye.y);
      const z = Math.floor(this.eye.z + dirZ * d);
      if (this.world.getBlock(x, y, z) !== 0) return Math.max(0.6, d - 0.4);
    }
    return want;
  }

  // ===== 入力 =====
  /** 文字入力中（情報パネルの付け足しなど）はキー操作を無視する */
  private isTyping(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    return t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled || this.isTyping(e)) return;
    this.keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled) return;
    this.dragging = true;
    this.moved = false;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };
  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging || !this.enabled) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 4) this.moved = true;
    this.player.yaw -= dx * 0.005;
    this.player.pitch -= dy * 0.005;
    this.clampPitch();
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };
  private onPointerUp = (e: PointerEvent): void => {
    if (!this.enabled) return;
    const wasDragging = this.dragging;
    this.dragging = false;
    if (wasDragging && !this.moved) {
      const rect = this.el.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.onTap?.(ndcX, ndcY);
    }
  };
}
