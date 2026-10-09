/**
 * 番号（例：5A12）を入れる小さな画面。GAS 版（大学の Google に保存する版）だけで使う。
 * - me     ＝自分の番号を入れて、自分の作品を開く（最初に必ず出る）
 * - friend ＝友だちの番号を入れて、友だちの作品を「見るだけ」で開く
 * 英語は小5レベル。番号の書き方だけは日本語でも添える。
 */
export type NumberMode = 'me' | 'friend';

export class NumberPanel {
  private readonly root: HTMLElement;
  private mode: NumberMode = 'me';
  private busy = false;

  constructor(
    parent: HTMLElement,
    /** 入力を「5A12」の形にそろえる（正しくなければ null） */
    private readonly normalize: (raw: string) => string | null,
    /** 番号が決まったら呼ぶ。失敗したら Error を投げる（message は画面に出す英文） */
    private readonly submit: (id: string, mode: NumberMode) => Promise<void>,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'num-panel hidden';
    parent.appendChild(this.root);
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  /** 開く。canCancel=false のときは、番号を入れるまで閉じられない（最初の1回） */
  open(mode: NumberMode, prefill = '', canCancel = true): void {
    this.mode = mode;
    this.busy = false;
    const me = mode === 'me';
    this.root.innerHTML = `
      <div class="num-panel__box" role="dialog" aria-modal="true">
        <div class="num-panel__title">${me ? 'What is your number?' : "Whose world do you want to see?"}</div>
        <div class="num-panel__sub">Example: <b>5A12</b>　<span class="num-panel__ja">（5年A組12番 → 5A12）</span></div>
        <input class="num-panel__input" type="text" maxlength="8" placeholder="5A12"
          autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" />
        <div class="num-panel__msg" role="alert"></div>
        <div class="num-panel__row">
          <button class="kc-btn num-panel__ok" data-role="ok">${me ? '▶ Start' : '👀 Look'}</button>
          ${canCancel ? '<button class="kc-btn num-panel__cancel" data-role="cancel">Cancel</button>' : ''}
        </div>
        ${me ? '' : '<div class="num-panel__note">You can only look. You can not change it.</div>'}
      </div>`;
    const input = this.root.querySelector<HTMLInputElement>('.num-panel__input')!;
    input.value = prefill;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        void this.ok();
      } else if (e.key === 'Escape' && canCancel) {
        this.close();
      }
    });
    this.root.querySelector('[data-role="ok"]')!.addEventListener('click', () => void this.ok());
    this.root.querySelector('[data-role="cancel"]')?.addEventListener('click', () => this.close());
    this.root.classList.remove('hidden');
    // 一覧のカードにフォーカスが移ったあとで、入力欄にフォーカスを当てる
    setTimeout(() => input.focus(), 60);
  }

  close(): void {
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
  }

  private say(msg: string): void {
    const el = this.root.querySelector('.num-panel__msg');
    if (el) el.textContent = msg;
  }

  private async ok(): Promise<void> {
    if (this.busy) return;
    const input = this.root.querySelector<HTMLInputElement>('.num-panel__input');
    if (!input) return;
    const id = this.normalize(input.value);
    if (!id) {
      this.say('Write like 5A12.');
      input.focus();
      return;
    }
    input.value = id;
    this.busy = true;
    this.root.classList.add('is-busy');
    this.say('Opening… Please wait.');
    try {
      await this.submit(id, this.mode);
      this.close();
    } catch (err) {
      this.say(err instanceof Error && err.message ? err.message : 'Could not open. Please try again.');
    } finally {
      this.busy = false;
      this.root.classList.remove('is-busy');
    }
  }
}
