import * as THREE from 'three';
import { Avatar, type KidLook } from '@/player/Avatar';
import type { World } from '@/world/World';
import type { SpeechService } from '@/features/language/SpeechService';
import type { SceneObject } from '@/spots/SpotDefinition';
import { SPOT_CHATS, type Like } from './chatLines';
import { MOVE_SPEED, SPRINT_SPEED } from '@/config/constants';

/**
 * 留学生ゲーム ステップ1「留学生と出会う」（2026-11-14 先生と決めた順番の1つ目）。
 * 練習モード（Practice & Build）で観光地に入ると、スタート地点の近くに留学生が3人立っている。
 *  - 今のキャラクターの人形を使い回し、髪・肌・服の色を人ごとに変える。名前つき。
 *  - ふだんは息をしたり、ときどき向きを変えたりしている。
 *  - 近づくと（6マス以内）こちらを向き、すぐそば（3マス以内）で「Hello! I'm Emma.」と吹き出しで言い、
 *    端末の英語の声で読み上げる（人ごとに声の高さを変える）。はなれると吹き出しは消え、また近づくと言う。
 * ステップ2「行きたい所を聞く」：あいさつの吹き出しの下に「Where do you want to go?」のボタン（タップか A キー＝Ask）。
 *   押すと、自分のセリフが画面の下に出て読み上げ → 留学生が「I want to go to ～.」と答える（行き先は名所からランダム）。
 *   行き先が決まると onRequest で知らせる（Engine が光の柱を目立たせ、画面の上に行き先を出す）。
 *   いちどに頼まれるのは1人だけ。
 * 道案内の間のおしゃべり（2026-11-22）：案内中、ときどき画面の下のカードに留学生のひとことが出る（chatLines.ts）。
 *   - 留学生の質問＋「Try:」答えの例 ／「What can I do here?」＋その観光地の You can ～. ／
 *     「Do you like ～?」を文字で見せ、少しあとに留学生が自動で答える（ボタンなし）。
 *   - 次のおしゃべりは、時間ではなく歩いた距離（28秒分）で出す。カードは9秒で消える。
 *   - 紹介カードが出ている間・案内していない間は出さない。
 */
/** 道案内の間、次のおしゃべりまでの歩く距離（ブロック）＝ふつうに歩いて28秒分（5ブロック/秒×28）。止まっていると出ない */
const CHAT_WALK = MOVE_SPEED * 28;
/** はじめの「Let's go!」までの距離（3秒分） */
const CHAT_FIRST = MOVE_SPEED * 3;
/** おしゃべりのカードを出しておく秒数（過ぎたら自動で消える） */
const CHAT_SHOW = 9;

interface VisitorDef {
  name: string;
  look: KidLook;
  /** 声の高さ（1.0 がふつう） */
  pitch: number;
}

/**
 * 留学生（名前は小5で読める短いもの）。2026-11-14 先生の希望で、アジア系・アフリカ系・ヨーロッパ系の
 * 3グループに分け、どの観光地でも各グループから1人ずつ出す。髪型（帽子・ポニーテール・おだんご）も変えて見分けやすく。
 */
const GROUPS: VisitorDef[][] = [
  // アジア系
  [
    { name: 'Ken', pitch: 0.95, look: { girl: false, skin: 0xe8c39e, hair: 0x15110e, shirt: 0x2f80ed, pants: 0x2c3e50, cap: 0xe74c3c } },
    { name: 'Mei', pitch: 1.4, look: { girl: true, skin: 0xf0cfae, hair: 0x15110e, shirt: 0xff8fb1, pants: 0x34495e, ponytail: true } },
  ],
  // アフリカ系
  [
    { name: 'Leo', pitch: 0.85, look: { girl: false, skin: 0x6b4228, hair: 0x120d0a, shirt: 0xf2b134, pants: 0x1f3a5f } },
    { name: 'Amara', pitch: 1.3, look: { girl: true, skin: 0x7a4a2c, hair: 0x120d0a, shirt: 0x1abc9c, pants: 0x8e44ad, bun: true } },
  ],
  // ヨーロッパ系
  [
    { name: 'Emma', pitch: 1.35, look: { girl: true, skin: 0xf9dcc8, hair: 0xe9c46a, shirt: 0xe8604c, pants: 0x3b5ba8 } },
    { name: 'Sam', pitch: 1.05, look: { girl: false, skin: 0xf6d2bd, hair: 0xb5482b, shirt: 0x27ae60, pants: 0x6d4c41 } },
  ],
];

