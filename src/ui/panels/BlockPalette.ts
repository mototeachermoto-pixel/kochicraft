import type { EditorManager } from '@/editor/EditorManager';

/**
 * 画面下のブロック選択パレット（仕様レイアウトの「下：ブロック一覧」）。
 * 各ブロックを色見本＋日本語名のボタンで並べ、クリックで選択する。
 * 数字キーやスポイトで選択が変わった場合も、ここのハイライトが追従する。
 */
export class BlockPalette {
  private readonly root: HTMLElement;
  private readonly items = new Map<number, HTMLElement>();

  constructor(parent: HTMLElement, private readonly editor: EditorManager) {
    this.root = document.createElement('div');
    this.root.className = 'block-palette';
    parent.appendChild(this.root);

    this.build();

    // スポイトや数字キーでの選択変更に追従
    this.editor.onSelectionChange = (id) => this.highlight(id);
    this.highlight(this.editor.selectedBlockId);
  }

  /** ブロックボタンを生成 */
  private build(): void {
    this.editor.blocks.forEach((block, index) => {
      const item = document.createElement('button');
      item.className = 'palette-item';
      item.title = `${block.name} (${block.nameEn})`;

      const swatch = document.createElement('span');
      swatch.className = 'palette-swatch';
      swatch.style.background = block.color;
      // 半透明ブロックは市松模様の上に色を重ねて分かるように
      if (block.transparent) swatch.classList.add('is-transparent');

      const name = document.createElement('span');
      name.className = 'palette-name';
      name.textContent = block.name;

      // 先頭9個はショートカット番号を表示
      if (index < 9) {
        const key = document.createElement('span');
        key.className = 'palette-key';
        key.textContent = String(index + 1);
        item.appendChild(key);
      }

      item.appendChild(swatch);
      item.appendChild(name);
      item.addEventListener('click', () => this.editor.setSelectedBlock(block.id));

      this.items.set(block.id, item);
      this.root.appendChild(item);
    });
  }

  /** 選択中のブロックを強調表示し、見えるようスクロール */
  private highlight(id: number): void {
    for (const [bid, el] of this.items) {
      el.classList.toggle('is-selected', bid === id);
    }
    this.items.get(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /** 表示/非表示（移動モードでは隠す） */
  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }
}
