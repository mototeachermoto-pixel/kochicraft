import type { World } from '@/world/World';
import { Build } from './Build';
import type { SpotDefinition } from './SpotDefinition';

/**
 * 足摺岬（Cape Ashizuri）— 四国最南端の岬。室戸岬とちがい「高い断崖絶壁」が名物。
 * 実物の特徴を色ボクセルで再現：
 *   - 高い崖（実物は約80m）の上から太平洋を見下ろす。
 *   - 海へ張り出す「展望台」（ガラスの柵。270度パノラマ＝地球が丸く見える名所）。
 *   - 白い「足摺岬灯台」（高さ18m・国内最大級）。
 *   - 名物の「椿のトンネル」＝遊歩道の上に椿がアーチ状にかぶさる（つばきの岬・約6万本）。
 *   - 崖下の海に「白山洞門」ふうの岩のアーチ（波が空けた穴）。
 *   - 入口広場に「ジョン万次郎像」と「四国最南端の碑」。広い台地は建築スペース。
 *
 * 座標の目安：小さい z＝奥（海・崖下）／大きい z＝手前（入口・スポーン）。高さ：台地=20, 海=8。
 *   台地(崖の上): z38〜69／崖のふち: z38（展望台は z35 まで張り出す）／海(崖下): z26〜37
 */

const CLIFF = 20; // 崖の上（台地）の上面。立つのは CLIFF+1
const SEA = 8; // 崖下の海面（はるか下）

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

/** 白い灯台（足摺岬灯台）。白い塔＋廻縁＋ガラスの灯り部屋＋黒い屋根。 */
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
  b.box(cx - 2, by, cz - 2, cx + 2, by, cz + 2, white); // 土台
  b.box(cx - 1, by, cz - 1, cx + 1, by + 8, cz + 1, white); // 白い塔（やや高め）
  woodRing(b, cx - 2, cz - 2, cx + 2, cz + 2, by + 8, wood); // 廻縁
  b.box(cx - 1, by + 9, cz - 1, cx + 1, by + 10, cz + 1, glass); // 灯り部屋
  b.set(cx, by + 9, cz, light);
  b.box(cx - 1, by + 11, cz - 1, cx + 1, by + 11, cz + 1, dark); // 屋根
  b.set(cx, by + 12, cz, dark);
}

/** ブロンズの立像（石の台座＋海の方を見る姿）。groundY＝立っている地面の上面。 */
function statue(b: Build, x: number, z: number, groundY: number, stone: number, bronze: number, dark: number): void {
  b.box(x - 1, groundY + 1, z - 1, x + 1, groundY + 2, z + 1, stone); // 台座
  const py = groundY + 2;
  b.set(x, py + 1, z, dark); // 足元
  b.set(x, py + 2, z, bronze); // 胴
  b.set(x, py + 3, z, bronze); // 胸
  b.set(x - 1, py + 3, z - 1, bronze); // 海の方へ伸ばした腕
  b.set(x, py + 4, z, dark); // 頭
}

/** 椿（ツバキ）の木：幹＋緑の茂み＋ピンクの花。groundY＝地面の上面。 */
function camellia(b: Build, x: number, z: number, groundY: number, wood: number, leaf: number, bloom: number): void {
  b.set(x, groundY + 1, z, wood);
  b.set(x, groundY + 2, z, wood);
  b.sphere(x, groundY + 3, z, 2, leaf); // 緑の茂み
  // ピンクの花をちらほら
  b.set(x + 1, groundY + 3, z, bloom);
  b.set(x - 1, groundY + 3, z, bloom);
  b.set(x, groundY + 3, z + 1, bloom);
  b.set(x, groundY + 4, z, bloom);
}

