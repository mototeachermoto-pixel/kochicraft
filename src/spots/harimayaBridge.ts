import type { World } from '@/world/World';
import { Build } from './Build';
import type { SpotDefinition } from './SpotDefinition';

/**
 * はりまや橋（Harimaya Bridge）— 高知市の名物。よさこい節で歌われる小さな橋。
 * 実物（はりまや橋公園と周辺）の特徴を色ボクセルで再現：
 *   - 朱色（赤）の小さな「太鼓橋」（まんなかが高い反り橋）。赤い欄干＋金の擬宝珠。
 *   - 橋の下を流れる堀川（江戸時代は商売の舟が行き来した運河）。
 *   - そばに垂れ下がる「柳（やなぎ）」。
 *   - からくり時計（毎正時に人形が出て踊る）＝実物は交差点そばのビルにある名物。
 *   - 純信とお馬の像（かんざしの恋物語。よさこい節「坊さんかんざし買うを見た」）。
 *   - 奥に電車通り（とさでん風の路面電車＋レール）＝はりまや橋交差点の象徴。
 *   - まわりは広い平らな公園（自由に建築できるスペース）。
 *
 * 座標の目安：小さい z＝奥／大きい z＝手前（入口・スポーン）。
 *   電車通り: z 29〜31（レール）
 *   川:       z 38〜42（水面 = GROUND）
 *   橋:       z 37〜43（cx=48 で南北にかかる）
 */

const GROUND = 10; // 公園の地面の上面。立つのは GROUND+1

/** 赤い太鼓橋（反り橋）。cx,cz を中心に z 方向へかける。red＝朱色, gold＝擬宝珠。 */
function taikoBridge(b: Build, cx: number, cz: number, red: number, gold: number): void {
  // z=cz-3..cz+3 の各列で、橋げたの「上面」と「下面」の高さ（まんなかが高い反り）
  const top = [11, 12, 13, 13, 13, 12, 11];
  const bot = [11, 11, 12, 12, 12, 11, 11];
  for (let i = 0; i < 7; i++) {
    const z = cz - 3 + i;
    b.box(cx - 3, bot[i], z, cx + 3, top[i], z, red); // 橋げた（赤・幅7）
    b.set(cx - 4, top[i] + 1, z, red); // 左の欄干
    b.set(cx + 4, top[i] + 1, z, red); // 右の欄干
  }
  // 擬宝珠（ぎぼし）＝四隅の親柱の上に金のたま
  for (const z of [cz - 3, cz + 3]) {
    b.set(cx - 4, 13, z, gold);
    b.set(cx + 4, 13, z, gold);
  }
}

/** 柳（やなぎ）：幹＋垂れ下がる緑の枝。 */
function willow(b: Build, x: number, z: number, trunkH: number, wood: number, leaf: number): void {
  for (let i = 1; i <= trunkH; i++) b.set(x, GROUND + i, z, wood);
  const t = GROUND + trunkH; // 幹の上
  b.disc(x, z, t, 2, leaf); // 樹冠（広め）
  b.disc(x, z, t + 1, 2, leaf);
  b.set(x, t + 2, z, leaf);
  // 垂れ下がる枝（四方に下げる）
  for (const [dx, dz] of [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
    [-2, -1],
    [2, 1],
  ]) {
    b.set(x + dx, t - 1, z + dz, leaf);
    b.set(x + dx, t - 2, z + dz, leaf);
  }
}

/** 純信とお馬の像（かんざしの恋物語の2人。お馬の髪に金のかんざし）。 */
function coupleMonument(
  b: Build,
  x: number,
  z: number,
  stoneW: number,
  bronze: number,
  dark: number,
  pink: number,
  gold: number,
): void {
  b.box(x - 1, GROUND + 1, z - 1, x + 1, GROUND + 1, z + 1, stoneW); // 台座
  // 純信（左・こげ茶の衣）
  b.set(x - 1, GROUND + 2, z, bronze);
  b.set(x - 1, GROUND + 3, z, bronze);
  b.set(x - 1, GROUND + 4, z, dark); // 頭
  // お馬（右・桃色の着物）
  b.set(x + 1, GROUND + 2, z, pink);
  b.set(x + 1, GROUND + 3, z, pink);
  b.set(x + 1, GROUND + 4, z, dark); // 頭
  b.set(x + 1, GROUND + 5, z, gold); // かんざし（物語の主役）
}

