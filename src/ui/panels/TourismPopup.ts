import type { Lang, Landmark } from '@/types';
import { landmarkLines, landmarkReadText } from '@/features/tourism/Landmark';

/** ポップアップのボタン動作 */
export interface TourismPopupHandlers {
  /** 表示中のテキスト（表示と同じ内容）を読み上げる */
  onSpeak: (text: string, lang: Lang) => void;
  onLang: (lang: Lang) => void;
  onEdit: () => void;
  onClose: () => void;
}

/**
 * 観光地に近づいたときに表示する説明ポップアップ。
 * 「場所の紹介」「できること」「おすすめ」を日英で表示し、表示と同じ文を読み上げる。
 */
export class TourismPopup {
  private readonly root: HTMLElement;
  private handlers: TourismPopupHandlers | null = null;
  private current: Landmark | null = null;
  private lang: Lang = 'ja';

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'tourism-popup hidden';
    parent.appendChild(this.root);
  }

  show(landmark: Landmark, lang: Lang, handlers: TourismPopupHandlers): void {
    this.current = landmark;
    this.lang = lang;
    this.handlers = handlers;
    this.render();
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.current = null;
  }

  private render(): void {
    const lm = this.current;
    if (!lm) return;
    const title = this.lang === 'ja' ? lm.titleJa : lm.titleEn;
    const subtitle = this.lang === 'ja' ? lm.titleEn : lm.titleJa;
    const lines = landmarkLines(lm, this.lang);

    const linesHtml = lines
      .map((l) =>
        l.label
          ? `<div class="tourism-line"><span class="tourism-line__label">${this.escape(l.label)}</span><span class="tourism-line__text">${this.escape(l.text)}</span></div>`
          : `<div class="tourism-popup__desc">${this.escape(l.text)}</div>`,
      )
      .join('');

    this.root.innerHTML = `
      <button class="tourism-popup__close" data-role="close" title="とじる">✖</button>
      <div class="tourism-popup__lang">
        <button class="lang-btn ${this.lang === 'ja' ? 'is-active' : ''}" data-lang="ja">日本語</button>
        <button class="lang-btn ${this.lang === 'en' ? 'is-active' : ''}" data-lang="en">English</button>
      </div>
      ${lm.image ? `<img class="tourism-popup__img" src="${lm.image}" alt="${this.escape(title)}" />` : ''}
      <div class="tourism-popup__title">${this.escape(title)}</div>
      <div class="tourism-popup__sub">${this.escape(subtitle)}</div>
      ${linesHtml}
      <div class="tourism-popup__actions">
        <button class="kc-btn" data-role="speak"><span class="kc-btn__icon">🔊</span>よみあげ</button>
        <button class="kc-mini" data-role="edit">✏️ へんしゅう</button>
      </div>
    `;

    this.root.querySelector('[data-role="close"]')!.addEventListener('click', () => this.handlers?.onClose());
    this.root.querySelector('[data-role="speak"]')!.addEventListener('click', () =>
      this.handlers?.onSpeak(landmarkReadText(lm, this.lang), this.lang),
    );
    this.root.querySelector('[data-role="edit"]')!.addEventListener('click', () => this.handlers?.onEdit());
    for (const btn of Array.from(this.root.querySelectorAll<HTMLElement>('.lang-btn'))) {
      btn.addEventListener('click', () => this.handlers?.onLang(btn.dataset.lang as Lang));
    }
  }

  private escape(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
