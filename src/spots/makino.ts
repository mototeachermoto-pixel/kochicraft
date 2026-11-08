import type { World } from '@/world/World';
import { Build } from './Build';
import type { SpotDefinition } from './SpotDefinition';

/**
 * 牧野植物園（Makino Botanical Garden）— 五台山にある、植物学者・牧野富太郎博士の植物園。
 * フィールドをほぼ世界の限界まで広げ、園内に「たくさんの植物」を植えて再現：
 *   - ガラスの大温室（中はジャングルのように暖かい）。
 *   - 木・花・竹・椿・ヤシ…いろいろな植物（実物は約3,000種）。
 *   - 池と木道。波打つ屋根の記念館（博士は約1,500種の植物を命名した「植物分類学の父」）。
 *   - スエコザサ＝博士が亡き妻・壽衛（すえこ）に感謝して名付けた笹（記念館の前に）。
 *
 * 座標：小さい z＝奥（温室）／大きい z＝手前（入口・スポーン）。床 = G。フィールド x6〜90, z6〜90。
 */

const G = 10; // 園内の地面の上面。立つのは G+1
const AIR = 0;

/**
 * ガラスの大温室。写真に合わせて：
 *   - 高いアーチ形のガラス屋根（灰色の鉄の骨組みが等間隔に入る）
 *   - 中はジャングルのように植物がぎっしり（高いヤシ・シダ・色とりどりの花）
 *   - まん中に石畳の小道
 */
function greenhouse(
  b: Build,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  glass: number,
  frame: number,
  wood: number,
  leaf: number,
  light: number,
  blooms: number[],
  path: number,
): void {
  const cx = Math.floor((x0 + x1) / 2);
  const half = (x1 - x0) / 2;
  // 屋根の高さ（まん中が高いアーチ）
  const roofY = (x: number) => G + 5 + Math.round(4 * Math.sqrt(Math.max(0, 1 - ((x - cx) / (half + 0.5)) ** 2)));
  b.box(x0, G, z0, x1, G, z1, light); // 床（植えこみの土＝明るい緑）
  b.box(cx - 1, G, z0 + 1, cx + 1, G, z1, path); // まん中の石畳の小道
  for (let x = x0; x <= x1; x++) {
    const ry = roofY(x);
    for (let z = z0; z <= z1; z++) {
      const rib = (z - z0) % 4 === 0 || z === z1; // 骨組み
      b.set(x, ry, z, rib ? frame : glass); // 屋根
      if (x === x0 || x === x1) b.box(x, G + 1, z, x, ry - 1, z, rib ? frame : glass); // 左右の壁
    }
    // 奥と手前の壁（手前は入口を空ける）
    for (let y = G + 1; y < ry; y++) {
      b.set(x, y, z0, x % 4 === 0 ? frame : glass);
      if (Math.abs(x - cx) <= 1 && y <= G + 3) continue;
      b.set(x, y, z1, x % 4 === 0 ? frame : glass);
    }
  }
  // 中の植物：小道の左右にぎっしり
  for (let x = x0 + 1; x <= x1 - 1; x++) {
    if (Math.abs(x - cx) <= 1) continue; // 小道
    for (let z = z0 + 1; z <= z1 - 1; z++) {
      const h = (x * 13 + z * 7) % 11;
      if (h === 0 && Math.abs(x - cx) >= 4) {
        // 高いヤシ（幹＋てっぺんに大きく広がる葉）
        const top = Math.min(roofY(x) - 2, G + 7);
        b.pillar(x, z, G + 1, top, wood);
        for (const [dx, dz] of [
          [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2],
        ] as const) {
          b.set(x + dx, top + 1, z + dz, leaf);
        }
        b.set(x - 2, top, z, leaf); // 垂れる葉先
        b.set(x + 2, top, z, leaf);
      } else if (h === 3 || h === 6) {
        b.set(x, G + 1, z, h === 3 ? leaf : light); // シダ・低い葉
        if (h === 3) b.set(x, G + 2, z, leaf);
      } else if (h === 5 || h === 8) {
        b.set(x, G + 1, z, leaf);
        b.set(x, G + 2, z, blooms[(x + z) % blooms.length]); // 色とりどりの花（ランなど）
      }
    }
  }
}

/**
 * 記念館（牧野富太郎記念館）。写真に合わせて：
 *   - 波打つように大きくうねる木の屋根（大きく張り出す）
 *   - 全面のガラスの壁、両端に灰色のコンクリートの壁
 */
