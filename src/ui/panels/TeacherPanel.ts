import type { Player } from '@/player/Player';
import type { TourismManager } from '@/features/tourism/TourismManager';
import type { QuizManager } from '@/features/quiz/QuizManager';
import type { TeacherManager } from '@/features/teacher/TeacherManager';
import { createQuiz } from '@/features/quiz/Quiz';
import { bus } from '@/state/EventBus';
import type { LandmarkEditor } from '../modals/LandmarkEditor';
import type { QuizEditor } from '../modals/QuizEditor';

/**
 * 教師ダッシュボード。
 * 観光地とクイズを一覧で管理（追加・編集・削除）する教師専用画面。
 */
export class TeacherPanel {
  private readonly root: HTMLElement;
  private open = false;

  constructor(
    parent: HTMLElement,
    private readonly teacher: TeacherManager,
    private readonly tourism: TourismManager,
    private readonly quizzes: QuizManager,
    private readonly player: Player,
    private readonly landmarkEditor: LandmarkEditor,
    private readonly quizEditor: QuizEditor,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'modal hidden';
    parent.appendChild(this.root);

    // 観光地などが変わったら一覧を更新
    bus.on('data:changed', () => {
      if (this.open) this.render();
    });
  }

  show(): void {
    this.open = true;
    this.render();
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.open = false;
    this.root.classList.add('hidden');
  }

  private render(): void {
    const landmarks = this.tourism.getAll();
    const quizzes = this.quizzes.getAll();

    const lmRows =
      landmarks.length === 0
        ? `<div class="learn-empty">観光地がありません。</div>`
        : landmarks
            .map(
              (l) => `
        <div class="admin-row">
          <span class="admin-row__name">${this.esc(l.titleJa)} <small>${this.esc(l.titleEn)}</small></span>
          <span class="admin-row__btns">
            <button class="kc-mini" data-edit-lm="${l.id}">✏️</button>
            <button class="kc-mini" data-del-lm="${l.id}">🗑️</button>
          </span>
        </div>`,
            )
            .join('');

    const quizRows =
      quizzes.length === 0
        ? `<div class="learn-empty">クイズがありません。</div>`
        : quizzes
            .map((q) => {
              const lmName = q.landmarkId
                ? (this.tourism.get(q.landmarkId)?.titleJa ?? '—')
                : '—';
              const typeLabel = q.type === 'ox' ? '○×' : '三択';
              return `
        <div class="admin-row">
          <span class="admin-row__name">
            <span class="badge">${typeLabel}</span>
            ${this.esc(q.questionJa)}
            <small>（${this.esc(lmName)}）</small>
          </span>
          <span class="admin-row__btns">
            <button class="kc-mini" data-edit-quiz="${q.id}">✏️</button>
            <button class="kc-mini" data-del-quiz="${q.id}">🗑️</button>
          </span>
        </div>`;
            })
            .join('');

    this.root.innerHTML = `
      <div class="modal__backdrop" data-role="backdrop"></div>
      <div class="modal__card learn-card">
        <div class="learn-head">
          <div class="modal__title">👩‍🏫 先生メニュー</div>
          <button class="tourism-popup__close" data-role="close">✖</button>
        </div>

        <div class="learn-section-head">
          <span>観光地（${landmarks.length}）</span>
          <button class="kc-btn" data-role="add-lm"><span class="kc-btn__icon">📍</span>観光地を追加</button>
        </div>
        <div class="admin-list">${lmRows}</div>

        <div class="learn-section-head">
          <span>クイズ（${quizzes.length}）</span>
          <button class="kc-btn" data-role="add-quiz"><span class="kc-btn__icon">❓</span>クイズを追加</button>
        </div>
        <div class="admin-list">${quizRows}</div>
      </div>
    `;

    this.wire();
  }

  private wire(): void {
    const root = this.root;
    root.querySelector('[data-role="backdrop"]')!.addEventListener('click', () => this.teacher.setEnabled(false));
    root.querySelector('[data-role="close"]')!.addEventListener('click', () => this.teacher.setEnabled(false));

    // 観光地：追加
    root.querySelector('[data-role="add-lm"]')!.addEventListener('click', () => {
      const x = Math.floor(this.player.position.x);
      const z = Math.floor(this.player.position.z);
      const y = this.tourism.groundY(x, z);
      const lm = this.tourism.addAt({ x, y, z });
      this.render();
      this.landmarkEditor.open(lm);
    });

    // 観光地：編集・削除
    for (const btn of Array.from(root.querySelectorAll<HTMLElement>('[data-edit-lm]'))) {
      btn.addEventListener('click', () => {
        const lm = this.tourism.get(btn.dataset.editLm!);
        if (lm) this.landmarkEditor.open(lm);
      });
    }
    for (const btn of Array.from(root.querySelectorAll<HTMLElement>('[data-del-lm]'))) {
      btn.addEventListener('click', () => {
        this.tourism.remove(btn.dataset.delLm!);
        this.render();
      });
    }

    // クイズ：追加
    root.querySelector('[data-role="add-quiz"]')!.addEventListener('click', () => {
      const q = createQuiz({ landmarkId: this.tourism.getAll()[0]?.id });
      this.quizEditor.open(q, this.tourism.getAll(), {
        onSaved: (quiz) => {
          if (!this.quizzes.get(quiz.id)) this.quizzes.add(quiz);
          this.render();
        },
        onDeleted: (id) => {
          this.quizzes.remove(id);
          this.render();
        },
      });
    });

    // クイズ：編集・削除
    for (const btn of Array.from(root.querySelectorAll<HTMLElement>('[data-edit-quiz]'))) {
      btn.addEventListener('click', () => {
        const q = this.quizzes.get(btn.dataset.editQuiz!);
        if (!q) return;
        this.quizEditor.open(q, this.tourism.getAll(), {
          onSaved: () => this.render(),
          onDeleted: (id) => {
            this.quizzes.remove(id);
            this.render();
          },
        });
      });
    }
    for (const btn of Array.from(root.querySelectorAll<HTMLElement>('[data-del-quiz]'))) {
      btn.addEventListener('click', () => {
        this.quizzes.remove(btn.dataset.delQuiz!);
        this.render();
      });
    }
  }

  private esc(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
