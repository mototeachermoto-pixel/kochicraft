import * as THREE from 'three';
import type { Backdrop, Region } from '@/spots/SpotDefinition';
import { AIR, blockRegistry } from './BlockRegistry';
import type { World } from './World';
import { STYLE, applyBlockStyles, styleOf } from './blockStyles';

const { wood: STYLE_WOOD, leaves: STYLE_LEAVES, stone: STYLE_STONE, windows: STYLE_WINDOWS, plain: STYLE_PLAIN,
  plaster: STYLE_PLASTER, tile: STYLE_TILE, speckle: STYLE_SPECKLE, grass: STYLE_GRASS } = STYLE;

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
  /** 淡くする計算で使う値：観光地の範囲（x0, z0, x1, z1）・外の地面の高さ・とかす色（地平線の空の色） */
  private readonly hazeField = { value: new THREE.Vector4() };
  private readonly hazeBase = { value: 10 };
  private readonly hazeColor = { value: new THREE.Color('#87ceeb').lerp(new THREE.Color('#ffffff'), 0.28) };

  constructor() {
    this.group.name = 'Surroundings';
    // 観光地のブロックと同じ模様をつける（境目が目立たないように）
    applyBlockStyles(this.material);
    // 外の景色を淡くする（空の色に少しとかす）。観光地から離れるほど淡く、建物や木は地面より強く淡くして、主役の観光地を目立たせる
    const addStyles = this.material.onBeforeCompile.bind(this.material);
    this.material.onBeforeCompile = (shader, renderer) => {
      addStyles(shader, renderer);
      shader.uniforms.kcField = this.hazeField;
      shader.uniforms.kcBase = this.hazeBase;
      shader.uniforms.kcHaze = this.hazeColor;
      shader.fragmentShader =
        `uniform vec4 kcField;
uniform float kcBase;
uniform vec3 kcHaze;
` +
        shader.fragmentShader.replace(
          '#include <opaque_fragment>',
          `{
            float dx = max(max(kcField.x - vKcPos.x, vKcPos.x - kcField.z), 0.0);
            float dz = max(max(kcField.y - vKcPos.z, vKcPos.z - kcField.w), 0.0);
            float amount = (0.08 + 0.92 * smoothstep(0.0, 90.0, max(dx, dz))) * (vKcPos.y > kcBase + 0.5 ? 0.36 : 0.12);
            outgoingLight = mix(outgoingLight, kcHaze, amount);
          }
          #include <opaque_fragment>`,
        );
    };
    this.material.customProgramCacheKey = () => 'kc-surroundings-haze-2';
  }

  /** いまの観光地に合わせて作り直す */
  build(world: World, field: Region, seed: string, backdrop?: Backdrop): void {
    const bd: Backdrop = backdrop ?? { near: 'none', far: 'hills' };
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
    // 観光地ごとに決めた「海にする辺」（岬など、実際は海に囲まれている所）
    if (bd.sea?.length) {
      const auto = sides.find((v) => v.water);
      const landH = Math.min(...sides.filter((v) => !v.water).map((v) => v.h));
      for (const v of sides) {
        if (!bd.sea.includes(v.side) || v.water) continue;
        v.water = true;
        v.id = waterId;
        v.h = auto ? auto.h : landH - 1;
      }
    }
    // 街の中の観光地は、外の地面を道路（アスファルト）にする（ビルの区画のあいだが道になる）
    if (bd.near === 'city') {
      const roadKey = blockRegistry.getByKey('road')?.id;
      if (roadKey !== undefined) for (const v of sides) if (!v.water) v.id = roadKey;
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
    /** 外へ続く道・川の場所（ここには建物や木を置かない） */
    const strips: number[][] = [];
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
          if (v.side === 'w') strips.push([x0 - REACH, a, x0, b]);
          if (v.side === 'e') strips.push([x1, a, x1 + REACH, b]);
          if (v.side === 'n') strips.push([a, z0 - REACH, b, z0]);
          if (v.side === 's') strips.push([a, z1, b, z1 + REACH]);
          if (v.side === 'w') { top(x0 - REACH, a, x0, b, h, c); wall(x0 - REACH, a, x0, a, h, v.h, wc); wall(x0 - REACH, b, x0, b, h, v.h, wc); }
          if (v.side === 'e') { top(x1, a, x1 + REACH, b, h, c); wall(x1, a, x1 + REACH, a, h, v.h, wc); wall(x1, b, x1 + REACH, b, h, v.h, wc); }
          if (v.side === 'n') { top(a, z0 - REACH, b, z0, h, c); wall(a, z0 - REACH, a, z0, h, v.h, wc); wall(b, z0 - REACH, b, z0, h, v.h, wc); }
          if (v.side === 's') { top(a, z1, b, z1 + REACH, h, c); wall(a, z1, a, z1 + REACH, h, v.h, wc); wall(b, z1, b, z1 + REACH, h, v.h, wc); }
        }
        i = j + 1;
      }
    }

    // ===== まわりの景色（観光地ごとに、実際の場所に近いもの） =====
    const rand = rng(seed);
    const landSide = sides.find((v) => !v.water);
    const base = landSide ? landSide.h : 10;
    this.hazeField.value.set(x0, z0, x1, z1);
    this.hazeBase.value = base;
    /** その場所が陸の上か（海の上や、外へ続く道・川の上には物を置かない） */
    const onLand = (x: number, z: number, r: number): boolean => {
      const dx = Math.max(x0 - x, 0, x - x1);
      const dz = Math.max(z0 - z, 0, z - z1);
      if (dx === 0 && dz === 0) return false; // 観光地の中
      let ok: boolean;
      if (dx > 0 && dz > 0) ok = !S[x < x0 ? 'w' : 'e'].water && !S[z < z0 ? 'n' : 's'].water;
      else if (dx > dz) ok = !S[x < x0 ? 'w' : 'e'].water;
      else ok = !S[z < z0 ? 'n' : 's'].water;
      if (!ok) return false;
      for (const [a, b, c, d] of strips) if (x + r > a - 1 && x - r < c + 1 && z + r > b - 1 && z - r < d + 1) return false;
      return true;
    };
    /** 観光地のふちからの距離 */
    const dist = (x: number, z: number): number => Math.max(x0 - x, 0, x - x1, z0 - z, 0, z - z1);
    const hexColor = (hex: string): THREE.Color => new THREE.Color(hex);
    const keyColor = (k: string): THREE.Color => blockRegistry.getColor(blockRegistry.getByKey(k)?.id ?? 1).clone();
    /** 箱（上の面と4つの横の面）。上と横で色・模様を変えられる */
    const box = (
      bx0: number, by0: number, bz0: number, bx1: number, by1: number, bz1: number,
      tc: THREE.Color, ts: number, sc: THREE.Color, ss: number,
    ): void => {
      curStyle = ts;
      top(bx0, bz0, bx1, bz1, by1, tc);
      curStyle = ss;
      quad([[bx0, by0, bz1], [bx1, by0, bz1], [bx1, by1, bz1], [bx0, by1, bz1]], [0, 0, 1], shade(sc, 0.8));
      quad([[bx1, by0, bz0], [bx0, by0, bz0], [bx0, by1, bz0], [bx1, by1, bz0]], [0, 0, -1], shade(sc, 0.66));
      quad([[bx1, by0, bz1], [bx1, by0, bz0], [bx1, by1, bz0], [bx1, by1, bz1]], [1, 0, 0], shade(sc, 0.86));
      quad([[bx0, by0, bz0], [bx0, by0, bz1], [bx0, by1, bz1], [bx0, by1, bz0]], [-1, 0, 0], shade(sc, 0.76));
    };
    /** 外のまわりの、ある距離の帯の中を、格子に区切って順に回る */
    const band = (d0: number, d1: number, step: number, fn: (x: number, z: number, d: number) => void): void => {
      for (let x = x0 - d1; x <= x1 + d1; x += step) {
        for (let z = z0 - d1; z <= z1 + d1; z += step) {
          const d = dist(x, z);
          if (d < d0 || d > d1) continue;
          fn(x, z, d);
        }
      }
    };

    const leafColors = ['#2f6b2a', '#3a7a30', '#2a5e2a', '#467f35'].map(hexColor);
    const wood = keyColor('wood');
    /** 木（幹と、葉のかたまり） */
    const tree = (x: number, z: number, big: number): void => {
      if (!onLand(x, z, 3)) return;
      const lc = leafColors[Math.floor(rand() * leafColors.length)];
      const th = 2 + Math.floor(rand() * 2);
      const r = 1 + Math.floor(rand() * 2 + big);
      box(x, base, z, x + 1, base + th, z + 1, wood, STYLE_WOOD, wood, STYLE_WOOD);
      const lh = 2 + Math.floor(rand() * 2 + big);
      box(x - r, base + th, z - r, x + 1 + r, base + th + lh, z + 1 + r, lc, STYLE_LEAVES, lc, STYLE_LEAVES);
      if (r > 1 && rand() < 0.6) box(x - r + 1, base + th + lh, z - r + 1, x + r, base + th + lh + 2, z + r, lc, STYLE_LEAVES, lc, STYLE_LEAVES);
    };
    const wallColors = ['#e9e4d6', '#d8d2c4', '#c9c6be', '#b9c4cc', '#e2d6bf', '#a9b5bf', '#d9cfc0', '#c9c2b4', '#cfd6da', '#e4dfd2', '#a8644c'].map(hexColor);
    const roofGray = hexColor('#7d7f82');
    /** ビル（窓のならぶ箱）。屋上は灰色 */
    const building = (bx: number, bz: number, w: number, d: number, h: number): void => {
      if (!onLand(bx + w / 2, bz + d / 2, Math.max(w, d) / 2 + 1)) return;
      const wc = wallColors[Math.floor(rand() * wallColors.length)];
      box(bx, base, bz, bx + w, base + h, bz + d, roofGray, STYLE_STONE, wc, STYLE_WINDOWS);
      // ときどき屋上に小さな出っぱり（階段室・看板）
      if (h > 6 && rand() < 0.5) box(bx + 1, base + h, bz + 1, bx + 3, base + h + 2, bz + 3, roofGray, STYLE_STONE, wc, STYLE_PLAIN);
    };
    const plaster = ['#efeadf', '#e6dccb', '#d9d4c8'].map(hexColor);
    const roofs = ['#4a5560', '#5a4038', '#3f4b5c', '#6b5a4a'].map(hexColor);
    /** 家（白いかべに、だんだんの屋根） */
    const house = (hx: number, hz: number): void => {
      if (!onLand(hx + 2, hz + 2, 4)) return;
      const w = 4 + Math.floor(rand() * 3);
      const d = 4 + Math.floor(rand() * 2);
      const pc = plaster[Math.floor(rand() * plaster.length)];
      const rc = roofs[Math.floor(rand() * roofs.length)];
      box(hx, base, hz, hx + w, base + 3, hz + d, pc, STYLE_PLASTER, pc, STYLE_PLASTER);
      box(hx - 1, base + 3, hz - 1, hx + w + 1, base + 4, hz + d + 1, rc, STYLE_TILE, rc, STYLE_TILE);
      box(hx, base + 4, hz + 1, hx + w, base + 5, hz + d - 1, rc, STYLE_TILE, rc, STYLE_TILE);
    };
    const paddy = hexColor('#7fae4a');
    const paddy2 = hexColor('#9cbf5a');
    /** 田んぼ・畑（平らな四角） */
    const paddyField = (fx: number, fz: number): void => {
      if (!onLand(fx + 4, fz + 3, 5)) return;
      curStyle = STYLE_SPECKLE;
      top(fx, fz, fx + 8, fz + 6, base + 0.03, rand() < 0.5 ? paddy : paddy2);
    };
    const forestTop = hexColor('#2d6a2b');
    const forestSide = hexColor('#2a5a28');
    const rockSide = hexColor('#6f6a5e');
    /** 山（だんだんの箱を重ねたもの）。高い山は森の緑、低い丘は草の緑 */
    const mountain = (cx: number, cz: number, r: number, height: number, forest: boolean): void => {
      if (!onLand(cx, cz, 2)) return;
      const steps = Math.max(3, Math.round(height / 4));
      const tc = forest ? forestTop : keyColor('grass').multiplyScalar(0.85);
      for (let k = 0; k < steps; k++) {
        const rr = r * (1 - k / steps) + 2;
        const y0 = base - 1 + (height * k) / steps;
        const y1 = base - 1 + (height * (k + 1)) / steps;
        const sc = forest ? (k > steps * 0.75 && height > 35 ? rockSide : forestSide) : tc;
        box(Math.round(cx - rr), Math.round(y0), Math.round(cz - rr * 0.85), Math.round(cx + rr), Math.round(y1), Math.round(cz + rr * 0.85),
          tc, forest ? STYLE_LEAVES : STYLE_GRASS, sc, forest ? STYLE_LEAVES : STYLE_GRASS);
      }
    };

    // --- 近くの景色 ---
    if (bd.near === 'city') {
      // 10マスごとの区画（道3マス＋ビル7マス）。近くは低め、遠くほど高いビル
      const sidewalk = hexColor('#a7a7a2');
      const parkGreen = hexColor('#6f9a55');
      band(12, 100, 10, (x, z, d) => {
        const gx = Math.floor(x / 10) * 10 + 3;
        const gz = Math.floor(z / 10) * 10 + 3;
        if (!onLand(gx + 3.5, gz + 3.5, 5)) return;
        // あくまで雰囲気なので、区画の半分以上は空ける（多いと、ごちゃついて観光地が見づらい）。
        // 空いた区画は公園や空き地の色にする（道路の色のままだと、広い駐車場のように見えるため）
        if (rand() < 0.56) {
          curStyle = STYLE_SPECKLE;
          top(gx - 1, gz - 1, gx + 8, gz + 8, base + 0.03, rand() < 0.6 ? parkGreen : sidewalk);
          return;
        }
        curStyle = STYLE_STONE;
        top(gx - 1, gz - 1, gx + 8, gz + 8, base + 0.03, sidewalk); // 歩道
        // 高知の街なので、高いビルは少なく、3〜15階くらいにする（ときどき少し高いビル）
        const tall = (d < 25 ? 3 + rand() * 4 : d < 60 ? 4 + rand() * 7 : 5 + rand() * 9) + (rand() < 0.08 ? 5 : 0);
        if (rand() < 0.35) {
          building(gx, gz, 7, 3, Math.round(tall));
          building(gx, gz + 4, 7, 3, Math.round(tall * (0.6 + rand() * 0.6)));
        } else {
          building(gx, gz, 7, 7, Math.round(tall));
        }
      });
      // 道ばたの木を少し
      band(12, 34, 10, (x, z) => {
        if (rand() < 0.25) tree(Math.floor(x / 10) * 10 + 1, Math.floor(z / 10) * 10 + 1, 0);
      });
    } else if (bd.near === 'town') {
      band(12, 90, 9, (x, z) => {
        const r = rand();
        if (r < 0.16) house(x + Math.floor(rand() * 3), z + Math.floor(rand() * 3));
        else if (r < 0.31) paddyField(x, z);
        else if (r < 0.39) tree(x + 2, z + 2, 0);
      });
    } else if (bd.near === 'village') {
      band(12, 70, 6, (x, z) => {
        const r = rand();
        if (r < 0.03) house(x, z);
        else if (r < 0.25) tree(x + Math.floor(rand() * 3), z + Math.floor(rand() * 3), rand() < 0.3 ? 1 : 0);
      });
    } else if (bd.near === 'forest') {
      band(12, 70, 5, (x, z, d) => {
        if (rand() < (d < 20 ? 0.2 : 0.38)) tree(x + Math.floor(rand() * 3), z + Math.floor(rand() * 3), rand() < 0.4 ? 1 : 0);
      });
    }

    // --- 遠くの景色 ---
    if (bd.far !== 'none') {
      const isMt = bd.far === 'mountains';
      for (const v of sides) {
        if (v.water) continue;
        const count = 3;
        for (let k = 0; k < count; k++) {
          const along = (k + rand()) / count;
          const out = isMt ? 85 + rand() * 90 : 80 + rand() * 70;
          const r = isMt ? 26 + rand() * 26 : 12 + rand() * 20;
          const height = isMt ? 28 + rand() * 32 : 8 + rand() * 16;
          const span = 1.9;
          const ox = (x0 + (x1 - x0) * along - (x0 + x1) / 2) * span + (x0 + x1) / 2;
          const oz = (z0 + (z1 - z0) * along - (z0 + z1) / 2) * span + (z0 + z1) / 2;
          if (v.side === 'w') mountain(x0 - out, oz, r, height, isMt);
          if (v.side === 'e') mountain(x1 + out, oz, r, height, isMt);
          if (v.side === 'n') mountain(ox, z0 - out, r, height, isMt);
          if (v.side === 's') mountain(ox, z1 + out, r, height, isMt);
        }
      }
    }
    // 遠くの低い街並み（山の上から町を見下ろす場所など）
    for (const fs of bd.farCity ?? []) {
      if (S[fs].water) continue;
      for (let k = 0; k < 20; k++) {
        const along = rand() * 2.2 - 0.6;
        const out = 70 + rand() * 60;
        const bx = fs === 'w' ? x0 - out : fs === 'e' ? x1 + out : x0 + (x1 - x0) * along;
        const bz = fs === 'n' ? z0 - out : fs === 's' ? z1 + out : z0 + (z1 - z0) * along;
        building(Math.round(bx), Math.round(bz), 4 + Math.floor(rand() * 4), 4 + Math.floor(rand() * 4), 3 + Math.floor(rand() * 9));
      }
    }

    // ===== 足摺岬：太平洋につき出た、黒い岩の高い崖の岬（2026-11-08 調べて作り直し） =====
    if (bd.feature === 'ashizuri-cape') {
      const seaTop = sea ? sea.h : 9;
      const cx = Math.round((x0 + x1) / 2);
      const plateau = surf(cx, max.z - 3).h;
      const rocks = ['#4b4640', '#5a544b', '#3e3a35', '#645d52'].map(hexColor);
      const rockColor = (): THREE.Color => rocks[Math.floor(rand() * rocks.length)];
      const green = keyColor('grass');
      const forest = hexColor('#2f6b2a');
      const foam = hexColor('#c8dde8');
      const cliff = (ax: number, az: number, bx: number, bz: number, h: number, tc: THREE.Color, ts: number): void =>
        box(ax, seaTop - 2, az, bx, h, bz, tc, ts, rockColor(), STYLE_STONE);
      const surfAt = (ax: number, az: number, bx: number, bz: number): void => {
        curStyle = STYLE_PLAIN;
        top(ax, az, bx, bz, seaTop + 0.08, foam);
      };
      /** 陸の高さ（入口のあたりは台地と同じで、奥へ行くほど山になる。実物も白皇山へ上がっていく） */
      const hAt = (d: number): number => plateau + (d < 70 ? 0 : Math.floor((d - 70) / 24) * 3);
      // 岬のつけ根：入口から奥へ行くほど陸が広がる。左右のふちは、ぎざぎざの黒い崖
      const halfBase = cx - x0 + 3;
      for (let d = 0; d < 260; d += 8) {
        const hl = Math.round(halfBase + d * 0.55 + rand() * 6);
        const hr = Math.round(halfBase + d * 0.55 + rand() * 6);
        const near = d < 16;
        cliff(cx - hl, z1 + d, cx + hr, z1 + d + 8, hAt(d), near ? green : forest, near ? STYLE_GRASS : STYLE_LEAVES);
        if (d < 170) {
          surfAt(cx - hl - 1, z1 + d, cx - hl, z1 + d + 8);
          surfAt(cx + hr, z1 + d, cx + hr + 1, z1 + d + 8);
        }
      }
      // 観光地の入口の道を、岬のつけ根の森の中へ続ける
      let roadA = -1;
      let roadB = -1;
      for (let x = min.x; x <= max.x; x++) {
        if (surf(x, max.z).id !== roadId) continue;
        if (roadA < 0) roadA = x;
        roadB = x + 1;
      }
      if (roadA >= 0) {
        curStyle = styleOf(roadId);
        top(roadA, z1, roadB, z1 + 70, plateau + 0.06, colorOf(roadId));
      }
      // 岬の森（やぶ椿などの、こんもりした濃い緑）
      for (let k = 0; k < 90; k++) {
        const d = 10 + rand() * 140;
        const x = Math.round(cx + (rand() - 0.5) * (2 * halfBase + d * 0.9));
        if (roadA >= 0 && d < 74 && x > roadA - 5 && x < roadB + 5) continue;
        const z = Math.round(z1 + d);
        const h = hAt(d);
        const r = 2 + Math.floor(rand() * 2);
        const lc = leafColors[Math.floor(rand() * leafColors.length)];
        box(x - r, h, z - r, x + r + 1, h + 3 + Math.floor(rand() * 2), z + r + 1, lc, STYLE_LEAVES, lc, STYLE_LEAVES);
      }
      // 観光地の左右のふち：まっすぐな壁に見えないよう、でこぼこの岩をつける。下には白い波
      for (let z = min.z; z < z1; z += 3) {
        for (const west of [true, false]) {
          if (surf(west ? min.x : max.x, z).h < plateau - 1) continue;
          const w = 1 + Math.floor(rand() * 4);
          const h = plateau - Math.floor(rand() * 5);
          const isGreen = rand() < 0.6;
          const tc = isGreen ? forest : rockColor();
          const ts = isGreen ? STYLE_LEAVES : STYLE_STONE;
          if (west) {
            cliff(x0 - w, z, x0, z + 3, h, tc, ts);
            surfAt(x0 - w - 1, z, x0 - w, z + 3);
          } else {
            cliff(x1, z, x1 + w, z + 3, h, tc, ts);
            surfAt(x1 + w, z, x1 + w + 1, z + 3);
          }
        }
      }
      // 沖の岩と、そのまわりの白い波
      for (let k = 0; k < 16; k++) {
        const where = rand();
        const rx = where < 0.35 ? x0 - 12 - rand() * 60 : where < 0.7 ? x1 + 12 + rand() * 60 : cx + (rand() - 0.5) * 120;
        const rz = where < 0.7 ? z0 - 30 + rand() * (z1 - z0 + 30) : z0 - 8 - rand() * 50;
        const r = 1 + Math.floor(rand() * 3);
        const x = Math.round(rx);
        const z = Math.round(rz);
        // 波は、岩のまわりに切れぎれに（四角い板に見えないように）
        if (rand() < 0.7) surfAt(x - r - 1, z - r - 1, x + r + 2, z - r);
        if (rand() < 0.7) surfAt(x - r - 1, z + r + 1, x + r + 2, z + r + 2);
        if (rand() < 0.7) surfAt(x - r - 1, z - r, x - r, z + r + 1);
        if (rand() < 0.7) surfAt(x + r + 1, z - r, x + r + 2, z + r + 1);
        const rc = rockColor();
        box(x - r, seaTop - 2, z - r, x + r + 1, seaTop + 1 + Math.floor(rand() * 5), z + r + 1, rc, STYLE_STONE, rc, STYLE_STONE);
      }
    }

    // ===== 坂本龍馬像：桂浜公園の中の観光地（2026-11-08 調べて作り直し） =====
    // 龍馬像は龍頭岬の上。そばに弓なりの桂浜、はしに龍王岬（海津見神社）、公園には松・休憩所やお店・水族館・駐車場、
    // 高台に坂本龍馬記念館がある。ゲームの北（奥）が海なので、海を向いて左（西）に浜が続くように置く。位置はおおまか
    if (bd.feature === 'katsurahama-park') {
      const seaTop = sea ? sea.h : base;
      const cx = Math.round((x0 + x1) / 2);
      const sandId = blockRegistry.getByKey('sand')?.id ?? 4;
      const sand = colorOf(sandId);
      const waterC = colorOf(waterId);
      const pave = hexColor('#b8b4aa');
      const asphalt = colorOf(roadId);
      const foam = hexColor('#c8dde8');
      const white = hexColor('#eeeeea');
      const pineC = hexColor('#2c5f2e');
      const red = hexColor('#c63b2f');
      const rock = hexColor('#4b4640');
      const forest = hexColor('#2f6b2a');
      const lay = (ax: number, az: number, bx: number, bz: number, y: number, c: THREE.Color, st: number): void => {
        curStyle = st;
        top(ax, az, bx, bz, y, c);
      };
      /** 弓なりの浜の、海が陸へ入りこむ深さ */
      const bite = (x: number): number => Math.round(34 * Math.sin(Math.PI * Math.min(1, Math.max(0, (x0 - x) / 150))));
      // 桂浜：弓なりの海岸線・砂浜・白い波
      for (let x = x0 - 150; x < x0; x += 5) {
        const b = bite(x + 2.5);
        if (b > 0) lay(x, z0, x + 5, z0 + b, seaTop + 0.06, waterC, styleOf(waterId));
        lay(x, z0 + b, x + 5, z0 + b + 14, base + 0.12, sand, styleOf(sandId));
        lay(x, z0 + b, x + 5, z0 + b + 2, base + 0.18, foam, STYLE_PLAIN);
      }
      // 龍王岬：浜のはしの岩山と、上の赤いお宮と鳥居
      const rx = x0 - 162;
      const rz = z0 + 6;
      box(rx - 14, seaTop - 2, rz - 16, rx + 14, base + 3, rz + 14, forest, STYLE_LEAVES, rock, STYLE_STONE);
      box(rx - 8, base + 3, rz - 10, rx + 8, base + 7, rz + 8, forest, STYLE_LEAVES, rock, STYLE_STONE);
      const y = base + 7;
      box(rx - 2, y, rz - 2, rx + 2, y + 2, rz + 2, roofs[1], STYLE_TILE, red, STYLE_PLASTER);
      box(rx - 2, y, rz + 5, rx - 1, y + 3, rz + 6, red, STYLE_PLASTER, red, STYLE_PLASTER);
      box(rx + 1, y, rz + 5, rx + 2, y + 3, rz + 6, red, STYLE_PLASTER, red, STYLE_PLASTER);
      box(rx - 3, y + 3, rz + 5, rx + 3, y + 4, rz + 6, red, STYLE_PLASTER, red, STYLE_PLASTER);
      // 東がわの海岸の黒い岩と波
      for (let x = x1; x < x1 + 120; x += 5) {
        if (rand() < 0.35) continue;
        const r = 1 + Math.floor(rand() * 2);
        lay(x - r - 1, z0 - r - 1, x + r + 2, z0 - r, seaTop + 0.08, foam, STYLE_PLAIN);
        box(x - r, seaTop - 2, z0 - r, x + r + 1, seaTop + 1 + Math.floor(rand() * 2), z0 + r, rock, STYLE_STONE, rock, STYLE_STONE);
      }
      /** 松（細い幹の上に、平たく広がる葉） */
      const pine = (px: number, pz: number): void => {
        const th = 5 + Math.floor(rand() * 3);
        const ox = Math.floor(rand() * 3) - 1;
        box(px, base, pz, px + 1, base + th, pz + 1, wood, STYLE_WOOD, wood, STYLE_WOOD);
        box(px - 3 + ox, base + th, pz - 2, px + 4 + ox, base + th + 2, pz + 3, pineC, STYLE_LEAVES, pineC, STYLE_LEAVES);
        box(px - 1 + ox, base + th + 2, pz - 1, px + 2 + ox, base + th + 3, pz + 2, pineC, STYLE_LEAVES, pineC, STYLE_LEAVES);
      };
      for (let k = 0; k < 30; k++) {
        const x = Math.round(x0 - 6 - rand() * 135);
        const z = Math.round(z0 + bite(x) + 18 + rand() * 45);
        pine(x, z);
      }
      for (let k = 0; k < 24; k++) pine(Math.round(x1 + 6 + rand() * 95), Math.round(z0 + 6 + rand() * 70));
      for (let k = 0; k < 14; k++) pine(Math.round(x0 - 36 + rand() * 42), Math.round(z1 + 6 + rand() * 54));
      // 公園の遊歩道と広場
      lay(cx - 3, z1, cx + 4, z1 + 34, base + 0.06, pave, STYLE_STONE);
      lay(cx - 21, z1 + 34, cx + 22, z1 + 46, base + 0.06, pave, STYLE_STONE);
      // 休憩所・お店（広場の奥に並ぶ、低い建物）
      const awnings = ['#c0504d', '#3f7fbf', '#e0a030', '#4f9f6f'].map(hexColor);
      for (const startX of [cx - 21, cx + 4]) {
        for (let i = 0; i < 3; i++) {
          const sx = startX + i * 6;
          const pc = plaster[Math.floor(rand() * plaster.length)];
          const ac = awnings[Math.floor(rand() * awnings.length)];
          box(sx, base, z1 + 47, sx + 5, base + 3, z1 + 54, pc, STYLE_PLASTER, pc, STYLE_PLASTER);
          box(sx - 1, base + 3, z1 + 46, sx + 6, base + 4, z1 + 55, roofs[0], STYLE_TILE, roofs[0], STYLE_TILE);
          box(sx, base + 2, z1 + 45, sx + 5, base + 3, z1 + 47, ac, STYLE_PLAIN, ac, STYLE_PLAIN);
        }
      }
      // 駐車場（白い線と車）と、そこへ来る道
      const lotA = cx + 26;
      const lotB = cx + 66;
      lay(lotA, z1 + 12, lotB, z1 + 42, base + 0.06, asphalt, styleOf(roadId));
      lay(lotB - 26, z1 + 42, lotB - 21, z1 + 260, base + 0.06, asphalt, styleOf(roadId));
      const cars = ['#d8d8dc', '#c84a3a', '#3b6fb5', '#2c2f36', '#e8e4d8'].map(hexColor);
      for (let row = 0; row < 3; row++) {
        const rowZ = z1 + 15 + row * 9;
        for (let c = 0; c < 11; c++) {
          const px = lotA + 3 + c * 3;
          lay(px - 1, rowZ, px - 0.75, rowZ + 5, base + 0.12, white, STYLE_PLAIN);
          if (rand() > 0.55) continue;
          const cc = cars[Math.floor(rand() * cars.length)];
          box(px, base, rowZ + 1, px + 2, base + 1, rowZ + 4, cc, STYLE_PLAIN, cc, STYLE_PLAIN);
          box(px, base + 1, rowZ + 2, px + 2, base + 2, rowZ + 3, cc, STYLE_PLAIN, hexColor('#3a4656'), STYLE_PLAIN);
        }
      }
      // だんだんの丘
      const stack = (hx: number, hz: number, r: number, height: number): number => {
        const hc = keyColor('grass').multiplyScalar(0.85);
        const steps = Math.max(3, Math.round(height / 4));
        for (let k = 0; k < steps; k++) {
          const rr = r * (1 - k / steps) + 8;
          box(Math.round(hx - rr), Math.round(base - 1 + (height * k) / steps), Math.round(hz - rr * 0.85), Math.round(hx + rr), Math.round(base - 1 + (height * (k + 1)) / steps), Math.round(hz + rr * 0.85), hc, STYLE_GRASS, hc, STYLE_GRASS);
        }
        return Math.round(base - 1 + height);
      };
      // 水族館（浜の西のはしの近く）
      const aqX = x0 - 118;
      const aqZ = z0 + bite(aqX) + 24;
      box(aqX, base, aqZ, aqX + 16, base + 5, aqZ + 11, hexColor('#3f8fc0'), STYLE_PLAIN, hexColor('#dfe9ee'), STYLE_PLASTER);
      // 坂本龍馬記念館（高台の、ガラスの四角い建物）
      const hillTop = stack(cx - 60, z1 + 75, 18, 14);
      box(cx - 70, hillTop, z1 + 69, cx - 50, hillTop + 6, z1 + 81, hexColor('#8d9499'), STYLE_STONE, hexColor('#b9d4e2'), STYLE_WINDOWS);
      // 遠くの低い山（内陸の側）
      stack(cx + 10, z1 + 150, 34, 18);
      stack(cx - 110, z1 + 165, 30, 20);
      stack(cx + 120, z1 + 135, 30, 16);
    }

    // ===== 四万十川：川が東西へゆったり曲がりながら流れていく谷（2026-11-08 作り直し） =====
    // 外の土地は「海」の上に、川の両岸だけを陸として置く。川のふちは砂利の川原、両がわに森の山がせまる
    if (bd.feature === 'shimanto-river') {
      const waterTop = sea ? sea.h : base - 1;
      const sandId = blockRegistry.getByKey('sand')?.id ?? 4;
      const sandC = colorOf(sandId);
      const grassC = colorOf(S.n.id);
      const shallow = colorOf(waterId).lerp(sandC, 0.18);
      const forest = hexColor('#2f6b2a');
      const forestDark = hexColor('#2a5a28');
      const concrete = hexColor('#b4b2aa');
      const midZ = (z0 + 10 + z0 + 27) / 2; // 観光地の中の川のまん中（z36〜52）
      /** ふちからの距離 s での、川のまん中の位置（観光地のすぐ外はまっすぐで、遠くほど大きく曲がる） */
      const centerAt = (s: number, phase: number): number => {
        const t = Math.min(1, s / 24);
        return midZ + t * t * (3 - 2 * t) * 34 * Math.sin(s / 42 + phase);
      };
      const halfAt = (s: number): number => 8.5 + Math.min(4, s * 0.02);
      const STEP = 5;
      const paintSide = (west: boolean, phase: number): void => {
        for (let s = 0; s < REACH; s += STEP) {
          const a = west ? x0 - s - STEP : x1 + s;
          const b = a + STEP;
          const c = centerAt(s + STEP / 2, phase);
          const h = halfAt(s);
          const north = Math.round(c - h);
          const south = Math.round(c + h);
          box(a, waterTop - 2, z0 - REACH, b, base, north, grassC, STYLE_GRASS, sandC, styleOf(sandId));
          box(a, waterTop - 2, south, b, base, z1 + REACH, grassC, STYLE_GRASS, sandC, styleOf(sandId));
          // 川原（曲がりの内がわほど広い）と、岸近くの浅い所
          const bend = Math.sin((s + STEP / 2) / 42 + phase);
          const wn = 3 + Math.round(Math.max(0, bend) * 9);
          const ws = 3 + Math.round(Math.max(0, -bend) * 9);
          curStyle = styleOf(sandId);
          top(a, north - wn, b, north, base + 0.06, sandC);
          top(a, south, b, south + ws, base + 0.06, sandC);
          curStyle = styleOf(waterId);
          top(a, north, b, north + 2, waterTop + 0.04, shallow);
          top(a, south - 2, b, south, waterTop + 0.04, shallow);
        }
      };
      const westPhase = 0.6;
      const eastPhase = 2.4;
      paintSide(true, westPhase);
      paintSide(false, eastPhase);

      /** 森におおわれた山（だんだんの箱） */
      const ridge = (rxc: number, rzc: number, r: number, height: number): void => {
        const steps = Math.max(3, Math.round(height / 4));
        for (let k = 0; k < steps; k++) {
          const rr = r * (1 - k / steps) + 3;
          box(Math.round(rxc - rr), Math.round(base - 1 + (height * k) / steps), Math.round(rzc - rr * 0.8),
            Math.round(rxc + rr), Math.round(base - 1 + (height * (k + 1)) / steps), Math.round(rzc + rr * 0.8),
            forest, STYLE_LEAVES, forestDark, STYLE_LEAVES);
        }
      };
      /** ある x での川のまん中（観光地の中はまっすぐ） */
      const centerForX = (x: number): number =>
        x < x0 ? centerAt(x0 - x, westPhase) : x > x1 ? centerAt(x - x1, eastPhase) : midZ;
      // 川の両がわにせまる山並み（川の曲がりに沿って続く）
      for (let x = x0 - 270; x < x1 + 270; x += 40) {
        const px = x + rand() * 18;
        const c = centerForX(px);
        const inField = px > x0 - 24 && px < x1 + 24;
        const northZ = Math.min(c - 46 - rand() * 22, inField ? z0 - 46 : Infinity);
        const southZ = Math.max(c + 46 + rand() * 22, inField ? z1 + 70 : -Infinity);
        ridge(px, northZ, 22 + rand() * 12, 16 + rand() * 18);
        ridge(px, southZ, 22 + rand() * 12, 16 + rand() * 18);
      }
      // 川岸の木（少しだけ）
      for (let k = 0; k < 44; k++) {
        const west = rand() < 0.5;
        const s = 8 + rand() * 170;
        const x = Math.round(west ? x0 - s : x1 + s);
        const c = centerAt(s, west ? westPhase : eastPhase);
        const off = halfAt(s) + 15 + rand() * 18;
        const z = Math.round(rand() < 0.5 ? c - off : c + off);
        const r = 1 + Math.floor(rand() * 2);
        const lc = leafColors[Math.floor(rand() * leafColors.length)];
        box(x, base, z, x + 1, base + 2, z + 1, wood, STYLE_WOOD, wood, STYLE_WOOD);
        box(x - r, base + 2, z - r, x + r + 1, base + 5, z + r + 1, lc, STYLE_LEAVES, lc, STYLE_LEAVES);
      }
      // 川しもに見える、もう1本の沈下橋（手すりのない低い橋）
      {
        const s = 92;
        const bx = x0 - s;
        const c = Math.round(centerAt(s, westPhase));
        const h = Math.ceil(halfAt(s)) + 4;
        box(bx, base - 1, c - h, bx + 3, base, c + h, concrete, STYLE_STONE, concrete, STYLE_STONE);
        for (let z = c - h + 4; z < c + h; z += 5) box(bx + 1, waterTop - 2, z, bx + 2, base - 1, z + 1, concrete, STYLE_STONE, concrete, STYLE_STONE);
      }
      // 手前の岸の、山里の家（少しだけ）
      for (let k = 0; k < 5; k++) house(Math.round(x0 + 3 + rand() * (x1 - x0 - 10)), Math.round(z1 + 14 + rand() * 26));
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
