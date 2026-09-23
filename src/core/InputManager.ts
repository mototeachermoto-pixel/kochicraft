/**
 * キーボード・マウス入力とポインタロックの管理。
 * - WASD / 矢印キーの押下状態を保持
 * - キャンバスクリックでポインタロック（FPS視点）を開始
 * - ロック中のマウス移動量を蓄積（視点操作に使用）
 */

/** 既定動作を抑止したいキー（スクロールやスペースでのページ操作を防ぐ） */
const PREVENT_KEYS = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

export class InputManager {
  private down = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;

  /** ポインタロック中か（=操作中） */
  isLocked = false;

  private canvas: HTMLElement | null = null;
  private lockChangeHandler?: (locked: boolean) => void;
  private pointerActionHandler?: (button: number) => void;

  /** キャンバスにイベントを接続する */
  attach(canvas: HTMLElement): void {
    this.canvas = canvas;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('click', this.requestLock);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('blur', this.onBlur);
  }

  /** ポインタロックを要求する（オーバーレイからも呼べるよう公開） */
  requestLock = (): void => {
    if (!this.isLocked && this.canvas) {
      this.canvas.requestPointerLock();
    }
  };

  /** ロック状態変化時のコールバックを登録 */
  setLockChangeHandler(fn: (locked: boolean) => void): void {
    this.lockChangeHandler = fn;
  }

  /**
   * ポインタロック中のマウスボタン押下を受け取るコールバックを登録。
   * button: 0=左, 1=中, 2=右
   */
  setPointerActionHandler(fn: (button: number) => void): void {
    this.pointerActionHandler = fn;
  }

  /** キーが押されているか */
  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** 蓄積したマウス移動量を取り出して0に戻す */
  consumeMouseDelta(): { dx: number; dy: number } {
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  // ===== 内部ハンドラ =====
  private onKeyDown = (e: KeyboardEvent): void => {
    this.down.add(e.code);
    if (PREVENT_KEYS.has(e.code)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isLocked) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  private onMouseDown = (e: MouseEvent): void => {
    // ロック中のクリックのみ建築アクションとして扱う。
    // （未ロック時のクリックは click イベントでポインタロック開始に使う）
    if (this.isLocked) {
      e.preventDefault();
      this.pointerActionHandler?.(e.button);
    }
  };

  private onContextMenu = (e: MouseEvent): void => {
    // 右クリックメニューを抑止（右クリックを「設置」に使うため）
    e.preventDefault();
  };

  private onPointerLockChange = (): void => {
    this.isLocked = document.pointerLockElement === this.canvas;
    if (!this.isLocked) {
      // ロック解除時は押しっぱなし状態を解消（移動が止まらないバグを防ぐ）
      this.down.clear();
    }
    this.lockChangeHandler?.(this.isLocked);
  };

  private onBlur = (): void => {
    // ウィンドウ非アクティブ時もキー状態をクリア
    this.down.clear();
  };
}
