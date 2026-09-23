# KochiCraft 引き継ぎ資料（HANDOVER）

> このファイル＋ `README.md` ＋ `CLAUDE.md` ＋ `TODO.md` の4つを読めば、新しいセッションで開発を100%再開できます。
> **コードとワールドはこのリポジトリにそのまま入っています**（観光地は `src/spots/*.ts`、各観光地ワールドはコードから毎回構築）。新セッションは `npm install` → `npm run build` → `npm run dev` でそのまま動きます。

最終更新：2026-07-08（全12観光地を実物準拠にブラッシュアップ＋英語を外国語科600〜700語の範囲に調整＋ガイド英文の「付け足し編集」機能を追加）

---

## 0. いまの状態（ひとことで）
- **高知の観光地 全12スポットを実装済み**（ハブの全カードが「▶ Enter」。「Coming soon」はゼロ）。
- **歩行（自動ステップ・落下防止・スタートに戻る）／俯瞰（Look）／ブロック編集（付け足し）／保存（自動＋.kcwファイル）** まで動く。
- ビルド成功・コンソールエラー無し。`npm run build` が通る状態。

---

## 1. プロジェクト概要
- **アプリ名**：KochiCraft（コウチクラフト）
- **目的**：高知県の観光地を、ボクセル（キューブ）で再現した**コンパクトな3D空間**で見て回り、**英語で観光案内を学ぶ**教育教材。
- **想定ユーザー**：小学生（特に小5の外国語＝英語）と、その担任の先生。**iPad/タブレット中心**、説明書なしで使えること。
- **解決したい課題**：
  - 教室で「高知の観光地」を題材に、**主体的に・楽しく英語**に触れさせたい。
  - 外部AI・ネット接続・アカウント不要で、**学校環境でそのまま動く**こと。
  - 著作権に配慮した（商用ゲームに依存しない）オリジナルの見た目。

### コンセプトの要点（コードから読み取れない「なぜ」）
- これは **Minecraftのような自由徘徊ゲームではない**。「観光地ごとの小さな3D教材を選んで見る」形（観光地選択型3D教材）。
- 「広い自由ワールドは不要。各観光地ワールドを限定範囲で作り込む」方針。
- **UI も解説もすべて英語表記**（外国語学習のため）。レベルは**小学5年生**（例：`This is Katsurahama Beach.` / `It is big.`）。
- **マウスは使わない**（キーボード＋タッチのみ）。教室のタブレット/PC前提。
- **完全オフライン**（外部API・ネット通信なし、ブラウザ標準のみ）。

---

## 2. 技術構成
| 項目 | 内容 |
|---|---|
| 言語 | **TypeScript**（strict、型安全を徹底） |
| 3Dエンジン | **Three.js**（^0.169） |
| ビルド/開発 | **Vite**（^5.4、`base: './'` で静的・オフライン動作） |
| UIライブラリ | **なし**（素のDOM＋CSS。`src/ui/styles/main.css` に集約） |
| 音声 | **Web Speech API（SpeechSynthesis）**＝ブラウザ標準。＋先生が録音音声をアップロード可 |
| 保存 | **localStorage**（写真・音声・編集差分を dataURL/JSON で）＋編集は **.kcwファイル**書出/読込 |
| DB / ORM / API / 認証 / バックエンド | **すべて無し（N/A）**。完全オフラインのブラウザ単体アプリ |
| パッケージ | `three`, `@types/three`, `typescript`, `vite` のみ |

---

## 3. ディレクトリ構成 と「現役 / 温存」区分

