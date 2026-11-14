import type { SceneObject } from '@/spots/SpotDefinition';
import type { SpeechService } from '@/features/language/SpeechService';
import { isGasPhoto, loadGasPhoto } from '@/data/GasPhotos';
import { check, recognitionCtor, type SpeechRecognitionLike } from './speechCheck';

/**
 * 留学生ゲーム ステップ4「紹介タイム」。名所に着いたら、画面の下にカードを出す。
 *  - 名所の写真と、言う英文「This is ～.」「You can ～.」（You can は案内モードと同じ文）。
 *  - 🔊 Listen（E）：お手本を聞く。
 *  - 🗣 Speak!（R）：話すと、ブラウザの音声認識で聞き取り、お手本の大事な言葉とくらべる（甘めの判定。speechCheck.ts）。
 *    合格 → 「Great!」→ 紹介おしまい（onDone）。だめ → 「Try again!」と聞き取れた文を見せる。
 *  - ✅ I said it!（Enter）：音声認識が使えない端末・聞き取りがうまく動かないとき・2回ためして通らなかったときだけ出す
 *    （できない子が先に進めなくならないように）。
 * 音声認識は、iPad の Safari・Edge などが Apple / Microsoft のサーバーで聞き取る（2026-11-14 先生が了承）。
 * 音声認識がない端末では、今までどおり 🎤 Record（録音して聞き返す）と I said it! を出す。
 */
export class IntroCard {
  private readonly el: HTMLDivElement;
  private obj: SceneObject | null = null;
  private lines: string[] = [];
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stopTimer = 0;
  private playBack = true;
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
    return recognitionCtor() !== null;
  }

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
      : `<button class="kc-btn intro-card__btn" data-act="record">🎤 Record <kbd>R</kbd></button>`;
    this.el.innerHTML = `
      <div class="intro-card__photo"><img alt="" /></div>
      <div class="intro-card__main">
        <div class="intro-card__title">Tell <b>${name}</b> about it!</div>
        <ol class="intro-steps" aria-label="steps">
          <li class="intro-step" data-step="0"><span class="intro-step__num">1</span>🔊 Listen</li>
          <li class="intro-steps__arrow" aria-hidden="true">›</li>
          <li class="intro-step" data-step="1"><span class="intro-step__num">2</span>${this.canListen ? '🗣 Speak' : '🎤 Speak'}</li>
          <li class="intro-steps__arrow" aria-hidden="true">›</li>
          <li class="intro-step" data-step="2"><span class="intro-step__num">3</span>⭐ Check</li>
        </ol>
        <div class="intro-card__lines">${this.lines.map((l) => `<div class="intro-card__line">${l}</div>`).join('')}</div>
        <div class="intro-card__heard" aria-live="polite"></div>
        <div class="intro-card__btns">
          <button class="kc-btn intro-card__btn" data-act="listen">🔊 Listen <kbd>E</kbd></button>
          ${sayBtn}
          <button class="kc-btn intro-card__btn intro-card__btn--done" data-act="done" ${this.canListen ? 'hidden' : ''}>✅ I said it! <kbd>Enter</kbd></button>
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
    this.renderSteps();
    this.el.classList.remove('hidden');
    this.el.classList.remove('intro-card--in');
    void this.el.offsetWidth;
    this.el.classList.add('intro-card--in');
  }

  close(): void {
    window.clearTimeout(this.listenTimer);
    this.stopRecording(false);
    this.stopListening();
    this.el.classList.add('hidden');
    this.obj = null;
  }

  /** キー操作（カードが出ているときだけ）。使ったら true */
  key(code: string): boolean {
    if (!this.isOpen) return false;
    if (code === 'KeyE') this.act('listen');
    else if (code === 'KeyR') this.act(this.canListen ? 'say' : 'record');
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
    } else if (a === 'record') {
      if (this.recorder) {
        this.stopRecording(true);
        this.done[1] = true;
        this.setStage(2); // 録音を聞き返したら、自分で「言えた」を押す
      } else {
        this.setStage(1);
        void this.startRecording();
      }
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
    const want = this.stage === 0 ? 'listen' : this.stage === 1 ? (this.canListen ? 'say' : 'record') : 'done';
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
    const target = this.lines.join(' ');
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
      this.heard(`🎧 <i>${this.esc(text)}</i>`);
    };
    rec.onerror = (e) => {
      // 声が聞こえなかった（no-speech）はもう一度。マイクや通信が使えないときは I said it! を出す
      if (e.error === 'no-speech') this.heard('I can\'t hear you. Try again!', 'ng');
      else {
        this.heard('🎧 Listening is not working here. Press <b>I said it!</b>', 'ng');
        this.showDone();
      }
    };
    rec.onend = () => {
      this.rec = null;
      this.setSayLabel(false);
      const heard = finals.length ? finals : latest ? [latest] : [];
      if (!heard.length) return;
      const r = check(heard, target);
      this.done[1] = true;
      if (r.ok) {
        this.done[2] = true;
        this.setStage(2);
        this.finishing = true;
        this.heard(`🎉 <b>Great!</b> <i>${this.esc(heard[0])}</i>`, 'ok');
        window.setTimeout(() => {
          this.finishing = false;
          this.act('done');
        }, 1100);
      } else {
        this.tries++;
        this.done[1] = false;
        this.setStage(1, true); // ② をもう一度光らせる（③ は「もう一回」の印）
        const missing = r.miss.slice(0, 3).join(', ');
        this.heard(`Try again! <i>${this.esc(heard[0])}</i>${missing ? `<br><small>Try: <b>${this.esc(missing)}</b></small>` : ''}`, 'ng');
        if (this.tries >= 2) this.showDone();
      }
    };
    try {
      rec.start();
      this.rec = rec;
      this.setStage(1);
      this.setSayLabel(true);
      this.heard('🎧 Listening… Speak now!');
    } catch {
      this.heard('🎧 Listening is not working here. Press <b>I said it!</b>', 'ng');
      this.showDone();
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

  // ===== 音声認識がない端末：録音して聞き返す =====
  private recordBtn(): HTMLButtonElement | null {
    return this.el.querySelector('[data-act="record"]');
  }

  /** 録音をはじめる（いちばん長くて8秒。もう一度押すと止まる） */
  private async startRecording(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      const b = this.recordBtn();
      if (b) b.textContent = '🎤 (not on this device)';
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.chunks = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (!this.playBack) return;
        const url = URL.createObjectURL(new Blob(this.chunks, { type: rec.mimeType }));
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        void audio.play().catch(() => undefined);
      };
      this.recorder = rec;
      this.playBack = true;
      rec.start();
      const b = this.recordBtn();
      if (b) {
        b.innerHTML = '⏹ Stop <kbd>R</kbd>';
        b.classList.add('intro-card__btn--rec');
      }
      this.stopTimer = window.setTimeout(() => this.stopRecording(true), 8000);
    } catch {
      const b = this.recordBtn();
      if (b) b.textContent = '🎤 (mic is off)';
    }
  }

  private stopRecording(play: boolean): void {
    window.clearTimeout(this.stopTimer);
    const rec = this.recorder;
    this.recorder = null;
    if (rec && rec.state !== 'inactive') {
      this.playBack = play;
      rec.stop();
    }
    const b = this.recordBtn();
    if (b) {
      b.innerHTML = '🎤 Record <kbd>R</kbd>';
      b.classList.remove('intro-card__btn--rec');
    }
  }
}
