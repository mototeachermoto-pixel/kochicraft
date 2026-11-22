/**
 * ブロックのモードの「注文」（2026-11-22）。
 * 留学生が英語で注文し、子どもはお手本を見ながら Step ごとに作る。
 * アプリが、決まったマスに決まったブロックが置けたかを確かめ、できたら次の Step へ進む。
 * 英文は小5が読めるもの（数字とブロックの名前と、かんたんな文）だけにする。
 */

/** お手本の1マス（土台の左手前の角からの位置。dz は大きいほど手前＝スタート側） */
export interface OrderCell {
  dx: number;
  dy: number;
  dz: number;
  /** ブロックの key（blockTypes.ts） */
  key: string;
}

export interface OrderStep {
  /** 注文書に出す英語（短く） */
  text: string;
  /** この Step で使うブロックの key（注文書に色の四角と名前を出す） */
  blocks: string[];
  cells: OrderCell[];
}

export interface Order {
  spotId: string;
  /** 注文する留学生の名前 */
  who: string;
  /** 注文の文 */
  ask: string;
  /** できあがりの名前（注文書の見出し） */
  title: string;
  steps: OrderStep[];
  /** できたら子どもが言う文 */
  finish: string;
  /** 留学生のお礼 */
  reply: string;
  /** 作っている間に、留学生がときどき言うひとこと（注文の言葉をくり返し聞かせる） */
  talks: string[];
  /** この名所で選べるブロック（1〜0のキーの順） */
  palette: string[];
  /** お手本の大きさ（横・おく）。作る場所をさがすのに使う */
  size: { w: number; d: number };
}

/** 箱の形にマスをならべる（x0..x1, y0..y1, z0..z1 をふくむ） */
function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, key: string): OrderCell[] {
  const out: OrderCell[] = [];
  for (let dy = y0; dy <= y1; dy++)
    for (let dz = z0; dz <= z1; dz++)
      for (let dx = x0; dx <= x1; dx++) out.push({ dx, dy, dz, key });
  return out;
}

/** 高知城：小さなお城（土台 5×5×2 → 白いお城 3×3×3（手前のまん中に窓）→ 瓦の屋根） */
const kochiCastle: Order = {
  spotId: 'kochi-castle',
  who: 'Emma',
  ask: 'I want a small castle!',
  title: 'A small castle',
  steps: [
    {
      text: '5 × 5, 2 high',
      blocks: ['stonewall'],
      cells: box(0, 4, 0, 1, 0, 4, 'stonewall'),
    },
    {
      text: '3 × 3, 3 high. 1 window.',
      blocks: ['castlewall', 'glass'],
      cells: box(1, 3, 2, 4, 1, 3, 'castlewall').map((c) =>
        c.dx === 2 && c.dy === 3 && c.dz === 3 ? { ...c, key: 'glass' } : c,
      ),
    },
    {
      text: 'The roof: 3 × 3 and 1 on top.',
      blocks: ['tile'],
      cells: [...box(1, 3, 5, 5, 1, 3, 'tile'), { dx: 2, dy: 6, dz: 2, key: 'tile' }],
    },
  ],
  finish: 'Here you are. This is a small castle.',
  reply: "Wow! It's beautiful. Thank you!",
  talks: [
    'I like castles.',
    'Kochi Castle is old.',
    "It's white. It's beautiful.",
    'The roof is gray.',
    'A small castle. Nice!',
    'I like the stone wall.',
  ],
  palette: ['stonewall', 'castlewall', 'tile', 'glass', 'sakura', 'grass', 'wood', 'leaves', 'flower', 'stone'],
  size: { w: 5, d: 5 },
};

/** 四角いわく（x0..x1, z0..z1 のふちだけ）を、高さ y0..y1 にならべる */
function ring(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, key: string): OrderCell[] {
  return box(x0, x1, y0, y1, z0, z1, key).filter((c) => c.dx === x0 || c.dx === x1 || c.dz === z0 || c.dz === z1);
}

/** 名所の注文を作る（ひとこと・パレットの決まった形をまとめる） */
function order(o: Order): Order {
  return o;
}

