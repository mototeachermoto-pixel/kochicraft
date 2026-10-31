import type { Build } from './Build';

/**
 * 坂本龍馬の像の「人の部分」（台座は各観光地で作る）。桂浜と龍馬像の2か所で使う。
 * 写真（public/photos/ryoma-statue/statue.jpg・katsurahama/ryoma.jpg）に近づけるため、
 * 前は「3マスの横棒＋たて棒」で十字架のように見えていたものを、
 * 幅7・奥行き3〜4・高さ15マスの立ち姿にした。
 *
 *   - すそが広い袴（はかま）と、ブーツの先
 *   - 着物の胴と帯、えりの合わせ目
 *   - 右手は長いそでをたらし、左手は着物のふところに入れる（懐手＝ふところに手の盛り上がり）
 *   - 首と、3×3の頭（目・後ろ髪・頭のてっぺんの髪）
 *
 * 像の色は、写真の青緑がかった銅像に近い「銅像（bronze）」、
 * 袴・髪・目・帯などの濃い所は「銅像（濃い）（bronzedark）」にして、形が分かるようにする。
 *
 * cx, cz＝台座の中心／py＝台座のいちばん上のブロックの高さ（足はその1つ上から）
 * facing＝顔を向ける方向（+1＝+z／-1＝-z）。-1 のときは全体を180度回す。
 */
export function ryomaFigure(
  b: Build,
  cx: number,
  py: number,
  cz: number,
  facing: 1 | -1,
  body: number,
  dark: number,
): void {
  const f = facing;
  // 像から見た「横（dx：+＝像の左手側）」「前（dz：+＝顔の向き）」を、世界の座標に直す
  const X = (dx: number) => cx + f * dx;
  const Z = (dz: number) => cz + f * dz;
  const put = (dx: number, y: number, dz: number, id: number) => b.set(X(dx), py + y, Z(dz), id);
  const fill = (dx0: number, dx1: number, y0: number, y1: number, dz0: number, dz1: number, id: number) => {
    for (let y = y0; y <= y1; y++)
      for (let dz = dz0; dz <= dz1; dz++)
        for (let dx = dx0; dx <= dx1; dx++) put(dx, y, dz, id);
  };

  // 袴（1〜5段目）：はば5・奥行き3。すそは少し後ろに広げる
  fill(-2, 2, 1, 5, -1, 1, body);
  fill(-2, 2, 1, 1, -2, -2, body); // すその後ろの広がり
  // 袴のひだ（前のまん中＝両足の分かれ目を濃い色の線に）
  put(0, 1, 1, dark);
  put(0, 2, 1, dark);
  put(0, 3, 1, dark);
  // ブーツの先（前に出る）。像の右足を少し前に
  put(-1, 1, 2, dark);
  put(1, 1, 2, dark);
  put(-1, 2, 2, dark);

  // 帯（6段目）
  fill(-2, 2, 6, 6, -1, 1, dark);

  // 着物の胴（7〜9段目）
  fill(-2, 2, 7, 9, -1, 1, body);
  // えりの合わせ目（前の中央に濃い線）
  put(0, 8, 1, dark);
  put(0, 9, 1, dark);
  // 左手を入れたふところの盛り上がり（像の左胸）
  put(1, 8, 2, body);

  // 肩（10段目）：はば7
  fill(-3, 3, 10, 10, -1, 1, body);
  // 右手：長いそでを下までたらす（像の右がわ）
  fill(-3, -3, 6, 9, -1, 1, body);
  // 左手：ひじを曲げてふところへ入れるので、そでは短い
  fill(3, 3, 8, 9, -1, 0, body);

  // 首（11段目）
  put(0, 11, 0, body);

  // 頭（12〜13段目）：3×3。顔は写真と同じく銅像の色のまま
  // （目を濃い色にすると1マスが大きすぎて、お面のように見えるため入れない）
  fill(-1, 1, 12, 13, -1, 1, body);
  // 後ろ髪
  fill(-1, 1, 12, 13, -1, -1, dark);
  // 頭のてっぺんの髪と、ちょんまげ
  fill(-1, 1, 14, 14, -1, 0, dark);
  put(0, 15, -1, dark);
}
