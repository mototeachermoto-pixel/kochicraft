/**
 * 番号（例：5A12）と合言葉（数字4けた）を入れる小さな画面。GAS 版（大学の Google に保存する版）だけで使う。
 * - me     ＝自分の番号を入れて、自分の作品を開く（最初に必ず出る）
 *            番号のあとに合言葉を聞く。はじめての番号なら、合言葉を決めてもらう（2回入れる）。
 *            合言葉が分からないときは「Just look」で見るだけにできる。
 * - friend ＝友だちの番号を入れて、友だちの作品を「見るだけ」で開く
 * 英語は小5レベル。番号・合言葉の書き方だけは日本語でも添える。
 */
export type NumberMode = 'me' | 'friend';

/** 番号の画面から呼ぶ処理。失敗したら Error を投げる（message は画面に出す英文） */
export interface NumberActions {
  /** 入力を「5A12」の形にそろえる（正しくなければ null） */
  normalize(raw: string): string | null;
  /** 入力を4けたの数字にそろえる（正しくなければ null） */
  normalizePin(raw: string): string | null;
  /** その番号の合言葉：new＝まだ決まっていない／set＝決まっている／same＝もう自分の作品として開いている */
  check(id: string): Promise<'new' | 'set' | 'same'>;
  /** 合言葉を決める */
  makePin(id: string, pin: string): Promise<void>;
  /** 合言葉で自分の作品を開く */
  start(id: string, pin: string): Promise<void>;
  /** 見るだけで開く */
  look(id: string): Promise<void>;
}

type Step = 'number' | 'pin' | 'newPin' | 'newPin2';

export class NumberPanel {
  private readonly root: HTMLElement;
  private mode: NumberMode = 'me';
  private step: Step = 'number';
  private canCancel = true;
  private id = '';
  /** 合言葉を決めるとき、1回目に入れたもの */
  private firstPin = '';
  private busy = false;

  constructor(
    parent: HTMLElement,
    private readonly actions: NumberActions,
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
    this.canCancel = canCancel;
    this.render('number', prefill);
  }

  close(): void {
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
  }

