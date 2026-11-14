import * as THREE from 'three';
import type { World } from './World';

/** 水のブロックの番号（blockTypes.ts の water） */
const WATER_ID = 5;

/** 水しぶきのつぶの数（いちどに出せる上限。古いものから使い回す） */
const DROP_COUNT = 28;
/** 水面の輪（波紋）の数（使い回す） */
const RING_COUNT = 5;

/**
 * 水に入ったときの見た目（2026-11-14 先生の希望「海に入ったとき、海に入ってるって感じに」）。
 *  - カメラが水の中に入ったら：まわりを青くにごらせ（霧を近く・青緑に）、空と雲をかくし、
 *    画面に水の中の光のゆらぎ（CSS の重ね絵）を出す。SceneManager.setUnderwater で霧と空を切りかえる。
 *  - 体が水に入った瞬間：水面から白い水しぶきが飛ぶ。
 *  - 水の中を歩いている間：体のまわりの水面に、広がって消える輪（波紋）が出る。
 *  音はつけない（先生の決まり：音はいらない）。動きをへらす設定の端末では、ゆらぎは止める。
 */
export class WaterEffects {
  /** 0＝水の外、1＝カメラが水の中（なめらかに変わる） */
  private amount = 0;
  private readonly overlay: HTMLDivElement;

  private readonly group = new THREE.Group();
  private readonly drops: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  private nextDrop = 0;
  private readonly rings: { mesh: THREE.Mesh; life: number }[] = [];
  private nextRing = 0;
  private ringTimer = 0;

  /** 前のフレームで、足が水の中だったか（入った瞬間を見つけるため） */
  private wasWading = false;
  /** 前のフレームで、足が水の中だったか（深さは問わない） */
  private wasInWater = false;

  constructor(
    scene: THREE.Scene,
    private readonly world: World,
    container: HTMLElement,
    private readonly setUnderwater: (t: number) => void,
  ) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'kc-underwater';
    this.overlay.setAttribute('aria-hidden', 'true');
    // 3Dの絵のすぐ上、ボタンや文字（HUD）の下に重ねる
    const canvas = container.querySelector('canvas.kc-canvas');
    if (canvas) canvas.after(this.overlay);
    else container.prepend(this.overlay);

