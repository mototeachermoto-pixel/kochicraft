import type { World } from '@/world/World';
import { Build } from './Build';
import type { SpotDefinition } from './SpotDefinition';

/**
 * にこ淵（Nikobuchi）— 仁淀川の支流・枝川川にある神秘的な淵。「仁淀ブルー」発祥の地。
 * 実物どおり、森の入口から「石段を下って」谷底の青い淵にたどり着く縦構造で再現：
 *   - 上：森の入口の平らな広場（スタート＆建築スペース）。
 *   - 中：左右を岩壁にはさまれた「手すり付きの細い下り石段」（実物の遊歩道）。
 *   - 下：谷底の「仁淀ブルー」の淵。岸近くは浅く明るい青、滝つぼ側は深い青。
 *   - 奥の崖から細くまっすぐ落ちる滝。まわりは高い岩壁と緑の森。
 *   - 水神（大蛇）の伝説がある神聖な場所（ガイド英文で紹介）。
 *
 * 座標の目安：小さい z＝奥（滝）／大きい z＝手前（入口・スポーン）。高さ：上=18, 水面=10。
 *   入口広場: z 53〜69（上面 = TOP）
 *   石段:     z 45〜52（x42〜54、y17→y10 へ下る）
 *   淵:       z 31〜42（水面 = 10）／滝: 奥 z 26〜30
 */

const TOP = 18; // 入口広場の上面。立つのは TOP+1
const POND = 10; // 谷底の水面・着地の高さ。立つのは POND+1

function build(world: World): void {
  const b = new Build();
  const stone = b.id('stone');
  const stonewall = b.id('stonewall'); // 石段・着地の石畳
  const grass = b.id('grass'); // 森の地面・苔
  const water = b.id('water');
  const glass = b.id('glass'); // 仁淀ブルーの明るい底
  const wood = b.id('wood');
  const leaves = b.id('leaves'); // （pine 内で使用）
  const castlewall = b.id('castlewall'); // 滝のしぶき・看板
  const flower = b.id('flower');
  void leaves;

  // ===== 上：森の入口（平らな広場＝スタート＆建築スペース） =====
  b.box(28, 8, 53, 68, TOP - 1, 69, stone);
  b.box(28, TOP, 53, 68, TOP, 69, grass);

  // ===== 谷の左右の岩壁（上に森。石段や淵をはさむ） =====
  b.box(28, 8, 31, 41, TOP - 1, 52, stone);
  b.box(28, TOP, 31, 41, TOP, 52, grass);
  b.box(55, 8, 31, 68, TOP - 1, 52, stone);
  b.box(55, TOP, 31, 68, TOP, 52, grass);

  // ===== 奥の高い崖（滝がかかる） =====
  b.box(28, 8, 26, 68, 21, 30, stone);
  b.box(28, 22, 26, 68, 22, 30, grass);

  // ===== 下りの石段（z52→z45 で y17→y10 へ1段ずつ下る）＝実物どおり細い道＋木の手すり =====
  for (let i = 0; i < 8; i++) {
    const z = 52 - i;
    const sy = 17 - i;
    b.box(42, 8, z, 54, sy - 1, z, stone); // 段の土台（谷幅ぶん）
    b.box(45, sy, z, 51, sy, z, stonewall); // 石段の表面（細い道）
    b.box(42, sy, z, 44, sy, z, stone); // わきの岩の斜面（左）
    b.box(52, sy, z, 54, sy, z, stone); // わきの岩の斜面（右）
    b.set(45, sy + 1, z, wood); // 手すり（左）
    b.set(51, sy + 1, z, wood); // 手すり（右）
  }

  // ===== 谷底：着地の石畳＋仁淀ブルーの淵 =====
  b.box(42, 8, 43, 54, POND - 1, 44, stone); // 着地の下
  b.box(42, POND, 43, 54, POND, 44, stonewall); // 着地の石畳（stand POND+1）
  b.box(42, 8, 31, 54, 8, 42, glass); // 淵の底（明るい青＝高い透明度）
  b.box(42, 9, 31, 54, POND, 42, water); // 水 y9〜10（透き通った仁淀ブルー）
  // 岸に近いところは底を1段上げて浅くする＝ふちが明るい青・滝つぼ側が深い青（実物の見え方）
  b.box(42, 9, 31, 42, 9, 42, glass);
  b.box(54, 9, 31, 54, 9, 42, glass);
  b.box(43, 9, 42, 53, 9, 42, glass);

  // ===== 滝（奥の崖から細くまっすぐ落ちる＝実物の姿） =====
  b.box(47, POND, 30, 49, 21, 30, water); // 細い滝の水
  b.box(46, 21, 29, 50, 22, 29, water); // 崖の上の水源
  for (let x = 46; x <= 50; x++) b.set(x, POND, 31, castlewall); // 滝つぼの白いしぶき

  // ===== 木の桟橋（淵をのぞける／着地の先） =====
  b.box(45, POND, 42, 51, POND, 42, wood);

  // ===== 森の木（崖の上）＝緑のクオリティ =====
  b.pine(34, TOP, 36, 4, 4, 2);
  b.pine(34, TOP, 46, 3, 3, 1);
  b.pine(30, TOP, 42, 3, 3, 1);
  b.pine(62, TOP, 36, 3, 3, 1);
  b.pine(62, TOP, 46, 4, 4, 2);
  b.pine(66, TOP, 42, 3, 3, 1);
  b.pine(36, 22, 28, 4, 4, 2);
  b.pine(48, 22, 27, 5, 5, 2);
  b.pine(60, 22, 28, 4, 4, 2);
  b.pine(32, TOP, 60, 4, 4, 2);
  b.pine(64, TOP, 58, 4, 4, 2);

  // ===== 苔（岩壁の面にちらほら緑） =====
  for (const [x, y, z] of [
    [41, 15, 40],
    [41, 13, 44],
    [55, 15, 38],
    [55, 12, 46],
    [42, 12, 32],
    [54, 11, 34],
  ] as const) {
    b.set(x, y, z, grass);
  }

  // ===== 淵のふちの花 =====
  b.set(43, POND, 43, flower);
  b.set(53, POND, 43, flower);

  // ===== 看板（入口の広場） =====
  b.pillar(56, 64, TOP + 1, TOP + 2, wood);
  b.box(55, TOP + 3, 64, 57, TOP + 4, 64, castlewall);

  world.setBlocksBatch(b.cells);
}

