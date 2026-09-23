import type { Clock } from '@/core/Clock';
import type { InputManager } from '@/core/InputManager';
import type { EditorManager } from '@/editor/EditorManager';
import type { Player } from '@/player/Player';
import type { TourismManager } from '@/features/tourism/TourismManager';
import type { SpeechService } from '@/features/language/SpeechService';
import type { LanguageManager } from '@/features/language/LanguageManager';
import type { QuizManager } from '@/features/quiz/QuizManager';
import type { TeacherManager } from '@/features/teacher/TeacherManager';
import type { SaveManager } from '@/data/SaveManager';
import type { Lang } from '@/types';
import { bus } from '@/state/EventBus';
import { BlockPalette } from './panels/BlockPalette';
import { RightPanel } from './panels/RightPanel';
import { TourismPopup } from './panels/TourismPopup';
import { LearningPanel } from './panels/LearningPanel';
import { QuizPlay } from './panels/QuizPlay';
import { TeacherPanel } from './panels/TeacherPanel';
import { SavePanel } from './panels/SavePanel';
import { PlacesPanel } from './panels/PlacesPanel';
import { TitleScreen } from './TitleScreen';
import { LandmarkEditor } from './modals/LandmarkEditor';
import { QuizEditor } from './modals/QuizEditor';
import { HowToModal } from './modals/HowToModal';

/**
 * 画面に重ねるHUD。各モード切替ボタン・操作ガイド・各種パネルをまとめる。
 * 小学生にも分かるよう、大きなアイコン付きボタンと日本語ガイドで構成する。
 *
 * レイアウト：左上＝モード/画面の切替、右＝編集ツール（Undo/Redo含む）、
 * 下＝ブロック一覧、画面中央上＝観光ポップアップ、各モーダル。
 */
export class HUD {
  private readonly root: HTMLElement;
  private modeBtn!: HTMLButtonElement;
  private dayBtn!: HTMLButtonElement;
  private autoBtn!: HTMLButtonElement;
  private tourBtn!: HTMLButtonElement;
  private langBtn!: HTMLButtonElement;
  private quizBtn!: HTMLButtonElement;
  private teacherBtn!: HTMLButtonElement;
  private saveBtn!: HTMLButtonElement;
  private statsEl!: HTMLElement;
  private overlay!: HTMLElement;

  private palette!: BlockPalette;
  private rightPanel!: RightPanel;
  private popup!: TourismPopup;
  private learningPanel!: LearningPanel;
  private quizPlay!: QuizPlay;
  private teacherPanel!: TeacherPanel;
  private savePanel!: SavePanel;
  private placesPanel!: PlacesPanel;
  private titleScreen!: TitleScreen;
  private howToModal!: HowToModal;
  private landmarkEditor!: LandmarkEditor;
  private quizEditor!: QuizEditor;
  private crosshairEl!: HTMLElement;
  private toastEl!: HTMLElement;

  private fpsAccum = 0;
  private fpsFrames = 0;

  constructor(
    root: HTMLElement,
    private readonly clock: Clock,
    private readonly input: InputManager,
    private readonly editor: EditorManager,
    private readonly tourism: TourismManager,
    private readonly speech: SpeechService,
    private readonly player: Player,
    private readonly language: LanguageManager,
    private readonly quizzes: QuizManager,
    private readonly teacher: TeacherManager,
    private readonly saves: SaveManager,
  ) {
    this.root = root;
    this.build();
    this.wire();
  }

  private build(): void {
    this.root.innerHTML = `
      <div class="crosshair"></div>
      <div class="hud-buttons">
        <button class="kc-btn" data-role="mode"><span class="kc-btn__icon">🔨</span><span data-label="mode">つくる</span></button>
        <button class="kc-btn" data-role="day"><span class="kc-btn__icon">🌗</span>昼夜</button>
        <button class="kc-btn" data-role="auto"><span class="kc-btn__icon">⏱️</span><span data-label="auto">時間：とまる</span></button>
        <button class="kc-btn" data-role="tour"><span class="kc-btn__icon">🗺️</span>観光地</button>
        <button class="kc-btn" data-role="lang"><span class="kc-btn__icon">📖</span>えいご学習</button>
        <button class="kc-btn" data-role="quiz"><span class="kc-btn__icon">🧩</span>クイズ</button>
        <button class="kc-btn" data-role="teacher"><span class="kc-btn__icon">👩‍🏫</span>先生</button>
        <button class="kc-btn" data-role="save"><span class="kc-btn__icon">💾</span>ほぞん</button>
      </div>
      <div class="hud-help">
        <div><b>WASD</b>：移動　<b>マウス</b>：見回す　<b>スペース</b>：ジャンプ</div>
        <div><b>左クリック</b>：こわす　<b>右クリック</b>：おく　<b>中クリック</b>：スポイト</div>
        <div><b>1〜9</b>：ブロック　<b>B</b>：モード　<b>Ctrl+Z</b>：もどす　<b>Esc</b>：終了</div>
      </div>
      <div class="hud-stats" data-role="stats">FPS --</div>
      <div class="click-start" data-role="overlay">
        <div class="click-start__big">🖱️ クリックして はじめる</div>
        <div class="click-start__sub">マウスで見回して、WASDで歩こう</div>
      </div>
    `;

    this.modeBtn = this.q('[data-role="mode"]');
    this.dayBtn = this.q('[data-role="day"]');
    this.autoBtn = this.q('[data-role="auto"]');
    this.tourBtn = this.q('[data-role="tour"]');
    this.langBtn = this.q('[data-role="lang"]');
    this.quizBtn = this.q('[data-role="quiz"]');
    this.teacherBtn = this.q('[data-role="teacher"]');
    this.saveBtn = this.q('[data-role="save"]');
    this.statsEl = this.q('[data-role="stats"]');
    this.overlay = this.q('[data-role="overlay"]');
    this.crosshairEl = this.q('.crosshair');

    // 操作ヒントのトースト
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'onboard-toast hidden';
    this.root.appendChild(this.toastEl);

    // パネル類
    this.palette = new BlockPalette(this.root, this.editor);
    this.rightPanel = new RightPanel(this.root, this.editor);
    this.popup = new TourismPopup(this.root);
    this.landmarkEditor = new LandmarkEditor(this.root, {
      onSaved: (lm) => {
        this.tourism.refresh(lm.id);
        bus.emit('data:changed', undefined);
      },
      onDeleted: (id) => {
        this.tourism.remove(id);
        bus.emit('data:changed', undefined);
      },
    });
    this.learningPanel = new LearningPanel(this.root, this.language);
    this.quizEditor = new QuizEditor(this.root);
    this.quizPlay = new QuizPlay(this.root, this.tourism, this.quizzes);
    this.teacherPanel = new TeacherPanel(
      this.root,
      this.teacher,
      this.tourism,
      this.quizzes,
      this.player,
      this.landmarkEditor,
      this.quizEditor,
    );
    this.savePanel = new SavePanel(this.root, this.saves);
    this.placesPanel = new PlacesPanel(this.root, this.tourism, this.player);

    // あそびかた・タイトル画面
    this.howToModal = new HowToModal(this.root);
    this.titleScreen = new TitleScreen(this.root, {
      onCreate: () => {
        this.titleScreen.hide();
        bus.emit('app:enter', undefined);
        this.input.requestLock();
        this.showOnboarding();
      },
      onContinue: () => this.savePanel.open(),
      onHowTo: () => this.howToModal.show(),
    });
  }

