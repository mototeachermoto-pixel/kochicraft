function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('KochiCraft — 高知県バーチャル観光ワールド')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
}

var PHOTO_PATH = /^photos\/([A-Za-z0-9_-]+)\/[A-Za-z0-9_.-]+\.(jpe?g|png)$/i;
var MAX_PHOTOS_PER_CALL = 12;

/**
 * アプリから呼ばれる：写真（'photos/<観光地ID>/<名前>.jpg'）をまとめて { パス: dataURL } で返す。
 * 写真は npm run build:gas で観光地ごとのファイル（photos_<観光地ID>.html）に入れてあり、
 * ドライブを読まずに返せるので速い。
 */
function getPhotos(paths) {
  if (!Array.isArray(paths) || paths.length > MAX_PHOTOS_PER_CALL) {
    throw new Error('写真の指定が正しくありません');
  }
  var bundles = {};
  var result = {};
  paths.forEach(function (path) {
    var m = typeof path === 'string' && path.match(PHOTO_PATH);
    if (!m) return;
    var spot = m[1].replace(/-/g, '_');
    if (!(spot in bundles)) {
      try {
        bundles[spot] = JSON.parse(HtmlService.createHtmlOutputFromFile('photos_' + spot).getContent());
      } catch (e) {
        bundles[spot] = {};
      }
    }
    if (bundles[spot][path]) result[path] = bundles[spot][path];
  });
  return result;
}
