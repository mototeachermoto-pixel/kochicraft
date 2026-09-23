import type { Player } from '@/player/Player';
import type { TourismManager } from '@/features/tourism/TourismManager';

/**
 * 観光地リスト。
 * 高知の観光地を一覧表示し、クリックするとその場所へワープする。
 * ワープすると観光モードがオンになり、説明ポップアップが出る。
 */
export class PlacesPanel {
  private readonly root: HTMLElement;

  constructor(
    parent: HTMLElement,
    private readonly tourism: TourismManager,
    private readonly player: Player,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'modal hidden';
    parent.appendChild(this.root);
  }

  open(): void {
    this.render();
    this.root.classList.remove('hidden');
  }

  close(): void {
    this.root.classList.add('hidden');
  }

  private render(): void {
    const landmarks = this.tourism.getAll();
    const rows =
      landmarks.length === 0
        ? `<div class="learn-empty">観光地がありません。</div>`
        : landmarks
            .map(
              (l) => `
        <button class="place-card" data-go="${l.id}">
          <span class="place-card__name">${this.esc(l.titleJa)}</span>
          <span class="place-card__en">${this.esc(l.titleEn)}</span>
          <span class="place-card__go">✈️ ここへ 行く</span>
        </button>`,
            )
            .join('');

    this.root.innerHTML = `
      <div class="modal__backdrop" data-role="backdrop"></div>
      <div class="modal__card learn-card">
        <div class="learn-head">
          <div class="modal__title">🗺️ 高知の 観光地</div>
          <button class="tourism-popup__close" data-role="close">✖</button>
        </div>
        <div class="opt-label">行きたい 場所を えらぼう（ワープするよ）</div>
        <div class="place-list">${rows}</div>
      </div>
    `;

    this.root.querySelector('[data-role="backdrop"]')!.addEventListener('click', () => this.close());
    this.root.querySelector('[data-role="close"]')!.addEventListener('click', () => this.close());
    for (const btn of Array.from(this.root.querySelectorAll<HTMLElement>('[data-go]'))) {
      btn.addEventListener('click', () => {
        const lm = this.tourism.get(btn.dataset.go!);
        if (lm) this.tourism.warpTo(lm, this.player);
        this.close();
      });
    }
  }

  private esc(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
