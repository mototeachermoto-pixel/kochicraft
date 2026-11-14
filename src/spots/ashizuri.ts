import type { World } from '@/world/World';
import { Build } from './Build';
import { kimonoFigure } from './statues';
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

/**
 * 白い灯台（足摺岬灯台）。写真に合わせて、ほっそりと高い白い塔：
 *   - 細く高い白い塔（ぜんぶ白）。てっぺん近くに白い手すりのベランダ
 *   - 小さなガラスの灯り部屋と、白い丸屋根
 *   - 根もとに小さな白い建物、まわりを低い石の塀がかこむ
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
  stoneW: number,
): void {
  // まわりの低い石の塀（丸く囲む）
  for (let dx = -5; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      const d2 = dx * dx + dz * dz;
      if (d2 >= 20 && d2 <= 27 && !(dz === 5 && Math.abs(dx) <= 1)) b.set(cx + dx, by, cz + dz, stoneW);
    }
  }
  b.box(cx + 2, by, cz - 1, cx + 3, by + 1, cz + 1, white); // 根もとの小さな白い建物
  b.box(cx - 1, by, cz - 1, cx + 1, by + 11, cz + 1, white); // 細く高い白い塔
  b.box(cx - 2, by + 11, cz - 2, cx + 2, by + 11, cz + 2, white); // ベランダの床
  woodRing(b, cx - 2, cz - 2, cx + 2, cz + 2, by + 12, white); // 白い手すり
  b.set(cx, by + 12, cz, white);
  b.box(cx - 1, by + 13, cz - 1, cx + 1, by + 13, cz + 1, glass); // ガラスの灯り部屋
  b.set(cx, by + 13, cz, light);
  b.box(cx - 1, by + 14, cz - 1, cx + 1, by + 14, cz + 1, white); // 白い丸屋根
  b.set(cx, by + 15, cz, white);
  b.set(cx, by + 16, cz, dark); // 避雷針
}

/**
 * ジョン万次郎像（本物の写真に合わせて：つるっとした四角い石の台座に縦長の黒い銘板、
 * 足もとに黒い台、着物とはかまで両手を下ろしてまっすぐ立つ姿）。2026-11-14 写真に合わせて直した。
 */
