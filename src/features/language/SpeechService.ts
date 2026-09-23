import type { Lang } from '@/types';

/**
 * 音声読み上げ（ブラウザ標準の Web Speech API / SpeechSynthesis）。
 * 外部APIを使わずローカルで動作する方針に沿った実装。
 *
 * 聞き取りやすさのために、次の4点を守っている：
 *  1. 声のリストを読み終わるまで待つ（待たずに読むと既定の声になってしまう）
 *  2. 英語の声が無いときは日本語の声で英語を読ませない（カタカナ英語になるため）
 *  3. 長い文は「1文ずつ」に区切って読む（途中で止まる不具合を避け、区切りも聞き取りやすい）
 *  4. 止めてから読み始めるまでに少し間を置く（Chrome は直後だと最初の語が欠ける）
 */

/** 読み上げ速度の既定値。小学生が聞き取れるよう英語は少しゆっくりにする */
const DEFAULT_RATE: Record<Lang, number> = { en: 0.85, ja: 1.0 };

/** cancel() の直後に speak() すると先頭が欠けるため、これだけ待つ（ミリ秒） */
const CANCEL_GAP_MS = 130;

/** 文と文のあいだの間（ミリ秒） */
const SENTENCE_GAP_MS = 260;

export class SpeechService {
  private synth: SpeechSynthesis | null;
  private voices: SpeechSynthesisVoice[] = [];
  private voicesReady: Promise<void>;
  /** 今読み上げている一連の処理を識別する番号。cancel() で無効化する */
  private runId = 0;
  private keepAliveTimer = 0;

  /** 英語の声が入っていないときに一度だけ知らせるためのコールバック */
  onVoiceMissing?: (lang: Lang) => void;
  private notifiedMissing = new Set<Lang>();

  constructor() {
    this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;
    this.voicesReady = this.waitForVoices();
  }

  /** この環境で読み上げが使えるか */
  isSupported(): boolean {
    return this.synth !== null;
  }