/** 選べるブロック：使うブロックを先に、のこりはいつものものでうめる（10こまで） */
function pal(...use: string[]): string[] {
  const rest = ['grass', 'stone', 'wood', 'leaves', 'flower', 'sakura', 'sand', 'dirt', 'brick', 'glass'];
  return [...use, ...rest.filter((k) => !use.includes(k))].slice(0, 10);
}

const katsurahama = order({
  spotId: 'katsurahama',
  who: 'Leo',
  ask: 'I want a pine tree!',
  title: 'A pine tree',
  steps: [
    { text: 'The beach: 5 × 5.', blocks: ['sand'], cells: box(0, 4, 0, 0, 0, 4, 'sand') },
    { text: 'The tree: 1 × 1, 4 high.', blocks: ['wood'], cells: box(2, 2, 1, 4, 2, 2, 'wood') },
    { text: 'Green leaves: 3 × 3, 2 high.', blocks: ['leaves'], cells: box(1, 3, 5, 6, 1, 3, 'leaves') },
  ],
  finish: 'Here you are. This is a pine tree.',
  reply: 'Nice! I like pine trees.',
  talks: ['I like the beach.', 'The sea is blue.', "It's a tall tree.", 'Katsurahama is beautiful.'],
  palette: pal('sand', 'wood', 'leaves'),
  size: { w: 5, d: 5 },
});

const harimaya = order({
  spotId: 'harimaya-bridge',
  who: 'Mei',
  ask: 'I want a red bridge!',
  title: 'A red bridge',
  steps: [
    { text: '2 posts: 1 × 1, 2 high.', blocks: ['wood'], cells: [...box(0, 0, 0, 1, 1, 1, 'wood'), ...box(4, 4, 0, 1, 1, 1, 'wood')] },
    { text: 'The bridge: 5 long, 3 wide.', blocks: ['torii'], cells: box(0, 4, 2, 2, 0, 2, 'torii') },
    { text: 'The rails: 5 long, 2 lines.', blocks: ['torii'], cells: [...box(0, 4, 3, 3, 0, 0, 'torii'), ...box(0, 4, 3, 3, 2, 2, 'torii')] },
  ],
  finish: 'Here you are. This is a red bridge.',
  reply: "Wow! It's red. I like it!",
  talks: ['The bridge is red.', "It's a small bridge.", 'I like trams.', 'Harimaya Bridge is famous.'],
  palette: pal('wood', 'torii'),
  size: { w: 5, d: 3 },
});

const nikobuchi = order({
  spotId: 'nikobuchi',
  who: 'Sam',
  ask: 'I want a bench!',
  title: 'A bench',
  steps: [
    {
      text: '4 legs: 1 high.',
      blocks: ['wood'],
      cells: [[0, 0], [2, 0], [0, 1], [2, 1]].map(([dx, dz]) => ({ dx, dy: 0, dz, key: 'wood' })),
    },
    { text: 'The seat: 3 × 2.', blocks: ['bridge'], cells: box(0, 2, 1, 1, 0, 1, 'bridge') },
    { text: 'The back: 3 long, 2 high.', blocks: ['wood'], cells: box(0, 2, 2, 3, 0, 0, 'wood') },
  ],
  finish: 'Here you are. This is a bench.',
  reply: 'Thank you! I can see the pond!',
  talks: ['The water is blue.', 'I like waterfalls.', "It's a nice bench.", 'Nikobuchi is beautiful.'],
  palette: pal('wood', 'bridge'),
  size: { w: 3, d: 2 },
});

const shimanto = order({
  spotId: 'shimanto',
  who: 'Ken',
  ask: 'I want a canoe!',
  title: 'A canoe',
  steps: [
    { text: 'The deck: 5 × 2.', blocks: ['bridge'], cells: box(0, 4, 0, 0, 0, 1, 'bridge') },
    { text: 'The canoe: 4 long.', blocks: ['torii'], cells: box(0, 3, 1, 1, 1, 1, 'torii') },
    {
      text: 'Up! 1 at the front, 1 at the back.',
      blocks: ['torii'],
      cells: [{ dx: 0, dy: 2, dz: 1, key: 'torii' }, { dx: 3, dy: 2, dz: 1, key: 'torii' }],
    },
  ],
  finish: 'Here you are. This is a canoe.',
  reply: "Cool! Let's go on the river!",
  talks: ['The river is long.', "It's a red canoe.", 'I like canoes.', 'Shimanto River is clean.'],
  palette: pal('bridge', 'torii'),
  size: { w: 5, d: 2 },
});

