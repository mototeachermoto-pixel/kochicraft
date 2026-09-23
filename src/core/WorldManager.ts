import * as THREE from 'three';
import type { World } from '@/world/World';
import type { SceneObject, SpotDefinition } from '@/spots/SpotDefinition';
import { PhotoStore } from '@/data/PhotoStore';
import { EditStore, type EditCell } from '@/data/EditStore';
import type { OrbitCameraController } from './OrbitCameraController';

/** 「正面で向き合っている」と見なす、対象（領域のふち）までの最大距離（ブロック）。近くにいる時だけ反応する。 */
const NEAR_FACE_MAX_DIST = 4;
/** 「正対している」と見なす、向いている方向と対象への方向のなす角の許容範囲（ラジアン。約50度）。 */
const NEAR_FACE_CONE = (50 * Math.PI) / 180;

/**
 * ハブと観光地ワールドの切替、および観光地内の「構造物の選択」を管理する。
 * 選択はタップ（レイ）と順送り（Tab/矢印）の両方に対応し、選択中は枠でハイライトする。
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
  private readonly highlight: THREE.LineSegments;
  /**
   * キャラクターが正面で向き合っている（狙っている）対象を示す枠。
   * 選択中の黄色（#ffd24a・金っぽいベージュ寄り）とはっきり区別できる、
   * より明るいビビッドレモン色（#fff200）の線だけの大枠（塗りつぶしなし）。
   */
  private readonly nearHighlight: THREE.LineSegments;
  private readonly nearHighlightMat: THREE.LineBasicMaterial;
  private readonly raycaster = new THREE.Raycaster();
  private readonly hitBox = new THREE.Box3();
  private readonly hitPoint = new THREE.Vector3();
  private readonly forwardVec = new THREE.Vector3();

  constructor(
    private readonly world: World,
    scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly orbit: OrbitCameraController,
  ) {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const mat = new THREE.LineBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.95 });
    this.highlight = new THREE.LineSegments(edges, mat);
    this.highlight.visible = false;
    this.highlight.renderOrder = 999;
    scene.add(this.highlight);

    this.nearHighlightMat = new THREE.LineBasicMaterial({ color: 0xfff200, transparent: true, opacity: 0.9 });
    this.nearHighlight = new THREE.LineSegments(edges, this.nearHighlightMat);
    this.nearHighlight.visible = false;
    this.nearHighlight.renderOrder = 998;
    scene.add(this.nearHighlight);
  }

  /** 観光地ワールドを読み込む */
  loadSpot(spot: SpotDefinition): void {
    this.world.clearAll();
    spot.build?.(this.world);
    // 子どもが工作ひろばで積んだブロック（保存差分）を景観の上に復元する
    this.editCells = EditStore.load(spot.id);
    if (this.editCells.length > 0) this.world.setBlocksBatch(this.editCells);
    this.objects = spot.objects ?? [];
    // 保存済みの写真・音声（先生がアップロードした実物写真／録音）を反映
    for (const o of this.objects) {
      const photo = PhotoStore.getPhoto(spot.id, o.id);
      if (photo) o.image = photo;
      const audio = PhotoStore.getAudio(spot.id, o.id);
      if (audio) o.audio = audio;
    }
    this.currentSpot = spot;
    this.orbit.setTarget(spot.center.x, spot.center.y, spot.center.z, spot.viewDistance);
    this.nearId = null;
    this.nearHighlight.visible = false;
    this.clearSelection();
  }

  /** ワールドを片付けてハブへ戻る準備 */
  unload(): void {
    this.world.clearAll();
    this.objects = [];
    this.currentSpot = null;
    this.nearId = null;
    this.nearHighlight.visible = false;
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
  updateNear(): void {
    const pos = this.camera.position;
    this.camera.getWorldDirection(this.forwardVec);
    this.forwardVec.y = 0;
    this.forwardVec.normalize();

    let near: SceneObject | null = null;
    let bestDist = Infinity;
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
      if (dist > NEAR_FACE_MAX_DIST || dist >= bestDist) continue; // 遠すぎる／もっと近い候補が既にある

      // 正対チェック：向いている方向と、対象（の代表点）への方向のなす角
      if (dist > 0.001) {
        const dirX = -dx / dist;
        const dirZ = -dz / dist;
        const dot = this.forwardVec.x * dirX + this.forwardVec.z * dirZ;
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
        if (angle > NEAR_FACE_CONE) continue; // 正面から外れすぎ（横・後ろ）は対象外
      }

      bestDist = dist;
      near = o;
    }

    const id = near ? near.id : null;
    if (id !== this.nearId) {
      this.nearId = id;
      this.onNear?.(near);
      if (near) this.updateNearHighlight(near);
      else this.nearHighlight.visible = false;
    }
    // ふわっと光らせる（点滅ではなく、薄い⇄濃いをゆっくり繰り返す）
    if (this.nearHighlight.visible) {
      const t = performance.now() / 1000;
      this.nearHighlightMat.opacity = 0.65 + 0.3 * Math.sin(t * 2.4);
    }
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
    this.updateHighlight(o);
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
    this.highlight.visible = false;
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

  private updateHighlight(o: SceneObject): void {
    const w = o.region.max.x - o.region.min.x + 1;
    const h = o.region.max.y - o.region.min.y + 1;
    const d = o.region.max.z - o.region.min.z + 1;
    this.highlight.scale.set(w, h, d);
    this.highlight.position.set(
      o.region.min.x + w / 2,
      o.region.min.y + h / 2,
      o.region.min.z + d / 2,
    );
    this.highlight.visible = true;
  }

  /** 「近くにいる」対象の枠（水色・少し大きめ）を更新する */
  private updateNearHighlight(o: SceneObject): void {
    const w = o.region.max.x - o.region.min.x + 1;
    const h = o.region.max.y - o.region.min.y + 1;
    const d = o.region.max.z - o.region.min.z + 1;
    // 選択中の黄色い枠とぴったり重なって見えづらくならないよう、一回り大きくする
    this.nearHighlight.scale.set(w * 1.06, h * 1.06, d * 1.06);
    this.nearHighlight.position.set(
      o.region.min.x + w / 2,
      o.region.min.y + h / 2,
      o.region.min.z + d / 2,
    );
    this.nearHighlight.visible = true;
  }
}
