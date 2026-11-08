import * as THREE from 'three';
import type { Region } from '@/spots/SpotDefinition';
import { AIR, blockRegistry } from './BlockRegistry';
import type { World } from './World';
import { applyBlockStyles, styleOf } from './blockStyles';

/**
 * 観光地のまわりの景色（2026-11-08 追加）。
 *
 * これまでは、観光地の外が灰色の床と空だけで、「宙にういた模型」に見えていた。
 * そこで、観光地のふち（歩ける範囲の外周）の地面・海・川・道を、そのまま外へずっと続けて見せ、
 * 陸の側には遠くに低い山を置く。遠くは霧でかすむので、どこまでも土地が続いているように見える。
 *
 * - 外の景色は「絵だけ」（ブロックではない）。歩けない・置けない・保存されない。
 * - ふちの数マスだけ、内側より低くなっている所（土台の石が見えている所）を、内側と同じ地面で埋める（padEdges）。
 *   こうしないと、外の地面との間に細いみぞができるため。
 */

/** 地面とみなすブロック（木の葉や建物の屋根を「地面の高さ」とまちがえないため） */
const GROUND_KEYS = ['grass', 'dirt', 'stone', 'sand', 'water', 'road', 'stonewall', 'turf', 'brick', 'bridge'];

/** 外へのばす長さ（霧で見えなくなるところまで） */
const REACH = 320;
/** 内側の「基準の列」までの距離（ふちから何マス内側の地面に合わせるか） */
const INSET = 3;

type Side = 'w' | 'e' | 'n' | 's';

function groundIds(): Set<number> {
  const s = new Set<number>();
  for (const k of GROUND_KEYS) {
    const id = blockRegistry.getByKey(k)?.id;
    if (id !== undefined) s.add(id);
  }
  return s;
}

/** その列のいちばん上の「地面」のブロック（木や建物は飛ばす）。無ければ null */
function groundTop(world: World, x: number, z: number, ground: Set<number>): { y: number; id: number } | null {
  for (let y = 39; y >= 0; y--) {
    const id = world.getBlock(x, y, z);
    if (id !== AIR && ground.has(id)) return { y, id };
  }
  return null;
}

