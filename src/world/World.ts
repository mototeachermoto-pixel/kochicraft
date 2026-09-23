import * as THREE from 'three';
import {
  CHUNK_SIZE,
  SEA_LEVEL,
  WORLD_CHUNKS_X,
  WORLD_CHUNKS_Z,
  WORLD_DEPTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@/config/constants';
import type { ChunkSave, Vec3 } from '@/types';
import { AIR, blockRegistry } from './BlockRegistry';
import { Chunk } from './Chunk';
import { ChunkMesher } from './ChunkMesher';
import { TerrainGenerator, type VoxelWriter } from './TerrainGenerator';
import { rleDecodeInto, rleEncode } from './VoxelData';

/**
 * ワールド全体の管理。
 * - チャンク群の保持とグローバル座標でのブロックアクセス
 * - 地形生成（TerrainGenerator）
 * - 描画メッシュの生成と Three.js グループへの追加
 *
 * VoxelWriter を実装し、地形生成器からの書き込みを受ける。
 */
export class World implements VoxelWriter {
  /** 描画オブジェクトをまとめるグループ（SceneManager に追加される） */
  readonly group = new THREE.Group();

  /** プレイヤーの初期スポーン位置（足元） */
  spawnPoint: Vec3 = { x: WORLD_WIDTH / 2, y: SEA_LEVEL + 5, z: WORLD_DEPTH / 2 };

  private chunks = new Map<string, Chunk>();

  /** 不透明・半透明それぞれの共有マテリアル */
  private readonly opaqueMaterial: THREE.Material;
  private readonly transparentMaterial: THREE.Material;

  constructor() {
    this.group.name = 'WorldGroup';

    // 頂点カラーを使うため vertexColors: true。テクスチャ無しでも陰影が出る。
    this.opaqueMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.transparentMaterial = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false, // 半透明の重なりを自然に
    });

    // 空のチャンクを並べる
    for (let cx = 0; cx < WORLD_CHUNKS_X; cx++) {
      for (let cz = 0; cz < WORLD_CHUNKS_Z; cz++) {
        this.chunks.set(this.key(cx, cz), new Chunk(cx, cz));
      }
    }
  }

  // ===== チャンクアクセス =====
  private key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(this.key(cx, cz));
  }

  // ===== VoxelWriter 実装（地形生成用・メッシュ更新なし） =====
  setRaw(gx: number, gy: number, gz: number, id: number): void {
    if (gy < 0 || gy >= WORLD_HEIGHT) return;
    const cx = Math.floor(gx / CHUNK_SIZE);
    const cz = Math.floor(gz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    chunk.setLocal(gx - chunk.originX, gy, gz - chunk.originZ, id);
  }

  getRaw(gx: number, gy: number, gz: number): number {
    return this.getBlock(gx, gy, gz);
  }

  // ===== グローバル座標のブロックアクセス =====
  /**
   * グローバル座標のブロックIDを取得。
   * - 床下（y<0）は石扱いにして地面の底面を描かない
   * - 上空・ワールド外（水平）は空気
   */
  getBlock = (gx: number, gy: number, gz: number): number => {
    if (gy < 0) return blockRegistry.getByKey('stone')!.id;
    if (gy >= WORLD_HEIGHT) return AIR;
    if (gx < 0 || gx >= WORLD_WIDTH || gz < 0 || gz >= WORLD_DEPTH) return AIR;
    const cx = Math.floor(gx / CHUNK_SIZE);
    const cz = Math.floor(gz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return AIR;
    return chunk.getLocal(gx - chunk.originX, gy, gz - chunk.originZ);
  };

  /** そのグローバル座標が衝突判定を持つか（物理で使用） */
  isSolid(gx: number, gy: number, gz: number): boolean {
    return blockRegistry.isSolid(this.getBlock(gx, gy, gz));
  }

  /** ブロックを1つ変更（一括編集APIへの委譲） */
  setBlock(gx: number, gy: number, gz: number, id: number): boolean {
    return this.setBlocksBatch([{ x: gx, y: gy, z: gz, id }]).length > 0;
  }

  /**
   * 複数ブロックをまとめて変更し、影響するチャンクを「最後に一度だけ」再メッシュする。
   * ブラシ・塗りつぶし・貼り付け・Undo/Redo など大量セル変更でも高速。
   * @returns 実際に変化したセルの一覧（prev/next 付き＝履歴に積める形）
   */
  setBlocksBatch(
    cells: { x: number; y: number; z: number; id: number }[],
  ): { x: number; y: number; z: number; prev: number; next: number }[] {
    const changes: { x: number; y: number; z: number; prev: number; next: number }[] = [];
    const affected = new Set<string>();

    for (const c of cells) {
      if (c.y < 0 || c.y >= WORLD_HEIGHT) continue;
      if (c.x < 0 || c.x >= WORLD_WIDTH || c.z < 0 || c.z >= WORLD_DEPTH) continue;

      const cx = Math.floor(c.x / CHUNK_SIZE);
      const cz = Math.floor(c.z / CHUNK_SIZE);
      const chunk = this.getChunk(cx, cz);
      if (!chunk) continue;

      const lx = c.x - chunk.originX;
      const lz = c.z - chunk.originZ;
      const prev = chunk.getLocal(lx, c.y, lz);
      if (prev === c.id) continue;

      chunk.setLocal(lx, c.y, lz, c.id);
      changes.push({ x: c.x, y: c.y, z: c.z, prev, next: c.id });

      affected.add(this.key(cx, cz));
      if (lx === 0) affected.add(this.key(cx - 1, cz));
      if (lx === CHUNK_SIZE - 1) affected.add(this.key(cx + 1, cz));
      if (lz === 0) affected.add(this.key(cx, cz - 1));
      if (lz === CHUNK_SIZE - 1) affected.add(this.key(cx, cz + 1));
    }

    for (const k of affected) {
      const chunk = this.chunks.get(k);
      if (chunk) this.buildChunkMesh(chunk);
    }
    return changes;
  }

  // ===== 保存・読込 =====
  /** 全チャンクをRLE圧縮して書き出す */
  exportChunks(): ChunkSave[] {
    const out: ChunkSave[] = [];
    for (const chunk of this.chunks.values()) {
      out.push({ cx: chunk.cx, cz: chunk.cz, rle: rleEncode(chunk.voxels) });
    }
    return out;
  }

  /** 保存データからボクセルを復元し、全チャンクを再メッシュする */
  importChunks(chunks: ChunkSave[]): void {
    for (const cs of chunks) {
      const chunk = this.getChunk(cs.cx, cs.cz);
      if (!chunk) continue;
      rleDecodeInto(cs.rle, chunk.voxels);
    }
    for (const chunk of this.chunks.values()) this.buildChunkMesh(chunk);
  }

  /** スポーン地点を設定 */
  setSpawn(p: Vec3): void {
    this.spawnPoint = { ...p };
  }

  /** すべてのボクセルを空気にして、メッシュも空にする（観光地ワールドの切替用） */
  clearAll(): void {
    for (const chunk of this.chunks.values()) {
      chunk.voxels.fill(AIR);
      chunk.dirty = true;
    }
    for (const chunk of this.chunks.values()) this.buildChunkMesh(chunk);
  }

  /** その列の最上段の固体ブロックの高さ（建築物の整地などに使用。無ければ海面） */
  getSurfaceY(gx: number, gz: number): number {
    const y = this.surfaceHeight(gx, gz);
    return y >= 0 ? y : SEA_LEVEL;
  }

  // ===== 生成 =====
  /** 地形を生成し、全チャンクのメッシュを構築する */
  generate(): void {
    const generator = new TerrainGenerator();
    generator.generate(this);
    this.rebuildAllMeshes();
    this.computeSpawn();
  }

  /** dirty なチャンクのメッシュを作り直す */
  private rebuildAllMeshes(): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.dirty) this.buildChunkMesh(chunk);
    }
  }

  /** 1チャンクのメッシュを生成して group に登録する */
  private buildChunkMesh(chunk: Chunk): void {
    chunk.disposeMeshes();
    const { opaque, transparent } = ChunkMesher.build(chunk, this.getBlock);

    if (opaque) {
      const mesh = new THREE.Mesh(opaque, this.opaqueMaterial);
      mesh.position.set(chunk.originX, 0, chunk.originZ);
      mesh.name = `chunk-opaque-${chunk.cx}-${chunk.cz}`;
      this.group.add(mesh);
      chunk.opaqueMesh = mesh;
    }
    if (transparent) {
      const mesh = new THREE.Mesh(transparent, this.transparentMaterial);
      mesh.position.set(chunk.originX, 0, chunk.originZ);
      mesh.name = `chunk-transparent-${chunk.cx}-${chunk.cz}`;
      this.group.add(mesh);
      chunk.transparentMesh = mesh;
    }
    chunk.dirty = false;
  }

  /** ワールド中心付近で立てる地面を探してスポーン地点を決める */
  private computeSpawn(): void {
    const cx = Math.floor(WORLD_WIDTH / 2);
    const cz = Math.floor(WORLD_DEPTH / 2);
    // 中心から渦巻き状に探索し、最初に見つかった陸地の上に立たせる
    for (let r = 0; r < Math.max(WORLD_WIDTH, WORLD_DEPTH); r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = cx + dx;
          const z = cz + dz;
          if (x < 0 || x >= WORLD_WIDTH || z < 0 || z >= WORLD_DEPTH) continue;
          const top = this.surfaceHeight(x, z);
          if (top > SEA_LEVEL) {
            this.spawnPoint = { x: x + 0.5, y: top + 1, z: z + 0.5 };
            return;
          }
        }
      }
    }
  }

  /** その列の最上段の固体ブロックの高さ（無ければ -1） */
  private surfaceHeight(gx: number, gz: number): number {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const id = this.getBlock(gx, y, gz);
      if (id !== AIR && blockRegistry.isSolid(id)) return y;
    }
    return -1;
  }
}
