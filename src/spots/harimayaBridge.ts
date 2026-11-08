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
 *   - 奥に電車通り（とさでん風の路面電車＋レール）＝はりまや橋交差点の象徴。
 *   - まわりは広い平らな公園（自由に建築できるスペース）。
 *
 * 座標の目安：小さい z＝奥／大きい z＝手前（入口・スポーン）。
 *   電車通り: z 29〜31（レール）
 *   川:       z 38〜42（両岸は石垣 z38・z42、水 z39〜41。水面は地面より1段低い y9）
 *   橋:       z 36〜44（cx=48 で南北にかかる）
 */

const GROUND = 10; // 公園の地面の上面。立つのは GROUND+1

/**
 * 赤い太鼓橋（反り橋）。写真に合わせて：
 *   - まんなかが高く反った、木の床板（茶色）の橋。橋の下はアーチのように空いて、川の水が見える
 *   - 両側に朱色の欄干（柱＋上の手すり。すき間がある）
 *   - 両端とまんなかの柱の上に、金の擬宝珠（ぎぼし）
 *   - 橋げたのふちは濃い色
 * cx,cz を中心に z 方向へかける。
 */
function taikoBridge(
  b: Build,
  cx: number,
  cz: number,
  red: number,
  gold: number,
  plank: number,
  dark: number,
  stoneW: number,
): void {
  // z=cz-4..cz+4 の各列の床の高さ（まんなかが高い反り）
  const deck = [11, 11, 12, 12, 13, 12, 12, 11, 11];
  for (let i = 0; i < deck.length; i++) {
    const z = cz - 4 + i;
    const y = deck[i];
    b.box(cx - 2, y, z, cx + 2, y, z, plank); // 木の床板（はば5）
    b.set(cx - 3, y, z, dark); // 橋げたのふち（濃い色）
    b.set(cx + 3, y, z, dark);
    b.set(cx - 3, y + 2, z, red); // 上の手すり
    b.set(cx + 3, y + 2, z, red);
    // 柱（1つおき）＝手すりの下にすき間ができる
    if (i % 2 === 0) {
      b.set(cx - 3, y + 1, z, red);
      b.set(cx + 3, y + 1, z, red);
    }
    // 床の下：岸の上は石の土台、川の上はアーチの下側（濃い色）だけにして、下を空ける
    if (y > 11) b.box(cx - 3, y - 1, z, cx + 3, y - 1, z, dark);
    else b.box(cx - 3, 9, z, cx + 3, y - 1, z, stoneW);
  }
  // 擬宝珠（ぎぼし）＝両端とまんなかの柱の上に金のたま
  for (const i of [0, 4, 8]) {
    const z = cz - 4 + i;
    b.set(cx - 3, deck[i] + 3, z, gold);
    b.set(cx + 3, deck[i] + 3, z, gold);
  }
}

/**
 * 柳（やなぎ）。写真に合わせて：高い幹の上に、明るい黄緑の葉が
 * 長いすだれのように、地面の近くまで垂れ下がる。
 */
function willow(b: Build, x: number, z: number, trunkH: number, wood: number, leaf: number): void {
  for (let i = 1; i <= trunkH; i++) b.set(x, GROUND + i, z, wood);
  const t = GROUND + trunkH; // 幹の上
  b.disc(x, z, t, 3, leaf); // 樹冠（広い）
  b.disc(x, z, t + 1, 2, leaf);
  b.set(x, t + 2, z, leaf);
  // 垂れ下がる枝：樹冠のいちばん外のふちから、すき間をあけて下へ（すだれのように）。
  // 幹が見えるよう、内側には垂らさない
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      const r2 = dx * dx + dz * dz;
      if (r2 < 8 || r2 > 10) continue; // いちばん外のふちだけ
      if ((dx + dz) % 2 !== 0) continue; // 1つおき
      const len = Math.abs(dx) === 3 ? 4 : 3;
      for (let k = 1; k <= len; k++) b.set(x + dx, t - k, z + dz, leaf);
    }
  }
}

/**
 * からくり時計（毎正時に人形が出て踊る名物の時計台）。写真に合わせて：
 *   - 下は木の板張り、上に白いしっくいの帯
 *   - 広い木の台（ベランダ）の上に、扉が左右に開いた人形の舞台（色とりどりの人形）
 *   - 白壁と木の柱の上の階、2段の瓦屋根
 * cz+ 側＝手前を正面に。
 */