function build(world: World): void {
  const b = new Build();
  const stone = b.id('stone');
  const tile = b.id('tile'); // 暗い岩
  const water = b.id('water');
  const grass = b.id('grass');
  const castlewall = b.id('castlewall'); // 白い灯台・看板・しぶき
  const glass = b.id('glass'); // 展望台のガラス柵（見えるけど落ちない）
  const lantern = b.id('lantern'); // 灯台の灯り
  const wood = b.id('wood'); // 手すり・展望台・遊歩道・看板
  const leaves = b.id('leaves'); // 椿の緑
  const flower = b.id('flower'); // 椿の花（ピンク）
  const roof = b.id('roof'); // ブロンズ（像）
  const road = b.id('road'); // 遊歩道
  const stonewall = b.id('stonewall'); // 白い花崗岩（白山洞門）・碑

  // ===== 崖下の海（はるか下） =====
  b.box(28, 4, 26, 68, 6, 69, stone); // 海底・岩盤
  b.box(28, 7, 26, 68, SEA, 37, water); // 海 y7〜8（崖下の手前だけ）

  // ===== 高い崖の台地（上は平らな建築スペース） =====
  b.box(28, 7, 38, 68, CLIFF - 1, 69, stone); // 崖の岩（高い）
  b.box(28, CLIFF, 38, 68, CLIFF, 69, grass); // 上面の草

  // ===== 崖のふちの柵（落ちないように） =====
  b.box(28, CLIFF + 1, 38, 44, CLIFF + 2, 38, stone); // 左の岩の手すり
  b.box(52, CLIFF + 1, 38, 68, CLIFF + 2, 38, stone); // 右の岩の手すり

  // ===== 展望台＝海へ張り出すデッキ（270度パノラマ。ガラスの柵で見える・落ちない） =====
  b.box(45, CLIFF, 35, 51, CLIFF, 38, wood); // 床（崖から3ブロック海側へ張り出す）
  b.box(45, CLIFF + 1, 35, 51, CLIFF + 2, 35, glass); // 柵（正面）
  b.box(45, CLIFF + 1, 35, 45, CLIFF + 2, 38, glass); // 柵（左）
  b.box(51, CLIFF + 1, 35, 51, CLIFF + 2, 38, glass); // 柵（右）

  // ===== 白山洞門ふうの岩のアーチ（崖下の海。白い花崗岩に波が空けた大きな穴） =====
  b.box(33, 6, 31, 34, 12, 31, stonewall); // 左の脚
  b.box(38, 6, 31, 39, 12, 31, stonewall); // 右の脚
  b.box(33, 13, 31, 39, 14, 31, stonewall); // 上のわたし（穴の上）
  b.set(33, 8, 32, castlewall); // 波しぶき
  b.set(39, 8, 32, castlewall);

  // ===== 崖下の岩礁＋波しぶき =====
  b.mound(58, 33, 5, 11, 3, stone, tile);
  b.mound(48, 30, 5, 13, 4, stone, tile);
  for (const [x, z] of [
    [40, 36],
    [56, 36],
    [48, 35],
  ] as const) {
    b.set(x, SEA, z, castlewall);
  }

  // ===== 白い灯台（足摺岬灯台）＝台地の上 =====
  lighthouse(b, 58, 50, CLIFF + 1, castlewall, glass, lantern, tile, wood);

  // ===== ジョン万次郎像（実物どおり入口広場。海の方を見つめる） =====
  statue(b, 41, 64, CLIFF, stone, roof, tile);

  // ===== 四国最南端の碑（入口広場・右） =====
  b.box(54, CLIFF + 1, 63, 56, CLIFF + 1, 63, stonewall); // 台
  b.box(55, CLIFF + 2, 63, 55, CLIFF + 4, 63, stonewall); // 石碑
  b.set(55, CLIFF + 3, 63, tile); // 文字

  // ===== 椿のトンネル＝遊歩道の両側の椿が上でつながりアーチになる（つばきの岬） =====
  b.box(46, CLIFF, 44, 50, CLIFF, 64, road); // 遊歩道
  for (let z = 45; z <= 62; z += 3) {
    camellia(b, 44, z, CLIFF, wood, leaves, flower);
    camellia(b, 52, z, CLIFF, wood, leaves, flower);
    b.box(46, CLIFF + 4, z, 50, CLIFF + 4, z, leaves); // 道の上のアーチ（くぐれる高さ）
    b.set(48, CLIFF + 4, z, flower); // アーチのてっぺんに花
  }

  // ===== 花の彩り =====
  b.set(40, CLIFF, 58, flower);
  b.set(58, CLIFF, 60, flower);

  // ===== 看板（入口・右） =====
  b.pillar(60, 64, CLIFF + 1, CLIFF + 2, wood);
  b.box(59, CLIFF + 3, 64, 61, CLIFF + 4, 64, castlewall);

  world.setBlocksBatch(b.cells);
}

