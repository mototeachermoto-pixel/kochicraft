# KochiCraft 引き継ぎ（GAS公開版・2026-10-09）

## 今の状態
- **完成・公開済み**。学校のiPadで開けて、写真・ボタン・英語の読み上げも問題なし（2026-10-08に先生が確認）。
- **子どもが使う公開用URL**（ログイン不要。今後もこのURLを使い続ける）
  https://script.google.com/macros/s/AKfycbz_y2f_vQIULz7J1wfkzhlVnbGoYOtnNO_JWY1FO9nokDkFWnS3jq3N2QXqQWuUcPk/exec
- すべての変更は記録（コミット f7703ab ほか）して、GitHubにも送ってある。

## なぜGASなのか
学校のネットワークでは、Cloudflare（workers.dev）もGitHub Pages（github.io）も開けなかった。
大学のGoogle（Google Apps Script）なら学校で開けたので、GASで公開している。
GitHub版（https://mototeachermoto-pixel.github.io/kochicraft/）は、記録の置き場所（バックアップ）として残しているだけ。

## 公開のしくみ
| もの | 場所・値 |
|---|---|
| Googleアカウント | ryusaku@g.kochi-u.ac.jp（大学） |
| GASプロジェクト | scriptId `13hNtUZ1eQlSRsVvjzJfNiK5_cyDIns_mqsM8QULX9Z-Ut9g21WFdE6at`（ドライブの「KochiCraft」フォルダの中） |
| 公開デプロイ | `AKfycbz_y2f_vQIULz7J1wfkzhlVnbGoYOtnNO_JWY1FO9nokDkFWnS3jq3N2QXqQWuUcPk`（2026-10-09時点で版5。版4＝年度別にする前、版3＝子どもごとの保存を入れる前） |
| 子どもの作品の保存先 | ドライブの「KochiCraft」フォルダ →「子どもの保存データ」→「2026年度」のような**年度ごとのフォルダ**（1人2ファイル：`5A12.json`＝ブロック・付け足し文、`5A12.media.json`＝写真・声） |
| テスト用（先生だけ） | https://script.google.com/a/macros/g.kochi-u.ac.jp/s/AKfycbwZDvQcfuqYZpP3L1tM0O9Mxy-SHOIbHpnUL8zEUQ/dev |
| 手元のGAS用フォルダ | `gas/`（Code.js・appsscript.json・.clasp.json は記録済み。index.html と photos_*.html はビルドで毎回作る） |

- `npm run build:gas` で次の2つを作る。
  - `gas/index.html`：アプリ本体を1枚にまとめたもの
  - `gas/photos_<観光地>.html`：写真を長い辺640pxに縮め、観光地ごとにまとめたもの（`scripts/gas_photos.py`）
- 写真は、GASの `getPhotos()` がこのファイルから返す。アプリ側（`src/data/GasPhotos.ts`）は、観光地に入った時点で、その観光地の写真をまとめて先読みする。
- **GAS以外（手元・GitHub）では、今までどおり `public/photos` を直接読む。**

## 子どもの作品の保存（2026-10-09〜）
- iPad の Safari は、GAS のページの中の保存（localStorage）を **Safari を閉じると消してしまう**（先生が iPad で確認済み）。
  「Save file / Open file」も GAS の中では使いにくい。そこで、**子どもの番号ごとに大学の Google（ドライブ）へ保存**するようにした。
- アプリを開くと最初に「What is your number?」と聞く。番号は **学年＋組＋番号（例：5A12）**。全角・小文字・「5A01」も受け付ける。
- ブロック・付け足した英文・写真・声を、変えてから約2.5秒後に、変えた分だけ送る（`src/data/SaveStorage.ts` → `gas/Code.js` の `saveItems`）。読み込みは `loadSave`。
- **「👀 See a friend's world」で友だちの番号を入れると、見るだけ**（Build・＋・写真や声の追加は出ない）。「🏠 Back to my world」で戻る。
- 合言葉はない。最初の「番号は？」で友だちの番号を入れると、その子の作品を作り変えられる（必要なら4けたの合言葉を足す案あり）。ドライブにはファイルの変更履歴が残る。
- GAS 版では Save file / Open file は出さない。手元・GitHub 版は今までどおり端末に保存（番号の画面も出ない）。
- 手元で試すときは `http://localhost:5192/?cloud=fake`（にせの保存先。公開版には入らない）。
- ドライブへの許可は、先生が GAS の編集画面で `setupSaves` を1回実行して出した（2026-10-09）。保存先フォルダの ID はスクリプトのプロパティ `SAVES_FOLDER_ID` に入っている。
- **年度（4月〜3月）ごとにフォルダを分けている**（`gas/Code.js` の `yearFolder_`）。番号は毎年くり返し使われるので、4月になると新しい年度のフォルダが自動ででき、まっさらから始まる。前の年度の作品はそのフォルダに残るので、いらなくなったら先生がその年度のフォルダを消す。年度フォルダの ID はスクリプトのプロパティ `SAVES_YEAR_FOLDER_ID_<年>` に入る。2026-10-09、先生がドライブで「2026年度」フォルダができていることを確認済み。
- 容量の目安：ブロックと英文だけなら1人0.1MB未満、写真10枚で約0.5MB、声も入れると1人約1〜3MB。100人で1年およそ100〜300MB。自動では消えない。
- 試し用の番号は「6Z99」など（子どもの番号と混ざらないもの）。2026-10-09 に 6Z99 で、公開版で保存→開き直しで戻ることを確認済み。

