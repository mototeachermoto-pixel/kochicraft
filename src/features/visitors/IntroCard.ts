import type { SceneObject } from '@/spots/SpotDefinition';
import type { SpeechService } from '@/features/language/SpeechService';
import { isGasPhoto, loadGasPhoto } from '@/data/GasPhotos';
import { check, close, words, recognitionCtor, type SpeechRecognitionLike } from './speechCheck';

/**
 * 留学生ゲーム ステップ4「紹介タイム」。名所に着いたら、画面の下にカードを出す。
 *  - 名所の写真と、言う英文「This is ～.」「You can ～.」（You can は案内モードと同じ文）。
 *  - 🔊 Listen（E）：お手本を聞く。
 *  - 🗣 Speak!（R）：話すと、ブラウザの音声認識で聞き取り、お手本の大事な言葉とくらべる（甘めの判定。speechCheck.ts）。
 *    合格 → 「Great!」→ 紹介おしまい（onDone）。だめ → 「Try again!」と聞き取れた文を見せる。
 *  - ✅ I said it!（Enter）：音声認識が使えない端末・聞き取りがうまく動かないとき・2回ためして通らなかったときだけ出す
 *    （できない子が先に進めなくならないように）。
 * 音声認識は、iPad の Safari・Edge などが Apple / Microsoft のサーバーで聞き取る（2026-11-14 先生が了承）。
 * 公開版（GAS）はページが Google の枠の中で動き、その枠はマイクを使わせない（2026-11-14 判明）。
 * そこで公開版と音声認識がない端末では、入力らん＋端末のキーボードの🎤（音声入力）で話してもらい、
 * 文字になった英文を同じ甘めの判定でくらべる（キーで打ってもよい）。
 */
/** Google の枠の中（公開版）か。枠がマイクを止めているので、ページからは聞き取れない */
const IN_GAS = (() => {
  const g = (window as unknown as { google?: { script?: { run?: unknown } } }).google;
  if (g?.script?.run) return true;
  // 手元で確かめる用：開発中だけ、URL に ?mic=off を付けると公開版と同じ入力らん方式になる
  const env = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
  return !!env?.DEV && location.search.includes('mic=off');
})();

export class IntroCard {
  private readonly el: HTMLDivElement;
  private obj: SceneObject | null = null;
  private lines: string[] = [];
  private rec: SpeechRecognitionLike | null = null;
  private tries = 0;
  private finishing = false;
  /** 今の段（0＝① 聞く、1＝② 言う、2＝③ チェック） */
  private stage = 0;
  private done = [false, false, false];
  private listenTimer = 0;

  onDone?: () => void;