  private render(step: Step, prefill = '', msg = ''): void {
    this.step = step;
    this.busy = false;
    this.root.classList.remove('is-busy');
    const isNumber = step === 'number';
    const me = this.mode === 'me';
    const title = {
      number: me ? 'What is your number?' : 'Whose world do you want to see?',
      pin: `${this.id}: Your secret number`,
      newPin: `${this.id}: Make a secret number`,
      newPin2: 'One more time, please.',
    }[step];
    const sub = {
      number: 'Example: <b>5A12</b>　<span class="num-panel__ja">（5年A組12番 → 5A12）</span>',
      pin: '4 numbers　<span class="num-panel__ja">（あいことば・数字4けた）</span>',
      newPin:
        '4 numbers. Do not tell your friends.<br><span class="num-panel__ja">（あいことばを決めよう。数字4けた。友だちに教えないでね）</span>',
      newPin2: 'Write the same 4 numbers.　<span class="num-panel__ja">（もう一度）</span>',
    }[step];
    const okLabel = {
      number: me ? '▶ Next' : '👀 Look',
      pin: '▶ Start',
      newPin: '▶ Next',
      newPin2: '▶ Start',
    }[step];
    const input = isNumber
      ? `<input class="num-panel__input" type="text" maxlength="8" placeholder="5A12"
          autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" />`
      : `<input class="num-panel__input num-panel__input--pin" type="password" maxlength="4"
          inputmode="numeric" pattern="[0-9]*" autocomplete="off" />`;
    const cancel = isNumber
      ? this.canCancel
        ? '<button class="kc-btn num-panel__cancel" data-role="cancel">Cancel</button>'
        : ''
      : '<button class="kc-btn num-panel__cancel" data-role="back">← Back</button>';
    const note =
      step === 'pin'
        ? `<button class="kc-btn num-panel__look" data-role="look">👀 Just look</button>
           <div class="num-panel__note">Forgot it? Ask your teacher.　（わすれたら先生へ）</div>`
        : !me
          ? '<div class="num-panel__note">You can only look. You can not change it.</div>'
          : '';
    this.root.innerHTML = `
      <div class="num-panel__box" role="dialog" aria-modal="true">
        <div class="num-panel__title">${title}</div>
        <div class="num-panel__sub">${sub}</div>
        ${input}
        <div class="num-panel__msg" role="alert"></div>
        <div class="num-panel__row">
          <button class="kc-btn num-panel__ok" data-role="ok">${okLabel}</button>
          ${cancel}
        </div>
        ${note}
      </div>`;
    const el = this.root.querySelector<HTMLInputElement>('.num-panel__input')!;
    el.value = prefill;
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        void this.ok();
      } else if (e.key === 'Escape' && this.canCancel && isNumber) {
        this.close();
      }
    });
    this.root.querySelector('[data-role="ok"]')!.addEventListener('click', () => void this.ok());
    this.root.querySelector('[data-role="cancel"]')?.addEventListener('click', () => this.close());
    this.root.querySelector('[data-role="back"]')?.addEventListener('click', () => this.render('number', this.id));
    this.root.querySelector('[data-role="look"]')?.addEventListener('click', () =>
      void this.run(() => this.actions.look(this.id)),
    );
    this.root.classList.remove('hidden');
    if (msg) this.say(msg);
    // 一覧のカードにフォーカスが移ったあとで、入力欄にフォーカスを当てる
    setTimeout(() => el.focus(), 60);
  }

  private say(msg: string): void {
    const el = this.root.querySelector('.num-panel__msg');
    if (el) el.textContent = msg;
  }

  /** 待つ処理を1つ動かす。うまくいけば閉じ（close=false なら閉じない）、失敗したら英文を出す */
  private async run(task: () => Promise<void>, close = true): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    this.root.classList.add('is-busy');
    this.say('Please wait…');
    try {
      await task();
      if (close) this.close();
      return true;
    } catch (err) {
      this.say(err instanceof Error && err.message ? err.message : 'Could not open. Please try again.');
      this.root.querySelector<HTMLInputElement>('.num-panel__input')?.focus();
      return false;
    } finally {
      this.busy = false;
      this.root.classList.remove('is-busy');
    }
  }

  private async ok(): Promise<void> {
    if (this.busy) return;
    const input = this.root.querySelector<HTMLInputElement>('.num-panel__input');
    if (!input) return;

    if (this.step === 'number') {
      const id = this.actions.normalize(input.value);
      if (!id) {
        this.say('Write like 5A12.');
        input.focus();
        return;
      }
      input.value = id;
      this.id = id;
      if (this.mode === 'friend') {
        await this.run(() => this.actions.look(id));
        return;
      }
      // 自分の番号：合言葉が決まっているかを聞いてから、次の画面へ
      let state = 'set' as 'new' | 'set' | 'same';
      const checked = await this.run(async () => {
        state = await this.actions.check(id);
      }, false);
      if (!checked) return;
      if (state === 'same') this.close();
      else this.render(state === 'new' ? 'newPin' : 'pin');
      return;
    }

    const pin = this.actions.normalizePin(input.value);
    if (!pin) {
      this.say('Write 4 numbers.');
      input.value = '';
      input.focus();
      return;
    }
    if (this.step === 'newPin') {
      this.firstPin = pin;
      this.render('newPin2');
    } else if (this.step === 'newPin2') {
      if (pin !== this.firstPin) {
        this.render('newPin', '', 'Not the same. Make it again.');
        return;
      }
      await this.run(async () => {
        await this.actions.makePin(this.id, pin);
        await this.actions.start(this.id, pin);
      });
    } else {
      const done = await this.run(() => this.actions.start(this.id, pin));
      if (!done) input.value = '';
    }
  }

}
