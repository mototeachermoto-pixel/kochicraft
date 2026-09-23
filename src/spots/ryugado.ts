import type { World } from '@/world/World';
import { Build } from './Build';
import type { SpotDefinition } from './SpotDefinition';

/**
 * 龍河洞（Ryugado Cave）— 高知県香美市にある、日本三大鍾乳洞のひとつ。
 * 約1億7500万年かけてできた鍾乳洞。岩山の中をくり抜いた洞窟として再現：
 *   - 天井からぶら下がる鍾乳石、床から立ち上がる石筍、つながった石柱。
 *   - 地底を流れる青い川と「記念の滝」（実物は落差11m。1931年にこの滝の奥で大洞窟を発見）。
 *   - 石灰に包まれた古代の壺（神の壺）＝2000年前の弥生土器が鍾乳石と一体化したシンボル。
 *     弥生人が洞内に住んでいた痕跡も見つかっている。手前の広場から洞窟へ入る。
 *
 * 座標：小さい z＝奥／大きい z＝手前（入口・スポーン）。床 = G。フィールド x24〜72, z24〜72。
 */

const G = 10; // 床の上面。立つのは G+1
const AIR = 0;

function build(world: World): void {
  const b = new Build();
  const stone = b.id('stone'); // 岩山
  const stonewall = b.id('stonewall'); // 鍾乳石・石筍・流れ石（明るい灰）
  const water = b.id('water');
  const sand = b.id('sand'); // 洞内の砂
  const grass = b.id('grass'); // 外の広場
  const road = b.id('road'); // 通路
  const wood = b.id('wood'); // 看板
  const castlewall = b.id('castlewall'); // 看板
  const lantern = b.id('lantern'); // 洞内の灯り・神の壺
  const glass = b.id('glass'); // 結晶のきらめき

  // ===== 地面（フィールド全体・奈落防止） =====
  b.box(24, 8, 24, 72, 9, 72, stone);
  b.box(24, G, 24, 72, G, 72, grass);

  // ===== 手前の広場（スポーン）＋入口への道 =====
  b.box(44, G, 57, 52, G, 72, road);

  // ===== 岩山（この中に洞窟を彫る） =====
  b.box(28, 8, 26, 68, 18, 56, stone);
  b.box(32, 11, 29, 64, 15, 54, AIR); // 洞内をくり抜く
  b.box(43, 11, 55, 53, 14, 56, AIR); // 入口（手前の岩壁を開ける）
  b.box(38, 16, 33, 42, 18, 37, AIR); // 天井のスカイライト（光と眺め）
  b.box(54, 16, 44, 58, 18, 48, AIR);

  // ===== 洞内の床（砂・流れ石） =====
  for (const [x, z] of [[36, 32], [50, 50], [44, 40], [58, 36]] as const) b.box(x, G, z, x + 3, G, z + 3, sand);

  // ===== 鍾乳石（天井 y15 からぶら下がる） =====
  for (const [x, z, len] of [
    [36, 34, 3],
    [44, 32, 4],
    [52, 38, 3],
    [60, 33, 4],
    [40, 48, 3],
    [56, 50, 4],
    [48, 52, 2],
    [34, 44, 3],
  ] as const) {
    for (let i = 0; i < len; i++) b.set(x, 15 - i, z, stonewall);
  }

  // ===== 石筍（床 y11 から立ち上がる） =====
  for (const [x, z, h] of [
    [38, 40, 3],
    [48, 44, 4],
    [58, 42, 3],
    [42, 50, 2],
    [54, 48, 3],
    [36, 52, 3],
    [62, 50, 2],
  ] as const) {
    for (let i = 1; i <= h; i++) b.set(x, G + i, z, stonewall);
  }
  // 石柱（鍾乳石と石筍がつながった所）
  for (let y = G + 1; y <= 15; y++) b.set(48, y, 36, stonewall);

  // ===== 地底の川（青い水） =====
  b.box(33, 9, 45, 63, G, 46, water);

  // ===== 記念の滝（川の西端。岩壁から流れ落ちる。実物は落差11m＝1931年の大発見の場所） =====
  b.box(34, 11, 45, 35, 15, 46, water); // 落ちる水の柱
  b.set(36, G, 45, castlewall); // 滝つぼの白いしぶき
  b.set(36, G, 46, castlewall);
  b.set(37, G + 1, 47, lantern); // 滝を照らす灯り

  // ===== 神の壺（石灰に包まれた古代の壺） =====
  b.box(45, G + 1, 32, 47, G + 1, 34, stonewall); // 石灰の盛り上がり
  b.set(46, G + 2, 33, lantern); // 壺

  // ===== 洞内の灯り＋結晶のきらめき =====
  for (const [x, z] of [[34, 32], [60, 38], [40, 52], [58, 52], [48, 30]] as const) b.set(x, G + 1, z, lantern);
  for (const [x, z] of [[44, 36], [54, 42], [38, 46]] as const) b.set(x, G + 1, z, glass);

  // ===== 入口の看板 =====
  b.pillar(55, 60, G + 1, G + 2, wood);
  b.box(54, G + 3, 60, 56, G + 4, 60, castlewall);

  world.setBlocksBatch(b.cells);
}