/** からくり時計（毎正時に人形が出て踊る名物の時計台）。cz+ 側＝手前を正面に。 */
function karakuriClock(
  b: Build,
  cx: number,
  cz: number,
  white: number,
  dark: number,
  gold: number,
  stoneW: number,
  red: number,
  pink: number,
  roofId: number,
): void {
  b.box(cx - 1, GROUND + 1, cz - 1, cx + 1, GROUND + 2, cz + 1, stoneW); // 土台
  b.box(cx - 1, GROUND + 3, cz - 1, cx + 1, GROUND + 6, cz + 1, white); // 塔（白）
  // 時計の文字盤（正面。濃い盤＋金の針）
  b.box(cx - 1, GROUND + 4, cz + 1, cx + 1, GROUND + 5, cz + 1, dark);
  b.set(cx, GROUND + 5, cz + 1, gold);
  // 人形の舞台＋よさこいを踊る人形（赤・桃）
  b.box(cx - 2, GROUND + 7, cz - 2, cx + 2, GROUND + 7, cz + 2, dark); // 舞台
  b.set(cx - 1, GROUND + 8, cz, red);
  b.set(cx, GROUND + 8, cz, pink);
  b.set(cx + 1, GROUND + 8, cz, red);
  // 屋根
  b.box(cx - 1, GROUND + 9, cz - 1, cx + 1, GROUND + 9, cz + 1, roofId);
  b.set(cx, GROUND + 10, cz, roofId);
}

/** 路面電車（緑と白の2色＋ガラス窓＋パンタグラフ）。x0 から +x 方向へ6ブロック。 */
function tram(
  b: Build,
  x0: number,
  z0: number,
  green: number,
  white: number,
  glassId: number,
  dark: number,
  wood: number,
): void {
  const x1 = x0 + 5;
  const z1 = z0 + 1;
  b.box(x0, GROUND + 1, z0, x1, GROUND + 1, z1, dark); // 足回り
  b.box(x0, GROUND + 2, z0, x1, GROUND + 2, z1, green); // 車体（下＝緑）
  b.box(x0, GROUND + 3, z0, x1, GROUND + 3, z1, white); // 車体（上＝白）
  for (let x = x0 + 1; x <= x1 - 1; x++) {
    b.set(x, GROUND + 3, z0, glassId); // 窓
    b.set(x, GROUND + 3, z1, glassId);
  }
  b.box(x0, GROUND + 4, z0, x1, GROUND + 4, z1, dark); // 屋根
  b.box(x0 + 2, GROUND + 5, z0, x0 + 2, GROUND + 5, z1, wood); // パンタグラフ
}

function build(world: World): void {
  const b = new Build();
  const stone = b.id('stone');
  const sand = b.id('sand');
  const water = b.id('water');
  const turf = b.id('turf'); // 公園の芝
  const tile = b.id('tile'); // 石畳の道
  const torii = b.id('torii'); // 朱色（橋）
  const lantern = b.id('lantern'); // 擬宝珠の金
  const wood = b.id('wood');
  const leaves = b.id('leaves'); // 柳の緑
  const stonewall = b.id('stonewall'); // 台座・土台
  const castlewall = b.id('castlewall'); // 白（時計台・電車・看板）
  const flower = b.id('flower');
  const roof = b.id('roof'); // ブロンズ（像・時計台の屋根）
  const glass = b.id('glass'); // 電車の窓
  const sakura = b.id('sakura'); // 桃色（お馬の着物・踊り子人形）
  const road = b.id('road'); // 電車通り

  // ===== 地面（広い平らな公園＝建築スペース） =====
  b.box(28, 8, 26, 68, 9, 69, stone); // 岩盤
  b.box(28, GROUND, 26, 68, GROUND, 37, turf); // 奥の芝
  b.box(28, GROUND, 43, 68, GROUND, 69, turf); // 手前の大きな芝

  // ===== 小さな川（左右に流れる。水面 = GROUND） =====
  b.box(28, 8, 38, 68, 8, 42, sand); // 川底
  b.box(28, 9, 38, 68, GROUND, 42, water); // 水

  // ===== 石畳の道（スポーン → 橋 → 奥） =====
  b.box(46, GROUND, 43, 50, GROUND, 69, tile);
  b.box(46, GROUND, 26, 50, GROUND, 37, tile);

  // ===== 電車通り（奥）：道路＋レール＋路面電車 ＝はりまや橋交差点の象徴 =====
  b.box(28, GROUND, 29, 68, GROUND, 31, road); // 道路
  b.box(28, GROUND, 29, 68, GROUND, 29, tile); // レール（2本）
  b.box(28, GROUND, 31, 68, GROUND, 31, tile);
  tram(b, 54, 29, turf, castlewall, glass, tile, wood);

  // ===== 朱色の太鼓橋（名物） =====
  taikoBridge(b, 48, 40, torii, lantern);

  // ===== 柳（川のそば・公園のふち。中央は開けて建築スペースに） =====
  willow(b, 33, 46, 4, wood, leaves);
  willow(b, 63, 46, 4, wood, leaves);
  willow(b, 33, 34, 4, wood, leaves);
  willow(b, 63, 34, 4, wood, leaves);

  // ===== 川ぞいの花 =====
  b.set(40, GROUND, 43, flower);
  b.set(56, GROUND, 43, flower);
  b.set(40, GROUND, 37, flower);
  b.set(56, GROUND, 37, flower);

  // ===== からくり時計（手前の広場・左のふち。実物は交差点そばの名物） =====
  karakuriClock(b, 33, 53, castlewall, tile, lantern, stonewall, torii, sakura, roof);

  // ===== 純信とお馬の像（手前の広場・左。かんざしの恋物語） =====
  coupleMonument(b, 38, 58, stonewall, roof, tile, sakura, lantern);

  // ===== 看板（入口・右） =====
  b.pillar(56, 64, GROUND + 1, GROUND + 2, wood);
  b.box(55, GROUND + 3, 64, 57, GROUND + 4, 64, castlewall);

  world.setBlocksBatch(b.cells);
}