function statue(
  b: Build,
  x: number,
  z: number,
  groundY: number,
  stone: number,
  stoneW: number,
  bronze: number,
  dark: number,
): void {
  b.box(x - 1, groundY + 1, z - 1, x + 1, groundY + 4, z + 1, stone); // つるっとした石の台座
  b.box(x, groundY + 2, z - 2, x, groundY + 3, z - 2, dark); // 縦長の黒い銘板（海の側）
  b.box(x - 1, groundY + 5, z - 1, x + 1, groundY + 5, z + 1, dark); // 足もとの黒い台
  kimonoFigure(b, x, groundY + 5, z, -1, bronze, dark, 'stand'); // 海（-z）の方を向いて、両手を下ろして立つ
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
  const bronze = b.id('bronze'); // 銅像
  const bronzeDark = b.id('bronzedark'); // 銅像の濃い所
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

  // ===== 白山洞門（本物の写真に合わせて：上が木々にこんもりおおわれた、黒っぽい岩山。下に波が空けた穴） =====
  // 2026-11-14 白っぽい花崗岩から直した。岩肌は暗い灰色、上の方は緑の木々
  // 岩山（左右が厚く、上は丸くでこぼこ）
  for (let x = 30; x <= 42; x++) {
    for (let z = 28; z <= 34; z++) {
      const dx = x - 36;
      const dz = z - 31;
      const top = 18 - Math.round(Math.abs(dx) * 0.6 + Math.abs(dz) * 0.9) + ((x * 7 + z * 3) % 2);
      if (top < 9) continue;
      b.box(x, 6, z, x, top, z, (x + z) % 3 === 0 ? tile : stone);
      // 上の2〜3段は木々におおわれている（写真の岩山は、上がこんもり緑）
      b.box(x, Math.max(9, top - 2 + ((x + z) % 2)), z, x, top, z, leaves);
    }
  }
  // 波が空けた穴（海側から見て、向こうの空が見える）
  b.box(34, 7, 28, 38, 12, 34, 0);
  b.box(35, 13, 28, 37, 13, 34, 0);
  b.box(34, 6, 28, 38, 8, 34, water); // 穴の中の海
  // 波しぶき
  for (const [x, z] of [
    [30, 35],
    [33, 35],
    [39, 35],
    [42, 35],
    [36, 27],
  ] as const) {
    b.set(x, SEA, z, castlewall);
  }

  // ===== 崖の面の緑（写真のように、崖は草木におおわれている） =====
  for (let x = 28; x <= 68; x++) {
    for (let y = SEA + 1; y <= CLIFF - 1; y++) {
      const h = (x * 7 + y * 11 + x * y) % 5;
      if (h === 0 || h === 3) b.set(x, y, 38, leaves);
      else if (h === 1 && y > 12) b.set(x, y, 38, grass);
    }
  }

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
  lighthouse(b, 58, 50, CLIFF + 1, castlewall, glass, lantern, tile, stonewall);

  // ===== ジョン万次郎像（実物どおり入口広場。海の方を見つめる） =====
  statue(b, 41, 63, CLIFF, stone, stonewall, bronze, bronzeDark);

  // ===== 四国最南端の碑（入口広場・右） =====
  // 本物の写真に合わせて：白い灯台の形の柱（上にかさ）と、柱の前に青い「足摺岬」の看板（2026-11-14）
  b.box(54, CLIFF + 1, 62, 56, CLIFF + 1, 64, stonewall); // 台
  b.box(55, CLIFF + 2, 63, 55, CLIFF + 6, 63, castlewall); // 白い柱
  b.box(54, CLIFF + 7, 62, 56, CLIFF + 7, 64, castlewall); // かさ
  b.set(55, CLIFF + 8, 63, castlewall); // てっぺん
  b.box(54, CLIFF + 4, 64, 56, CLIFF + 5, 64, glass); // 青い看板（柱の前）

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
  // 太平洋につき出た岬。三方が海で、うしろに森と山
  backdrop: { near: 'none', far: 'none', sea: ['n', 'w', 'e', 's'], feature: 'ashizuri-cape' },
  build,
  objects: [
    {
      id: 'cliffs',
      name: 'High Cliffs',
      nameJa: '断崖（高い崖）',
      region: { min: { x: 28, y: 18, z: 38 }, max: { x: 68, y: 22, z: 40 } },
      focus: { x: 48, y: 20, z: 38 },
      image: './photos/ashizuri/cliffs.jpg',
      credit: 'Photo: z tanuki / CC BY 3.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can look down from high cliffs.',
        feature: 'They are very high.',
        about: 'Look down. Wow!',
      },
    },
    {
      id: 'deck',
      name: 'Observation Deck',
      nameJa: '展望台',
      region: { min: { x: 44, y: 20, z: 34 }, max: { x: 52, y: 23, z: 39 } },
      focus: { x: 48, y: 21, z: 36 },
      image: './photos/ashizuri/deck.jpg',
      credit: 'Photo: Dokudami / CC BY-SA 4.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can stand over the sea.',
        feature: 'It is over the sea.',
        about: 'The sea is big and round.',
      },
    },
    {
      id: 'lighthouse',
      name: 'Ashizuri Lighthouse',
      nameJa: '足摺岬灯台',
      region: { min: { x: 55, y: 20, z: 47 }, max: { x: 61, y: 37, z: 53 } },
      focus: { x: 58, y: 29, z: 50 },
      image: './photos/ashizuri/lighthouse.jpg',
      credit: 'Photo: hashi photo / CC BY 3.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can see the white lighthouse.',
        feature: 'It is tall and white.',
        about: 'It is bright at night.',
      },
    },
    {
      id: 'sea',
      name: 'The Pacific Ocean',
      nameJa: '太平洋',
      region: { min: { x: 28, y: 7, z: 26 }, max: { x: 68, y: 9, z: 37 } },
      focus: { x: 48, y: 8, z: 32 },
      image: './photos/ashizuri/sea.jpg',
      credit: 'Photo: z tanuki / CC BY 3.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can look at the big blue ocean.',
        feature: 'It is big and blue.',
        about: 'Look far away!',
      },
    },
    {
      id: 'arch',
      name: 'Sea Arch (Hakusan Domon)',
      nameJa: '白山洞門',
      region: { min: { x: 30, y: 6, z: 28 }, max: { x: 42, y: 19, z: 34 } },
      focus: { x: 36, y: 11, z: 31 },
      image: './photos/ashizuri/arch.jpg',
      credit: 'Photo: Dokudami / CC BY-SA 4.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can find a big rock arch in the sea.',
        feature: 'It is like a big door.',
        about: 'It is a rock in the sea.',
      },
    },
    {
      id: 'statue',
      name: 'Statue of John Manjiro',
      nameJa: 'ジョン万次郎像',
      region: { min: { x: 38, y: 20, z: 60 }, max: { x: 44, y: 35, z: 65 } },
      focus: { x: 41, y: 29, z: 63 },
      image: './photos/ashizuri/manjiro.jpg',
      guide: {
        canDo: 'You can see a bronze statue.',
        feature: 'He is John Manjiro.',
        about: 'He is a hero of Kochi.',
      },
    },
    {
      id: 'monument',
      name: 'Southernmost Point',
      nameJa: '四国最南端の碑',
      region: { min: { x: 53, y: 20, z: 61 }, max: { x: 57, y: 28, z: 65 } },
      focus: { x: 55, y: 22, z: 63 },
      image: './photos/ashizuri/monument.jpg',
      credit: 'Photo: Dokudami / CC BY-SA 4.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can stand at the south end of Shikoku.',
        feature: 'It is a stone.',
        about: 'This is the south end of Shikoku.',
      },
    },
    {
      id: 'camellia',
      name: 'Camellia Tunnel',
      nameJa: '椿のトンネル',
      region: { min: { x: 42, y: 20, z: 44 }, max: { x: 54, y: 26, z: 63 } },
      focus: { x: 48, y: 23, z: 54 },
      image: './photos/ashizuri/camellia.jpg',
      credit: 'Photo: z tanuki / CC BY 3.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can walk under the flower tunnel.',
        feature: 'It has many red flowers.',
        about: 'It is pretty in winter.',
      },
    },
  ],
};
