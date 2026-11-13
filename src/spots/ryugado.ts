import type { World } from '@/world/World';
import { Build } from './Build';
import type { SpotDefinition } from './SpotDefinition';

/**
 * 龍河洞（Ryugado Cave）— 高知県香美市にある、日本三大鍾乳洞のひとつ。
 * 約1億7500万年かけてできた鍾乳洞。森におおわれた岩山の中の洞窟として再現。
 *
 * 子どもが「どこに何があるか」すぐ分かるよう、洞窟の中を3つのコーナーに分け、
 * まん中のまっすぐな通路でつなぐ（細かい飾りは置かず、すっきりさせる）：
 *   1. 手前「鍾乳石のコーナー」：天井からぶら下がる鍾乳石・床から立つ石筍・石柱（クリーム色）
 *   2. まん中「地底の川と飛龍の滝」：洞窟を横切る青い川と、左の滝（洞内で二番目に大きな滝）。となりにオレンジ色の鍾乳石の柱
 *   3. 奥「神の壺」：奥の壁の石灰の岩にうまった、白っぽい古代の壺（弥生土器が鍾乳石と一体化したもの）
 * 2026-11-13：本物の写真（ウィキメディア・コモンズ）に合わせて、滝と壺の形を直した。
 * 壁と天井は茶色、床はこげ茶、通路は明るい石で、ちがいがはっきり見えるように色を分ける。
 * Map で各コーナーへ行くと、洞窟の中の見やすい場所に立つ（viewFrom）。
 *
 * 座標：小さい z＝奥／大きい z＝手前（入口・スポーン）。床 = G。フィールド x24〜72, z24〜72。
 *   洞内: x32〜64, z29〜54（高さ y11〜16）／入口: z55〜56／川: z45〜46
 */

const G = 10; // 床の上面。立つのは G+1
const TOP = 16; // 洞内の天井のすぐ下（空間は y11〜16）
const AIR = 0;

/** 天井からぶら下がる鍾乳石（根もとは2×2で太く、先は1マスで細い）。 */
function stalactite(b: Build, x: number, z: number, len: number, id: number): void {
  b.box(x, TOP, z, x + 1, TOP, z + 1, id); // 太い根もと
  for (let i = 1; i < len; i++) b.set(x, TOP - i, z, id); // 細い先
}

/** 床から立ち上がる石筍（根もとは2×2で太く、上は1マスで細い）。 */
function stalagmite(b: Build, x: number, z: number, h: number, id: number): void {
  b.box(x, G + 1, z, x + 1, G + 1, z + 1, id); // 太い根もと
  for (let i = 2; i <= h; i++) b.set(x, G + i, z, id); // 細い上
}

/** 石柱（鍾乳石と石筍がつながった柱。上下が太い）。 */
function column(b: Build, x: number, z: number, id: number): void {
  b.box(x, G + 1, z, x + 1, G + 1, z + 1, id);
  b.box(x, TOP, z, x + 1, TOP, z + 1, id);
  b.box(x, G + 2, z, x, TOP - 1, z, id);
}