/** 小さな乱数（観光地ごとに同じ景色になるよう、名前から種を作る） */
function rng(seedText: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * ふちの数マスで、内側の地面より低い所を、内側の列と同じブロックで埋める。
 * （例：桂浜の砂浜のふちに、土台の灰色の石が2マス見えていた所）
 * 川や海のように、内側も同じ高さの所は何もしない。
 */
export function padEdges(world: World, field: Region): void {
  const ground = groundIds();
  const { min, max } = field;
  const cells: { x: number; y: number; z: number; id: number }[] = [];
  const fill = (cx: number, cz: number, rx: number, rz: number): void => {
    const c = groundTop(world, cx, cz, ground);
    const r = groundTop(world, rx, rz, ground);
    if (!r) return;
    const from = c ? c.y + 1 : 0;
    for (let y = from; y <= r.y; y++) {
      if (world.getBlock(cx, y, cz) !== AIR) continue;
      cells.push({ x: cx, y, z: cz, id: world.getBlock(rx, y, rz) || r.id });
    }
  };
  // 左右のふち（x の両はし）
  for (let z = min.z; z <= max.z; z++) {
    for (let d = 0; d < INSET; d++) {
      fill(min.x + d, z, min.x + INSET, z);
      fill(max.x - d, z, max.x - INSET, z);
    }
  }
  if (cells.length) world.setBlocksBatch(cells.splice(0));
  // 手前・奥のふち（z の両はし）。左右を埋めたあとで調べる（角もそろう）
  for (let x = min.x; x <= max.x; x++) {
    for (let d = 0; d < INSET; d++) {
      fill(x, min.z + d, x, min.z + INSET);
      fill(x, max.z - d, x, max.z - INSET);
    }
  }
  if (cells.length) world.setBlocksBatch(cells);
}

/** 色を少し変えたもの（面の向きの明るさ用） */
function shade(c: THREE.Color, k: number): THREE.Color {
  return c.clone().multiplyScalar(k);
}

export class Surroundings {
  readonly group = new THREE.Group();
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true });

  constructor() {
    this.group.name = 'Surroundings';
    // 観光地のブロックと同じ模様をつける（境目が目立たないように）
    applyBlockStyles(this.material);
  }

  /** いまの観光地に合わせて作り直す */
  build(world: World, field: Region, seed: string): void {
    this.clear();
    const ground = groundIds();
    const waterId = blockRegistry.getByKey('water')?.id ?? -1;
    const sandColor = blockRegistry.getColor(blockRegistry.getByKey('sand')?.id ?? 4);
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const nrm: number[] = [];
    const sty: number[] = [];
    /** いまかいている面の模様 */
    let curStyle = 0;

    /** その地面の色（水は、透けて見える砂の底とまぜた色にする） */
    const colorOf = (id: number): THREE.Color => {
      const c = blockRegistry.getColor(id).clone();
      if (id === waterId) c.lerp(sandColor, 0.12);
      return c;
    };
    const quad = (p: number[][], n: number[], c: THREE.Color): void => {
      const b = pos.length / 3;
      for (const v of p) {
        pos.push(v[0], v[1], v[2]);
        nrm.push(n[0], n[1], n[2]);
        col.push(c.r, c.g, c.b);
        sty.push(curStyle);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    /** 上を向いた四角（x0<x1, z0<z1） */
    const top = (x0: number, z0: number, x1: number, z1: number, y: number, c: THREE.Color): void =>
      quad([[x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]], [0, 1, 0], c);
    /** 高さのちがう地面のあいだの、たての壁（両面にしておく） */
    const wall = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, c: THREE.Color): void => {
      if (y0 === y1) return;
      const lo = Math.min(y0, y1);
      const hi = Math.max(y0, y1);
      const n = x0 === x1 ? [1, 0, 0] : [0, 0, 1];
      quad([[x0, lo, z0], [x1, lo, z1], [x1, hi, z1], [x0, hi, z0]], n, c);
      quad([[x0, lo, z0], [x0, hi, z0], [x1, hi, z1], [x1, lo, z1]], [-n[0], 0, -n[2]], c);
    };

    const { min, max } = field;
    const x0 = min.x;
    const x1 = max.x + 1;
    const z0 = min.z;
    const z1 = max.z + 1;
    const surf = (x: number, z: number): { h: number; id: number } => {
      const g = groundTop(world, x, z, ground);
      return g ? { h: g.y + 1, id: g.id } : { h: 10, id: ground.values().next().value ?? 1 };
    };

    // 各辺ごとに「いちばん多い地面」を調べ、その地面を外へ平らに広げる。
    // （1列ずつのばすと、ふちにある岩山や小石の色まで外へ長くのびて、変な形になったため）
    const grassId = blockRegistry.getByKey('grass')?.id ?? 1;
    const natural = new Set(['grass', 'sand', 'dirt', 'turf'].map((k) => blockRegistry.getByKey(k)?.id ?? -1));
    type SideInfo = { side: Side; water: boolean; h: number; id: number; cells: { h: number; id: number }[] };
    const sideInfo = (side: Side): SideInfo => {
      const cells: { h: number; id: number }[] = [];
      const n = side === 'w' || side === 'e' ? max.z - min.z + 1 : max.x - min.x + 1;
      for (let k = 0; k < n; k++) {
        const x = side === 'w' ? min.x + INSET : side === 'e' ? max.x - INSET : min.x + k;
        const z = side === 'n' ? min.z + INSET : side === 's' ? max.z - INSET : min.z + k;
        cells.push(surf(x, z));
      }
      const water = cells.filter((c) => c.id === waterId).length > cells.length * 0.4;
      // いちばん多い種類と、その種類の高さのまん中の値
      const count = new Map<number, number>();
      // 陸の側は、草・砂・土・芝だけから選ぶ（道や石垣が外へ広い板のように広がらないように）
      for (const c of cells) {
        if (water ? c.id !== waterId : !natural.has(c.id)) continue;
        count.set(c.id, (count.get(c.id) ?? 0) + 1);
      }
      let id = water ? waterId : grassId;
      let best = -1;
      for (const [k, v] of count) if (v > best) [id, best] = [k, v];
      let hs = cells.filter((c) => c.id === id).map((c) => c.h);
      if (hs.length === 0) hs = cells.map((c) => c.h);
      hs.sort((p, q) => p - q);
      return { side, water, h: hs[hs.length >> 1], id, cells };
    };
    const sides = (['w', 'e', 'n', 's'] as Side[]).map(sideInfo);
    // 陸の側は、すべての辺で同じ地面・同じ高さにそろえる（辺ごとにちがうと、外に段や色のちがう帯ができるため）
    {
      const all = sides.filter((v) => !v.water).flatMap((v) => v.cells.filter((c) => natural.has(c.id)));
      if (all.length) {
        const cnt = new Map<number, number>();
        for (const c of all) cnt.set(c.id, (cnt.get(c.id) ?? 0) + 1);
        const gid = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];
        const hs = all.filter((c) => c.id === gid).map((c) => c.h).sort((p, q) => p - q);
        for (const v of sides) if (!v.water) [v.id, v.h] = [gid, hs[hs.length >> 1]];
      }
    }
    const S = Object.fromEntries(sides.map((v) => [v.side, v])) as Record<Side, SideInfo>;

    // 海：海の側が1つでもあれば、その水面の高さで全体に広げる（陸の地面がその上にのる）
    const sea = sides.find((v) => v.water);
    curStyle = styleOf(waterId);
    if (sea) top(x0 - REACH, z0 - REACH, x1 + REACH, z1 + REACH, sea.h - 0.05, colorOf(waterId));
    // 陸：陸の側ごとに、辺の外へ平らな地面。となりも陸なら、角までのばす
    const land = (v: SideInfo): boolean => !v.water;
    for (const v of sides) {
      if (v.water) continue;
      const c = colorOf(v.id);
      curStyle = styleOf(v.id);
      const ext = (o: Side): number => (land(S[o]) ? REACH : 0);
      if (v.side === 'w') top(x0 - REACH, z0 - ext('n'), x0, z1 + ext('s'), v.h, c);
      if (v.side === 'e') top(x1, z0 - ext('n'), x1 + REACH, z1 + ext('s'), v.h, c);
      if (v.side === 'n') top(x0, z0 - REACH, x1, z0, v.h, c);
      if (v.side === 's') top(x0, z1, x1, z1 + REACH, v.h, c);
      // 海と陸の境目（陸の地面のふち）に、砂浜や崖のような壁を立てる
      if (sea) {
        const wc = shade(c, 0.78);
        if (v.side === 'w') {
          if (!land(S.n)) wall(x0 - REACH, z0, x0, z0, sea.h, v.h, wc);
          if (!land(S.s)) wall(x0 - REACH, z1, x0, z1, sea.h, v.h, wc);
        }
        if (v.side === 'e') {
          if (!land(S.n)) wall(x1, z0, x1 + REACH, z0, sea.h, v.h, wc);
          if (!land(S.s)) wall(x1, z1, x1 + REACH, z1, sea.h, v.h, wc);
        }
        if (v.side === 'n') {
          if (!land(S.w)) wall(x0, z0 - REACH, x0, z0, sea.h, v.h, wc);
          if (!land(S.e)) wall(x1, z0 - REACH, x1, z0, sea.h, v.h, wc);
        }
        if (v.side === 's') {
          if (!land(S.w)) wall(x0, z1, x0, z1 + REACH, sea.h, v.h, wc);
          if (!land(S.e)) wall(x1, z1, x1, z1 + REACH, sea.h, v.h, wc);
        }
      }
    }
    // 陸どうしの角で高さがちがうときの壁（角の地面は左右の辺のもの。手前・奥の辺との境目に立てる）
    for (const v of [S.n, S.s]) {
      if (v.water) continue;
      const ze = v.side === 'n' ? z0 : z1;
      const zr = v.side === 'n' ? z0 - REACH : z1 + REACH;
      for (const o of [S.w, S.e]) {
        if (o.water) continue;
        const xe = o.side === 'w' ? x0 : x1;
        wall(xe, Math.min(ze, zr), xe, Math.max(ze, zr), v.h, o.h, shade(colorOf(v.h > o.h ? v.id : o.id), 0.78));
      }
    }

    // 道と川：陸の側のふちを横切る道・川は、その幅のまま外へ続ける（道はまっすぐのび、川は流れていく）
    const roadId = blockRegistry.getByKey('road')?.id ?? -1;
    for (const v of sides) {
      if (v.water) continue;
      const edge: { h: number; id: number }[] = [];
      const n = v.side === 'w' || v.side === 'e' ? max.z - min.z + 1 : max.x - min.x + 1;
      for (let k = 0; k < n; k++) {
        const x = v.side === 'w' ? min.x : v.side === 'e' ? max.x : min.x + k;
        const z = v.side === 'n' ? min.z : v.side === 's' ? max.z : min.z + k;
        edge.push(surf(x, z));
      }
      let i = 0;
      while (i < n) {
        const id = edge[i].id;
        if (id !== roadId && id !== waterId) {
          i++;
          continue;
        }
        let j = i;
        while (j + 1 < n && edge[j + 1].id === id) j++;
        const len = j - i + 1;
        if (len <= 14) {
          const hs = edge.slice(i, j + 1).map((c) => c.h).sort((p, q) => p - q);
          const h = hs[hs.length >> 1] + (id === roadId ? 0.01 : 0);
          const a = (v.side === 'w' || v.side === 'e' ? min.z : min.x) + i;
          const b = a + len;
          const c = colorOf(id);
          curStyle = styleOf(id);
          const wc = shade(colorOf(v.id), 0.78);
          if (v.side === 'w') { top(x0 - REACH, a, x0, b, h, c); wall(x0 - REACH, a, x0, a, h, v.h, wc); wall(x0 - REACH, b, x0, b, h, v.h, wc); }
          if (v.side === 'e') { top(x1, a, x1 + REACH, b, h, c); wall(x1, a, x1 + REACH, a, h, v.h, wc); wall(x1, b, x1 + REACH, b, h, v.h, wc); }
          if (v.side === 'n') { top(a, z0 - REACH, b, z0, h, c); wall(a, z0 - REACH, a, z0, h, v.h, wc); wall(b, z0 - REACH, b, z0, h, v.h, wc); }
          if (v.side === 's') { top(a, z1, b, z1 + REACH, h, c); wall(a, z1, a, z1 + REACH, h, v.h, wc); wall(b, z1, b, z1 + REACH, h, v.h, wc); }
        }
        i = j + 1;
      }
    }

    // 遠くの低い山（陸の側だけ。海の側は水平線が見えるように何も置かない）
    const rand = rng(seed);
    const hillTop = blockRegistry.getColor(blockRegistry.getByKey('grass')?.id ?? 1).clone().multiplyScalar(0.85);
    const hillSide = hillTop.clone().multiplyScalar(0.72);
    const box = (bx0: number, by0: number, bz0: number, bx1: number, by1: number, bz1: number): void => {
      top(bx0, bz0, bx1, bz1, by1, hillTop);
      quad([[bx0, by0, bz1], [bx1, by0, bz1], [bx1, by1, bz1], [bx0, by1, bz1]], [0, 0, 1], hillSide);
      quad([[bx1, by0, bz0], [bx0, by0, bz0], [bx0, by1, bz0], [bx1, by1, bz0]], [0, 0, -1], hillSide);
      quad([[bx1, by0, bz1], [bx1, by0, bz0], [bx1, by1, bz0], [bx1, by1, bz1]], [1, 0, 0], shade(hillSide, 1.1));
      quad([[bx0, by0, bz0], [bx0, by0, bz1], [bx0, by1, bz1], [bx0, by1, bz0]], [-1, 0, 0], shade(hillSide, 1.1));
    };
    /** だんだんの山（下ほど広い箱を重ねる） */
    const hill = (cx: number, cz: number, base: number, r: number, height: number): void => {
      const steps = Math.max(2, Math.round(height / 4));
      for (let k = 0; k < steps; k++) {
        const rr = r * (1 - k / steps) + 2;
        const y0 = base + (height * k) / steps;
        const y1 = base + (height * (k + 1)) / steps;
        box(Math.round(cx - rr), Math.round(y0), Math.round(cz - rr * 0.8), Math.round(cx + rr), Math.round(y1), Math.round(cz + rr * 0.8));
      }
    };
    curStyle = styleOf(blockRegistry.getByKey('grass')?.id ?? 1);
    for (const { side, water, h } of sides) {
      if (water) continue;
      const base = h - 1;
      const count = 5;
      for (let k = 0; k < count; k++) {
        const along = (k + rand()) / count; // 辺にそって
        const out = 80 + rand() * 80; // ふちからの距離（霧でかすみすぎない所）
        const r = 10 + rand() * 22;
        const height = 8 + rand() * 22;
        const ax = x0 + (x1 - x0) * along;
        const az = z0 + (z1 - z0) * along;
        const span = 1.8; // 辺より少し広く並べる
        const ox = (ax - (x0 + x1) / 2) * span + (x0 + x1) / 2;
        const oz = (az - (z0 + z1) / 2) * span + (z0 + z1) / 2;
        if (side === 'w') hill(x0 - out, oz, base, r, height);
        if (side === 'e') hill(x1 + out, oz, base, r, height);
        if (side === 'n') hill(ox, z0 - out, base, r, height);
        if (side === 's') hill(ox, z1 + out, base, r, height);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('kcStyle', new THREE.Float32BufferAttribute(sty, 1));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.material);
    // 観光地の地面と同じ高さで重なっても、ちらつかないように少しだけ下げる
    mesh.position.y = -0.02;
    this.group.add(mesh);
  }

  /** 片づける（観光地を出たとき・作り直すとき） */
  clear(): void {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      if (c instanceof THREE.Mesh) c.geometry.dispose();
    }
  }
}
