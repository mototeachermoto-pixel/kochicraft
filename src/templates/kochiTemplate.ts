import { WORLD_DEPTH, WORLD_WIDTH } from '@/config/constants';
import type { Landmark } from '@/types';
import { blockRegistry } from '@/world/BlockRegistry';
import type { World } from '@/world/World';
import { createLandmark } from '@/features/tourism/Landmark';

/**
 * 高知県テンプレート。
 * 高知の観光地をモチーフにした「オリジナルのボクセル建築物」を最初から配置する。
 * 実在の写真・テクスチャは使わず、ブロックの色だけで象徴的に表現しているため
 * 著作権に配慮しつつ、雰囲気が伝わるデザインにしている。
 */

type Cell = { x: number; y: number; z: number; id: number };

/** ブロックIDの早見 */
const B = {
  air: 0,
  grass: blockRegistry.getByKey('grass')!.id,
  dirt: blockRegistry.getByKey('dirt')!.id,
  stone: blockRegistry.getByKey('stone')!.id,
  sand: blockRegistry.getByKey('sand')!.id,
  water: blockRegistry.getByKey('water')!.id,
  wood: blockRegistry.getByKey('wood')!.id,
  glass: blockRegistry.getByKey('glass')!.id,
  tile: blockRegistry.getByKey('tile')!.id,
  roof: blockRegistry.getByKey('roof')!.id,
  turf: blockRegistry.getByKey('turf')!.id,
  stonewall: blockRegistry.getByKey('stonewall')!.id,
  castlewall: blockRegistry.getByKey('castlewall')!.id,
  torii: blockRegistry.getByKey('torii')!.id,
  lantern: blockRegistry.getByKey('lantern')!.id,
  sakura: blockRegistry.getByKey('sakura')!.id,
};

/** 正方形の土台をならす（上を平らにし、上空を空けて、下を埋める） */
function flatten(out: Cell[], world: World, cx: number, cz: number, half: number, topY: number, topId: number): void {
  for (let dx = -half; dx <= half; dx++) {
    for (let dz = -half; dz <= half; dz++) {
      const x = cx + dx;
      const z = cz + dz;
      const sy = world.getSurfaceY(x, z);
      // 低い所は土で埋める
      for (let y = sy + 1; y < topY; y++) out.push({ x, y, z, id: B.dirt });
      // 表面
      out.push({ x, y: topY, z, id: topId });
      // 上空を空ける（丘や木を撤去）
      for (let y = topY + 1; y <= topY + 22; y++) out.push({ x, y, z, id: B.air });
    }
  }
}

/** 桜の木（幹＋桜の葉） */
function sakura(out: Cell[], x: number, by: number, z: number): void {
  for (let h = 1; h <= 3; h++) out.push({ x, y: by + h, z, id: B.wood });
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) out.push({ x: x + dx, y: by + 4, z: z + dz, id: B.sakura });
  }
  out.push({ x, y: by + 5, z, id: B.sakura });
}

/** 高知城（オリジナル・天守風） */
function castle(out: Cell[], cx: number, by: number, cz: number): void {
  // 石垣の土台 9x9
  for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) out.push({ x: cx + dx, y: by + 1, z: cz + dz, id: B.stonewall });
  // 1層目の壁 7x7（高さ4）・窓
  for (let h = 2; h <= 5; h++) {
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        if (Math.abs(dx) !== 3 && Math.abs(dz) !== 3) continue;
        let id = B.castlewall;
        if (h === 3 && ((dx === 0 && Math.abs(dz) === 3) || (dz === 0 && Math.abs(dx) === 3))) id = B.glass;
        out.push({ x: cx + dx, y: by + h, z: cz + dz, id });
      }
    }
  }
  // 1層目の屋根 9x9
  for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) out.push({ x: cx + dx, y: by + 6, z: cz + dz, id: B.roof });
  // 2層目の壁 3x3（高さ3）
  for (let h = 7; h <= 9; h++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (Math.abs(dx) === 1 || Math.abs(dz) === 1) out.push({ x: cx + dx, y: by + h, z: cz + dz, id: B.castlewall });
      }
    }
  }
  // 2層目の屋根 5x5 ＋ てっぺん
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) out.push({ x: cx + dx, y: by + 10, z: cz + dz, id: B.roof });
  out.push({ x: cx, y: by + 11, z: cz, id: B.tile });
}

