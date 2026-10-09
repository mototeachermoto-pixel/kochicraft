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
| 公開デプロイ | `AKfycbz_y2f_vQIULz7J1wfkzhlVnbGoYOtnNO_JWY1FO9nokDkFWnS3jq3N2QXqQWuUcPk`（2026-10-08時点で版3） |
| テスト用（先生だけ） | https://script.google.com/a/macros/g.kochi-u.ac.jp/s/AKfycbwZDvQcfuqYZpP3L1tM0O9Mxy-SHOIbHpnUL8zEUQ/dev |
| 手元のGAS用フォルダ | `gas/`（Code.js・appsscript.json・.clasp.json は記録済み。index.html と photos_*.html はビルドで毎回作る） |

- `npm run build:gas` で次の2つを作る。
  - `gas/index.html`：アプリ本体を1枚にまとめたもの
  - `gas/photos_<観光地>.html`：写真を長い辺640pxに縮め、観光地ごとにまとめたもの（`scripts/gas_photos.py`）
- 写真は、GASの `getPhotos()` がこのファイルから返す。アプリ側（`src/data/GasPhotos.ts`）は、観光地に入った時点で、その観光地の写真をまとめて先読みする。
- **GAS以外（手元・GitHub）では、今までどおり `public/photos` を直接読む。**

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

## 残っている宿題
- GAS版で、先生が入れた写真・声・書き足した英文や、子どもが建てたブロックが、iPadで開き直しても残っているか（念のため確認）。
- 先生が「Add a voice」で入れる声のファイルは縮めていない。大きいと保存できず、黄色い知らせが出る。
- 前から持ち越し：高知城天守(38.6°)・足摺岬白山洞門(-56°)の見上げ角、ジャンプが3ブロックになったことで意図しない場所に登れる可能性（どちらも実害が出たら対処）。
