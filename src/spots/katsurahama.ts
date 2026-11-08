import type { World } from '@/world/World';
import { Build } from './Build';
import type { SpotDefinition } from './SpotDefinition';

/**
 * 桂浜（Katsurahama）— 高知の代表的な浜。「月の名所」としてよさこい節にも歌われる。
 * 海・砂浜（五色石）・竜王宮（赤い鳥居＋小さなほこら。浜から石の道で渡れる）・
 * 岬の岩（龍頭岬・龍王岬）・松林・遊歩道・看板を子どもが見て楽しめるように作り込んだコンパクトワールド。
 * ※実物の桂浜は波が高く遊泳禁止（海のガイド英文で「浜から見る」ことを伝える）。
 *
 * 写真：`public/photos/katsurahama/*.jpg`（AIで作った写真風の画像を同梱）。
 * 先生が「📷 Add a photo」でアップロードすると、そちらが優先して表示される。
 *
 * 座標の目安：小さい z＝奥（海）／大きい z＝手前（陸）。
 *   海:     z 26〜44
 *   砂浜:   z 45〜67（砂の上面 = SAND）
 *   水面:   y = WATER
 */

const WATER = 14;
const SAND = 15; // 砂浜の上面（水面+1）
const TOP = SAND + 1; // 砂の上に物を置く高さ

/**
 * 鳥居（写真に合わせて：朱色の2本の柱と貫、その上に朱色の島木と、
 * はしが反り上がった黒い笠木）。柱は x±1 ＝浜からの道（z方向）をくぐれる向き。
 */
function toriiGate(b: Build, x: number, baseY: number, z: number, red: number, dark: number): void {
  b.pillar(x - 1, z, baseY, baseY + 4, red);
  b.pillar(x + 1, z, baseY, baseY + 4, red);
  b.box(x - 2, baseY + 3, z, x + 2, baseY + 3, z, red); // 貫（柱の外へ少しはみ出す）
  b.box(x - 2, baseY + 5, z, x + 2, baseY + 5, z, red); // 島木
  b.box(x - 3, baseY + 6, z, x + 3, baseY + 6, z, dark); // 黒い笠木
  b.set(x - 3, baseY + 7, z, dark); // はしが反り上がる
  b.set(x + 3, baseY + 7, z, dark);
  b.set(x, baseY + 4, z, red); // 額束（まん中の短い柱）
}