```
マインクラフト風アプリ/
├── index.html              # エントリHTML（#app, #hud, #loading）
├── package.json / tsconfig.json / vite.config.ts
├── README.md / CLAUDE.md / HANDOVER.md / TODO.md
├── .claude/launch.json     # プレビュー設定（name: kochicraft-dev, port 5173）
└── src/
    ├── main.ts                         ✅現役 エントリ（Engine起動）
    ├── config/constants.ts             ✅現役 定数（物理/カメラ/STEP_HEIGHT 等）
    ├── types/index.ts                  ✅現役 共通型
    ├── core/
    │   ├── Engine.ts                   ✅現役 中枢（ハブ⇄観光地、walk/orbit/build、選択、情報、バナー、Start、保存UI）
    │   ├── SceneManager.ts             ✅現役 シーン・ライト・空
    │   ├── OrbitCameraController.ts    ✅現役 周回カメラ（Look）
    │   ├── WalkController.ts           ✅現役 歩行（一人称・自動ステップ・フィールド境界 setBounds）
    │   ├── WorldManager.ts             ✅現役 観光地ロード/破棄・対象選択・近接バナー・写真音声＆編集差分の復元
    │   ├── BuildController.ts          ✅現役 編集モード（中央カーソルで付け足し設置/自分の分だけ削除・ゴースト/連続積み）
    │   ├── Clock.ts                    ⏸️温存
    │   └── InputManager.ts             ⏸️温存
    ├── world/
    │   ├── World.ts                    ✅現役 ボクセル管理・setBlocksBatch・clearAll・getBlock/setBlock
    │   ├── Chunk.ts / ChunkMesher.ts   ✅現役 チャンク＋グリーディメッシュ
    │   ├── VoxelData.ts / BlockRegistry.ts  ✅現役 ボクセル配列/RLE・ブロック定義参照
    │   ├── blocks/blockTypes.ts        ✅現役 全21種ブロック定義（色のみ・テクスチャ無し）
    │   └── TerrainGenerator.ts         ⏸️温存
    ├── player/
    │   ├── Player.ts / Physics.ts      ✅現役 歩行の物理・衝突（自動ステップ＝1段は歩いて越える）
    │   ├── Avatar.ts                   ✅現役 キャラクター4種（Boy/Girl/Pet/Robot）。箱だけのオリジナル造形＋歩行アニメ
    │   └── PlayerController.ts          ⏸️温存
    ├── spots/                          ★現役の中心
    │   ├── SpotDefinition.ts           ✅ 型（SpotDefinition / SceneObject / ObjectGuide / Region / field）
    │   ├── Build.ts                    ✅ ボクセル組み立て補助（box/slab/pillar/sphere/disc/pine/mound/coneFoliage）
    │   ├── SpotRegistry.ts             ✅ 全12観光地の登録（placeholder撤去・すべて available:true）
    │   ├── katsurahama.ts              ✅ 桂浜（ひな型。竜王宮＝浜から石の道で渡り鳥居をくぐってほこらへ・月の名所・五色石・龍馬像）
    │   ├── kochiCastle.ts              ✅ 高知城（4重天守・本丸御殿[天守と両方現存は全国唯一]・石垣＋石樋・追手門・板垣退助像[石段の上り口]・山内一豊騎馬像・桜）
    │   ├── harimayaBridge.ts           ✅ はりまや橋（朱色の太鼓橋・堀川・柳・からくり時計・純信とお馬の像・路面電車＋電車通り）
    │   ├── nikobuchi.ts                ✅ にこ淵（手すり付きの細い石段で谷へ→仁淀ブルーの淵[浅瀬と深淵の青]・細い滝・水神の大蛇伝説。縦構造）
    │   ├── shimanto.ts                 ✅ 四万十川（清流・狭い沈下橋[車1台分・手すり無し]・カヌー2艘・屋形船・砂の河原・緑の山）
    │   ├── muroto.ts                   ✅ 室戸岬（岩礁[隆起する大地]・丘の上の白い灯台・ヤシ・アコウの木・御厨人窟ふうの岩屋・中岡慎太郎像）
    │   ├── ashizuri.ts                 ✅ 足摺岬（断崖・海へ張り出すガラス柵の展望台・白い灯台・椿のトンネル・白山洞門・最南端の碑・ジョン万次郎像[入口広場]）
    │   ├── hirome.ts                   ✅ ひろめ市場（屋内市場・12店・藁焼きの豪快な炎・横長の机＋低い椅子[相席]・赤提灯・入口の見通し良）
    │   ├── ryomaStatue.ts              ✅ 坂本龍馬像（独立。大階段→顔の高さのデッキ[柵は像側＝入口は開放]＝龍馬に大接近。1928年建立の史実）
    │   ├── makino.ts                   ✅ 牧野植物園（最大フィールド・適密度の植物・ガラス大温室・池と木道・記念館・スエコザサ[妻への感謝の命名]）
    │   ├── noichi.ts                   ✅ のいち動物園（実在の動物のみ：ハシビロコウ/キリン＋シマウマ混合展示/チンパンジー/カピバラ/ワオキツネザル/レッサーパンダ）
    │   └── ryugado.ts                  ✅ 龍河洞（鍾乳洞・鍾乳石/石筍/石柱・地底の川・記念の滝・神の壺[弥生土器]）
    ├── features/language/SpeechService.ts  ✅現役 英語TTS（自然な声を自動選択）
    ├── features/{language/LanguageManager, tourism/*, quiz/*, teacher/*}  ⏸️温存
    ├── data/
    │   ├── PhotoStore.ts               ✅現役 写真・音声を localStorage 保存
    │   ├── GuideStore.ts               ✅現役 ガイド英文の「付け足し」を localStorage 保存（基本文はコード）
    │   ├── EditStore.ts                ✅現役 編集差分の保存（localStoreオートセーブ＋.kcw書出/読込）
    │   └── SaveManager/Serializer/Storage  ⏸️温存
    ├── editor/
    │   ├── Raycaster.ts                ♻️再利用 VoxelRaycaster を BuildController が使用（中央カーソル）
    │   └── EditorManager/History/Selection/tools/*  ⏸️温存
    ├── state/EventBus.ts               ⏸️温存
    └── ui/
        ├── HubScreen.ts                ✅現役 観光地一覧（カードグリッド）
        ├── panels/InfoPanel.ts         ✅現役 右の情報パネル（英語・写真・音声）
        ├── BuildPalette.ts             ✅現役 編集モードのホットバー（番号＋色＋英語名＋置き方の説明）
        ├── styles/main.css             ✅現役 全スタイル（新旧混在）
        └── HUD/TitleScreen/modals/*/panels/*  ⏸️温存
```