function karakuriClock(
  b: Build,
  cx: number,
  cz: number,
  white: number,
  dark: number,
  gold: number,
  wood: number,
  red: number,
  pink: number,
  blue: number,
): void {
  // 下の段：木の板張り＋白い帯
  b.box(cx - 1, GROUND + 1, cz - 1, cx + 1, GROUND + 3, cz + 1, wood);
  b.box(cx - 1, GROUND + 4, cz - 1, cx + 1, GROUND + 4, cz + 1, white);
  // 広い木の台（人形の舞台のゆか）
  b.box(cx - 2, GROUND + 5, cz - 2, cx + 2, GROUND + 5, cz + 2, wood);
  // 人形の舞台：うしろと横は木、前は開いている
  b.box(cx - 1, GROUND + 6, cz - 1, cx + 1, GROUND + 7, cz - 1, wood);
  b.box(cx - 1, GROUND + 6, cz, cx - 1, GROUND + 7, cz, white);
  b.box(cx + 1, GROUND + 6, cz, cx + 1, GROUND + 7, cz, white);
  // 左右に開いた扉
  b.box(cx - 2, GROUND + 6, cz + 1, cx - 2, GROUND + 7, cz + 1, wood);
  b.box(cx + 2, GROUND + 6, cz + 1, cx + 2, GROUND + 7, cz + 1, wood);
  // よさこいを踊る人形（赤・桃・青）
  b.set(cx - 1, GROUND + 6, cz + 1, red);
  b.set(cx, GROUND + 6, cz + 1, pink);
  b.set(cx + 1, GROUND + 6, cz + 1, blue);
  b.set(cx, GROUND + 6, cz, red);
  // 1段目の屋根
  b.box(cx - 2, GROUND + 8, cz - 2, cx + 2, GROUND + 8, cz + 2, dark);
  // 上の階：白壁＋木の柱、正面に時計
  b.box(cx - 1, GROUND + 9, cz - 1, cx + 1, GROUND + 10, cz + 1, white);
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    b.box(cx + dx, GROUND + 9, cz + dz, cx + dx, GROUND + 10, cz + dz, wood);
  }
  b.set(cx, GROUND + 10, cz + 1, dark); // 時計の文字盤
  b.set(cx, GROUND + 9, cz + 1, gold); // 針
  // 2段目の屋根（大きく張り出し、てっぺんに棟）
  b.box(cx - 2, GROUND + 11, cz - 2, cx + 2, GROUND + 11, cz + 2, dark);
  b.box(cx - 1, GROUND + 12, cz - 1, cx + 1, GROUND + 12, cz + 1, dark);
  b.box(cx, GROUND + 13, cz - 1, cx, GROUND + 13, cz + 1, dark);
}

/**
 * 路面電車（写真に合わせて：下が緑、窓のまわりがクリーム色、屋根が緑。屋根の上にパンタグラフ）。
 * x0 から +x 方向へ10ブロック。
 */
