import type { World } from '@/world/World';
import { Build } from './Build';
import type { SpotDefinition } from './SpotDefinition';

/**
 * 室戸岬（Cape Muroto）— 太平洋に突き出す、荒々しい岩礁の岬（ユネスコ世界ジオパーク）。
 * 実物の特徴を色ボクセルで再現：
 *   - 海に突き出す岬と、波がつくった「ゴツゴツした暗い岩礁」（大地は今も隆起し続ける）。
 *   - 白い「室戸岬灯台」＝実物どおり高台（丘）の上。光の強さは日本一級。
 *   - あたたかい土地なので育つ「ヤシ（ビロウ）」と、根がタコの足のように広がる「アコウの木」。
 *   - 海を見つめる「中岡慎太郎像」（乱礁遊歩道の入口。坂本龍馬の盟友）。
 *   - 海辺の岩屋（御厨人窟ふう。若き日の空海が「空と海だけを見た」物語）。
 *   - 広い陸地は自由に建築できるスペース。
 *
 * 座標の目安：小さい z＝奥（沖・先端）／大きい z＝手前（入口・スポーン）。
 *   陸: 手前 z44〜69（広い）→ 先端 z30〜43（細い）。まわりは海。
 */

const LAND = 12; // 岬の陸地の上面。立つのは LAND+1
const SEA = 10; // 海面
const AIR = 0;

/** 長方形の「ふち」だけに置く（灯台の手すり用） */
function woodRing(b: Build, x0: number, z0: number, x1: number, z1: number, y: number, id: number): void {
  for (let x = x0; x <= x1; x++) {
    b.set(x, y, z0, id);
    b.set(x, y, z1, id);
  }
  for (let z = z0 + 1; z < z1; z++) {
    b.set(x0, y, z, id);
    b.set(x1, y, z, id);
  }
}

/** 白い灯台（室戸岬灯台）。白い塔＋廻縁＋ガラスの灯り部屋＋黒い屋根。 */
function lighthouse(
  b: Build,
  cx: number,
  cz: number,
  by: number,
  white: number,
  glass: number,
  light: number,
  dark: number,
  wood: number,
): void {
  b.box(cx - 2, by, cz - 2, cx + 2, by, cz + 2, white); // 土台 5x5
  b.box(cx - 1, by, cz - 1, cx + 1, by + 7, cz + 1, white); // 白い塔（8段）
  woodRing(b, cx - 2, cz - 2, cx + 2, cz + 2, by + 7, wood); // 廻縁（手すり）
  b.box(cx - 1, by + 8, cz - 1, cx + 1, by + 9, cz + 1, glass); // 灯り部屋（ガラス）
  b.set(cx, by + 8, cz, light); // 灯り
  b.box(cx - 1, by + 10, cz - 1, cx + 1, by + 10, cz + 1, dark); // 屋根
  b.set(cx, by + 11, cz, dark);
}

/** 中岡慎太郎像（石の台座＋ブロンズの立ち姿。海の方を見て、片腕を上げる）。 */
function statue(b: Build, x: number, z: number, stone: number, bronze: number, dark: number): void {
  b.box(x - 1, LAND + 1, z - 1, x + 1, LAND + 2, z + 1, stone); // 台座
  const py = LAND + 2;
  b.set(x, py + 1, z, dark); // 足元
  b.set(x, py + 2, z, bronze); // 胴
  b.set(x, py + 3, z, bronze); // 胸
  b.set(x - 1, py + 3, z - 1, bronze); // 海の方へ伸ばした腕
  b.set(x, py + 4, z, dark); // 頭
}

/** ヤシ（ビロウ）：細い幹＋てっぺんに四方へ広がる葉。 */
function palm(b: Build, x: number, z: number, h: number, wood: number, frond: number): void {
  for (let i = 1; i <= h; i++) b.set(x, LAND + i, z, wood);
  const t = LAND + h;
  for (const [dx, dz] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
    [-1, -1],
    [1, 1],
  ] as const) {
    b.set(x + dx, t, z + dz, frond);
  }
  b.set(x, t + 1, z, frond);
}

/** アコウの木：太い幹＋タコの足のように広がる根＋丸い樹冠（実物は天然記念物の大樹）。 */
function akouTree(b: Build, x: number, z: number, wood: number, leaf: number): void {
  // タコの足のような根（地面の上を四方へ這う）
  for (const [dx, dz] of [
    [-2, 0],
    [-1, 0],
    [1, 0],
    [2, 0],
    [0, -2],
    [0, -1],
    [0, 1],
    [0, 2],
    [-1, -1],
    [1, 1],
  ] as const) {
    b.set(x + dx, LAND + 1, z + dz, wood);
  }
  b.box(x, LAND + 1, z, x, LAND + 4, z, wood); // 幹
  b.sphere(x, LAND + 6, z, 2, leaf); // 丸い樹冠
}