> **⏸️温存（parked）の意味**：`tsc` は通るが**現在の Engine からは呼ばれていない**旧サンドボックスの資産。**新フローの仕様だと思って読まないこと。** 削除や大改修は**提案してから**。`editor/Raycaster` だけは現役で再利用済み。

---

## 4. 実装済みの機能（現役フロー）
### 観光地・基本
1. **ハブ画面**：高知の観光地12個をカード一覧（英語名＋日本語名＋絵文字）。**全カードが「▶ Enter」**。
2. **観光地ワールドへ移動**：選ぶと、その観光地専用のコンパクトなボクセル空間を `build()` で構築。
3. **近接で英語名バナー**：対象に近づくと画面上部に英語名（面積が小さい＝具体的な対象を優先）。
4. **構造物の選択 → 情報パネル**：タップ（or Tab順送り、中央照準＋E）。右に **You can / Special / About**（英語・小5）。
5. **英語音声（Listen）**：自然な声を自動選択して読み上げ。**先生の録音音声があれば優先再生**。
6. **写真・音声アップロード（先生）**：「📷 Add a photo」「🎤 Add a voice」→ localStorage 保存（再読み込み後も復元）。
6b. **ガイド英文の付け足し編集**：情報パネルの各欄（You can / Special / About）の「＋」→入力→Save。
    基本文（コード内）は消えず、**足した文だけ**が localStorage（`GuideStore`）に保存・復元される。Clear で付け足しのみ削除。
    Listen は付け足し文もあわせて読み上げる。英語は**外国語科の約600〜700語の範囲**を目安（CLAUDE.md §1）。
7. **描画最適化**：チャンク＋グリーディメッシュ。観光地切替は `World.clearAll()`。ワールドは内部96×96固定。

