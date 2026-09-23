/**
 * ゲーム全体で使う定数。
 * チューニングはここに集約し、各モジュールから参照する。
 */

// ===== ワールド =====
/** 1チャンクの一辺（ブロック数） */
export const CHUNK_SIZE = 16;
/** ワールドの高さ（ブロック数） */
export const WORLD_HEIGHT = 40;
/** ワールドのチャンク数（X方向） */
export const WORLD_CHUNKS_X = 6;
/** ワールドのチャンク数（Z方向） */
export const WORLD_CHUNKS_Z = 6;
/** ワールド全体の幅・奥行き（ブロック数） */
export const WORLD_WIDTH = WORLD_CHUNKS_X * CHUNK_SIZE;
export const WORLD_DEPTH = WORLD_CHUNKS_Z * CHUNK_SIZE;
/** 海面の高さ */
export const SEA_LEVEL = 13;
/** 地形生成の乱数シード */
export const WORLD_SEED = 1467;

// ===== プレイヤー / 物理 =====
/** 重力加速度（ブロック/秒^2） */
export const GRAVITY = 30;
/** ジャンプ初速度（v^2/(2*GRAVITY) がジャンプの高さ。約3ブロック分の高さになるよう調整） */
export const JUMP_SPEED = 13.4;
/** 歩く速度（ブロック/秒） */
export const MOVE_SPEED = 5.0;
/** 走る速度（Shift） */
export const SPRINT_SPEED = 8.5;
/** プレイヤーAABBの半分の幅 */
export const PLAYER_HALF_WIDTH = 0.3;
/** プレイヤーの身長 */
export const PLAYER_HEIGHT = 1.8;
/** 目の高さ（足元からの距離） */
export const PLAYER_EYE = 1.62;
/** 自動で登れる段差の高さ（ブロック数）。石段・縁石を歩いて越えるため少し1超え */
export const STEP_HEIGHT = 1.05;
/** マウス視点感度 */
export const MOUSE_SENSITIVITY = 0.0022;
/** ブロックに手が届く距離（建築の射程, ブロック数） */
export const REACH = 6;

// ===== 描画 =====
/** カメラ視野角 */
export const CAMERA_FOV = 72;
/** カメラ near / far */
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 320;
/** 1フレームの最大デルタ（タブ復帰時の暴走防止） */
export const MAX_DELTA = 0.05;

// ===== 時間（昼夜） =====
/** 1日の長さ（秒）。自動サイクル時に使用 */
export const DAY_LENGTH_SEC = 120;
