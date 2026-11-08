import type { Vec3 } from '@/types';
import type { World } from '@/world/World';

/** 直方体の範囲（選択判定・ハイライト用。min〜max は包含） */
export interface Region {
  min: Vec3;
  max: Vec3;
}

/** 情報パネルに出す内容（すべて英語、小学5年生レベル） */
export interface ObjectGuide {
  /** できること */
  canDo: string;
  /** 特徴 */
  feature: string;
  /** 英語紹介（少し長め） */
  about: string;
}

/** 3D空間内の「選択できる構造物」 */
export interface SceneObject {
  id: string;
  /** 表示名（英語） */
  name: string;
  /** 日本語名（補助・任意） */
  nameJa?: string;
  /** 選択判定・ハイライトの範囲 */
  region: Region;
  /** 選択時にカメラが注視する点 */
  focus: Vec3;
  /** 情報パネルの内容 */
  guide: ObjectGuide;
  /** 写真（dataURL。アップロードで差し込み） */
  image?: string;
  /** 同梱の元の写真（アップロード写真が表示できないときに戻す先） */
  imageDefault?: string;
  /** 英語音声（dataURL。先生が録音/アップロードした音声。あれば読み上げより優先） */
  audio?: string;
  /** 最初から入っている音声（子どもを切りかえたとき、前の子の録音を残さず、ここへ戻す） */
  audioDefault?: string;
  /**
   * Map でここへ行くときに立つ場所（足もと）。洞窟の中など、自動で探すと
   * 屋根の上や外に立ってしまう所だけ指定する。無ければ自動で探す。
   */
  viewFrom?: Vec3;
}

/**
 * 観光地のまわりの景色の種類（実際の場所に近い背景にするため。2026-11-08 追加）。
 * 外の景色は絵だけで、歩けない・置けない・保存されない。
 */
export interface Backdrop {
  /** 近くの景色：city＝ビルの街並み／town＝家と田んぼ／village＝家が少しと林／forest＝森／none＝なし */
  near: 'city' | 'town' | 'village' | 'forest' | 'none';
  /** 遠くの景色：mountains＝高い山並み／hills＝低い丘／none＝なし */
  far: 'mountains' | 'hills' | 'none';
  /** 海にする辺（w＝西／e＝東／n＝北／s＝南）。書かない辺は、観光地のふちの様子から自動で決める */
  sea?: ('w' | 'e' | 'n' | 's')[];
  /** 遠くに低い街並みを見せる辺（例：山の上から町を見下ろす場所） */
  farCity?: ('w' | 'e' | 'n' | 's')[];
  /** その場所だけの作りこみ（足摺岬の崖／桂浜公園の浜・松・お店など） */
  feature?: 'ashizuri-cape' | 'katsurahama-park' | 'shimanto-river' | 'muroto-cape';
}

/** 1つの観光地＝1つのコンパクトワールド */
export interface SpotDefinition {
  id: string;
  /** 表示名（英語） */
  name: string;
  /** 日本語名 */
  nameJa: string;
  /** ハブカードのアイコン */
  emoji: string;
  /** 実装済みか（false は「Coming soon」） */
  available: boolean;
  /** カメラが周回する中心（オービット用） */
  center: Vec3;
  /** 初期のカメラ距離（オービット用） */
  viewDistance: number;
  /** 歩行モードのスポーン地点（足元）と向き（ラジアン） */
  spawn?: { pos: Vec3; yaw: number };
  /** ボクセルで景観を構築する（available のときのみ） */
  build?: (world: World) => void;
  /** 選択できる構造物 */
  objects?: SceneObject[];
  /**
   * 歩ける範囲＝建築できる範囲（直方体・包含。x/z のみ使用）。
   * この外（周りの空中＝奈落）へは出られないよう、見えない壁で止める。
   * 編集モードでは、この中なら**既存の地面・建物・木などに付け足し**できる。
   * 消せるのは自分で置いたブロックだけ（元の物は壊せない）。
   * 作り込んだ地面の外周に合わせて設定する。未設定なら歩行制限なし＆編集不可。
   */
  field?: Region;
  /** まわりの景色の種類（無ければ、草地と低い丘） */
  backdrop?: Backdrop;
}