function memorialHall(
  b: Build,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  roofWood: number,
  concrete: number,
  glass: number,
): void {
  b.box(x0, G, z0, x1, G, z1, concrete); // 床
  // ガラスの壁（前後）と、両端のコンクリートの壁
  b.box(x0, G + 1, z0, x1, G + 3, z0, glass);
  b.box(x0, G + 1, z1, x1, G + 3, z1, glass);
  b.box(x0, G + 1, z0, x0 + 1, G + 3, z1, concrete);
  b.box(x1 - 1, G + 1, z0, x1, G + 3, z1, concrete);
  for (let x = x0 + 4; x < x1 - 1; x += 4) {
    b.box(x, G + 1, z0, x, G + 3, z0, concrete); // ガラスの間の細い柱
    b.box(x, G + 1, z1, x, G + 3, z1, concrete);
  }
  const cx = Math.floor((x0 + x1) / 2);
  b.box(cx - 1, G + 1, z1, cx + 1, G + 2, z1, AIR); // 入口
  // 波打つ木の屋根（x にそって高さがうねる。端は大きく張り出す）
  for (let x = x0 - 2; x <= x1 + 2; x++) {
    const t = (x - (x0 - 2)) / (x1 - x0 + 4);
    const y = G + 5 + Math.round(1.6 * Math.sin(t * Math.PI * 1.6 - 0.4));
    b.box(x, y, z0 - 2, x, y, z1 + 2, roofWood);
    // 屋根と壁の間をうめる（すき間ができないように）
    if (x >= x0 && x <= x1 && y > G + 4) b.box(x, G + 4, z0, x, y - 1, z0, glass);
    if (x >= x0 && x <= x1 && y > G + 4) b.box(x, G + 4, z1, x, y - 1, z1, glass);
  }
}

/** いろいろな木（kind で松/桜/椿/ヤシ/竹）。 */
function tree(b: Build, x: number, z: number, kind: number, wood: number, leaf: number, sakuraId: number, bamboo: number, bloom: number): void {
  if (kind === 0) {
    b.pine(x, G, z, 3, 3, 1);
  } else if (kind === 1) {
    for (let i = 1; i <= 3; i++) b.set(x, G + i, z, wood);
    b.sphere(x, G + 4, z, 2, sakuraId); // 桜
  } else if (kind === 2) {
    b.set(x, G + 1, z, wood);
    b.sphere(x, G + 2, z, 1, leaf);
    b.set(x, G + 3, z, bloom); // 椿（花つき低木）
  } else if (kind === 3) {
    for (let i = 1; i <= 5; i++) b.set(x, G + i, z, wood);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0]] as const) b.set(x + dx, G + 5, z + dz, leaf); // ヤシ
  } else {
    for (let i = 1; i <= 6; i++) b.set(x, G + i, z, bamboo);
    b.set(x, G + 7, z, leaf); // 竹
  }
}

function build(world: World): void {
  const b = new Build();
  const stone = b.id('stone');
  const grass = b.id('grass');
  const water = b.id('water');
  const sand = b.id('sand');
  const glass = b.id('glass');
  const wood = b.id('wood');
  const roof = b.id('roof');
  const leaves = b.id('leaves');
  const bamboo = b.id('bamboo');
  const flower = b.id('flower');
  const sakura = b.id('sakura');
  const turf = b.id('turf');
  const road = b.id('road');
  const castlewall = b.id('castlewall');
  const stonewall = b.id('stonewall'); // 温室の石畳の小道
  const lantern = b.id('lantern'); // 温室の白っぽい花
  const brick = b.id('brick'); // 温室のオレンジの花
  const torii = b.id('torii'); // 温室の赤い花
  const bridgeWood = b.id('bridge'); // 記念館の木の屋根・池の木道

  // ===== 地面（フィールドいっぱいの広い園内） =====
  b.box(6, 8, 6, 90, 9, 90, stone);
  b.box(6, G, 6, 90, G, 90, grass);

  // ===== 主な施設の場所（植物を避ける範囲） =====
  const occupied = (x: number, z: number): boolean =>
    (x >= 36 && x <= 64 && z >= 26 && z <= 46) || // 温室まわり
    (x >= 11 && x <= 33 && z >= 40 && z <= 68) || // 池まわり
    (x >= 64 && x <= 84 && z >= 44 && z <= 62) || // 記念館まわり
    (x >= 45 && x <= 51 && z >= 46); // 参道

  // ===== 参道（スポーン→温室） =====
  b.box(46, G, 47, 50, G, 89, road);

  // ===== ガラスの大温室（奥・中央＝主役） =====
  greenhouse(b, 38, 28, 62, 44, glass, stone, wood, leaves, turf, [flower, sakura, lantern, brick, torii], stonewall);

  // ===== 池と木道（左） =====
  b.box(13, 8, 42, 31, 8, 66, sand);
  b.box(13, 9, 42, 31, G, 66, water);
  // ジグザグに折れ曲がる木道（写真の池の木道）
  b.box(20, G + 1, 42, 21, G + 1, 48, bridgeWood);
  b.box(20, G + 1, 48, 27, G + 1, 49, bridgeWood);
  b.box(26, G + 1, 49, 27, G + 1, 56, bridgeWood);
  b.box(18, G + 1, 56, 27, G + 1, 57, bridgeWood);
  b.box(18, G + 1, 57, 19, G + 1, 66, bridgeWood);
  // 池のふちの草（シダ・ハナショウブ）
  for (let z = 42; z <= 66; z += 2) {
    b.set(13, G + 1, z, leaves);
    b.set(31, G + 1, z, z % 4 === 0 ? flower : leaves);
  }

  // ===== 記念館（右） =====
  memorialHall(b, 66, 47, 82, 58, bridgeWood, stone, glass);

  // ===== スエコザサ（記念館の入口前。博士が亡き妻・壽衛に感謝して名付けた低い笹） =====
  for (const [sx, sz] of [
    [69, 61],
    [70, 62],
    [71, 61],
    [72, 62],
    [73, 61],
  ] as const) {
    b.set(sx, G + 1, sz, bamboo);
  }
  b.set(70, G + 2, 62, bamboo); // すこし背の高い株
  b.set(72, G + 2, 62, bamboo);

  // ===== 園内の植物（約50%に間引き。種類は5種の木＋花壇のまま） =====
  for (let z = 10; z <= 88; z += 2) {
    for (let x = 10; x <= 88; x += 2) {
      if (occupied(x, z)) continue;
      const h = (x * 73 + z * 131 + x * z) % 9;
      if (h === 0) {
        tree(b, x, z, (x + z) % 5, wood, leaves, sakura, bamboo, flower);
      } else if (h === 2) {
        const c = [flower, sakura, turf, bamboo][(x + z) % 4];
        b.set(x, G, z, c); // 色の花壇（地面）
        b.set(x, G + 1, z, (x + z) % 2 ? flower : sakura); // 背の高い花
      }
    }
  }

  // ===== 看板（入口） =====
  b.pillar(54, 88, G + 1, G + 2, wood);
  b.box(53, G + 3, 88, 55, G + 4, 88, castlewall);

  world.setBlocksBatch(b.cells);
}

