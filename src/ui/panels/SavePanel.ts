import type { SaveManager } from '@/data/SaveManager';

/**
 * 保存・読込パネル（仕様レイアウトの「左パネル：保存」）。
 * 名前をつけて保存、保存スロットの一覧（ひらく/けす）、
 * ファイルへの書き出し・読み込み（配布・回収）をまとめる。
 */
export class SavePanel {
  private readonly root: HTMLElement;
  private message = '';

  constructor(parent: HTMLElement, private readonly saves: SaveManager) {
    this.root = document.createElement('div');
    this.root.className = 'modal hidden';
    parent.appendChild(this.root);
  }

  open(): void {
    this.message = '';
    this.render();
    this.root.classList.remove('hidden');
  }

  close(): void {
    this.root.classList.add('hidden');
  }

  private fmtDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  private render(): void {
    const slots = this.saves.listSlots();
    const available = this.saves.storageAvailable();

    const slotRows =
      slots.length === 0
        ? `<div class="learn-empty">まだ ほぞんした 作品が ありません。</div>`
        : slots
            .map(
              (s) => `
        <div class="admin-row">
          <span class="admin-row__name">${this.esc(s.title)} <small>${this.fmtDate(s.updatedAt)}</small></span>
          <span class="admin-row__btns">
            <button class="kc-mini" data-load="${s.slot}">📂 ひらく</button>
            <button class="kc-mini" data-del="${s.slot}">🗑️</button>
          </span>
        </div>`,
            )
            .join('');

    this.root.innerHTML = `
      <div class="modal__backdrop" data-role="backdrop"></div>
      <div class="modal__card learn-card">
        <div class="learn-head">
          <div class="modal__title">💾 ほぞん・よみこみ</div>
          <button class="tourism-popup__close" data-role="close">✖</button>
        </div>

        ${available ? '' : '<div class="learn-empty">このブラウザでは スロット保存が使えません。ファイル書き出しを使ってね。</div>'}
        ${this.message ? `<div class="save-msg">${this.esc(this.message)}</div>` : ''}

        <div class="save-newrow">
          <input type="text" data-role="title" placeholder="作品の なまえ" value="わたしの高知" />
          <button class="kc-btn" data-role="save"><span class="kc-btn__icon">💾</span>ほぞん</button>
        </div>

        <div class="learn-section-head"><span>ほぞんした 作品（${slots.length}）</span></div>
        <div class="admin-list">${slotRows}</div>

        <div class="learn-section-head"><span>ファイル（配布・回収）</span></div>
        <div class="opt-grid2">
          <button class="kc-mini" data-role="export">⬇️ ファイルに書き出し</button>
          <button class="kc-mini" data-role="import">⬆️ ファイルから読み込み</button>
        </div>
        <input type="file" accept=".kcw,application/json" data-role="file" style="display:none" />
      </div>
    `;

    this.wire();
  }

  private wire(): void {
    const root = this.root;
    const titleInput = () => (root.querySelector('[data-role="title"]') as HTMLInputElement)?.value ?? '';

    root.querySelector('[data-role="backdrop"]')!.addEventListener('click', () => this.close());
    root.querySelector('[data-role="close"]')!.addEventListener('click', () => this.close());

    root.querySelector('[data-role="save"]')!.addEventListener('click', () => {
      const info = this.saves.saveToSlot(titleInput());
      this.message = `「${info.title}」を ほぞんしました。`;
      this.render();
    });

    for (const btn of Array.from(root.querySelectorAll<HTMLElement>('[data-load]'))) {
      btn.addEventListener('click', () => {
        const ok = this.saves.loadSlot(btn.dataset.load!);
        if (ok) this.close();
        else {
          this.message = '読み込みに しっぱいしました。';
          this.render();
        }
      });
    }
    for (const btn of Array.from(root.querySelectorAll<HTMLElement>('[data-del]'))) {
      btn.addEventListener('click', () => {
        this.saves.deleteSlot(btn.dataset.del!);
        this.render();
      });
    }

    root.querySelector('[data-role="export"]')!.addEventListener('click', () => {
      this.saves.exportFile(titleInput());
      this.message = 'ファイルに 書き出しました。';
      this.render();
    });

    const fileInput = root.querySelector('[data-role="file"]') as HTMLInputElement;
    root.querySelector('[data-role="import"]')!.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const ok = await this.saves.importFile(file);
      if (ok) this.close();
      else {
        this.message = 'このファイルは 読み込めませんでした。';
        this.render();
      }
    });
  }

  private esc(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