    // 水しぶき：白い小さなかけら
    const dropGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: true });
    for (let i = 0; i < DROP_COUNT; i++) {
      const mesh = new THREE.Mesh(dropGeo, dropMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.drops.push({ mesh, vel: new THREE.Vector3(), life: 0 });
    }
    // 波紋：水面にねかせた白い輪
    const ringGeo = new THREE.RingGeometry(0.42, 0.5, 28);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < RING_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 2;
      this.group.add(mesh);
      this.rings.push({ mesh, life: 0 });
    }
    scene.add(this.group);
  }

  private isWater(x: number, y: number, z: number): boolean {
    return this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === WATER_ID;
  }

  /** (x, z) の列で、y から上へつづく水の、いちばん上の面の高さ（水でなければ null） */
  private surfaceAbove(x: number, y: number, z: number): number | null {
    if (!this.isWater(x, y, z)) return null;
    let top = Math.floor(y);
    while (top < 255 && this.isWater(x, top + 1, z)) top++;
    return top + 1;
  }

  /**
   * 毎フレーム呼ぶ。
   * @param feet   キャラクターの足もとの位置
   * @param moving 歩いているか
   * @param active 歩くモードか（空から見るときは、体の水しぶき・波紋は出さない）
   */
  update(dt: number, camera: THREE.Camera, feet: THREE.Vector3, moving: boolean, active: boolean): void {
    // ===== カメラが水の中か（すばやく切りかえる。水面をまたぐ一瞬だけ、まざる） =====
    const eyeIn = this.isWater(camera.position.x, camera.position.y, camera.position.z);
    const target = eyeIn ? 1 : 0;
    this.amount += (target - this.amount) * (1 - Math.exp(-18 * dt));
    if (Math.abs(target - this.amount) < 0.01) this.amount = target;
    this.setUnderwater(this.amount);
    this.overlay.style.opacity = this.amount.toFixed(3);
    this.overlay.classList.toggle('kc-underwater--on', this.amount > 0.01);

    // ===== 体が水に入った瞬間の水しぶき・歩いているときの波紋 =====
    const surface = active ? this.surfaceAbove(feet.x, feet.y + 0.1, feet.z) : null;
    // 水面が「足もと〜首のあたり」にあるときだけ（頭までもぐっているとき・カメラが水の中のときは、
    // 水面の輪を下から見ることになり、空に浮かぶ白い弧に見えてしまうので出さない）
    const wading = surface !== null && surface - feet.y < 1.5 && !eyeIn;
    // 入った瞬間（水の外 → 水の中）だけしぶきを出す。もぐっていた所から浮かんだときは出さない
    const inWater = surface !== null;
    if (wading && !this.wasWading && !this.wasInWater) this.splash(feet.x, surface, feet.z);
    this.wasWading = wading;
    this.wasInWater = inWater;
    if (eyeIn) {
      // カメラが水の中に入ったら、残っている輪もすぐ消す
      for (const r of this.rings) {
        r.life = 0;
        r.mesh.visible = false;
      }
    }

    if (wading) {
      this.ringTimer -= dt;
      if (this.ringTimer <= 0) {
        this.ring(feet.x, surface, feet.z);
        this.ringTimer = moving ? 0.38 : 1.1;
      }
    } else {
      this.ringTimer = 0;
    }

    // ===== しぶきと輪を動かす =====
    for (const d of this.drops) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.vel.y -= 9.8 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      // 水面より下に落ちたら消える（水にもどる）
      if (d.life <= 0 || (d.vel.y < 0 && this.isWater(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z))) {
        d.life = 0;
        d.mesh.visible = false;
      }
    }
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const t = 1 - r.life / 1.1; // 0→1
      const s = 0.6 + t * 1.6;
      r.mesh.scale.set(s, 1, s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t);
      if (r.life <= 0) r.mesh.visible = false;
    }
  }

  /** 水面 (x, y, z) から白いしぶきを上へ飛ばす */
  private splash(x: number, y: number, z: number): void {
    for (let i = 0; i < 14; i++) {
      const d = this.drops[this.nextDrop];
      this.nextDrop = (this.nextDrop + 1) % DROP_COUNT;
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
      const sp = 0.8 + Math.random() * 1.2;
      d.mesh.position.set(x + Math.cos(a) * 0.3, y + 0.05, z + Math.sin(a) * 0.3);
      d.vel.set(Math.cos(a) * sp, 2.6 + Math.random() * 1.8, Math.sin(a) * sp);
      d.life = 1.2;
      d.mesh.visible = true;
    }
    this.ring(x, y, z);
  }

  /** 水面 (x, y, z) に、広がって消える輪を1つ出す */
  private ring(x: number, y: number, z: number): void {
    const r = this.rings[this.nextRing];
    this.nextRing = (this.nextRing + 1) % RING_COUNT;
    r.mesh.position.set(x, y + 0.03, z);
    r.mesh.scale.set(0.6, 1, 0.6);
    r.life = 1.1;
    r.mesh.visible = true;
  }

  /** 観光地を出るときなど：しぶき・輪・水の中の見た目を消す */
  reset(): void {
    this.amount = 0;
    this.setUnderwater(0);
    this.overlay.style.opacity = '0';
    this.overlay.classList.remove('kc-underwater--on');
    for (const d of this.drops) {
      d.life = 0;
      d.mesh.visible = false;
    }
    for (const r of this.rings) {
      r.life = 0;
      r.mesh.visible = false;
    }
    this.wasWading = false;
    this.wasInWater = false;
  }
}
