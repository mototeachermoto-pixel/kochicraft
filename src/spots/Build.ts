import { blockRegistry } from '@/world/BlockRegistry';

export type Cell = { x: number; y: number; z: number; id: number };

/**
 * 観光地の景観をボクセルで組み立てるための補助ツール。
 * cells に書き込み、最後に world.setBlocksBatch(cells) で一括反映する。
 */
export class Build {
  readonly cells: Cell[] = [];

  /** ブロックkey → id */
  id(key: string): number {
    return blockRegistry.getByKey(key)!.id;
  }

  /** 1ブロック設置 */
  set(x: number, y: number, z: number, id: number): void {
    this.cells.push({ x: Math.round(x), y: Math.round(y), z: Math.round(z), id });
  }

  /** 直方体を中まで埋める（min〜max 包含） */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, id: number): void {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) this.set(x, y, z, id);
  }

  /** 水平な板（y一定、x0..x1 × z0..z1） */
  slab(x0: number, z0: number, x1: number, z1: number, y: number, id: number): void {
    this.box(x0, y, z0, x1, y, z1, id);
  }

  /** 縦の柱 */
  pillar(x: number, z: number, y0: number, y1: number, id: number): void {
    for (let y = y0; y <= y1; y++) this.set(x, y, z, id);
  }

  /** 球（半径r以内）。fillで条件を絞れる */
  sphere(cx: number, cy: number, cz: number, r: number, id: number): void {
    const r2 = (r + 0.4) * (r + 0.4);
    for (let dy = -r; dy <= r; dy++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++)
          if (dx * dx + dy * dy + dz * dz <= r2) this.set(cx + dx, cy + dy, cz + dz, id);
  }

  /** 円板（水平・半径r） */
  disc(cx: number, cz: number, y: number, r: number, id: number): void {
    const r2 = (r + 0.4) * (r + 0.4);
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++)
        if (dx * dx + dz * dz <= r2) this.set(cx + dx, y, cz + dz, id);
  }

  /** 円すいの葉（下が広く上が細い） */
  coneFoliage(cx: number, baseY: number, cz: number, layers: number, startR: number, id: number): void {
    for (let i = 0; i < layers; i++) {
      const r = Math.max(0, startR - Math.round((i * startR) / layers));
      this.disc(cx, cz, baseY + i, r, id);
    }
    this.set(cx, baseY + layers, cz, id);
  }

  /** 松の木（幹の高さ・葉のボリュームを指定可） */
  pine(x: number, groundY: number, z: number, trunkH = 4, foliageLayers = 4, startR = 2): void {
    const wood = this.id('wood');
    const leaves = this.id('leaves');
    for (let i = 1; i <= trunkH; i++) this.set(x, groundY + i, z, wood);
    this.coneFoliage(x, groundY + trunkH - 1, z, foliageLayers, startR, leaves);
  }

  /** 丸い丘・岩（崖や岩礁）。capId を指定すると頂上だけ別ブロック（草など） */
  mound(
    cx: number,
    cz: number,
    baseY: number,
    peakY: number,
    baseR: number,
    id: number,
    capId?: number,
  ): void {
    const h = Math.max(1, peakY - baseY);
    for (let y = baseY; y <= peakY; y++) {
      const t = (y - baseY) / h;
      const r = Math.max(0, Math.round(baseR * (1 - t * 0.8)));
      const useId = capId !== undefined && y === peakY ? capId : id;
      this.disc(cx, cz, y, r, useId);
    }
  }
}
