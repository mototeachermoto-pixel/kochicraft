import type { World } from '@/world/World';
import { Build } from './Build';
import type { SpotDefinition } from './SpotDefinition';

/**
 * のいち動物園（Noichi Zoo）— 高知県香南市の県立動物公園（約110種1,000点）。
 * 実際にのいちにいる動物たちをブロックで再現（ゾウ・ライオン・カバ・ペンギンはいないので置かない）：
 *   - ハシビロコウ（「動かない鳥」＝のいちの人気者。水辺でじっと立つ）。
 *   - キリン＋シマウマの「2種混合展示」（実物の名物。同じ放飼場で一緒に暮らす）。
 *   - チンパンジー（木のやぐら）・カピバラ（水と笹が大好き）。
 *   - ワオキツネザル（池の島・しまのしっぽ）・レッサーパンダ（木の台の上）。
 *   - 放飼場（柵・水場）・園路・木・入口ゲート。広い園内（最大フィールド）。
 *
 * 座標：小さい z＝奥／大きい z＝手前（入口・スポーン）。床 = G。フィールド x6〜90, z6〜90。
 */

const G = 10; // 園内の地面の上面。立つのは G+1

/** 放飼場の柵（木の杭＋横木）。x0..x1 × z0..z1 のまわりを囲う。 */
function fence(b: Build, x0: number, z0: number, x1: number, z1: number, post: number): void {
  for (let x = x0; x <= x1; x++) {
    b.set(x, G + 1, z0, post);
    b.set(x, G + 1, z1, post);
  }
  for (let z = z0; z <= z1; z++) {
    b.set(x0, G + 1, z, post);
    b.set(x1, G + 1, z, post);
  }
  for (let x = x0; x <= x1; x += 3) {
    b.set(x, G + 2, z0, post);
    b.set(x, G + 2, z1, post);
  }
}

/**
 * ハシビロコウ（「動かない鳥」）。写真に合わせて、背が高く、青みがかった灰色の体に
 * とても大きな黄色っぽいくちばし。+z（園路）を向いてじっと立つ。
 */
function shoebill(b: Build, x: number, z: number, grey: number, beak: number, dark: number): void {
  b.box(x, G + 1, z, x, G + 3, z, dark); // 細く長い脚
  b.box(x + 1, G + 1, z, x + 1, G + 3, z, dark);
  b.box(x, G + 4, z - 1, x + 1, G + 6, z, grey); // 体
  b.box(x, G + 3, z - 2, x + 1, G + 4, z - 2, grey); // 尾羽
  b.box(x, G + 7, z, x + 1, G + 7, z, grey); // 首
  b.box(x, G + 8, z, x + 1, G + 9, z + 1, grey); // 大きな頭
  b.box(x, G + 8, z + 2, x + 1, G + 8, z + 3, beak); // くつのような大きなくちばし
  b.set(x, G + 9, z + 1, dark); // 目
}

/** カピバラ（写真に合わせて：ずんぐりした茶色の体＋四角い大きな頭）。+x を向く。 */
function capybara(b: Build, x: number, z: number, brown: number, dark: number): void {
  b.box(x - 2, G + 1, z, x + 1, G + 2, z + 1, brown); // ずんぐりした体
  b.box(x + 2, G + 1, z, x + 3, G + 2, z + 1, brown); // 四角い大きな頭
  b.set(x + 3, G + 2, z, dark); // 鼻
  b.set(x + 2, G + 3, z, dark); // 小さな耳
  b.set(x + 2, G + 3, z + 1, dark);
}

/** チンパンジーの遊び場（木のやぐら）＋上で遊ぶ黒いチンパンジー（肌色の顔）。 */
function chimpTower(b: Build, x: number, z: number, wood: number, black: number, skin: number): void {
  for (const [dx, dz] of [
    [-2, -2],
    [2, -2],
    [-2, 2],
    [2, 2],
  ] as const) {
    b.box(x + dx, G + 1, z + dz, x + dx, G + 4, z + dz, wood); // やぐらの脚
  }
  b.box(x - 2, G + 5, z - 2, x + 2, G + 5, z + 2, wood); // 上の床
  b.box(x - 3, G + 4, z, x - 3, G + 9, z, wood); // 登るロープの柱
  // すわっているチンパンジー
  b.box(x, G + 6, z, x + 1, G + 7, z, black); // 体
  b.box(x - 1, G + 6, z, x - 1, G + 7, z, black); // うで
  b.box(x + 2, G + 6, z, x + 2, G + 7, z, black);
  b.box(x, G + 8, z, x + 1, G + 9, z, black); // 頭
  b.set(x, G + 8, z + 1, skin); // 顔
  b.set(x + 1, G + 8, z + 1, skin);
}