export const ryugado: SpotDefinition = {
  id: 'ryugado',
  name: 'Ryugado Cave',
  nameJa: '龍河洞',
  emoji: '🕯️',
  available: true,
  center: { x: 48, y: 13, z: 42 },
  viewDistance: 56,
  spawn: { pos: { x: 48, y: G + 1, z: 70 }, yaw: 0 },
  field: { min: { x: 24, y: 0, z: 24 }, max: { x: 72, y: 0, z: 72 } },
  build,
  objects: [
    {
      id: 'stalactites',
      name: 'Stalactites and Stalagmites',
      nameJa: '鍾乳石と石筍',
      region: { min: { x: 38, y: 11, z: 30 }, max: { x: 64, y: 16, z: 54 } },
      focus: { x: 48, y: 13, z: 42 },
      image: './photos/ryugado/stalactites.jpg',
      guide: {
        canDo: 'You can see rock spikes from the roof and floor.',
        feature: 'They grow from the roof and the floor.',
        about: 'Drip, drip... They grow very, very slowly.',
      },
    },
    {
      id: 'pot',
      name: 'The Ancient Pot',
      nameJa: '神の壺',
      region: { min: { x: 44, y: 10, z: 31 }, max: { x: 48, y: 14, z: 35 } },
      focus: { x: 46, y: 12, z: 33 },
      image: './photos/ryugado/pot.jpg',
      guide: {
        canDo: 'You can find the famous old pot.',
        feature: 'It is in the rock.',
        about: 'People made this pot long, long ago. People lived here!',
      },
    },
    {
      id: 'falls',
      name: 'Cave Waterfall',
      nameJa: '記念の滝',
      region: { min: { x: 32, y: 9, z: 43 }, max: { x: 37, y: 16, z: 48 } },
      focus: { x: 35, y: 13, z: 45 },
      image: './photos/ryugado/falls.jpg',
      guide: {
        canDo: 'You can find a waterfall in the cave.',
        feature: 'The water falls down, down!',
        about: 'A big cave is behind this water. People saw it in 1931!',
      },
    },
    {
      id: 'stream',
      name: 'Underground Stream',
      nameJa: '地底の川',
      region: { min: { x: 38, y: 9, z: 45 }, max: { x: 63, y: 11, z: 46 } },
      focus: { x: 48, y: 10, z: 45 },
      image: './photos/ryugado/stream.jpg',
      guide: {
        canDo: 'You can see a river inside the cave.',
        feature: 'The water is cold and clean.',
        about: 'The river is in the cave. Brr, it is cold!',
      },
    },
    {
      id: 'cave',
      name: 'Ryugado Cave',
      nameJa: '龍河洞',
      region: { min: { x: 28, y: 10, z: 26 }, max: { x: 68, y: 18, z: 56 } },
      focus: { x: 48, y: 13, z: 45 },
      image: './photos/ryugado/cave.jpg',
      guide: {
        canDo: 'You can walk inside a big cave.',
        feature: 'It is one of the three big caves of Japan.',
        about: 'Water made this cave. It is very, very old!',
      },
    },
    {
      id: 'sign',
      name: 'Information Sign',
      nameJa: '看板',
      region: { min: { x: 54, y: 10, z: 59 }, max: { x: 56, y: 15, z: 61 } },
      focus: { x: 55, y: 12, z: 60 },
      image: './photos/ryugado/sign.jpg',
      guide: {
        canDo: 'You can read about this place.',
        feature: 'It is about Ryugado Cave.',
        about: 'This is a sign. It helps you learn about Ryugado Cave.',
      },
    },
  ],
};