export const makino: SpotDefinition = {
  id: 'makino',
  name: 'Makino Botanical Garden',
  nameJa: '牧野植物園',
  emoji: '🌿',
  available: true,
  center: { x: 48, y: 14, z: 48 },
  viewDistance: 96,
  spawn: { pos: { x: 48, y: G + 1, z: 88 }, yaw: 0 },
  field: { min: { x: 6, y: 0, z: 6 }, max: { x: 90, y: 0, z: 90 } },
  // 五台山の上の植物園。まわりは森で、遠くに高知の町
  backdrop: { near: 'forest', far: 'mountains', farCity: ['w'] },
  build,
  objects: [
    {
      id: 'greenhouse',
      name: 'Glass Greenhouse',
      nameJa: 'ガラスの大温室',
      region: { min: { x: 38, y: 10, z: 28 }, max: { x: 62, y: 19, z: 44 } },
      focus: { x: 50, y: 13, z: 36 },
      image: './photos/makino/greenhouse.jpg',
      guide: {
        canDo: 'You can see jungle plants in the glass house.',
        feature: 'It is big. It is all glass.',
        about: 'It is warm in there, like a jungle!',
      },
    },
    {
      id: 'plants',
      name: 'Many Plants',
      nameJa: 'たくさんの植物',
      region: { min: { x: 6, y: 10, z: 62 }, max: { x: 44, y: 18, z: 90 } },
      focus: { x: 24, y: 13, z: 76 },
      image: './photos/makino/plants.jpg',
      guide: {
        canDo: 'You can find many kinds of plants.',
        feature: 'There are trees, flowers, and bamboo.',
        about: 'About 3,000 kinds of plants are here!',
      },
    },
    {
      id: 'pond',
      name: 'Garden Pond',
      nameJa: '池と木道',
      region: { min: { x: 13, y: 9, z: 42 }, max: { x: 31, y: 12, z: 66 } },
      focus: { x: 22, y: 11, z: 54 },
      image: './photos/makino/pond.jpg',
      guide: {
        canDo: 'You can walk over the pond on the wood path.',
        feature: 'The water is clean.',
        about: 'Walk on the wood path. Go slowly and look!',
      },
    },
    {
      id: 'hall',
      name: 'Makino Memorial Hall',
      nameJa: '牧野富太郎記念館',
      region: { min: { x: 64, y: 10, z: 45 }, max: { x: 84, y: 17, z: 60 } },
      focus: { x: 74, y: 13, z: 53 },
      image: './photos/makino/hall.jpg',
      guide: {
        canDo: 'You can visit the Makino museum.',
        feature: 'It has a nice wood roof.',
        about: 'Dr. Makino loved plants. He gave names to about 1,500 plants!',
      },
    },
    {
      id: 'sueko',
      name: 'Sueko Bamboo',
      nameJa: 'スエコザサ',
      region: { min: { x: 67, y: 10, z: 59 }, max: { x: 75, y: 14, z: 64 } },
      focus: { x: 71, y: 12, z: 62 },
      image: './photos/makino/sueko.jpg',
      guide: {
        canDo: 'You can find a small bamboo grass.',
        feature: 'It is short and green.',
        about: 'Sueko was his wife. This plant has her name.',
      },
    },
    {
      id: 'sign',
      name: 'Information Sign',
      nameJa: '看板',
      region: { min: { x: 53, y: 10, z: 87 }, max: { x: 55, y: 15, z: 89 } },
      focus: { x: 54, y: 12, z: 88 },
      image: './photos/makino/sign.jpg',
      guide: {
        canDo: 'You can read about this place.',
        feature: 'It is about this garden.',
        about: 'Let\'s read the sign!',
      },
    },
  ],
};