function build(world: World): void {
  const b = new Build();
  const stone = b.id('stone'); // 岩山
  const grass = b.id('grass'); // 外の広場・岩山の上
  const leaves = b.id('leaves'); // 岩山の上の森
  const water = b.id('water');
  const wood = b.id('wood'); // 看板・木の幹
  const cave = b.id('bridge'); // 洞内の壁と天井（あたたかい茶色）
  const floor = b.id('dirt'); // 洞内の床（こげ茶）
  const path = b.id('stonewall'); // 見学の通路（明るい石）
  const castlewall = b.id('castlewall'); // 滝つぼの白いしぶき
  const pot = b.id('castlewall'); // 神の壺（写真に合わせて：石灰に包まれた、白っぽいクリーム色）
  const flowstone = b.id('brick'); // 飛龍の滝のとなりの、オレンジ色の太い鍾乳石の柱
  const crystal = b.id('lantern'); // 鍾乳石・石筍（クリーム色＝茶色の壁の前でよく目立つ）
  const road = b.id('road'); // 外の道

  // ===== 地面（フィールド全体・奈落防止） =====
  b.box(24, 8, 24, 72, 9, 72, stone);
  b.box(24, G, 24, 72, G, 72, grass);

  // ===== 手前の広場（スポーン）＋入口への道 =====
  b.box(45, G, 57, 51, G, 72, road);

  // ===== 森におおわれた岩山（この中に洞窟がある） =====
  b.box(28, 8, 26, 68, TOP + 3, 56, stone);
  b.box(28, TOP + 4, 26, 68, TOP + 4, 56, grass);
  for (const [x, z] of [
    [32, 30],
    [40, 34],
    [56, 31],
    [64, 38],
    [34, 48],
    [62, 50],
    [48, 40],
  ] as const) {
    b.roundTree(x, TOP + 4, z, 2, 2, wood, leaves);
  }
  // 岩山の正面に苔（入口の上）
  for (let x = 28; x <= 68; x++) {
    for (let y = G + 1; y <= TOP + 3; y++) {
      if ((x * 7 + y * 5) % 6 === 0) b.set(x, y, 56, grass);
    }
  }

  // ===== 洞内をくり抜く＋入口 =====
  b.box(32, G + 1, 29, 64, TOP, 54, AIR);
  b.box(44, G + 1, 55, 52, G + 5, 56, AIR); // 入口（大きく開いた口）
  b.box(43, G + 6, 56, 53, G + 6, 56, path); // 入口の上のふち（ここが洞窟の入口だと分かるように）

  // ===== 洞内の色：壁と天井は茶色、床はこげ茶、まん中の通路は明るい石 =====
  b.box(31, G + 1, 28, 65, TOP + 1, 28, cave); // 奥の壁
  b.box(31, G + 1, 28, 31, TOP + 1, 55, cave); // 左の壁
  b.box(65, G + 1, 28, 65, TOP + 1, 55, cave); // 右の壁
  b.box(31, TOP + 1, 28, 65, TOP + 1, 55, cave); // 天井
  b.box(32, G + 1, 55, 43, TOP, 55, cave); // 入口の左右の壁（内側）
  b.box(53, G + 1, 55, 64, TOP, 55, cave);
  b.box(32, G, 29, 64, G, 56, floor); // 床
  b.box(47, G, 30, 49, G, 56, path); // まっすぐな通路（入口 → 神の壺）

  // ===== 1. 手前：鍾乳石のコーナー（通路の左右） =====
  // 右がわ
  stalactite(b, 55, 49, 4, crystal);
  stalactite(b, 60, 52, 3, crystal);
  stalactite(b, 58, 48, 2, crystal);
  stalagmite(b, 55, 52, 3, crystal);
  stalagmite(b, 61, 48, 2, crystal);
  column(b, 58, 51, crystal);
  // 左がわ
  stalactite(b, 40, 50, 4, crystal);
  stalactite(b, 36, 52, 3, crystal);
  stalagmite(b, 40, 53, 3, crystal);
  stalagmite(b, 34, 50, 2, crystal);
  column(b, 43, 53, crystal);

  // ===== 2. まん中：地底の川と記念の滝 =====
  b.box(32, 9, 45, 64, G, 46, water); // 洞窟を横切る川
  b.box(47, G, 45, 49, G, 46, path); // 通路は小さな橋で川をわたる
  b.box(46, G + 1, 45, 46, G + 1, 46, path); // 橋のふち（低い）
  b.box(50, G + 1, 45, 50, G + 1, 46, path);
  // 飛龍の滝（川の左はし。洞内で二番目に大きな滝。岩の上を青い水が流れ落ち、下で白いしぶきが立つ）
  // 2026-11-13 本物の写真に合わせて、記念の滝から飛龍の滝に。となりにオレンジ色の太い鍾乳石の柱を足した
  // 鍾乳石（クリーム色）とまちがえないよう、滝は青い水にして、しぶきだけ白くする
  b.box(32, G + 1, 45, 33, TOP, 46, water);
  b.box(31, TOP - 1, 44, 34, TOP, 47, cave); // 水が出てくる岩の口
  b.box(32, TOP - 1, 45, 33, TOP, 46, water);
  b.box(34, G + 1, 44, 35, G + 1, 47, castlewall); // 滝つぼの白いしぶき
  b.box(34, G + 2, 45, 34, G + 2, 46, castlewall);
  b.box(32, G + 1, 47, 33, G + 3, 48, flowstone); // 鍾乳石の柱（下は太い）
  b.box(32, G + 4, 47, 32, TOP - 2, 47, flowstone); // まん中は細い
  b.box(32, TOP - 1, 47, 33, TOP, 48, flowstone); // 天井で広がる

  // ===== 3. 奥：神の壺（写真に合わせて：奥の壁にもり上がった石灰の岩に、白っぽい壺がうまっている） =====
  const rock = b.id('sand'); // 石灰の岩（写真の黄色っぽい色。白っぽい壺が目立つように）
  b.box(45, G + 1, 29, 51, G + 2, 31, rock); // 壁ぎわにもり上がった石灰の岩
  b.box(46, G + 3, 29, 50, G + 3, 30, rock);
  b.box(47, G + 4, 29, 49, G + 5, 29, rock);
  b.set(48, G + 3, 31, pot); // 壺のふくらんだ胴（岩から前へ出ている）
  b.set(48, G + 4, 31, pot);
  b.set(47, G + 3, 31, pot);
  b.set(49, G + 3, 31, pot);
  b.set(48, G + 5, 30, pot); // 壺の細い首
  b.set(48, G + 6, 30, pot); // 壺の口

  world.setBlocksBatch(b.cells);
}