/** 坂本龍馬像（オリジナルの抽象的なブロック人形＋台座） */
function ryomaStatue(out: Cell[], cx: number, by: number, cz: number): void {
  // 台座 3x3 高さ3
  for (let h = 1; h <= 3; h++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) out.push({ x: cx + dx, y: by + h, z: cz + dz, id: B.stonewall });
  // 人形（ブロンズ風に木の色）
  const fy = by + 3;
  out.push({ x: cx, y: fy + 1, z: cz, id: B.wood }); // 足・コート下
  out.push({ x: cx, y: fy + 2, z: cz, id: B.wood });
  out.push({ x: cx, y: fy + 3, z: cz, id: B.wood }); // 胴
  out.push({ x: cx - 1, y: fy + 3, z: cz, id: B.wood }); // 腕
  out.push({ x: cx + 1, y: fy + 3, z: cz, id: B.wood });
  out.push({ x: cx, y: fy + 4, z: cz, id: B.wood }); // 肩
  out.push({ x: cx, y: fy + 5, z: cz, id: B.tile }); // 頭
}

/** はりまや橋（赤いアーチ橋＋下に水） */
function harimayaBridge(out: Cell[], cx: number, by: number, cz: number): void {
  const arch = (dx: number) => (Math.abs(dx) <= 1 ? 2 : Math.abs(dx) <= 3 ? 1 : 0);
  // 下の水路
  for (let dx = -4; dx <= 4; dx++) for (let dz = -1; dz <= 1; dz++) out.push({ x: cx + dx, y: by, z: cz + dz, id: B.water });
  // 橋げた（茶）＋赤い欄干
  for (let dx = -4; dx <= 4; dx++) {
    const y = by + 1 + arch(dx);
    for (let dz = -1; dz <= 1; dz++) out.push({ x: cx + dx, y, z: cz + dz, id: B.wood });
    out.push({ x: cx + dx, y: y + 1, z: cz - 1, id: B.torii }); // 赤い欄干
    out.push({ x: cx + dx, y: y + 1, z: cz + 1, id: B.torii });
  }
}

/** にこ淵（青い水のふち＋鳥居＋灯籠＋桜） */
function nikobuchi(out: Cell[], cx: number, by: number, cz: number): void {
  // 池
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) out.push({ x: cx + dx, y: by, z: cz + dz, id: B.water });
  // 鳥居（手前）
  const tz = cz + 3;
  for (let h = 1; h <= 3; h++) {
    out.push({ x: cx - 1, y: by + h, z: tz, id: B.torii });
    out.push({ x: cx + 1, y: by + h, z: tz, id: B.torii });
  }
  for (let dx = -2; dx <= 2; dx++) out.push({ x: cx + dx, y: by + 4, z: tz, id: B.torii });
  out.push({ x: cx, y: by + 5, z: tz, id: B.torii });
  // 灯籠
  out.push({ x: cx - 3, y: by + 1, z: tz, id: B.lantern });
  out.push({ x: cx + 3, y: by + 1, z: tz, id: B.lantern });
  // 桜
  sakura(out, cx - 3, by, cz - 3);
  sakura(out, cx + 3, by, cz - 3);
}

/** 1つの観光地サイトの定義 */
interface Site {
  dx: number;
  dz: number;
  half: number;
  topId: number;
  build: (out: Cell[], cx: number, by: number, cz: number) => void;
  landmark: Omit<Landmark, 'id' | 'position'>;
}

/**
 * 高知テンプレートをワールドへ建築し、観光地（Landmark）一覧を返す。
 * Engine から呼び、返り値を TourismManager に登録する。
 */