const muroto = order({
  spotId: 'muroto',
  who: 'Amara',
  ask: 'I want a white lighthouse!',
  title: 'A white lighthouse',
  steps: [
    { text: 'The ground: 3 × 3.', blocks: ['stone'], cells: box(0, 2, 0, 0, 0, 2, 'stone') },
    { text: 'The tower: 1 × 1, 6 high.', blocks: ['castlewall'], cells: box(1, 1, 1, 6, 1, 1, 'castlewall') },
    { text: 'The light: 1 on top.', blocks: ['glass'], cells: [{ dx: 1, dy: 7, dz: 1, key: 'glass' }] },
  ],
  finish: 'Here you are. This is a white lighthouse.',
  reply: "Great! It's tall!",
  talks: ['The sea is big.', "It's a white tower.", 'I like lighthouses.', 'Cape Muroto is beautiful.'],
  palette: pal('stone', 'castlewall', 'glass'),
  size: { w: 3, d: 3 },
});

const ashizuri = order({
  spotId: 'ashizuri',
  who: 'Leo',
  ask: 'I want a viewing deck!',
  title: 'A viewing deck',
  steps: [
    {
      text: '4 posts: 1 × 1, 3 high.',
      blocks: ['wood'],
      cells: [[0, 0], [3, 0], [0, 3], [3, 3]].flatMap(([x, z]) => box(x, x, 0, 2, z, z, 'wood')),
    },
    { text: 'The floor: 4 × 4.', blocks: ['bridge'], cells: box(0, 3, 3, 3, 0, 3, 'bridge') },
    { text: 'The fence: around the floor.', blocks: ['wood'], cells: ring(0, 3, 4, 4, 0, 3, 'wood') },
  ],
  finish: 'Here you are. This is a viewing deck.',
  reply: 'Wow! I can see the sea!',
  talks: ['The cliffs are high.', 'I can see the sea.', 'I like lighthouses.', 'Cape Ashizuri is beautiful.'],
  palette: pal('wood', 'bridge'),
  size: { w: 4, d: 4 },
});

const hirome = order({
  spotId: 'hirome',
  who: 'Mei',
  ask: 'I want a lucky cat!',
  title: 'A lucky cat',
  steps: [
    { text: 'The base: 3 × 3.', blocks: ['brick'], cells: box(0, 2, 0, 0, 0, 2, 'brick') },
    {
      text: 'The body: 2 × 2. White, then red.',
      blocks: ['castlewall', 'torii'],
      cells: [...box(0, 1, 1, 1, 1, 2, 'castlewall'), ...box(0, 1, 2, 2, 1, 2, 'torii')],
    },
    {
      text: 'The head: 2 × 2. 2 ears. 1 hand up!',
      blocks: ['castlewall'],
      cells: [
        ...box(0, 1, 3, 3, 1, 2, 'castlewall'),
        { dx: 0, dy: 4, dz: 1, key: 'castlewall' },
        { dx: 1, dy: 4, dz: 1, key: 'castlewall' },
        { dx: 2, dy: 3, dz: 2, key: 'castlewall' },
      ],
    },
  ],
  finish: 'Here you are. This is a lucky cat.',
  reply: "So cute! It's a lucky cat!",
  talks: ["I'm hungry.", 'I like cats.', "It's white and red.", 'Hirome Market is fun.'],
  palette: pal('brick', 'castlewall', 'torii'),
  size: { w: 3, d: 3 },
});

