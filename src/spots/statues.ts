import type { Build } from './Build';

/**
 * 観光地の銅像・人物像の部品（台座は各観光地で作る）。
 * 写真の像に近づけるため、数ブロックの「棒」ではなく、袴・着物・そで・頭のある立ち姿にする。
 * 大きな像は ryomaFigure.ts（坂本龍馬像）。ここは高さ9マスほどの「ふつうの大きさ」の像。
 *
 * cx, cz＝台座の中心／py＝台座のいちばん上のブロックの高さ（足はその1つ上から）
 * facing＝顔を向ける方向（+1＝+z／-1＝-z）。-1 のときは全体を180度回す。
 * 像から見て dx：+＝像の左手側、dz：+＝顔の向き。
 */

/** 世界の座標に直して置く道具（facing に合わせて回す） */
function placer(b: Build, cx: number, py: number, cz: number, facing: 1 | -1) {
  const f = facing;
  const put = (dx: number, y: number, dz: number, id: number) => b.set(cx + f * dx, py + y, cz + f * dz, id);
  const fill = (dx0: number, dx1: number, y0: number, y1: number, dz0: number, dz1: number, id: number) => {
    for (let y = y0; y <= y1; y++)
      for (let dz = dz0; dz <= dz1; dz++)
        for (let dx = dx0; dx <= dx1; dx++) put(dx, y, dz, id);
  };
  return { put, fill };
}

export type FigurePose =
  /** 両手をたらして立つ */
  | 'stand'
  /** 右手を横へのばす（演説・指さし。板垣退助像など） */
  | 'point'
  /** 右手を前に出して、遠くを指さす */
  | 'reach'
  /** 右手を高く上げる（ジョン万次郎像など） */
  | 'wave';

/**
 * 着物と袴の立ち姿（高さ9マス・はば3〜5）。
 * 板垣退助像・中岡慎太郎像・ジョン万次郎像などに使う。
 */
export function kimonoFigure(
  b: Build,
  cx: number,
  py: number,
  cz: number,
  facing: 1 | -1,
  body: number,
  dark: number,
  pose: FigurePose = 'stand',
): void {
  const { put, fill } = placer(b, cx, py, cz, facing);

  // 袴（1〜3段目）：はば3・奥行き2。前のまん中に足の分かれ目
  fill(-1, 1, 1, 3, -1, 0, body);
  put(0, 1, 0, dark);
  put(0, 2, 0, dark);
  // 足の先（前に出る）
  put(-1, 1, 1, dark);
  put(1, 1, 1, dark);
  // 帯（4段目）
  fill(-1, 1, 4, 4, -1, 0, dark);
  // 胴（5〜6段目）とえりの合わせ目
  fill(-1, 1, 5, 6, -1, 0, body);
  put(0, 6, 0, dark);
  // 肩はばのそで（左右）。左手は下へたらす
  fill(2, 2, 4, 6, -1, 0, body);
  if (pose === 'stand') {
    fill(-2, -2, 4, 6, -1, 0, body);
  } else if (pose === 'point') {
    // 右手を横へまっすぐのばす
    fill(-2, -2, 5, 6, -1, 0, body);
    put(-3, 6, 0, body);
    put(-4, 6, 0, body);
  } else if (pose === 'wave') {
    // 右手を斜め上へ高く上げる
    fill(-2, -2, 5, 6, -1, 0, body);
    put(-2, 7, 0, body);
    put(-3, 8, 0, body);
    put(-3, 9, 0, body);
  } else {
    // 右手を前へ出して、遠くを指さす
    fill(-2, -2, 5, 6, -1, 0, body);
    put(-2, 6, 1, body);
    put(-2, 6, 2, body);
  }
  // 首と頭（7〜8段目）
  fill(0, 0, 7, 8, -1, 0, body);
  // 髪（後ろと上）
  put(0, 8, -1, dark);
  put(0, 9, -1, dark);
}

/**
 * 馬に乗った武将の像（山内一豊の騎馬像）。馬の頭が facing の方を向く。
 * 長さ6・高さ9マスほど。馬は4本の脚・胴・首・頭・しっぽ、武将はかぶとと前立て。
 */
export function horseRider(
  b: Build,
  cx: number,
  py: number,
  cz: number,
  facing: 1 | -1,
  body: number,
  dark: number,
  gold: number,
  spear = false,
): void {
  const { put, fill } = placer(b, cx, py, cz, facing);
  // 馬の脚（後ろ脚2本は地面に、前脚の1本は高く上げる）
  fill(0, 0, 1, 2, -2, -2, body); // 後ろ脚
  put(0, 1, 2, body); // 前脚（地面）
  put(0, 2, 2, body);
  put(0, 2, 3, body); // 上げた前脚
  // 馬の胴（3〜4段目・長さ5）
  fill(0, 0, 3, 4, -2, 2, body);
  // しっぽ
  put(0, 4, -3, dark);
  put(0, 3, -3, dark);
  put(0, 2, -3, dark);
  // 首と頭（前へ突き出し、少し下を向く）
  put(0, 5, 2, body);
  put(0, 6, 3, body);
  put(0, 5, 3, body);
  put(0, 6, 4, body);
  put(0, 5, 4, dark); // 鼻先
  put(0, 7, 2, dark); // たてがみ
  put(0, 6, 2, dark);
  // 武将：両足を馬の左右にたらす
  fill(-1, -1, 3, 4, 0, 0, dark);
  fill(1, 1, 3, 4, 0, 0, dark);
  // 武将：胴（よろい）と肩
  fill(0, 0, 5, 6, -1, 0, body);
  fill(-1, 1, 6, 6, -1, 0, body);
  // 手綱を持つ手
  put(0, 5, 1, dark);
  // 頭とかぶと、金色の前立て
  put(0, 7, -1, body);
  put(0, 8, -1, dark);
  put(0, 9, -1, gold);
  // 長いやり（右手から前の上へ、ななめにのびる）。山内一豊の騎馬像の本物の写真に合わせて
  if (spear) {
    put(-1, 5, 0, dark);
    put(-1, 6, 1, dark);
    put(-1, 7, 2, dark);
    put(-1, 8, 3, dark);
    put(-1, 9, 4, dark);
  }
}