/** ワオキツネザル（灰色の体＋白い顔＋白と黒のしまの長いしっぽを立てる）。 */
function lemur(b: Build, x: number, z: number, grey: number, white: number, dark: number): void {
  b.box(x, G + 1, z, x + 1, G + 2, z, grey); // 体
  b.set(x + 2, G + 2, z, white); // 白い顔
  b.set(x + 2, G + 3, z, dark); // 耳
  for (let i = 0; i < 5; i++) b.set(x - 1, G + 1 + i, z, i % 2 === 0 ? white : dark); // しまのしっぽ
}

/** レッサーパンダ（赤茶の体＋白い顔＋赤茶と濃い色のしまのしっぽ）。y＝乗っている台の上。 */
function redPanda(b: Build, x: number, y: number, z: number, red: number, white: number, dark: number): void {
  b.box(x - 1, y, z, x, y + 1, z, red); // 体
  b.set(x + 1, y + 1, z, white); // 白い顔
  b.set(x + 1, y + 2, z, red); // 耳
  b.set(x - 1, y, z, dark); // 足
  for (let i = 0; i < 3; i++) b.set(x - 2 - i, y + 1, z, i % 2 === 0 ? red : dark); // しまのしっぽ
}

/**
 * キリン（写真に合わせて：オレンジ茶の地に、クリーム色のあみ目もよう。長い脚と長い首）。
 * +x を向く（園路から横向きに見える）。高さ約13マス。
 */
function giraffe(b: Build, x: number, z: number, brown: number, cream: number, dark: number): void {
  const coat = (xx: number, yy: number, zz: number) => ((xx + yy + zz) % 2 === 0 ? brown : cream);
  for (const lx of [x - 2, x + 1]) {
    for (const lz of [z, z + 1]) b.box(lx, G + 1, lz, lx, G + 4, lz, cream); // 長い脚（4本）
  }
  for (let xx = x - 2; xx <= x + 1; xx++) {
    for (let yy = G + 5; yy <= G + 6; yy++) {
      for (let zz = z; zz <= z + 1; zz++) b.set(xx, yy, zz, coat(xx, yy, zz)); // 体（あみ目もよう）
    }
  }
  // 長い首（ななめ前へのびる）
  const neck: [number, number][] = [
    [x + 1, G + 7],
    [x + 1, G + 8],
    [x + 2, G + 9],
    [x + 2, G + 10],
    [x + 2, G + 11],
  ];
  for (const [nx, ny] of neck) b.set(nx, ny, z, coat(nx, ny, z));
  b.box(x + 2, G + 12, z, x + 3, G + 12, z, brown); // 頭
  b.set(x + 4, G + 12, z, cream); // 鼻先
  b.set(x + 2, G + 13, z, dark); // 角
  b.set(x - 3, G + 6, z, dark); // しっぽ
  b.set(x - 3, G + 5, z, dark);
}

/** シマウマ（写真に合わせて：白と黒のたてじま。黒いたてがみと鼻）。+x を向く。 */
function zebra(b: Build, x: number, z: number, white: number, black: number): void {
  const stripe = (xx: number) => ((xx % 2) + 2) % 2 === 0 ? white : black;
  for (const lx of [x - 2, x + 1]) {
    for (const lz of [z, z + 1]) b.box(lx, G + 1, lz, lx, G + 2, lz, stripe(lx + 1)); // 脚
  }
  for (let xx = x - 2; xx <= x + 1; xx++) b.box(xx, G + 3, z, xx, G + 4, z + 1, stripe(xx)); // 体のたてじま
  b.box(x + 2, G + 4, z, x + 2, G + 5, z + 1, white); // 首
  b.set(x + 2, G + 6, z, black); // たてがみ
  b.box(x + 3, G + 5, z, x + 3, G + 5, z + 1, white); // 頭
  b.set(x + 4, G + 5, z, black); // 黒い鼻
  b.set(x - 3, G + 4, z, black); // しっぽ
}

/** アカシアの木（写真のサバンナの木：細い幹の上に、平らで横に広い葉）。 */
function acacia(b: Build, x: number, z: number, wood: number, leaf: number): void {
  b.box(x, G + 1, z, x, G + 5, z, wood); // 幹
  b.set(x - 1, G + 5, z, wood); // 枝
  b.set(x + 1, G + 6, z, wood);
  b.disc(x, z, G + 7, 5, leaf); // 平らで広い葉
  b.disc(x, z, G + 8, 3, leaf);
}

