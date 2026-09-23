import {
  SEA_LEVEL,
  WORLD_DEPTH,
  WORLD_HEIGHT,
  WORLD_SEED,
  WORLD_WIDTH,
} from '@/config/constants';
import { blockRegistry } from './BlockRegistry';

/**
 * 地形へボクセルを書き込むための最小インターフェース。
 * World がこれを実装し、生成器はワールド実装に依存しすぎない。
 */
export interface VoxelWriter {
  setRaw(gx: number, gy: number, gz: number, id: number): void;
  getRaw(gx: number, gy: number, gz: number): number;
}

const B = blockRegistry;
const ID = {
  grass: B.getByKey('grass')!.id,
  dirt: B.getByKey('dirt')!.id,
  stone: B.getByKey('stone')!.id,
  sand: B.getByKey('sand')!.id,
  water: B.getByKey('water')!.id,
  wood: B.getByKey('wood')!.id,
  leaves: B.getByKey('leaves')!.id,
  flower: B.getByKey('flower')!.id,
};

/** 32bit 疑似乱数（決定論的・シードから再現可能） */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 5次のスムーズ補間（Perlin の fade 関数） */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * バリューノイズ（格子点の値を補間する軽量ノイズ）。
 * 地形の起伏をなめらかに作るために使用する。
 */
class ValueNoise {
  private perm: Uint8Array;

  constructor(seed: number) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher–Yates シャッフル
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    // 512に拡張してラップ処理を省略
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  /** 格子点 (xi,yi) の擬似乱数値 [0,1) */
  private hash(xi: number, yi: number): number {
    return this.perm[(this.perm[xi & 255] + yi) & 511] / 255;
  }

  /** 2Dノイズ [0,1] */
  noise2D(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = fade(xf);
    const v = fade(yf);
    const aa = this.hash(xi, yi);
    const ba = this.hash(xi + 1, yi);
    const ab = this.hash(xi, yi + 1);
    const bb = this.hash(xi + 1, yi + 1);
    return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
  }

  /** 複数オクターブを重ねたフラクタルノイズ [0,1] */
  fractal(x: number, y: number, octaves: number, persistence: number): number {
    let total = 0;
    let amp = 1;
    let freq = 1;
    let max = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * freq, y * freq) * amp;
      max += amp;
      amp *= persistence;
      freq *= 2;
    }
    return total / max;
  }
}

/**
 * 地形生成器。
 * 空・海・山・川・木・草・岩 の要素を備えた高知らしい自然地形を生成する。
 */
export class TerrainGenerator {
  private heightNoise: ValueNoise;
  private mountainNoise: ValueNoise;
  private decoRand: () => number;

  constructor(seed: number = WORLD_SEED) {
    this.heightNoise = new ValueNoise(seed);
    this.mountainNoise = new ValueNoise(seed + 1013);
    this.decoRand = mulberry32(seed + 7777);
  }

  /** 指定列 (gx,gz) の地表高さを返す */
  private columnHeight(gx: number, gz: number): number {
    // ゆるやかな丘
    const base = this.heightNoise.fractal(gx * 0.045, gz * 0.045, 4, 0.5); // 0..1
    let h = SEA_LEVEL + Math.floor(base * 12);

    // 山（一部の領域だけ高く盛り上げる）
    const m = this.mountainNoise.fractal(gx * 0.02, gz * 0.02, 3, 0.5); // 0..1
    if (m > 0.62) {
      const t = (m - 0.62) / 0.38; // 0..1
      h += Math.floor(t * t * 16);
    }

    // 川（X方向に蛇行する帯を海面下まで掘る）
    const riverCenter = WORLD_DEPTH / 2 + Math.sin(gx * 0.09) * 9 + Math.cos(gx * 0.03) * 5;
    const distRiver = Math.abs(gz - riverCenter);
    if (distRiver < 4.5) {
      const carve = SEA_LEVEL - 2;
      h = Math.min(h, carve);
    } else if (distRiver < 7) {
      // 川岸をなだらかに
      h = Math.min(h, SEA_LEVEL + 1);
    }

    return Math.max(1, Math.min(WORLD_HEIGHT - 2, h));
  }

  /** 地表に置く最上段ブロックを決める */
  private topBlock(h: number): number {
    if (h <= SEA_LEVEL + 1) return ID.sand; // 浜辺
    if (h >= SEA_LEVEL + 18) return ID.stone; // 山頂
    return ID.grass;
  }

  /** ワールド全体を生成して writer に書き込む */
  generate(writer: VoxelWriter): void {
    // --- 地形・海 ---
    for (let gx = 0; gx < WORLD_WIDTH; gx++) {
      for (let gz = 0; gz < WORLD_DEPTH; gz++) {
        const h = this.columnHeight(gx, gz);
        const top = this.topBlock(h);

        for (let y = 0; y <= h; y++) {
          let id: number;
          if (y === h) id = top;
          else if (y >= h - 3) id = ID.dirt;
          else id = ID.stone;
          writer.setRaw(gx, y, gz, id);
        }

        // 海・川の水で満たす
        for (let y = h + 1; y <= SEA_LEVEL; y++) {
          writer.setRaw(gx, y, gz, ID.water);
        }
      }
    }

    // --- 装飾（木・花）を地表に配置 ---
    this.decorate(writer);
  }

  /** 木や花を地表に散らす（地形生成後に実行） */
  private decorate(writer: VoxelWriter): void {
    for (let gx = 2; gx < WORLD_WIDTH - 2; gx++) {
      for (let gz = 2; gz < WORLD_DEPTH - 2; gz++) {
        const h = this.columnHeight(gx, gz);
        const top = writer.getRaw(gx, h, gz);
        if (top !== ID.grass) continue;
        if (h <= SEA_LEVEL) continue;

        const r = this.decoRand();
        if (r < 0.018) {
          this.placeTree(writer, gx, h, gz);
        } else if (r < 0.05) {
          writer.setRaw(gx, h + 1, gz, ID.flower);
        }
      }
    }
  }

  /** 1本の木（幹＋葉）を配置 */
  private placeTree(writer: VoxelWriter, gx: number, groundH: number, gz: number): void {
    const trunkH = 4 + Math.floor(this.decoRand() * 2);
    for (let i = 1; i <= trunkH; i++) {
      writer.setRaw(gx, groundH + i, gz, ID.wood);
    }
    const crownY = groundH + trunkH;
    for (let dy = -1; dy <= 1; dy++) {
      const radius = dy === 1 ? 1 : 2;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx === 0 && dz === 0 && dy < 1) continue; // 幹の位置は空ける
          if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue; // 角を落とす
          const x = gx + dx;
          const y = crownY + dy;
          const z = gz + dz;
          if (writer.getRaw(x, y, z) === 0) {
            writer.setRaw(x, y, z, ID.leaves);
          }
        }
      }
    }
  }
}
