/** タイトル画面のボタン動作 */
export interface TitleScreenHandlers {
  onCreate: () => void;
  onContinue: () => void;
  onHowTo: () => void;
}

/**
 * 起動時のタイトル/スタート画面。
 * 「あたらしく作る」「つづきから」「あそびかた」を大きなボタンで提示する。
 * 背景には生成済みのワールドがゆっくり映る（シネマティック）。
 */
export class TitleScreen {
  private readonly root: HTMLElement;

  constructor(parent: HTMLElement, private readonly handlers: TitleScreenHandlers) {
    this.root = document.createElement('div');
    this.root.className = 'title-screen hidden';
    this.root.innerHTML = `
      <div class="title-screen__inner">
        <div class="title-screen__logo">KochiCraft</div>
        <div class="title-screen__sub">高知県 バーチャル観光ワールド</div>
        <div class="title-screen__menu">
          <button class="title-btn title-btn--primary" data-role="create">
            <span class="title-btn__icon">🌏</span>あたらしく 作る
          </button>
          <button class="title-btn" data-role="continue">
            <span class="title-btn__icon">📂</span>つづきから
          </button>
          <button class="title-btn" data-role="howto">
            <span class="title-btn__icon">❓</span>あそびかた
          </button>
        </div>
      </div>
    `;
    parent.appendChild(this.root);

    this.root.querySelector('[data-role="create"]')!.addEventListener('click', () => this.handlers.onCreate());
    this.root.querySelector('[data-role="continue"]')!.addEventListener('click', () => this.handlers.onContinue());
    this.root.querySelector('[data-role="howto"]')!.addEventListener('click', () => this.handlers.onHowTo());
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }
}
