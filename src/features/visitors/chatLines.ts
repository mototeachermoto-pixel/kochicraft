/**
 * 道案内の間の、留学生とのおしゃべり（2026-11-22 先生と決めた一覧＝「留学生の吹き出し一覧.md」かんたん版）。
 * 小5の子どもが言える、かんたんな単語だけにしてある。英文を直すときは、一覧の .md も合わせて直す。
 *
 *  - talk：留学生が言う（聞く）。hint は、子どもが返せる答えの例（「Try:」として小さく出す）。
 *  - like：子どもが留学生に聞く「Do you like ～?」と、留学生の答え。
 *  - canDo：その観光地の「You can ～.」。留学生が「What can I do here?」と聞いたときの答えの例。
 */

export interface Talk {
  /** 留学生が言う文 */
  say: string;
  /** 子どもが返せる答えの例（1つ以上） */
  hint?: string[];
}

export interface Like {
  /** 子どもが聞く文 */
  ask: string;
  /** 留学生の答え */
  answer: string;
}

export interface SpotChat {
  canDo: string[];
  talks: Talk[];
  likes: Like[];
}

/** どの観光地でも出る、留学生の質問 */
export const COMMON_TALKS: Talk[] = [
  { say: 'What do you like?', hint: ['I like soccer.', 'I like cats.'] },
  { say: 'What food do you like?', hint: ['I like katsuo no tataki.'] },
  { say: 'I like Japanese food.', hint: ['I like Japanese food, too.'] },
  { say: 'What sport do you like?', hint: ['I like baseball.', 'I like swimming.'] },
  { say: 'What animal do you like?', hint: ['I like dogs.'] },
  { say: 'What color do you like?', hint: ['I like blue.'] },
  { say: 'What do you want?', hint: ['I want katsuo no tataki.'] },
  { say: 'What do you want to eat?', hint: ['I want to eat ice cream.'] },
  { say: 'What do you want to eat in Kochi?', hint: ['I want to eat katsuo no tataki.'] },
  { say: 'What do you have in your town?', hint: ['We have Kochi Castle.'] },
  { say: 'Where is Kochi Castle?', hint: ['It\'s in Kochi City.'] },
  { say: 'Can you swim?', hint: ['Yes, I can.', 'No, I can\'t.'] },
  { say: 'Can you ride a bike?', hint: ['Yes, I can.', 'No, I can\'t.'] },
];

/** 歩きながらのひとこと */
export const COMMON_COMMENTS: Talk[] = [
  { say: 'It\'s exciting!' },
  { say: 'Let\'s go!' },
  { say: 'Is it far?', hint: ['No. This way!'] },
];

