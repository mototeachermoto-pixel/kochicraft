import * as THREE from 'three';
import { CAMERA_FAR, CAMERA_FOV, CAMERA_NEAR, MAX_DELTA, PLAYER_EYE } from '@/config/constants';
import { World } from '@/world/World';
import { Player } from '@/player/Player';
import { SpeechService } from '@/features/language/SpeechService';
import { SPOTS } from '@/spots/SpotRegistry';
import type { SpotDefinition, SceneObject } from '@/spots/SpotDefinition';
import { HubScreen } from '@/ui/HubScreen';
import { InfoPanel } from '@/ui/panels/InfoPanel';
import { PlacesPanel } from '@/ui/PlacesPanel';
import { BuildPalette } from '@/ui/BuildPalette';
import { PhotoStore } from '@/data/PhotoStore';
import { EditStore } from '@/data/EditStore';
import { SaveStorage } from '@/data/SaveStorage';
import { NumberPanel } from '@/ui/NumberPanel';
import { HowToPlayPanel } from '@/ui/HowToPlayPanel';
import { Avatar, SKIN_LABEL, type SkinKind } from '@/player/Avatar';
import { SceneManager } from './SceneManager';
import { OrbitCameraController } from './OrbitCameraController';
import { WalkController, VIEW_LABEL, VIEW_ORDER, type ViewMode } from './WalkController';
import { WorldManager } from './WorldManager';
import { BuildController } from './BuildController';
import { blockRegistry } from '@/world/BlockRegistry';

type Mode = 'walk' | 'orbit' | 'build';

/**
 * アプリの中枢（観光地選択型3D教材）。
 * 起動 → ハブ → 観光地を選ぶ → 歩いて見て回る／回して眺める → 構造物を選んで情報パネル。
 * マウスは使わず、キーボード＋タッチで操作する。
 */
