import type { World } from '@/world/World';
import { Build } from './Build';
import type { SpotDefinition } from './SpotDefinition';

/**
 * ひろめ市場（Hirome Market）— 高知の中心（高知城のそば）にある、にぎやかな屋内市場。
 * 実物（約60店の屋台村。名は土佐藩家老・深尾弘人の屋敷跡から）の特徴を色ボクセルで再現：
 *   - たくさんの「お店（屋台）」が並ぶ（色とりどりの背板・庇・赤提灯。計12店）。
 *   - 名物「カツオのたたき」の藁焼きのお店（豪快に立ちのぼる炎）。
 *   - 中央に「横長の机」＋座れる「椅子」＝どの店で買ってもここで相席で食べるスタイル。
 *   - 屋根つき（中央は吹き抜けで中が見える）。入口に大きな暖簾。
 *
 * 座標の目安：小さい z＝奥／大きい z＝手前（入口・スポーン）。床 = G。
 *   建物: x24〜72, z20〜76／中央の吹き抜け＆食事スペース: x36〜60, z40〜62
 */

const G = 10; // 市場の床の上面。立つのは G+1

/**
 * 屋台（お店）を1つ作る。(dx,dz)＝お客さん側（開口）へ向く単位ベクトル。
 * 背板（色）＋カウンター＋商品＋色つきの庇＋赤提灯。
 */
function stall(
  b: Build,
  x: number,
  z: number,
  dx: number,
  dz: number,
  panel: number,
  awning: number,
  counter: number,
  food: number,
  redLantern: number,
): void {
  const px = Math.abs(dz); // 幅（垂直）方向の単位
  const pz = Math.abs(dx);
  for (let w = -1; w <= 1; w++) b.box(x + px * w, G + 1, z + pz * w, x + px * w, G + 3, z + pz * w, panel); // 背板
  for (let w = -1; w <= 1; w++) b.set(x + dx + px * w, G + 1, z + dz + pz * w, counter); // カウンター
  b.set(x + dx, G + 2, z + dz, food); // 商品
  b.set(x + dx + px, G + 2, z + dz + pz, food);
  for (let w = -1; w <= 1; w++) {
    b.set(x + px * w, G + 4, z + pz * w, awning); // 庇
    b.set(x + dx + px * w, G + 4, z + dz + pz * w, awning);
  }
  b.set(x + dx + px, G + 3, z + dz + pz, redLantern); // 赤提灯
  b.set(x + dx - px, G + 3, z + dz - pz, redLantern);
}

/**
 * 食事セット：写真のような明るい木の横長の机＋両側に丸い木の椅子（1つずつ間をあけて並ぶ）。
 * x0〜x1 が横長の長さ。机は z..z+1 の2マス幅、椅子は z-1 と z+2 に1つおき。
 */
function diningSet(b: Build, x0: number, x1: number, z: number, deskId: number, chairId: number): void {
  b.box(x0, G + 2, z, x1, G + 2, z + 1, deskId); // 机の天板
  for (const x of [x0, x1]) b.box(x, G + 1, z, x, G + 1, z + 1, deskId); // 机の脚
  for (let x = x0; x <= x1; x += 2) {
    b.set(x, G + 1, z - 1, chairId); // 手前の丸い椅子
    b.set(x, G + 1, z + 2, chairId); // 奥の丸い椅子
  }
}

