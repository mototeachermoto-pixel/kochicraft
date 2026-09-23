import type { EditorManager } from '@/editor/EditorManager';

/**
 * 画面右の編集ツールパネル（仕様レイアウトの「右パネル：編集ツール・プロパティ」）。
 * ツールの選択、ブラシの大きさ、範囲選択の操作（コピー/はりつけ/回転/けす）、
 * グリッド表示の切替をまとめる。
 */
export class RightPanel {
  private readonly root: HTMLElement;
  private readonly toolBtns = new Map<string, HTMLButtonElement>();

  private brushWrap!: HTMLElement;
  private brushSlider!: HTMLInputElement;
  private brushVal!: HTMLElement;

  private selWrap!: HTMLElement;
  private copyBtn!: HTMLButtonElement;
  private pasteBtn!: HTMLButtonElement;
  private rotBtn!: HTMLButtonElement;
  private delBtn!: HTMLButtonElement;

  private gridBtn!: HTMLButtonElement;
  private undoBtn!: HTMLButtonElement;
  private redoBtn!: HTMLButtonElement;

  constructor(parent: HTMLElement, private readonly editor: EditorManager) {
    this.root = document.createElement('div');
    this.root.className = 'right-panel';
    parent.appendChild(this.root);

    this.build();
    this.wire();

    this.editor.onToolChange = () => this.updateTool();
    this.editor.onSelectionStateChange = () => this.updateSelectionButtons();
    this.editor.history.onChange = () => this.updateHistory();
    this.updateTool();
    this.updateSelectionButtons();
    this.updateHistory();
  }

  private build(): void {
    // ツールボタン
    const toolsHtml = this.editor
      .getTools()
      .map(
        (t) =>
          `<button class="tool-item" data-tool="${t.id}">
             <span class="tool-item__icon">${t.icon}</span>
             <span class="tool-item__name">${t.name}</span>
           </button>`,
      )
      .join('');

    this.root.innerHTML = `
      <div class="panel-title">どうぐ</div>
      <div class="opt-grid2">
        <button class="kc-mini" data-role="undo">↩️ もどす</button>
        <button class="kc-mini" data-role="redo">↪️ やりなおす</button>
      </div>
      <div class="tool-list">${toolsHtml}</div>
      <div class="tool-options">
        <div class="opt-brush hidden" data-role="brush">
          <div class="opt-label">ふでの大きさ <b data-role="brushval">1</b></div>
          <input type="range" min="1" max="4" step="1" value="1" data-role="brushslider" />
        </div>
        <div class="opt-select hidden" data-role="select">
          <div class="opt-label">はんいの そうさ</div>
          <div class="opt-grid2">
            <button class="kc-mini" data-role="copy">📋 コピー</button>
            <button class="kc-mini" data-role="paste">📌 はりつけ</button>
            <button class="kc-mini" data-role="rotate">🔄 回す</button>
            <button class="kc-mini" data-role="delsel">🗑️ けす</button>
          </div>
        </div>
      </div>
      <button class="kc-mini kc-mini--wide" data-role="grid">🔳 グリッド</button>
    `;

    for (const btn of Array.from(this.root.querySelectorAll<HTMLButtonElement>('.tool-item'))) {
      const id = btn.dataset.tool!;
      this.toolBtns.set(id, btn);
    }
    this.brushWrap = this.q('[data-role="brush"]');
    this.brushSlider = this.q('[data-role="brushslider"]');
    this.brushVal = this.q('[data-role="brushval"]');
    this.selWrap = this.q('[data-role="select"]');
    this.copyBtn = this.q('[data-role="copy"]');
    this.pasteBtn = this.q('[data-role="paste"]');
    this.rotBtn = this.q('[data-role="rotate"]');
    this.delBtn = this.q('[data-role="delsel"]');
    this.gridBtn = this.q('[data-role="grid"]');
    this.undoBtn = this.q('[data-role="undo"]');
    this.redoBtn = this.q('[data-role="redo"]');
  }

  private q<T extends HTMLElement>(sel: string): T {
    return this.root.querySelector(sel) as T;
  }

  private wire(): void {
    for (const [id, btn] of this.toolBtns) {
      btn.addEventListener('click', () => this.editor.setTool(id));
    }

    this.brushSlider.addEventListener('input', () => {
      const n = Number(this.brushSlider.value);
      this.editor.setBrushSize(n);
      this.brushVal.textContent = String(n);
    });

    this.copyBtn.addEventListener('click', () => this.editor.copySelection());
    this.pasteBtn.addEventListener('click', () => this.editor.pasteAtTarget());
    this.rotBtn.addEventListener('click', () => this.editor.rotateClipboard());
    this.delBtn.addEventListener('click', () => this.editor.deleteSelection());

    this.gridBtn.addEventListener('click', () => {
      this.editor.toggleGrid();
      this.gridBtn.classList.toggle('is-active', this.editor.gridVisible);
    });

    this.undoBtn.addEventListener('click', () => this.editor.undo());
    this.redoBtn.addEventListener('click', () => this.editor.redo());
  }

  /** Undo/Redoボタンの有効状態を更新 */
  private updateHistory(): void {
    this.undoBtn.disabled = !this.editor.history.canUndo();
    this.redoBtn.disabled = !this.editor.history.canRedo();
  }

  /** 選択中ツールに合わせて見た目とオプション表示を更新 */
  private updateTool(): void {
    const current = this.editor.currentToolId;
    for (const [id, btn] of this.toolBtns) {
      btn.classList.toggle('is-active', id === current);
    }
    const meta = this.editor.getTools().find((t) => t.id === current);
    this.brushWrap.classList.toggle('hidden', !meta?.usesBrushSize);
    this.selWrap.classList.toggle('hidden', current !== 'select');
  }

  /** コピー等ボタンの有効/無効を更新 */
  private updateSelectionButtons(): void {
    const hasSel = this.editor.hasSelection();
    const hasClip = this.editor.hasClipboard();
    this.copyBtn.disabled = !hasSel;
    this.delBtn.disabled = !hasSel;
    this.pasteBtn.disabled = !hasClip;
    this.rotBtn.disabled = !hasClip;
  }
}
