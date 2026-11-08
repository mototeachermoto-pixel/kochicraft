import type { World } from '@/world/World';
import { Build } from './Build';
import type { SpotDefinition } from './SpotDefinition';

/**
 * 四万十川（Shimanto River）— 「日本最後の清流」と呼ばれる、きれいな大きな川。
 * 実物の特徴を色ボクセルで再現：
 *   - 広くて清らかな川（青く澄んだ水）。多くの魚（アユなど）が棲む。
 *   - 名物の「沈下橋（ちんかばし）」＝増水時に水に沈むよう、**手すりが無く・低く・平ら・狭い**
 *     （車1台分の幅）グレーの橋。沈む設計だから壊れない、が核心。
 *   - 川に浮かぶカヌー2艘（木＋赤。四万十川はカヌーが有名）と屋形船（屋根つきの川舟）。
 *   - 水際の砂利の河原。川のうしろの緑の山。両岸は広い草地（自由に建築できるスペース）。
 *
 * 座標の目安：小さい z＝奥（山）／大きい z＝手前（入口・スポーン）。
 *   川:   z 36〜52（水面 = WATER）／沈下橋: x46〜50 で南北にわたる
 *   岸:   手前 z 53〜69／奥 z 26〜35
 */

const BANK = 11; // 岸の上面。立つのは BANK+1
const WATER = 10; // 川の水面

/** カヌー（細長い舟）。x,z を舳先として z+ 方向に伸びる。hull＝船体の色（実物のレンタルはカラフル）。 */
function canoe(b: Build, x: number, z: number, hull: number, dark: number): void {
  for (let i = 0; i < 4; i++) b.set(x, WATER + 1, z + i, hull); // 船底（4マス）
  b.set(x - 1, WATER + 1, z + 1, hull); // 左右のふち
  b.set(x + 1, WATER + 1, z + 1, hull);
  b.set(x - 1, WATER + 1, z + 2, hull);
  b.set(x + 1, WATER + 1, z + 2, hull);
  b.set(x, WATER + 2, z, dark); // 舳先
  b.set(x, WATER + 2, z + 3, dark); // とも=後ろ
}

/** 屋形船（屋根つきの川舟）。x0 から +x 方向へ。木の船体＋白い船室＋ガラス窓＋茶の屋根。 */
function houseboat(
  b: Build,
  x0: number,
  z0: number,
  wood: number,
  white: number,
  glassId: number,
  roofId: number,
  dark: number,
): void {
  const x1 = x0 + 6;
  const z1 = z0 + 2;
  b.box(x0, WATER + 1, z0, x1, WATER + 1, z1, wood); // 船体
  b.set(x0 - 1, WATER + 1, z0 + 1, dark); // 舳先
  b.set(x1 + 1, WATER + 1, z0 + 1, dark); // とも
  b.box(x0 + 1, WATER + 2, z0, x1 - 1, WATER + 3, z1, white); // 船室
  for (let x = x0 + 2; x <= x1 - 2; x += 2) {
    b.set(x, WATER + 3, z0, glassId); // 窓
    b.set(x, WATER + 3, z1, glassId);
  }
  b.box(x0, WATER + 4, z0 - 1, x1, WATER + 4, z1 + 1, roofId); // 屋根（張り出す）
}

