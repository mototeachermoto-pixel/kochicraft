import type { LanguageManager } from '@/features/language/LanguageManager';

/** 学習に表示する1項目（ラベル・英語・日本語） */
interface LearnItem {
  label: string;
  en: string;
  ja: string;
}

/**
 * 外国語（英語）学習パネル。
 * 観光地を選び、英語ガイド（紹介・できること・おすすめ）を1文ずつ発音（ふつう/ゆっくり）。
 * 英語と日本語の対訳をならべて表示し、表示と同じ文を読み上げる。
 */
export class LearningPanel {
  private readonly root: HTMLElement;

  constructor(parent: HTMLElement, private readonly lang: LanguageManager) {
    this.root = document.createElement('div');
    this.root.className = 'modal hidden';
    parent.appendChild(this.root);
  }

  open(): void {
    this.lang.select(null);
    this.render();
    this.root.classList.remove('hidden');
  }

  close(): void {
    this.root.classList.add('hidden');
    this.lang.stop();
  }

  /** 表示する学習項目を作る（ガイドがあれば3要素、無ければ説明文を文ごとに） */
  private buildItems(): LearnItem[] {
    const lm = this.lang.getCurrent();
    if (!lm) return [];
    if (lm.guide) {
      const g = lm.guide;
      return [
        { label: 'しょうかい', en: g.introEn, ja: g.introJa },
        { label: 'できること', en: g.canDoEn, ja: g.canDoJa },
        { label: 'おすすめ', en: g.recommendEn, ja: g.recommendJa },
      ];
    }
    const sentences = this.lang.splitSentences(lm.descEn);
    return sentences.map((s, i) => ({ label: `(${i + 1})`, en: s, ja: i === 0 ? lm.descJa : '' }));
  }

  private render(): void {
    const current = this.lang.getCurrent();
    const landmarks = this.lang.getLandmarks();

    const tabs = landmarks
      .map(
        (l) =>
          `<button class="learn-tab ${l.id === this.lang.currentId ? 'is-active' : ''}" data-pick="${l.id}">${this.esc(l.titleJa)}</button>`,
      )
      .join('');

    let body = '';
    if (!current) {
      body = `<div class="learn-empty">観光地がありません。先生メニューで作ってね。</div>`;
    } else {
      const items = this.buildItems();
      const itemRows = items
        .map(
          (it, i) => `
        <div class="learn-item">
          <div class="learn-item__head">
            <span class="learn-item__label">${this.esc(it.label)}</span>
            <span class="learn-item__btns">
              <button class="kc-mini" data-say="${i}">🔊</button>
              <button class="kc-mini" data-slow="${i}">🐢</button>
            </span>
          </div>
          <div class="learn-item__en">${this.esc(it.en)}</div>
          ${it.ja ? `<div class="learn-item__ja">${this.esc(it.ja)}</div>` : ''}
        </div>`,
        )
        .join('');

      const phrases = this.lang.getPhrases(current);
      const phraseChips = phrases
        .map(
          (p, i) => `
        <button class="learn-phrase" data-phrase="${i}">
          <span class="learn-phrase__en">🔊 ${this.esc(p.en)}</span>
          <span class="learn-phrase__ja">${this.esc(p.ja)}</span>
        </button>`,
        )
        .join('');

      body = `
        <div class="learn-title">${this.esc(current.titleEn)}</div>
        <div class="learn-sub">${this.esc(current.titleJa)}</div>
        <div class="learn-section-head">
          <span>えいごガイド</span>
          <button class="kc-btn" data-readall><span class="kc-btn__icon">▶️</span>ぜんぶ きく</button>
        </div>
        <div class="learn-items">${itemRows}</div>
        <div class="learn-section-head"><span>つかえる フレーズ</span></div>
        <div class="learn-phrases">${phraseChips}</div>
      `;
    }

    this.root.innerHTML = `
      <div class="modal__backdrop" data-role="backdrop"></div>
      <div class="modal__card learn-card">
        <div class="learn-head">
          <div class="modal__title">📖 がいこくご学習</div>
          <button class="tourism-popup__close" data-role="close">✖</button>
        </div>
        <div class="learn-tabs">${tabs}</div>
        <div class="learn-body">${body}</div>
      </div>
    `;

    this.wire();
  }

  private wire(): void {
    const root = this.root;
    root.querySelector('[data-role="backdrop"]')!.addEventListener('click', () => this.lang.setEnabled(false));
    root.querySelector('[data-role="close"]')!.addEventListener('click', () => this.lang.setEnabled(false));

    for (const btn of Array.from(root.querySelectorAll<HTMLElement>('[data-pick]'))) {
      btn.addEventListener('click', () => {
        this.lang.select(btn.dataset.pick!);
        this.render();
      });
    }

    const current = this.lang.getCurrent();
    if (!current) return;
    const items = this.buildItems();
    const phrases = this.lang.getPhrases(current);

    root.querySelector('[data-readall]')?.addEventListener('click', () =>
      this.lang.speak(items.map((i) => i.en).join(' '), 'en', false),
    );
    for (const btn of Array.from(root.querySelectorAll<HTMLElement>('[data-say]'))) {
      btn.addEventListener('click', () => this.lang.speak(items[Number(btn.dataset.say)].en, 'en', false));
    }
    for (const btn of Array.from(root.querySelectorAll<HTMLElement>('[data-slow]'))) {
      btn.addEventListener('click', () => this.lang.speak(items[Number(btn.dataset.slow)].en, 'en', true));
    }
    for (const btn of Array.from(root.querySelectorAll<HTMLElement>('[data-phrase]'))) {
      btn.addEventListener('click', () => this.lang.speak(phrases[Number(btn.dataset.phrase)].en, 'en', false));
    }
  }

  private esc(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
