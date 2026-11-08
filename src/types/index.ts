/**
 * プロジェクト共通の型定義。
 * Phase が進むごとにここへ型を追加していく（保存スキーマ等）。
 */

/** 3次元ベクトル（整数/小数どちらにも使う） */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** ブロックの分類（後のブロックパレットで色分けに使う） */
export type BlockCategory = 'nature' | 'build' | 'decor';

/** ブロックの種類定義 */
export interface BlockType {
  /** 数値ID（0 = 空気） */
  id: number;
  /** 内部キー（"grass" など） */
  key: string;
  /** 日本語表示名（「草」） */
  name: string;
  /** 英語表示名（"Grass"） */
  nameEn: string;
  /** 基本色（テクスチャ未使用時のフォールバック, #hex） */
  color: string;
  /** 半透明か（水・ガラス等） */
  transparent: boolean;
  /** 衝突判定を持つか（プレイヤーが通れないか） */
  solid: boolean;
  /** 分類 */
  category: BlockCategory;
}

/** プレイヤーの移動入力スナップショット（コントローラ→プレイヤーへ渡す） */
export interface MoveInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
}

/** 表示言語 */
export type Lang = 'ja' | 'en';

/**
 * 観光地（ランドマーク）。
 * 近づくと説明・写真・音声を表示する。教師モードでの編集・保存対象でもある。
 */
export interface Landmark {
  /** 一意のID */
  id: string;
  /** マーカーの足元位置（ブロック座標） */
  position: Vec3;
  /** 近づくと反応する半径（ブロック数） */
  radius: number;
  /** 日本語の名前（「高知城」） */
  titleJa: string;
  /** 英語の名前（"Kochi Castle"） */
  titleEn: string;
  /** 日本語の説明 */
  descJa: string;
  /** 英語の説明 */
  descEn: string;
  /** 写真（dataURL もしくはパス。任意） */
  image?: string;
  /** 読み上げ文（日英） */
  speech: { ja: string; en: string };
  /** 外国語学習用のキーフレーズ（英日ペア。任意） */
  phrases?: PhrasePair[];
  /** 英語ガイド（紹介・できること・おすすめ。任意。あれば表示・読み上げに優先使用） */
  guide?: LandmarkGuide;
}

/** 英日のフレーズ対（外国語学習で使用） */
export interface PhrasePair {
  en: string;
  ja: string;
}

/**
 * 観光地の英語ガイド（小学5年生レベル）。
 * 「場所の紹介」「そこでできること（一言）」「おすすめポイント」の3要素。
 * 表示テキストと読み上げテキストはこれで一致させる。
 */
export interface LandmarkGuide {
  /** 場所の紹介 */
  introEn: string;
  introJa: string;
  /** そこでできること（一言） */
  canDoEn: string;
  canDoJa: string;
  /** おすすめポイント */
  recommendEn: string;
  recommendJa: string;
}

/** クイズの形式：○×／三択 */
export type QuizType = 'ox' | 'choice3';

/** クイズ（観光地ごとに紐づけ可能） */
export interface Quiz {
  /** 一意のID */
  id: string;
  /** 紐づく観光地のID（任意） */
  landmarkId?: string;
  /** 形式 */
  type: QuizType;
  /** 問題文（日本語） */
  questionJa: string;
  /** 問題文（英語・任意） */
  questionEn?: string;
  /** 選択肢（○×は2つ固定、三択は3つ） */
  choices: string[];
  /** 正解の選択肢インデックス */
  answerIndex: number;
  /** 解説（任意） */
  explanation?: string;
}

/** 1チャンクの保存形式（ボクセルはRLE圧縮：[id, 連続数, id, 連続数, ...]） */
export interface ChunkSave {
  cx: number;
  cz: number;
  rle: number[];
}

/** ワールドの保存形式 */
export interface WorldSave {
  chunkSize: number;
  height: number;
  chunksX: number;
  chunksZ: number;
  spawn: Vec3;
  chunks: ChunkSave[];
}

/** 作品の保存ファイル（拡張子 .kcw, 中身はJSON）。version で将来の移行に対応 */
export interface SaveFileV1 {
  format: 'kochicraft';
  version: 1;
  meta: {
    title: string;
    author?: string;
    createdAt: string;
    updatedAt: string;
  };
  world: WorldSave;
  landmarks: Landmark[];
  quizzes: Quiz[];
  settings: { timeOfDay: number; lang: Lang };
}

/** 保存スロットの一覧表示用 */
export interface SaveSlotInfo {
  slot: string;
  title: string;
  updatedAt: string;
}

/** 昼夜などの環境パラメータ（Clock が算出し SceneManager が適用） */
export interface EnvironmentState {
  /** 太陽の向き（正規化ベクトル相当） */
  sunDir: Vec3;
  /** 空の色 (#hex) */
  skyColor: string;
  /** 太陽光の色 (#hex) */
  sunColor: string;
  /** 太陽光の強さ */
  sunIntensity: number;
  /** 環境光の強さ */
  ambientIntensity: number;
  /** 0=夜 〜 1=昼 の度合い */
  dayFactor: number;
}
