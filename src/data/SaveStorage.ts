/**
 * 子どもの作品（ブロック・付け足し文・写真・声）を読み書きする窓口。
 *
 * - GAS で動いているとき：大学の Google（gas/Code.js の loadSave / saveItems）に、
 *   子どもの番号（例：5A12）ごとに保存する。
 *   iPad の Safari は GAS のページの中の保存（localStorage）を、Safari を閉じると消してしまうため。
 *   読み込んだ中身は画面の中（メモリ）に持ち、変えた分だけを少し待ってまとめて送る。
 *   自分の作品を開く・保存するには、番号ごとの合言葉（数字4けた）がいる。
 *   友だちの番号で開いたときは「見るだけ」（書きかえない）。
 * - それ以外（手元・GitHub 版）：今までどおり端末の localStorage を使う。
 */

/** 保存に入れるキーの頭（ブロック・付け足し文・写真・声） */
const WORK_PREFIXES = ['kc.edits.', 'kc.guide.', 'kc.photo.', 'kc.audio.'];

/** 1つの値の上限（声のファイルなど。大きすぎると Google へ送れない） */
const MAX_ITEM_CHARS = 2_000_000;

/** 変えてから送るまで待つ時間（続けてブロックを置くとき、1回にまとめて送るため） */
const SEND_DELAY_MS = 2500;
/** 送れなかったとき、もう一度送るまでの時間 */
const RETRY_MS = 10000;

type Items = Record<string, string>;
type Changes = Record<string, string | null>;
type SaveResult = { ok: boolean; reason?: string };
type OpenResult = { ok: boolean; reason?: string; items?: Items };

interface Server {
  hasPin(id: string): Promise<boolean>;
  setPin(id: string, pin: string): Promise<SaveResult>;
  openMine(id: string, pin: string): Promise<OpenResult>;
  loadSave(id: string): Promise<Items>;
  saveItems(id: string, pin: string, changes: Changes): Promise<SaveResult>;
}

interface GasRunner {
  withSuccessHandler(fn: (result: unknown) => void): GasRunner;
  withFailureHandler(fn: (error: unknown) => void): GasRunner;
  hasPin(id: string): void;
  setPin(id: string, pin: string): void;
  openMine(id: string, pin: string): void;
  loadSave(id: string): void;
  saveItems(id: string, pin: string, changes: Changes): void;
}

declare const google: { script?: { run?: GasRunner } } | undefined;

function gasServer(): Server | null {
  const run = typeof google !== 'undefined' && google?.script?.run ? google.script.run : null;
  if (!run) return null;
  const call = <T>(fn: (r: GasRunner) => void): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      fn(run.withSuccessHandler((v) => resolve(v as T)).withFailureHandler(reject));
    });
  return {
    hasPin: (id) => call<boolean>((r) => r.hasPin(id)),
    setPin: (id, pin) => call<SaveResult>((r) => r.setPin(id, pin)),
    openMine: (id, pin) => call<OpenResult>((r) => r.openMine(id, pin)),
    loadSave: (id) => call<Items>((r) => r.loadSave(id)),
    saveItems: (id, pin, changes) => call<SaveResult>((r) => r.saveItems(id, pin, changes)),
  };
}

/**
 * 手元で確かめるための「にせの Google」（開発中、URL に ?cloud=fake を付けたときだけ）。
 * 公開版には入らない。
 */
function fakeServer(): Server | null {
  const env = (import.meta as { env?: { DEV?: boolean } }).env;
  if (!env?.DEV || !location.search.includes('cloud=fake')) return null;
  const wait = () => new Promise((r) => setTimeout(r, 300));
  const key = (id: string) => `kcfake.${id}`;
  const pinKey = (id: string) => `kcfake.pin.${id}`;
  const pinOk = (id: string, pin: string) => localStorage.getItem(pinKey(id)) === pin;
  const fake: Server = {
    async hasPin(id) {
      await wait();
      return localStorage.getItem(pinKey(id)) !== null;
    },
    async setPin(id, pin) {
      await wait();
      if (localStorage.getItem(pinKey(id)) !== null) return { ok: false, reason: 'taken' };
      localStorage.setItem(pinKey(id), pin);
      return { ok: true };
    },
    async openMine(id, pin) {
      if (!(await fake.hasPin(id))) return { ok: false, reason: 'none' };
      if (!pinOk(id, pin)) return { ok: false, reason: 'wrong' };
      return { ok: true, items: await fake.loadSave(id) };
    },
    async loadSave(id) {
      await wait();
      return JSON.parse(localStorage.getItem(key(id)) ?? '{}') as Items;
    },
    async saveItems(id, pin, changes) {
      await wait();
      if (!pinOk(id, pin)) return { ok: false, reason: 'pin' };
      const items = JSON.parse(localStorage.getItem(key(id)) ?? '{}') as Items;
      for (const [k, v] of Object.entries(changes)) {
        if (v === null) delete items[k];
        else items[k] = v;
      }
      localStorage.setItem(key(id), JSON.stringify(items));
      return { ok: true };
    },
  };
  return fake;
}

const server: Server | null = gasServer() ?? fakeServer();

/** 自分の作品（番号を入れたあとに読み込む） */
let mine: Map<string, string> | null = null;
let ownerId: string | null = null;
/** 自分の合言葉（保存するたびに Google で確かめる。端末には残さない） */
let ownerPin = '';
/** 友だちの作品（見るだけ）。null なら自分の作品を見ている */
let friend: Map<string, string> | null = null;
let friendId: string | null = null;

/** まだ送っていない変更（null は「消した」） */
const pending = new Map<string, string | null>();
let timer = 0;
let sending = false;

