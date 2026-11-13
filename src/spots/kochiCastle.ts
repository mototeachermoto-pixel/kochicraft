import type { World } from '@/world/World';
import { Build } from './Build';
import { horseRider, kimonoFigure } from './statues';
import type { SpotDefinition } from './SpotDefinition';

/**
 * 高知城（Kochi Castle）— 日本に12しか残らない現存天守のひとつ。
 * 実物の特徴を色ボクセルで再現：
 *   - 望楼型・4重の天守（白漆喰の白壁＋濃い瓦屋根が段々に小さく重なる）
 *   - 最上階を一周する「廻縁・高欄」（木の手すり。高知城の珍しい現存遺構）
 *   - 屋根に千鳥破風、てっぺんに金色の鯱（しゃちほこ）
 *   - 大高坂山を模した、勾配のある高い石垣の上に建つ
 *   - 大きな木の門「追手門」（櫓門）。門と天守を一緒に見られるのが名物
 *   - 城下はお花見（桜）の名所。入口に板垣退助の銅像
 *
 * 実物の配置に合わせた点：
 *   - 本丸御殿（懐徳館）を天守の東どなりに追加し、廊下で直結（天守と御殿が両方現存するのは全国で高知城だけ）
 *   - 板垣退助像は「追手門をくぐった石段の上り口」（台座の方が像より高い）
 *   - 山内一豊の騎馬像は「追手門の手前の広場」（国内最大級の騎馬像）
 *   - 石垣に石樋（雨水の排水口。雨の多い高知ならではの現存遺構）
 *
 * 座標の目安：小さい z＝奥（天守側）／大きい z＝手前（入口・スポーン）。
 *   公園(芝)   : z 53〜69（地面の上面 = PARK）
 *   追手門     : z 58〜60
 *   石段       : z 52〜56
 *   本丸石垣   : z 28〜52（天端 = HONMARU、その上に天守＋御殿）
 */

const PARK = 10; // 公園（芝）の上面。立つのは PARK+1
const HONMARU = 15; // 本丸石垣の天端。天守はこの上（HONMARU+1）に建つ
const AIR = 0;

/** 長方形の「ふち」だけに木を置く（廻縁の床・高欄の手すり用） */
function woodRing(b: Build, x0: number, z0: number, x1: number, z1: number, y: number, wood: number): void {
  for (let x = x0; x <= x1; x++) {
    b.set(x, y, z0, wood);
    b.set(x, y, z1, wood);
  }
  for (let z = z0 + 1; z < z1; z++) {
    b.set(x0, y, z, wood);
    b.set(x1, y, z, wood);
  }
}

/**
 * 三角の破風（はふ）。屋根の上に立つ白い三角の壁＋ふちの濃い瓦。
 * axis='z' なら z 一定の面（手前・奥向き）、'x' なら x 一定の面（左右向き）。
 * c＝三角のまん中、y0＝いちばん下の段、w＝段の数（下の段の白は c-w+1〜c+w-1）。
 */
function gable(
  b: Build,
  axis: 'x' | 'z',
  c: number,
  y0: number,
  plane: number,
  w: number,
  white: number,
  roofTile: number,
): void {
  const put = (u: number, y: number, id: number) =>
    axis === 'z' ? b.set(u, y, plane, id) : b.set(plane, y, u, id);
  for (let i = 0; i < w; i++) {
    const half = w - 1 - i;
    for (let u = c - half; u <= c + half; u++) put(u, y0 + i, white);
    put(c - half - 1, y0 + i, roofTile);
    put(c + half + 1, y0 + i, roofTile);
  }
  put(c, y0 + w, roofTile); // てっぺん
}

/**
 * 天守（望楼型・4重）。写真に合わせて：
 *   - 石の天守台の上に、白壁＋大きく張り出した濃い瓦屋根を4段
 *   - 1段目の屋根の四方に、大きな三角の破風（入母屋破風・千鳥破風）
 *   - 最上階は木の廻縁（ベランダ）と高欄（手すり）が一周し、屋根は前後に三角の破風
 *   - 棟の両端に鯱（しゃちほこ）
 * baseY＝天守台のいちばん下。正面＝cz+（手前）。
 */