  /**
   * 声のリストは非同期で届く。届くまで（最大2秒）待つ。
   * 待たずに speak すると声が未選択になり、英語が日本語の声で読まれてしまう。
   */
  private waitForVoices(): Promise<void> {
    const synth = this.synth;
    if (!synth) return Promise.resolve();

    this.voices = synth.getVoices();
    if (this.voices.length > 0) return Promise.resolve();

    return new Promise<void>((resolve) => {
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        this.voices = synth.getVoices();
        resolve();
      };
      synth.onvoiceschanged = finish;
      // onvoiceschanged が来ない環境があるので、念のため様子も見る
      const poll = window.setInterval(() => {
        if (synth.getVoices().length > 0) {
          window.clearInterval(poll);
          finish();
        }
      }, 100);
      window.setTimeout(() => {
        window.clearInterval(poll);
        finish();
      }, 2000);
    });
  }

  /** その言語の声がこの端末に入っているか */
  async hasVoiceFor(lang: Lang): Promise<boolean> {
    await this.voicesReady;
    return this.pickVoice(lang === 'ja' ? 'ja-JP' : 'en-US') !== null;
  }

  /**
   * 言語コード（ja-JP / en-US）に合う「いちばん聞き取りやすい」声を選ぶ。
   * 言語が一致しない声は絶対に返さない（日本語の声で英語を読ませないため）。
   */
  private pickVoice(langCode: string): SpeechSynthesisVoice | null {
    if (this.voices.length === 0 && this.synth) this.voices = this.synth.getVoices();
    const prefix = langCode.split('-')[0];
    const candidates = this.voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
    if (candidates.length === 0) return null;

    // 発音がはっきりしている声に含まれやすい語（前ほど高評価）
    const prefer = [
      'natural',   // Microsoft Natural 系（いちばん自然）
      'neural',
      'google',    // Google US English（Chrome の高品質声）
      'samantha',  // iPad / iPhone の標準英語
      'aria',
      'jenny',
      'guy',
      'michelle',
      'libby',
      'sonia',
      'premium',
      'enhanced',
      'siri',
    ];
    const score = (v: SpeechSynthesisVoice): number => {
      const name = v.name.toLowerCase();
      let s = 0;
      prefer.forEach((kw, i) => {
        if (name.includes(kw)) s += (prefer.length - i) * 2;
      });
      if (v.lang.toLowerCase().replace('_', '-') === langCode.toLowerCase()) s += 6;
      // 「Desktop」と付く声は古い低品質のものが多い
      if (name.includes('desktop')) s -= 4;
      if (v.default) s += 1;
      return s;
    };
    return [...candidates].sort((a, b) => score(b) - score(a))[0];
  }

  /** 読み上げる文を、発音を邪魔する記号から掃除する */
  private clean(text: string): string {
    return text
      // 絵文字・記号（読み上げエンジンが「絵文字」と読んだり詰まったりする）
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** 1文ずつに分ける。長すぎる文はカンマでも切る */
  private toSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .flatMap((s) => (s.length > 140 ? s.split(/(?<=,)\s+/) : [s]))
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * テキストを読み上げる。
   * @param text 読み上げる文
   * @param lang 'ja'（日本語）/ 'en'（英語）
   * @param rate 読み上げ速度（任意。未指定なら言語ごとの既定値。ゆっくり再生は 0.5〜0.6 程度）
   */
  speak(text: string, lang: Lang = 'ja', rate?: number): void {
    const synth = this.synth;
    if (!synth) return;
    const cleaned = this.clean(text);
    if (!cleaned) return;

    this.cancel();
    const myRun = this.runId;

    void this.voicesReady.then(() => {
      // 待っているあいだに別の読み上げが始まっていたら、こちらは捨てる
      if (myRun !== this.runId) return;

      const langCode = lang === 'ja' ? 'ja-JP' : 'en-US';
      const voice = this.pickVoice(langCode);

      // その言語の声が無いときは読み上げない。
      // 日本語の声で英語を読ませると、カタカナ読みになって聞き取れないため。
      if (!voice) {
        if (!this.notifiedMissing.has(lang)) {
          this.notifiedMissing.add(lang);
          this.onVoiceMissing?.(lang);
        }
        console.warn(`[SpeechService] ${langCode} の音声がこの端末に入っていません`);
        return;
      }

      const sentences = this.toSentences(cleaned);
      const speakRate = rate ?? DEFAULT_RATE[lang];

      // 1文ずつ順番に読む
      const next = (i: number): void => {
        if (myRun !== this.runId || i >= sentences.length) {
          if (myRun === this.runId) this.stopKeepAlive();
          return;
        }
        const utter = new SpeechSynthesisUtterance(sentences[i]);
        utter.lang = voice.lang;
        utter.voice = voice;
        utter.rate = speakRate;
        utter.pitch = 1.0;
        utter.volume = 1.0;
        const advance = (): void => {
          if (myRun !== this.runId) return;
          window.setTimeout(() => next(i + 1), SENTENCE_GAP_MS);
        };
        utter.onend = advance;
        utter.onerror = advance;
        try {
          synth.speak(utter);
        } catch (err) {
          console.error('[SpeechService] 読み上げに失敗しました:', err);
        }
      };

      // cancel() の直後に speak すると最初の語が欠けるので、少しだけ待つ
      window.setTimeout(() => {
        if (myRun !== this.runId) return;
        this.startKeepAlive();
        next(0);
      }, CANCEL_GAP_MS);
    });
  }

  /**
   * Chrome には、15秒ほど読み上げ続けると勝手に止まる不具合がある。
   * 定期的に pause/resume を送って読み上げを続けさせる。
   */
  private startKeepAlive(): void {
    this.stopKeepAlive();
    const synth = this.synth;
    if (!synth) return;
    this.keepAliveTimer = window.setInterval(() => {
      if (!synth.speaking) return;
      synth.pause();
      synth.resume();
    }, 10000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      window.clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = 0;
    }
  }

  /** 読み上げを停止 */
  cancel(): void {
    this.runId += 1;
    this.stopKeepAlive();
    this.synth?.cancel();
  }
}
