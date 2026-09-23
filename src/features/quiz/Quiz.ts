import type { Quiz, QuizType } from '@/types';

export type { Quiz, QuizType };

/** ○×クイズの固定選択肢 */
export const OX_CHOICES = ['◯ ただしい', '✕ ちがう'];

let counter = 0;

/** クイズを新規作成（不足分は既定値で補う） */
export function createQuiz(partial: Partial<Quiz> = {}): Quiz {
  counter += 1;
  const type: QuizType = partial.type ?? 'ox';
  return {
    id: partial.id ?? `quiz_${Date.now()}_${counter}`,
    landmarkId: partial.landmarkId,
    type,
    questionJa: partial.questionJa ?? 'もんだいを かこう',
    questionEn: partial.questionEn,
    choices:
      partial.choices ?? (type === 'ox' ? [...OX_CHOICES] : ['えらぶ 1', 'えらぶ 2', 'えらぶ 3']),
    answerIndex: partial.answerIndex ?? 0,
    explanation: partial.explanation,
  };
}

/** 形式に応じた既定の選択肢を返す（形式切替時に使用） */
export function defaultChoices(type: QuizType): string[] {
  return type === 'ox' ? [...OX_CHOICES] : ['えらぶ 1', 'えらぶ 2', 'えらぶ 3'];
}
