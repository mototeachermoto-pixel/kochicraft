import type { SpotDefinition } from '@/spots/SpotDefinition';

/**
 * 起動時に出る「高知県 観光地一覧（ハブ）」。
 * 観光地をカードのグリッドで並べ、選ぶとその観光地ワールドへ入る。
 * UIはすべて英語表記。
 */
export class HubScreen {
  private readonly root: HTMLElement;

  constructor(
    parent: HTMLElement,
    spots: SpotDefinition[],
    private readonly onSelect: (spot: SpotDefinition) => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'hub-screen';

    const cards = spots
      .map(
        (s) => `
      <button class="spot-card ${s.available ? '' : 'is-soon'}" data-spot="${s.id}" ${s.available ? '' : 'disabled'}>
        <span class="spot-card__emoji">${s.emoji}</span>
        <span class="spot-card__name">${this.esc(s.name)}</span>
        <span class="spot-card__ja">${this.esc(s.nameJa)}</span>
        <span class="spot-card__status">${s.available ? '▶ Enter' : 'Coming soon'}</span>
      </button>`,
      )
      .join('');

    this.root.innerHTML = `
      <div class="hub-screen__head">
        <div class="hub-screen__title">Kochi Tourist Spots</div>
        <div class="hub-screen__sub">Choose a place to visit</div>
        <div class="hub-screen__keys">
          Push <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> to choose, then <kbd>Enter</kbd> to go.
        </div>
      </div>
      <div class="spot-grid">${cards}</div>
    `;
    parent.appendChild(this.root);

    for (const btn of Array.from(this.root.querySelectorAll<HTMLButtonElement>('.spot-card'))) {
      if (btn.disabled) continue;
      btn.addEventListener('click', () => {
        const spot = spots.find((s) => s.id === btn.dataset.spot);
        if (spot) this.onSelect(spot);
      });
    }

    // 矢印キーでカードを選べるようにする（マウス不使用で完結させる）
    this.root.addEventListener('keydown', this.onKeyDown);
  }

  /** 選べるカード（Coming soon は除く） */
  private cardList(): HTMLButtonElement[] {
    return Array.from(this.root.querySelectorAll<HTMLButtonElement>('.spot-card')).filter((b) => !b.disabled);
  }

  /** 矢印キーでフォーカスを移す。1行に何枚並んでいるかは実際の位置から求める */
  private onKeyDown = (e: KeyboardEvent): void => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!keys.includes(e.code)) return;
    const cards = this.cardList();
    if (!cards.length) return;
    e.preventDefault();

    const now = cards.indexOf(document.activeElement as HTMLButtonElement);
    if (now < 0) {
      cards[0].focus();
      return;
    }
    // 1行あたりの枚数＝先頭カードと同じ上端に並んでいる枚数
    const top = cards[0].getBoundingClientRect().top;
    const perRow = Math.max(1, cards.filter((c) => Math.abs(c.getBoundingClientRect().top - top) < 4).length);

    let next = now;
    if (e.code === 'ArrowLeft') next = now - 1;
    else if (e.code === 'ArrowRight') next = now + 1;
    else if (e.code === 'ArrowUp') next = now - perRow;
    else next = now + perRow;

    if (next < 0 || next >= cards.length) return;
    cards[next].focus();
  };

  show(): void {
    this.root.classList.remove('hidden');
    // キーボードだけで進めるよう、最初のカードにフォーカスを当てる
    setTimeout(() => this.cardList()[0]?.focus(), 0);
  }
  hide(): void {
    this.root.classList.add('hidden');
  }

  private esc(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
