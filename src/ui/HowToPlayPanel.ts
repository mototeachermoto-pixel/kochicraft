/**
 * 最初の画面（観光地の一覧）から開ける「あそびかた（せつめい）」。
 * 子どもから「最初の画面に『説明』があって、そこに操作方法が書いてあるとよい」という声があったため。
 * iPad の画面でさわる操作と、キーボードの操作を並べて書く。
 * 英語は小5レベル。読みやすいよう、小さく日本語も添える。
 */
interface HowToRow {
  /** 何をするか（英語） */
  what: string;
  /** 何をするか（日本語） */
  ja: string;
  /** iPad の画面でさわる操作 */
  touch: string;
  /** キーボードの操作 */
  keys: string;
}

const k = (s: string) => `<kbd>${s}</kbd>`;

const SECTIONS: { title: string; ja: string; rows: HowToRow[] }[] = [
  {
    title: '1. Go to a place',
    ja: 'ばしょに行く',
    rows: [
      { what: 'Choose a place', ja: '行きたい場所をえらぶ', touch: 'Tap a card', keys: `${k('↑')}${k('↓')}${k('←')}${k('→')} → ${k('Enter')}` },
    ],
  },
  {
    title: '2. Walk',
    ja: 'あるく',
    rows: [
      { what: 'Walk', ja: 'あるく（スティックを指でうごかす）', touch: 'Slide the stick', keys: `${k('↑')}${k('↓')}${k('←')}${k('→')}` },
      { what: 'Look around', ja: 'まわりを見る', touch: 'Slide on the screen', keys: `${k('Shift')}+${k('←')}${k('→')} ・ ${k('U')} ${k('D')}` },
      { what: 'Jump', ja: 'ジャンプ', touch: 'JUMP button', keys: k('J') },
      { what: 'Map', ja: '行ける場所の一覧', touch: '🗺️ Map', keys: k('M') },
      { what: 'Go to the start', ja: 'スタートにもどる', touch: '🏠 Home', keys: k('H') },
    ],
  },
  {
    title: '3. Learn in English',
    ja: '英語でしらべる',
    rows: [
      { what: 'See the info', ja: 'せつめいを見る', touch: 'Tap a building', keys: `${k('Enter')} / ${k('I')}` },
      { what: 'Listen in English', ja: '英語を聞く', touch: '🔊 Listen', keys: k('E') },
      { what: 'Next thing', ja: 'つぎのものへ', touch: '—', keys: k('N') },
    ],
  },
  {
    title: '4. Build',
    ja: 'ブロックでつくる',
    rows: [
      { what: 'Start building', ja: 'つくりはじめる', touch: '🧱 Build', keys: k('B') },
      { what: 'Put a block', ja: 'ブロックをおく', touch: 'Tap a block ・ 🧱 Put', keys: k('P') },
      { what: 'Take my block', ja: '自分のブロックをとる', touch: 'Hold on it ・ ✋ Take', keys: k('T') },
      { what: 'Choose a block', ja: 'ブロックをえらぶ', touch: 'Tap a color', keys: `${k('1')}…${k('9')}${k('0')}` },
      { what: 'Stop building', ja: 'つくるのをやめる', touch: '✓ Done', keys: k('D') },
    ],
  },
  {
    title: '5. More',
    ja: 'そのほか',
    rows: [
      { what: 'Change view', ja: '見え方をかえる', touch: '🎥 button', keys: k('V') },
      { what: 'Change character', ja: 'キャラクターをかえる', touch: '🧍 button', keys: k('C') },
      { what: 'Look from the sky', ja: '空から見る', touch: '👀 Look', keys: k('L') },
      { what: 'Close / Back to list', ja: 'とじる・一覧にもどる', touch: '✕ Close ・ ← Back to list', keys: k('X') },
    ],
  },
];

export class HowToPlayPanel {
  private readonly root: HTMLElement;
  /** 開く前にフォーカスがあったところ（閉じたらそこへ戻す） */
  private returnFocus: HTMLElement | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'howto-panel hidden';
    this.root.innerHTML = `
      <div class="howto-panel__box" role="dialog" aria-modal="true" aria-label="How to play">
        <div class="howto-panel__head">
          <div>
            <div class="howto-panel__title">📖 How to play</div>
            <div class="howto-panel__ja">あそびかた</div>
          </div>
          <button class="kc-btn howto-panel__close" data-role="close">✕ Close <kbd>X</kbd></button>
        </div>
        <div class="howto-panel__cols">
          <span></span><span class="howto-panel__colhead">📱 iPad</span><span class="howto-panel__colhead">⌨️ Keyboard</span>
        </div>
        ${SECTIONS.map(
          (s) => `
          <div class="howto-panel__section">
            <div class="howto-panel__stitle">${s.title} <span class="howto-panel__sja">${s.ja}</span></div>
            ${s.rows
              .map(
                (r) => `
              <div class="howto-panel__row">
                <span class="howto-panel__what">${r.what}<small>${r.ja}</small></span>
                <span class="howto-panel__touch">${r.touch}</span>
                <span class="howto-panel__keys">${r.keys}</span>
              </div>`,
              )
              .join('')}
          </div>`,
        ).join('')}
      </div>`;
    parent.appendChild(this.root);

    this.root.querySelector('[data-role="close"]')!.addEventListener('click', () => this.close());
    // 箱の外（暗いところ）をさわっても閉じる
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
    this.root.addEventListener('keydown', (e) => {
      if (e.code === 'KeyX' || e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  open(): void {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.root.classList.remove('hidden');
    this.root.querySelector<HTMLElement>('.howto-panel__box')!.scrollTop = 0;
    // キーボードの X ですぐ閉じられるよう、閉じるボタンにフォーカスを当てる
    setTimeout(() => this.root.querySelector<HTMLButtonElement>('[data-role="close"]')?.focus(), 0);
  }

  close(): void {
    this.root.classList.add('hidden');
    this.returnFocus?.focus();
    this.returnFocus = null;
  }
}