/** 観光地ごと（キーは観光地の id） */
export const SPOT_CHATS: Record<string, SpotChat> = {
  'kochi-castle': {
    canDo: [
      'You can see a big castle.',
      'You can see an old house.',
      'You can walk through the big gate.',
      'You can walk up the steps.',
      'You can see pink flowers in spring.',
      'You can see the city.',
      'You can take pictures.',
      'You can see a man on a horse.',
    ],
    talks: [{ say: 'What do you want to do at Kochi Castle?', hint: ['I want to take pictures.', 'I want to see the beautiful view.'] }],
    likes: [
      { ask: 'Do you like castles?', answer: 'Yes, I do. I like castles.' },
      { ask: 'Do you like pink flowers?', answer: 'Yes, I do. They are pretty.' },
      { ask: 'Do you like old houses?', answer: 'Yes, I do.' },
      { ask: 'Do you like taking pictures?', answer: 'Yes, I do.' },
      { ask: 'Do you like walking?', answer: 'No, I don\'t.' },
    ],
  },
  katsurahama: {
    canDo: [
      'You can walk on the sand.',
      'You can see big waves.',
      'You can see many trees.',
      'You can see a small shrine.',
      'You can see big rocks.',
      'You can see the beautiful sea.',
      'You can find pretty stones.',
      'You can see the moon.',
    ],
    // 実際の桂浜は遊泳禁止なので、答えは No にする
    talks: [{ say: 'Can you swim at Katsurahama?', hint: ['No, I can\'t.'] }],
    likes: [
      { ask: 'Do you like the sea?', answer: 'Yes, I do. I like the sea.' },
      { ask: 'Do you like swimming?', answer: 'Yes, I do.' },
      { ask: 'Do you like the moon?', answer: 'Yes, I do. It\'s beautiful.' },
      { ask: 'Do you like rocks?', answer: 'No, I don\'t.' },
    ],
  },
  'harimaya-bridge': {
    canDo: [
      'You can walk on the red bridge.',
      'You can see a tram.',
      'You can ride a tram.',
      'You can take pictures.',
      'You can go shopping.',
      'You can see the city.',
    ],
    talks: [{ say: 'What\'s this?', hint: ['It\'s Harimaya Bridge.'] }],
    likes: [
      { ask: 'Do you like trams?', answer: 'Yes, I do. I like trams.' },
      { ask: 'Do you like trains?', answer: 'Yes, I do.' },
      { ask: 'Do you like red?', answer: 'No, I don\'t. I like blue.' },
      { ask: 'Do you like shopping?', answer: 'Yes, I do.' },
    ],
  },
  nikobuchi: {
    canDo: [
      'You can see blue water.',
      'You can see a waterfall.',
      'You can see a beautiful pond.',
      'You can walk in the forest.',
      'You can see beautiful nature.',
    ],
    talks: [{ say: 'It\'s very beautiful.', hint: ['You can see beautiful nature here.'] }],
    likes: [
      { ask: 'Do you like blue?', answer: 'Yes, I do. I like blue.' },
      { ask: 'Do you like nature?', answer: 'Yes, I do.' },
      { ask: 'Do you like trees?', answer: 'Yes, I do.' },
      { ask: 'Do you like cold water?', answer: 'No, I don\'t.' },
    ],
  },
  shimanto: {
    canDo: [
      'You can see a big river.',
      'You can walk on the bridge.',
      'You can see canoes.',
      'You can see a boat.',
      'You can see green mountains.',
      'You can ride a canoe.',
      'You can ride a bike.',
      'You can catch fish.',
    ],
    talks: [{ say: 'Can you swim?', hint: ['Yes, I can.', 'No, I can\'t.'] }],
    likes: [
      { ask: 'Do you like rivers?', answer: 'Yes, I do.' },
      { ask: 'Do you like fish?', answer: 'Yes, I do. I like fish.' },
      { ask: 'Do you like boats?', answer: 'Yes, I do.' },
      { ask: 'Do you like bikes?', answer: 'No, I don\'t.' },
    ],
  },
  muroto: {
    canDo: [
      'You can walk on big rocks.',
      'You can see a white tower.',
      'You can see the big sea.',
      'You can see a big tree.',
      'You can go into a small cave.',
      'You can see whales.',
      'You can see the sun in the morning.',
    ],
    talks: [{ say: 'What animal do you like?', hint: ['I like whales.'] }],
    likes: [
      { ask: 'Do you like whales?', answer: 'Yes, I do. I like whales.' },
      { ask: 'Do you like the sea?', answer: 'Yes, I do.' },
      { ask: 'Do you like trees?', answer: 'Yes, I do.' },
      { ask: 'Do you like rocks?', answer: 'No, I don\'t.' },
    ],
  },
  ashizuri: {
    canDo: [
      'You can see the sea from a high place.',
      'You can see a white tower.',
      'You can see the big sea.',
      'You can see a big rock in the sea.',
      'You can see a big statue.',
      'You can walk under red flowers.',
      'You can see red flowers in winter.',
    ],
    talks: [{ say: 'What color do you like?', hint: ['I like red.'] }],
    likes: [
      { ask: 'Do you like flowers?', answer: 'Yes, I do. I like red flowers.' },
      { ask: 'Do you like the sea?', answer: 'Yes, I do.' },
      { ask: 'Do you like winter?', answer: 'Yes, I do.' },
      { ask: 'Do you like high places?', answer: 'No, I don\'t.' },
    ],
  },
  hirome: {
    canDo: [
      'You can eat katsuo no tataki.',
      'You can buy fish.',
      'You can eat with your friends.',
      'You can eat utsubo.',
      'You can eat lunch.',
      'You can buy food.',
    ],
    talks: [
      { say: 'What would you like?', hint: ['I\'d like katsuo no tataki.'] },
      { say: 'What do you want to eat?', hint: ['I want to eat utsubo.'] },
      { say: 'Kochi\'s food is delicious!', hint: ['Thank you!'] },
    ],
    likes: [
      { ask: 'Do you like fish?', answer: 'Yes, I do. I like fish.' },
      { ask: 'Do you like katsuo no tataki?', answer: 'Yes, I do. It\'s delicious.' },
      { ask: 'Do you like Japanese food?', answer: 'Yes, I do.' },
      { ask: 'Do you like rice?', answer: 'Yes, I do.' },
      { ask: 'Do you like natto?', answer: 'No, I don\'t.' },
    ],
  },
  'ryoma-statue': {
    canDo: ['You can see a big statue.', 'You can walk up the steps.', 'You can see the sea.', 'You can take pictures.'],
    talks: [{ say: 'Who is he?', hint: ['He is Sakamoto Ryoma.'] }],
    likes: [
      { ask: 'Do you like Ryoma?', answer: 'Yes, I do. He is cool.' },
      { ask: 'Do you like taking pictures?', answer: 'Yes, I do.' },
      { ask: 'Do you like the sea?', answer: 'Yes, I do.' },
    ],
  },
  makino: {
    canDo: [
      'You can see big plants.',
      'You can see many flowers.',
      'You can walk by the pond.',
      'You can see beautiful nature.',
      'You can see many trees.',
    ],
    talks: [{ say: 'It\'s very beautiful.', hint: ['You can see beautiful nature here.'] }],
    likes: [
      { ask: 'Do you like flowers?', answer: 'Yes, I do. I like flowers.' },
      { ask: 'Do you like trees?', answer: 'Yes, I do.' },
      { ask: 'Do you like green?', answer: 'Yes, I do.' },
      { ask: 'Do you like insects?', answer: 'No, I don\'t.' },
    ],
  },
  noichi: {
    canDo: [
      'You can see many animals.',
      'You can see giraffes.',
      'You can see monkeys.',
      'You can see a red panda.',
      'You can see a big bird.',
      'You can see zebras.',
    ],
    talks: [{ say: 'What animal do you like?', hint: ['I like red pandas.'] }],
    likes: [
      { ask: 'Do you like animals?', answer: 'Yes, I do. I like animals.' },
      { ask: 'Do you like giraffes?', answer: 'Yes, I do. They are tall.' },
      { ask: 'Do you like red pandas?', answer: 'Yes, I do. They are cute.' },
      { ask: 'Do you like monkeys?', answer: 'Yes, I do.' },
      { ask: 'Do you like birds?', answer: 'No, I don\'t.' },
    ],
  },
  ryugado: {
    canDo: ['You can walk in a big cave.', 'You can see big rocks in the cave.', 'You can see an old pot.', 'You can see a waterfall.'],
    talks: [{ say: 'It\'s dark!', hint: ['Let\'s go!'] }],
    likes: [
      { ask: 'Do you like caves?', answer: 'Yes, I do. It\'s exciting.' },
      { ask: 'Do you like waterfalls?', answer: 'Yes, I do.' },
      { ask: 'Do you like dark places?', answer: 'No, I don\'t.' },
    ],
  },
};
