import type { SpeechService } from '@/features/language/SpeechService';
import type { SceneObject } from '@/spots/SpotDefinition';
import { GuideStore, type GuideField } from '@/data/GuideStore';
import { PhotoStore } from '@/data/PhotoStore';
import { isGasPhoto, loadGasPhoto } from '@/data/GasPhotos';
export interface InfoPanelHandlers {
  onClose: () => void;
  /** 写真をアップロードした（端末に保存できたら true） */
  onPhoto: (obj: SceneObject, dataUrl: string) => boolean;
  /** 英語音声をアップロードした（端末に保存できたら true） */
  onAudio: (obj: SceneObject, dataUrl: string) => boolean;
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
  /** 写真・音声を保存できなかったときの知らせ（空なら出さない） */
  private notice = '';
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
    this.notice = '';
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

  /** Listen：録音があれば録音を、なければ端末の自動音声で英語（About＋付け足し）を再生 */
  private listen(obj: SceneObject): void {
    this.stopAudio();
    const text = this.fullText(obj, 'about');
    if (obj.audio) {
      this.audioEl.src = obj.audio;
      this.audioEl.currentTime = 0;
      // AbortError＝連打などで次の再生に切り替わっただけ（失敗ではない）。自動音声を重ねない
      void this.audioEl.play().catch((e: unknown) => {
        if ((e as DOMException)?.name !== 'AbortError') this.speech.speak(text, 'en');
      });
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
          ? `<img class="info-panel__img" ${isGasPhoto(o.image) ? '' : `src="${o.image}"`} alt="${this.esc(o.name)}" />`
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
      ${this.notice ? `<div class="info-notice" role="alert">⚠ ${this.esc(this.notice)}</div>` : ''}
    `;

    const q = <T extends HTMLElement>(s: string) => this.root.querySelector(s) as T;
    q('[data-role="close"]').addEventListener('click', () => this.handlers.onClose());

    // アップロード写真が表示できない（壊れている・HEIC など）ときは、同梱の元の写真に戻す
    const img = this.root.querySelector<HTMLImageElement>('.info-panel__img');
    if (img && o.imageDefault && o.image !== o.imageDefault) {
      img.addEventListener('error', () => {
        o.image = o.imageDefault;
        this.setImage(img, o.imageDefault!);
      }, { once: true });
    }
    if (img && isGasPhoto(o.image)) this.setImage(img, o.image);
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
    const spotAtUpload = this.spotId;
    photo.addEventListener('change', () => this.readFile(photo, async (url) => {
      const small = await PhotoStore.shrinkPhoto(url);
      // 縮めている間に別の観光地へ移っていたら、取り違えないよう保存しない
      if (this.spotId !== spotAtUpload) return;
      const saved = this.handlers.onPhoto(o, small);
      if (this.current !== o) return;
      this.notice = saved ? '' : 'This photo could not be saved. The storage is full.';
      this.render();
    }));

    const audio = q<HTMLInputElement>('[data-role="audio"]');
    audio.addEventListener('change', () => this.readFile(audio, (url) => {
      const saved = this.handlers.onAudio(o, url);
      this.notice = saved ? '' : 'This voice could not be saved. The storage is full.';
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

  /** 写真を表示する。GAS で動いているときの同梱写真は、サーバーから受け取ってから表示する */
  private setImage(img: HTMLImageElement, src: string): void {
    if (!isGasPhoto(src)) {
      img.src = src;
      return;
    }
    loadGasPhoto(src)
      .then((url) => {
        if (img.isConnected) img.src = url;
      })
      .catch(() => {
        // 受け取れなかったときは空欄のまま（次に開いたときにもう一度頼む）
      });
  }

  private esc(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