/** 名前から留学生の見た目・声の高さをひく（ブロックのモードの注文の人にも使う） */
export function visitorDef(name: string): { look: KidLook; pitch: number } | undefined {
  return GROUPS.flat().find((d) => d.name === name);
}

/** よろこぶ時間（秒）。カメラが顔の前へ寄っている時間 */
export const JOY_TIME = 3.2;
/** いちどに観光地に出す人数 */
const COUNT = 3;
/** こちらを向く距離（マス） */
const LOOK_DIST = 6;
/** 着いたとみなす、名所の範囲のふちからの距離（マス） */
const ARRIVE_DIST = 8;
/** あいさつする距離（マス） */
const TALK_DIST = 3;

interface Visitor {
  def: VisitorDef;
  avatar: Avatar;
  pos: THREE.Vector3;
  yaw: number;
  /** ふだん向いている向き（こちらを向いていないとき） */
  homeYaw: number;
  /** 次にふと向きを変えるまでの時間 */
  idleTimer: number;
  bubble: HTMLDivElement;
  /** 今、あいさつ中（吹き出しを出している）か */
  talking: boolean;
  /** 吹き出しの中の文 */
  line: HTMLSpanElement;
  /** 「Where do you want to go?」のボタン */
  askBtn: HTMLButtonElement;
  /** 行きたい所（決まったら） */
  want: SceneObject | null;
  /** ついてきている（案内中） */
  following: boolean;
  /** 着いた */
  arrived: boolean;
  /** 前に進めなかった時間（ひっかかり） */
  stuck: number;
  /** 今、歩いているか（手足のふり用） */
  walking: boolean;
  /** 喜んでいる残り時間（ジャンプする） */
  joy: number;
  /** 次のハートまでの時間 */
  heartTimer: number;
}

export class Visitors {
  private list: Visitor[] = [];
  private readonly tmp = new THREE.Vector3();
  private objects: SceneObject[] = [];
  /** 自分（プレイヤー）のセリフ（画面の下） */
  private readonly meSay: HTMLDivElement;
  private meTimer = 0;
  /** 今よろこんでいる留学生（カメラを寄せる相手） */
  private celebrating: Visitor | null = null;
  private readonly lastPlayer = new THREE.Vector3();
  /** 今、行き先を頼んでいる留学生 */
  private active: Visitor | null = null;
  /** 答えを待っているタイマー */
  private answerTimer = 0;
  /** いまの観光地の id（おしゃべりの文をえらぶため） */
  private spotId = '';
  /** 道案内の間のおしゃべりのカード（画面の下） */
  private readonly chat: HTMLDivElement;
  private readonly chatName: HTMLDivElement;
  private readonly chatLine: HTMLDivElement;
  private readonly chatHint: HTMLDivElement;
  private readonly chatAsk: HTMLButtonElement;
  /** 次のおしゃべりまで／今のおしゃべりを消すまで（秒） */
  private chatNext = 0;
  private chatLeft = 0;
  private chatStep = 0;
  /** 文字を流すタイマー */
  private typeTimer = 0;
  /** 1回の案内で、もう出した文（同じ文を2回出さない） */
  private readonly chatUsed = new Set<string>();
  /** 子どもが聞くのを待っている「Do you like ～?」 */
  private pendingLike: Like | null = null;
  /** 子どもが聞いてから、留学生が答えるまで */
  private likeTimer = 0;