function tram(
  b: Build,
  x0: number,
  z0: number,
  green: number,
  cream: number,
  glassId: number,
  dark: number,
): void {
  const x1 = x0 + 9;
  const z1 = z0 + 1;
  b.box(x0 + 1, GROUND + 1, z0, x1 - 1, GROUND + 1, z1, dark); // 足回り
  b.box(x0, GROUND + 2, z0, x1, GROUND + 2, z1, green); // 車体（下＝緑）
  b.box(x0, GROUND + 3, z0, x1, GROUND + 4, z1, cream); // 車体（窓のまわり＝クリーム）
  for (let x = x0 + 1; x <= x1 - 1; x++) {
    b.box(x, GROUND + 3, z0, x, GROUND + 4, z0, glassId); // 窓
    b.box(x, GROUND + 3, z1, x, GROUND + 4, z1, glassId);
  }
  // 前と後ろの大きな窓
  b.set(x0, GROUND + 4, z0, glassId);
  b.set(x0, GROUND + 4, z1, glassId);
  b.set(x1, GROUND + 4, z0, glassId);
  b.set(x1, GROUND + 4, z1, glassId);
  b.box(x0, GROUND + 5, z0, x1, GROUND + 5, z1, green); // 屋根（緑）
  // パンタグラフ（ひし形の骨組み）
  b.box(x0 + 4, GROUND + 6, z0, x0 + 5, GROUND + 6, z1, dark);
  b.box(x0 + 3, GROUND + 7, z0, x0 + 6, GROUND + 7, z0, dark);
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
  const bridgeWood = b.id('bridge'); // 橋の床板
  const bamboo = b.id('bamboo'); // 柳の明るい黄緑
  const glass = b.id('glass'); // 電車の窓
  const sakura = b.id('sakura'); // 桃色（お馬の着物・踊り子人形）
  const road = b.id('road'); // 電車通り

  // ===== 地面（広い平らな公園＝建築スペース） =====
  b.box(28, 8, 26, 68, 9, 69, stone); // 岩盤
  b.box(28, GROUND, 26, 68, GROUND, 37, turf); // 奥の芝
  b.box(28, GROUND, 43, 68, GROUND, 69, turf); // 手前の大きな芝

  // ===== 小さな川（左右に流れる）。写真のように両岸は石垣、水面は地面より1段低い =====
  b.box(28, 7, 38, 68, 7, 42, sand); // 川底
  b.box(28, 8, 39, 68, 9, 41, water); // 水（上面 y9）
  b.box(28, 8, 38, 68, GROUND, 38, stonewall); // 奥の岸の石垣
  b.box(28, 8, 42, 68, GROUND, 42, stonewall); // 手前の岸の石垣

  // ===== 石畳の道（スポーン → 橋 → 奥） =====
  b.box(46, GROUND, 43, 50, GROUND, 69, tile);
  b.box(46, GROUND, 26, 50, GROUND, 37, tile);

  // ===== 電車通り（奥）：道路＋レール＋路面電車 ＝はりまや橋交差点の象徴 =====
  b.box(28, GROUND, 29, 68, GROUND, 31, road); // 道路
  b.box(28, GROUND, 29, 68, GROUND, 29, tile); // レール（2本）
  b.box(28, GROUND, 31, 68, GROUND, 31, tile);
  tram(b, 54, 29, leaves, lantern, glass, tile);

  // ===== 朱色の太鼓橋（名物） =====
  taikoBridge(b, 48, 40, torii, lantern, bridgeWood, tile, stonewall);

  // ===== 柳（川のそば・公園のふち。中央は開けて建築スペースに） =====
  willow(b, 34, 46, 6, wood, bamboo);
  willow(b, 62, 46, 6, wood, bamboo);
  willow(b, 34, 34, 6, wood, bamboo);
  willow(b, 62, 34, 6, wood, bamboo);

  // ===== 川ぞいの花 =====
  b.set(40, GROUND, 43, flower);
  b.set(56, GROUND, 43, flower);
  b.set(40, GROUND, 37, flower);
  b.set(56, GROUND, 37, flower);

  // ===== からくり時計（手前の広場・左のふち。実物は交差点そばの名物） =====
  karakuriClock(b, 33, 54, castlewall, tile, lantern, wood, torii, sakura, glass);

  // （純信とお馬の像は、2026-11-08 先生の希望でなくした）

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
  // 高知市の中心の交差点。まわりはビルの街
  backdrop: { near: 'city', far: 'mountains' },
  build,
  objects: [
    {
      id: 'bridge',
      name: 'Harimaya Bridge',
      nameJa: 'はりまや橋',
      region: { min: { x: 45, y: 9, z: 36 }, max: { x: 51, y: 16, z: 44 } },
      focus: { x: 48, y: 13, z: 40 },
      // 写真と同じく、水路の岸からななめに橋を見る場所に立つ（橋のたもとからだと、橋の床しか見えない）
      viewFrom: { x: 57.5, y: 11, z: 45.5 },
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
      region: { min: { x: 28, y: 8, z: 38 }, max: { x: 68, y: 10, z: 42 } },
      focus: { x: 40, y: 9, z: 40 },
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
      region: { min: { x: 31, y: 11, z: 31 }, max: { x: 65, y: 19, z: 49 } },
      focus: { x: 34, y: 15, z: 46 },
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
      region: { min: { x: 31, y: 11, z: 52 }, max: { x: 35, y: 23, z: 56 } },
      focus: { x: 33, y: 17, z: 54 },
      image: './photos/harimaya-bridge/clock.jpg',
      guide: {
        canDo: 'You can watch the clock show.',
        feature: 'It is a big, fun clock.',
        about: 'Dolls come out of the clock. They dance to music!',
      },
    },
    {
      id: 'tram',
      name: 'Street Tram',
      nameJa: '路面電車',
      region: { min: { x: 54, y: 11, z: 29 }, max: { x: 63, y: 17, z: 30 } },
      focus: { x: 58, y: 14, z: 30 },
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
        about: 'Let\'s read the sign!',
      },
    },
  ],
};