  constructor(
    hud: HTMLElement,
    private readonly speech: SpeechService,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'intro-card hidden';
    hud.appendChild(this.el);
    // カードを押しても、うしろの3Dのタップ選択が動かないようにする
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click']) {
      this.el.addEventListener(ev, (e) => e.stopPropagation());
    }
  }

  get isOpen(): boolean {
    return !this.el.classList.contains('hidden');
  }

  private get canListen(): boolean {
    return !IN_GAS && !this.typeMode && recognitionCtor() !== null;
  }

  /** ページから聞き取れないとわかったとき（マイクが止められている）に true。入力らん方式に切りかえる */
  private typeMode = false;
  /** 入力らんの文字が止まってから自動で判定するまでのタイマー */
  private autoTimer = 0;

  open(name: string, obj: SceneObject): void {
    this.obj = obj;
    this.tries = 0;
    this.finishing = false;
    this.stage = 0;
    this.done = [false, false, false];
    const first = `This is ${obj.name.replace(/^The /, 'the ')}.`;
    this.lines = [first.charAt(0).toUpperCase() + first.slice(1), obj.guide.canDo];
    const sayBtn = this.canListen
      ? `<button class="kc-btn intro-card__btn intro-card__btn--say" data-act="say">🗣 Speak! <kbd>R</kbd></button>`
      : '';
    this.el.innerHTML = `
      <div class="intro-card__photo"><img alt="" /></div>
      <div class="intro-card__main">
        <div class="intro-card__title">Tell <b>${name}</b> about it!</div>
        <ol class="intro-steps" aria-label="steps">
          <li class="intro-step" data-step="0"><span class="intro-step__num">1</span>🔊 Listen</li>
          <li class="intro-steps__arrow" aria-hidden="true">›</li>
          <li class="intro-step" data-step="1"><span class="intro-step__num">2</span>🗣 Speak</li>
          <li class="intro-steps__arrow" aria-hidden="true">›</li>
          <li class="intro-step" data-step="2"><span class="intro-step__num">3</span>⭐ Check</li>
        </ol>
        <div class="intro-card__lines">${this.lines.map((l) => `<div class="intro-card__line">${this.wrapWords(l)}</div>`).join('')}</div>
        ${this.canListen ? '' : this.typeBoxHtml()}
        <div class="intro-live" aria-live="polite"></div>
        <div class="intro-card__heard" aria-live="polite"></div>
        <div class="intro-card__btns">
          <button class="kc-btn intro-card__btn" data-act="listen">🔊 Listen <kbd>E</kbd></button>
          ${sayBtn}
          <button class="kc-btn intro-card__btn intro-card__btn--done" data-act="done" hidden>✅ I said it! <kbd>Enter</kbd></button>
        </div>
      </div>`;
    const img = this.el.querySelector('img')!;
    const src = obj.image;
    if (src && isGasPhoto(src)) void loadGasPhoto(src).then((u) => (img.src = u)).catch(() => undefined);
    else if (src) img.src = src;
    else this.el.querySelector('.intro-card__photo')!.remove();
    this.el.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', () => this.act(b.dataset.act ?? '')),
    );
    this.bindTypeBox();
    this.renderSteps();
    this.el.classList.remove('hidden');
    this.el.classList.remove('intro-card--in');
    void this.el.offsetWidth;
    this.el.classList.add('intro-card--in');
  }

  close(): void {
    window.clearTimeout(this.listenTimer);
    window.clearTimeout(this.autoTimer);
    this.stopListening();
    this.el.classList.add('hidden');
    this.obj = null;
  }

  /** キー操作（カードが出ているときだけ）。使ったら true */
  key(code: string): boolean {
    if (!this.isOpen) return false;
    if (code === 'KeyE') this.act('listen');
    else if (code === 'KeyR') this.act(this.canListen ? 'say' : 'type');
    else if (code === 'Enter' || code === 'NumpadEnter') {
      const done = this.el.querySelector<HTMLButtonElement>('[data-act="done"]');
      if (done && !done.hidden) this.act('done');
    } else return false;
    return true;
  }

  private act(a: string): void {
    if (!this.obj || this.finishing) return;
    if (a === 'listen') {
      const text = this.lines.join(' ');
      this.speech.speak(text, 'en');
      // 聞き終わったころに ① を✓にして、② を光らせる（読み上げの終わりは分からないので、文の長さから見積もる）
      window.clearTimeout(this.listenTimer);
      this.setStage(0);
      this.listenTimer = window.setTimeout(() => {
        this.done[0] = true;
        if (this.stage === 0) this.setStage(1);
        else this.renderSteps();
      }, 900 + text.split(/\s+/).length * 330);
    } else if (a === 'say') {
      if (this.rec) this.stopListening();
      else this.startListening();
    } else if (a === 'type') {
      // 大きな🎤ボタン：押したらすぐ入力らんにカーソルが入り、キーボードが出る
      this.speech.cancel();
      this.setStage(1);
      const box = this.typeInput();
      if (box) {
        box.focus();
        box.select(); // もう一度話すときは、前の文を置きかえる
      }
      this.el.querySelector<HTMLElement>('.intro-type__hint')?.setAttribute('hidden', '');
      this.heard('👇 Now tap 🎤 on the keyboard and speak! <small>（キーボードの🎤をおして話そう）</small>');
    } else if (a === 'check') {
      const v = this.typeInput()?.value.trim() ?? '';
      if (!v) {
        this.heard('Tap the box, then tap 🎤 on the keyboard and speak.', 'ng');
        this.typeInput()?.focus();
        return;
      }
      window.clearTimeout(this.autoTimer);
      this.typeInput()?.blur();
      this.judge([v]);
    } else if (a === 'done') {
      this.close();
      this.onDone?.();
    }
  }

  /** 段を進める。retry＝③ に「もう一回」の印をつける */
  private setStage(n: number, retry = false): void {
    this.stage = n;
    this.retry = retry;
    this.renderSteps();
  }

  private retry = false;

  /** 段の表示と、今やるボタンの光り方を合わせる */
  private renderSteps(): void {
    this.el.querySelectorAll<HTMLElement>('.intro-step').forEach((li) => {
      const i = Number(li.dataset.step);
      li.classList.toggle('is-now', i === this.stage && !this.done[i]);
      li.classList.toggle('is-done', this.done[i]);
      li.classList.toggle('is-retry', i === 2 && this.retry && !this.done[2]);
      const num = li.querySelector('.intro-step__num');
      if (num) num.textContent = this.done[i] ? '✓' : i === 2 && this.retry && !this.done[2] ? '↺' : String(i + 1);
    });
    // 今やる段のボタンを大きく・光らせる
    const want = this.stage === 0 ? 'listen' : this.stage === 1 ? (this.canListen ? 'say' : 'type') : 'done';
    this.el.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => {
      b.classList.toggle('is-next', b.dataset.act === want && !this.done[this.stage]);
    });
  }

  private heard(html: string, kind: '' | 'ok' | 'ng' = ''): void {
    const h = this.el.querySelector<HTMLElement>('.intro-card__heard');
    if (!h) return;
    h.innerHTML = html;
    h.className = `intro-card__heard${kind ? ` intro-card__heard--${kind}` : ''}`;
  }

  /** 「I said it!」を出す（聞き取りが使えない・2回通らなかったとき） */
  private showDone(): void {
    const b = this.el.querySelector<HTMLButtonElement>('[data-act="done"]');
    if (b) b.hidden = false;
  }

  private sayBtn(): HTMLButtonElement | null {
    return this.el.querySelector('[data-act="say"]');
  }

  // ===== 音声認識で聞き取る =====
  private startListening(): void {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    this.speech.cancel(); // お手本の声を聞き取ってしまわないように
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.continuous = false;
    let finals: string[] = [];
    let latest = '';
    rec.onresult = (e) => {
      const alts: string[] = [];
      let text = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        text += r[0].transcript;
        if (r.isFinal) for (let k = 0; k < r.length; k++) alts.push(r[k].transcript);
      }
      latest = text;
      if (alts.length) finals = [text, ...alts];
      this.renderLive(text);
      this.heard('🎧 Listening…');
    };
    rec.onerror = (e) => {
      // 声が聞こえなかった（no-speech）はもう一度。マイクや通信が使えないときは I said it! を出す
      if (e.error === 'no-speech') this.heard('I can\'t hear you. Try again!', 'ng');
      else if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        this.toTypeMode(); // マイクが止められている → キーボードの🎤で話す方式へ
      } else {
        this.heard('🎧 Listening is not working here. Press <b>I said it!</b>', 'ng');
        this.showDone();
      }
    };
    rec.onend = () => {
      this.rec = null;
      this.setSayLabel(false);
      const heard = finals.length ? finals : latest ? [latest] : [];
      if (!heard.length) return;
      this.judge(heard);
    };
    try {
      rec.start();
      this.rec = rec;
      this.setStage(1);
      this.setSayLabel(true);
      this.heard('🎧 Listening… Speak now!');
    } catch {
      this.toTypeMode();
    }
  }

  /** 聞き取れた（打てた）文をお手本とくらべて、合格なら紹介おしまい */
  private judge(heard: string[]): void {
      const r = check(heard, this.lines.join(' '));
      this.done[1] = true;
      if (r.ok) {
        this.done[2] = true;
        this.setStage(2);
        this.finishing = true;
        this.renderLive(heard[0]);
        this.heard('🎉 <b>Great!</b>', 'ok');
        this.typeInput()?.blur();
        window.setTimeout(() => {
          this.finishing = false;
          this.act('done');
        }, 1100);
      } else {
        this.tries++;
        this.done[1] = false;
        this.setStage(1, true); // ② をもう一度光らせる（③ は「もう一回」の印）
        const missing = r.miss.slice(0, 3).join(', ');
        this.renderLive(heard[0]);
        this.heard(`Try again!${missing ? ` <small>Try: <b>${this.esc(missing)}</b></small>` : ''}`, 'ng');
        if (this.tries >= 2) this.showDone();
        this.typeInput()?.select();
      }
  }

  private stopListening(): void {
    const r = this.rec;
    if (!r) return;
    try {
      r.stop();
    } catch {
      // 止まっていればよい
    }
  }

  private setSayLabel(on: boolean): void {
    const b = this.sayBtn();
    if (!b) return;
    b.innerHTML = on ? '⏹ Stop <kbd>R</kbd>' : '🗣 Speak! <kbd>R</kbd>';
    b.classList.toggle('intro-card__btn--rec', on);
  }

  private esc(s: string): string {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
  }

  // ===== 話した文を、その場で色分けして見せる =====
  /** お手本の文を、言葉ごとの <span> にする（言えた言葉を光らせるため） */
  private wrapWords(line: string): string {
    return this.esc(line).replace(/[A-Za-z0-9']+/g, (m) => {
      const w = words(m)[0] ?? '';
      return w ? `<span class="intro-tw" data-w="${w}">${m}</span>` : m;
    });
  }

  /** お手本に出てくる言葉（小さな言葉もふくむ） */
  private targetWords(): string[] {
    return words(this.lines.join(' '));
  }

  /**
   * 話した（文字になった）文を、言葉ごとに色分けして見せる。
   * お手本にある言葉＝緑、お手本にない言葉（聞きまちがい・言いまちがい）＝オレンジ。
   * お手本の文のほうも、言えた言葉に印をつける。
   */
  private renderLive(text: string): void {
    const live = this.el.querySelector<HTMLElement>('.intro-live');
    const target = this.targetWords();
    const said = words(text);
    const match = (a: string, b: string): boolean => (a.length < 4 || b.length < 4 ? a === b : close(a, b));
    if (live) {
      live.innerHTML = text.trim()
        ? text
            .trim()
            .split(/\s+/)
            .map((tok) => {
              const w = words(tok)[0];
              if (!w) return this.esc(tok);
              const ok = target.some((t) => match(w, t));
              return `<span class="intro-live__w ${ok ? 'is-ok' : 'is-ng'}">${this.esc(tok)}</span>`;
            })
            .join(' ')
        : '';
    }
    this.el.querySelectorAll<HTMLElement>('.intro-tw').forEach((sp) => {
      const t = sp.dataset.w ?? '';
      sp.classList.toggle('is-said', said.some((w) => match(w, t)));
    });
  }

  // ===== ページから聞き取れないとき：入力らん＋キーボードの🎤（音声入力） =====
  private typeBoxHtml(): string {
    return `
        <div class="intro-type">
          <button class="intro-mic" data-act="type" aria-label="Speak"><span class="intro-mic__icon">🎤</span><span class="intro-mic__label">Speak <kbd>R</kbd></span></button>
          <input class="intro-type__input" type="text" lang="en" autocomplete="off" autocorrect="off"
            autocapitalize="sentences" spellcheck="false" enterkeyhint="done" placeholder="Your English…" aria-label="Say it" />
          <button class="kc-btn intro-card__btn intro-card__btn--say" data-act="check">⭐ Check <kbd>Enter</kbd></button>
        </div>
        <div class="intro-type__hint">Tap 🎤 → tap 🎤 on the keyboard → speak. <small>（キーボードを英語にして、🎤をおして話そう）</small></div>`;
  }

  private typeInput(): HTMLInputElement | null {
    return this.el.querySelector('.intro-type__input');
  }

  private bindTypeBox(): void {
    const box = this.typeInput();
    if (!box) return;
    box.addEventListener('focus', () => {
      this.speech.cancel();
      if (this.stage === 0) this.setStage(1);
    });
    box.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        this.act('check');
      } else if (e.key === 'Escape') box.blur();
    });
    box.addEventListener('keyup', (e) => e.stopPropagation());
    // 音声入力で文字が入るたびに色分けし、文字が止まって合格なら自動で「Great!」にする
    box.addEventListener('input', () => {
      if (this.finishing) return;
      const v = box.value;
      this.renderLive(v);
      window.clearTimeout(this.autoTimer);
      if (!v.trim()) return;
      this.autoTimer = window.setTimeout(() => {
        if (!this.obj || this.finishing) return;
        if (check([v], this.lines.join(' ')).ok) this.judge([v]);
      }, 1200);
    });
  }

  /** 聞き取りが止められているとわかったら、カードを入力らん方式で作り直す */
  private toTypeMode(): void {
    if (this.typeMode || !this.obj) return;
    this.typeMode = true;
    this.rec = null;
    this.sayBtn()?.remove();
    this.el.querySelector('.intro-card__heard')?.insertAdjacentHTML('beforebegin', this.typeBoxHtml());
    this.el.querySelectorAll<HTMLButtonElement>('[data-act="check"],[data-act="type"]').forEach((b) =>
      b.addEventListener('click', () => this.act(b.dataset.act ?? '')),
    );
    this.bindTypeBox();
    this.heard('');
    this.setStage(1);
  }
}
