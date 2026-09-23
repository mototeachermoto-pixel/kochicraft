import type { Landmark } from '@/types';

/** 編集結果の通知 */
export interface LandmarkEditorHandlers {
  onSaved: (landmark: Landmark) => void;
  onDeleted: (id: string) => void;
}

/**
 * 観光地の編集モーダル。
 * 名前(日英)・説明(日英)・読み上げ文(日英)・写真・半径を編集できる。
 * 写真はローカルファイルを読み込んで dataURL として保持する（外部送信なし）。
 */
export class LandmarkEditor {
  private readonly root: HTMLElement;
  private current: Landmark | null = null;
  private pendingImage: string | undefined;

  constructor(parent: HTMLElement, private readonly handlers: LandmarkEditorHandlers) {
    this.root = document.createElement('div');
    this.root.className = 'modal hidden';
    parent.appendChild(this.root);
  }

  /** 指定の観光地を編集する */
  open(landmark: Landmark): void {
    this.current = landmark;
    this.pendingImage = landmark.image;
    this.render();
    this.root.classList.remove('hidden');
  }

  close(): void {
    this.root.classList.add('hidden');
    this.current = null;
  }

  private render(): void {
    const lm = this.current;
    if (!lm) return;

    this.root.innerHTML = `
      <div class="modal__backdrop" data-role="backdrop"></div>
      <div class="modal__card">
        <div class="modal__title">📍 観光地のへんしゅう</div>
        <div class="form-grid">
          <label>名前（日本語）<input data-f="titleJa" value="${this.attr(lm.titleJa)}" /></label>
          <label>名前（英語）<input data-f="titleEn" value="${this.attr(lm.titleEn)}" /></label>
          <label class="full">説明（日本語）<textarea data-f="descJa" rows="2">${this.text(lm.descJa)}</textarea></label>
          <label class="full">説明（英語）<textarea data-f="descEn" rows="2">${this.text(lm.descEn)}</textarea></label>
          <label class="full">よみあげ文（日本語）<input data-f="speechJa" value="${this.attr(lm.speech.ja)}" /></label>
          <label class="full">よみあげ文（英語）<input data-f="speechEn" value="${this.attr(lm.speech.en)}" /></label>
          <label>半径 <b data-role="radval">${lm.radius}</b>
            <input type="range" min="3" max="20" step="1" value="${lm.radius}" data-f="radius" />
          </label>
          <label>写真
            <input type="file" accept="image/*" data-f="image" />
          </label>
        </div>
        <div class="modal__preview" data-role="preview">
          ${this.pendingImage ? `<img src="${this.pendingImage}" alt="preview" />` : '<span>写真なし</span>'}
        </div>
        <div class="modal__actions">
          <button class="kc-btn" data-role="save"><span class="kc-btn__icon">💾</span>ほぞん</button>
          <button class="kc-mini" data-role="delete">🗑️ この観光地をけす</button>
          <button class="kc-mini" data-role="cancel">とじる</button>
        </div>
      </div>
    `;

    this.wire();
  }

  private wire(): void {
    const q = <T extends HTMLElement>(s: string) => this.root.querySelector(s) as T;

    q('[data-role="backdrop"]').addEventListener('click', () => this.close());
    q('[data-role="cancel"]').addEventListener('click', () => this.close());

    const radius = q<HTMLInputElement>('[data-f="radius"]');
    radius.addEventListener('input', () => {
      q('[data-role="radval"]').textContent = radius.value;
    });

    // 写真の読み込み（dataURL化）
    const fileInput = q<HTMLInputElement>('[data-f="image"]');
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.pendingImage = reader.result as string;
        const preview = q('[data-role="preview"]');
        preview.innerHTML = `<img src="${this.pendingImage}" alt="preview" />`;
      };
      reader.readAsDataURL(file);
    });

    q('[data-role="save"]').addEventListener('click', () => this.save());
    q('[data-role="delete"]').addEventListener('click', () => {
      if (this.current) {
        const id = this.current.id;
        this.close();
        this.handlers.onDeleted(id);
      }
    });
  }

  private save(): void {
    const lm = this.current;
    if (!lm) return;
    const val = (f: string) =>
      (this.root.querySelector(`[data-f="${f}"]`) as HTMLInputElement | HTMLTextAreaElement)?.value ?? '';

    lm.titleJa = val('titleJa');
    lm.titleEn = val('titleEn');
    lm.descJa = val('descJa');
    lm.descEn = val('descEn');
    lm.speech = { ja: val('speechJa'), en: val('speechEn') };
    lm.radius = Number(val('radius')) || lm.radius;
    lm.image = this.pendingImage;

    this.handlers.onSaved(lm);
    this.close();
  }

  /** 属性値用エスケープ */
  private attr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
  /** テキスト要素用エスケープ */
  private text(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