function build(world: World): void {
  const b = new Build();
  const stone = b.id('stone');
  const grass = b.id('grass'); // まわりの広場（芝）
  const tile = b.id('tile'); // 市場の床・屋根（濃いグレー）
  const wood = b.id('wood'); // 柱・カウンター・横長の机・看板
  const roof = b.id('roof'); // 椅子（机より低い・濃い茶）
  const castlewall = b.id('castlewall'); // 白い庇・看板
  const torii = b.id('torii'); // 赤提灯・赤い暖簾
  const brick = b.id('brick'); // 赤い魚・藁焼きの火（オレンジ）
  const leaves = b.id('leaves'); // 緑の野菜
  const flower = b.id('flower'); // ピンクの商品
  const sakura = b.id('sakura'); // ピンクの店
  const turf = b.id('turf'); // 緑の店
  const lantern = b.id('lantern'); // 炎の明るい部分（藁焼き）
  const lightWood = b.id('bridge'); // 明るい木（机・丸い椅子）
  const glass = b.id('glass'); // 天井のガラス屋根（アーケード）

  // ===== まわりの広場（芝）＋市場の床（1.5倍に拡大） =====
  b.box(20, 7, 16, 76, 9, 80, stone); // 土台
  b.box(20, G, 16, 76, G, 80, grass); // 広場（芝）
  b.box(25, G, 21, 71, G, 75, tile); // 市場の床（グレー）

  // ===== 柱（木）＝屋根を支える =====
  for (const [cx, cz] of [
    [25, 21],
    [48, 21],
    [71, 21],
    [25, 48],
    [71, 48],
    [25, 72],
    [42, 72],
    [54, 72],
    [71, 72],
    [35, 39],
    [61, 39],
    [35, 63],
    [61, 63],
  ] as const) {
    b.box(cx, G + 1, cz, cx, G + 6, cz, wood);
  }

  // ===== 屋根（中央は吹き抜け＝スカイライト・入口は開ける） =====
  b.box(24, G + 7, 20, 72, G + 7, 39, tile); // 奥
  b.box(24, G + 7, 40, 35, G + 7, 62, tile); // 左
  b.box(61, G + 7, 40, 72, G + 7, 62, tile); // 右
  b.box(24, G + 7, 63, 72, G + 7, 72, tile); // 中ほど手前
  // 中央 x36〜60, z40〜62 は写真のようなガラスの屋根（明るいアーケード）
  b.box(36, G + 8, 40, 60, G + 8, 62, glass);
  b.box(36, G + 7, 40, 36, G + 7, 62, tile); // ガラス屋根のふち
  b.box(60, G + 7, 40, 60, G + 7, 62, tile);

  // ===== 外の壁（下は木の板張り、上は白いしっくい）＝建物らしく囲む =====
  b.box(24, G + 1, 20, 24, G + 4, 72, wood); // 左
  b.box(24, G + 5, 20, 24, G + 6, 72, castlewall);
  b.box(72, G + 1, 20, 72, G + 4, 72, wood); // 右
  b.box(72, G + 5, 20, 72, G + 6, 72, castlewall);
  b.box(24, G + 1, 20, 72, G + 4, 20, wood); // 奥
  b.box(24, G + 5, 20, 72, G + 6, 20, castlewall);
  // 正面（入口の左右）
  b.box(24, G + 1, 73, 33, G + 4, 73, wood);
  b.box(24, G + 5, 73, 33, G + 6, 73, castlewall);
  b.box(63, G + 1, 73, 72, G + 4, 73, wood);
  b.box(63, G + 5, 73, 72, G + 6, 73, castlewall);

  // ===== 中の通路の上に、赤提灯をずらりと吊るす（写真の天井） =====
  for (let z = 41; z <= 61; z += 2) {
    b.set(38, G + 6, z, torii);
    b.set(58, G + 6, z, torii);
    b.set(38, G + 7, z, tile); // 吊るすひも
    b.set(58, G + 7, z, tile);
  }

  // ===== 屋台（お店）：色とりどりに10店 =====
  // 奥の列（手前＝+zを向く）
  stall(b, 32, 21, 0, 1, brick, castlewall, wood, leaves, torii);
  stall(b, 42, 21, 0, 1, sakura, castlewall, wood, flower, torii);
  stall(b, 52, 21, 0, 1, tile, castlewall, wood, brick, torii); // カツオのたたきの店（魚＝赤）
  stall(b, 62, 21, 0, 1, turf, castlewall, wood, leaves, torii);
  // 左の列（+xを向く）
  stall(b, 25, 34, 1, 0, sakura, castlewall, wood, brick, torii);
  stall(b, 25, 46, 1, 0, roof, castlewall, wood, leaves, torii);
  stall(b, 25, 58, 1, 0, brick, castlewall, wood, flower, torii);
  // 右の列（-xを向く）
  stall(b, 71, 34, -1, 0, torii, castlewall, wood, flower, torii);
  stall(b, 71, 46, -1, 0, turf, castlewall, wood, brick, torii);
  stall(b, 71, 58, -1, 0, brick, castlewall, wood, leaves, torii);
  // 入口わきの2店（中の通路を向く）
  stall(b, 32, 68, 0, -1, turf, castlewall, wood, flower, torii);
  stall(b, 62, 68, 0, -1, sakura, castlewall, wood, brick, torii);

  // ===== カツオのたたき：藁焼きの炎（豪快に立ちのぼる＝実演の名物） =====
  b.set(51, G + 1, 23, brick);
  b.set(52, G + 1, 23, brick);
  b.set(53, G + 1, 23, brick);
  b.set(51, G + 2, 23, lantern); // 炎の明るい部分
  b.set(52, G + 2, 23, lantern);
  b.set(53, G + 2, 23, lantern);
  b.set(52, G + 3, 23, brick); // 高く上がる炎の先

  // ===== 中央：横長の机＋座れる椅子（椅子は机より低い） =====
  diningSet(b, 40, 56, 44, lightWood, lightWood);
  diningSet(b, 40, 56, 50, lightWood, lightWood);
  diningSet(b, 40, 56, 56, lightWood, lightWood);

  // ===== 入口（写真に合わせて：上に赤提灯が2段ずらり、その下に濃い赤の大きな暖簾） =====
  // 木の格子の中に、赤提灯が2段に並ぶ
  b.box(34, G + 5, 73, 62, G + 7, 73, wood); // 格子の木枠
  for (let x = 35; x <= 61; x += 2) {
    b.set(x, G + 5, 74, torii); // 下の段の提灯（少し前に出す）
    b.set(x, G + 6, 74, torii); // 上の段の提灯
  }
  // 入口の上の瓦のひさし
  b.box(23, G + 8, 73, 73, G + 8, 75, tile);
  // 濃い赤の暖簾（何枚かに分かれて垂れる。まん中は高く上がって通れる）
  for (let x = 34; x <= 62; x++) {
    if ((x - 34) % 4 === 3) continue; // 暖簾の切れ目
    const low = x >= 44 && x <= 52 ? G + 4 : G + 3; // まん中はくぐれるように短く
    b.box(x, low, 74, x, G + 4, 74, roof);
  }

  // ===== 広場の看板（プラザ・手前） =====
  b.pillar(66, 79, G + 1, G + 2, wood);
  b.box(65, G + 3, 79, 67, G + 4, 79, castlewall);

  world.setBlocksBatch(b.cells);
}