function build(world: World): void {
  const b = new Build();
  const stone = b.id('stone'); // 岩（灰）
  const tile = b.id('tile'); // 暗い岩（岩礁の頂・斑れい岩っぽく）
  const water = b.id('water');
  const grass = b.id('grass');
  const castlewall = b.id('castlewall'); // 白い灯台・看板・波しぶき
  const glass = b.id('glass');
  const lantern = b.id('lantern'); // 灯台の灯り
  const wood = b.id('wood'); // 手すり・遊歩道・看板
  const leaves = b.id('leaves'); // ヤシの葉
  const roof = b.id('roof'); // ブロンズ（像）
  const road = b.id('road'); // 遊歩道（乱礁遊歩道）
  const flower = b.id('flower');

  // ===== 海と海底 =====
  b.box(28, 7, 26, 68, 8, 69, stone); // 海底・岩盤
  b.box(28, 9, 26, 68, SEA, 69, water); // 海 y9〜10（まず全面）

  // ===== 岬（陸地）＝海へ突き出す。手前は広く、奥（先端）は細く・岩肌に =====
  b.box(32, 9, 44, 64, LAND, 69, stone); // 手前の広い陸（中身）
  b.box(32, LAND, 44, 64, LAND, 69, grass); // 草の上面（建築スペース）
  b.box(40, 9, 34, 56, LAND, 43, stone); // 細くなる部分
  b.box(40, LAND, 34, 56, LAND, 43, stone); // 先端は岩肌
  b.box(44, 9, 30, 52, LAND, 33, stone); // 先端
  b.box(44, LAND, 30, 52, LAND, 33, stone);

  // ===== 荒々しい岩礁（暗い頂の岩が海から突き出す） =====
  b.mound(48, 28, 8, 17, 4, stone, tile); // 先端沖の大岩
  b.mound(38, 30, 8, 14, 3, stone, tile);
  b.mound(58, 30, 8, 15, 3, stone, tile);
  b.mound(34, 38, 8, 16, 3, stone, tile);
  b.mound(62, 40, 8, 15, 3, stone, tile);
  b.mound(30, 50, 8, 13, 2, stone, tile); // 左の岩
  b.mound(66, 52, 8, 13, 2, stone, tile); // 右の岩

  // ===== 波しぶき（岩や岸のきわに白） =====
  for (const [x, z] of [
    [44, 33],
    [52, 33],
    [40, 36],
    [56, 36],
    [36, 44],
    [60, 44],
    [48, 31],
  ] as const) {
    b.set(x, SEA, z, castlewall);
  }

  // ===== 灯台の丘（実物の灯台は岬の高台の上に建つ。緑の丘） =====
  b.mound(57, 53, LAND, LAND + 5, 6, grass, grass);
  b.disc(57, 53, LAND + 5, 2, grass); // 頂上を平らに広げる（灯台の土台が乗る）

  // ===== 白い灯台（室戸岬灯台）＝丘の上。光の強さは日本一級 =====
  lighthouse(b, 57, 53, LAND + 6, castlewall, glass, lantern, tile, wood);

  // ===== 中岡慎太郎像（乱礁遊歩道の入口で海を見つめる） =====
  statue(b, 38, 42, stone, roof, tile);

  // ===== 海辺の岩屋（御厨人窟ふう。空と海だけが見える洞窟の物語） =====
  b.mound(34, 47, 9, 17, 4, stone, grass);
  b.box(34, 13, 46, 34, 14, 50, AIR); // 入口の通路（手前から入れる）
  b.box(33, 13, 46, 35, 14, 47, AIR); // 奥の小部屋

  // ===== 乱礁遊歩道（陸から先端の岩へ） =====
  b.box(46, LAND, 34, 50, LAND, 44, road);

  // ===== アコウの木（根がタコの足のように広がる天然記念物の大樹） =====
  akouTree(b, 37, 53, wood, leaves);

  // ===== ヤシ（あたたかい岬の木）＝丘・洞窟をよけて配置 =====
  palm(b, 44, 58, 6, wood, leaves);
  palm(b, 32, 62, 7, wood, leaves);
  palm(b, 64, 58, 6, wood, leaves);
  palm(b, 36, 66, 6, wood, leaves);

  // ===== 花で彩り =====
  b.set(42, LAND, 50, flower);
  b.set(42, LAND, 62, flower);

  // ===== 看板（入口・右） =====
  b.pillar(56, 64, LAND + 1, LAND + 2, wood);
  b.box(55, LAND + 3, 64, 57, LAND + 4, 64, castlewall);

  world.setBlocksBatch(b.cells);
}