export const harimayaBridge: SpotDefinition = {
  id: 'harimaya-bridge',
  name: 'Harimaya Bridge',
  nameJa: 'はりまや橋',
  emoji: '🌉',
  available: true,
  center: { x: 48, y: 14, z: 42 },
  viewDistance: 54,
  spawn: { pos: { x: 48, y: 11, z: 67 }, yaw: 0 },
  // 歩ける範囲＝建築できる範囲。外の空中へは出られない
  field: { min: { x: 28, y: 0, z: 26 }, max: { x: 68, y: 0, z: 69 } },
  build,
  objects: [
    {
      id: 'bridge',
      name: 'Harimaya Bridge',
      nameJa: 'はりまや橋',
      region: { min: { x: 44, y: 11, z: 37 }, max: { x: 52, y: 15, z: 43 } },
      focus: { x: 48, y: 13, z: 40 },
      image: './photos/harimaya-bridge/bridge.jpg',
      guide: {
        canDo: 'You can walk over the red bridge.',
        feature: 'It is small, red, and round.',
        about: 'Long ago, a young man bought a pretty present here. People sing about it!',
      },
    },
    {
      id: 'stream',
      name: 'Horikawa Canal',
      nameJa: '堀川',
      region: { min: { x: 28, y: 9, z: 38 }, max: { x: 68, y: 11, z: 42 } },
      focus: { x: 36, y: 10, z: 40 },
      image: './photos/harimaya-bridge/stream.jpg',
      guide: {
        canDo: 'You can look at the water under the bridge.',
        feature: 'It is small and blue.',
        about: 'This is Horikawa. Boats went here long ago.',
      },
    },
    {
      id: 'willows',
      name: 'Willow Trees',
      nameJa: '柳',
      region: { min: { x: 30, y: 11, z: 32 }, max: { x: 66, y: 18, z: 49 } },
      focus: { x: 33, y: 14, z: 46 },
      image: './photos/harimaya-bridge/willows.jpg',
      guide: {
        canDo: 'You can stand under the willow trees.',
        feature: 'The green leaves go down, down.',
        about: 'They look nice with the red bridge. Take a photo!',
      },
    },
    {
      id: 'clock',
      name: 'Karakuri Clock',
      nameJa: 'からくり時計',
      region: { min: { x: 30, y: 11, z: 50 }, max: { x: 36, y: 21, z: 56 } },
      focus: { x: 33, y: 16, z: 53 },
      image: './photos/harimaya-bridge/clock.jpg',
      guide: {
        canDo: 'You can watch the clock show.',
        feature: 'It is a big, fun clock.',
        about: 'Dolls come out of the clock. They dance to music!',
      },
    },
    {
      id: 'couple',
      name: 'Junshin and Ouma',
      nameJa: '純信とお馬の像',
      region: { min: { x: 36, y: 11, z: 56 }, max: { x: 40, y: 17, z: 60 } },
      focus: { x: 38, y: 13, z: 58 },
      image: './photos/harimaya-bridge/couple.jpg',
      guide: {
        canDo: 'You can see two statues.',
        feature: 'A man and a woman stand together.',
        about: 'They are Junshin and Ouma. People sing about them.',
      },
    },
    {
      id: 'tram',
      name: 'Street Tram',
      nameJa: '路面電車',
      region: { min: { x: 52, y: 11, z: 27 }, max: { x: 61, y: 16, z: 33 } },
      focus: { x: 56, y: 13, z: 30 },
      image: './photos/harimaya-bridge/tram.jpg',
      guide: {
        canDo: 'You can see a tram on the street.',
        feature: 'It is green and white. It runs on the road.',
        about: 'It is a small train. People ride it every day.',
      },
    },
    {
      id: 'sign',
      name: 'Information Sign',
      nameJa: '看板',
      region: { min: { x: 55, y: 11, z: 63 }, max: { x: 57, y: 16, z: 65 } },
      focus: { x: 56, y: 13, z: 64 },
      image: './photos/harimaya-bridge/sign.jpg',
      guide: {
        canDo: 'You can read about this place.',
        feature: 'It is about Harimaya Bridge.',
        about: 'This is a sign. It helps you learn about Harimaya Bridge.',
      },
    },
  ],
};
