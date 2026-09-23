import type { Quiz } from '@/types';
import { createQuiz } from './Quiz';

/**
 * クイズの保持と管理（CRUD）。
 * 教師モードで作成・編集し、クイズモードで出題する。
 */
export class QuizManager {
  private quizzes: Quiz[] = [];

  /** クイズを追加 */
  add(quiz: Quiz): Quiz {
    this.quizzes.push(quiz);
    return quiz;
  }

  /** 部分情報から作成して追加 */
  addNew(partial: Partial<Quiz> = {}): Quiz {
    return this.add(createQuiz(partial));
  }

  getAll(): Quiz[] {
    return this.quizzes;
  }

  get(id: string): Quiz | undefined {
    return this.quizzes.find((q) => q.id === id);
  }

  /** 指定観光地のクイズ一覧 */
  getByLandmark(landmarkId: string): Quiz[] {
    return this.quizzes.filter((q) => q.landmarkId === landmarkId);
  }

  /** クイズを削除 */
  remove(id: string): void {
    this.quizzes = this.quizzes.filter((q) => q.id !== id);
  }

  /** クイズ一覧を読み込み直す（保存データの適用） */
  loadQuizzes(list: Quiz[]): void {
    this.quizzes = [...list];
  }

  /** クイズ数 */
  get count(): number {
    return this.quizzes.length;
  }
}