export const ashizuri: SpotDefinition = {
  id: 'ashizuri',
  name: 'Cape Ashizuri',
  nameJa: '足摺岬',
  emoji: '🪨',
  available: true,
  center: { x: 48, y: 16, z: 40 },
  viewDistance: 62,
  spawn: { pos: { x: 48, y: CLIFF + 1, z: 66 }, yaw: 0 },
  field: { min: { x: 28, y: 0, z: 26 }, max: { x: 68, y: 0, z: 69 } },
  build,
  objects: [
    {
      id: 'cliffs',
      name: 'High Cliffs',
      nameJa: '断崖（高い崖）',
      region: { min: { x: 28, y: 18, z: 38 }, max: { x: 68, y: 22, z: 40 } },
      focus: { x: 48, y: 20, z: 38 },
      image: './photos/ashizuri/cliffs.jpg',
      guide: {
        canDo: 'You can look down from high cliffs.',
        feature: 'They go straight down to the sea.',
        about: 'They are very, very high. Wow!',
      },
    },
    {
      id: 'deck',
      name: 'Observation Deck',
      nameJa: '展望台',
      region: { min: { x: 44, y: 20, z: 34 }, max: { x: 52, y: 23, z: 39 } },
      focus: { x: 48, y: 21, z: 36 },
      image: './photos/ashizuri/deck.jpg',
      guide: {
        canDo: 'You can stand over the sea.',
        feature: 'It has glass. You can see down!',
        about: 'Look far. The sea is round!',
      },
    },
    {
      id: 'lighthouse',
      name: 'Ashizuri Lighthouse',
      nameJa: '足摺岬灯台',
      region: { min: { x: 55, y: 20, z: 47 }, max: { x: 61, y: 33, z: 53 } },
      focus: { x: 58, y: 27, z: 50 },
      image: './photos/ashizuri/lighthouse.jpg',
      guide: {
        canDo: 'You can see the white lighthouse.',
        feature: 'It is tall, white, and round.',
        about: 'It is very big. Its light goes very far at night.',
      },
    },
    {
      id: 'sea',
      name: 'The Pacific Ocean',
      nameJa: '太平洋',
      region: { min: { x: 28, y: 7, z: 26 }, max: { x: 68, y: 9, z: 37 } },
      focus: { x: 48, y: 8, z: 32 },
      image: './photos/ashizuri/sea.jpg',
      guide: {
        canDo: 'You can look at the big blue ocean.',
        feature: 'It is far down there.',
        about: 'The sea goes on and on.',
      },
    },
    {
      id: 'arch',
      name: 'Sea Arch (Hakusan Domon)',
      nameJa: '白山洞門',
      region: { min: { x: 31, y: 6, z: 29 }, max: { x: 41, y: 16, z: 33 } },
      focus: { x: 36, y: 10, z: 31 },
      image: './photos/ashizuri/arch.jpg',
      guide: {
        canDo: 'You can find a big rock arch in the sea.',
        feature: 'It has a hole like a big door.',
        about: 'The sea made this hole. Many, many years!',
      },
    },
    {
      id: 'statue',
      name: 'Statue of John Manjiro',
      nameJa: 'ジョン万次郎像',
      region: { min: { x: 39, y: 20, z: 62 }, max: { x: 43, y: 27, z: 66 } },
      focus: { x: 41, y: 24, z: 64 },
      image: './photos/ashizuri/manjiro.jpg',
      guide: {
        canDo: 'You can see a bronze statue.',
        feature: 'He looks at the sea.',
        about: 'He went to America at 14. He learned English and helped Japan.',
      },
    },
    {
      id: 'monument',
      name: 'Southernmost Point',
      nameJa: '四国最南端の碑',
      region: { min: { x: 53, y: 20, z: 61 }, max: { x: 57, y: 25, z: 65 } },
      focus: { x: 55, y: 22, z: 63 },
      image: './photos/ashizuri/monument.jpg',
      guide: {
        canDo: 'You can stand at the south end of Shikoku.',
        feature: 'It is a small stone.',
        about: 'Shikoku ends here. This is the south end!',
      },
    },
    {
      id: 'camellia',
      name: 'Camellia Tunnel',
      nameJa: '椿のトンネル',
      region: { min: { x: 42, y: 20, z: 44 }, max: { x: 54, y: 26, z: 63 } },
      focus: { x: 48, y: 23, z: 54 },
      image: './photos/ashizuri/camellia.jpg',
      guide: {
        canDo: 'You can walk under the flower tunnel.',
        feature: 'Pink flowers are over your head.',
        about: 'About 60,000 flower trees are here!',
      },
    },
    {
      id: 'sign',
      name: 'Information Sign',
      nameJa: '看板',
      region: { min: { x: 59, y: 20, z: 63 }, max: { x: 61, y: 25, z: 65 } },
      focus: { x: 60, y: 22, z: 64 },
      image: './photos/ashizuri/sign.jpg',
      guide: {
        canDo: 'You can read about this place.',
        feature: 'It is about Cape Ashizuri.',
        about: 'This is a sign. It helps you learn about Cape Ashizuri.',
      },
    },
  ],
};