function build(world: World): void {
  const b = new Build();
  const stone = b.id('stone');
  const sand = b.id('sand');
  const water = b.id('water');
  const grass = b.id('grass');
  const road = b.id('road'); // 沈下橋（グレーのコンクリート）
  const wood = b.id('wood'); // カヌー・屋形船・看板
  const tile = b.id('tile'); // 舳先（濃い色）
  const castlewall = b.id('castlewall'); // 屋形船の船室・看板
  const flower = b.id('flower');
  const torii = b.id('torii'); // 赤いカヌー
  const glass = b.id('glass'); // 屋形船の窓
  const roof = b.id('roof'); // 屋形船の屋根
  const concrete = b.id('stonewall'); // 沈下橋（明るい灰色のコンクリート）
  const leaves = b.id('leaves'); // 山の森（濃い緑）
  const bamboo = b.id('bamboo'); // 山の森（明るい緑）
  const lantern = b.id('lantern'); // 川原の白っぽい小石

  // ===== 土台 =====
  b.box(28, 7, 26, 68, 10, 69, stone);

  // ===== 両岸（平らな草地＝建築スペース） =====
  b.box(28, BANK, 53, 68, BANK, 69, grass); // 手前の大きな岸（スポーン側）
  b.box(28, BANK, 26, 68, BANK, 35, grass); // 奥の岸

  // ===== 水際の砂利の河原（写真のように、白っぽい砂に小石がまざる広い川原） =====
  b.box(28, BANK, 53, 68, BANK, 56, sand); // 手前の川原
  b.box(28, BANK, 33, 68, BANK, 35, sand); // 奥の川原
  for (let x = 28; x <= 68; x++) {
    for (const z of [53, 54, 55, 56, 33, 34, 35]) {
      const h = (x * 7 + z * 11) % 6;
      if (h === 0) b.set(x, BANK, z, stone); // 灰色の小石
      else if (h === 3) b.set(x, BANK, z, lantern); // 白っぽい小石
    }
  }

  // ===== 四万十川（広くて澄んだ青い川） =====
  b.box(28, 8, 36, 68, 8, 52, sand); // 川底（砂＝清流）
  b.box(28, 9, 36, 68, WATER, 52, water); // 水 y9〜10

  // ===== 沈下橋（手すりが無く・低く・平ら・狭い＝車1台分のグレーの橋） =====
  // 写真のように、明るい灰色のコンクリートで、水面すれすれに低くまっすぐのびる
  b.box(47, BANK, 33, 49, BANK, 56, concrete); // デッキ（両岸の川原から川原まで・幅3）
  for (const z of [39, 43, 47, 51]) b.box(48, 9, z, 48, WATER, z, concrete); // 細い橋脚（川の中）

  // ===== カヌー2艘（木＋赤。実物のレンタルカヌーはカラフル） =====
  canoe(b, 36, 41, wood, tile);
  canoe(b, 40, 47, torii, tile);

  // ===== 屋形船（屋根つきの川舟。ゆっくり川を下る） =====
  houseboat(b, 57, 42, wood, castlewall, glass, roof, tile);

  // ===== 奥の緑の山（写真のように、木にびっしりおおわれた低い山が横に続く） =====
  b.mound(32, 28, BANK, 20, 6, leaves, leaves);
  b.mound(42, 27, BANK, 22, 7, leaves, leaves);
  b.mound(54, 27, BANK, 21, 7, leaves, leaves);
  b.mound(65, 28, BANK, 19, 6, leaves, leaves);
  // 山の表面のもこもこした木（明るい緑と濃い緑をまぜる）
  for (const [x, z, y, r, light] of [
    [30, 31, 13, 2, true],
    [36, 30, 15, 2, false],
    [41, 31, 14, 2, true],
    [46, 30, 16, 2, false],
    [51, 31, 14, 2, true],
    [57, 30, 15, 2, false],
    [62, 31, 14, 2, true],
    [67, 30, 13, 2, false],
    [39, 28, 19, 2, true],
    [55, 28, 19, 2, true],
  ] as const) {
    b.sphere(x, y, z, r, light ? bamboo : leaves);
  }
  // 川原のきわの木
  b.roundTree(31, BANK, 32, 2, 2, wood, bamboo);
  b.roundTree(64, BANK, 32, 2, 2, wood, leaves);

  // ===== 岸の木と花（建築スペースは中央を空けておく） =====
  b.pine(32, BANK, 60, 4, 4, 2);
  b.pine(64, BANK, 62, 4, 4, 2);
  b.pine(30, BANK, 56, 3, 3, 1);
  b.set(40, BANK, 56, flower);
  b.set(56, BANK, 58, flower);

  // ===== 看板（入口・右） =====
  b.pillar(56, 64, BANK + 1, BANK + 2, wood);
  b.box(55, BANK + 3, 64, 57, BANK + 4, 64, castlewall);

  world.setBlocksBatch(b.cells);
}