### 歩行（Walk・既定）
8. 一人称。**キーは英単語の頭文字**にそろえている。**移動＝矢印キー**（方向ボタンも可）、**視点＝Shift＋矢印**（左右＝振り向く）と
   **U＝Up・D＝Down**、ドラッグでも可。ジャンプ＝**J**／Space／**右下のJUMPボタン**。**WASD は廃止**（W を Walk に使うため）。
   画面左下に**キー案内（🎮 Keys）**を常時表示（`Engine.keyGuideHtml(mode)` / `.key-guide`）。
8d. **行ける場所の一覧（Map）**：**M** キー／🗺️ Map ボタンで、その観光地の場所一覧（`ui/PlacesPanel.ts`）。
   選ぶと `Engine.goToObject` がその場所の手前へ移動→構造物の方を向く→説明パネルを開く。
   全12観光地で**合計81か所**。写真準備用の一覧は `名所リスト.md`。
8c. **キャラクターと視点**：**C**＝Change Character で Boy／Girl／Pet／Robot（`player/Avatar.ts`・箱だけのオリジナル造形・歩行アニメ付き）、
   **V**＝View で Eyes（一人称）→ Back（うしろ）→ Far（三人称）→ Face（正面）を循環。どちらも端末に保存
   （`kc.skin` / `kc.view`）。編集モードは一人称固定でアバター非表示。カメラは壁の手前で止まる。
8b. **マウス不使用で完結**：ハブは矢印キー＋Enter（自動フォーカス・黄色い枠）、**L**＝Look（空から見る）、**W**＝Walk、
   **B**＝Build、**D**＝Done（編集をやめる）、**P**＝Put、**T**＝Take、**H**＝Home、**Enter**／**I**＝選ぶ、**N**＝Next、
   **E**＝English（聞く）、**K**＝Keys（一覧の開閉）、**Esc**＝戻る、ブロック選択＝数字、保存/読込＝**Ctrl+S・Ctrl+O**。
   **各ボタンに押すキーを併記**（`<kbd>`）し、ボタン名とキーを一致させる（Look→L／Walk→W／Build→B／Done→D）。
   キー一覧は **K で開閉**でき、閉じると小さなボタンだけ（`localStorage: kc.keys.open`）。
   ※編集モードに入ると `lookDownForBuild()` で少し下を向く（正面のままだと中央カーソルが届かず置けないため）。
9. **自動ステップ**：1ブロックの段差は**歩くだけで越える**（`Physics.moveAndCollide` の `stepHeight`／`STEP_HEIGHT`）。
10. **フィールド境界**：各観光地の `field`（作り込んだ地面の外周）で**見えない壁**。外の空中＝奈落へ落ちない（`WalkController.setBounds`）。
11. **🏠 Start ボタン**（ツールバー・歩行時のみ）：位置も向きもスポーンへ戻す（`Engine.returnToStart`）。

### 俯瞰（Look）
12. 右上「👀 Look」で周回カメラ（ドラッグ回転・ピンチ/キーでズーム、`OrbitCameraController`）。

### 編集（Build）＋保存
13. ツールバーの🧱で編集モード。歩行と同じ移動＋**中央カーソル方式**（`VoxelRaycaster`）。
14. **付け足し建築ルール**：`field`（歩ける範囲＝建築範囲）内なら**既存の地面・建物・木など何にでも付け足せる**。**消せるのは自分で置いたブロックだけ**（差分 `edits` にある物）＝**元の物（城・像・地面）は壊れない**。
15. **ホットバー**（`BuildPalette`・下中央・**折り返しで全種スクロール無し**・番号＋色＋**英語名**＋**数字キー1〜9・0**）＋上に**置き方の英語説明**（小5）。
16. **🧱Place／✋Removeボタン**（**押しっぱなしで連続**）。Placeは**最初に狙った面の向きへ伸ばす**＝床を狙えば**まっすぐ上にタワー**（`startStack/placeContinue/endPlace`）。
17. **プレビュー**：設置位置に**半透明の色つきブロック（ゴースト＝選んだ色）＋水色枠**、削除対象に**赤枠**（`ghostFill/targetBox/removeBox`）。
18. **保存**：編集は `EditStore` が **localStorageへ自動保存**＋ **.kcwファイル書出/読込**（iPadは共有シート→「ファイル」/iCloudへ）。`WorldManager.loadSpot` が `build()` 後に差分を再適用。