function build(world: World): void {
  const b = new Build();
  const stone = b.id('stone'); // ゾウ・カバ（灰色）
  const grass = b.id('grass');
  const water = b.id('water');
  const sand = b.id('sand'); // サバンナの地面・キリン
  const road = b.id('road'); // 園路
  const wood = b.id('wood'); // 柵・ゲート・看板・木
  const leaves = b.id('leaves');
  const castlewall = b.id('castlewall'); // 白（シマウマ・ペンギン腹・牙）
  const tile = b.id('tile'); // 黒っぽい（ペンギン・しま・目）
  const lantern = b.id('lantern'); // 黄色っぽい（ライオン体）
  const brick = b.id('brick'); // 茶/オレンジ（たてがみ・くちばし・キリン模様）
  const roof = b.id('roof'); // 濃い茶（チンパンジー・ゲート梁）
  const flower = b.id('flower');
  const bamboo = b.id('bamboo'); // アシ・カピバラの笹
  const turf = b.id('turf'); // サバンナの草
  const dirt = b.id('dirt'); // サバンナの土・カピバラ
  const black = b.id('bronzedark'); // チンパンジーの黒い毛

  // ===== 地面（広い園内） =====
  b.box(6, 8, 6, 90, 9, 90, stone);
  b.box(6, G, 6, 90, G, 90, grass);

  // ===== 園路（十字の通路） =====
  b.box(45, G, 8, 51, G, 88, road);
  b.box(8, G, 45, 88, G, 51, road);

  // ===== 放飼場（実際にのいちにいる動物たちで構成） =====
  // ハシビロコウの湿地（左奥。水辺でじっと動かない）
  fence(b, 12, 12, 40, 40, wood);
  b.box(20, 9, 28, 28, 9, 36, water); // 水場
  shoebill(b, 30, 32, stone, lantern, tile); // 水辺の手前で、園路の方を向いて立つ
  for (const [rx, rz] of [[19, 29], [29, 36], [21, 37]] as const) b.set(rx, G + 1, rz, bamboo); // 水辺のアシ
  // キリン＋シマウマの混合展示（右奥。実物の名物「2種混合展示」）
  // 写真のように、草の広い原っぱ（土のところもある）
  b.box(56, G, 12, 84, G, 40, turf);
  for (let x = 66; x <= 80; x++) for (let z = 16; z <= 22; z++) if ((x + z) % 3 !== 0) b.set(x, G, z, dirt);
  fence(b, 56, 12, 84, 40, wood);
  acacia(b, 74, 19, wood, leaves); // 大きなアカシアの木（木かげにシマウマ）
  giraffe(b, 62, 26, brick, lantern, tile);
  giraffe(b, 68, 31, brick, lantern, tile);
  zebra(b, 61, 35, castlewall, tile);
  zebra(b, 77, 30, castlewall, tile);
  zebra(b, 72, 21, castlewall, tile); // 木かげで休む
  // チンパンジーの森（左・中ほど。木のやぐらで遊ぶ）
  fence(b, 12, 56, 40, 84, wood);
  chimpTower(b, 26, 70, wood, black, lantern);
  b.box(31, G + 1, 76, 32, G + 2, 76, black); // 地面のチンパンジー
  b.box(31, G + 3, 76, 32, G + 4, 76, black);
  b.set(31, G + 3, 77, lantern); // 顔
  b.set(20, G + 1, 64, stone); // 岩
  // カピバラの水辺（右・中ほど。水と笹が大好き）
  fence(b, 56, 56, 84, 84, wood);
  b.box(64, 9, 66, 72, G, 72, water); // 小さな池
  capybara(b, 61, 62, dirt, tile);
  capybara(b, 74, 74, dirt, tile);
  for (const [bx, bz] of [[60, 62], [61, 63], [74, 74], [75, 73]] as const) b.set(bx, G + 1, bz, bamboo); // 大好きな笹

  // ===== 通路ぞいの小さな展示（中央） =====
  // ワオキツネザルの島（中央左の池）
  b.box(38, 9, 44, 44, G, 50, water);
  b.box(40, G, 46, 42, G, 48, grass); // 島
  lemur(b, 40, 47, stone, castlewall, tile);
  // レッサーパンダの木（中央右）
  b.box(55, G + 1, 47, 55, G + 3, 47, wood); // 幹
  b.box(54, G + 4, 46, 56, G + 4, 48, wood); // 木の台
  redPanda(b, 55, G + 5, 47, brick, castlewall, tile);
  b.disc(55, 47, G + 7, 2, leaves); // 木かげの葉

  // ===== 入口ゲート（手前） =====
  b.box(44, G + 1, 86, 44, G + 5, 86, wood);
  b.box(52, G + 1, 86, 52, G + 5, 86, wood);
  b.box(44, G + 6, 86, 52, G + 6, 86, roof); // 屋根の梁
  b.box(45, G + 4, 86, 51, G + 5, 86, castlewall); // 看板
  for (let x = 44; x <= 52; x += 2) b.set(x, G + 5, 86, brick); // 飾り

  // ===== 木と花（園のあちこち） =====
  b.pine(10, G, 52, 4, 4, 2);
  b.pine(88, G, 52, 4, 4, 2);
  b.pine(48, G, 14, 4, 4, 2);
  for (const [x, z] of [[44, 60], [52, 60], [44, 76], [52, 76]] as const) b.set(x, G, z, flower);

  // ===== 看板（入口・右） =====
  b.pillar(58, 86, G + 1, G + 2, wood);
  b.box(57, G + 3, 86, 59, G + 4, 86, castlewall);

  world.setBlocksBatch(b.cells);
}