function tenshu(
  b: Build,
  cx: number,
  cz: number,
  baseY: number,
  white: number,
  roofTile: number,
  wood: number,
  shachi: number,
  stoneWall: number,
): void {
  // ===== 天守台（石垣。下がわずかに広い） =====
  b.box(cx - 6, baseY, cz - 6, cx + 6, baseY + 1, cz + 6, stoneWall);
  b.box(cx - 5, baseY + 2, cz - 5, cx + 5, baseY + 2, cz + 5, stoneWall);

  // ===== 1重目（白壁・4段）＋窓 =====
  const y1 = baseY + 3;
  b.box(cx - 5, y1, cz - 5, cx + 5, y1 + 3, cz + 5, white);
  for (const d of [-3, 0, 3]) {
    b.set(cx + d, y1 + 2, cz + 5, wood); // 正面の窓
    b.set(cx + d, y1 + 2, cz - 5, wood); // 背面
    b.set(cx + 5, y1 + 2, cz + d, wood); // 右
    b.set(cx - 5, y1 + 2, cz + d, wood); // 左
  }
  // 1重目の屋根（広く張り出す）
  b.box(cx - 6, y1 + 4, cz - 6, cx + 6, y1 + 4, cz + 6, roofTile);
  b.box(cx - 5, y1 + 5, cz - 5, cx + 5, y1 + 5, cz + 5, roofTile);

  // ===== 2重目（白壁・2段） =====
  const y2 = y1 + 6;
  b.box(cx - 4, y2, cz - 4, cx + 4, y2 + 1, cz + 4, white);
  // 四方の大きな三角の破風（屋根の上に立つ）
  gable(b, 'z', cx, y1 + 5, cz + 6, 3, white, roofTile);
  gable(b, 'z', cx, y1 + 5, cz - 6, 3, white, roofTile);
  gable(b, 'x', cz, y1 + 5, cx + 6, 3, white, roofTile);
  gable(b, 'x', cz, y1 + 5, cx - 6, 3, white, roofTile);
  // 破風の小窓
  b.set(cx, y1 + 6, cz + 6, wood);
  b.set(cx + 6, y1 + 6, cz, wood);
  b.set(cx - 6, y1 + 6, cz, wood);
  // 2重目の屋根
  b.box(cx - 5, y2 + 2, cz - 5, cx + 5, y2 + 2, cz + 5, roofTile);
  b.box(cx - 4, y2 + 3, cz - 4, cx + 4, y2 + 3, cz + 4, roofTile);

  // ===== 3重目（白壁・2段） =====
  const y3 = y2 + 4;
  b.box(cx - 3, y3, cz - 3, cx + 3, y3 + 1, cz + 3, white);
  b.set(cx - 1, y3 + 1, cz + 3, wood);
  b.set(cx + 1, y3 + 1, cz + 3, wood);
  // 3重目の屋根（前に小さな破風）
  b.box(cx - 4, y3 + 2, cz - 4, cx + 4, y3 + 2, cz + 4, roofTile);
  gable(b, 'z', cx, y3 + 2, cz + 5, 2, white, roofTile);

  // ===== 4重目（最上階）：木の廻縁と高欄が一周 =====
  const y4 = y3 + 3;
  b.box(cx - 3, y4, cz - 3, cx + 3, y4, cz + 3, wood); // 廻縁の床
  woodRing(b, cx - 3, cz - 3, cx + 3, cz + 3, y4 + 1, wood); // 高欄（手すり）
  b.box(cx - 2, y4 + 1, cz - 2, cx + 2, y4 + 2, cz + 2, white); // 最上階の白い壁
  b.box(cx - 1, y4 + 2, cz + 2, cx + 1, y4 + 2, cz + 2, wood); // 正面の窓
  // 最上階の屋根（入母屋。前後に三角の破風）
  b.box(cx - 3, y4 + 3, cz - 3, cx + 3, y4 + 3, cz + 3, roofTile);
  b.box(cx - 2, y4 + 4, cz - 2, cx + 2, y4 + 4, cz + 2, roofTile);
  gable(b, 'z', cx, y4 + 4, cz + 3, 2, white, roofTile);
  gable(b, 'z', cx, y4 + 4, cz - 3, 2, white, roofTile);
  b.box(cx, y4 + 5, cz - 2, cx, y4 + 5, cz + 2, roofTile); // 棟（前後にのびる）
  // 鯱（しゃちほこ）を棟の両端に
  b.set(cx, y4 + 6, cz - 2, shachi);
  b.set(cx, y4 + 6, cz + 2, shachi);
}

