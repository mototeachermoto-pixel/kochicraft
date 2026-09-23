import type { Landmark, Quiz } from '@/types';
import type { TourismManager } from '@/features/tourism/TourismManager';
import type { QuizManager } from '@/features/quiz/QuizManager';

/**
 * 教師モードの管理。
 * 観光地（TourismManager）とクイズ（QuizManager）への入口をまとめ、
 * 教師専用UIの表示切替を管理する。
 */
export class TeacherManager {
  /** 教師モードが有効か */
  enabled = false;
  onEnabledChange?: (enabled: boolean) => void;

  constructor(
    private readonly tourism: TourismManager,
    private readonly quizzes: QuizManager,
  ) {}

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.onEnabledChange?.(enabled);
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  getLandmarks(): Landmark[] {
    return this.tourism.getAll();
  }

  getQuizzes(): Quiz[] {
    return this.quizzes.getAll();
  }
}
