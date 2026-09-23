import * as THREE from 'three';

/**
 * 観光地を中心に周回する「オービットカメラ」。
 * マウスは使わず、キーボード（矢印・ズーム）とタッチ（ドラッグ回転・ピンチズーム）で操作する。
 * タップ（ドラッグせず離す）で onTap を呼び、構造物の選択に使う。
 */
export class OrbitCameraController {
  /** 注視点 */
  readonly target = new THREE.Vector3(48, 16, 48);
  /** 距離・角度 */
  distance = 36;
  yaw = Math.PI * 0.25; // 水平角
  pitch = 0.7; // 仰角

  private readonly minDistance = 10;
  private readonly maxDistance = 70;
  private readonly minPitch = 0.18;
  private readonly maxPitch = 1.45;

  /** 有効時のみ操作を受け付ける */
  enabled = false;

  /** タップ時（NDC座標）。構造物選択に使用 */
  onTap?: (ndcX: number, ndcY: number) => void;

  private readonly keys = new Set<string>();
  private dragging = false;
  private moved = false;
  private lastX = 0;
  private lastY = 0;
  private pinchDist = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly el: HTMLElement,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('touchmove', this.onTouchMove, { passive: false });
    el.addEventListener('touchend', this.onTouchEnd);
  }

  /** 周回の中心と距離を設定 */
  setTarget(x: number, y: number, z: number, distance?: number): void {
    this.target.set(x, y, z);
    if (distance !== undefined) this.distance = distance;
  }

  /** 注視点だけをなめらかに寄せる（選択時） */
  focusOn(x: number, y: number, z: number): void {
    this.target.set(x, y, z);
  }

  update(dt: number): void {
    if (!this.enabled) return;
    const rot = 1.6 * dt;
    const zoom = 24 * dt;

    if (this.keys.has('ArrowLeft')) this.yaw += rot;
    if (this.keys.has('ArrowRight')) this.yaw -= rot;
    if (this.keys.has('ArrowUp')) this.pitch += rot;
    if (this.keys.has('ArrowDown')) this.pitch -= rot;
    // N＝Near（近づく）／F＝Far（遠ざかる）。＋−・Z/X でも操作できる
    if (this.keys.has('KeyN') || this.keys.has('Equal') || this.keys.has('KeyZ')) this.distance -= zoom;
    if (this.keys.has('KeyF') || this.keys.has('Minus') || this.keys.has('KeyX')) this.distance += zoom;

    this.clamp();
    this.apply();
  }

  private clamp(): void {
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
    this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
  }

  /** 角度・距離からカメラ位置を計算 */
  private apply(): void {
    const cosP = Math.cos(this.pitch);
    const x = this.target.x + this.distance * cosP * Math.sin(this.yaw);
    const y = this.target.y + this.distance * Math.sin(this.pitch);
    const z = this.target.z + this.distance * cosP * Math.cos(this.yaw);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }

  // ===== 入力ハンドラ =====
  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    // 文字入力中（情報パネルの付け足しなど）はカメラを動かさない
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
    this.keys.add(e.code);
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
    this.yaw -= dx * 0.006;
    this.pitch += dy * 0.006;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.clamp();
    this.apply();
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.enabled) return;
    const wasDragging = this.dragging;
    this.dragging = false;
    if (wasDragging && !this.moved) {
      // タップ＝選択
      const rect = this.el.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.onTap?.(ndcX, ndcY);
    }
  };

  // 2本指ピンチでズーム
  private onTouchMove = (e: TouchEvent): void => {
    if (!this.enabled || e.touches.length !== 2) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    if (this.pinchDist > 0) {
      this.distance -= (dist - this.pinchDist) * 0.05;
      this.clamp();
      this.apply();
    }
    this.pinchDist = dist;
    this.moved = true;
  };
  private onTouchEnd = (): void => {
    this.pinchDist = 0;
  };
}