/**
 * 本丸御殿（懐徳館）。天守の東どなりに建つ低い白壁の御殿。
 * 廊下で天守と直結する（天守と本丸御殿が両方現存するのは全国で高知城だけ）。
 */
function goten(b: Build, white: number, roofTile: number, wood: number): void {
  const y0 = HONMARU + 1; // 床の高さ＝天守1重目と同じ
  // 白漆喰の壁（x51〜57, z33〜43 の外周）
  b.box(51, y0, 33, 57, y0 + 1, 33, white); // 奥
  b.box(51, y0, 43, 57, y0 + 1, 43, white); // 手前（正面）
  b.box(51, y0, 34, 51, y0 + 1, 42, white); // 左
  b.box(57, y0, 34, 57, y0 + 1, 42, white); // 右
  // 正面の入口（開ける）と連子窓
  b.set(54, y0, 43, AIR);
  b.set(54, y0 + 1, 43, AIR);
  b.set(52, y0 + 1, 43, wood);
  b.set(56, y0 + 1, 43, wood);
  // 低い瓦屋根（軒が広く張り出す）＋棟
  b.box(50, y0 + 2, 32, 58, y0 + 2, 44, roofTile);
  b.box(52, y0 + 3, 34, 56, y0 + 3, 42, roofTile);
  // 天守へ渡る廊下（西へ直結）
  b.box(50, y0, 37, 50, y0 + 1, 39, white);
}

/**
 * 山内一豊の騎馬像（写真に合わせて：大きな四角い台座の上に、前脚を上げた馬と、かぶとの武将）。
 * 入口側（z+）を向く。国内最大級の騎馬像。
 */
function kazutoyoStatue(
  b: Build,
  x: number,
  z: number,
  stone: number,
  stoneWall: number,
  bronze: number,
  dark: number,
  gold: number,
): void {
  b.box(x - 3, PARK + 1, z - 3, x + 3, PARK + 1, z + 3, stone); // 台座の土台
  b.box(x - 2, PARK + 2, z - 3, x + 2, PARK + 4, z + 2, stoneWall); // 台座（四角く大きい）
  b.set(x, PARK + 3, z + 3, dark); // 前の銘板
  b.box(x - 2, PARK + 5, z - 3, x + 2, PARK + 5, z + 2, stone); // 台座の上のふち
  horseRider(b, x, PARK + 5, z, 1, bronze, dark, gold);
}

/** 追手門（櫓門）。cx を中心に、石垣の親柱＋木の門扉＋上に白壁の櫓と瓦屋根。 */
function otemonGate(
  b: Build,
  cx: number,
  white: number,
  roofTile: number,
  wood: number,
  stoneWall: number,
): void {
  // 石垣の親柱（左右）
  b.box(cx - 7, PARK + 1, 58, cx - 5, HONMARU, 60, stoneWall);
  b.box(cx + 5, PARK + 1, 58, cx + 7, HONMARU, 60, stoneWall);
  // 木の門扉（中央 x46〜50 は通れるよう開けておく）
  b.box(cx - 4, PARK + 1, 59, cx - 3, PARK + 4, 59, wood);
  b.box(cx + 3, PARK + 1, 59, cx + 4, PARK + 4, 59, wood);
  // まぐさ（門の上の梁）＝櫓を支える
  b.box(cx - 4, HONMARU, 58, cx + 4, HONMARU, 60, wood);
  // 門の上の小さな屋根（庇）
  b.box(cx - 5, HONMARU - 1, 61, cx + 5, HONMARU - 1, 61, roofTile);
  // 櫓（白壁）
  b.box(cx - 7, HONMARU + 1, 58, cx + 7, HONMARU + 3, 60, white);
  // 写真の大きな木の格子窓（正面のまん中）
  b.box(cx - 2, HONMARU + 2, 60, cx + 2, HONMARU + 2, 60, wood);
  // 櫓の瓦屋根
  b.box(cx - 8, HONMARU + 4, 57, cx + 8, HONMARU + 4, 61, roofTile);
  b.box(cx - 7, HONMARU + 5, 58, cx + 7, HONMARU + 5, 60, roofTile);
  b.box(cx - 6, HONMARU + 6, 59, cx + 6, HONMARU + 6, 59, roofTile); // 棟
  // 左の高い櫓（写真の左に立つ、三角の破風のある2階）
  b.box(cx - 8, HONMARU + 5, 57, cx - 4, HONMARU + 8, 61, white);
  b.set(cx - 7, HONMARU + 7, 61, wood); // 窓
  b.set(cx - 5, HONMARU + 7, 61, wood);
  b.box(cx - 9, HONMARU + 9, 56, cx - 3, HONMARU + 9, 62, roofTile); // 屋根
  b.box(cx - 8, HONMARU + 10, 57, cx - 4, HONMARU + 10, 61, roofTile);
  gable(b, 'z', cx - 6, HONMARU + 10, 62, 2, white, roofTile); // 正面の破風
  b.box(cx - 6, HONMARU + 11, 57, cx - 6, HONMARU + 11, 61, roofTile); // 棟
}