const ryoma = order({
  spotId: 'ryoma-statue',
  who: 'Sam',
  ask: 'I want a bench by the sea!',
  title: 'A bench',
  steps: [
    {
      text: '4 legs: 1 high.',
      blocks: ['wood'],
      cells: [[0, 0], [2, 0], [0, 1], [2, 1]].map(([dx, dz]) => ({ dx, dy: 0, dz, key: 'wood' })),
    },
    { text: 'The seat: 3 × 2.', blocks: ['bridge'], cells: box(0, 2, 1, 1, 0, 1, 'bridge') },
    { text: 'The back: 3 long, 2 high.', blocks: ['wood'], cells: box(0, 2, 2, 3, 0, 0, 'wood') },
  ],
  finish: 'Here you are. This is a bench.',
  reply: 'Thank you! I can see the sea!',
  talks: ['The sea is blue.', "It's a nice bench.", 'I like Kochi.', 'Ryoma is famous.'],
  palette: pal('wood', 'bridge'),
  size: { w: 3, d: 2 },
});

const makino = order({
  spotId: 'makino',
  who: 'Ken',
  ask: 'I want a flower bed!',
  title: 'A flower bed',
  steps: [
    { text: 'Bricks: 6 × 6, around.', blocks: ['brick'], cells: ring(0, 5, 0, 0, 0, 5, 'brick') },
    { text: 'Dirt: 4 × 4.', blocks: ['dirt'], cells: box(1, 4, 0, 0, 1, 4, 'dirt') },
    {
      text: 'Flowers: 4 × 4. Two colors!',
      blocks: ['flower', 'sakura'],
      cells: box(1, 4, 1, 1, 1, 4, 'flower').map((c) => ((c.dx + c.dz) % 2 ? { ...c, key: 'sakura' } : c)),
    },
  ],
  finish: 'Here you are. This is a flower bed.',
  reply: 'Beautiful! I like flowers.',
  talks: ['I like plants.', 'The flowers are pink.', "It's a pretty garden.", 'Makino Garden is green.'],
  palette: pal('brick', 'dirt', 'flower', 'sakura'),
  size: { w: 6, d: 6 },
});

const noichi = order({
  spotId: 'noichi',
  who: 'Amara',
  ask: 'I want a hot bath for capybaras!',
  title: 'A capybara bath',
  steps: [
    { text: 'The edge: 4 × 4, around.', blocks: ['stone'], cells: ring(1, 4, 0, 0, 1, 4, 'stone') },
    { text: 'Hot water: 2 × 2.', blocks: ['glass'], cells: box(2, 3, 0, 0, 2, 3, 'glass') },
    { text: 'Grass: 6 × 6, around.', blocks: ['grass'], cells: ring(0, 5, 0, 0, 0, 5, 'grass') },
  ],
  finish: 'Here you are. This is a hot bath for capybaras.',
  reply: 'So cute! Capybaras like hot baths!',
  talks: ['I like capybaras.', "It's a hot bath.", 'I like animals.', 'Noichi Zoo is fun.'],
  palette: pal('stone', 'glass', 'grass'),
  size: { w: 6, d: 6 },
});

const ryugado = order({
  spotId: 'ryugado',
  who: 'Emma',
  ask: 'I want an old pot!',
  title: 'An old pot',
  steps: [
    { text: 'The bottom: 3 × 3.', blocks: ['dirt'], cells: box(0, 2, 0, 0, 0, 2, 'dirt') },
    { text: 'The wall: 3 × 3, around. 2 high.', blocks: ['dirt'], cells: ring(0, 2, 1, 2, 0, 2, 'dirt') },
    {
      text: 'The top: 4 blocks.',
      blocks: ['dirt'],
      cells: [[1, 0], [0, 1], [2, 1], [1, 2]].map(([dx, dz]) => ({ dx, dy: 3, dz, key: 'dirt' })),
    },
  ],
  finish: 'Here you are. This is an old pot.',
  reply: "Wow! It's very old!",
  talks: ["It's a big cave.", "It's dark.", 'I like old things.', 'Ryugado is old.'],
  palette: pal('dirt', 'stone'),
  size: { w: 3, d: 3 },
});

export const ORDERS: Record<string, Order> = {
  [kochiCastle.spotId]: kochiCastle,
  ...Object.fromEntries([katsurahama, harimaya, nikobuchi, shimanto, muroto, ashizuri, hirome, ryoma, makino, noichi, ryugado].map((o) => [o.spotId, o])),
};
