import * as THREE from 'three';
import type { World } from '@/world/World';
import type { SceneObject, SpotDefinition } from '@/spots/SpotDefinition';
import { PhotoStore } from '@/data/PhotoStore';
import { prefetchGasPhotos } from '@/data/GasPhotos';
import { EditStore, type EditCell } from '@/data/EditStore';
import type { OrbitCameraController } from './OrbitCameraController';
import { Surroundings, padEdges } from '@/world/Surroundings';
import { SpotBeacons } from '@/world/SpotBeacons';

/** 「正面で向き合っている」と見なす、対象（領域のふち）までの最大距離（ブロック）。近くにいる時だけ反応する。 */
const NEAR_FACE_MAX_DIST = 4;
/** 「正対している」と見なす、向いている方向と対象への方向のなす角の許容範囲（ラジアン。約50度）。 */
const NEAR_FACE_CONE = (50 * Math.PI) / 180;

/**
 * ハブと観光地ワールドの切替、および観光地内の「構造物の選択」を管理する。
 * 選択はタップ（レイ）と順送り（Tab/矢印）の両方に対応する。
 * 名所の目印は「光の柱」（SpotBeacons）。前の黄色い枠線（選択中・正面の2種類）は、
 * 分かりづらく混乱しやすいので 2026-11-14 にやめた（先生の希望）。
 */
export class WorldManager {
  currentSpot: SpotDefinition | null = null;
  selectedIndex = -1;
  /** 現在の観光地で復元した編集差分（BuildController へ渡す） */
  editCells: EditCell[] = [];

  /** 選択が変わったら通知（情報パネルが購読） */
  onSelect?: (obj: SceneObject | null) => void;
  /** 近くにいる対象が変わったら通知（英語名バナー用） */
  onNear?: (obj: SceneObject | null) => void;

  private objects: SceneObject[] = [];
  private nearId: string | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly hitBox = new THREE.Box3();
  private readonly hitPoint = new THREE.Vector3();
  private readonly forwardVec = new THREE.Vector3();

  /** 観光地のまわりの景色（ふちの地面を外へ続け、遠くに山を置く。絵だけ） */
  private readonly surroundings = new Surroundings();
  /** 名所の光の柱 */
  private readonly beacons: SpotBeacons;

  constructor(
    private readonly world: World,
    scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly orbit: OrbitCameraController,
  ) {
    scene.add(this.surroundings.group);
    this.beacons = new SpotBeacons(scene);
  }

  /** 観光地ワールドを読み込む */
  loadSpot(spot: SpotDefinition): void {
    this.world.clearAll();
    spot.build?.(this.world);
    // ふちの低い所を内側の地面で埋め、まわりの景色を作る（子どもの作品を戻す前に。作品は変えない）
    if (spot.field) {
      padEdges(this.world, spot.field);
      this.surroundings.build(this.world, spot.field, spot.id, spot.backdrop);
    } else {
      this.surroundings.clear();
    }
    // 子どもが工作ひろばで積んだブロック（保存差分）を景観の上に復元する
    this.editCells = EditStore.load(spot.id);
    if (this.editCells.length > 0) this.world.setBlocksBatch(this.editCells);
    this.objects = spot.objects ?? [];
    // 保存済みの写真・音声（アップロードした実物写真／録音）を反映。
    // 無ければ最初の写真・音声に戻す（別の子の作品を開いたとき、前の子の写真が残らないように）
    for (const o of this.objects) {
      if (!('imageDefault' in o)) o.imageDefault = o.image;
      if (!('audioDefault' in o)) o.audioDefault = o.audio;
      o.image = PhotoStore.getPhoto(spot.id, o.id) ?? o.imageDefault;
      o.audio = PhotoStore.getAudio(spot.id, o.id) ?? o.audioDefault;
    }
    // GAS で動いているときは、この観光地の写真を今のうちにまとめて取り寄せておく
    prefetchGasPhotos(this.objects.map((o) => o.image));
    this.currentSpot = spot;
    this.orbit.setTarget(spot.center.x, spot.center.y, spot.center.z, spot.viewDistance);
    this.nearId = null;
    // 前の観光地で出ていた名前を消す（別の観光地に入っても名前が残ってしまっていた）
    this.onNear?.(null);
    this.beacons.setObjects(spot.id, this.objects);
    this.clearSelection();
  }

  /** ワールドを片付けてハブへ戻る準備 */
  unload(): void {
    this.world.clearAll();
    this.surroundings.clear();
    this.objects = [];
    this.currentSpot = null;
    this.nearId = null;
    this.beacons.clear();
    this.onNear?.(null);
    this.clearSelection();
  }