  /** タイトル画面を表示する（起動時にEngineから呼ばれる） */
  showTitle(): void {
    this.titleScreen.show();
  }

  /** 初回のみ操作ヒントを表示 */
  private showOnboarding(): void {
    try {
      if (localStorage.getItem('kc.onboarded')) return;
      localStorage.setItem('kc.onboarded', '1');
    } catch {
      // localStorage が使えなくても表示はする
    }
    this.toastEl.textContent = '右クリックで ブロックをおく / 左クリックで こわす！';
    this.toastEl.classList.remove('hidden');
    window.setTimeout(() => this.toastEl.classList.add('hidden'), 6000);
  }

  private q<T extends HTMLElement>(sel: string): T {
    return this.root.querySelector(sel) as T;
  }

  private wire(): void {
    // モード切替（つくる/あるく）
    this.modeBtn.addEventListener('click', () => {
      this.editor.setMode(this.editor.mode === 'build' ? 'play' : 'build');
    });
    this.editor.onModeChange = () => this.updateModeUI();
    this.updateModeUI();

    // 昼夜・時間
    this.dayBtn.addEventListener('click', () => this.clock.toggleDayNight());
    this.autoBtn.addEventListener('click', () => {
      const on = this.clock.toggleAuto();
      this.autoBtn.querySelector('[data-label="auto"]')!.textContent = on ? '時間：すすむ' : '時間：とまる';
    });

    // 観光地リスト（クリックでワープ）
    this.tourBtn.addEventListener('click', () => this.placesPanel.open());
    this.tourism.onEnabledChange = (on) => {
      this.tourBtn.classList.toggle('is-active', on);
    };
    this.tourism.onShow = (lm, lang) => {
      this.popup.show(lm, lang, {
        // 表示と同じ文を読み上げる（音声とテキストの整合）
        onSpeak: (text: string, l: Lang) => this.speech.speak(text, l),
        onLang: (l: Lang) => this.tourism.setLang(l),
        onEdit: () => this.landmarkEditor.open(lm),
        onClose: () => this.tourism.setEnabled(false),
      });
    };
    this.tourism.onHide = () => this.popup.hide();

    // 外国語学習
    this.langBtn.addEventListener('click', () => this.language.toggle());
    this.language.onEnabledChange = (on) => {
      this.langBtn.classList.toggle('is-active', on);
      if (on) this.learningPanel.open();
      else this.learningPanel.close();
    };

    // クイズ
    this.quizBtn.addEventListener('click', () => this.quizPlay.open());

    // 保存・読込
    this.saveBtn.addEventListener('click', () => this.savePanel.open());

    // 教師モード
    this.teacherBtn.addEventListener('click', () => this.teacher.toggle());
    this.teacher.onEnabledChange = (on) => {
      this.teacherBtn.classList.toggle('is-active', on);
      if (on) this.teacherPanel.show();
      else this.teacherPanel.hide();
    };

    // 開始オーバーレイ：ロック中は非表示（クリックはキャンバスが受けてロック開始）
    this.input.setLockChangeHandler((locked) => {
      this.overlay.classList.toggle('hidden', locked);
    });

    // T キーでも昼夜切替
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyT') this.clock.toggleDayNight();
    });

    // 設置/削除のたびに照準をポンと反応させる（手応えのフィードバック）
    bus.on('edit:done', () => {
      this.crosshairEl.classList.remove('pulse');
      // リフローを挟んでアニメーションを再始動
      void this.crosshairEl.offsetWidth;
      this.crosshairEl.classList.add('pulse');
    });
  }

  private updateModeUI(): void {
    const build = this.editor.mode === 'build';
    this.modeBtn.querySelector('[data-label="mode"]')!.textContent = build ? 'つくる' : 'あるく';
    this.modeBtn.classList.toggle('is-active', build);
    this.palette.setVisible(build);
  }

  updateStats(dt: number): void {
    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      const fps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
      this.statsEl.textContent = `FPS ${fps}`;
    }
  }
}
