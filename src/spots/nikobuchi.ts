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
  const leaves = b.id('leaves'); // シダ・広葉樹の葉
  const castlewall = b.id('castlewall'); // 白い滝としぶき・看板
  const flower = b.id('flower');

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
  // 本物の写真がないので見どころの説明はなくした（2026-11-14）。淵へおりるただ1つの道なので、3Dは残す
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

  // ===== 滝（写真のように、奥の崖から白く細いリボンのようにまっすぐ落ちる） =====
  b.box(47, POND + 1, 30, 48, 21, 30, castlewall); // 白い滝（はば2）
  b.box(47, 21, 29, 48, 22, 29, water); // 崖の上の水源
  // 滝の左右の黒っぽいぬれた岩（白い滝がよく見えるように）
  b.box(45, POND + 1, 30, 46, 20, 30, stonewall);
  b.box(49, POND + 1, 30, 50, 20, 30, stonewall);
  // 滝つぼの白いしぶき
  for (const [x, z] of [
    [46, 31],
    [47, 31],
    [48, 31],
    [49, 31],
    [47, 32],
    [48, 32],
  ] as const) {
    b.set(x, POND, z, castlewall);
  }

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

  // ===== 苔とシダ（写真のように、谷の岩壁は緑におおわれている） =====
  // 岩壁の面（x41・x55・奥の崖 z30）に、まだらに苔（明るい緑）とシダ（濃い緑）をはる
  for (let y = POND + 1; y <= TOP - 1; y++) {
    for (let z = 31; z <= 52; z++) {
      for (const x of [41, 55]) {
        const h = (x * 5 + y * 7 + z * 3) % 5;
        if (h === 0 || h === 2) b.set(x, y, z, grass);
        else if (h === 4) b.set(x, y, z, leaves);
      }
    }
    for (let x = 28; x <= 68; x++) {
      if (x >= 45 && x <= 50) continue; // 滝のまわりはぬれた岩のまま
      const h = (x * 5 + y * 7) % 5;
      if (h === 1 || h === 3) b.set(x, y, 30, grass);
    }
  }
  // 崖のふちから垂れるシダ・やぶ
  for (let z = 31; z <= 52; z += 2) {
    b.set(41, TOP, z, leaves);
    b.set(55, TOP, z, leaves);
    b.set(42, TOP, z, leaves);
    b.set(54, TOP, z, leaves);
  }

  // ===== 苔むした丸い岩（写真の淵をかこむ大きな岩） =====
  b.boulder(43, POND, 33, 2, stone, grass); // 左奥（滝のそば）
  b.boulder(53, POND, 33, 2, stone, grass); // 右奥
  b.boulder(42, POND, 38, 1, stone, grass); // 左
  b.boulder(54, POND, 39, 2, stone, grass); // 右手前
  b.boulder(51, POND - 1, 31, 1, stone, grass); // 滝のそばの小さな岩
  b.boulder(45, POND, 31, 1, stone, grass);
  b.boulder(43, POND + 1, 44, 1, stone, grass); // 着地のわき
  b.boulder(53, POND + 1, 44, 1, stone, grass);
  // 淵の底の小石（すき通った水の下に見える）
  for (const [x, z] of [
    [45, 40],
    [47, 39],
    [50, 40],
    [52, 37],
    [44, 36],
    [49, 35],
  ] as const) {
    b.set(x, 8, z, stone);
  }

  // ===== 谷の上の広葉樹（写真の森は丸い葉の木が多い） =====
  b.roundTree(38, TOP, 33, 3, 2, wood, leaves);
  b.roundTree(58, TOP, 34, 3, 2, wood, leaves);
  b.roundTree(38, TOP, 50, 2, 2, wood, leaves);
  b.roundTree(58, TOP, 49, 2, 2, wood, leaves);
  b.roundTree(42, 22, 28, 3, 2, wood, leaves);
  b.roundTree(55, 22, 28, 3, 2, wood, leaves);

  // ===== 淵のふちの花 =====
  b.set(43, POND, 43, flower);
  b.set(53, POND, 43, flower);


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
  // 山おくの森の中の淵
  backdrop: { near: 'forest', far: 'mountains' },
  build,
  objects: [
    {
      id: 'pond',
      name: 'Nikobuchi Pond',
      nameJa: 'にこ淵（仁淀ブルー）',
      region: { min: { x: 42, y: 9, z: 31 }, max: { x: 54, y: 11, z: 42 } },
      focus: { x: 48, y: 11, z: 36 },
      image: './photos/nikobuchi/pond.jpg',
      credit: 'Photo: Dokudami / CC BY-SA 4.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can look into the clear blue water.',
        feature: 'It is very blue.',
        about: 'We call it "Niyodo Blue."',
      },
    },
    {
      id: 'waterfall',
      name: 'Waterfall',
      nameJa: '滝',
      region: { min: { x: 45, y: 10, z: 29 }, max: { x: 50, y: 22, z: 32 } },
      focus: { x: 48, y: 15, z: 30 },
      image: './photos/nikobuchi/waterfall.jpg',
      credit: 'Photo: Dokudami / CC BY-SA 4.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can watch the falling water.',
        feature: 'It is white.',
        about: 'The water is clean.',
      },
    },
    {
      id: 'rocks',
      name: 'Rocks and Forest',
      nameJa: '岩と森',
      region: { min: { x: 28, y: 18, z: 31 }, max: { x: 41, y: 23, z: 52 } },
      focus: { x: 35, y: 20, z: 45 },
      image: './photos/nikobuchi/rocks.jpg',
      credit: 'Photo: Dokudami / CC BY-SA 4.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can see big rocks and green trees.',
        feature: 'They are big.',
        about: 'It is cool and quiet.',
      },
    },
  ],
};