export const muroto: SpotDefinition = {
  id: 'muroto',
  name: 'Cape Muroto',
  nameJa: '室戸岬',
  emoji: '🌊',
  available: true,
  center: { x: 48, y: 14, z: 44 },
  viewDistance: 60,
  spawn: { pos: { x: 48, y: LAND + 1, z: 66 }, yaw: 0 },
  field: { min: { x: 28, y: 0, z: 26 }, max: { x: 68, y: 0, z: 69 } },
  build,
  objects: [
    {
      id: 'rocks',
      name: 'Cape Muroto',
      nameJa: '室戸岬（岩礁）',
      region: { min: { x: 34, y: 9, z: 28 }, max: { x: 62, y: 18, z: 43 } },
      focus: { x: 48, y: 13, z: 33 },
      image: './photos/muroto/rocks.jpg',
      guide: {
        canDo: 'You can walk on the wild rocks.',
        feature: 'They are big and dark.',
        about: 'The land here goes up very slowly. The sea made these rocks.',
      },
    },
    {
      id: 'lighthouse',
      name: 'Muroto Lighthouse',
      nameJa: '室戸岬灯台',
      image: './photos/muroto/lighthouse.jpg',
      region: { min: { x: 53, y: 17, z: 49 }, max: { x: 61, y: 30, z: 57 } },
      focus: { x: 57, y: 24, z: 53 },
      guide: {
        canDo: 'You can climb the hill to the lighthouse.',
        feature: 'It is white. It is on a hill.',
        about: 'Its light is No.1 strong in Japan. It helps ships at night.',
      },
    },
    {
      id: 'sea',
      name: 'The Pacific Ocean',
      nameJa: '太平洋',
      region: { min: { x: 28, y: 9, z: 26 }, max: { x: 68, y: 11, z: 42 } },
      focus: { x: 30, y: 10, z: 34 },
      image: './photos/muroto/sea.jpg',
      guide: {
        canDo: 'You can look at the big blue ocean.',
        feature: 'It goes far, far away.',
        about: 'Big whales swim out there!',
      },
    },
    {
      id: 'statue',
      name: 'Statue of Nakaoka Shintaro',
      nameJa: '中岡慎太郎像',
      region: { min: { x: 36, y: 12, z: 40 }, max: { x: 40, y: 19, z: 44 } },
      focus: { x: 38, y: 15, z: 42 },
      image: './photos/muroto/statue.jpg',
      guide: {
        canDo: 'You can see a bronze statue.',
        feature: 'He looks at the sea.',
        about: 'He is Nakaoka Shintaro, a friend of Ryoma.',
      },
    },
    {
      id: 'akou',
      name: 'Akou Tree',
      nameJa: 'アコウの木',
      region: { min: { x: 33, y: 12, z: 49 }, max: { x: 41, y: 21, z: 57 } },
      focus: { x: 37, y: 16, z: 53 },
      image: './photos/muroto/akou.jpg',
      guide: {
        canDo: 'You can see a big old tree.',
        feature: 'Its roots are like octopus legs.',
        about: 'It is a big old tree. It is a treasure of Muroto.',
      },
    },
    {
      id: 'cave',
      name: 'Sea Cave',
      nameJa: '海辺の岩屋（御厨人窟）',
      region: { min: { x: 30, y: 12, z: 43 }, max: { x: 38, y: 18, z: 51 } },
      focus: { x: 34, y: 14, z: 48 },
      image: './photos/muroto/cave.jpg',
      guide: {
        canDo: 'You can go into the small cave.',
        feature: 'It is dark and quiet.',
        about: 'A young man lived here long ago. He saw only the sky and the sea.',
      },
    },
    {
      id: 'palms',
      name: 'Palm Trees',
      nameJa: 'ヤシの木',
      region: { min: { x: 30, y: 12, z: 58 }, max: { x: 42, y: 20, z: 68 } },
      focus: { x: 34, y: 16, z: 62 },
      image: './photos/muroto/palms.jpg',
      guide: {
        canDo: 'You can see palm trees.',
        feature: 'They are tall. They have big leaves.',
        about: 'Muroto is warm. So they are happy here!',
      },
    },
    {
      id: 'sign',
      name: 'Information Sign',
      nameJa: '看板',
      region: { min: { x: 55, y: 13, z: 63 }, max: { x: 57, y: 18, z: 65 } },
      focus: { x: 56, y: 15, z: 64 },
      image: './photos/muroto/sign.jpg',
      guide: {
        canDo: 'You can read about this place.',
        feature: 'It is about Cape Muroto.',
        about: 'This is a sign. It helps you learn about Cape Muroto.',
      },
    },
  ],
};