/**
 * 板垣退助の銅像（写真に合わせて：細長い石の台座の上に、右手を横へのばした着物と袴の立ち姿）。
 * 実物は台座 約4.2m＞像 約2.2m ＝台座の方が高い。石段の方（z+）を向く。
 */
function bronzeStatue(b: Build, x: number, z: number, stone: number, bronze: number, dark: number): void {
  b.box(x - 1, PARK + 1, z - 1, x + 1, PARK + 6, z + 1, stone); // 細長い台座
  kimonoFigure(b, x, PARK + 6, z, 1, bronze, dark, 'point');
}

/** 桜の木（木の幹＋ふっくら丸い花のかたまり。下を広く、上を細く） */
function sakuraTree(b: Build, x: number, z: number, trunkH: number, wood: number, sakura: number): void {
  for (let i = 1; i <= trunkH; i++) b.set(x, PARK + i, z, wood);
  const t = PARK + trunkH; // 幹の上
  b.disc(x, z, t, 2, sakura); // 下の段（広い）
  b.disc(x, z, t + 1, 2, sakura);
  b.disc(x, z, t + 2, 1, sakura); // 上の段（細い）
  b.set(x, t + 3, z, sakura); // てっぺん
}

/** 石灯籠（石の柱＋灯りのかさ） */
function stoneLantern(b: Build, x: number, groundTop: number, z: number, stone: number, lantern: number): void {
  b.set(x, groundTop + 1, z, stone);
  b.set(x, groundTop + 2, z, lantern);
}

