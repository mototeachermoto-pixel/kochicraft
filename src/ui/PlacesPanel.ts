import type { SceneObject } from '@/spots/SpotDefinition';

/**
 * その観光地の「行ける場所」の一覧（Map）。
 * ボタン（またはMキー）で開き、選ぶとその場所へ移動して説明が出る。
 * マウス不使用：矢印キーで選び、Enter で決定、Esc で閉じる。
 */
export class PlacesPanel {
  private readonly root: HTMLElement;
  private objects: SceneObject[] = [];
  private onPick: (index: number) => void = () => {};
  /** 閉じたときに呼ぶ（ツールバーのボタン表示を戻す用） */
  onClose?: () => void;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'places-panel hidden';
    parent.appendChild(this.root);
    this.root.addEventListener('keydown', this.onKeyDown);
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  /** 一覧の中身を作る（観光地に入ったときに呼ぶ） */
  setObjects(spotName: string, objects: SceneObject[], onPick: (index: number) => void): void {
    this.objects = objects;
    this.onPick = onPick;
    const items = objects
      .map(
        (o, i) => `
        <button class="place-card" data-index="${i}">
          <span class="place-card__pin">📍</span>
          <span class="place-card__text">
            <span class="place-card__name">${this.esc(o.name)}</span>
            <span class="place-card__ja">${this.esc(o.nameJa ?? '')}</span>
          </span>
          <span class="place-card__go">▶ Go</span>
        </button>`,
      )
      .join('');

    this.root.innerHTML = `
      <div class="places-panel__head">
        <div class="places-panel__title">🗺️ ${this.esc(spotName)}</div>
        <div class="places-panel__sub">Where do you want to go?</div>
        <div class="places-panel__keys">
          <kbd>↑</kbd><kbd>↓</kbd> choose ・ <kbd>Enter</kbd> go ・ <kbd>Esc</kbd> close
        </div>
      </div>
      <div class="places-list">${items}</div>
    `;

    for (const btn of Array.from(this.root.querySelectorAll<HTMLButtonElement>('.place-card'))) {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.index);
        this.hide();
        this.onPick(i);
      });
    }
  }

  show(): void {
    if (!this.objects.length) return;
    this.root.classList.remove('hidden');
    // キーボードだけで選べるよう、最初の場所にフォーカスを当てる
    setTimeout(() => this.cards()[0]?.focus(), 0);
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.onClose?.();
  }

  toggle(): void {
    if (this.isOpen) this.hide();
    else this.show();
  }

  private cards(): HTMLButtonElement[] {
    return Array.from(this.root.querySelectorAll<HTMLButtonElement>('.place-card'));
  }

  /** ↑↓ で選び、Esc で閉じる（Enter はボタンの既定動作） */
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Escape') {
      e.preventDefault();
      this.hide();
      return;
    }
    if (e.code !== 'ArrowUp' && e.code !== 'ArrowDown') return;
    e.preventDefault();
    e.stopPropagation();
    const cards = this.cards();
    if (!cards.length) return;
    const now = cards.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.code === 'ArrowDown' ? now + 1 : now - 1;
    if (next < 0 || next >= cards.length) return;
    cards[next].focus();
  };

  private esc(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