export const shimanto: SpotDefinition = {
  id: 'shimanto',
  name: 'Shimanto River',
  nameJa: '四万十川',
  emoji: '🏞️',
  available: true,
  center: { x: 48, y: 12, z: 44 },
  viewDistance: 58,
  spawn: { pos: { x: 48, y: BANK + 1, z: 66 }, yaw: 0 },
  field: { min: { x: 28, y: 0, z: 26 }, max: { x: 68, y: 0, z: 69 } },
  // 川ぞいの山里。川は外へ流れ、両がわに山
  backdrop: { near: 'village', far: 'mountains' },
  build,
  objects: [
    {
      id: 'river',
      name: 'Shimanto River',
      nameJa: '四万十川',
      region: { min: { x: 28, y: 9, z: 36 }, max: { x: 68, y: 11, z: 52 } },
      focus: { x: 40, y: 10, z: 44 },
      image: './photos/shimanto/river.jpg',
      guide: {
        canDo: 'You can see a wide, clear river.',
        feature: 'The water is very clean.',
        about: 'It is a famous clean river. People call it "the last clear river."',
      },
    },
    {
      id: 'bridge',
      name: 'Low Bridge (Chinkabashi)',
      nameJa: '沈下橋',
      region: { min: { x: 46, y: 11, z: 36 }, max: { x: 50, y: 12, z: 52 } },
      focus: { x: 48, y: 12, z: 44 },
      image: './photos/shimanto/bridge.jpg',
      guide: {
        canDo: 'You can walk across the low bridge.',
        feature: 'It is low and flat.',
        about: 'It rains a lot. Then the water goes over the bridge. But the bridge is OK!',
      },
    },
    {
      id: 'canoe',
      name: 'Canoes',
      nameJa: 'カヌー',
      region: { min: { x: 33, y: 10, z: 39 }, max: { x: 43, y: 13, z: 52 } },
      focus: { x: 38, y: 12, z: 45 },
      image: './photos/shimanto/canoe.jpg',
      guide: {
        canDo: 'You can see colorful canoes.',
        feature: 'They are small and colorful.',
        about: 'Canoes are fun! Splash, splash!',
      },
    },
    {
      id: 'houseboat',
      name: 'River Boat',
      nameJa: '屋形船',
      region: { min: { x: 55, y: 10, z: 40 }, max: { x: 65, y: 15, z: 46 } },
      focus: { x: 60, y: 13, z: 43 },
      image: './photos/shimanto/houseboat.jpg',
      guide: {
        canDo: 'You can see a boat with a roof.',
        feature: 'It is long and slow.',
        about: 'People ride this boat and enjoy the river.',
      },
    },
    {
      id: 'hills',
      name: 'Green Hills',
      nameJa: '緑の山',
      region: { min: { x: 28, y: 12, z: 26 }, max: { x: 68, y: 22, z: 35 } },
      focus: { x: 48, y: 16, z: 30 },
      image: './photos/shimanto/hills.jpg',
      guide: {
        canDo: 'You can see green hills.',
        feature: 'They are round and green.',
        about: 'The green hills are by the river. The air is good!',
      },
    },
    {
      id: 'sign',
      name: 'Information Sign',
      nameJa: '看板',
      region: { min: { x: 55, y: 12, z: 63 }, max: { x: 57, y: 17, z: 65 } },
      focus: { x: 56, y: 14, z: 64 },
      image: './photos/shimanto/sign.jpg',
      guide: {
        canDo: 'You can read about this place.',
        feature: 'It is about the Shimanto River.',
        about: 'Let\'s read the sign!',
      },
    },
  ],
};
