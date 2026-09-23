import type { Landmark, Quiz, QuizType } from '@/types';
import { defaultChoices } from '@/features/quiz/Quiz';

export interface QuizEditorHandlers {
  onSaved: (quiz: Quiz) => void;
  onDeleted: (id: string) => void;
}

/**
 * クイズの作成・編集モーダル。
 * 観光地・形式(○×/三択)・問題文・選択肢・正解・解説を編集できる。
 */
export class QuizEditor {
  private readonly root: HTMLElement;
  private current: Quiz | null = null;
  private landmarks: Landmark[] = [];
  private handlers: QuizEditorHandlers | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'modal hidden';
    parent.appendChild(this.root);
  }

  open(quiz: Quiz, landmarks: Landmark[], handlers: QuizEditorHandlers): void {
    this.current = quiz;
    this.landmarks = landmarks;
    this.handlers = handlers;
    this.render();
    this.root.classList.remove('hidden');
  }

  close(): void {
    this.root.classList.add('hidden');
    this.current = null;
  }

  private render(): void {
    const q = this.current;
    if (!q) return;

    const lmOptions =
      `<option value="">（観光地に紐づけない）</option>` +
      this.landmarks
        .map(
          (l) =>
            `<option value="${l.id}" ${l.id === q.landmarkId ? 'selected' : ''}>${this.esc(l.titleJa)}</option>`,
        )
        .join('');

    const choicesHtml =
      q.type === 'ox'
        ? q.choices
            .map(
              (c, i) => `
          <label class="choice-row">
            <input type="radio" name="ans" value="${i}" ${i === q.answerIndex ? 'checked' : ''} />
            <span class="choice-fixed">${this.esc(c)}</span>
          </label>`,
            )
            .join('')
        : q.choices
            .map(
              (c, i) => `
          <label class="choice-row">
            <input type="radio" name="ans" value="${i}" ${i === q.answerIndex ? 'checked' : ''} />
            <input type="text" data-choice="${i}" value="${this.attr(c)}" />
          </label>`,
            )
            .join('');

    this.root.innerHTML = `
      <div class="modal__backdrop" data-role="backdrop"></div>
      <div class="modal__card">
        <div class="modal__title">❓ クイズの へんしゅう</div>
        <div class="form-grid">
          <label class="full">観光地
            <select data-f="landmark">${lmOptions}</select>
          </label>
          <label class="full">形式
            <div class="type-toggle">
              <button class="type-btn ${q.type === 'ox' ? 'is-active' : ''}" data-type="ox">○ ×</button>
              <button class="type-btn ${q.type === 'choice3' ? 'is-active' : ''}" data-type="choice3">三択</button>
            </div>
          </label>
          <label class="full">問題文（日本語）
            <textarea data-f="question" rows="2">${this.text(q.questionJa)}</textarea>
          </label>
          <div class="full">
            <div class="opt-label">こたえ（正解に ● をつける）</div>
            <div class="choice-list">${choicesHtml}</div>
          </div>
          <label class="full">かいせつ（任意）
            <input data-f="explanation" value="${this.attr(q.explanation ?? '')}" />
          </label>
        </div>
        <div class="modal__actions">
          <button class="kc-btn" data-role="save"><span class="kc-btn__icon">💾</span>ほぞん</button>
          <button class="kc-mini" data-role="delete">🗑️ このクイズをけす</button>
          <button class="kc-mini" data-role="cancel">とじる</button>
        </div>
      </div>
    `;
    this.wire();
  }

  private wire(): void {
    const q = this.current!;
    const sel = <T extends HTMLElement>(s: string) => this.root.querySelector(s) as T;

    sel('[data-role="backdrop"]').addEventListener('click', () => this.close());
    sel('[data-role="cancel"]').addEventListener('click', () => this.close());

    // 形式の切替（その場で選択肢を作り直す）
    for (const btn of Array.from(this.root.querySelectorAll<HTMLElement>('.type-btn'))) {
      btn.addEventListener('click', () => {
        const newType = btn.dataset.type as QuizType;
        if (newType === q.type) return;
        // 入力中の問題文などは保持
        this.captureInto(q);
        q.type = newType;
        q.choices = defaultChoices(newType);
        q.answerIndex = 0;
        this.render();
      });
    }

    sel('[data-role="save"]').addEventListener('click', () => {
      this.captureInto(q);
      this.handlers?.onSaved(q);
      this.close();
    });

    sel('[data-role="delete"]').addEventListener('click', () => {
      const id = q.id;
      this.close();
      this.handlers?.onDeleted(id);
    });
  }

  /** 現在の入力値をクイズオブジェクトへ取り込む */
  private captureInto(q: Quiz): void {
    const val = (s: string) =>
      (this.root.querySelector(s) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value ?? '';

    q.landmarkId = val('[data-f="landmark"]') || undefined;
    q.questionJa = val('[data-f="question"]');
    q.explanation = val('[data-f="explanation"]') || undefined;

    if (q.type === 'choice3') {
      const inputs = Array.from(this.root.querySelectorAll<HTMLInputElement>('[data-choice]'));
      if (inputs.length === 3) q.choices = inputs.map((i) => i.value);
    }
    const ans = this.root.querySelector<HTMLInputElement>('input[name="ans"]:checked');
    if (ans) q.answerIndex = Number(ans.value);
  }

  private esc(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
  private attr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
  private text(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