function isWork(key: string): boolean {
  return WORK_PREFIXES.some((p) => key.startsWith(p));
}

function current(): Map<string, string> | null {
  return friend ?? mine;
}

function schedule(ms = SEND_DELAY_MS): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void SaveStorage.flush(), ms);
}

function toMap(items: Items | undefined): Map<string, string> {
  return new Map(Object.entries(items ?? {}).filter(([k, v]) => isWork(k) && typeof v === 'string'));
}

async function load(id: string): Promise<Map<string, string>> {
  return toMap(await server!.loadSave(id));
}

export const SaveStorage = {
  /** 大学の Google に保存するか（GAS で動いているとき true） */
  cloud: server !== null,

  /** 送れなかったとき（ネットが切れているなど）に呼ぶ */
  onError: undefined as ((message: string) => void) | undefined,

  /** 自分の番号（まだ入れていなければ null） */
  get owner(): string | null {
    return ownerId;
  },
  /** 見ている友だちの番号（自分の作品を見ているときは null） */
  get viewing(): string | null {
    return friendId;
  },
  /** 見るだけか（友だちの作品を見ているとき true） */
  get readOnly(): boolean {
    return friend !== null;
  },

  /**
   * 入力された番号を「5A12」の形にそろえる。正しくなければ null。
   * 全角・小文字・すき間・0 から始まる番号（5A01）も受け付ける。
   */
  normalizeId(raw: string): string | null {
    const s = raw
      .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/[\s\-ー－組年番]/g, '')
      .toUpperCase();
    const m = s.match(/^([1-6])([A-Z])(\d{1,2})$/);
    if (!m) return null;
    const no = Number(m[3]);
    if (no < 1) return null;
    return `${m[1]}${m[2]}${no}`;
  },

  /** 合言葉（数字4けた）の形にそろえる。正しくなければ null。全角の数字も受け付ける */
  normalizePin(raw: string): string | null {
    const s = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\s/g, '');
    return /^[0-9]{4}$/.test(s) ? s : null;
  },

  /** その番号の合言葉が、もう決まっているか */
  async hasPin(id: string): Promise<boolean> {
    if (!server) return false;
    return server.hasPin(id);
  },

  /** 合言葉を決める（まだ決まっていないときだけ）。ほかの子が先に決めていたら Error('taken') */
  async makePin(id: string, pin: string): Promise<void> {
    if (!server) return;
    const res = await server.setPin(id, pin);
    if (!res?.ok) throw new Error(res?.reason ?? 'bad');
  },

  /**
   * 自分の番号と合言葉で作品を読み込む（それまでの自分の作品は、先に送り終えておく）。
   * 合言葉がちがうときは Error('wrong')、まちがいが続いたときは Error('locked')。
   */
  async openMine(id: string, pin: string): Promise<void> {
    if (!server) return;
    await this.flush();
    if (pending.size > 0) throw new Error('not-saved');
    const res = await server.openMine(id, pin);
    if (!res?.ok) throw new Error(res?.reason ?? 'wrong');
    mine = toMap(res.items);
    ownerId = id;
    ownerPin = pin;
    friend = null;
    friendId = null;
  },

  /** 友だちの作品を「見るだけ」で読み込む */
  async openFriend(id: string): Promise<void> {
    if (!server) return;
    await this.flush();
    friend = await load(id);
    friendId = id;
  },

  /** 友だちの作品を見るのをやめて、自分の作品に戻る（自分の番号をまだ開いていなければ、何も見ていない状態に） */
  backToMine(): void {
    friend = null;
    friendId = null;
  },

  get(key: string): string | null {
    const m = server ? current() : null;
    if (server) return m?.get(key) ?? null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  /** 保存できたら true（見るだけのとき・大きすぎるとき・端末がいっぱいのときは false） */
  set(key: string, value: string): boolean {
    if (server) {
      if (!mine || friend || value.length > MAX_ITEM_CHARS) return false;
      mine.set(key, value);
      pending.set(key, value);
      schedule();
      return true;
    }
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  remove(key: string): void {
    if (server) {
      if (!mine || friend) return;
      mine.delete(key);
      pending.set(key, null);
      schedule();
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch {
      // 無視
    }
  },

  /** その頭で始まるキーの一覧 */
  keys(prefix: string): string[] {
    if (server) return [...(current()?.keys() ?? [])].filter((k) => k.startsWith(prefix));
    const out: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(prefix)) out.push(k);
      }
    } catch {
      // 無視
    }
    return out;
  },

  /** まだ送っていない変更があるか */
  get unsaved(): boolean {
    return pending.size > 0 || sending;
  },

  /** まだ送っていない変更を、今すぐ Google へ送る */
  async flush(): Promise<void> {
    window.clearTimeout(timer);
    if (!server || !ownerId || sending || pending.size === 0) return;
    const id = ownerId;
    const pin = ownerPin;
    const batch: Changes = Object.fromEntries(pending);
    pending.clear();
    sending = true;
    try {
      const res = await server.saveItems(id, pin, batch);
      if (!res?.ok) {
        // 大きすぎた・合言葉が通らなかった：送り直しても入らないので、知らせて終わる
        this.onError?.(res?.reason === 'pin' ? 'pin' : 'too-big');
      }
    } catch {
      // 送れなかった分は、あとからの変更を優先しつつ戻しておき、少し待って送り直す
      for (const [k, v] of Object.entries(batch)) if (!pending.has(k)) pending.set(k, v);
      this.onError?.('offline');
      schedule(RETRY_MS);
    } finally {
      sending = false;
      if (pending.size > 0 && ownerId === id) schedule();
    }
  },
};

// 画面を閉じる・ほかのアプリへ移るときは、待たずにすぐ送る
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void SaveStorage.flush();
});