function build(world: World): void {
  const b = new Build();
  const stone = b.id('stone');
  const stonewall = b.id('stonewall'); // 石垣
  const castlewall = b.id('castlewall'); // 白漆喰の白壁・看板
  const tile = b.id('tile'); // 濃い瓦屋根
  const wood = b.id('wood');
  const bronze = b.id('bronze'); // 銅像
  const bronzeDark = b.id('bronzedark'); // 銅像の濃い所
  const turf = b.id('turf'); // 公園の芝
  const road = b.id('road'); // 参道（石畳）
  const sakura = b.id('sakura'); // 桜
  const lantern = b.id('lantern'); // 灯籠・鯱の金
  const flower = b.id('flower');

  // ===== 地面 =====
  b.box(28, 8, 26, 68, 9, 69, stone); // 岩盤
  b.box(28, PARK, 53, 68, PARK, 69, turf); // 手前の大きな芝の広場（全幅・平ら＝建築スペース）

  // ===== 本丸の石垣（勾配のある高い石垣。天守はこの上に建つ） =====
  // 段が上がるほど内側に入れて「ハ」の字の勾配を表す。天端 = HONMARU。
  b.box(34, PARK, 28, 62, PARK + 1, 52, stonewall); // 最下段（2段ぶん）
  b.box(35, PARK + 2, 29, 61, PARK + 3, 52, stonewall); // 中段
  b.box(36, PARK + 4, 30, 60, HONMARU, 51, stonewall); // 上段＋天端（本丸の床）

  // 石樋（せきひ）＝石垣から突き出た雨水の排水口。雨の多い高知ならではの現存遺構
  b.set(39, PARK + 3, 53, stone);
  b.set(57, PARK + 3, 53, stone);

  // ===== 石段（公園 → 本丸へ。1段ずつ上がる） =====
  for (let z = 56; z >= 52; z--) {
    const topY = PARK + (57 - z); // z56→11, z55→12, … z52→15
    b.box(44, PARK, z, 52, topY, z, stonewall);
  }

  // ===== 本丸の白い塀（奥と左右を囲む。手前は石段のため開ける） =====
  b.box(37, HONMARU + 1, 31, 59, HONMARU + 2, 31, castlewall); // 奥
  b.box(37, HONMARU + 3, 31, 59, HONMARU + 3, 31, tile); // 瓦のかさ
  b.box(37, HONMARU + 1, 32, 37, HONMARU + 2, 50, castlewall); // 左
  b.box(37, HONMARU + 3, 32, 37, HONMARU + 3, 50, tile);
  b.box(59, HONMARU + 1, 32, 59, HONMARU + 2, 50, castlewall); // 右
  b.box(59, HONMARU + 3, 32, 59, HONMARU + 3, 50, tile);

  // ===== 天守（実物と同じく本丸の奥・西寄り。手前＝cz+ 側を正面に） =====
  tenshu(b, 44, 38, HONMARU + 1, castlewall, tile, wood, tile, stonewall);

  // ===== 本丸御殿（懐徳館）＝天守の東どなり。廊下で天守と直結（現存は全国で高知城だけ） =====
  goten(b, castlewall, tile, wood);

  // 本丸の松（前庭の両隅に小さく）
  b.pine(38, HONMARU, 49, 3, 3, 1);
  b.pine(58, HONMARU, 49, 3, 3, 1);

  // ===== 追手門（手前。門と天守を一緒に見られる名物の眺め） =====
  otemonGate(b, 48, castlewall, tile, wood, stonewall);

  // ===== 参道（石畳）＋ 入口の灯籠（門の前に2つだけ・スッキリ） =====
  b.box(47, PARK, 57, 49, PARK, 69, road);
  stoneLantern(b, 45, PARK, 67, stone, lantern);
  stoneLantern(b, 51, PARK, 67, stone, lantern);

  // ===== 桜（お花見の名所）＝広場の「ふち」に置いて中央は開ける（建築スペース確保） =====
  // スポーン(右手前)からの「門＋天守」の眺めを塞がないよう、右手前は空けて左右のふちに寄せる
  const trees: [number, number, number][] = [
    [31, 57, 3],
    [31, 65, 4],
    [35, 55, 3],
    [30, 54, 3],
    [65, 65, 4],
    [66, 53, 3],
  ];
  for (const [x, z, h] of trees) sakuraTree(b, x, z, h, wood, sakura);
  // 木の根もとに少しだけ花
  b.set(31, PARK, 61, flower);
  b.set(65, PARK, 61, flower);

  // ===== 板垣退助の銅像（実物と同じ、追手門をくぐった石段の上り口・左脇） =====
  bronzeStatue(b, 39, 54, stone, bronze, bronzeDark);

  // ===== 山内一豊の騎馬像（実物と同じ、追手門の手前の広場） =====
  kazutoyoStatue(b, 36, 65, stone, stonewall, bronze, bronzeDark, lantern);


  world.setBlocksBatch(b.cells);
}

