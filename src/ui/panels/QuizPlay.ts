import type { Quiz } from '@/types';
import type { TourismManager } from '@/features/tourism/TourismManager';
import type { QuizManager } from '@/features/quiz/QuizManager';

/**
 * クイズ出題プレイ（児童用）。
 * 観光地（または「ぜんぶ」）を選んで、1問ずつ解答→正誤＆解説→最後に得点を表示。
 */
export class QuizPlay {
  private readonly root: HTMLElement;
  private session: Quiz[] = [];
  private index = 0;
  private score = 0;

  constructor(
    parent: HTMLElement,
    private readonly tourism: TourismManager,
    private readonly quizzes: QuizManager,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'modal hidden';
    parent.appendChild(this.root);
  }

  open(): void {
    this.renderSelect();
    this.root.classList.remove('hidden');
  }

  close(): void {
    this.root.classList.add('hidden');
  }

  // ===== 観光地（出題範囲）の選択 =====
  private renderSelect(): void {
    const all = this.quizzes.getAll();
    const byLandmark = new Map<string, number>();
    for (const q of all) {
      const key = q.landmarkId ?? '';
      byLandmark.set(key, (byLandmark.get(key) ?? 0) + 1);
    }

    let buttons = '';
    if (all.length === 0) {
      buttons = `<div class="learn-empty">まだクイズがありません。<br>先生メニューで作ってね。</div>`;
    } else {
      buttons += `<button class="quiz-pick" data-pick="*">🌟 ぜんぶ（${all.length}もん）</button>`;
      for (const [key, count] of byLandmark) {
        const name = key ? (this.tourism.get(key)?.titleJa ?? 'そのほか') : 'そのほか';
        buttons += `<button class="quiz-pick" data-pick="${key}">${this.esc(name)}（${count}もん）</button>`;
      }
    }

    this.root.innerHTML = `
      <div class="modal__backdrop" data-role="backdrop"></div>
      <div class="modal__card">
        <div class="learn-head">
          <div class="modal__title">🧩 クイズ</div>
          <button class="tourism-popup__close" data-role="close">✖</button>
        </div>
        <div class="opt-label">どの クイズに ちょうせんする？</div>
        <div class="quiz-picks">${buttons}</div>
      </div>
    `;

    this.root.querySelector('[data-role="backdrop"]')!.addEventListener('click', () => this.close());
    this.root.querySelector('[data-role="close"]')!.addEventListener('click', () => this.close());
    for (const btn of Array.from(this.root.querySelectorAll<HTMLElement>('[data-pick]'))) {
      btn.addEventListener('click', () => {
        const pick = btn.dataset.pick!;
        const list = pick === '*' ? all : all.filter((q) => (q.landmarkId ?? '') === pick);
        this.start(list);
      });
    }
  }

  // ===== 出題 =====
  private start(quizzes: Quiz[]): void {
    this.session = quizzes;
    this.index = 0;
    this.score = 0;
    this.renderQuestion();
  }

  private renderQuestion(): void {
    const q = this.session[this.index];
    if (!q) {
      this.renderResult();
      return;
    }

    const choices = q.choices
      .map(
        (c, i) => `<button class="quiz-choice" data-choice="${i}">${this.esc(c)}</button>`,
      )
      .join('');

    this.root.innerHTML = `
      <div class="modal__backdrop" data-role="backdrop"></div>
      <div class="modal__card">
        <div class="learn-head">
          <div class="quiz-progress">第 ${this.index + 1} もん / ${this.session.length} もん</div>
          <button class="tourism-popup__close" data-role="close">✖</button>
        </div>
        <div class="quiz-question">${this.esc(q.questionJa)}</div>
        <div class="quiz-choices">${choices}</div>
        <div class="quiz-feedback" data-role="feedback"></div>
        <div class="modal__actions" data-role="footer"></div>
      </div>
    `;

    this.root.querySelector('[data-role="backdrop"]')!.addEventListener('click', () => this.close());
    this.root.querySelector('[data-role="close"]')!.addEventListener('click', () => this.close());
    for (const btn of Array.from(this.root.querySelectorAll<HTMLElement>('[data-choice]'))) {
      btn.addEventListener('click', () => this.answer(Number(btn.dataset.choice), q));
    }
  }

  private answer(chosen: number, q: Quiz): void {
    const correct = chosen === q.answerIndex;
    if (correct) this.score += 1;

    // ボタンを無効化し、正解・不正解を色分け
    const btns = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-choice]'));
    btns.forEach((b, i) => {
      b.disabled = true;
      if (i === q.answerIndex) b.classList.add('is-correct');
      else if (i === chosen) b.classList.add('is-wrong');
    });

    const feedback = this.root.querySelector('[data-role="feedback"]') as HTMLElement;
    feedback.innerHTML = `
      <div class="quiz-result-mark ${correct ? 'ok' : 'ng'}">${correct ? '◯ せいかい！' : '✕ ざんねん…'}</div>
      ${q.explanation ? `<div class="quiz-explanation">${this.esc(q.explanation)}</div>` : ''}
    `;

    const footer = this.root.querySelector('[data-role="footer"]') as HTMLElement;
    const last = this.index >= this.session.length - 1;
    footer.innerHTML = `<button class="kc-btn" data-role="next"><span class="kc-btn__icon">${last ? '🏁' : '➡️'}</span>${last ? 'けっか を みる' : 'つぎへ'}</button>`;
    footer.querySelector('[data-role="next"]')!.addEventListener('click', () => {
      this.index += 1;
      this.renderQuestion();
    });
  }

  private renderResult(): void {
    const total = this.session.length;
    const perfect = this.score === total && total > 0;
    this.root.innerHTML = `
      <div class="modal__backdrop" data-role="backdrop"></div>
      <div class="modal__card quiz-result">
        <div class="modal__title">${perfect ? '🎉 ぜんもん せいかい！' : '🧩 けっか'}</div>
        <div class="quiz-score">${total} もん中 <b>${this.score}</b> もん せいかい！</div>
        <div class="modal__actions">
          <button class="kc-btn" data-role="again"><span class="kc-btn__icon">🔁</span>もういちど</button>
          <button class="kc-mini" data-role="close">とじる</button>
        </div>
      </div>
    `;
    this.root.querySelector('[data-role="again"]')!.addEventListener('click', () => this.renderSelect());
    this.root.querySelector('[data-role="close"]')!.addEventListener('click', () => this.close());
  }

  private esc(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
