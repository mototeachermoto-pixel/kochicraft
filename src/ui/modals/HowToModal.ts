/**
 * 「あそびかた」モーダル。
 * 小学生にも分かるよう、操作を絵文字つきで一覧表示する。
 */
export class HowToModal {
  private readonly root: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'modal hidden';
    this.root.innerHTML = `
      <div class="modal__backdrop" data-role="backdrop"></div>
      <div class="modal__card">
        <div class="learn-head">
          <div class="modal__title">❓ あそびかた</div>
          <button class="tourism-popup__close" data-role="close">✖</button>
        </div>
        <div class="howto-list">
          <div class="howto-item"><span class="howto-key">クリック</span>あそびを はじめる（マウスで見回す）</div>
          <div class="howto-item"><span class="howto-key">W A S D</span>まえ・うしろ・よこ に あるく</div>
          <div class="howto-item"><span class="howto-key">スペース</span>ジャンプする</div>
          <div class="howto-item"><span class="howto-key">右クリック</span>ブロックを <b>おく</b></div>
          <div class="howto-item"><span class="howto-key">左クリック</span>ブロックを <b>こわす</b></div>
          <div class="howto-item"><span class="howto-key">中クリック</span>スポイト（同じブロックを えらぶ）</div>
          <div class="howto-item"><span class="howto-key">1〜9</span>ブロックを えらぶ</div>
          <div class="howto-item"><span class="howto-key">🗺️ 観光</span>観光地に 近づくと せつめいが でる</div>
          <div class="howto-item"><span class="howto-key">📖 えいご</span>英語で 観光あんないを 学ぶ</div>
          <div class="howto-item"><span class="howto-key">🧩 クイズ</span>高知の クイズに ちょうせん</div>
          <div class="howto-item"><span class="howto-key">💾 ほぞん</span>作品を 保存・読み込み</div>
          <div class="howto-item"><span class="howto-key">Esc</span>そうさを やめる</div>
        </div>
        <div class="modal__actions">
          <button class="kc-btn" data-role="ok"><span class="kc-btn__icon">👍</span>わかった！</button>
        </div>
      </div>
    `;
    parent.appendChild(this.root);

    const close = () => this.hide();
    this.root.querySelector('[data-role="backdrop"]')!.addEventListener('click', close);
    this.root.querySelector('[data-role="close"]')!.addEventListener('click', close);
    this.root.querySelector('[data-role="ok"]')!.addEventListener('click', close);
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}