  /**
   * 「対象から4ブロック以内」かつ「正対している（向いている方向から±50度以内）」を両方満たす
   * 対象の中から、いちばん近い物を選ぶ。
   *
   * 距離は基本的に region（当たり判定の直方体）の端までで測る（表面のすぐそばに来た瞬間に
   * 反応してほしいので、代表点までの距離だけで測ると、対象が大きいほど「4ブロック以内」に
   * 入りづらくなってしまうため）。
   * ただし、柳や木立のように当たり判定だけ「ふわっと広い」対象では、その広い範囲の中に
   * いるだけで端までの距離が常に0になり、実際にはずっと離れているのに他の対象を押しのけて
   * しまう。それを防ぐため、範囲の中にいる場合だけは、対象の focus（見どころの代表点）までの
   * 実際の距離で測り直す。
   */
  updateNear(viewer?: { pos: THREE.Vector3; yaw: number }): void {
    // 歩くときは、キャラクターの位置と向きで決める（後ろ・横から見る視点ではカメラが4マスほど離れていて、
    // カメラで測ると、すぐそばまで来ても名前が出なかったため。光の柱もキャラクターの位置で薄くしている）。
    // 空から見るときは、カメラの位置と向きで決める
    const pos = viewer ? viewer.pos : this.camera.position;
    if (viewer) {
      this.forwardVec.set(-Math.sin(viewer.yaw), 0, -Math.cos(viewer.yaw));
    } else {
      this.camera.getWorldDirection(this.forwardVec);
      this.forwardVec.y = 0;
      this.forwardVec.normalize();
    }

    let near: SceneObject | null = null;
    let bestScore = Infinity;
    for (const o of this.objects) {
      const r = o.region;
      const clampX = Math.max(r.min.x, Math.min(pos.x, r.max.x + 1));
      const clampZ = Math.max(r.min.z, Math.min(pos.z, r.max.z + 1));
      let dx = pos.x - clampX;
      let dz = pos.z - clampZ;
      let dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.001) {
        // 範囲の中＝端までの距離では測れない（広い当たり判定に紛れる）ので、focus までの実距離で測り直す
        dx = pos.x - o.focus.x;
        dz = pos.z - o.focus.z;
        dist = Math.sqrt(dx * dx + dz * dz);
      }
      if (dist > NEAR_FACE_MAX_DIST) continue; // 遠すぎる
      // 範囲のふちまでの距離が同じくらいの物が2つあるとき（お社と、その前に広がる海など）は、
      // 名所の真ん中（focus）が近い方を選ぶ。広い範囲の物（海・森）が、小さな名所を押しのけないように
      const fx = pos.x - o.focus.x;
      const fz = pos.z - o.focus.z;
      const score = dist + 0.15 * Math.sqrt(fx * fx + fz * fz);
      if (score >= bestScore) continue; // もっと近い候補が既にある

      // 正対チェック：向いている方向と、対象（の代表点）への方向のなす角
      if (dist > 0.001) {
        const dirX = -dx / dist;
        const dirZ = -dz / dist;
        const dot = this.forwardVec.x * dirX + this.forwardVec.z * dirZ;
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
        if (angle > NEAR_FACE_CONE) continue; // 正面から外れすぎ（横・後ろ）は対象外
      }

      bestScore = score;
      near = o;
    }

    const id = near ? near.id : null;
    if (id !== this.nearId) {
      this.nearId = id;
      if (near) this.beacons.markVisited(near); // 名前を見た名所は、光の柱を弱くする
      this.onNear?.(near);
    }
  }

  /**
   * 光の柱を毎フレーム更新する（どのモードでも呼ぶ）。
   * @param viewer  明るさの基準（歩くときはキャラクターの位置、空から見るときはカメラ）
   * @param visible 柱を出すか（作るモードでは出さない）
   */
  updateBeacons(dt: number, viewer: THREE.Vector3, visible: boolean): void {
    this.beacons.update(dt, viewer, visible ? this.nearId : null, visible);
  }

  getObjects(): SceneObject[] {
    return this.objects;
  }

  /** インデックスで選択 */
  selectIndex(i: number): void {
    if (i < 0 || i >= this.objects.length) {
      this.clearSelection();
      return;
    }
    this.selectedIndex = i;
    const o = this.objects[i];
    this.beacons.markVisited(o); // 説明を開いた名所も「行った」ことにする
    this.orbit.focusOn(o.focus.x, o.focus.y, o.focus.z);
    this.onSelect?.(o);
  }

  /** 次/前へ順送り */
  cycle(dir: number): void {
    if (this.objects.length === 0) return;
    const base = this.selectedIndex < 0 ? (dir > 0 ? -1 : 0) : this.selectedIndex;
    const i = (base + dir + this.objects.length) % this.objects.length;
    this.selectIndex(i);
  }

  clearSelection(): void {
    this.selectedIndex = -1;
    this.onSelect?.(null);
  }

  /** タップ位置（NDC）から構造物を選ぶ。選べたら true（何も無ければ false） */
  selectByRay(ndcX: number, ndcY: number): boolean {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < this.objects.length; i++) {
      const r = this.objects[i].region;
      this.hitBox.min.set(r.min.x, r.min.y, r.min.z);
      this.hitBox.max.set(r.max.x + 1, r.max.y + 1, r.max.z + 1);
      const hit = this.raycaster.ray.intersectBox(this.hitBox, this.hitPoint);
      if (hit) {
        const d = this.raycaster.ray.origin.distanceTo(this.hitPoint);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
    }
    if (best >= 0) {
      this.selectIndex(best);
      return true;
    }
    this.clearSelection();
    return false;
  }
}