export const ryugado: SpotDefinition = {
  id: 'ryugado',
  name: 'Ryugado Cave',
  nameJa: '龍河洞',
  emoji: '🕯️',
  available: true,
  center: { x: 48, y: 14, z: 46 },
  viewDistance: 56,
  spawn: { pos: { x: 48, y: G + 1, z: 68 }, yaw: 0 },
  field: { min: { x: 24, y: 0, z: 24 }, max: { x: 72, y: 0, z: 72 } },
  // 山の中の鍾乳洞。まわりは森と山
  backdrop: { near: 'forest', far: 'mountains' },
  build,
  objects: [
    {
      id: 'stalactites',
      name: 'Stalactites and Stalagmites',
      nameJa: '鍾乳石と石筍',
      region: { min: { x: 54, y: 11, z: 47 }, max: { x: 62, y: 16, z: 53 } },
      focus: { x: 58, y: 13, z: 50 },
      viewFrom: { x: 50.5, y: G + 1, z: 51.5 },
      image: './photos/ryugado/stalactites.jpg',
      credit: 'Photo: inunami / CC BY 2.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can see rock spikes from the roof and floor.',
        feature: 'Some go down. Some go up.',
        about: 'They grow very slowly.',
      },
    },
    {
      id: 'pot',
      name: 'The Ancient Pot',
      nameJa: '神の壺',
      region: { min: { x: 45, y: 11, z: 29 }, max: { x: 51, y: 17, z: 32 } },
      focus: { x: 48, y: 12, z: 32 },
      viewFrom: { x: 48.5, y: G + 1, z: 37.5 },
      image: './photos/ryugado/pot.jpg',
      credit: 'Photo: Saigen Jiro / CC0 / Wikimedia Commons',
      guide: {
        canDo: 'You can find the famous old pot.',
        feature: 'It is in the rock.',
        about: 'It is very, very old.',
      },
    },
    {
      id: 'falls',
      name: 'Hiryu Falls',
      nameJa: '飛龍の滝',
      region: { min: { x: 32, y: 9, z: 44 }, max: { x: 35, y: 16, z: 48 } },
      focus: { x: 33, y: 13, z: 45 },
      viewFrom: { x: 40.5, y: G + 1, z: 49.5 },
      image: './photos/ryugado/falls.jpg',
      credit: 'Photo: 京浜にけ / CC BY-SA 3.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can find a waterfall in the cave.',
        feature: 'It is a big waterfall.',
        about: 'The water is strong after rain.',
      },
    },
    {
      id: 'cave',
      name: 'Ryugado Cave',
      nameJa: '龍河洞（入口）',
      region: { min: { x: 43, y: 10, z: 54 }, max: { x: 53, y: 16, z: 57 } },
      focus: { x: 48, y: 13, z: 56 },
      viewFrom: { x: 48.5, y: G + 1, z: 64.5 },
      image: './photos/ryugado/cave.jpg',
      credit: 'Photo: 京浜にけ / CC BY-SA 3.0 / Wikimedia Commons',
      guide: {
        canDo: 'You can walk inside a big cave.',
        feature: 'It is a big cave.',
        about: 'It is very old.',
      },
    },
  ],
};
