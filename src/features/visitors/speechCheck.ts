/**
 * 紹介タイムの「言えたかな？」チェック（2026-11-14 先生の希望。甘めの判定）。
 * ブラウザの音声認識（iPad の Safari・Edge など。Apple / Microsoft のサーバーで聞き取る）で、
 * 子どもの英語を文字にし、お手本の大事な言葉がどれくらい入っているかでくらべる。
 */

/** 判定に使わない、小さな言葉（どの文にも出てくるもの） */
const SMALL = new Set([
  'this', 'is', 'you', 'can', 'the', 'a', 'an', 'to', 'of', 'and', 'it', 'at', 'in', 'here', 'on', 'there', 'are', 'its',
]);

/** 文を、小文字の言葉の並びにする */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/'s$/, '').replace(/'/g, ''))
    .filter(Boolean);
}

/** お手本の中の「大事な言葉」（名所の名前・動きの言葉など） */
export function keyWords(target: string): string[] {
  return [...new Set(words(target).filter((w) => !SMALL.has(w) && w.length >= 2))];
}

/** 2つの言葉が近いか（同じ・前の4文字が同じ・1文字ちがい まで） */
export function close(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4)) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 4) return false;
  // 1文字ちがい（入れかえ・足りない・多い）
  let i = 0;
  let j = 0;
  let diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++diff > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}

export interface CheckResult {
  ok: boolean;
  /** 聞き取れた大事な言葉の割合（0〜1） */
  score: number;
  /** 聞き取れた大事な言葉 */
  hit: string[];
  /** 聞き取れなかった大事な言葉 */
  miss: string[];
}

/**
 * 聞き取った文（いくつかの候補）と、お手本をくらべる。
 * かなり甘めの判定（2026-11-15 先生の希望）：大事な言葉の 30% 以上が聞き取れたら合格（最低1つ）。
 */
export function check(heard: string[], target: string, pass = 0.3): CheckResult {
  const keys = keyWords(target);
  let best: CheckResult = { ok: false, score: 0, hit: [], miss: keys };
  for (const h of heard) {
    const hw = words(h);
    const hit = keys.filter((k) => hw.some((w) => close(w, k)));
    const score = keys.length ? hit.length / keys.length : 0;
    if (score > best.score) best = { ok: false, score, hit, miss: keys.filter((k) => !hit.includes(k)) };
  }
  best.ok = best.hit.length >= 1 && best.score >= pass;
  return best;
}

/** この端末で音声認識が使えるか */
type RecCtor = new () => SpeechRecognitionLike;
export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export function recognitionCtor(): RecCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