  /** 行き先に着いたとき */
  onArrive?: (name: string, obj: SceneObject) => void;
  /** 行き先が決まった／取り消されたとき（null） */
  onRequest?: (name: string | null, obj: SceneObject | null) => void;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly hud: HTMLElement,
    private readonly speech: SpeechService,
  ) {
    this.meSay = document.createElement('div');
    this.meSay.className = 'me-say hidden';
    hud.appendChild(this.meSay);

    this.chat = document.createElement('div');
    this.chat.className = 'visitor-chat hidden';
    this.chat.setAttribute('aria-live', 'polite');
    this.chatName = document.createElement('div');
    this.chatName.className = 'visitor-chat__name';
    this.chatLine = document.createElement('div');
    this.chatLine.className = 'visitor-chat__line';
    this.chatHint = document.createElement('div');
    this.chatHint.className = 'visitor-chat__hint';
    this.chatAsk = document.createElement('button');
    this.chatAsk.className = 'kc-btn visitor-chat__ask';
    this.chat.append(this.chatName, this.chatLine, this.chatHint, this.chatAsk);
    hud.appendChild(this.chat);
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click']) this.chat.addEventListener(ev, (e) => e.stopPropagation());
    this.chatAsk.hidden = true;
  }

  /**
   * 観光地に入ったとき：スタート地点のまわりの、立てる場所に留学生を置く。
   * 毎回同じ並びにならないよう、名前は観光地ごとに順番を変える。
   */
  spawn(spotId: string, start: { x: number; y: number; z: number }, startYaw: number, objects: SceneObject[]): void {
    this.clear();
    this.objects = objects;
    this.spotId = spotId;
    // 観光地の名前から、誰が来るかを決める（同じ観光地ならいつも同じ3人）
    let h = 0;
    for (const c of spotId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    // スタートの正面の少し先に、横に並べる（正面＝ -sin(yaw), -cos(yaw)）
    const fx = -Math.sin(startYaw);
    const fz = -Math.cos(startYaw);
    const rx = -fz;
    const rz = fx;
    const offsets: [number, number][] = [
      [5, -3],
      [6, 0],
      [5, 3],
      [8, -5],
      [8, 5],
      [10, 0],
      [4, -1],
      [4, 1],
      [7, -2],
      [7, 2],
      [3, -4],
      [3, 4],
      [12, -3],
      [12, 3],
      [2, -2],
      [2, 2],
    ];
    let placed = 0;
    for (const [fwd, side] of offsets) {
      if (placed >= COUNT) break;
      const x = start.x + fx * fwd + rx * side;
      const z = start.z + fz * fwd + rz * side;
      const y = this.standY(x, start.y, z);
      if (y === null) continue;
      // 3つのグループから1人ずつ（男女は観光地ごとに入れかわる）
      const group = GROUPS[(placed + h) % GROUPS.length];
      const def = group[(h >>> (placed + 1)) % group.length];
      // ブロックのまん中に立たせる
      this.list.push(this.make(def, new THREE.Vector3(Math.floor(x) + 0.5, y, Math.floor(z) + 0.5), startYaw + Math.PI));
      placed++;
    }
  }

  /** 立てる高さ（足もとがかたいブロックで、体の2マスが空いている。水の中は×）。見つからなければ null */
  private standY(x: number, nearY: number, z: number): number | null {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    for (let y = Math.floor(nearY) + 3; y >= Math.floor(nearY) - 6; y--) {
      if (!this.world.isSolid(bx, y - 1, bz)) continue;
      if (this.world.getBlock(bx, y, bz) !== 0 || this.world.getBlock(bx, y + 1, bz) !== 0) continue;
      return y;
    }
    return null;
  }

  private make(def: VisitorDef, pos: THREE.Vector3, yaw: number): Visitor {
    const avatar = new Avatar(this.scene, def.look);
    avatar.setVisible(true);
    const bubble = document.createElement('div');
    bubble.className = 'visitor-bubble hidden';
    const line = document.createElement('span');
    line.className = 'visitor-bubble__line';
    const askBtn = document.createElement('button');
    askBtn.className = 'visitor-bubble__ask';
    askBtn.innerHTML = 'Where do you want to go? <kbd>A</kbd>';
    bubble.append(line, askBtn);
    this.hud.appendChild(bubble);
    const v: Visitor = { def, avatar, pos, yaw, homeYaw: yaw, idleTimer: 2 + Math.random() * 3, bubble, talking: false, line, askBtn, want: null, following: false, arrived: false, stuck: 0, walking: false, joy: 0, heartTimer: 0 };
    // ボタンを押しても、うしろの3Dの「タップで名所をえらぶ」が動かないようにする
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend']) askBtn.addEventListener(ev, (e) => e.stopPropagation());
    askBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.ask(v);
    });
    return v;
  }

  clear(): void {
    this.celebrating = null;
    for (const v of this.list) {
      v.avatar.setVisible(false);
      v.avatar.root.removeFromParent();
      v.bubble.remove();
    }
    this.list = [];
    this.meSay.classList.add('hidden');
    if (this.active) this.onRequest?.(null, null);
    this.active = null;
    this.answerTimer = 0;
    this.hideChat();
  }

  get count(): number {
    return this.list.length;
  }

  /** A キー：いちばん近くで話している留学生に聞く。聞けたら true */
  askNearest(): boolean {
    // 道案内の間の「Do you like ～?」が出ていれば、それを聞く
    const v = this.list.find((x) => x.talking && !x.askBtn.hidden);
    if (!v) return false;
    this.ask(v);
    return true;
  }

  /** 「Where do you want to go?」と聞く → 少しあとに留学生が答える */
  private ask(v: Visitor): void {
    if (this.answerTimer > 0) return;
    const me = 'Where do you want to go?';
    this.meSay.textContent = me;
    this.meSay.classList.remove('hidden');
    this.meTimer = 3.2;
    this.speech.speak(me, 'en');
    v.askBtn.hidden = true;
    this.active = v;
    // ほかの留学生の吹き出しは消す
    for (const o of this.list) {
      if (o !== v && o.talking) {
        o.talking = false;
        o.bubble.classList.add('hidden');
      }
    }
    // 「Where do you want to go?」を最後まで読み上げてから答える（早いと読み上げが途中で切れる）
    this.answerTimer = 3.2;
  }

  /**
   * キャラクターの少し後ろ（2マス）までついて歩く。段差は1マスまで上り下りできる。
   * 進めない・はなれすぎたときは、キャラクターのそばへすっと移す。行き先に着いたら止まる。
   */
  private follow(v: Visitor, player: THREE.Vector3, dt: number, d: number): void {
    v.walking = false;
    const want = v.want!;
    // 着いたか：キャラクターが名所の範囲のふちから4マス以内（高さは見ない）で、留学生もそばにいる。
    // 真ん中の点で測ると、天守のような大きな建物では奥に入れず着けなかったため、範囲のふちで測る（2026-11-14）
    if (Visitors.edgeDist(player, want) <= ARRIVE_DIST && d < 6) {
      v.following = false;
      v.arrived = true;
      v.yaw = Math.atan2(-(want.focus.x + 0.5 - v.pos.x), -(want.focus.z + 0.5 - v.pos.z));
      this.onArrive?.(v.def.name, want);
      return;
    }
    if (d > 2.2) {
      const dx = (player.x - v.pos.x) / d;
      const dz = (player.z - v.pos.z) / d;
      const speed = Math.min(6, 2.5 + (d - 2.2) * 1.2); // はなれるほど速く
      const step = Math.min(speed * dt, d - 2.2);
      const nx = v.pos.x + dx * step;
      const nz = v.pos.z + dz * step;
      const ny = this.standY(nx, v.pos.y, nz);
      if (ny !== null && Math.abs(ny - v.pos.y) <= 1.01) {
        v.pos.set(nx, ny, nz);
        v.walking = true;
        v.stuck = 0;
      } else {
        v.stuck += dt;
      }
      v.yaw = Math.atan2(-dx, -dz);
    } else {
      v.stuck = 0;
      v.yaw = Math.atan2(-(player.x - v.pos.x), -(player.z - v.pos.z));
    }
    // ひっかかって1秒、またははなれすぎ（10マス）→ キャラクターの少し後ろへ移す
    if (v.stuck > 1 || d > 10) {
      for (const [ox, oz] of [[0, 1.8], [1.5, 1.2], [-1.5, 1.2], [0, -1.8], [1.8, 0], [-1.8, 0]]) {
        const y = this.standY(player.x + ox, player.y, player.z + oz);
        if (y !== null) {
          v.pos.set(player.x + ox, y, player.z + oz);
          break;
        }
      }
      v.stuck = 0;
    }
  }

  /** ⭐をあげるとき（喜んだあと） */
  onThanks?: (name: string) => void;

  /** 紹介が終わったとき：留学生が喜び（ジャンプ・ハート）、お礼を言い、頼みごとをおしまいにする */
  finish(): void {
    const v = this.active;
    if (!v) return;
    const say = 'Thank you! I like it!';
    // よろこぶ時間（この間、カメラが顔の前へ寄る）。こちらを向いて、にっこり・ばんざい
    v.joy = JOY_TIME;
    v.avatar.setHappy(true);
    v.yaw = Math.atan2(-(this.lastPlayer.x - v.pos.x), -(this.lastPlayer.z - v.pos.z));
    this.celebrating = v;
    v.heartTimer = 0;
    v.line.textContent = say;
    v.askBtn.hidden = true;
    v.bubble.classList.remove('hidden');
    v.bubble.classList.remove('visitor-bubble--pop');
    void v.bubble.offsetWidth;
    v.bubble.classList.add('visitor-bubble--pop');
    v.talking = true; // はなれると吹き出しが消える
    this.speech.speak(say, 'en', undefined, v.def.pitch);
    v.want = null;
    v.following = false;
    v.arrived = false;
    v.homeYaw = v.yaw;
    this.active = null;
    this.hideChat();
    this.onRequest?.(null, null);
    this.onThanks?.(v.def.name);
  }

  /** 頭の上からハートを1つ、ふわっと出す（画面の上の飾り。数秒で消える） */
  private heart(v: Visitor, camera: THREE.Camera): void {
    this.tmp.set(v.pos.x + (Math.random() - 0.5) * 0.6, v.pos.y + 2.0, v.pos.z).project(camera);
    if (this.tmp.z > 1) return;
    const el = document.createElement('div');
    el.className = 'visitor-heart';
    el.textContent = '❤';
    el.style.left = `${((this.tmp.x + 1) / 2) * window.innerWidth}px`;
    el.style.top = `${((1 - this.tmp.y) / 2) * window.innerHeight}px`;
    el.style.setProperty('--drift', `${(Math.random() - 0.5) * 60}px`);
    this.hud.appendChild(el);
    window.setTimeout(() => el.remove(), 1400);
  }

  /** Map でその名所へ飛んだとき：案内中ならそこで「着いた」にする（留学生もそばへ移す） */
  jumpedTo(obj: SceneObject, player: THREE.Vector3): void {
    const v = this.active;
    if (!v || !v.following || v.want !== obj) return;
    for (const [ox, oz] of [[0, 1.8], [1.5, 1.2], [-1.5, 1.2], [0, -1.8], [1.8, 0], [-1.8, 0]]) {
      const y = this.standY(player.x + ox, player.y, player.z + oz);
      if (y !== null) {
        v.pos.set(player.x + ox, y, player.z + oz);
        break;
      }
    }
    v.following = false;
    v.arrived = true;
    v.yaw = Math.atan2(-(obj.focus.x + 0.5 - v.pos.x), -(obj.focus.z + 0.5 - v.pos.z));
    this.onArrive?.(v.def.name, obj);
  }

  /** 名所の範囲（region）のふちまでの、水平の距離（中にいれば 0） */
  static edgeDist(p: { x: number; z: number }, o: SceneObject): number {
    const r = o.region;
    const cx = Math.max(r.min.x, Math.min(p.x, r.max.x + 1));
    const cz = Math.max(r.min.z, Math.min(p.z, r.max.z + 1));
    return Math.hypot(p.x - cx, p.z - cz);
  }

  /** 行き先（案内中の名所）。矢印のため */
  get goal(): SceneObject | null {
    return this.active?.following ? this.active.want : null;
  }

  /** 留学生が行きたい所を答える（名所からランダム。前と同じ所はなるべく選ばない） */
  private answer(v: Visitor): void {
    if (this.objects.length === 0) return;
    const pool = this.objects.filter((o) => o !== v.want);
    const obj = pool[Math.floor(Math.random() * pool.length)] ?? this.objects[0];
    v.want = obj;
    const place = obj.name.replace(/^The /, 'the ');
    const say = `I want to go to ${place}.`;
    v.line.textContent = say;
    v.bubble.classList.remove('visitor-bubble--pop');
    void v.bubble.offsetWidth;
    v.bubble.classList.add('visitor-bubble--pop');
    this.speech.speak(say, 'en', undefined, v.def.pitch);
    v.following = true;
    v.arrived = false;
    this.onRequest?.(v.def.name, obj);
    // 道案内のおしゃべりを、はじめから
    this.chatUsed.clear();
    this.chatStep = 0;
    this.chatNext = CHAT_FIRST;
    this.hideChat();
  }

  // ===== 道案内の間のおしゃべり =====
  private hideChat(): void {
    window.clearInterval(this.typeTimer);
    // すっと消してから、かくす
    if (!this.chat.classList.contains('hidden') && !this.chat.classList.contains('visitor-chat--out')) {
      this.chat.classList.remove('visitor-chat--pop');
      this.chat.classList.add('visitor-chat--out');
      window.setTimeout(() => {
        if (this.chat.classList.contains('visitor-chat--out')) {
          this.chat.classList.add('hidden');
          this.chat.classList.remove('visitor-chat--out');
        }
      }, 200);
    }
    this.pendingLike = null;
    this.likeTimer = 0;
    this.chatLeft = 0;
  }

  /** まだ出していないものから1つえらぶ（全部出したら、また最初から） */
  private pick<T>(list: T[], key: (t: T) => string): T | null {
    if (list.length === 0) return null;
    let pool = list.filter((t) => !this.chatUsed.has(key(t)));
    if (pool.length === 0) {
      for (const t of list) this.chatUsed.delete(key(t));
      pool = list;
    }
    const t = pool[Math.floor(Math.random() * pool.length)];
    this.chatUsed.add(key(t));
    return t;
  }

  /** 文字を1文字ずつ流して出す（ゲームの会話ウィンドウ風） */
  private typeLine(text: string): void {
    window.clearInterval(this.typeTimer);
    const el = this.chatLine;
    if (!text || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = text;
      el.classList.remove('is-typing');
      return;
    }
    let n = 0;
    el.textContent = '';
    el.classList.add('is-typing');
    this.typeTimer = window.setInterval(() => {
      n += 1;
      el.textContent = text.slice(0, n);
      if (n >= text.length) {
        window.clearInterval(this.typeTimer);
        el.classList.remove('is-typing');
      }
    }, 35);
  }

  /** ウィンドウをはずませて出し、残り時間のバーを最初から */
  private popChat(seconds: number): void {
    this.chat.classList.remove('hidden', 'visitor-chat--out', 'visitor-chat--pop');
    this.chat.style.setProperty('--chat-show', `${seconds}s`);
    this.chat.classList.add('is-restart');
    void this.chat.offsetWidth;
    this.chat.classList.remove('is-restart');
    this.chat.classList.add('visitor-chat--pop');
    this.chatLeft = seconds;
  }

  /** カードを出す（留学生の文と、答えの例1文）。時間がたつと消える */
  private showChat(v: Visitor, line: string, hint: string[]): void {
    this.chatName.textContent = line ? v.def.name : `${v.def.name} ✨`;
    this.chatLine.hidden = !line;
    this.typeLine(line);
    // 答えの例は1文だけ（いくつかある時はランダムに1つ）
    const one = hint.length ? hint[Math.floor(Math.random() * hint.length)] : '';
    this.chatHint.innerHTML = one ? `<span class="chat-try">💬 Try!</span><b>${this.esc(one)}</b>` : '';
    this.chatHint.hidden = !one;
    this.chatAsk.hidden = true;
    this.chat.classList.remove('visitor-chat--ask');
    this.popChat(CHAT_SHOW);
    if (line) this.speech.speak(line, 'en', undefined, v.def.pitch);
  }

  /**
   * 次のおしゃべりを1つ出す（2026-11-22 先生の希望で2種類だけ）：
   *  - You can ～.（その観光地でできること。Try: に1文）
   *  - 案内する子どもが聞く Do you like ～?（Try: に1文）→ 4秒ほどで留学生が自動で答える
   * 交互に出す。答えるボタンも録音もなし。
   */
  private nextChat(v: Visitor): void {
    const spot = SPOT_CHATS[this.spotId];
    if (!spot) return;
    const kind = this.chatStep++ % 2 === 0 ? 'cando' : 'like';
    if (kind === 'cando' || spot.likes.length === 0) {
      const c = this.pick(spot.canDo, (t) => t);
      if (c) return this.showChat(v, '', [c]);
    }
    const l = this.pick(spot.likes, (t) => t.ask);
    if (l) {
      this.showChat(v, '', [l.ask]);
      this.pendingLike = l;
      this.likeTimer = 4;
    }
  }

  private esc(s: string): string {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
  }

  /** 毎フレーム：道案内の間だけ、おしゃべりを進める */
  private updateChat(dt: number, walkMode: boolean, walked: number): void {
    const v = this.active;
    const introOpen = document.body.classList.contains('kc-intro-open');
    if (!v || !v.following || !walkMode || introOpen) {
      if (!this.chat.classList.contains('hidden')) this.hideChat();
      return;
    }
    // Do you like ～? の少しあと、留学生が答える（カードに答えを足す）
    if (this.likeTimer > 0) {
      this.likeTimer -= dt;
      if (this.likeTimer <= 0 && this.pendingLike) {
        const ans = this.pendingLike.answer;
        this.pendingLike = null;
        this.chatName.textContent = v.def.name;
        this.chatLine.hidden = false;
        this.typeLine(ans);
        this.popChat(Math.max(this.chatLeft, 6));
        this.speech.speak(ans, 'en', undefined, v.def.pitch);
      }
    }
    if (this.chatLeft > 0) {
      this.chatLeft -= dt;
      if (this.chatLeft <= 0) this.hideChat();
    }
    // 時間ではなく、歩いた距離で数える
    this.chatNext -= walked;
    if (this.chatNext <= 0) {
      this.chatNext = CHAT_WALK;
      this.nextChat(v);
    }
  }

  /**
   * 毎フレーム呼ぶ。
   * @param player キャラクターの足もと
   * @param active 歩くモードか（空から見る・作るモードでは、あいさつしない）
   */
  /** よろこんでいる留学生の頭の位置・向き・のこり時間（カメラを寄せるため。いなければ null） */
  get closeup(): { head: THREE.Vector3; yaw: number; left: number } | null {
    const v = this.celebrating;
    if (!v || v.joy <= 0) return null;
    return { head: new THREE.Vector3(v.pos.x, v.pos.y + 1.45, v.pos.z), yaw: v.yaw, left: v.joy };
  }

  update(dt: number, player: THREE.Vector3, camera: THREE.Camera, active: boolean): void {
    // 前のフレームからの横方向の移動量（ワープなど大きすぎる動きは数えない）
    const dx = player.x - this.lastPlayer.x, dz = player.z - this.lastPlayer.z;
    let walked = Math.hypot(dx, dz);
    if (walked > SPRINT_SPEED * Math.max(dt, 0.05) * 2) walked = 0;
    this.lastPlayer.copy(player);
    if (this.answerTimer > 0) {
      this.answerTimer -= dt;
      if (this.answerTimer <= 0 && this.active) this.answer(this.active);
    }
    if (this.meTimer > 0) {
      this.meTimer -= dt;
      if (this.meTimer <= 0) this.meSay.classList.add('hidden');
    }
    this.updateChat(dt, active, walked);
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    for (const v of this.list) {
      const dx = player.x - v.pos.x;
      const dz = player.z - v.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      // 近ければこちらを向く。遠ければ、ときどきふと向きを変える
      if (v.joy > 0) {
        // よろこんでいる間は、こちら（カメラ）を向いたまま
      } else if (v.following && v.want) {
        this.follow(v, player, dt, d);
      } else if (active && d < LOOK_DIST) {
        v.yaw = Math.atan2(-dx, -dz);
      } else {
        v.idleTimer -= dt;
        if (v.idleTimer <= 0) {
          v.yaw = v.homeYaw + (Math.random() - 0.5) * 1.6;
          v.idleTimer = 3 + Math.random() * 4;
        }
      }
      // 喜んでいる間は、ぴょんぴょんジャンプして、ハートを出す
      let hop = 0;
      if (v.joy > 0) {
        v.joy -= dt;
        if (v.joy <= 0) {
          v.avatar.setHappy(false);
          if (this.celebrating === v) this.celebrating = null;
        }
        hop = Math.abs(Math.sin(v.joy * 7)) * 0.35;
        v.heartTimer -= dt;
        if (v.heartTimer <= 0) {
          this.heart(v, camera);
          v.heartTimer = 0.28;
        }
      }
      this.tmp.copy(v.pos);
      this.tmp.y += hop;
      v.avatar.update(this.tmp, v.yaw, v.walking, dt, v.pos.y);

      // あいさつ（すぐそばに来たとき1回。はなれると、また言えるようになる）
      // ついてきている間は吹き出しを出さない（ずっとそばにいるので、画面がうるさくなるため）
      // 案内している間（ミッション中）は、ほかの留学生はあいさつしない（2026-11-14 先生の希望）
      const near = active && d < TALK_DIST && !v.following && (this.active === null || this.active === v);
      if (near && !v.talking) {
        v.talking = true;
        // 行き先がもう決まっていれば、それをもう一度言う
        const line = v.want ? `I want to go to ${v.want.name.replace(/^The /, 'the ')}.` : `Hello! I'm ${v.def.name}.`;
        v.line.textContent = line;
        // ほかの人に頼まれている間は、聞くボタンを出さない
        v.askBtn.hidden = !!v.want || (this.active !== null && this.active !== v);
        v.bubble.classList.remove('hidden');
        v.bubble.classList.remove('visitor-bubble--pop');
        void v.bubble.offsetWidth; // ぽんと出る動きを毎回やり直す
        v.bubble.classList.add('visitor-bubble--pop');
        this.speech.speak(line, 'en', undefined, v.def.pitch);
      } else if (!near && v.talking && d > TALK_DIST + 1.5) {
        v.talking = false;
        v.bubble.classList.add('hidden');
      }

      // 吹き出しを頭の上に置く（画面の外・カメラのうしろなら出さない）
      if (v.talking) {
        this.tmp.set(v.pos.x, v.pos.y + 2.25, v.pos.z).project(camera);
        const onScreen = this.tmp.z < 1 && Math.abs(this.tmp.x) < 1.1 && Math.abs(this.tmp.y) < 1.1;
        v.bubble.style.visibility = onScreen ? 'visible' : 'hidden';
        v.bubble.style.left = `${((this.tmp.x + 1) / 2) * w}px`;
        v.bubble.style.top = `${((1 - this.tmp.y) / 2) * hgt}px`;
      }
    }
  }
}