export const nikobuchi: SpotDefinition = {
  id: 'nikobuchi',
  name: 'Nikobuchi Pond',
  nameJa: 'にこ淵',
  emoji: '💧',
  available: true,
  center: { x: 48, y: 13, z: 40 },
  viewDistance: 60,
  spawn: { pos: { x: 48, y: TOP + 1, z: 66 }, yaw: 0 },
  field: { min: { x: 28, y: 0, z: 26 }, max: { x: 68, y: 0, z: 69 } },
  build,
  objects: [
    {
      id: 'steps',
      name: 'Stone Steps',
      nameJa: '下りの石段',
      region: { min: { x: 42, y: 10, z: 45 }, max: { x: 54, y: 18, z: 52 } },
      focus: { x: 48, y: 14, z: 49 },
      image: './photos/nikobuchi/steps.jpg',
      guide: {
        canDo: 'You can walk down to the blue pond.',
        feature: 'The steps go down to the water.',
        about: 'Go down, down, down. The blue water is there!',
      },
    },
    {
      id: 'pond',
      name: 'Nikobuchi Pond',
      nameJa: 'にこ淵（仁淀ブルー）',
      region: { min: { x: 42, y: 9, z: 31 }, max: { x: 54, y: 11, z: 42 } },
      focus: { x: 48, y: 11, z: 36 },
      image: './photos/nikobuchi/pond.jpg',
      guide: {
        canDo: 'You can look into the clear blue water.',
        feature: 'It is very blue. Its name is Niyodo Blue.',
        about: 'People say a big snake lives here. Be quiet, please.',
      },
    },
    {
      id: 'waterfall',
      name: 'Waterfall',
      nameJa: '滝',
      region: { min: { x: 44, y: 10, z: 28 }, max: { x: 52, y: 22, z: 31 } },
      focus: { x: 48, y: 15, z: 30 },
      image: './photos/nikobuchi/waterfall.jpg',
      guide: {
        canDo: 'You can watch the falling water.',
        feature: 'It is white. It goes straight down.',
        about: 'The water is very clean. So the pond is blue!',
      },
    },
    {
      id: 'rocks',
      name: 'Rocks and Forest',
      nameJa: '岩と森',
      region: { min: { x: 28, y: 18, z: 31 }, max: { x: 41, y: 23, z: 52 } },
      focus: { x: 35, y: 20, z: 45 },
      image: './photos/nikobuchi/rocks.jpg',
      guide: {
        canDo: 'You can see big rocks and green trees.',
        feature: 'They are big and tall.',
        about: 'It is cool and quiet here.',
      },
    },
    {
      id: 'sign',
      name: 'Information Sign',
      nameJa: '看板',
      image: './photos/nikobuchi/sign.jpg',
      region: { min: { x: 55, y: 19, z: 63 }, max: { x: 57, y: 24, z: 65 } },
      focus: { x: 56, y: 21, z: 64 },
      guide: {
        canDo: 'You can read about this place.',
        feature: 'It is about Nikobuchi.',
        about: 'This is a sign. It helps you learn about Nikobuchi.',
      },
    },
  ],
};