export class Engine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly sceneManager: SceneManager;
  private readonly world: World;
  private readonly player: Player;
  private readonly speech: SpeechService;
  private readonly orbit: OrbitCameraController;
  private readonly walk: WalkController;
  private readonly worldManager: WorldManager;
  private readonly build: BuildController;
  private readonly hub: HubScreen;
  private readonly infoPanel: InfoPanel;
  private readonly hudRoot: HTMLElement;
  /** プレイヤーの見た目（4種類のキャラクター） */
  private readonly avatar: Avatar;
  private viewBtn!: HTMLButtonElement;
  private skinBtn!: HTMLButtonElement;
  private mapBtn!: HTMLButtonElement;
  /** その観光地の「行ける場所」一覧 */
  private places!: PlacesPanel;

  private toolbar!: HTMLElement;
  private modeBtn!: HTMLButtonElement;
  private buildBtn!: HTMLButtonElement;
  private restartBtn!: HTMLButtonElement;
  private movePad!: HTMLElement;
  private jumpBtn!: HTMLButtonElement;
  private crosshair!: HTMLElement;
  private keyGuide!: HTMLElement;
  /** キー案内を開いているか（端末に記憶。初回は開いた状態で使い方が分かるように） */
  private keyGuideOpen = ((): boolean => {
    try {
      return localStorage.getItem('kc.keys.open') !== '0';
    } catch {
      return true;
    }
  })();
  private nameBanner!: HTMLElement;
  private nearObj: SceneObject | null = null; // 「近くにいる」バナーが今指している対象（クリックで選択するため）
  private palette!: BuildPalette;
  private buildActions!: HTMLElement;
  private saveBar!: HTMLElement;
  private fileInput!: HTMLInputElement;
  private toast!: HTMLElement;
  private toastTimer = 0;
  /** スタート地点から歩いて行ける場所（Map の立ち位置えらび用。観光地に入る・ブロックを置くと作り直す） */
  private reachCache: Set<string> | null = null;
  /** 番号（例：5A12）を入れる画面（GAS 版だけ） */
  private readonly numberPanel: NumberPanel;

  private mode: Mode = 'walk';
  private lastTime = 0;
  private running = false;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    // タッチで操作する端末（iPad など）は描く量を減らして、ボタンの反応と動きを軽くする
    const touchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, touchDevice ? 1.5 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const canvas = this.renderer.domElement;
    canvas.classList.add('kc-canvas');
    container.prepend(canvas);

    this.camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      window.innerWidth / window.innerHeight,
      CAMERA_NEAR,
      CAMERA_FAR,
    );

    this.sceneManager = new SceneManager();
    this.world = new World();
    this.sceneManager.add(this.world.group);
    this.player = new Player();
    this.speech = new SpeechService();
    // 英語（または日本語）の音声がこの端末に入っていないとき、理由が分かるように知らせる
    this.speech.onVoiceMissing = (lang) => {
      this.showToast(
        lang === 'en'
          ? 'この端末に英語の音声が入っていません（設定で英語の音声を追加してください）'
          : 'この端末に日本語の音声が入っていません',
        6000,
      );
    };

    this.orbit = new OrbitCameraController(this.camera, canvas);
    this.walk = new WalkController(this.player, this.camera, this.world, canvas);
    // キャラクター（見た目）。選んだ種類と視点は端末に覚えさせる
    this.avatar = new Avatar(this.sceneManager.scene);
    this.avatar.setSkin(this.loadSkin());
    this.walk.view = this.loadView();
    this.worldManager = new WorldManager(this.world, this.sceneManager.scene, this.camera, this.orbit);
    this.build = new BuildController(this.world, this.sceneManager.scene, this.camera, this.player);
    // 編集（自動保存）が起きたら静かに「Saved」を出す
    this.build.onChange = () => {
      this.reachCache = null; // ブロックが変わったので、歩いて行ける場所をしらべ直す
      this.showToast('Saved ✓');
    };

    const hudRoot = document.getElementById('hud');
    if (!hudRoot) throw new Error('HUD要素(#hud)が見つかりません');
    this.hudRoot = hudRoot;

    // 以前の版で大きいまま保存された写真を、縮めて保存し直す（空き容量を作る）
    void PhotoStore.shrinkSavedPhotos();

    this.infoPanel = new InfoPanel(this.hudRoot, this.speech, {
      onClose: () => this.worldManager.clearSelection(),
      onPhoto: (obj, dataUrl) => {
        obj.image = dataUrl;
        const sid = this.worldManager.currentSpot?.id;
        return sid ? PhotoStore.setPhoto(sid, obj.id, dataUrl) : false; // 実物写真を保存
      },
      onAudio: (obj, dataUrl) => {
        obj.audio = dataUrl;
        const sid = this.worldManager.currentSpot?.id;
        return sid ? PhotoStore.setAudio(sid, obj.id, dataUrl) : false; // 英語音声を保存
      },
    });
    this.worldManager.onSelect = (obj) => {
      if (obj) this.infoPanel.show(obj, this.worldManager.currentSpot?.id ?? '');
      else this.infoPanel.hide();
    };
    // 正面で向き合ったら英語名バナーを出す（タップ／クリックで、その対象の説明を右に開けるように）
    this.worldManager.onNear = (obj) => {
      this.nearObj = obj;
      if (obj) {
        this.nameBanner.textContent = obj.name;
        this.nameBanner.classList.remove('hidden');
      } else {
        this.nameBanner.classList.add('hidden');
      }
    };
    // タップで構造物を選択（歩行・オービット共通）
    const tap = (x: number, y: number) => this.worldManager.selectByRay(x, y);
    this.orbit.onTap = tap;
    this.walk.onTap = tap;

    // 最初の画面の「How to play（せつめい）」＝操作方法の一覧
    const howTo = new HowToPlayPanel(this.hudRoot);
    this.hub = new HubScreen(this.hudRoot, SPOTS, (spot) => this.enterSpot(spot), () => howTo.open());
    this.buildSpotUI();

    // GAS 版：子どもの番号ごとに大学の Google へ保存する（Safari を閉じても残るように）
    this.numberPanel = new NumberPanel(this.hudRoot, {
      normalize: (raw) => SaveStorage.normalizeId(raw),
      normalizePin: (raw) => SaveStorage.normalizePin(raw),
      check: (id) => this.checkNumber(id),
      makePin: (id, pin) => this.makePin(id, pin),
      start: (id, pin) => this.openMyWorks(id, pin),
      look: (id) => this.lookAtWorks(id),
    });
    SaveStorage.onError = (reason) => {
      this.showToast(
        reason === 'too-big'
          ? '⚠ This is too big to save.'
          : reason === 'pin'
            ? '⚠ Not saved. Please open your number again.'
            : '⚠ Not saved yet. Check the internet.',
        4000,
      );
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
  }

  /** 観光地内の操作UI（戻る・モード切替・編集・方向ボタン・照準・保存）を作る */
  private buildSpotUI(): void {
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'spot-toolbar hidden';
    this.toolbar.innerHTML = `
      <button class="kc-btn" data-role="back"><span class="kc-btn__icon">←</span>Back to list<kbd>X</kbd></button>
      <button class="kc-btn" data-role="mode"><span class="kc-btn__icon">👀</span><span data-label="mode">Look</span><kbd>L</kbd></button>
      <button class="kc-btn" data-role="build"><span class="kc-btn__icon">🧱</span><span data-label="build">Build</span><kbd>B</kbd></button>
      <button class="kc-btn" data-role="map"><span class="kc-btn__icon">🗺️</span>Map<kbd>M</kbd></button>
      <button class="kc-btn" data-role="view"><span class="kc-btn__icon">🎥</span><span data-label="view">Eyes</span><kbd>V</kbd></button>
      <button class="kc-btn" data-role="skin"><span class="kc-btn__icon">🧍</span><span data-label="skin">Boy</span><kbd>C</kbd></button>
      <button class="kc-btn" data-role="restart"><span class="kc-btn__icon">🏠</span>Home<kbd>H</kbd></button>
      <div class="spot-toolbar__hint" data-role="hint">👆 Tap a building, or press <kbd>Enter</kbd> to choose</div>
    `;
    this.hudRoot.appendChild(this.toolbar);
    this.toolbar.querySelector('[data-role="back"]')!.addEventListener('click', () => this.backToHub());
    this.modeBtn = this.toolbar.querySelector('[data-role="mode"]') as HTMLButtonElement;
    this.modeBtn.addEventListener('click', () => this.setMode(this.mode === 'walk' ? 'orbit' : 'walk'));
    this.buildBtn = this.toolbar.querySelector('[data-role="build"]') as HTMLButtonElement;
    this.buildBtn.addEventListener('click', () => this.setMode(this.mode === 'build' ? 'walk' : 'build'));
    this.restartBtn = this.toolbar.querySelector('[data-role="restart"]') as HTMLButtonElement;
    this.restartBtn.addEventListener('click', () => this.returnToStart());
    this.mapBtn = this.toolbar.querySelector('[data-role="map"]') as HTMLButtonElement;
    this.mapBtn.addEventListener('click', () => this.places.toggle());
    this.viewBtn = this.toolbar.querySelector('[data-role="view"]') as HTMLButtonElement;
    this.viewBtn.addEventListener('click', () => this.cycleView());
    this.skinBtn = this.toolbar.querySelector('[data-role="skin"]') as HTMLButtonElement;
    this.skinBtn.addEventListener('click', () => this.cycleSkin());

    // 照準（歩行・編集時の中央マーク）
    this.crosshair = document.createElement('div');
    this.crosshair.className = 'walk-crosshair hidden';
    this.hudRoot.appendChild(this.crosshair);

    // 近づいたら出る英語名バナー（タップ／クリックで、その対象の説明を右に開ける）
    this.nameBanner = document.createElement('div');
    this.nameBanner.className = 'name-banner hidden';
    this.nameBanner.addEventListener('click', () => {
      if (!this.nearObj) return;
      const i = this.worldManager.getObjects().indexOf(this.nearObj);
      if (i >= 0) this.worldManager.selectIndex(i);
    });
    this.hudRoot.appendChild(this.nameBanner);

    // 方向ボタン（タッチ移動用）
    this.movePad = document.createElement('div');
    this.movePad.className = 'move-pad hidden';
    this.movePad.innerHTML = `
      <button class="move-btn move-btn--up" data-move="forward">▲</button>
      <button class="move-btn move-btn--left" data-move="left">◀</button>
      <button class="move-btn move-btn--down" data-move="back">▼</button>
      <button class="move-btn move-btn--right" data-move="right">▶</button>
    `;
    this.hudRoot.appendChild(this.movePad);

    // ジャンプボタン（右下・独立）＝移動しながら親指でジャンプできる
    this.jumpBtn = document.createElement('button');
    this.jumpBtn.className = 'jump-btn hidden';
    this.jumpBtn.textContent = 'JUMP';
    this.hudRoot.appendChild(this.jumpBtn);

    // 行ける場所の一覧（Map）
    this.places = new PlacesPanel(this.hudRoot);

    // キー案内（開閉できる。閉じると小さなボタンだけ＝画面の邪魔にならない）
    this.keyGuide = document.createElement('div');
    this.keyGuide.className = 'key-guide hidden';
    this.hudRoot.appendChild(this.keyGuide);
    this.renderKeyGuide();

    // 移動・ジャンプボタンの押下ハンドラ（共通）
    const moveButtons: { el: HTMLElement; key: 'forward' | 'back' | 'left' | 'right' | 'jump' }[] = [
      ...Array.from(this.movePad.querySelectorAll<HTMLElement>('[data-move]')).map((el) => ({
        el,
        key: el.dataset.move as 'forward' | 'back' | 'left' | 'right',
      })),
      { el: this.jumpBtn, key: 'jump' as const },
    ];
    for (const { el, key } of moveButtons) {
      const press = (on: boolean) => (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.walk.setMove(key, on);
      };
      el.addEventListener('pointerdown', press(true));
      el.addEventListener('pointerup', press(false));
      el.addEventListener('pointerleave', press(false));
      el.addEventListener('pointercancel', press(false));
    }

    // ブロックパレット（編集モード）
    this.palette = new BuildPalette(this.hudRoot, (id) => this.build.setActiveBlock(id));

    // 置く／消すボタン（編集モード・右下、ジャンプの上）。押しっぱなしで連続＝積み上げやすい
    this.buildActions = document.createElement('div');
    this.buildActions.className = 'build-actions hidden';
    const placeBtn = document.createElement('button');
    placeBtn.className = 'kc-round kc-round--place';
    placeBtn.innerHTML = '🧱<br>Put<br><kbd>P</kbd>';
    // 押し始め＝最初の1つ＋向き決定、押している間＝その向きへ積む、離す＝終了
    this.holdRepeat(
      placeBtn,
      () => this.build.startStack(),
      () => this.build.placeContinue(),
      () => this.build.endPlace(),
    );
    const removeBtn = document.createElement('button');
    removeBtn.className = 'kc-round kc-round--remove';
    removeBtn.innerHTML = '✋<br>Take<br><kbd>T</kbd>';
    this.holdRepeat(removeBtn, () => this.build.remove());
    this.buildActions.append(placeBtn, removeBtn);
    this.hudRoot.appendChild(this.buildActions);

    // 保存バー（編集モード・右上：書き出し／読み込み）
    this.saveBar = document.createElement('div');
    this.saveBar.className = 'save-bar hidden';
    this.saveBar.innerHTML = `
      <button class="kc-btn" data-role="savefile"><span class="kc-btn__icon">💾</span>Save file<kbd>Ctrl+S</kbd></button>
      <button class="kc-btn" data-role="openfile"><span class="kc-btn__icon">📂</span>Open file<kbd>Ctrl+O</kbd></button>
    `;
    this.hudRoot.appendChild(this.saveBar);
    this.saveBar.querySelector('[data-role="savefile"]')!.addEventListener('click', () => this.saveToFile());
    this.saveBar.querySelector('[data-role="openfile"]')!.addEventListener('click', () => this.fileInput.click());

    // 隠しファイル入力（.kcw 読み込み）
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.kcw,application/json';
    this.fileInput.style.display = 'none';
    this.fileInput.addEventListener('change', () => this.openFromFile());
    this.hudRoot.appendChild(this.fileInput);

    // 保存トースト
    this.toast = document.createElement('div');
    this.toast.className = 'kc-toast hidden';
    this.hudRoot.appendChild(this.toast);
  }

  async start(): Promise<void> {
    document.getElementById('loading')?.classList.add('hidden');
    this.hub.show();
    // GAS 版は、最初に自分の番号を入れてもらう（入れるまで閉じられない）
    if (SaveStorage.cloud) this.numberPanel.open('me', this.lastNumber(), false);

    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      (window as unknown as { kc: unknown }).kc = {
        engine: this,
        world: this.world,
        worldManager: this.worldManager,
        orbit: this.orbit,
        walk: this.walk,
        build: this.build,
        player: this.player,
        speech: this.speech,
        spots: SPOTS,
      };
    }

    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  enterSpot(spot: SpotDefinition): void {
    if (!spot.available) return;
    // GAS 版で番号をまだ入れていなければ、先に番号を聞く（入れないと作品が保存されないため）
    if (SaveStorage.cloud && !SaveStorage.owner && !SaveStorage.viewing) {
      if (!this.numberPanel.isOpen) this.numberPanel.open('me', this.lastNumber(), false);
      return;
    }
    this.worldManager.loadSpot(spot);
    this.reachCache = null;
    // 編集の文脈（工作ひろば＋復元済みの編集差分）をセット
    this.build.setContext(spot.id, spot.field, this.worldManager.editCells);
    this.build.setActiveBlock(this.palette.getActiveId());
    // 歩ける範囲（フィールド外＝周りの空中へ落ちないよう見えない壁）
    this.walk.setBounds(spot.field ?? null);
    // 行ける場所の一覧を作る（選ぶとその場所へ移動して説明が出る）
    this.places.setObjects(spot.name, spot.objects ?? [], (i) => this.goToObject(i));
    this.hub.hide();
    this.toolbar.classList.remove('hidden');
    this.spawnPlayer(spot);
    this.setMode('walk'); // 歩いて回るのを既定に
  }

  /**
   * 一覧（Map）で選んだ場所へ移動する。
   * 写真のように「その物の全体が、じゃまな物なしによく見える場所」を探して立たせ、
   * その物の方を向かせて、説明パネルを出す。
   *
   * 立つ場所は、まわり16方向 × いろいろな距離の候補に点数をつけて、いちばん良い所を選ぶ：
   *   - 目から物まで、建物や木にさえぎられずに見えるか（ガラスと水は見通せる）
   *   - 物の全体が画面に入る距離か（写真のように、近すぎず遠すぎず）
   *   - 正面（+z＝手前。全観光地共通の設計）側か
   *   - まわりに壁や物がなく、ぶつかっていないか
   *   - 物の足もとに近い高さか（屋根の上や、はるか下には立たせない）
   * 洞窟の中など、立つ場所を決めてある物（viewFrom）はそこへ立つ。
   */
  private goToObject(index: number): void {
    const objects = this.worldManager.getObjects();
    const obj = objects[index];
    if (!obj) return;
    if (this.mode !== 'walk') this.setMode('walk'); // 編集・俯瞰中でも歩いて見られるように

    const r = obj.region;
    const lookX = obj.focus?.x ?? (r.min.x + r.max.x + 1) / 2;
    const lookY = obj.focus?.y ?? r.max.y;
    const lookZ = obj.focus?.z ?? (r.min.z + r.max.z + 1) / 2;
    const SPAWN_PITCH_CLAMP = (30 * Math.PI) / 180; // 見上げ／見下ろしはこれ以上にしない（首がつらくならないように）

    const best = obj.viewFrom ? { ...obj.viewFrom } : this.findViewPoint(obj);
    if (!best) return;

    const dist = Math.hypot(lookX - best.x, lookZ - best.z);
    const rawPitch = dist > 0.001 ? Math.atan2(lookY - (best.y + PLAYER_EYE), dist) : 0;
    const yaw = Math.atan2(-(lookX - best.x), -(lookZ - best.z));
    const pitch = Math.max(-SPAWN_PITCH_CLAMP, Math.min(SPAWN_PITCH_CLAMP, rawPitch));
    this.walk.spawn(best, yaw, pitch);
    this.worldManager.selectIndex(index); // 説明パネルを出す
    this.showToast(`Welcome to ${obj.name}!`);
  }

  /** その物がよく見える立ち位置を、点数をつけて選ぶ（くわしくは goToObject の説明） */
  private findViewPoint(obj: SceneObject): { x: number; y: number; z: number } | null {
    const r = obj.region;
    const cx = obj.focus?.x ?? (r.min.x + r.max.x + 1) / 2;
    const cz = obj.focus?.z ?? (r.min.z + r.max.z + 1) / 2;
    const lookY = obj.focus?.y ?? r.max.y;

    // 写真のように全体が画面に入る距離（たて・よことも画面の約7割におさまる距離）
    const width = Math.max(r.max.x - r.min.x + 1, r.max.z - r.min.z + 1);
    const height = r.max.y - r.min.y + 1;
    const tanV = Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180);
    const tanH = tanV * this.camera.aspect;
    const fit = Math.max(height / (2 * tanV * 0.7), Math.min(width, 20) / (2 * tanH * 0.7));
    const ideal = Math.max(5, Math.min(22, fit));
    const halfV = Math.atan(tanV); // 画面のたての半分の角度
    const baseFeet = r.min.y + 1; // 物の足もとに立ったときの足の高さ

    // 見たい点：注目点・物のまん中・物のてっぺん
    const mx = (r.min.x + r.max.x + 1) / 2;
    const mz = (r.min.z + r.max.z + 1) / 2;
    const targets = [
      { x: cx, y: lookY, z: cz },
      { x: mx, y: (r.min.y + r.max.y + 1) / 2, z: mz },
      { x: mx, y: r.max.y + 0.5, z: mz },
    ];

    // スタート地点から歩いて行ける場所だけを候補にする（屋根の上や、登り返せない崖の下には立たせない）
    const reachable = this.reachableStands();

    let best: { x: number; y: number; z: number } | null = null;
    let bestScore = -Infinity;
    for (let k = 0; k < 16; k++) {
      const a = (Math.PI / 8) * k; // 0＝正面（+z）
      const back = (1 - Math.cos(a)) / 2; // 0＝正面 … 1＝真うしろ
      for (let d = 3; d <= 26; d += 1) {
        const cand = this.findStandNear(cx + Math.sin(a) * d, cz + Math.cos(a) * d, baseFeet);
        if (!cand) continue;
        if (reachable && !reachable.has(`${Math.floor(cand.x)},${cand.y},${Math.floor(cand.z)}`)) continue;
        if (this.inRegion(cand.x, cand.y + 1, cand.z, r, 0.5)) continue; // 物の中には立たない
        if (baseFeet - cand.y > 2) continue; // 登り返せないほど低い所には立たせない

        const eye = { x: cand.x, y: cand.y + PLAYER_EYE, z: cand.z };
        let seen = 0;
        for (const t of targets) if (this.canSee(eye, t, r)) seen++;
        if (seen === 0) continue; // 物が見えない場所はだめ

        const dist = Math.hypot(cx - cand.x, cz - cand.z);
        const pitch = Math.atan2(lookY - eye.y, Math.max(0.1, dist));
        const crowd = this.crowdAround(cand); // まわりの壁や物の数
        // 物のてっぺんと足もとが、画面の上下に入るか（見上げは30度まで。はみ出す分だけ減点）
        const camPitch = Math.max(-0.52, Math.min(0.52, pitch));
        const topOut = Math.max(0, Math.atan2(r.max.y + 1 - eye.y, Math.max(0.1, dist)) - camPitch - halfV * 0.9);
        const botOut = Math.max(0, camPitch - Math.atan2(r.min.y - eye.y, Math.max(0.1, dist)) - halfV * 0.9);
        const score =
          seen * 6 -
          Math.abs(dist - ideal) * 0.5 -
          back * 6 -
          crowd * 1.5 -
          Math.max(0, Math.abs(pitch) - (25 * Math.PI) / 180) * 12 -
          (topOut + botOut) * 14 -
          Math.abs(cand.y - baseFeet) * 0.25;
        if (score > bestScore) {
          bestScore = score;
          best = cand;
        }
      }
    }
    // どこからも見えなければ、物の真上から降ろす（最終手段）
    return best ?? this.findStand(cx, cz, r.max.y + 6);
  }

  /**
   * スタート地点から歩いて行ける「立てる場所」をすべて集める（"x,足の高さ,z" の集まり）。
   * となりのマスへは、1段上る（自動で段差を上る）・2段上る（ジャンプ）・下りる（落ちる）ができる。
   * スタート地点が分からないときは null（しぼりこまない）。
   */
  private reachableStands(): Set<string> | null {
    // 一度しらべたら覚えておく（観光地に入り直したとき・ブロックを置いたときに、しらべ直す）
    if (this.reachCache) return this.reachCache;
    const spot = this.worldManager.currentSpot;
    const f = spot?.field;
    if (!spot || !f) return null;
    const sp = spot.spawn?.pos ?? { x: spot.center.x, y: 16, z: spot.center.z + 14 };
    const start = this.findStandNear(sp.x, sp.z, sp.y);
    if (!start) return null;

    // その列で立てる高さの一覧（足の高さ）。水の中も歩けるので、水は通れるものとして数える
    const open = (x: number, y: number, z: number) => !this.world.isSolid(x, y, z);
    const columns = new Map<number, number[]>(); // 列ごとに一度だけしらべる
    const standsAt = (x: number, z: number): number[] => {
      const key = x * 1000 + z;
      const hit = columns.get(key);
      if (hit) return hit;
      const solid: boolean[] = [];
      for (let y = 1; y <= 40; y++) solid[y] = this.world.isSolid(x, y, z);
      const ys: number[] = [];
      for (let y = 1; y <= 38; y++) if (solid[y] && !solid[y + 1] && !solid[y + 2]) ys.push(y + 1);
      columns.set(key, ys);
      return ys;
    };
    const seen = new Set<string>();
    const sx = Math.floor(start.x);
    const sz = Math.floor(start.z);
    const queue: [number, number, number][] = [[sx, start.y, sz]];
    seen.add(`${sx},${start.y},${sz}`);
    while (queue.length > 0) {
      const [x, y, z] = queue.pop()!;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < f.min.x || nx > f.max.x || nz < f.min.z || nz > f.max.z) continue;
        for (const ny of standsAt(nx, nz)) {
          if (ny > y + 2) continue; // 3段以上は上れない
          if (ny < y - 12) continue; // 高すぎる所からは下りない
          // 上るときは、今いる場所の頭の上があいているか（天井でジャンプできない所は上れない）
          if (ny > y && !open(x, y + 2, z)) continue;
          // 下りるときは、となりのマスの今の高さが空いているか（壁があると進めない）
          if (ny < y && !(open(nx, y, nz) && open(nx, y + 1, nz))) continue;
          const key = `${nx},${ny},${nz}`;
          if (seen.has(key)) continue;
          seen.add(key);
          queue.push([nx, ny, nz]);
        }
      }
    }
    this.reachCache = seen;
    return seen;
  }

  /** その点が物の範囲（region）の中か（m だけ広げて考える） */
  private inRegion(x: number, y: number, z: number, r: SceneObject['region'], m: number): boolean {
    return (
      x >= r.min.x - m &&
      x <= r.max.x + 1 + m &&
      y >= r.min.y - m &&
      y <= r.max.y + 1 + m &&
      z >= r.min.z - m &&
      z <= r.max.z + 1 + m
    );
  }

  /** 目から点まで、さえぎる物がないか（物の範囲に入ったら見えたことにする。ガラス・水・空気は見通せる） */
  private canSee(
    eye: { x: number; y: number; z: number },
    t: { x: number; y: number; z: number },
    r: SceneObject['region'],
  ): boolean {
    const dx = t.x - eye.x;
    const dy = t.y - eye.y;
    const dz = t.z - eye.z;
    const steps = Math.ceil(Math.hypot(dx, dy, dz) / 0.3);
    for (let i = 1; i < steps; i++) {
      const f = i / steps;
      const x = eye.x + dx * f;
      const y = eye.y + dy * f;
      const z = eye.z + dz * f;
      if (this.inRegion(x, y, z, r, 0)) return true;
      const id = this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
      if (id !== 0 && !blockRegistry.isTransparent(id)) return false;
    }
    return true;
  }

  /** 立つ場所のまわり（5×5、足と頭の高さ）にある、ぶつかる物の数 */
  private crowdAround(p: { x: number; y: number; z: number }): number {
    let n = 0;
    const bx = Math.floor(p.x);
    const bz = Math.floor(p.z);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (dx === 0 && dz === 0) continue;
        for (const y of [p.y, p.y + 1]) if (this.world.isSolid(bx + dx, y, bz + dz)) n++;
      }
    }
    return n;
  }

  /**
   * その x/z で立てる場所のうち、足の高さが wantFeet にいちばん近い所を返す。
   * 上から探して最初の所に立つと、屋根や木の上に立ってしまうため。
   */
  private findStandNear(x: number, z: number, wantFeet: number): { x: number; y: number; z: number } | null {
    const f = this.worldManager.currentSpot?.field;
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    if (f && (bx < f.min.x || bx > f.max.x || bz < f.min.z || bz > f.max.z)) return null; // 歩ける範囲の外
    let best: { x: number; y: number; z: number } | null = null;
    for (let y = 38; y >= 1; y--) {
      const ground = this.world.isSolid(bx, y, bz);
      const feet = this.world.getBlock(bx, y + 1, bz) === 0;
      const head = this.world.getBlock(bx, y + 2, bz) === 0;
      if (!(ground && feet && head)) continue;
      if (!best || Math.abs(y + 1 - wantFeet) < Math.abs(best.y - wantFeet)) {
        best = { x: bx + 0.5, y: y + 1, z: bz + 0.5 };
      }
    }
    return best;
  }

  /**
   * その x/z で立てる場所（足元の高さ）を探す。
   * 上から下へ地面を探し、頭の分（2マス）空いているかを確かめる。
   */
  private findStand(x: number, z: number, fromY: number): { x: number; y: number; z: number } | null {
    const f = this.worldManager.currentSpot?.field;
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    if (f && (bx < f.min.x || bx > f.max.x || bz < f.min.z || bz > f.max.z)) return null; // 歩ける範囲の外
    for (let y = Math.min(Math.floor(fromY), 38); y >= 1; y--) {
      // 「立てる地面」は衝突判定のある(solid)ブロックだけ。水は solid ではないので
      // 足を乗せても実際には沈む（＝川や海に「落ちる」）ため、ここで弾く。
      const ground = this.world.isSolid(bx, y, bz);
      const feet = this.world.getBlock(bx, y + 1, bz) === 0;
      const head = this.world.getBlock(bx, y + 2, bz) === 0;
      if (ground && feet && head) return { x: bx + 0.5, y: y + 1, z: bz + 0.5 };
    }
    return null;
  }

  /** スタート地点（スポーン）へ戻る。位置も向きも最初の状態にリセット（歩行モードのみ表示） */
  private returnToStart(): void {
    const spot = this.worldManager.currentSpot;
    if (spot) this.spawnPlayer(spot);
  }

  /** その観光地のスポーン地点へプレイヤーを置く（入場時・スタートに戻る時） */
  private spawnPlayer(spot: SpotDefinition): void {
    const sp = spot.spawn ?? {
      pos: { x: spot.center.x, y: 16, z: spot.center.z + 14 },
      yaw: 0,
    };
    this.walk.spawn(sp.pos, sp.yaw);
  }

  backToHub(): void {
    this.orbit.enabled = false;
    this.walk.enabled = false;
    this.speech.cancel();
    this.worldManager.unload();
    this.infoPanel.hide();
    this.toolbar.classList.add('hidden');
    this.movePad.classList.add('hidden');
    this.jumpBtn.classList.add('hidden');
    this.crosshair.classList.add('hidden');
    this.nameBanner.classList.add('hidden');
    this.buildActions.classList.add('hidden');
    this.saveBar.classList.add('hidden');
    this.palette.hide();
    this.build.hide();
    this.places.hide();
    this.mode = 'walk';
    this.hub.show();
  }

  /**
   * 画面に出すキー案内（英語・小5）。
   * 「進む・振り向く・見上げる」がどのキーかを、いつでも見えるようにする。
   * 編集モードでは Q/E がブロックの設置・削除になるので、その説明に切り替える。
   */
  // ===== キャラクターと視点 =====

  /** 保存しておいたキャラクターの種類（初回は男の子） */
  private loadSkin(): SkinKind {
    try {
      const s = localStorage.getItem('kc.skin');
      if (s === 'boy' || s === 'girl' || s === 'pet' || s === 'robot') return s;
    } catch {
      // 読めなければ既定を使う
    }
    return 'boy';
  }

  /** 保存しておいた視点（初回は一人称） */
  private loadView(): ViewMode {
    try {
      const v = localStorage.getItem('kc.view');
      if (v === 'first' || v === 'back' || v === 'third' || v === 'front') return v;
    } catch {
      // 読めなければ既定を使う
    }
    return 'first';
  }

  /** 視点を次へ（一人称 → うしろ → 遠く → 正面 → …） */
  private cycleView(): void {
    const i = VIEW_ORDER.indexOf(this.walk.view);
    this.walk.view = VIEW_ORDER[(i + 1) % VIEW_ORDER.length];
    try {
      localStorage.setItem('kc.view', this.walk.view);
    } catch {
      // 保存できなくても切り替えは続ける
    }
    this.refreshAvatarUI();
    this.showToast(`View: ${VIEW_LABEL[this.walk.view]}`);
  }

  /** キャラクターを次へ（男の子 → 女の子 → ペット → ロボット → …） */
  private cycleSkin(): void {
    const order: SkinKind[] = ['boy', 'girl', 'pet', 'robot'];
    const next = order[(order.indexOf(this.avatar.skinKind) + 1) % order.length];
    this.avatar.setSkin(next);
    try {
      localStorage.setItem('kc.skin', next);
    } catch {
      // 保存できなくても切り替えは続ける
    }
    // 一人称のままだと変えたキャラクターが見えないので、うしろ視点に切り替える
    if (this.walk.view === 'first') {
      this.walk.view = 'back';
      try {
        localStorage.setItem('kc.view', 'back');
      } catch {
        // 保存できなくてもよい
      }
    }
    this.refreshAvatarUI();
    this.showToast(`You are the ${SKIN_LABEL[next]}!`);
  }

  /** ボタンの表示（視点名・キャラ名）と、キャラクターを出すかどうかを更新する */
  private refreshAvatarUI(): void {
    this.viewBtn.querySelector('[data-label="view"]')!.textContent = VIEW_LABEL[this.walk.view];
    this.skinBtn.querySelector('[data-label="skin"]')!.textContent = SKIN_LABEL[this.avatar.skinKind];
    // 編集モードは中央カーソルで置くため一人称に固定（キャラクターは隠す）
    const show = this.mode !== 'build' && this.walk.enabled && this.walk.view !== 'first';
    this.avatar.setVisible(show);
  }

  /**
   * キー案内を描く。開いていれば一覧、閉じていれば小さなボタンだけ（画面の邪魔をしない）。
   * 開閉は K キーかボタンで切り替え、状態は端末に覚えさせる。
   */
  private renderKeyGuide(): void {
    if (this.keyGuideOpen) {
      this.keyGuide.classList.remove('is-closed');
      this.keyGuide.innerHTML = `
        <button class="key-guide__toggle" data-role="keys" title="Hide keys">🎮 Keys<kbd>K</kbd><span class="key-guide__x">✕</span></button>
        <div class="key-guide__body">${this.keyGuideHtml(this.mode)}</div>
      `;
    } else {
      this.keyGuide.classList.add('is-closed');
      this.keyGuide.innerHTML = `
        <button class="key-guide__toggle" data-role="keys" title="Show keys">🎮 Keys<kbd>K</kbd></button>
      `;
    }
    this.keyGuide.querySelector('[data-role="keys"]')!.addEventListener('click', () => this.toggleKeyGuide());
  }

  /** キー案内の開閉（K キー／ボタン） */
  private toggleKeyGuide(): void {
    this.keyGuideOpen = !this.keyGuideOpen;
    try {
      localStorage.setItem('kc.keys.open', this.keyGuideOpen ? '1' : '0');
    } catch {
      // 保存できなくても表示は続ける
    }
    this.renderKeyGuide();
  }

  private keyGuideHtml(mode: Mode): string {
    const k = (s: string) => `<kbd>${s}</kbd>`;
    const row = (keys: string, what: string) =>
      `<div class="key-guide__row"><span class="key-guide__keys">${keys}</span><span class="key-guide__what">${what}</span></div>`;
    const head = (s: string) => `<div class="key-guide__head">${s}</div>`;
    const building = mode === 'build';

    // 俯瞰（Look）モードは操作が違うので別の案内
    if (mode === 'orbit') {
      return [
        head('Move the camera'),
        row(`${k('←')}${k('→')}`, 'Go around'),
        row(`${k('↑')}${k('↓')}`, 'Up / down'),
        row(`${k('N')} / ${k('F')}`, '<b>N</b>ear / <b>F</b>ar'),
        head('Go'),
        row(k('W'), '<b>W</b>alk again'),
        row(k('X'), 'Back to list'),
      ].join('');
    }

    // 移動・視点は歩行/編集で共通
    const move = [
      head('Move'),
      row(`${k('↑')}${k('↓')}${k('←')}${k('→')}`, 'Walk'),
      row(`${k('Shift')}+${k('←')}${k('→')}`, 'Turn around'),
      // 編集中は D が Done なので、見下ろすは Shift＋↓ を案内する
      building
        ? row(`${k('U')} / ${k('Shift')}+${k('↓')}`, 'Look up / down')
        : row(`${k('U')} / ${k('D')}`, 'Look <b>U</b>p / <b>D</b>own'),
      row(k('J'), '<b>J</b>ump'),
    ];

    const rest = building
      ? [
          head('Blocks'),
          row(k('P'), '<b>P</b>ut a block'),
          row(k('T'), '<b>T</b>ake my block'),
          row(`${k('1')}…${k('9')}${k('0')}`, 'Choose a block'),
          head('Go'),
          row(k('D'), '<b>D</b>one (stop building)'),
          row(k('H'), '<b>H</b>ome (start)'),
          ...(SaveStorage.cloud
            ? []
            : [
                row(`${k('Ctrl')}+${k('S')}`, '<b>S</b>ave file'),
                row(`${k('Ctrl')}+${k('O')}`, '<b>O</b>pen file'),
              ]),
        ]
      : [
          head('Do'),
          row(k('Enter'), 'Choose a thing'),
          row(k('I'), 'See the <b>I</b>nfo'),
          row(k('N'), '<b>N</b>ext thing'),
          row(k('E'), 'Listen in <b>E</b>nglish'),
          head('You'),
          row(k('C'), '<b>C</b>hange Character'),
          row(k('V'), 'Change <b>V</b>iew'),
          head('Go'),
          row(k('M'), '<b>M</b>ap: go to a place'),
          row(k('L'), '<b>L</b>ook from the sky'),
          ...(SaveStorage.readOnly ? [] : [row(k('B'), '<b>B</b>uild blocks')]),
          row(k('H'), '<b>H</b>ome (start)'),
          row(k('X'), 'Back to list'),
        ];

    return [...move, ...rest].join('');
  }

  /**
   * 歩行 / オービット / 編集 を切り替える。
   * モード切替ではスポーンし直さない（位置を保ったまま見る⇄作るを行き来できる）。
   */
  private setMode(mode: Mode): void {
    const spot = this.worldManager.currentSpot;
    // 建築できる範囲が無いとき・友だちの作品を見ているとき（見るだけ）は歩行へ
    if (mode === 'build' && (!spot?.field || SaveStorage.readOnly)) mode = 'walk';
    this.mode = mode;

    const walkLike = mode === 'walk' || mode === 'build';
    const building = mode === 'build';

    this.orbit.enabled = mode === 'orbit';
    this.walk.enabled = walkLike;

    // タップの役割：編集＝中央カーソルで設置、それ以外＝構造物の情報選択
    this.walk.onTap = building
      ? () => void this.build.place()
      : (x, y) => this.worldManager.selectByRay(x, y);

    // 編集モードでは D＝Done（編集をやめる）。歩行では D＝Down（見下ろす）
    this.walk.useDForLookDown = !building;

    // 視点・キャラクター・地図のボタンは歩行モードのときだけ（編集は一人称固定・俯瞰は別操作）
    this.viewBtn.classList.toggle('hidden', mode !== 'walk');
    this.skinBtn.classList.toggle('hidden', mode !== 'walk');
    this.mapBtn.classList.toggle('hidden', mode !== 'walk');
    if (mode !== 'walk') this.places.hide();
    // 編集中はカメラを一人称に固定（中央カーソルで正確に置けるように）
    this.walk.viewOverride = building ? 'first' : null;
    this.refreshAvatarUI();

    // 編集に入るときは少し下を向く（正面のままだと中央カーソルがどこにも届かず置けないため）
    if (building) this.walk.lookDownForBuild();

    // 移動UI（歩行・編集で共通）
    this.movePad.classList.toggle('hidden', !walkLike);
    this.jumpBtn.classList.toggle('hidden', !walkLike);
    this.crosshair.classList.toggle('hidden', !walkLike);
    this.keyGuide.classList.remove('hidden'); // 3モードとも案内を出す
    this.renderKeyGuide();

    // 編集UI
    this.buildActions.classList.toggle('hidden', !building);
    // 大学の Google に自動で保存する版（GAS）では、ファイルの保存・読み込みは使わない
    this.saveBar.classList.toggle('hidden', !building || SaveStorage.cloud);
    if (building) {
      this.palette.show();
      this.build.show();
      this.worldManager.clearSelection();
      this.nameBanner.classList.add('hidden');
    } else {
      this.palette.hide();
      this.build.hide();
    }

    // オービットに入るときは視点を中心へリセット
    if (mode === 'orbit' && spot) {
      this.orbit.setTarget(spot.center.x, spot.center.y, spot.center.z, spot.viewDistance);
    }

    // モード切替ボタン（編集中は隠す）
    this.modeBtn.classList.toggle('hidden', building);
    if (mode === 'walk') {
      this.modeBtn.querySelector('[data-label="mode"]')!.textContent = 'Look';
      this.modeBtn.querySelector('.kc-btn__icon')!.textContent = '👀';
      this.modeBtn.querySelector('kbd')!.textContent = 'L'; // L = Look
    } else if (mode === 'orbit') {
      this.modeBtn.querySelector('[data-label="mode"]')!.textContent = 'Walk';
      this.modeBtn.querySelector('.kc-btn__icon')!.textContent = '🚶';
      this.modeBtn.querySelector('kbd')!.textContent = 'W'; // W = Walk
    }

    // スタートに戻るボタンは歩行モードのときだけ
    this.restartBtn.classList.toggle('hidden', mode !== 'walk');

    // 編集ボタン（建築できる範囲が無い観光地では隠す）
    this.buildBtn.classList.toggle('hidden', !spot?.field || SaveStorage.readOnly);
    this.buildBtn.classList.toggle('is-active', building);
    this.buildBtn.querySelector('[data-label="build"]')!.textContent = building ? 'Done' : 'Build';
    this.buildBtn.querySelector('.kc-btn__icon')!.textContent = building ? '✓' : '🧱';
    this.buildBtn.querySelector('kbd')!.textContent = building ? 'D' : 'B'; // D = Done / B = Build

    // ヒント文
    const hint = this.toolbar.querySelector('[data-role="hint"]')!;
    hint.textContent = building
      ? '🧱 Make your own world here!'
      : SaveStorage.readOnly
        ? `👀 This is ${SaveStorage.viewing}'s world. You can only look.`
        : '👆 Tap a building to learn about it!';
  }

  /**
   * ボタンを「押しっぱなしで連続実行」できるようにする（Minecraftのように押し続けて積む/壊す）。
   * 押した瞬間に1回＋押している間は一定間隔でくり返す。
   */
  private holdRepeat(
    btn: HTMLElement,
    onStart: () => void,
    onRepeat: () => void = onStart,
    onEnd?: () => void,
  ): void {
    let timer = 0;
    let holding = false;
    const begin = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      if (holding) return;
      holding = true;
      onStart();
      timer = window.setInterval(onRepeat, 150);
    };
    const end = (): void => {
      if (!holding) return;
      holding = false;
      window.clearInterval(timer);
      timer = 0;
      onEnd?.();
    };
    btn.addEventListener('pointerdown', begin);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointerleave', end);
    btn.addEventListener('pointercancel', end);
  }

  // ===== 子どもの作品の保存（GAS 版：大学の Google に番号ごと） =====

  /** 前に入れた番号（同じ iPad で開き直したときに、入力欄へ先に入れておく） */
  private lastNumber(): string {
    try {
      return localStorage.getItem('kc.me') ?? '';
    } catch {
      return '';
    }
  }

  // 番号の画面から呼ぶ処理。失敗したら英文の Error を投げる（番号の画面に出る）。

  /** 自分の番号を入れたとき：合言葉がもう決まっているか（自分の作品を開いているなら same） */
  private async checkNumber(id: string): Promise<'new' | 'set' | 'same'> {
    if (id === SaveStorage.owner) {
      if (SaveStorage.readOnly) this.backToMyWorks();
      return 'same';
    }
    try {
      return (await SaveStorage.hasPin(id)) ? 'set' : 'new';
    } catch {
      throw new Error('Could not open. Check the internet and try again.');
    }
  }

  /** はじめての番号：合言葉を決める */
  private async makePin(id: string, pin: string): Promise<void> {
    try {
      await SaveStorage.makePin(id, pin);
    } catch (err) {
      if (err instanceof Error && err.message === 'taken') {
        throw new Error('This number already has a secret number. Press ← Back.');
      }
      throw new Error('Could not open. Check the internet and try again.');
    }
  }

  /** 番号と合言葉で、自分の作品を開く（作れる） */
  private async openMyWorks(id: string, pin: string): Promise<void> {
    try {
      await SaveStorage.openMine(id, pin);
    } catch (err) {
      const reason = err instanceof Error ? err.message : '';
      if (reason === 'wrong') throw new Error('That is not right. Try again.');
      if (reason === 'locked') throw new Error('Please wait 10 minutes, or ask your teacher.');
      if (reason === 'not-saved') throw new Error('Your world is still saving. Check the internet and try again.');
      throw new Error('Could not open. Check the internet and try again.');
    }
    try {
      localStorage.setItem('kc.me', id);
    } catch {
      // 覚えられなくても続ける
    }
    this.afterWorksChanged();
  }

  /** 番号の作品を「見るだけ」で開く（自分の番号なら、自分の作品に戻るだけ） */
  private async lookAtWorks(id: string): Promise<void> {
    if (id === SaveStorage.owner) {
      SaveStorage.backToMine();
    } else {
      try {
        await SaveStorage.openFriend(id);
      } catch {
        throw new Error('Could not open. Check the internet and try again.');
      }
    }
    this.afterWorksChanged();
  }

  /** 友だちの作品を見るのをやめて、自分の作品に戻る（まだ自分の番号を開いていなければ、番号を聞く） */
  private backToMyWorks(): void {
    SaveStorage.backToMine();
    this.afterWorksChanged();
    if (SaveStorage.owner) this.showToast(`Welcome back, ${SaveStorage.owner}!`);
    else this.numberPanel.open('me', this.lastNumber());
  }

  /** 開いている作品（自分／友だち）が変わったら、画面を合わせる */
  private afterWorksChanged(): void {
    this.infoPanel.readOnly = SaveStorage.readOnly;
    this.renderWho();
    // 観光地の中にいたら、その作品で読み込み直す
    const spot = this.worldManager.currentSpot;
    if (spot) this.enterSpot(spot);
  }

  /** 一覧の一番上に「だれの作品か」と、切りかえのボタンを出す */
  private renderWho(): void {
    const bar = this.hub.whoBar;
    if (!SaveStorage.cloud || (!SaveStorage.owner && !SaveStorage.viewing)) {
      bar.classList.add('hidden');
      return;
    }
    const friend = SaveStorage.viewing;
    bar.innerHTML = friend
      ? `<span class="hub-who__name is-friend">👀 <b>${friend}</b>'s world <small>(look only)</small></span>
         <button class="kc-btn" data-role="mine">${SaveStorage.owner ? '🏠 Back to my world' : '🙂 Open my world'}</button>`
      : `<button class="kc-btn hub-who__me" data-role="me" title="Change number">🙂 <b>${SaveStorage.owner}</b></button>
         <button class="kc-btn" data-role="friend">👀 See a friend's world</button>`;
    bar.classList.remove('hidden');
    bar.querySelector('[data-role="mine"]')?.addEventListener('click', () => this.backToMyWorks());
    bar.querySelector('[data-role="me"]')?.addEventListener('click', () =>
      this.numberPanel.open('me', SaveStorage.owner ?? ''),
    );
    bar.querySelector('[data-role="friend"]')?.addEventListener('click', () => this.numberPanel.open('friend'));
  }

  /** 短いトーストを表示（保存通知など） */
  private showToast(msg: string, ms = 1600): void {
    this.toast.textContent = msg;
    this.toast.classList.remove('hidden');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.add('hidden'), ms);
  }

  /** 編集したワールドを .kcw ファイルとして書き出す（iPadは「ファイル」/iCloudへ） */
  private saveToFile(): void {
    try {
      EditStore.download();
      this.showToast('Saved to Files ✓');
    } catch {
      this.showToast('Could not save');
    }
  }

  /** .kcw ファイルを読み込んで取り込む（現在地なら再適用） */
  private async openFromFile(): Promise<void> {
    const file = this.fileInput.files?.[0];
    this.fileInput.value = ''; // 同じファイルを続けて選べるように
    if (!file) return;
    try {
      const text = await file.text();
      const affected = EditStore.importText(text);
      const cur = this.worldManager.currentSpot;
      if (cur && affected.includes(cur.id)) {
        this.worldManager.loadSpot(cur);
        this.reachCache = null;
        this.build.setContext(cur.id, cur.field, this.worldManager.editCells);
      }
      this.showToast('Opened ✓');
    } catch (err) {
      this.showToast(err instanceof Error ? err.message : 'Could not open');
    }
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DELTA);
    this.lastTime = now;

    if (this.walk.enabled) {
      this.walk.update(dt);
      // キャラクターを足元の位置・向きに合わせ、歩くと手足を振らせる
      this.avatar.update(this.player.position, this.player.yaw, this.walk.moving, dt);
    } else {
      this.orbit.update(dt);
    }

    if (this.mode === 'build') {
      // 中央カーソルが指すマスのプレビュー枠を更新
      this.build.update();
    } else {
      // 近くの対象を判定して英語名バナーを出す
      this.worldManager.updateNear();
    }

    this.renderer.render(this.sceneManager.scene, this.camera);
    requestAnimationFrame(this.loop);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    // 文字入力中（情報パネルの付け足しなど）はショートカットを効かせない
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
    if (e.isComposing) return; // 日本語入力の変換中は無視

    // K = Keys（キー一覧の開閉）。観光地の中ならどのモードでも使える
    if (e.code === 'KeyK' || e.key === 'k' || e.key === 'K') {
      if (this.worldManager.currentSpot) {
        e.preventDefault();
        this.toggleKeyGuide();
      }
      return;
    }

    if (!this.walk.enabled && !this.orbit.enabled) return;

    // キーは英単語の頭文字に合わせている：
    //   J=Jump / L=Look / B=Build / P=Put / T=Take / W=Walk / H=Home / E=English
    //   C=Change Character / V=View / I=Info / N=Next / K=Keys
    // 編集モード：P=置く / T=消す / 数字=ブロック / W・X・Esc=歩行へ / Ctrl+S・Ctrl+O=保存・読込
    if (this.mode === 'build') {
      if (e.ctrlKey || e.metaKey) {
        if (SaveStorage.cloud) return; // GAS 版は自動で保存するので、ファイルは使わない
        if (e.code === 'KeyS') {
          e.preventDefault();
          this.saveToFile();
        } else if (e.code === 'KeyO') {
          e.preventDefault();
          this.fileInput.click();
        }
        return;
      }
      if (/^Digit[0-9]$/.test(e.code)) {
        e.preventDefault();
        this.palette.selectByDigit(Number(e.code.slice(5))); // onPick→build.setActiveBlock
      } else if (e.code === 'KeyP' || e.code === 'Enter') {
        e.preventDefault();
        // 置けなかったとき（何も見ていない・遠すぎる）は理由を伝える
        if (!this.build.place()) this.showToast('Look at a block, then press P');
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        if (!this.build.remove()) this.showToast('You can take only your own blocks');
      } else if (e.code === 'KeyD' || e.code === 'KeyW' || e.code === 'KeyB' || e.code === 'KeyX' || e.code === 'Escape') {
        this.setMode('walk'); // D = Done（ボタンの表示と同じ）
      } else if (e.code === 'KeyH') {
        this.returnToStart();
      }
      return;
    }

    if (e.ctrlKey || e.metaKey) return; // ブラウザの標準操作を邪魔しない

    if (e.code === 'Tab' || e.code === 'KeyN') {
      // N = Next（次の構造物へ）
      e.preventDefault();
      this.worldManager.cycle(e.shiftKey ? -1 : 1);
    } else if (e.code === 'Enter' || e.code === 'KeyI') {
      // I = Info（画面中央の構造物を選んで説明を出す）
      if (this.walk.enabled && !this.worldManager.selectByRay(0, 0)) {
        this.showToast('Look at a building, then press Enter');
      }
    } else if (e.code === 'KeyL') {
      // L = Look（空から見る ⇄ 歩く）
      this.setMode(this.mode === 'orbit' ? 'walk' : 'orbit');
    } else if (e.code === 'KeyW') {
      // W = Walk（空から見るのをやめて歩く）
      if (this.mode === 'orbit') this.setMode('walk');
    } else if (e.code === 'KeyB') {
      // B = Build（ブロックを作る）
      this.setMode('build');
    } else if (e.code === 'KeyH') {
      // H = Home（スタート地点へ戻る）
      if (this.walk.enabled) this.returnToStart();
    } else if (e.code === 'KeyV') {
      // V = View（見え方を変える：一人称→うしろ→遠く→正面）
      if (this.mode === 'walk') this.cycleView();
    } else if (e.code === 'KeyC') {
      // C = Change Character（キャラクターを変える：男の子→女の子→ペット→ロボット）
      if (this.mode === 'walk') this.cycleSkin();
    } else if (e.code === 'KeyM') {
      // M = Map（行ける場所の一覧を開く／閉じる）
      this.places.toggle();
    } else if (e.code === 'KeyE') {
      // E = English（選んでいる構造物の英語を聞く）
      this.infoPanel.listenCurrent();
    } else if (e.code === 'KeyX' || e.code === 'Escape') {
      // X＝閉じる・もどる（学校の iPad のキーボードには Esc キーがないため。Esc も今までどおり使える）
      if (this.worldManager.selectedIndex >= 0) this.worldManager.clearSelection();
      else this.backToHub();
    }
  };

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
