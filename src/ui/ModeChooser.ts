/**
 * アプリの使い方（入口）。2026-11-22 に3つに分けた。
 *  - guide＝Tour Guide（見どころを順に英語で案内する。置く・消すはできない）
 *  - visit＝道案内（留学生を名所へ案内する。置く・消す・説明の追加はできない）
 *  - build＝ブロック（ブロックを置く・説明に英文や写真や声を足す。留学生は出ない）
 */
export type AppMode = 'guide' | 'visit' | 'build';

/**
 * 番号を入れたあとに出す「入口をえらぶ画面」（2026-11-13 追加）。
 * 🎤 Tour Guide ／ 🧭 Guide a Visitor ／ 🧱 Build の3つから選ぶ。
 * マウス不使用：←→（↑↓）でえらんで Enter。
 */
export class ModeChooser {
  private readonly root: HTMLElement;

  constructor(parent: HTMLElement, private readonly onPick: (mode: AppMode) => void) {
    this.root = document.createElement('div');
    this.root.className = 'mode-chooser hidden';
    this.root.innerHTML = `
      <div class="mode-chooser__box" role="dialog" aria-modal="true" aria-label="Choose a mode">
        <div class="mode-chooser__title">What do you want to do?</div>
        <div class="mode-chooser__sub">えらんでね</div>
        <div class="mode-chooser__row">
          <button class="mode-card mode-card--guide" data-mode="guide">
            <span class="mode-card__icon">🎤</span>
            <span class="mode-card__name">Tour Guide</span>
            <span class="mode-card__what">Show the place in English.</span>
            <span class="mode-card__ja">英語で あんない する</span>
          </button>
          <button class="mode-card mode-card--visit" data-mode="visit">
            <span class="mode-card__icon">🧭</span>
            <span class="mode-card__name">Guide a Visitor</span>
            <span class="mode-card__what">Take a visitor to a place.</span>
            <span class="mode-card__ja">りゅうがくせいを みちあんない</span>
          </button>
          <button class="mode-card mode-card--practice" data-mode="build">
            <span class="mode-card__icon">🧱</span>
            <span class="mode-card__name">Build</span>
            <span class="mode-card__what">Build and add English.</span>
            <span class="mode-card__ja">ブロックで つくる</span>
          </button>
        </div>
        <div class="mode-chooser__keys"><kbd>←</kbd><kbd>→</kbd> choose ・ <kbd>Enter</kbd> go</div>
      </div>`;
    parent.appendChild(this.root);
    for (const btn of this.cards()) {
      btn.addEventListener('click', () => {
        this.close();
        this.onPick(btn.dataset.mode as AppMode);
      });
    }
    this.root.addEventListener('keydown', this.onKeyDown);
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  /** 開く。前に選んだ入口にフォーカスを当てておく（Enter だけで同じ入口に入れる） */
  open(current: AppMode): void {
    this.root.classList.remove('hidden');
    setTimeout(() => this.cards().find((b) => b.dataset.mode === current)?.focus(), 60);
  }

  close(): void {
    this.root.classList.add('hidden');
  }

  private cards(): HTMLButtonElement[] {
    return Array.from(this.root.querySelectorAll<HTMLButtonElement>('.mode-card'));
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) return;
    e.preventDefault();
    e.stopPropagation();
    const cards = this.cards();
    const now = cards.indexOf(document.activeElement as HTMLButtonElement);
    const back = e.code === 'ArrowLeft' || e.code === 'ArrowUp';
    cards[now < 0 ? 0 : (now + (back ? cards.length - 1 : 1)) % cards.length].focus();
  };
}
