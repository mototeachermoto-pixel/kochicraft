import * as THREE from 'three';
import { blockRegistry } from './BlockRegistry';

/**
 * ブロックの表面の模様（2026-11-08 追加）。
 *
 * これまでのブロックは一色ぬりだった。マイクラ風らしく見えるよう、1マスを 16×16 の小さな点に分け、
 * ブロックの種類ごとに模様をつける（草のつぶつぶ・草ブロックの横は土・木目・レンガ・石のまだら・葉のすきま・水のゆらぎ など）。
 *
 * 画像は使わず、絵をかく計算（シェーダー）の中で、場所から模様を作る。
 * そのため、となり合う同じブロックを1枚にまとめる今のしくみ（グリーディメッシング）のまま使え、
 * 三角形の数も増えない（iPad でも重くならない）。
 */

/** 模様の番号（ChunkMesher が頂点ごとに書きこむ） */
export const STYLE = {
  plain: 0,
  grass: 1,
  dirt: 2,
  stone: 3,
  sand: 4,
  wood: 5,
  leaves: 6,
  brick: 7,
  road: 8,
  stonewall: 9,
  tile: 10,
  plaster: 11,
  planks: 12,
  water: 13,
  glass: 14,
  speckle: 15,
  /** ビルのかべ：窓がならぶ（まわりの景色の街並み用） */
  windows: 16,
} as const;

const BY_KEY: Record<string, number> = {
  grass: STYLE.grass,
  dirt: STYLE.dirt,
  stone: STYLE.stone,
  sand: STYLE.sand,
  water: STYLE.water,
  wood: STYLE.wood,
  leaves: STYLE.leaves,
  bamboo: STYLE.wood,
  flower: STYLE.speckle,
  tile: STYLE.tile,
  brick: STYLE.brick,
  glass: STYLE.glass,
  bridge: STYLE.planks,
  road: STYLE.road,
  stonewall: STYLE.stonewall,
  roof: STYLE.tile,
  turf: STYLE.speckle,
  castlewall: STYLE.plaster,
  sakura: STYLE.leaves,
  torii: STYLE.plaster,
  lantern: STYLE.stone,
  bronze: STYLE.speckle,
  bronzedark: STYLE.speckle,
};

let table: number[] | null = null;
/** ブロックID → 模様の番号 */
export function styleOf(id: number): number {
  if (!table) {
    table = [];
    for (const t of blockRegistry.all()) table[t.id] = BY_KEY[t.key] ?? STYLE.plain;
  }
  return table[id] ?? STYLE.plain;
}

/** 模様をかく計算で使う、時間（水のゆらぎ用）と色 */
export const styleUniforms = {
  kcTime: { value: 0 },
  kcGrass: { value: new THREE.Color('#5aa641') },
  kcDirt: { value: new THREE.Color('#8a5a33') },
};

const VERT_HEAD = /* glsl */ `
attribute float kcStyle;
varying float vKcStyle;
varying vec3 vKcPos;
varying vec3 vKcNormal;
`;
const VERT_BODY = /* glsl */ `
vKcStyle = kcStyle;
vKcPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vKcNormal = objectNormal;
`;

