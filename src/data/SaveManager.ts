import type { Clock } from '@/core/Clock';
import type { Player } from '@/player/Player';
import type { SaveFileV1, SaveSlotInfo } from '@/types';
import type { World } from '@/world/World';
import type { TourismManager } from '@/features/tourism/TourismManager';
import type { QuizManager } from '@/features/quiz/QuizManager';
import { Serializer } from './Serializer';
import { Storage } from './Storage';

/** ファイル名に使えない文字を除去 */
function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

/**
 * 保存・読込の高レベルAPI。
 * localStorage スロットと、.kcw ファイルのエクスポート/インポート（配布・回収）を提供する。
 */
export class SaveManager {
  private readonly storage = new Storage();

  constructor(
    private readonly world: World,
    private readonly tourism: TourismManager,
    private readonly quizzes: QuizManager,
    private readonly clock: Clock,
    private readonly player: Player,
  ) {}

  private buildSettings() {
    return { timeOfDay: this.clock.getTime(), lang: this.tourism.lang };
  }

  /** 現在の状態から保存ファイルを作る */
  createSaveFile(title: string): SaveFileV1 {
    return Serializer.serialize(this.world, this.tourism, this.quizzes, this.buildSettings(), title);
  }

  /** 保存ファイルを適用（ワールド・観光地・クイズ・設定・スポーン） */
  apply(data: SaveFileV1): void {
    Serializer.deserialize(data, this.world, this.tourism, this.quizzes);
    if (data.settings) {
      this.clock.setTime(data.settings.timeOfDay);
      this.tourism.setLang(data.settings.lang);
    }
    this.player.spawn(this.world.spawnPoint);
  }

  // ===== localStorage スロット =====
  storageAvailable(): boolean {
    return this.storage.isAvailable();
  }

  listSlots(): SaveSlotInfo[] {
    return this.storage.list();
  }

  /** 新しいスロットに保存して、その情報を返す */
  saveToSlot(title: string): SaveSlotInfo {
    const slot = `s_${Date.now()}`;
    const data = this.createSaveFile(title || 'むだい');
    this.storage.save(slot, data);
    return { slot, title: data.meta.title, updatedAt: data.meta.updatedAt };
  }

  loadSlot(slot: string): boolean {
    const data = this.storage.load(slot);
    if (!data || !Serializer.isValid(data)) return false;
    this.apply(data);
    return true;
  }

  deleteSlot(slot: string): void {
    this.storage.remove(slot);
  }

  // ===== ファイル（.kcw）=====
  /** 現在の作品を .kcw ファイルとしてダウンロード（配布・持ち帰り用） */
  exportFile(title: string): void {
    const data = this.createSaveFile(title || 'むだい');
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFileName(title) || 'kochicraft'}.kcw`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** .kcw ファイルを読み込んで適用（回収・配布の受け取り） */
  async importFile(file: File): Promise<boolean> {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return false;
    }
    if (!Serializer.isValid(data)) return false;
    this.apply(data);
    return true;
  }
}
