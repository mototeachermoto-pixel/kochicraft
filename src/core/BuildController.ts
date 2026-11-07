import * as THREE from 'three';
import { REACH, WORLD_HEIGHT } from '@/config/constants';
import { AIR, blockRegistry } from '@/world/BlockRegistry';
import type { World } from '@/world/World';
import type { Player } from '@/player/Player';
import type { Region } from '@/spots/SpotDefinition';
import { VoxelRaycaster } from '@/editor/Raycaster';
import { EditStore, type EditCell } from '@/data/EditStore';

/** 積み上げられる高さの上限（世界の天井の少し下） */
const MAX_BUILD_Y = WORLD_HEIGHT - 3;

/**
 * 編集（Build）モードの中枢。マウス不使用。
 * - キーボード（P/T）と「Put/Take」ボタン：画面中央の＋から、見ているブロックの手前に置く／消す。
 * - 画面をタップ：タップした所のブロックの面に置く（マインクラフトのタブレット版と同じ）。
 * - 画面を長おし：長おしした所のブロックを消す。
 * 置くとブロックがぽんと出て、消すと小さなかけらになって散る（何をしたか目で分かるように）。
 *
 * ルール（「付け足し」方式）：
 *  - 置く：歩ける範囲（field）の中なら、地面・建物・木など**既存の何にでも付け足し**できる。
 *  - 消す：**自分で置いたブロックだけ**消せる。城・像・地面など元からある物は壊せない。
 * 変更したマスは差分として持ち、EditStore で自動保存する（再入場で復元）。
 *
 * 既存の VoxelRaycaster（src/editor/Raycaster.ts）を再利用している。
 */
export class BuildController {
  /** 変更したマス（key="x,y,z" → セル）。これがそのまま保存差分になる＝消せるのもこれだけ */
  private readonly edits = new Map<string, EditCell>();
  private field: Region | null = null;
  private spotId = '';
  private activeId = 1;

  // 連続設置（押しっぱなし）の状態：最初に置いた「向き」へ続けて伸ばす（上に積む/横に並べる）
  private holding = false;
  private lastCell: { x: number; y: number; z: number } | null = null;
  private stackDir: { x: number; y: number; z: number } | null = null;

  /** 変更が起きたら通知（自動保存トースト用） */
  onChange?: () => void;

  private readonly dir = new THREE.Vector3();
  private readonly ray = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly scene: THREE.Scene;

  /** 置いたときに「ぽん」と出る光るブロック（使い回す） */
  private readonly pops: { mesh: THREE.Mesh; life: number }[] = [];
  /** 消したときに散るかけら（使い回す。数に上限あり） */
  private readonly chips: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  private readonly chipGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  private readonly ghostFill: THREE.Mesh; // 設置プレビュー：半透明の色つきブロック
  private readonly ghostMat: THREE.MeshBasicMaterial;
  private readonly targetBox: THREE.LineSegments; // 設置プレビューのふち（水色）
  private readonly removeBox: THREE.LineSegments; // 削除プレビュー：自分で置いたブロックの赤枠