export const noichi: SpotDefinition = {
  id: 'noichi',
  name: 'Noichi Zoo',
  nameJa: 'のいち動物園',
  emoji: '🦒',
  available: true,
  center: { x: 48, y: 13, z: 48 },
  viewDistance: 96,
  spawn: { pos: { x: 48, y: G + 1, z: 84 }, yaw: 0 },
  field: { min: { x: 6, y: 0, z: 6 }, max: { x: 90, y: 0, z: 90 } },
  build,
  objects: [
    {
      id: 'shoebill',
      name: 'Shoebill',
      nameJa: 'ハシビロコウ',
      region: { min: { x: 12, y: 10, z: 12 }, max: { x: 40, y: 15, z: 40 } },
      focus: { x: 30, y: 13, z: 32 },
      image: './photos/noichi/shoebill.jpg',
      guide: {
        canDo: 'You can find the quiet gray bird.',
        feature: 'It has a very big mouth.',
        about: 'It does not move. It stands and stands!',
      },
    },
    {
      id: 'giraffe-zebra',
      name: 'Giraffes and Zebras',
      nameJa: 'キリンとシマウマ（混合展示）',
      region: { min: { x: 56, y: 10, z: 12 }, max: { x: 84, y: 24, z: 40 } },
      focus: { x: 65, y: 17, z: 28 },
      image: './photos/noichi/giraffe-zebra.jpg',
      guide: {
        canDo: 'You can see giraffes and zebras together.',
        feature: 'They live in one big place.',
        about: 'They live together, like in Africa!',
      },
    },
    {
      id: 'chimp',
      name: 'Chimpanzee',
      nameJa: 'チンパンジー',
      region: { min: { x: 12, y: 10, z: 56 }, max: { x: 40, y: 18, z: 84 } },
      focus: { x: 26, y: 16, z: 70 },
      image: './photos/noichi/chimp.jpg',
      guide: {
        canDo: 'You can watch the chimpanzee play.',
        feature: 'It goes up the wood tower.',
        about: 'It is very smart. It can do many things!',
      },
    },
    {
      id: 'capybara',
      name: 'Capybaras',
      nameJa: 'カピバラ',
      region: { min: { x: 56, y: 10, z: 56 }, max: { x: 84, y: 14, z: 84 } },
      focus: { x: 68, y: 12, z: 68 },
      image: './photos/noichi/capybara.jpg',
      guide: {
        canDo: 'You can see capybaras by the water.',
        feature: 'They are big and round.',
        about: 'They love water. They eat grass!',
      },
    },
    {
      id: 'lemur',
      name: 'Ring-tailed Lemur',
      nameJa: 'ワオキツネザル',
      region: { min: { x: 37, y: 9, z: 43 }, max: { x: 45, y: 14, z: 51 } },
      focus: { x: 41, y: 12, z: 47 },
      image: './photos/noichi/lemur.jpg',
      guide: {
        canDo: 'You can find the lemur on the small island.',
        feature: 'Its long tail is black and white.',
        about: 'It walks with its tail up. Cute!',
      },
    },
    {
      id: 'redpanda',
      name: 'Red Panda',
      nameJa: 'レッサーパンダ',
      image: './photos/noichi/redpanda.jpg',
      region: { min: { x: 52, y: 10, z: 44 }, max: { x: 58, y: 18, z: 50 } },
      focus: { x: 55, y: 15, z: 47 },
      guide: {
        canDo: 'You can see a red panda in the tree.',
        feature: 'It is red and brown. It has a long tail.',
        about: 'It likes cool places. It sleeps in trees.',
      },
    },
    {
      id: 'sign',
      name: 'Information Sign',
      nameJa: '看板',
      region: { min: { x: 57, y: 10, z: 85 }, max: { x: 59, y: 15, z: 87 } },
      focus: { x: 58, y: 12, z: 86 },
      image: './photos/noichi/sign.jpg',
      guide: {
        canDo: 'You can read about this place.',
        feature: 'It is about Noichi Zoo.',
        about: 'Let\'s read the sign!',
      },
    },
  ],
};