### 観光地づくりの方針（重要）
19. **広い平場（平らな建築スペース）＋ふちに高品質オブジェクト**。新しい観光地もこの方針で。各 spot に必ず `field` を設定。

---

## 5. 残っている課題（やるなら）
1. 各観光地の**細部ブラッシュアップ**（見た目・配置・英語）。動物/洞窟など新しい題材の作り込み向上。
2. **写真・音声の用意**（先生がアップロードする運用 or 同梱）。実機での自動音声チェック。
3. **教師モードの新フロー版**：解説テキストを画面で編集（現状テキストはコード内固定）。
4. **クイズの新フロー版**（旧 `features/quiz/*` は parked。情報パネルに「Quiz」を足す案）。
5. **温存コードの整理**（再利用 or 削除を**提案してから**）。
6. 最適化（ワールドサイズの可変化、ロード演出、レスポンシブ最終調整）。

> ※ ユーザーの慣習：**大きな仕様判断は確認しながら**進める。新しい機能/スポットは作る前に方針を一言確認すると安全。

---

## 6. 設計方針

### コンポーネント設計（クラス指向の素DOM）
- フレームワーク不使用。**1機能=1クラス=1ファイル**。UIクラスは自分のDOMを生成し `#hud` に append、`show()/hide()`。
- 3D側は `Engine` が統括し、各 Controller/Manager に委譲（SceneManager／OrbitCameraController／WalkController／BuildController／WorldManager／World）。

### 状態管理
- 専用ライブラリなし。各Managerが自分の状態を持ち、コールバック（`onSelect`/`onNear`/`onChange` 等）でUIに通知。
- 永続化は `localStorage`（写真・音声＝`PhotoStore`、編集差分＝`EditStore`）。

### データ構造（新フローの中核）
```ts
// src/spots/SpotDefinition.ts
interface Region { min: Vec3; max: Vec3; }                        // 包含
interface ObjectGuide { canDo: string; feature: string; about: string; } // すべて英語・小5
interface SceneObject {
  id: string; name: string; nameJa?: string;
  region: Region;          // タップ判定＆近接判定の直方体
  focus: Vec3;             // 選択時にカメラが注視する点
  guide: ObjectGuide;
  image?: string; audio?: string;  // 写真/音声(dataURL)…Store から復元
}
interface SpotDefinition {
  id: string; name: string; nameJa: string; emoji: string;
  available: boolean;                  // 基本 true（false にすれば Coming soon カード）
  center: Vec3; viewDistance: number;  // オービットの中心と距離
  spawn?: { pos: Vec3; yaw: number };  // 歩行の初期位置・向き
  build?: (world: World) => void;      // ボクセル景観の構築
  objects?: SceneObject[];             // 選択できる構造物
  field?: Region;                      // ★歩ける範囲＝建築範囲（x/z で見えない壁。未設定だと歩行制限なし＆編集不可）
}
```

### 命名規則
- クラス/型/クラスファイル：**PascalCase**。観光地データファイル：**camelCase/小文字**（`katsurahama.ts` / `kochiCastle.ts`）。
- 変数/関数：camelCase。ブロックのkey：小文字（`'sand'`）。共通型は `src/types/index.ts`。

### 座標・高さの約束
- ワールドは **96×96×40**（x,z: 0..95／y: 0..39）。観光地はこの中に作る。`field` の `min/max` も 0..95 に収める。
- 各 spot は床の高さ定数（例 `G=10`）を決め、その上に作る。`spawn.pos.y` は床+1（立つ足元）。
- フィールドを大きく取りたい題材（動物園・植物園など）は `field` を広げ（例 x6..90, z6..90）、**地面もその範囲を埋める**（奈落防止）。

---