## 直したあと、公開版に反映する手順
すべて `マインクラフト風アプリ` フォルダで行う。このPCでは証明書のエラーが出るので、clasp には `NODE_OPTIONS=--use-system-ca` を付ける。

```bash
npm run build:gas
cd gas
NODE_OPTIONS=--use-system-ca clasp push --user univ --force
NODE_OPTIONS=--use-system-ca clasp update-deployment --user univ AKfycbz_y2f_vQIULz7J1wfkzhlVnbGoYOtnNO_JWY1FO9nokDkFWnS3jq3N2QXqQWuUcPk --description "変更の説明"
```

- 同じ公開デプロイを更新するので、**URLは変わらない**。
- 不具合が出たら、`--versionNumber 3` のように前の版の番号を付けて update-deployment すれば戻せる。
- **新しい公開デプロイを作る（公開範囲を広げる）操作は、先生が自分でターミナルで実行する決まり**（大学のマニュアルどおり）。
- 反映したら、ログインしていないブラウザで公開用URLを開き、観光地に入って写真が出るかを確かめる。

## 作業で気をつけること（先生とのやりとり）
- **返事は日本語で、専門用語を避けて平易に。**
- **ページを先生に開いてもらうときは、Microsoft Edgeで開く**（`Start-Process msedge -ArgumentList '<URL>'`）。別のブラウザに移らせない。長いURLの「コピーして貼って」はお願いしない。
- 先生は**「作り替えない・作り直さない」「小さく一つずつ」**を大事にしている。大きな変更は、提案して了解をもらってから。
- 音声は**端末の読み上げの声**で話す（iPadには最初から英語の声がある）。音声ファイルを作る方式（Azureなど）は先生の判断で取りやめた。
- 英文は**小5レベル**、画面の英文と読み上げを必ず同じにする。

## 古くなったもの・使っていないもの
- `公開用フォルダを更新.bat`・`引き継ぎ_公開とGit.md`：Cloudflare時代の手順なので使わない。
- ドライブの「KochiCraft」フォルダの中の「photos」フォルダ：今は使っていない（消しても動く）。
- デスクトップの `GASテスト` フォルダと、ドライブの「GASテスト」：最初の接続テスト用。消してもよい。

## 2026-10-09 に直したこと（版4）
- ジャンプのときの画面の乱れ：3D画面に `touch-action: none`（iPadでページが動かないように）、画面をなぞる指と JUMP・方向ボタンの指を区別、うしろ／遠く視点でカメラが壁や天井に入らないように（`WalkController.ts`）。12か所すべてで自動試験し、カメラがブロックに入る回数は0回。
- 子どもごとの保存（上の「子どもの作品の保存」）。

## 残っている宿題
- iPad で、子どもごとの保存を確かめる（6Z99 などでブロックを置く → Safari を完全に閉じる → 開き直して番号を入れる）。2本の指の件も iPad で確かめる。
- 「Add a voice」の声は縮めていない。長すぎる声（約1.5MBより大きいもの）は保存できず、知らせが出る。
- 上のボタンを隠す設定（`.hidden`）が、もともと `spot-toolbar` の中のボタンには効いていない（作る画面でも Map・視点・キャラクターのボタンが出たまま）。今は Build ボタンだけ隠れるようにした。ほかも直すかは先生に聞いてから。
- 前から持ち越し：高知城天守(38.6°)・足摺岬白山洞門(-56°)の見上げ角、ジャンプが3ブロックになったことで意図しない場所に登れる可能性（どちらも実害が出たら対処）。
