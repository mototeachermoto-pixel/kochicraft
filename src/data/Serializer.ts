import {
  CHUNK_SIZE,
  WORLD_CHUNKS_X,
  WORLD_CHUNKS_Z,
  WORLD_HEIGHT,
} from '@/config/constants';
import type { Lang, SaveFileV1, WorldSave } from '@/types';
import type { World } from '@/world/World';
import type { TourismManager } from '@/features/tourism/TourismManager';
import type { QuizManager } from '@/features/quiz/QuizManager';

/**
 * アプリの状態 ⇄ 保存ファイル(JSON) の相互変換。
 * ワールド・観光地・クイズ・設定をまとめて1ファイルにする。
 */
export class Serializer {
  /** 現在の状態を保存ファイルに変換 */
  static serialize(
    world: World,
    tourism: TourismManager,
    quizzes: QuizManager,
    settings: { timeOfDay: number; lang: Lang },
    title: string,
  ): SaveFileV1 {
    const now = new Date().toISOString();
    const worldSave: WorldSave = {
      chunkSize: CHUNK_SIZE,
      height: WORLD_HEIGHT,
      chunksX: WORLD_CHUNKS_X,
      chunksZ: WORLD_CHUNKS_Z,
      spawn: world.spawnPoint,
      chunks: world.exportChunks(),
    };
    return {
      format: 'kochicraft',
      version: 1,
      meta: { title, createdAt: now, updatedAt: now },
      world: worldSave,
      landmarks: tourism.getAll(),
      quizzes: quizzes.getAll(),
      settings,
    };
  }

  /** 保存ファイルを現在のアプリへ適用（ワールド・観光地・クイズ） */
  static deserialize(
    data: SaveFileV1,
    world: World,
    tourism: TourismManager,
    quizzes: QuizManager,
  ): void {
    world.importChunks(data.world.chunks);
    world.setSpawn(data.world.spawn);
    tourism.loadLandmarks(data.landmarks ?? []);
    quizzes.loadQuizzes(data.quizzes ?? []);
  }

  /** 読み込んだデータが有効な KochiCraft 保存ファイルか */
  static isValid(data: unknown): data is SaveFileV1 {
    const d = data as Partial<SaveFileV1> | null;
    return (
      !!d &&
      d.format === 'kochicraft' &&
      d.version === 1 &&
      !!d.world &&
      Array.isArray(d.world.chunks)
    );
  }
}
