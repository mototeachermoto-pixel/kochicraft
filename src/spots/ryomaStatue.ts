import type { World } from '@/world/World';
import { Build } from './Build';
import type { SpotDefinition } from './SpotDefinition';

/**
 * 坂本龍馬像（Statue of Sakamoto Ryoma）— 像そのものを主役にした独立スポット。
 * （桂浜の中の像とは別カード。ここでは大きな像へ正面の大階段で近づく。）
 *   - スタート地点の正面から「大きな階段」がまっすぐ伸び、上ると龍馬の顔の高さの展望デッキに到達。
 *   - 像はこちら（上ってくる人）を向き、上りきると龍馬と対面できる（海は像の背景）。
 *   - 太平洋・記念碑、階段の両わきは広い平らな広場（建築スペース）。
 *
 * 実物の豆知識（英語ガイドに反映）：
 *   - 像5.3m＋台座＝総高13.5m。昭和3年(1928)に高知の青年たちの募金で建立。
 *   - 毎年秋（誕生日＝命日の11/15前後）に像の横へ本物の展望台が組まれる「龍馬に大接近」開催。
 *
 * 座標の目安：小さい z＝奥（像・海）／大きい z＝手前（入口・スポーン）。床 = G。
 *   海: z26〜32／像: z33〜39（cz36, +z＝手前を向く）／大階段: x44〜52, z42〜62／デッキ: z40〜41
 */

const G = 10; // 広場・階段下の上面。立つのは G+1

/** 大きな坂本龍馬像（高い台座＋懐手の立ち姿。顔は +z＝上ってくる人の方を向く）。 */
function buildRyoma(b: Build, cx: number, cz: number, stoneW: number, bronze: number, dark: number): void {
  b.box(cx - 3, G, cz - 3, cx + 3, G, cz + 3, stoneW); // 7x7 土台
  b.box(cx - 2, G + 1, cz - 2, cx + 2, G + 1, cz + 2, stoneW); // 5x5
  b.box(cx - 1, G + 2, cz - 1, cx + 1, G + 7, cz + 1, stoneW); // 3x3 の高い柱
  b.box(cx - 2, G + 8, cz - 2, cx + 2, G + 8, cz + 2, stoneW); // 5x5 笠石
  const py = G + 8; // 台座の上面（y18）
  b.set(cx, py + 1, cz, dark); // ブーツ
  b.box(cx - 1, py + 2, cz, cx + 1, py + 2, cz, bronze); // 袴（下が広い）
  b.set(cx, py + 3, cz, bronze); // 胴
  b.set(cx, py + 4, cz, bronze);
  b.box(cx - 1, py + 5, cz, cx + 1, py + 5, cz, bronze); // 肩
  b.set(cx, py + 6, cz, bronze); // 頭
  b.set(cx, py + 7, cz, dark); // 髪
  b.set(cx, py + 7, cz - 1, dark); // 後ろ髪（海側＝-z。顔は +z を向く）
}

/** 記念碑（石の台座＋石碑＋濃い色の文字） */
function monument(b: Build, x: number, z: number, stone: number, dark: number): void {
  b.box(x - 1, G + 1, z - 1, x + 1, G + 1, z + 1, stone);
  b.box(x - 1, G + 2, z, x + 1, G + 4, z, stone);
  b.set(x, G + 3, z, dark);
}

