import { blockRegistry } from '@/world/BlockRegistry';

/**
 * 編集（Build）モードのホットバー（Minecraft風）。
 * 下中央に「スロット」を並べ、色スウォッチ＋番号＋英語名で示す。
 * スロットは折り返して全部が一度に見える（スクロール不要）。
 * タップ、または数字キー（1〜9・0）で選べる。上に「置き方」の英語説明を出す。
 * 子ども向けに少数の自然系ブロックだけ（岩・木・花など）。マウス不使用。
 */
const PALETTE_KEYS = [
  'grass',
  'dirt',
  'stone',
  'sand',
  'wood',
  'leaves',
  'flower',
  'sakura',
  'brick',
  'glass',
];

/** 置き方の英語説明（小学5年生レベル・短く） */
const HELP_TEXT = 'Tap a block to put one. Hold on your block to take it. The blue box shows where.';

export class BuildPalette {
  private readonly root: HTMLElement;
  private readonly slotEls: HTMLElement[] = [];
  private readonly ids: number[] = [];
  private activeIndex = 0;

  constructor(
    parent: HTMLElement,
    private readonly onPick: (id: number) => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'build-hotbar hidden';

    // 置き方の説明（英語・小5）
    const help = document.createElement('div');
    help.className = 'hotbar-help';
    help.textContent = HELP_TEXT;
    this.root.appendChild(help);

    const slots = document.createElement('div');
    slots.className = 'hotbar-slots';
    this.root.appendChild(slots);
    this.slotsEl = slots;
    this.fill(PALETTE_KEYS);

    parent.appendChild(this.root);
    this.highlight();
  }

  private readonly slotsEl: HTMLElement;

  /** 選べるブロックを入れかえる（名所の注文で使うブロックを出すため）。なければいつもの10こ */
  setKeys(keys: string[] | undefined): void {
    this.fill(keys && keys.length ? keys : PALETTE_KEYS);
    this.activeIndex = 0;
    this.highlight();
    this.onPick(this.getActiveId());
  }

  private fill(keys: string[]): void {
    const slots = this.slotsEl;
    slots.innerHTML = '';
    this.slotEls.length = 0;
    this.ids.length = 0;
    keys.slice(0, 10).forEach((key) => {
      const block = blockRegistry.getByKey(key);
      if (!block) return;
      const idx = this.ids.length;
      this.ids.push(block.id);
      const num = (idx + 1) % 10; // 1..9, そして10個目は 0
      const btn = document.createElement('button');
      btn.className = 'hotbar-slot';
      btn.title = block.nameEn;
      // 番号＋色＋英語名（下に表示）
      btn.innerHTML =
        `<span class="hotbar-num">${num}</span>` +
        `<span class="hotbar-swatch" style="background:${block.color}"></span>` +
        `<span class="hotbar-label">${block.nameEn}</span>`;
      btn.addEventListener('click', () => this.selectIndex(idx));
      slots.appendChild(btn);
      this.slotEls.push(btn);
    });
  }

  /** いま選んでいるブロックID */
  getActiveId(): number {
    return this.ids[this.activeIndex] ?? 1;
  }

  show(): void {
    this.root.classList.remove('hidden');
  }
  hide(): void {
    this.root.classList.add('hidden');
  }

  /** i番目（0始まり）を選ぶ */
  selectIndex(i: number): void {
    if (i < 0 || i >= this.ids.length) return;
    this.activeIndex = i;
    this.highlight();
    this.onPick(this.ids[i]);
  }

  /** ブロックIDで選ぶ（パレットにあれば） */
  selectId(id: number): void {
    const i = this.ids.indexOf(id);
    if (i >= 0 && i !== this.activeIndex) {
      this.activeIndex = i;
      this.highlight();
    }
  }

  /** ブロックの key で選ぶ */
  selectKey(key: string): void {
    const id = blockRegistry.getByKey(key)?.id;
    const i = id === undefined ? -1 : this.ids.indexOf(id);
    if (i >= 0) this.selectIndex(i);
  }

  /** 数字キーから選ぶ（1〜9 → 0..8番目、0 → 10番目） */
  selectByDigit(digit: number): void {
    const idx = digit === 0 ? 9 : digit - 1;
    this.selectIndex(idx);
  }

  private highlight(): void {
    this.slotEls.forEach((el, i) => el.classList.toggle('is-active', i === this.activeIndex));
  }
}
