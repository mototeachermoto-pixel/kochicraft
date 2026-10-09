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

// ===== 子どもの作品の保存（ブロック・付け足し文・写真・声） =====
// iPad の Safari は、GAS のページの中の保存（localStorage）を、Safari を閉じると消してしまう。
// そこで、子どもの番号（例：5A12）ごとに、先生の大学ドライブの「KochiCraft」フォルダの中へ保存する。
// 1人につき2つのファイル：<番号>.json（ブロック・付け足し文）と <番号>.media.json（写真・声）。
// 写真・声は大きいので分けておき、ブロックを置くたびに大きなファイルを書き直さないようにする。

var KOCHICRAFT_FOLDER_ID = '1hOZOv2EGd2BBORztgPRWmx2E2zLzBk0p';
var SAVES_FOLDER_NAME = '子どもの保存データ';
var SAVE_ID = /^[1-6][A-Z][0-9]{1,2}$/;
var SAVE_KEY = /^kc\.(edits|guide|photo|audio)\.[A-Za-z0-9_.-]+$/;
/** 1つのファイルの上限（ドライブに1回で書ける大きさより少し小さく） */
var MAX_FILE_CHARS = 9 * 1024 * 1024;

/** 保存用フォルダ（無ければ KochiCraft フォルダの中に作る） */
function savesFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SAVES_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {
      // 消されていたら作り直す
    }
  }
  var parent = DriveApp.getFolderById(KOCHICRAFT_FOLDER_ID);
  var it = parent.getFoldersByName(SAVES_FOLDER_NAME);
  var folder = it.hasNext() ? it.next() : parent.createFolder(SAVES_FOLDER_NAME);
  props.setProperty('SAVES_FOLDER_ID', folder.getId());
  return folder;
}

/** 先生が最初に1回だけ実行する：ドライブへ保存する許可を出し、保存用フォルダを作る */
function setupSaves() {
  var url = savesFolder_().getUrl();
  Logger.log('保存用フォルダ: ' + url);
  return url;
}

function checkId_(id) {
  if (typeof id !== 'string' || !SAVE_ID.test(id)) throw new Error('番号が正しくありません');
}

function partOf_(key) {
  return /^kc\.(photo|audio)\./.test(key) ? 'media' : 'main';
}

function fileName_(id, part) {
  return id + (part === 'media' ? '.media.json' : '.json');
}

function findFile_(folder, name) {
  var it = folder.getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

function readPart_(folder, id, part) {
  var f = findFile_(folder, fileName_(id, part));
  if (!f) return {};
  try {
    var d = JSON.parse(f.getBlob().getDataAsString());
    return d && d.items ? d.items : {};
  } catch (e) {
    return {};
  }
}

/** アプリから呼ばれる：その子の保存をすべて { キー: 値 } で返す（まだ無ければ空） */
function loadSave(id) {
  checkId_(id);
  var folder = savesFolder_();
  var items = readPart_(folder, id, 'main');
  var media = readPart_(folder, id, 'media');
  Object.keys(media).forEach(function (k) {
    items[k] = media[k];
  });
  return items;
}

/**
 * アプリから呼ばれる：変わった分だけを受け取って保存する。
 * changes は { キー: 新しい値（消すときは null） }。
 * 大きすぎて保存できないときは { ok: false, reason: 'too-big' } を返す（何も変えない）。
 */
function saveItems(id, changes) {
  checkId_(id);
  if (!changes || typeof changes !== 'object') throw new Error('保存する中身が正しくありません');
  var folder = savesFolder_();
  var parts = {};
  Object.keys(changes).forEach(function (key) {
    if (!SAVE_KEY.test(key)) return;
    var v = changes[key];
    if (v !== null && typeof v !== 'string') return;
    var part = partOf_(key);
    if (!parts[part]) parts[part] = readPart_(folder, id, part);
    if (v === null) delete parts[part][key];
    else parts[part][key] = v;
  });
  var texts = {};
  var names = Object.keys(parts);
  for (var i = 0; i < names.length; i++) {
    var part = names[i];
    texts[part] = JSON.stringify({ v: 1, id: id, updatedAt: new Date().toISOString(), items: parts[part] });
    if (texts[part].length > MAX_FILE_CHARS) return { ok: false, reason: 'too-big' };
  }
  names.forEach(function (part) {
    var name = fileName_(id, part);
    var f = findFile_(folder, name);
    if (f) f.setContent(texts[part]);
    else folder.createFile(name, texts[part], MimeType.PLAIN_TEXT);
  });
  return { ok: true };
}