function build(world: World): void {
  const b = new Build();
  const stone = b.id('stone');
  const stonewall = b.id('stonewall'); // 台座・大階段
  const sand = b.id('sand');
  const water = b.id('water');
  const grass = b.id('grass');
  const wood = b.id('wood'); // デッキ・看板・灯籠
  const roof = b.id('roof'); // ブロンズ（像）
  const tile = b.id('tile'); // 濃い色（髪・ブーツ・碑の文字）
  const glass = b.id('glass'); // デッキの柵（見える・落ちない）
  const lantern = b.id('lantern');
  const castlewall = b.id('castlewall'); // 看板
  const flower = b.id('flower');

  // ===== 土台 =====
  b.box(28, 7, 26, 68, 9, 69, stone);

  // ===== 太平洋（像の背景・奥） =====
  b.box(28, 8, 26, 68, 8, 32, sand); // 海底
  b.box(28, 9, 26, 68, G, 32, water); // 海 y9〜10

  // ===== 広場（平らな建築スペース。階段の両わき＆手前） =====
  b.box(28, G, 33, 68, G, 69, grass);

  // ===== 大きな坂本龍馬像（海を背に、こちらを向いて立つ） =====
  buildRyoma(b, 48, 36, stonewall, roof, tile);

  // ===== スタート正面からの大階段（中央・まっすぐ像へ上る） =====
  // z62→z42 で y11→y21 へ（2マスごとに1段＝上りやすい大階段）。両わきに石の手すり。
  for (let z = 62; z >= 42; z--) {
    const ty = 11 + Math.floor((62 - z) / 2);
    b.box(44, G, z, 52, ty, z, stonewall); // 段（中央・幅9）
    b.box(43, ty + 1, z, 43, ty + 2, z, stonewall); // 左の手すり
    b.box(53, ty + 1, z, 53, ty + 2, z, stonewall); // 右の手すり
  }
  // 上のデッキ（像の手前・顔の高さ y21）
  b.box(44, 21, 40, 52, 21, 41, wood); // デッキ床（階段の天端と段差なし）
  b.box(43, 22, 40, 43, 23, 41, glass); // 左の柵
  b.box(53, 22, 40, 53, 23, 41, glass); // 右の柵
  // 像側（北端）の柵＝のぞきこんでも落ちない。階段側（z41〜42）は開けて出入りできる
  b.box(44, 22, 40, 52, 23, 40, glass);

  // ===== 記念碑（左の広場） =====
  monument(b, 34, 52, stonewall, tile);

  // ===== 松＋石灯籠＋花（広場のふち。中央の階段は空ける） =====
  b.pine(32, G, 44, 4, 4, 2);
  b.pine(32, G, 60, 4, 4, 2);
  b.pine(64, G, 44, 4, 4, 2);
  b.pine(64, G, 60, 4, 4, 2);
  for (const [x, z] of [
    [40, 64],
    [56, 64],
  ] as const) {
    b.set(x, G + 1, z, stone);
    b.set(x, G + 2, z, lantern);
  }
  b.set(38, G, 58, flower);
  b.set(58, G, 56, flower);

  // ===== 看板（入口・右） =====
  b.pillar(62, 66, G + 1, G + 2, wood);
  b.box(61, G + 3, 66, 63, G + 4, 66, castlewall);

  world.setBlocksBatch(b.cells);
}

export const ryomaStatue: SpotDefinition = {
  id: 'ryoma-statue',
  name: 'Statue of Sakamoto Ryoma',
  nameJa: '坂本龍馬像',
  emoji: '🗿',
  available: true,
  center: { x: 48, y: 16, z: 46 },
  viewDistance: 64,
  // 階段全体と像を見上げられるよう、階段からすこし離れた位置からスタート
  spawn: { pos: { x: 48, y: G + 1, z: 68 }, yaw: 0 },
  field: { min: { x: 28, y: 0, z: 26 }, max: { x: 68, y: 0, z: 69 } },
  build,
  objects: [
    {
      id: 'statue',
      name: 'Statue of Sakamoto Ryoma',
      nameJa: '坂本龍馬像',
      region: { min: { x: 44, y: 10, z: 33 }, max: { x: 52, y: 26, z: 39 } },
      focus: { x: 48, y: 22, z: 36 },
      image: './photos/ryoma-statue/statue.jpg',
      guide: {
        canDo: 'You can look up at the huge Ryoma statue.',
        feature: 'He is very, very tall.',
        about: 'Young people of Kochi made it in 1928.',
      },
    },
    {
      id: 'deck',
      name: 'Viewing Deck',
      nameJa: '展望デッキ（龍馬に大接近）',
      region: { min: { x: 44, y: 21, z: 40 }, max: { x: 52, y: 24, z: 41 } },
      focus: { x: 48, y: 22, z: 41 },
      image: './photos/ryoma-statue/deck.jpg',
      guide: {
        canDo: 'You can climb the big steps to his face.',
        feature: 'His face is right there!',
        about: 'In fall, people make a real tower like this!',
      },
    },
    {
      id: 'sea',
      name: 'The Pacific Ocean',
      nameJa: '太平洋',
      region: { min: { x: 28, y: 9, z: 26 }, max: { x: 68, y: 11, z: 32 } },
      focus: { x: 48, y: 10, z: 29 },
      image: './photos/ryoma-statue/sea.jpg',
      guide: {
        canDo: 'You can see the sea behind Ryoma.',
        feature: 'It is big and blue.',
        about: 'The sea is behind Ryoma. He had a big dream!',
      },
    },
    {
      id: 'monument',
      name: 'Stone Monument',
      nameJa: '記念碑',
      region: { min: { x: 32, y: 10, z: 50 }, max: { x: 36, y: 15, z: 54 } },
      focus: { x: 34, y: 13, z: 52 },
      image: './photos/ryoma-statue/monument.jpg',
      guide: {
        canDo: 'You can find a stone with words.',
        feature: 'It is a stone with words.',
        about: 'It is about Ryoma.',
      },
    },
    {
      id: 'sign',
      name: 'Information Sign',
      nameJa: '看板',
      region: { min: { x: 61, y: 10, z: 65 }, max: { x: 63, y: 15, z: 67 } },
      focus: { x: 62, y: 12, z: 66 },
      image: './photos/ryoma-statue/sign.jpg',
      guide: {
        canDo: 'You can read about this place.',
        feature: 'It is about Sakamoto Ryoma.',
        about: 'This is a sign. It helps you learn about Sakamoto Ryoma.',
      },
    },
  ],
};
