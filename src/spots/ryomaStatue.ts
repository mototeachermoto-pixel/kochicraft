import type { World } from '@/world/World';
import { Build } from './Build';
import { ryomaFigure } from './ryomaFigure';
import { BARRIER_ID } from '@/world/blocks/blockTypes';
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
 *   海: z26〜32／像: z32〜40（cz36, +z＝手前を向く）／大階段: x44〜52, z42〜62／デッキ: z40〜41
 * 像の顔は y31 ごろ。デッキ（y29。立つと目の高さが約 y31.6）から顔と向き合える。
 */

const G = 10; // 広場・階段下の上面。立つのは G+1

/**
 * 大きな坂本龍馬像（写真に合わせて：2段の石の土台＋太い台座＋笠石＋立ち姿。顔は +z＝上ってくる人の方）。
 * 台座の前には、写真と同じく濃い色の銘板をつける。
 */
function buildRyoma(
  b: Build,
  cx: number,
  cz: number,
  stoneW: number,
  stone: number,
  body: number,
  dark: number,
): void {
  b.box(cx - 4, G, cz - 4, cx + 4, G, cz + 4, stoneW); // 9x9 土台（1段目）
  b.box(cx - 3, G + 1, cz - 3, cx + 3, G + 1, cz + 3, stoneW); // 7x7 土台（2段目）
  b.box(cx - 2, G + 2, cz - 2, cx + 2, G + 6, cz + 2, stoneW); // 5x5 の太い台座
  b.box(cx, G + 3, cz + 2, cx, G + 5, cz + 2, dark); // 台座の前の銘板
  b.box(cx - 3, G + 7, cz - 3, cx + 3, G + 7, cz + 3, stone); // 7x7 笠石（少し明るい石）
  b.box(cx - 2, G + 8, cz - 2, cx + 2, G + 8, cz + 2, stoneW); // 5x5 像の足もとの台
  ryomaFigure(b, cx, G + 8, cz, 1, body, dark); // 立ち姿（y19〜33）
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
  const tile = b.id('tile'); // 碑の文字
  const bronze = b.id('bronze'); // 像（青緑がかった銅像の色）
  const bronzeDark = b.id('bronzedark'); // 像の濃い所（袴・髪・目）・台座の銘板
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
  buildRyoma(b, 48, 36, stonewall, stone, bronze, bronzeDark);

  // ===== スタート正面からの大階段（中央・まっすぐ像へ上る） =====
  // z62→z42 で y11→y29 へ（1段はブロック1つ分まで＝歩いて上れる）。両わきに石の手すり。
  // 像を写真に合わせて高くしたので、顔の高さのデッキ（y29）まで上れるようにした
  for (let z = 62; z >= 42; z--) {
    const ty = 11 + Math.floor(((62 - z) * 18) / 20);
    b.box(44, G, z, 52, ty, z, stonewall); // 段（中央・幅9）
    b.box(43, ty + 1, z, 43, ty + 2, z, stonewall); // 左の手すり
    b.box(53, ty + 1, z, 53, ty + 2, z, stonewall); // 右の手すり
    // 手すりの上に見えない壁（ジャンプしても階段の外へ落ちない）
    b.box(43, ty + 3, z, 43, ty + 7, z, BARRIER_ID);
    b.box(53, ty + 3, z, 53, ty + 7, z, BARRIER_ID);
  }
  // 上のデッキ（像の手前・顔の高さ y29）
  // デッキ床（階段の天端と段差なし）。像の顔の近くまで張り出す（z39。下にすき間が見えないように）
  b.box(44, 29, 39, 52, 29, 41, wood);
  // まわりは見えない高い壁（2026-11-08 先生の希望：龍馬の前で下に落ちてしまうので、高く・透明に）。
  // 像側は z39 の上＝立つと龍馬の顔が目の前（約2マス先）に来る。左右も高くして、ジャンプしても落ちない。
  // 階段側（z42）は開けて出入りできる。ガラスの柵だと顔がくもって見えるので使わない
  b.box(44, 30, 39, 52, 36, 39, BARRIER_ID); // 像側
  b.box(43, 29, 39, 43, 36, 41, BARRIER_ID); // 左
  b.box(53, 29, 39, 53, 36, 41, BARRIER_ID); // 右

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
  center: { x: 48, y: 20, z: 46 },
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
      region: { min: { x: 44, y: 10, z: 32 }, max: { x: 52, y: 34, z: 39 } },
      focus: { x: 48, y: 30, z: 36 },
      image: './photos/ryoma-statue/statue.jpg',
      guide: {
        canDo: 'You can look up at the huge Ryoma statue.',
        feature: 'He is very, very tall.',
        about: 'Young people of Kochi made it about 100 years ago.',
      },
    },
    {
      id: 'deck',
      name: 'Viewing Deck',
      nameJa: '展望デッキ（龍馬に大接近）',
      region: { min: { x: 44, y: 29, z: 39 }, max: { x: 52, y: 32, z: 41 } },
      focus: { x: 48, y: 30, z: 41 },
      // Map で来たら、デッキの上（龍馬の顔の前）に立つ
      viewFrom: { x: 48.5, y: 30, z: 41.5 },
      image: './photos/ryoma-statue/deck.jpg',
      guide: {
        canDo: 'You can climb the big steps to his face.',
        feature: 'His face is right there!',
        about: 'In spring and fall, you can go up and see his face!',
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
        about: 'Let\'s read the words on it!',
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
        about: 'Let\'s read the sign!',
      },
    },
  ],
};