function build(world: World): void {
  const b = new Build();
  const stone = b.id('stone');
  const sand = b.id('sand');
  const water = b.id('water');
  const stonewall = b.id('stonewall');
  const wood = b.id('wood');
  const roof = b.id('roof'); // ブロンズ風の濃い茶
  const tile = b.id('tile');
  const torii = b.id('torii');
  const lantern = b.id('lantern');
  const castlewall = b.id('castlewall'); // 白＝波しぶき・看板
  const road = b.id('road');
  const grass = b.id('grass');
  const flower = b.id('flower');
  const brick = b.id('brick');
  const turf = b.id('turf');
  const darkRock = b.id('dirt'); // 岬の茶色っぽい黒い岩
  const leaves = b.id('leaves');

  // ===== 地面の土台 =====
  b.box(26, 9, 26, 70, 9, 70, stone);

  // ===== 海（z 26〜44）：砂の海底＋水 =====
  b.box(27, 10, 26, 69, 12, 44, sand);
  b.box(27, 13, 26, 69, WATER, 44, water); // 水 13〜14

  // ===== 砂浜（z 45〜70）：平らな砂、上面 = SAND =====
  // field の端（z70）まで敷くことで、看板（z66）の正面にもきちんと同じ高さの足場ができる
  // （以前は z67 までしかなく、その先が土台の岩盤（5ブロック低い）に落ち込んでいた）
  b.box(28, 10, 45, 68, SAND, 70, sand);

  // 波打ち際の白い波しぶき（控えめに）
  for (let x = 30; x <= 66; x++) {
    if ((x * 3) % 5 !== 0) b.set(x, WATER, 44, castlewall);
  }

  // ===== 五色石（桂浜名物）：渚ぞいの帯だけにまとめる＝奥は平らな砂のまま（建築スペース） =====
  const pebbles = [flower, brick, tile, turf, stonewall];
  // 写真のように、色とりどりの小石が浜にたくさん散らばる
  for (let z = 45; z <= 56; z++) {
    for (let x = 28; x <= 68; x++) {
      if ((x * 13 + z * 7) % 4 === 0) {
        b.set(x, SAND, z, pebbles[(x + z) % pebbles.length]);
      }
    }
  }

  // ===== 岬の岩（龍頭岬・龍王岬）：左右に岩山＋ふっくらした松 =====
  // 写真のように、茶色っぽい黒い岩の崖の上を、こんもりした松の森がおおう
  b.mound(30, 33, 11, 23, 6, darkRock, grass);
  b.mound(66, 33, 11, 22, 6, darkRock, grass);
  for (const [x, y, z] of [
    [30, 23, 33],
    [27, 20, 30],
    [33, 20, 30],
    [28, 19, 37],
    [66, 22, 33],
    [63, 20, 30],
    [69, 19, 31],
    [68, 19, 37],
  ] as const) {
    b.pine(x, y, z, 3, 3, 2);
  }
  b.sphere(31, 21, 36, 2, leaves); // こんもりした木
  b.sphere(64, 21, 36, 2, leaves);

  // ===== 竜王宮（龍王岬の赤い鳥居＋小さなほこら。浜から石の道でわたり、鳥居をくぐってお参り） =====
  b.mound(60, 38, 11, SAND, 5, darkRock, stone); // 岬の黒い岩（上面 = SAND）
  b.box(58, 11, 34, 62, SAND, 38, stone); // ほこらの立つ岩の台
  b.box(60, 11, 41, 60, SAND, 44, stonewall); // 浜からわたる石だたみの道（鳥居へ続く）
  b.box(59, SAND, 39, 61, SAND, 40, stonewall);
  toriiGate(b, 60, TOP, 40, torii, tile); // 道の上に立つ鳥居（くぐれる）
  // ほこら（写真のように、朱色の小さな社。屋根は赤茶で、前に白いしめなわ）
  b.box(59, TOP, 35, 61, TOP + 1, 37, torii);
  b.box(60, TOP, 37, 60, TOP, 37, wood); // 扉
  b.set(60, TOP + 1, 38, castlewall); // しめなわ
  b.box(58, TOP + 2, 34, 62, TOP + 2, 38, roof); // 屋根（張り出す）
  b.box(59, TOP + 3, 34, 61, TOP + 3, 38, roof);
  b.box(60, TOP + 4, 34, 60, TOP + 4, 38, roof); // 棟
  b.set(59, TOP, 38, stonewall); // 参道の石（左右）
  b.set(61, TOP, 38, stonewall);

  // （坂本龍馬像は、2026-11-08 先生の希望で桂浜からはなくした。「坂本龍馬像」のカードと重なるため）

  // ===== 松林（後方のふちに数本だけ・中央は開けて建築スペースに） =====
  const grove: [number, number, number][] = [
    [32, 64, 4],
    [35, 66, 5],
    [30, 59, 3],
    [64, 64, 4],
    [61, 66, 5],
    [66, 59, 3],
  ];
  for (const [x, z, th] of grove) b.pine(x, SAND, z, th, th, 2);

  // ===== 遊歩道（手前から像へ）＋灯籠2つだけ =====
  for (let z = 54; z <= 66; z++) {
    b.set(47, SAND, z, road);
    b.set(48, SAND, z, road);
    b.set(49, SAND, z, road);
  }
  b.set(45, TOP, 64, lantern);
  b.set(51, TOP, 64, lantern);

  // ===== 看板（入口） =====
  b.pillar(53, 66, TOP, TOP + 1, wood);
  b.box(52, TOP + 2, 66, 54, TOP + 3, 66, castlewall);

  world.setBlocksBatch(b.cells);
}

