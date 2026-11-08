import type { World } from '@/world/World';
import { Build } from './Build';
import { kimonoFigure } from './statues';
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

/**
 * 白い灯台（室戸岬灯台）。写真に合わせて、ぜんぶ白：
 *   - 下に丸くて低い白い建物（土台）
 *   - 白い塔の途中を、白い手すりのベランダが一周
 *   - 上にガラスの灯り部屋（中に大きなレンズ）、てっぺんは白い丸屋根
 */
function lighthouse(
  b: Build,
  cx: number,
  cz: number,
  by: number,
  white: number,
  glass: number,
  light: number,
  dark: number,
): void {
  b.disc(cx, cz, by, 3, white); // 丸い土台の建物（2段）
  b.disc(cx, cz, by + 1, 3, white);
  b.box(cx - 1, by + 2, cz - 1, cx + 1, by + 6, cz + 1, white); // 白い塔
  b.box(cx - 2, by + 5, cz - 2, cx + 2, by + 5, cz + 2, white); // ベランダの床
  woodRing(b, cx - 2, cz - 2, cx + 2, cz + 2, by + 6, white); // 白い手すり
  b.box(cx - 1, by + 7, cz - 1, cx + 1, by + 8, cz + 1, glass); // ガラスの灯り部屋
  b.set(cx, by + 7, cz, light); // 大きなレンズ
  b.set(cx, by + 8, cz, light);
  b.box(cx - 1, by + 9, cz - 1, cx + 1, by + 9, cz + 1, white); // 白い丸屋根
  b.set(cx, by + 10, cz, white);
  b.set(cx, by + 11, cz, dark); // 避雷針
}

/** 中岡慎太郎像（写真に合わせて：石を積んだ四角い台座の上に、海を見つめて立つ姿）。 */
function statue(b: Build, x: number, z: number, stone: number, stoneW: number, bronze: number, dark: number): void {
  b.box(x - 1, 9, z - 1, x + 1, LAND + 2, z + 1, stoneW); // 岩場から立ち上がる石積みの台座
  b.box(x - 1, LAND + 3, z - 1, x + 1, LAND + 3, z + 1, stone); // 台座の上の石
  kimonoFigure(b, x, LAND + 3, z, -1, bronze, dark, 'stand'); // 海（-z）を見つめる
}

/**
 * 黒くゴツゴツした岩礁（写真の室戸の岩）。
 * 半径 r の中に、高さのちがう岩の柱をでこぼこに立て、とがった頂をつくる。
 */
function jaggedRock(b: Build, x: number, z: number, h: number, r: number, rock: number, darkRock: number): void {
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > r + 0.3) continue;
      const bump = ((x + dx) * 7 + (z + dz) * 13) % 3; // でこぼこ
      const top = Math.round(8 + (h - 8) * (1 - d / (r + 1))) + bump - 1;
      if (top < 9) continue;
      b.box(x + dx, 8, z + dz, x + dx, top - 1, z + dz, darkRock);
      b.set(x + dx, top, z + dz, (dx + dz) % 2 === 0 ? rock : darkRock);
    }
  }
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
  const bronze = b.id('bronze'); // 銅像
  const bronzeDark = b.id('bronzedark'); // 銅像の濃い所
  const darkRock = b.id('road'); // 黒っぽい岩（室戸の岩礁）
  const stonewall = b.id('stonewall'); // 像の石積みの台座
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

  // ===== 荒々しい岩礁（写真のように、黒くゴツゴツした岩が海岸にずらりと並ぶ） =====
  // 岬の先の陸も、平らな岩ではなく黒い岩場にする
  for (let x = 40; x <= 56; x++) {
    for (let z = 30; z <= 43; z++) {
      if (x >= 46 && x <= 50) continue; // 遊歩道は平らなまま
      const h = (x * 5 + z * 3) % 4;
      if (h === 0) b.set(x, LAND, z, darkRock);
      else if (h === 2) b.box(x, LAND, z, x, LAND + 1, z, darkRock);
    }
  }
  for (const [x, z, h, r] of [
    [48, 27, 18, 3], // 先端沖の大岩
    [40, 30, 16, 3],
    [57, 30, 17, 3],
    [35, 36, 16, 3],
    [61, 38, 15, 3],
    [37, 42, 14, 2],
    [59, 44, 14, 2],
    [30, 49, 14, 2], // 左の岩
    [66, 51, 14, 2], // 右の岩
    [31, 30, 13, 2],
    [65, 30, 13, 2],
  ] as const) {
    jaggedRock(b, x, z, h, r, stone, darkRock);
  }

  // ===== 白い波しぶき（写真のように、岩のまわりの海が白くあわ立つ） =====
  for (let x = 28; x <= 68; x++) {
    for (let z = 26; z <= 46; z++) {
      // 岩や岸の近くだけ、まだらに白くする
      const nearRock = (x * 3 + z * 7) % 4 === 0;
      if (nearRock && (z <= 33 || x <= 39 || x >= 57)) b.set(x, SEA, z, castlewall);
    }
  }

  // ===== 灯台の丘（実物の灯台は岬の高台の上に建つ。緑の丘） =====
  b.mound(57, 53, LAND, LAND + 5, 6, grass, grass);
  b.disc(57, 53, LAND + 5, 2, grass); // 頂上を平らに広げる（灯台の土台が乗る）

  // ===== 白い灯台（室戸岬灯台）＝丘の上。光の強さは日本一級 =====
  lighthouse(b, 57, 53, LAND + 6, castlewall, glass, lantern, tile);

  // ===== 中岡慎太郎像（乱礁遊歩道の入口で海を見つめる） =====
  statue(b, 42, 45, stone, stonewall, bronze, bronzeDark);

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
  // 太平洋につき出た岬。三方が海で、うしろに森と山
  backdrop: { near: 'forest', far: 'mountains', sea: ['w', 'e', 'n'] },
  build,
  objects: [
    {
      id: 'rocks',
      name: 'Cape Muroto',
      nameJa: '室戸岬（岩礁）',
      region: { min: { x: 30, y: 9, z: 24 }, max: { x: 66, y: 19, z: 43 } },
      focus: { x: 48, y: 13, z: 33 },
      image: './photos/muroto/rocks.jpg',
      guide: {
        canDo: 'You can walk on the wild rocks.',
        feature: 'They are big and dark.',
        about: 'Long ago, these rocks were under the sea!',
      },
    },
    {
      id: 'lighthouse',
      name: 'Muroto Lighthouse',
      nameJa: '室戸岬灯台',
      image: './photos/muroto/lighthouse.jpg',
      region: { min: { x: 54, y: 17, z: 50 }, max: { x: 60, y: 29, z: 56 } },
      focus: { x: 57, y: 25, z: 53 },
      guide: {
        canDo: 'You can climb the hill to the lighthouse.',
        feature: 'It is white. It is on a hill.',
        about: 'Its light is very, very strong. It helps ships at night.',
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
      region: { min: { x: 40, y: 12, z: 42 }, max: { x: 44, y: 25, z: 47 } },
      focus: { x: 42, y: 19, z: 45 },
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
        about: 'Let\'s read the sign!',
      },
    },
  ],
};
