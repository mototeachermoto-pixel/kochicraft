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

/** ガラスの大温室（ガラスの壁＋屋根、中に植物。手前に入口）。 */
function greenhouse(b: Build, x0: number, z0: number, x1: number, z1: number, glass: number, wood: number, leaf: number, bloom: number, bloom2: number): void {
  const cx = Math.floor((x0 + x1) / 2);
  b.box(x0, G, z0, x1, G, z1, wood);
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const) b.box(px, G + 1, pz, px, G + 6, pz, wood);
  b.box(x0, G + 1, z0, x1, G + 5, z0, glass); // 奥
  b.box(x0, G + 1, z0, x0, G + 5, z1, glass); // 左
  b.box(x1, G + 1, z0, x1, G + 5, z1, glass); // 右
  for (let x = x0; x <= x1; x++) for (let y = G + 1; y <= G + 5; y++) {
    if (Math.abs(x - cx) <= 1 && y <= G + 3) continue; // 入口
    b.set(x, y, z1, glass);
  }
  b.box(x0, G + 6, z0, x1, G + 6, z1, glass); // 屋根
  // 中の植物：数を大きく減らし、中央に広い通路（余白）を残す。
  // 1株ずつ背を高くして「植物」だとはっきり分かる形に（小さなヤシ／花の木）。種類（葉・花・桜）はそのまま。
  for (const x of [x0 + 4, x1 - 4]) { // 左右2列だけ。中央（x 43〜57）は通路＝広い余白
    for (const z of [z0 + 3, z0 + 7, z1 - 3]) { // 前・中・奥に1株ずつ
      const kind = (x + z) % 3;
      if (kind === 0) {
        // 小さなヤシ（幹＋てっぺんに葉の広がり）
        b.pillar(x, z, G + 1, G + 3, wood);
        for (const [dx, dz] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] as const) b.set(x + dx, G + 4, z + dz, leaf);
      } else if (kind === 1) {
        // 花の木（緑の茎＋てっぺんに花）
        b.pillar(x, z, G + 1, G + 3, leaf);
        b.set(x, G + 4, z, bloom);
      } else {
        // 桜の花の木
        b.pillar(x, z, G + 1, G + 2, wood);
        b.set(x, G + 3, z, bloom2);
      }
    }
  }
}

/** 記念館（木の壁＋ガラス窓＋波打つ木の屋根）。 */
function memorialHall(b: Build, x0: number, z0: number, x1: number, z1: number, wood: number, roofId: number, glass: number): void {
  b.box(x0, G + 1, z0, x1, G + 3, z0, wood);
  b.box(x0, G + 1, z0, x0, G + 3, z1, wood);
  b.box(x1, G + 1, z0, x1, G + 3, z1, wood);
  b.box(x0, G + 1, z1, x1, G + 3, z1, wood);
  const cx = Math.floor((x0 + x1) / 2);
  b.set(cx, G + 1, z1, AIR);
  b.set(cx, G + 2, z1, AIR);
  for (let x = x0 + 1; x < x1; x += 2) b.set(x, G + 2, z0, glass); // 窓
  b.box(x0 - 1, G + 4, z0 - 1, x1 + 1, G + 4, z1 + 1, roofId);
  for (let x = x0; x <= x1; x += 2) b.box(x, G + 5, z0, x, G + 5, z1, roofId); // 波打つ屋根
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
  greenhouse(b, 38, 28, 62, 44, glass, wood, leaves, flower, sakura);

  // ===== 池と木道（左） =====
  b.box(13, 8, 42, 31, 8, 66, sand);
  b.box(13, 9, 42, 31, G, 66, water);
  b.box(20, G + 1, 42, 21, G + 1, 66, wood); // 木道

  // ===== 記念館（右） =====
  memorialHall(b, 66, 46, 82, 60, wood, roof, glass);

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
  build,
  objects: [
    {
      id: 'greenhouse',
      name: 'Glass Greenhouse',
      nameJa: 'ガラスの大温室',
      region: { min: { x: 38, y: 10, z: 28 }, max: { x: 62, y: 17, z: 44 } },
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
        about: 'About 3,000 plants live here!',
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
      region: { min: { x: 66, y: 10, z: 46 }, max: { x: 82, y: 16, z: 60 } },
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
        about: 'Dr. Makino loved Sueko. This plant has her name.',
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
        about: 'This is a sign. It helps you learn about Makino Botanical Garden.',
      },
    },
  ],
};
