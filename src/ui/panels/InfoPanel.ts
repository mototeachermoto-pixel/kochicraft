import type { SpeechService } from '@/features/language/SpeechService';
import type { SceneObject } from '@/spots/SpotDefinition';
import { GuideStore, type GuideField } from '@/data/GuideStore';

export interface InfoPanelHandlers {
  onClose: () => void;
  /** 写真をアップロードした */
  onPhoto: (obj: SceneObject, dataUrl: string) => void;
  /** 英語音声をアップロードした */
  onAudio: (obj: SceneObject, dataUrl: string) => void;
}

/**
 * 構造物をタップしたときに右側へ出す情報パネル。
 * 名称・できること(You can)・特徴(Special)・紹介(About) をやさしい英語で表示し、
 * 「Listen」で英語を再生（先生の録音があればそれを、なければ自動音声を再生）。
 * 写真・音声は先生がアップロードでき、保存される。
 * 各欄の「＋」ボタンで英文を書き足せる（基本文はそのまま。足した分だけ保存＝付け足し方式）。
 */
export class InfoPanel {
  private readonly root: HTMLElement;
  private current: SceneObject | null = null;
  private spotId = '';
  /** いま編集中の欄（null なら編集していない） */
  private editing: GuideField | null = null;
  private readonly audioEl = new Audio();

  constructor(
    parent: HTMLElement,
    private readonly speech: SpeechService,
    private readonly handlers: InfoPanelHandlers,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'info-panel hidden';
    parent.appendChild(this.root);
  }

  show(obj: SceneObject, spotId: string): void {
    this.current = obj;
    this.spotId = spotId;
    this.editing = null;
    this.render();
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.stopAudio();
    this.root.classList.add('hidden');
    this.current = null;
    this.editing = null;
  }

  private stopAudio(): void {
    this.speech.cancel();
    this.audioEl.pause();
  }

  /** 基本文＋付け足し文（あれば）をつなげて返す */
  private fullText(obj: SceneObject, field: GuideField): string {
    const base = obj.guide[field];
    const added = this.spotId ? GuideStore.get(this.spotId, obj.id, field) : '';
    return added ? `${base} ${added}` : base;
  }

  /** キーボード（L）から今開いている構造物の英語を再生する */
  listenCurrent(): void {
    if (this.current) this.listen(this.current);
  }

  /** Listen：録音があれば録音を、なければ自動音声で英語（About＋付け足し）を再生 */
  private listen(obj: SceneObject): void {
    this.stopAudio();
    const text = this.fullText(obj, 'about');
    if (obj.audio) {
      this.audioEl.src = obj.audio;
      this.audioEl.currentTime = 0;
      void this.audioEl.play().catch(() => this.speech.speak(text, 'en'));
    } else {
      this.speech.speak(text, 'en');
    }
  }

  /** 1つの欄（ラベル＋基本文＋付け足し文＋「＋」ボタン。編集中は入力欄） */
  private blockHtml(label: string, field: GuideField): string {
    const o = this.current;
    if (!o) return '';
    const added = this.spotId ? GuideStore.get(this.spotId, o.id, field) : '';
    const editor = this.editing === field
      ? `<div class="info-edit">
          <textarea class="info-edit__text" data-edit="${field}" rows="2"
            placeholder="Write more in English">${this.esc(added)}</textarea>
          <div class="info-edit__row">
            <button class="kc-btn info-edit__btn" data-save="${field}">✔ Save</button>
            <button class="kc-btn info-edit__btn info-edit__btn--clear" data-clear="${field}">✕ Clear</button>
          </div>
        </div>`
      : '';
    return `
      <div class="info-block">
        <div class="info-block__label">${label}
          <button class="info-add" data-add="${field}" title="Add words">＋</button>
        </div>
        <div class="info-block__text">${this.esc(o.guide[field])}${
          added ? ` <span class="info-added">${this.esc(added)}</span>` : ''
        }</div>
        ${editor}
      </div>`;
  }

  private render(): void {
    const o = this.current;
    if (!o) return;
    const voiceTag = o.audio ? '<span class="info-voice-tag">teacher voice</span>' : '';

    this.root.innerHTML = `
      <button class="info-panel__close" data-role="close" title="Close">✕ Close <kbd>Esc</kbd></button>
      <div class="info-panel__name">${this.esc(o.name)}</div>
      <div class="info-panel__ja">${this.esc(o.nameJa ?? '')}</div>
      ${
        o.image
          ? `<img class="info-panel__img" src="${o.image}" alt="${this.esc(o.name)}" />`
          : `<div class="info-panel__noimg">📷 No photo yet</div>`
      }
      ${this.blockHtml('You can', 'canDo')}
      ${this.blockHtml('Special', 'feature')}
      ${this.blockHtml('About', 'about')}

      <button class="kc-btn info-listen" data-role="listen">
        <span class="kc-btn__icon">🔊</span>Listen in English <kbd>E</kbd> ${voiceTag}
      </button>
      <div class="info-keyhint">Press <kbd>Tab</kbd> to move, <kbd>Enter</kbd> to push a button.</div>

      <div class="info-uploads">
        <label class="info-upload">📷 Add a photo
          <input type="file" accept="image/*" data-role="photo" hidden />
        </label>
        <label class="info-upload">🎤 Add a voice
          <input type="file" accept="audio/*" data-role="audio" hidden />
        </label>
      </div>
    `;

    const q = <T extends HTMLElement>(s: string) => this.root.querySelector(s) as T;
    q('[data-role="close"]').addEventListener('click', () => this.handlers.onClose());
    q('[data-role="listen"]').addEventListener('click', () => this.listen(o));

    // 「＋」＝付け足しの編集を開く／閉じる
    this.root.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = btn.dataset.add as GuideField;
        this.editing = this.editing === f ? null : f;
        this.render();
      });
    });
    // 保存（空にして保存すれば消える）
    this.root.querySelectorAll<HTMLButtonElement>('[data-save]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = btn.dataset.save as GuideField;
        const ta = this.root.querySelector<HTMLTextAreaElement>(`[data-edit="${f}"]`);
        if (ta && this.spotId) GuideStore.set(this.spotId, o.id, f, ta.value);
        this.editing = null;
        this.render();
      });
    });
    // クリア＝付け足しを消す（基本文は残る）
    this.root.querySelectorAll<HTMLButtonElement>('[data-clear]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = btn.dataset.clear as GuideField;
        if (this.spotId) GuideStore.set(this.spotId, o.id, f, '');
        this.editing = null;
        this.render();
      });
    });

    const photo = q<HTMLInputElement>('[data-role="photo"]');
    photo.addEventListener('change', () => this.readFile(photo, (url) => {
      this.handlers.onPhoto(o, url);
      this.render();
    }));

    const audio = q<HTMLInputElement>('[data-role="audio"]');
    audio.addEventListener('change', () => this.readFile(audio, (url) => {
      this.handlers.onAudio(o, url);
      this.render();
    }));
  }

  private readFile(input: HTMLInputElement, done: (dataUrl: string) => void): void {
    const f = input.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => done(reader.result as string);
    reader.readAsDataURL(f);
  }

  private esc(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