export function buildKochi(world: World): Landmark[] {
  const sx = Math.floor(WORLD_WIDTH / 2);
  const sz = Math.floor(WORLD_DEPTH / 2);

  const sites: Site[] = [
    {
      dx: 0,
      dz: -18,
      half: 8,
      topId: B.turf,
      build: castle,
      landmark: {
        radius: 11,
        titleJa: '高知城',
        titleEn: 'Kochi Castle',
        descJa: 'これは高知城です。高知にある とても古いお城です。',
        descEn: 'This is Kochi Castle. It is a very old castle in Kochi.',
        speech: { ja: '', en: '' },
        guide: {
          introEn: 'This is Kochi Castle. It is a very old castle in Kochi.',
          introJa: 'これは高知城です。高知にある とても古いお城です。',
          canDoEn: 'You can climb the tower and look at the town.',
          canDoJa: '天守にのぼって、町を見ることができます。',
          recommendEn: 'The old wooden tower is the best part. It is over 400 years old!',
          recommendJa: '古い木の天守がおすすめ。400年以上前のものだよ！',
        },
        phrases: [
          { en: 'This is a castle.', ja: 'これはお城です。' },
          { en: 'It is very old.', ja: 'とても古いです。' },
          { en: "Let's go up!", ja: 'のぼってみよう！' },
        ],
      },
    },
    {
      dx: 18,
      dz: -2,
      half: 8,
      topId: B.sand,
      build: ryomaStatue,
      landmark: {
        radius: 11,
        titleJa: '桂浜（坂本龍馬像）',
        titleEn: 'Katsurahama Beach',
        descJa: 'ここは桂浜です。大きな坂本龍馬の像があります。',
        descEn: 'This is Katsurahama Beach. There is a big statue of Sakamoto Ryoma.',
        speech: { ja: '', en: '' },
        guide: {
          introEn: 'This is Katsurahama Beach. There is a big statue of Sakamoto Ryoma.',
          introJa: 'ここは桂浜です。大きな坂本龍馬の像があります。',
          canDoEn: 'You can walk on the sand and watch the sea.',
          canDoJa: '砂浜を歩いて、海をながめることができます。',
          recommendEn: 'Look at the statue. Ryoma is looking at the wide sea!',
          recommendJa: '像を見てね。龍馬が広い海を見ているよ！',
        },
        phrases: [
          { en: 'This is a beach.', ja: 'これは浜です。' },
          { en: 'Look at the sea!', ja: '海を見て！' },
          { en: 'It is beautiful.', ja: 'きれいです。' },
        ],
      },
    },
    {
      dx: -18,
      dz: 2,
      half: 8,
      topId: B.turf,
      build: harimayaBridge,
      landmark: {
        radius: 11,
        titleJa: 'はりまや橋',
        titleEn: 'Harimaya Bridge',
        descJa: 'これははりまや橋です。町なかの小さな赤い橋です。',
        descEn: 'This is Harimaya Bridge. It is a small red bridge in the city.',
        speech: { ja: '', en: '' },
        guide: {
          introEn: 'This is Harimaya Bridge. It is a small red bridge in the city.',
          introJa: 'これははりまや橋です。町なかの小さな赤い橋です。',
          canDoEn: 'You can cross the red bridge and take a photo.',
          canDoJa: '赤い橋をわたって、写真をとることができます。',
          recommendEn: 'The bright red color is famous. It is in an old song!',
          recommendJa: 'あざやかな赤色が有名。古い歌にも出てくるよ！',
        },
        phrases: [
          { en: 'This is a red bridge.', ja: 'これは赤い橋です。' },
          { en: 'It is famous.', ja: '有名です。' },
          { en: 'Take a photo!', ja: '写真をとろう！' },
        ],
      },
    },
    {
      dx: 2,
      dz: 18,
      half: 7,
      topId: B.grass,
      build: nikobuchi,
      landmark: {
        radius: 11,
        titleJa: 'にこ淵',
        titleEn: 'Nikobuchi',
        descJa: 'ここはにこ淵です。すきとおった青い水のふちです。',
        descEn: 'This is Nikobuchi. It is a pond with clear blue water.',
        speech: { ja: '', en: '' },
        guide: {
          introEn: 'This is Nikobuchi. It is a pond with clear blue water.',
          introJa: 'ここはにこ淵です。すきとおった青い水のふちです。',
          canDoEn: 'You can see the blue water and the red torii gate.',
          canDoJa: '青い水と、赤い鳥居を見ることができます。',
          recommendEn: 'The blue water is amazing. People say a water god lives here!',
          recommendJa: '青い水がすごい。水の神さまがすむと言われているよ！',
        },
        phrases: [
          { en: 'The water is blue.', ja: '水が青いです。' },
          { en: 'Look at the gate.', ja: '鳥居を見て。' },
          { en: 'How clear!', ja: 'なんて すんでいるの！' },
        ],
      },
    },
  ];

  const out: Cell[] = [];
  const landmarks: Landmark[] = [];

  for (const site of sites) {
    const cx = sx + site.dx;
    const cz = sz + site.dz;
    const topY = world.getSurfaceY(cx, cz);
    flatten(out, world, cx, cz, site.half, topY, site.topId);
    site.build(out, cx, topY, cz);
    landmarks.push(createLandmark({ x: cx, y: topY, z: cz }, site.landmark));
  }

  // すべての建築を一括反映（影響チャンクは1回だけ再メッシュ）
  world.setBlocksBatch(out);

  return landmarks;
}
