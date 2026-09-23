import type { Lang, Landmark, PhrasePair } from '@/types';
import type { TourismManager } from '@/features/tourism/TourismManager';
import type { SpeechService } from './SpeechService';

/** ゆっくり再生時の速度 */
const SLOW_RATE: Record<Lang, number> = { en: 0.55, ja: 0.7 };

/** どの観光地でも使える基本フレーズ（観光地に固有フレーズが無い場合に使用） */
const COMMON_PHRASES: PhrasePair[] = [
  { en: 'Hello!', ja: 'こんにちは！' },
  { en: 'Welcome to Kochi.', ja: '高知へ ようこそ。' },
  { en: 'This is a famous place.', ja: 'ここは 有名な 場所です。' },
  { en: 'Please look at this.', ja: 'これを 見てください。' },
  { en: 'It is very beautiful.', ja: 'とても きれいです。' },
  { en: 'Thank you!', ja: 'ありがとう！' },
];

/**
 * 外国語（英語）学習モードの司令塔。
 * 観光地の英語ガイドを「学習素材」として提供し、発音（ふつう/ゆっくり）を行う。
 * 既存の TourismManager（観光地データ）と SpeechService（音声）を活用する。
 */
export class LanguageManager {
  /** 学習モードが有効か */
  enabled = false;
  /** 学習中の観光地ID */
  currentId: string | null = null;

  onEnabledChange?: (enabled: boolean) => void;

  constructor(
    private readonly tourism: TourismManager,
    private readonly speech: SpeechService,
  ) {}

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.speech.cancel();
    this.onEnabledChange?.(enabled);
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /** 学習対象に選べる観光地一覧 */
  getLandmarks(): Landmark[] {
    return this.tourism.getAll();
  }

  /** 学習する観光地を選ぶ（無指定時は先頭を選ぶ） */
  select(id: string | null): Landmark | undefined {
    const list = this.getLandmarks();
    this.currentId = id ?? list[0]?.id ?? null;
    return this.getCurrent();
  }

  getCurrent(): Landmark | undefined {
    return this.getLandmarks().find((l) => l.id === this.currentId);
  }

  /** 英語ガイド文を「1文ずつ」に分割する */
  splitSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /** 観光地のキーフレーズ（無ければ共通フレーズ） */
  getPhrases(landmark: Landmark): PhrasePair[] {
    return landmark.phrases && landmark.phrases.length > 0 ? landmark.phrases : COMMON_PHRASES;
  }

  /**
   * 読み上げる。
   * @param slow true ならゆっくり再生
   */
  speak(text: string, lang: Lang, slow = false): void {
    this.speech.speak(text, lang, slow ? SLOW_RATE[lang] : undefined);
  }

  stop(): void {
    this.speech.cancel();
  }
}