  constructor(
    private readonly world: World,
    scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly player: Player,
  ) {
    this.scene = scene;
    // これから置くマスのプレビュー：半透明の「色つきブロック」（選んだブロックの色）
    this.ghostMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false });
    this.ghostMat.color.copy(blockRegistry.getColor(this.activeId));
    this.ghostFill = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.ghostMat);
    this.ghostFill.visible = false;
    this.ghostFill.renderOrder = 998;
    scene.add(this.ghostFill);

    // 設置プレビューのふち（水色の枠＝どこに置くか分かりやすく）
    const targetMat = new THREE.LineBasicMaterial({ color: 0x49d6ff, transparent: true, opacity: 0.95 });
    this.targetBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)), targetMat);
    this.targetBox.visible = false;
    this.targetBox.renderOrder = 999;
    scene.add(this.targetBox);

    // 削除プレビュー：見ているのが「自分で置いたブロック」なら赤枠（消せる印）
    const removeMat = new THREE.LineBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.95 });
    this.removeBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04, 1.04, 1.04)), removeMat);
    this.removeBox.visible = false;
    this.removeBox.renderOrder = 999;
    scene.add(this.removeBox);
  }

  /** 観光地を切り替えるときに呼ぶ。差分(cells)は既に world へ適用済みのものを受け取る */
  setContext(spotId: string, field: Region | undefined, cells: EditCell[]): void {
    this.spotId = spotId;
    this.field = field ?? null;
    this.edits.clear();
    for (const c of cells) this.edits.set(BuildController.key(c.x, c.y, c.z), c);
  }

  /** パレットで選んだブロック。ゴーストの色もそのブロック色にする */
  setActiveBlock(id: number): void {
    this.activeId = id;
    this.ghostMat.color.copy(blockRegistry.getColor(id));
  }

  get hasField(): boolean {
    return this.field !== null;
  }

  /** 表示（編集モードに入ったとき） */
  show(): void {
    // 範囲枠は出さない（フィールド全体に置けるため）。プレビューは update で出す。
  }
  /** 非表示（編集モードを抜けたとき） */
  hide(): void {
    this.endPlace();
    this.ghostFill.visible = false;
    this.targetBox.visible = false;
    this.removeBox.visible = false;
  }

  /** 毎フレーム：中央カーソルが指すマスのプレビューを更新（設置＝色つきゴースト／削除＝赤枠） */
  update(dt = 1 / 60): void {
    this.updateEffects(dt);
    if (!this.field) {
      this.setGhost(false);
      this.removeBox.visible = false;
      return;
    }

    // 連続設置中は「次に積むマス」をゴーストで見せる（視線でブレない）
    if (this.holding && this.lastCell && this.stackDir) {
      const nx = this.lastCell.x + this.stackDir.x;
      const ny = this.lastCell.y + this.stackDir.y;
      const nz = this.lastCell.z + this.stackDir.z;
      this.removeBox.visible = false;
      if (this.canPlaceAt(nx, ny, nz)) {
        this.ghostFill.position.set(nx + 0.5, ny + 0.5, nz + 0.5);
        this.targetBox.position.set(nx + 0.5, ny + 0.5, nz + 0.5);
        this.setGhost(true);
      } else {
        this.setGhost(false);
      }
      return;
    }

    const hit = this.castCenter();
    if (!hit) {
      this.setGhost(false);
      this.removeBox.visible = false;
      return;
    }

    // 置けるマス（見ている面の手前）に色つきゴーストを表示
    const tx = hit.x + hit.nx;
    const ty = hit.y + hit.ny;
    const tz = hit.z + hit.nz;
    if (this.canPlaceAt(tx, ty, tz)) {
      this.ghostFill.position.set(tx + 0.5, ty + 0.5, tz + 0.5);
      this.targetBox.position.set(tx + 0.5, ty + 0.5, tz + 0.5);
      this.setGhost(true);
    } else {
      this.setGhost(false);
    }

    // 見ているブロックが「自分で置いた物」なら、消せる印として赤枠
    if (this.edits.has(BuildController.key(hit.x, hit.y, hit.z))) {
      this.removeBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      this.removeBox.visible = true;
    } else {
      this.removeBox.visible = false;
    }
  }

  private setGhost(on: boolean): void {
    this.ghostFill.visible = on;
    this.targetBox.visible = on;
  }

  /** ブロックを1つ置く（単発：タップ／Eキー）。中央カーソルの面の手前へ。 */
  place(): boolean {
    return this.freshPlace() !== null;
  }

  /**
   * 連続設置の「押し始め」。最初の1つを置き、その「向き（面の法線）」を覚える。
   * 例：床（上の面）を狙えば向き＝上 → 以降は上へ積んでいく。
   */
  startStack(): boolean {
    const r = this.freshPlace();
    if (!r) {
      this.endPlace();
      return false;
    }
    this.holding = true;
    this.lastCell = r.cell;
    this.stackDir = r.dir;
    return true;
  }

  /**
   * 連続設置の「続き」。最初に決めた向きへ1つずつ伸ばす（上に積む／横に並べる）。
   * 視線が横の面に当たってもブレないので、まっすぐ積み上げられる。
   */
  placeContinue(): boolean {
    if (!this.holding || !this.lastCell || !this.stackDir) return false;
    const x = this.lastCell.x + this.stackDir.x;
    const y = this.lastCell.y + this.stackDir.y;
    const z = this.lastCell.z + this.stackDir.z;
    if (!this.canPlaceAt(x, y, z)) return false; // その向きの先（上限・ふさがり）まで来たら止まる
    this.putBlock(x, y, z);
    this.lastCell = { x, y, z };
    return true;
  }

  /** 連続設置の終了（ボタンを離した）。次回はまた新しい向きで始める。 */
  endPlace(): void {
    this.holding = false;
    this.lastCell = null;
    this.stackDir = null;
  }

  /** タップした所（画面の位置。-1〜1）のブロックの面に、1つ置く */
  placeAt(ndcX: number, ndcY: number): boolean {
    return this.freshPlace(this.castScreen(ndcX, ndcY)) !== null;
  }

  /** 長おしした所（画面の位置。-1〜1）のブロックを消す。自分で置いた物だけ */
  removeAt(ndcX: number, ndcY: number): boolean {
    return this.removeHit(this.castScreen(ndcX, ndcY));
  }

  /** 見ている（またはタップした）面の手前に1つ置く。置けたらセルと向きを返す。 */
  private freshPlace(
    hit = this.castCenter(),
  ): { cell: { x: number; y: number; z: number }; dir: { x: number; y: number; z: number } } | null {
    if (!hit) return null;
    const cell = { x: hit.x + hit.nx, y: hit.y + hit.ny, z: hit.z + hit.nz };
    if (!this.canPlaceAt(cell.x, cell.y, cell.z)) return null;
    this.putBlock(cell.x, cell.y, cell.z);
    return { cell, dir: { x: hit.nx, y: hit.ny, z: hit.nz } };
  }

  /** そのマスに置けるか（フィールド内・高さ内・体に重ならない・空いている） */
  private canPlaceAt(x: number, y: number, z: number): boolean {
    return (
      this.inField(x, z) &&
      y >= 1 &&
      y <= MAX_BUILD_Y &&
      !this.overlapsPlayer(x, y, z) &&
      this.world.getBlock(x, y, z) === AIR
    );
  }

  /** 実際に置いて差分に記録・保存 */
  private putBlock(x: number, y: number, z: number): void {
    this.world.setBlock(x, y, z, this.activeId);
    this.edits.set(BuildController.key(x, y, z), { x, y, z, id: this.activeId });
    this.spawnPop(x, y, z, this.activeId);
    this.persist();
  }

  /** 見ているブロックを消す。自分で置いた物だけ消せる（元の建物・地面は壊せない）。 */
  remove(): boolean {
    return this.removeHit(this.castCenter());
  }

  private removeHit(hit: ReturnType<BuildController['castCenter']>): boolean {
    if (!hit) return false;
    const key = BuildController.key(hit.x, hit.y, hit.z);
    const cell = this.edits.get(key);
    if (!cell) return false; // 自分で置いた物以外は壊せない
    this.world.setBlock(hit.x, hit.y, hit.z, AIR);
    this.edits.delete(key);
    this.spawnChips(hit.x, hit.y, hit.z, cell.id);
    this.persist();
    return true;
  }

  // ===== 置いた・消したときの動き =====

  /** 置いたブロックが、少し大きく光って出てきて、すっと元の大きさになる */
  private spawnPop(x: number, y: number, z: number, id: number): void {
    let pop = this.pops.find((p) => p.life <= 0);
    if (!pop) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
      pop = { mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat), life: 0 };
      pop.mesh.renderOrder = 997;
      this.scene.add(pop.mesh);
      this.pops.push(pop);
    }
    const mat = pop.mesh.material as THREE.MeshBasicMaterial;
    mat.color.copy(blockRegistry.getColor(id)).lerp(new THREE.Color(0xffffff), 0.45);
    pop.mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    pop.mesh.visible = true;
    pop.life = 0.22;
  }

  /** 消したブロックが、小さなかけらになって散り、落ちて消える */
  private spawnChips(x: number, y: number, z: number, id: number): void {
    const color = blockRegistry.getColor(id);
    for (let i = 0; i < 8; i++) {
      let chip = this.chips.find((c) => c.life <= 0);
      if (!chip) {
        if (this.chips.length >= 48) break; // かけらの数には上限
        chip = {
          mesh: new THREE.Mesh(this.chipGeo, new THREE.MeshLambertMaterial()),
          vel: new THREE.Vector3(),
          life: 0,
        };
        this.scene.add(chip.mesh);
        this.chips.push(chip);
      }
      (chip.mesh.material as THREE.MeshLambertMaterial).color.copy(color);
      const ox = ((i & 1) - 0.5) * 0.5;
      const oy = (((i >> 1) & 1) - 0.5) * 0.5;
      const oz = (((i >> 2) & 1) - 0.5) * 0.5;
      chip.mesh.position.set(x + 0.5 + ox, y + 0.5 + oy, z + 0.5 + oz);
      chip.vel.set(ox * 5, 2.5 + oy * 3, oz * 5);
      chip.mesh.scale.setScalar(1);
      chip.mesh.visible = true;
      chip.life = 0.6;
    }
  }

  private updateEffects(dt: number): void {
    for (const p of this.pops) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const t = Math.max(0, p.life / 0.22); // 1 → 0
      p.mesh.scale.setScalar(1 + 0.18 * t);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * t;
      if (p.life <= 0) p.mesh.visible = false;
    }
    for (const c of this.chips) {
      if (c.life <= 0) continue;
      c.life -= dt;
      c.vel.y -= 18 * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.scale.setScalar(Math.max(0.01, c.life / 0.6));
      if (c.life <= 0) c.mesh.visible = false;
    }
  }

  // ===== 内部 =====
  private castCenter() {
    this.camera.getWorldDirection(this.dir);
    const hit = VoxelRaycaster.cast(this.world, this.camera.position, this.dir, REACH);
    return hit.hit ? hit : null;
  }

  /** 画面の位置（-1〜1）から、その先のブロックを探す */
  private castScreen(ndcX: number, ndcY: number) {
    this.ndc.set(ndcX, ndcY);
    this.camera.updateMatrixWorld(); // カメラを動かした直後でも、今の向きで正しく探せるように
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = VoxelRaycaster.cast(this.world, this.ray.ray.origin, this.ray.ray.direction, REACH);
    return hit.hit ? hit : null;
  }

  /** その x/z が歩ける範囲（field）内か（建築できる範囲＝歩ける範囲と同じ） */
  private inField(x: number, z: number): boolean {
    const f = this.field;
    if (!f) return false;
    return x >= f.min.x && x <= f.max.x && z >= f.min.z && z <= f.max.z;
  }

  /** 置こうとするマスがプレイヤーのAABBと重なるか（重なると埋まってしまう） */
  private overlapsPlayer(x: number, y: number, z: number): boolean {
    const pos = this.player.position;
    const hw = 0.3;
    const overlapX = x + 1 > pos.x - hw && x < pos.x + hw;
    const overlapZ = z + 1 > pos.z - hw && z < pos.z + hw;
    const overlapY = y + 1 > pos.y && y < pos.y + 1.8;
    return overlapX && overlapY && overlapZ;
  }

  private persist(): void {
    EditStore.save(this.spotId, [...this.edits.values()]);
    this.onChange?.();
  }

  private static key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }
}