export const hirome: SpotDefinition = {
  id: 'hirome',
  name: 'Hirome Market',
  nameJa: 'ひろめ市場',
  emoji: '🍽️',
  available: true,
  center: { x: 48, y: 13, z: 48 },
  viewDistance: 70,
  spawn: { pos: { x: 48, y: G + 1, z: 78 }, yaw: 0 },
  field: { min: { x: 20, y: 0, z: 16 }, max: { x: 76, y: 0, z: 80 } },
  build,
  objects: [
    {
      id: 'entrance',
      name: 'Hirome Market',
      nameJa: 'ひろめ市場（入口）',
      region: { min: { x: 34, y: 11, z: 73 }, max: { x: 62, y: 17, z: 76 } },
      focus: { x: 48, y: 14, z: 74 },
      // Map で来たとき、屋根や物の上に立たないよう、立つ場所を決めておく
      viewFrom: { x: 48.5, y: G + 1, z: 79.5 },
      image: './photos/hirome/entrance.jpg',
      guide: {
        canDo: 'You can walk into the market.',
        feature: 'It has many shops and red lights.',
        about: 'Long ago, Mr. Hirome lived here. That is the name!',
      },
    },
    {
      id: 'katsuo',
      name: 'Katsuo no Tataki Stall',
      nameJa: 'カツオのたたきの店',
      region: { min: { x: 50, y: 11, z: 21 }, max: { x: 54, y: 15, z: 24 } },
      focus: { x: 52, y: 13, z: 23 },
      // Map で来たとき、屋根や物の上に立たないよう、立つ場所を決めておく
      viewFrom: { x: 52.5, y: G + 1, z: 28.5 },
      image: './photos/hirome/katsuo.jpg',
      guide: {
        canDo: 'You can watch the fish cooking show.',
        feature: 'The fire is big and hot.',
        about: 'They cook fish on a big fire. Whoosh!',
      },
    },
    {
      id: 'shops',
      name: 'Food Shops',
      nameJa: 'お店（屋台）',
      region: { min: { x: 25, y: 11, z: 32 }, max: { x: 29, y: 15, z: 60 } },
      focus: { x: 27, y: 13, z: 46 },
      // Map で来たとき、屋根や物の上に立たないよう、立つ場所を決めておく
      viewFrom: { x: 32.5, y: G + 1, z: 46.5 },
      image: './photos/hirome/shops.jpg',
      guide: {
        canDo: 'You can look at many small shops.',
        feature: 'They are colorful.',
        about: 'About 60 shops are here. What do you want to eat?',
      },
    },
    {
      id: 'tables',
      name: 'Long Tables',
      nameJa: '横長の机と椅子',
      region: { min: { x: 38, y: 11, z: 42 }, max: { x: 58, y: 13, z: 59 } },
      focus: { x: 48, y: 12, z: 50 },
      // Map で来たとき、屋根や物の上に立たないよう、立つ場所を決めておく
      viewFrom: { x: 48.5, y: G + 1, z: 61.5 },
      image: './photos/hirome/tables.jpg',
      guide: {
        canDo: 'You can sit and eat at the long tables.',
        feature: 'The tables are long. The chairs are low.',
        about: 'Buy food you like. Eat together here!',
      },
    },
    {
      id: 'lanterns',
      name: 'Red Lanterns',
      nameJa: '赤提灯',
      region: { min: { x: 30, y: 14, z: 71 }, max: { x: 66, y: 17, z: 72 } },
      focus: { x: 48, y: 16, z: 72 },
      // Map で来たとき、屋根や物の上に立たないよう、立つ場所を決めておく
      viewFrom: { x: 48.5, y: G + 1, z: 79.5 },
      image: './photos/hirome/lanterns.jpg',
      guide: {
        canDo: 'You can see many red lanterns.',
        feature: 'They are red and round.',
        about: 'They make the market fun!',
      },
    },
    {
      id: 'sign',
      name: 'Information Sign',
      nameJa: '看板',
      region: { min: { x: 65, y: 11, z: 78 }, max: { x: 67, y: 16, z: 80 } },
      focus: { x: 66, y: 13, z: 79 },
      image: './photos/hirome/sign.jpg',
      guide: {
        canDo: 'You can read about this place.',
        feature: 'It is about Hirome Market.',
        about: 'Let\'s read the sign!',
      },
    },
  ],
};