## 7. コーディング/運用ルール（必読）
- TypeScript **strict**、`any` を避ける。**コメントは日本語**。**1機能1ファイル**。
- **オフライン厳守**：外部API・CDN・フォント・外部画像・TTS外部サービスを足さない。
- **マウス不使用**：`requestPointerLock` を足さない。操作はキーボード＋タッチ。
- **UI/解説は英語・小5レベル**で統一（`canDo`/`feature`/`about` は短く1〜2文）。**語彙は外国語科の約600〜700語の範囲**を目安（詳細は CLAUDE.md §1）。
- **著作権配慮**：商用ゲーム名/見た目/テクスチャに依存しない。ブロックは**色のみ**。実物写真は**先生がアップロード**。動物・建物・キャラは**オリジナルのブロック造形**（既存IPの再現はしない）。
- 依存ライブラリは **three / vite / typescript のみ**。勝手に追加しない。
- **温存コードの削除/大改修は提案してから**。
- 変更ごとに **`npm run build`（`tsc --noEmit && vite build`）** が通る・**コンソールエラー無し**を確認。可能ならプレビューで動作確認。

---

## 8. ビルド/実行
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit && vite build → dist/（相対パス・オフライン動作）
npm run preview
```
- プロジェクト実体パス：`C:\Users\user\Desktop\マインクラフト風アプリ`
- プレビュー設定 `.claude/launch.json`（name: `kochicraft-dev`）。
- `.env` は**使わない**（オフライン方針）。

---

## 9. 使用ライブラリ
| ライブラリ | 用途 |
|---|---|
| `three` ^0.169 / `@types/three` | ボクセル3D描画・カメラ・型 |
| `typescript` ^5.6 | 型安全（`tsc --noEmit`） |
| `vite` ^5.4 | 開発/本番ビルド（相対パス・オフライン） |
| （ブラウザ標準）Web Speech API | 英語の自動読み上げ |
| （ブラウザ標準）localStorage / FileReader / Blob | 写真・音声・編集の保存と読込 |

---

## 10. バグ・既知の課題
- **温存コードが大量**：旧サンドボックス資産が未使用のまま残存。混乱しないこと（§3）。
- **自動音声の品質は端末依存**：ヘッドレスには声が無い。実機（iPad Safari/Chrome/Edge）で確認。確実さは**先生の録音**で担保。
- **`龍馬.jpg`**（ルートのユーザー写真）は未配線（写真はアップロード方式）。
- **像/灯台が高い**ため一人称で近いと顔まで見えにくい（↑/ドラッグ上で見上げる）。仕様。
- **情報パネルが対象に重なる**ことがある（軽微）。
- **プレビューのスクショはタブ非表示時に rAF が止まり取得できないことがある**（環境要因。コードは正常）。データ検証で代替可。
- 大きいフィールド（動物園/植物園）は**ブロック数が多め**（〜数万）。一度のロードで構築するので動作は問題ないが、極端に増やすときは注意。

---

## 11. AIへの指示（新しいClaude Codeが守ること）
- **現フロー（観光地選択型3D教材）を主軸に**。⏸️温存コードを“現仕様”と誤解しない。
- **既存設計を崩さない**。桂浜（`katsurahama.ts`）＝ひな型のUI・操作・英語レベル・音声方式を踏襲。新しい観光地もこの形で。
- **勝手にライブラリを追加/変更しない**。**リファクタリング・温存コード削除は提案してから**。
- **型安全を維持**（strict、anyを避ける）。**コメントは日本語**。
- **UI・解説はすべて英語・小5**。**マウス不使用**。**オフライン厳守**。**色ボクセルのみ・既存IP不使用**。
- 変更ごとに **`npm run build`**。プレビューで動作確認。

---

## 12. セッションサマリー（経緯）
**旧サンドボックス期**：Phase 1〜9（基本3D→建築→編集UI→観光→外国語→教師＋クイズ→保存→最適化→UI改善）。

**大改修（最重要）**：「広い自由ワールドのゲーム」を却下し、**観光地選択型3D教材**へ全面転換。起動→ハブ→観光地を選ぶ→専用コンパクト3D。タップ選択→右情報パネル。当初オービット、のちに**歩行（Walk）を既定**に追加。解説を**小5英語**に、**近接で英語名バナー**、写真/音声は**先生アップロード**＋自然音声の自動選択。

**直近の大きな作業（このセッション）**：
- 観光地を**桂浜のみ→全12スポット**まで実装（高知城／はりまや橋／にこ淵[縦構造の石段]／四万十川[沈下橋]／室戸岬／足摺岬[ガラス展望台]／ひろめ市場[屋内市場・横長の机＋椅子]／坂本龍馬像[独立・大階段]／牧野植物園[最大フィールド・植物満載]／のいち動物園[ブロックの動物]／龍河洞[鍾乳洞]）。
- 歩行UX：**自動ステップ**、**ジャンプを右下に独立**、**フィールド境界（落下防止）**、**🏠Startボタン**。
- **ブロック編集（付け足し方式）**：ホットバー＋数字キー、ゴーストプレビュー、押しっぱなしで連続＝向きに沿って積む、Place/Remove。`craftPlot` は廃止し **`field` 内に付け足し・自分の分だけ削除**へ。
- **保存**：`EditStore`（localStorageオートセーブ＋.kcwファイル書出/読込）。
- 設計方針を**「広い平場＋ふちに高品質オブジェクト」**に統一。

**2026-07-08 のセッション（実物準拠ブラッシュアップ＋英語調整＋付け足し編集）**：
- **全12スポットを実物調査（Web）に基づき改修**：高知城（本丸御殿・一豊騎馬像・石樋・板垣像を実位置へ・撮影スポット構図）／はりまや橋（からくり時計・純信お馬像・路面電車）／にこ淵（細い滝・手すり石段・浅瀬の青・水神伝説）／四万十川（屋形船・狭い沈下橋・赤カヌー）／室戸岬（灯台を丘上へ・アコウ・岩屋）／足摺岬（椿トンネル・張り出し展望台・白山洞門・最南端碑）／ひろめ市場（入口の柱バグ修正・炎強化・12店）／龍馬像（**デッキ進入不可バグ修正**・1928年史実）／牧野（スエコザサ）／のいち（**実在しない動物を実在種に総入替**・混合展示）／龍河洞（記念の滝）／桂浜（竜王宮に渡って参拝可能に・月の名所）。
- **英語の語彙調整**：feature/about を外国語科600〜700語の範囲に全面書き直し（canDo は You can 〜 のまま）。
- **ガイド付け足し編集**：`GuideStore`＋`InfoPanel` の「＋/Save/Clear」。基本文は不変・足した分だけ保存。

**却下された案**：広いオープンワールド／マウス操作・ポインタロック／外部写真・外部TTS／日本語UI。

---

## 13. 新しい観光地の追加レシピ（最短手順）
1. 実物を調べる（形・色・配置・特徴・英語名）。**色だけのボクセル**で表現（既存IPの再現はしない）。
2. `src/spots/<id>.ts` を作成：
   - 床の高さ定数（例 `G=10`）を決め、`build(world)` で `new Build()` を使い景観を組み立て、最後に `world.setBlocksBatch(b.cells)`。
   - **広い平場（平らな建築スペース）＋ふちに高品質オブジェクト**で。地面は `field` の範囲を埋める（奈落防止）。
   - `objects: SceneObject[]`（各 `region`＝直方体・`focus`・`guide{canDo,feature,about}` は**英語・小5**）。
   - `center`/`viewDistance`/`spawn`/**`field`** を設定。`available: true`。
3. `src/spots/SpotRegistry.ts` に `import` して `SPOTS` 配列に追加（placeholder は無い）。
4. `npm run build` で型・ビルド確認 → `npm run dev`（または `.claude/launch.json` の `kochicraft-dev`）で確認（歩いて近づく→英語名バナー→タップ→Listen、Build で付け足し、Start で戻る）。
5. **`katsurahama.ts` をお手本**に（構造の粒度・英語の長さ・objects の作り方）。`field` の付け方は既存スポットを参照。