export const katsurahama: SpotDefinition = {
  id: 'katsurahama',
  name: 'Katsurahama Beach',
  nameJa: '桂浜',
  emoji: '🏖️',
  available: true,
  center: { x: 48, y: 20, z: 48 },
  viewDistance: 56,
  spawn: { pos: { x: 48, y: 16, z: 64 }, yaw: 0 },
  // 歩ける範囲＝建築できる範囲＝作り込んだ地面（岩盤 x26–70, z26–70）。外の海の先（空中）へは出られない
  field: { min: { x: 26, y: 0, z: 26 }, max: { x: 70, y: 0, z: 70 } },
  // 南に太平洋、うしろは松の森と低い山
  backdrop: { near: 'forest', far: 'hills' },
  build,
  objects: [
    {
      id: 'sea',
      name: 'The Pacific Ocean',
      nameJa: '太平洋',
      region: { min: { x: 27, y: 12, z: 26 }, max: { x: 69, y: 15, z: 44 } },
      focus: { x: 48, y: 15, z: 35 },
      image: './photos/katsurahama/sea.jpg',
      guide: {
        canDo: 'You can watch the big waves.',
        feature: 'It is blue and very big.',
        about: 'The sea is strong here. Do not swim.',
      },
    },
    {
      id: 'beach',
      name: 'Katsurahama Beach',
      nameJa: '砂浜（五色石）',
      region: { min: { x: 28, y: 15, z: 45 }, max: { x: 68, y: 16, z: 67 } },
      focus: { x: 48, y: 16, z: 57 },
      image: './photos/katsurahama/beach.jpg',
      guide: {
        canDo: 'You can walk on the sand.',
        feature: 'It has small stones of five colors.',
        about: 'The moon is very pretty here. People sing about it!',
      },
    },
    {
      id: 'torii',
      name: 'Ryuogu Shrine',
      nameJa: '竜王宮',
      region: { min: { x: 56, y: 12, z: 35 }, max: { x: 64, y: 22, z: 44 } },
      focus: { x: 60, y: 18, z: 39 },
      image: './photos/katsurahama/torii.jpg',
      guide: {
        canDo: 'You can walk through the red gate to the small shrine.',
        feature: 'It is on a rock by the sea.',
        about: 'People come here and say thank you to the sea.',
      },
    },
    {
      id: 'pines',
      name: 'Pine Trees',
      nameJa: '松林',
      region: { min: { x: 28, y: 15, z: 57 }, max: { x: 68, y: 24, z: 67 } },
      focus: { x: 33, y: 19, z: 64 },
      image: './photos/katsurahama/pines.jpg',
      guide: {
        canDo: 'You can see many pine trees.',
        feature: 'They are green all year.',
        about: 'Green trees and white sand are very pretty.',
      },
    },
    {
      id: 'cape',
      name: 'Cape Rocks',
      nameJa: '岬の岩（龍頭・龍王）',
      region: { min: { x: 24, y: 11, z: 26 }, max: { x: 37, y: 25, z: 42 } },
      focus: { x: 30, y: 20, z: 34 },
      image: './photos/katsurahama/cape.jpg',
      guide: {
        canDo: 'You can see big rocks by the sea.',
        feature: 'They are on the two sides of the beach.',
        about: 'Their names are Dragon Head and Dragon King!',
      },
    },
    {
      id: 'sign',
      name: 'Information Sign',
      nameJa: '看板',
      region: { min: { x: 52, y: 15, z: 65 }, max: { x: 54, y: 20, z: 67 } },
      focus: { x: 53, y: 18, z: 66 },
      image: './photos/katsurahama/sign.jpg',
      guide: {
        canDo: 'You can read about this place.',
        feature: 'It is about Katsurahama.',
        about: 'Let\'s read the sign!',
      },
    },
  ],
};
