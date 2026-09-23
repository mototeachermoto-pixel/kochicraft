/**
 * 軽量な型付きイベントバス。
 * モジュール間を疎結合に保つための仕組み（将来のNPC/マルチプレイ等の拡張に備える）。
 *
 * 使い方:
 *   const off = bus.on('day:changed', (isDay) => { ... });
 *   bus.emit('day:changed', true);
 *   off(); // 解除
 */

/** アプリ全体で流れるイベントの定義（キー: ペイロード型） */
export interface AppEvents {
  /** 昼夜が切り替わった（true=昼） */
  'day:changed': boolean;
  /** ポインタロック状態が変わった（true=ロック中＝操作中） */
  'pointerlock:changed': boolean;
  /** ワールド生成が完了した */
  'world:ready': void;
  /** 観光地・クイズなどのデータが変化した（UIの再描画用） */
  'data:changed': void;
  /** タイトル画面から「あそぶ」に入った */
  'app:enter': void;
  /** 1ブロック以上の編集が行われた（操作フィードバック用） */
  'edit:done': void;
}

type Handler<T> = (payload: T) => void;
// 内部保持用（ペイロード型は emit/on の境界で安全に扱う）
type AnyHandler = (payload: unknown) => void;

export class EventBus {
  private handlers = new Map<keyof AppEvents, Set<AnyHandler>>();

  /** イベントを購読する。戻り値の関数を呼ぶと解除できる。 */
  on<K extends keyof AppEvents>(event: K, handler: Handler<AppEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set<AnyHandler>();
      this.handlers.set(event, set);
    }
    set.add(handler as AnyHandler);
    return () => this.off(event, handler);
  }

  /** 購読を解除する。 */
  off<K extends keyof AppEvents>(event: K, handler: Handler<AppEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as AnyHandler);
  }

  /** イベントを発火する。 */
  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of set) {
      try {
        h(payload as unknown);
      } catch (err) {
        // 1つのハンドラのエラーで全体を止めない
        console.error(`[EventBus] handler error on "${String(event)}":`, err);
      }
    }
  }
}

/** アプリ共有のシングルトンバス */
export const bus = new EventBus();