const FRAG_HEAD = /* glsl */ `
uniform float kcTime;
uniform vec3 kcGrass;
uniform vec3 kcDirt;
varying float vKcStyle;
varying vec3 vKcPos;
varying vec3 vKcNormal;
float kcHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// なめらかな、大きなむら（0〜1）。草や葉の色を、場所によってゆるやかに変えるのに使う
float kcSoft(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(kcHash(i), kcHash(i + vec2(1.0, 0.0)), f.x), mix(kcHash(i + vec2(0.0, 1.0)), kcHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

/**
 * 模様の計算。diffuseColor（頂点の色＝ブロックの色×面の明るさ×角のかげ）に、模様の明るさをかける。
 * uv＝その面の上の位置（1マス＝1）、px＝16分割した点の位置、cell＝どのマスか。
 */
const FRAG_BODY = /* glsl */ `
{
  int st = int(vKcStyle + 0.5);
  vec3 an = abs(vKcNormal);
  // 面の向きに合わせて、面の上の2つの方向をえらぶ（上下の面は x と z、横の面は横と高さ）
  vec2 uv = an.y > 0.5 ? vKcPos.xz : (an.x > 0.5 ? vKcPos.zy : vKcPos.xy);
  vec2 px = floor(fract(uv) * 16.0);
  vec2 cell = floor(uv);
  float axis = an.y > 0.5 ? 0.0 : (an.x > 0.5 ? 1.0 : 2.0);
  float n = kcHash(px + cell * 16.0 + axis * 431.0);
  float m = 1.0;
  bool top = vKcNormal.y > 0.5;
  bool side = an.y < 0.5;
  if (st == 1) {
    // 草：上はつぶつぶの緑。横は、上の2〜3点だけ緑で、その下は土（ぎざぎざの境目）
    m = 0.9 + n * 0.2;
    bool soil = false;
    if (side) {
      float yy = fract(vKcPos.y) * 16.0;
      float edge = 13.0 - floor(kcHash(vec2(px.x, cell.x + cell.y * 7.0)) * 3.0);
      if (yy < edge) {
        diffuseColor.rgb = diffuseColor.rgb / max(kcGrass, vec3(0.001)) * kcDirt;
        m = 0.88 + n * 0.24;
        soil = true;
      }
    }
    if (!soil) {
      // 草の色を、場所によってゆるやかに変える（深い緑〜明るい黄緑）。一面が同じ色にならないように
      float gpatch = kcSoft(vKcPos.xz * 0.11) * 0.65 + kcSoft(vKcPos.xz * 0.37 + 19.0) * 0.35;
      diffuseColor.rgb *= mix(vec3(0.70, 0.86, 0.74), vec3(1.06, 1.0, 0.74), gpatch);
      if (top) {
        // 草の葉：ところどころ、明るい葉先と暗い根もと
        if (n > 0.86) m *= 1.16;
        else if (n < 0.12) m *= 0.84;
        // 小さな野の花（白・黄・うすもも）。1マスに1つ出るかどうか
        float fl = kcHash(cell * 1.7 + 5.0);
        if (fl > 0.9) {
          vec2 fp = floor(vec2(kcHash(cell + 3.0), kcHash(cell + 9.0)) * 12.0) + 2.0;
          vec2 dd = abs(px - fp);
          if (dd.x + dd.y <= 1.0) {
            float kind = kcHash(cell + 27.0);
            vec3 petal = kind < 0.4 ? vec3(0.96, 0.96, 0.9) : (kind < 0.75 ? vec3(0.98, 0.82, 0.25) : vec3(0.97, 0.66, 0.78));
            diffuseColor.rgb = dd.x + dd.y < 0.5 ? vec3(0.95, 0.7, 0.2) : petal;
            m = 1.0;
          }
        }
      }
    }
  } else if (st == 2) {
    m = 0.86 + n * 0.28;
  } else if (st == 3) {
    // 石：大きめのまだら＋細かいつぶ
    float big = kcHash(floor(px / 4.0) + cell * 4.0 + axis * 97.0);
    m = 0.84 + big * 0.18 + n * 0.1;
  } else if (st == 4) {
    // 砂：細かいつぶと、風でできたゆるい波もよう
    m = 0.94 + n * 0.1;
    if (top) m *= 0.965 + 0.05 * sin(vKcPos.x * 1.9 + sin(vKcPos.z * 0.7) * 1.6 + vKcPos.z * 0.35);
    diffuseColor.rgb *= mix(vec3(0.95, 0.94, 0.9), vec3(1.03, 1.0, 0.95), kcSoft(vKcPos.xz * 0.15));
  } else if (st == 5) {
    if (top) {
      // 切り口：年輪
      float d = length(px - 7.5);
      m = 0.88 + 0.14 * step(0.5, fract(d / 3.0)) + n * 0.05;
    } else {
      // 木の皮：たてのすじ
      float col = an.x > 0.5 ? px.x : px.x;
      m = 0.82 + kcHash(vec2(col, cell.x * 3.0 + cell.y + axis)) * 0.22 + n * 0.06;
    }
  } else if (st == 6) {
    // 葉：ところどころ暗いすきま
    m = n < 0.16 ? 0.72 : (n > 0.9 ? 1.12 : 0.93 + n * 0.1);
    // 葉のかたまりごとに、色を少しずつ変える（深い緑〜若葉色）。上の面は日が当たって明るく
    float lp = kcSoft(vKcPos.xz * 0.23 + vKcPos.y * 0.31);
    diffuseColor.rgb *= mix(vec3(0.8, 0.9, 0.84), vec3(1.1, 1.06, 0.82), lp);
    if (top) m *= 1.06;
  } else if (st == 7) {
    // レンガ：たて4点ごとに目地、横は段ごとにずらして8点ごとに目地
    float row = floor(px.y / 4.0);
    float bx = mod(px.x + mod(row, 2.0) * 4.0, 8.0);
    bool mortar = mod(px.y, 4.0) < 1.0 || bx < 1.0;
    m = mortar ? 1.3 : 0.9 + n * 0.16;
  } else if (st == 8) {
    // 道：細かい小石のつぶと、ゆるやかな色むら（まっ平らな灰色に見えないように）
    m = 0.9 + n * 0.16;
    if (n > 0.93) m = 1.22;
    m *= 0.94 + kcSoft(vKcPos.xz * 0.3) * 0.12;
  } else if (st == 9) {
    // 石垣：大きな石を積んだ形（段ごとにずらす）。目地は暗く、石ごとに明るさを変える
    float row = floor(px.y / 8.0);
    float sx = px.x + mod(row + cell.y, 2.0) * 5.0;
    vec2 stone = vec2(floor(sx / 10.0), row) + cell * 3.0;
    bool joint = mod(px.y, 8.0) < 1.0 || mod(sx, 10.0) < 1.0;
    m = joint ? 0.68 : 0.88 + kcHash(stone + axis * 11.0) * 0.2 + n * 0.06;
  } else if (st == 10) {
    // かわら：横の段
    m = mod(px.y, 4.0) < 1.0 ? 0.75 : 0.95 + n * 0.1;
  } else if (st == 11) {
    // しっくい・朱ぬり：ごく弱いむら
    m = 0.96 + n * 0.07;
  } else if (st == 12) {
    // 板：横の板目
    m = mod(px.y, 4.0) < 1.0 ? 0.74 : 0.9 + kcHash(vec2(floor(px.y / 4.0), cell.x + cell.y)) * 0.14 + n * 0.05;
  } else if (st == 13) {
    // 水：ゆっくりゆらぐ明るさと、ときどき光る点
    float w = sin(vKcPos.x * 1.7 + kcTime * 1.3) * sin(vKcPos.z * 1.3 - kcTime * 1.1);
    m = 1.0 + w * 0.08;
    if (top) {
      // さざ波：ゆっくり動く、細い明るいすじ
      float band = sin(vKcPos.z * 2.6 + sin(vKcPos.x * 0.8 + kcTime * 0.6) * 1.8 + kcTime * 0.9);
      m += smoothstep(0.9, 1.0, band) * 0.14;
      // 日の光のきらめき
      float spark = kcHash(px + cell * 16.0 + floor(kcTime * 2.0));
      if (spark > 0.982) m += 0.4;
      // 深い所と浅い所で、色をゆるやかに変える
      diffuseColor.rgb *= mix(vec3(0.88, 0.95, 1.0), vec3(1.04, 1.06, 1.0), kcSoft(vKcPos.xz * 0.09));
    }
  } else if (st == 14) {
    // ガラス：ふちにわく
    bool frame = px.x < 1.0 || px.x > 14.0 || px.y < 1.0 || px.y > 14.0;
    if (frame) { m = 1.25; diffuseColor.a = min(1.0, diffuseColor.a * 1.35); }
    else if (px.x == px.y || px.x == px.y + 1.0) { m = 1.12; }
  } else if (st == 15) {
    m = 0.9 + n * 0.2;
  } else if (st == 16) {
    // ビルのかべ：1マスに1つ窓（横の面だけ）。窓は青みがかった暗い色
    if (side && px.x > 2.0 && px.x < 13.0 && px.y > 3.0 && px.y < 13.0) {
      // 窓は空をうつした明るめの青。ところどころ、少し明るい窓
      float wn = kcHash(cell * 3.1 + axis * 7.0);
      diffuseColor.rgb = mix(diffuseColor.rgb * 0.55, vec3(0.2, 0.36, 0.52), 0.6) * (wn > 0.7 ? 1.35 : 1.0);
      m = 0.9 + n * 0.25;
    } else {
      m = 0.95 + n * 0.06;
    }
  }
  // どのブロックも、ふちの1点をほんの少し暗くして、ブロックの形がはっきり見えるように
  if (st != 13 && st != 14 && (px.x < 1.0 || px.x > 14.0 || px.y < 1.0 || px.y > 14.0)) m *= 0.93;
  diffuseColor.rgb *= m;
}
`;

/** ワールドの材質に模様をつける（Lambert の材質に、模様の計算を差しこむ） */
export function applyBlockStyles(mat: THREE.Material): void {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, styleUniforms);
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = FRAG_HEAD + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_BODY}`);
  };
  mat.customProgramCacheKey = () => 'kc-block-styles-3';
}
