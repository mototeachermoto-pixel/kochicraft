/**
 * Google Apps Script（GAS）で動いているときだけ使う、同梱写真の受け取り口。
 * GAS は写真のファイルを置けないため、npm run build:gas で観光地ごとのファイルに詰め、
 * サーバー側の getPhotos() が dataURL にして返す（gas/Code.js）。
 * GAS のサーバーは頼むたびに数秒かかるので、観光地に入った時点で
 * その観光地の写真を1回でまとめて取り寄せておく（prefetchGasPhotos）。
 * GAS 以外（GitHub Pages・手元）では今までどおり './photos/...' をそのまま読む。
 */
interface GasRunner {
  withSuccessHandler(fn: (result: Record<string, string>) => void): GasRunner;
  withFailureHandler(fn: (error: unknown) => void): GasRunner;
  getPhotos(paths: string[]): void;
}

declare const google: { script?: { run?: GasRunner } } | undefined;

const runner: GasRunner | null =
  typeof google !== 'undefined' && google?.script?.run ? google.script.run : null;

const cache = new Map<string, Promise<string>>();

/** この写真を GAS から受け取る必要があるか */
export function isGasPhoto(src: string | undefined): src is string {
  return runner !== null && !!src && src.startsWith('./photos/');
}

/** 写真をまとめて1回で取り寄せ、それぞれの受け取り待ちを覚えておく */
export function prefetchGasPhotos(srcs: (string | undefined)[]): void {
  const todo = [...new Set(srcs.filter(isGasPhoto))].filter((s) => !cache.has(s));
  if (todo.length === 0) return;
  const batch = new Promise<Record<string, string>>((resolve, reject) => {
    runner!.withSuccessHandler(resolve).withFailureHandler(reject).getPhotos(todo.map((s) => s.slice(2)));
  });
  for (const src of todo) {
    const p = batch.then((photos) => {
      const url = photos[src.slice(2)];
      if (!url) throw new Error(`写真が届きませんでした: ${src}`);
      return url;
    });
    cache.set(src, p);
    // 失敗したら覚えず、次に頼まれたときにもう一度取り寄せる
    p.catch(() => cache.delete(src));
  }
}

/** GAS から写真（dataURL）を受け取る。先読み済みならそれを待つだけ */
export function loadGasPhoto(src: string): Promise<string> {
  if (!cache.has(src)) prefetchGasPhotos([src]);
  return cache.get(src)!;
}