export const kochiCastle: SpotDefinition = {
  id: 'kochi-castle',
  name: 'Kochi Castle',
  nameJa: '高知城',
  emoji: '🏯',
  available: true,
  center: { x: 46, y: 24, z: 40 },
  viewDistance: 64,
  // スポーンは広場の右手前＝実物の撮影スポットと同じく「追手門と天守を斜めに一緒に見る」構図
  spawn: { pos: { x: 63, y: 11, z: 67 }, yaw: 0.58 },
  // 歩ける範囲＝建築できる範囲＝作り込んだ地面（岩盤 x28–68, z26–69）。外の空中へは出られない
  field: { min: { x: 28, y: 0, z: 26 }, max: { x: 68, y: 0, z: 69 } },
  // 高知市の中心。まわりは街で、遠くに山並み
  backdrop: { near: 'city', far: 'mountains' },
  build,
  objects: [
    {
      id: 'tenshu',
      name: 'Kochi Castle',
      nameJa: '高知城（天守）',
      region: { min: { x: 37, y: 16, z: 31 }, max: { x: 51, y: 39, z: 45 } },
      focus: { x: 44, y: 28, z: 38 },
      image: './photos/kochi-castle/tenshu.jpg',
      credit: 'Photo: 663highland / CC BY 2.5 / Wikimedia Commons',
      guide: {
        canDo: 'You can look up at the tall castle tower.',
        feature: 'It is white.',
        about: 'It is very old.',
      },
    },
    {
      id: 'goten',
      name: 'Castle Palace',
      nameJa: '本丸御殿（懐徳館）',
      region: { min: { x: 50, y: 16, z: 32 }, max: { x: 58, y: 20, z: 45 } },
      focus: { x: 54, y: 18, z: 38 },
      image: './photos/kochi-castle/goten.jpg',
      credit: 'Photo: Suicasmo / CC BY-SA 4.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can see an old palace next to the tower.',
        feature: 'It is an old house.',
        about: 'It is next to the castle.',
      },
    },
    {
      id: 'stone-walls',
      name: 'Stone Walls',
      nameJa: '石垣と石樋',
      region: { min: { x: 34, y: 11, z: 46 }, max: { x: 62, y: 16, z: 53 } },
      focus: { x: 48, y: 13, z: 52 },
      image: './photos/kochi-castle/stone-walls.jpg',
      credit: 'Photo: 京浜にけ / CC BY-SA 3.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can find stone pipes on the wall.',
        feature: 'The wall is high.',
        about: 'Water comes out of the pipes.',
      },
    },
    {
      id: 'otemon',
      name: 'Otemon Gate',
      nameJa: '追手門',
      region: { min: { x: 39, y: 11, z: 56 }, max: { x: 55, y: 27, z: 62 } },
      focus: { x: 48, y: 16, z: 59 },
      image: './photos/kochi-castle/otemon.jpg',
      guide: {
        canDo: 'You can walk through the big gate.',
        feature: 'It is a big gate.',
        about: 'Let\'s take a photo!',
      },
    },
    {
      id: 'cherry',
      name: 'Cherry Trees',
      nameJa: '桜',
      region: { min: { x: 28, y: 11, z: 53 }, max: { x: 68, y: 19, z: 69 } },
      focus: { x: 31, y: 15, z: 61 },
      image: './photos/kochi-castle/cherry.jpg',
      credit: 'Photo: NevinThompson / CC BY-SA 4.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can see pink flowers in spring.',
        feature: 'They are pink.',
        about: 'They are pretty in spring.',
      },
    },
    {
      id: 'statue',
      name: 'Statue of Itagaki Taisuke',
      nameJa: '板垣退助像',
      region: { min: { x: 35, y: 11, z: 52 }, max: { x: 41, y: 26, z: 56 } },
      focus: { x: 39, y: 19, z: 54 },
      image: './photos/kochi-castle/statue.jpg',
      guide: {
        canDo: 'You can see a bronze statue.',
        feature: 'He is Itagaki Taisuke.',
        about: 'He is a great man of Kochi.',
      },
    },
    {
      id: 'kazutoyo',
      name: 'Statue of Yamauchi Kazutoyo',
      nameJa: '山内一豊の騎馬像',
      region: { min: { x: 33, y: 11, z: 62 }, max: { x: 39, y: 25, z: 69 } },
      focus: { x: 36, y: 19, z: 65 },
      image: './photos/kochi-castle/kazutoyo.jpg',
      guide: {
        canDo: 'You can see a man on a horse.',
        feature: 'He is on a horse.',
        about: 'He is Yamauchi Kazutoyo.',
      },
    },
    {
      id: 'steps',
      name: 'Stone Steps',
      nameJa: '石段',
      region: { min: { x: 44, y: 11, z: 52 }, max: { x: 52, y: 16, z: 56 } },
      focus: { x: 48, y: 14, z: 54 },
      image: './photos/kochi-castle/steps.jpg',
      credit: 'Photo: z tanuki / CC BY 3.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can walk up the stone steps.',
        feature: 'They are old stones.',
        about: 'Let\'s go to the castle!',
      },
    },
  ],
};
