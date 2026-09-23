# CLAUDE.md — KochiCraft 作業ルール（新セッション必読）

このファイルは、新しい Claude Code セッションが**最初に読むべき作業ルール**です。
全体像は `HANDOVER.md`、やることは `TODO.md` を参照。

---

## 0. これは何のアプリか（誤解防止）
- **観光地選択型の3D英語教材**。高知の観光地を選び、そのコンパクトな3D空間を歩いて/眺めて、構造物をタップして**英語で学ぶ**。
- **広い自由ワールドのサンドボックスゲームではない**（その案は却下済み）。
- **UI も解説もすべて英語・小学5年生レベル。マウス不使用（キーボード＋タッチ）。完全オフライン。**

## 1. 守るべき最重要方針（変更不可）
- 外部AI API・外部サービス・ネット通信を**使わない**（オフライン／ブラウザ標準のみ）。
- **マウスを使わない**。`requestPointerLock` を新フローで足さない。操作はキーボード＋タッチ。
- **著作権配慮**：商用ゲームの名前/見た目/テクスチャに依存しない。ブロックは**色のみ（テクスチャ不使用）**。実物写真は**先生がアップロード**（勝手に外部画像を埋め込まない）。
- **UI・解説は英語・小5レベル**（例：`This is Katsurahama Beach.` / `It is big.` / `You can walk on the sand.`）。短い1〜2文。
  - **語彙は小学校外国語科の約600〜700語の範囲を目安**にする（is/has/can/like/love/see/go/eat/make、色・数・季節・天気・動物・食べ物、Let's 〜/Don't 〜 など）。canDo は `You can 〜` で始める。むずかしい語（million/monument/straw/pray 等）は使わない。
- 依存ライブラリは **three / vite / typescript のみ**。**勝手に追加・変更しない**。

## 2. 作業の進め方（AIへの指示）
- **現フロー（spots/＋core/の新Engine）を主軸に**作業する。⏸️温存コードを現仕様と誤解しない。
- **既存設計を崩さない**。桂浜（`src/spots/katsurahama.ts`）を**ひな型**として、同じUI・操作・英語レベル・音声方式で観光地を増やす。
- **リファクタリング／温存コード削除は必ず提案してから**実施（勝手に消さない）。
- **型安全を維持**（strict、`any` を避ける）。**コメントは日本語**。
- 変更ごとに **`npm run build`（`tsc --noEmit && vite build`）** が通ること、**コンソールエラー無し**を確認。可能ならプレビューで動作確認。
- 長い作業・大きな仕様判断は、**ユーザーに確認しながら**進める（このプロジェクトの慣習）。

## 3. 現役 / 温存（parked）マップ
**✅現役（新フローで実際に動く）**
- `core/`: Engine, SceneManager, OrbitCameraController, WalkController, WorldManager, **BuildController**（編集モード）
- `world/`: World, Chunk, ChunkMesher, VoxelData, BlockRegistry, blocks/blockTypes
- `player/`: Player, Physics（**自動ステップ対応**）
- `spots/`: SpotDefinition（`field`＝歩行範囲かつ建築範囲）, Build, SpotRegistry, **全12観光地ファイル**（katsurahama / kochiCastle / harimayaBridge / nikobuchi / shimanto / muroto / ashizuri / hirome / ryomaStatue / makino / noichi / ryugado）
- `features/language/SpeechService`
- `data/PhotoStore`, **EditStore**（編集差分の保存＝オートセーブ＋.kcw書出/読込）, **GuideStore**（ガイド英文の「付け足し」保存）
- `editor/Raycaster`（`VoxelRaycaster`）＝**BuildControllerが再利用**（中央カーソルの設置/削除）
- `ui/HubScreen`, `ui/panels/InfoPanel`, **ui/BuildPalette**, `ui/styles/main.css`
- `types/index`, `config/constants`（`STEP_HEIGHT`追加）, `main.ts`

**⏸️温存（コンパイルは通るが現Engineから未使用＝旧サンドボックスの名残）**
- `core/Clock`, `core/InputManager`, `player/PlayerController`, `world/TerrainGenerator`, `state/EventBus`
- `editor/*`（建築/編集ツール一式）
- `features/quiz/*`, `features/teacher/*`, `features/language/LanguageManager`, `features/tourism/*`
- `data/SaveManager`, `data/Serializer`, `data/Storage`
- `ui/HUD`, `ui/TitleScreen`, `ui/modals/*`, `ui/panels/{BlockPalette,RightPanel,TourismPopup,LearningPanel,QuizPlay,TeacherPanel,SavePanel}`
→ 将来「建築機能」「保存」「クイズ」を新フローに作る際の**再利用候補**。使うときは新フローに合わせて作り替える。

## 4. 観光地を1つ追加する手順（最頻タスク）
1. **実物を調べる**（web/画像検索）：形・色・配置・特徴・英語名。
2. `src/spots/<id>.ts` を作成：
   ```ts
   import { Build } from './Build';
   import type { SpotDefinition } from './SpotDefinition';
   function build(world){ const b = new Build(); /* b.box/slab/pillar/sphere/disc/pine/mound… */ world.setBlocksBatch(b.cells); }
   export const xxx: SpotDefinition = {
     id, name /*英語*/, nameJa, emoji, available:true,
     center:{x,y,z}, viewDistance, spawn:{ pos:{x,y,z}, yaw:0 },
     build,
     objects:[ { id, name/*英語*/, nameJa, region:{min,max}, focus:{x,y,z},
       guide:{ canDo:'…', feature:'…', about:'…' } /* すべて英語・小5・短文 */ } ],
   };
   ```
   - **`field`（歩ける範囲＝建築範囲）を必ず設定**。広い平場＋ふちに高品質オブジェクトで作る。
3. `src/spots/SpotRegistry.ts` に `import` して `SPOTS` 配列へ追加（placeholder は無い。全12実装済み）。
4. `npm run build` → `npm run dev` で確認（歩いて近づく→英語名バナー→タップ→Listen、Build で付け足し）。
5. **`katsurahama.ts` をお手本**に、構造の粒度・英語の長さ・objectsの作り方を合わせる。

## 5. データ構造（中核）
```ts
interface Region { min: Vec3; max: Vec3; }                       // 包含
interface ObjectGuide { canDo: string; feature: string; about: string; } // 英語・小5
interface SceneObject { id; name; nameJa?; region; focus: Vec3; guide; image?; audio?; }
interface SpotDefinition { id; name; nameJa; emoji; available; center: Vec3; viewDistance;
  spawn?: { pos: Vec3; yaw: number }; build?(world): void; objects?: SceneObject[]; }
```
- 写真/音声は `PhotoStore`（localStorage, dataURL）に保存。`WorldManager.loadSpot` が復元して `obj.image/obj.audio` に反映。
- **同梱写真**：`public/photos/<spotId>/<名前>.jpg` に置き、spot の objects に `image: './photos/<spotId>/xxx.jpg'` を書く。
  先生のアップロードがあればそちらが優先される（`loadSpot` は保存済みがある時だけ上書きするため）。
  取り込みは `写真を取り込む.ps1`（横1200px・JPEG品質82に縮小。元画像は変更しない）。
  **オフライン厳守**なので画像は必ずリポジトリ内（`public/`）に置き、外部URLを参照しない。
- `InfoPanel` の Listen：`obj.audio` があればそれを再生、無ければ `SpeechService.speak(about,'en')`（付け足し文も読む）。
- **ガイド英文の付け足し**：`GuideStore`（localStorage）。基本文はコードのまま、**足した文だけ**保存。
  `InfoPanel` の各欄（You can / Special / About）の「＋」→入力→Save。Clear で付け足しだけ消える（基本文は消えない）。

## 6. 操作・入力の約束（マウス不使用）
- **キーは英単語の頭文字に合わせる**（子どもが覚えやすいように）。新しい操作を足すときもこの規則を守る：
  **J**ump / **L**ook / **W**alk / **B**uild / **D**one / **P**ut / **T**ake / **H**ome / **E**nglish(listen) / **I**nfo（選ぶ）/ **N**ext /
  **U**p・**D**own / **N**ear・**F**ar / **K**eys（一覧の開閉）/ **V**iew（視点）/ **C**hange Character（キャラクター）/ **M**ap（行ける場所）。
  ※選択は **Enter**（+ I）。**C はキャラクター変更**に使うので選択には使わない。
  **ボタンの表示名とキーを必ず一致させる**（例：ボタンが「Done」なら D）。編集中は D＝Done のため、見下ろすは Shift＋↓（`walk.useDForLookDown = false`）。
- 歩行：`WalkController`（**矢印キー**/方向ボタン＝移動、**Shift＋矢印**＝視点[左右＝振り向く]、**U/D**＝見上げ/見下ろし、ドラッグ＝視点、**J**/Space＝ジャンプ）。**WASD は廃止**（W を Walk に使うため）。
  - 画面左下に**キー案内（`.key-guide`）**（`Engine.renderKeyGuide` / `keyGuideHtml(mode)`。walk/orbit/build の3モード別に全操作を列挙）。
    **K キーかボタンで開閉**でき、閉じると小さなボタンだけ＝画面を隠さない。状態は `localStorage: kc.keys.open` に記憶（初期値＝開）。
    せまい画面（〜900px・〜620px）では文字を小さくするだけで、**一覧を `display:none` で消さない**
    （消すと「K を押しても何も出ない」不具合になる。実際に一度やってしまった）。高さが足りないときは
    `max-height` + スクロールで収める。
  - **マウス不使用で完結**：ハブは矢印キー＋Enter（`HubScreen.onKeyDown`・自動フォーカス）。
  - **編集モードに入るとき `walk.lookDownForBuild()` で少し下を向かせる**。正面のままだと中央カーソルが
    どのブロックにも届かず「置くキーが効かない」ように見えるため（実際にあった不具合）。
  - 置く/消すが失敗したときは `showToast` で理由を英語（小5）で伝える。
- **キャラクター（`player/Avatar.ts`）**：Boy／Girl／Pet／Robot の4種類を `THREE.BoxGeometry` だけで組み立てる
  **オリジナル造形**（既存ゲームのキャラクターは再現しない＝著作権配慮）。歩くと手足が振れる（`update` の phase）。
  種類は **C**（Change Character）キー／ボタンで切替、`localStorage: kc.skin` に保存。
- **行ける場所の一覧（`ui/PlacesPanel.ts`）**：その観光地の `objects` を並べ、選ぶと `Engine.goToObject` が
  **その構造物の手前の「立てる場所」を8方向から探して着地→構造物の方を向く→情報パネルを開く**。
  `findStand` は地面・足元・頭上の3マスと `field` 内かを確かめる。**M** キー／🗺️ Map ボタンで開閉。
  一覧は `名所リスト.md`（写真準備用）と `画像プロンプト.md`（ChatGPT用の画像プロンプト81枚）にも書き出してある。
  **objects を増減したら、この2ファイルも更新する。**
- **視点（`WalkController.view`）**：`first`(Eyes) / `back`(Back) / `third`(Far) / `front`(Face) の4つを **V** で循環。
  `localStorage: kc.view` に保存。`sync()` が目の位置から前後へ離し、`clampCameraDist` で壁にめり込む前に止める。
  **編集モードは `viewOverride='first'` で一人称固定**（中央カーソルの精度を保つため）。アバターは一人称・編集中は非表示。
  - **ボタンには押すキーを `<kbd>` で併記**する（新しいボタンを足すときも必ず書く）。フォーカス枠（`:focus-visible`）も消さない。
  - **文字入力中（textarea/input）はキー操作を無視**する（`WalkController`/`OrbitCameraController`/`Engine` の onKeyDown で判定）。
  - **ジャンプボタンは右下に独立**（左手＝移動・右手＝ジャンプの2本指）。
  - **自動ステップ**：1ブロックの段差は歩くだけで登る（`Physics.moveAndCollide` の `stepHeight`／`STEP_HEIGHT`）。
  - **フィールド境界**：観光地の `field`（作り込んだ地面の外周）で見えない壁を作り、外（周りの空中＝奈落）へ落ちないようにする（`WalkController.setBounds`）。新しい観光地には必ず `field` を設定すること。
  - **🏠 Start ボタン**（ツールバー・歩行モードのみ）：押すと位置も向きもスポーンへ戻す（`Engine.returnToStart`→`spawnPlayer`）。
- 俯瞰（Look）：`OrbitCameraController`（ドラッグ回転・ピンチ/キーでズーム）。
- 編集（Build）：`BuildController`。歩行と同じ移動＋**中央カーソル方式**でブロックの設置/削除。
  - **置く＝🧱Putボタン／タップ／`P`（Put）**、**消す＝✋Takeボタン（押しっぱなしで連続）／`T`（Take）**。
  - **連続設置は“最初に狙った向き”へ伸ばす**：床（上の面）を狙って押しっぱなし＝**まっすぐ上にタワー**、横の面を狙えば横に並ぶ。視線が横面に当たってもブレない（`BuildController.startStack/placeContinue/endPlace`）。
  - **設置プレビュー**：中央カーソルの先に**半透明の色つきブロック（ゴースト＝選んだ色）＋水色の枠**を表示し「どこに何が出るか」を見せる。**消す対象は赤枠**（`BuildController` の ghostFill/targetBox/removeBox）。
  - ブロック選択は**ホットバー**（`BuildPalette`：下中央・**折り返しで全種スクロール無し**・各スロットに番号＋色＋**英語名**）。**数字キー1〜9・0**でも切替（Minecraft風システム）。上に**置き方の英語説明**（小5）を表示。
  - **建築ルール（付け足し方式）**：置けるのは観光地の `field`（歩ける範囲＝建築範囲）内。**地面・建物・木など既存の何にでも付け足せる**（中央カーソルが面に当たった所＝`VoxelRaycaster`）。**消せるのは自分で置いたブロックだけ**（差分 `edits` にある物のみ）＝城・像・地面など**元の物は壊れない**。`Esc`/Done で歩行へ戻る。モード切替で位置はリセットしない。
- 選択：タップ（カメラからレイ→`WorldManager.selectByRay`）または Tab 順送り。中央照準＋E でも可（歩行・俯瞰時）。
- 近接：`WorldManager.updateNear(camera.position)` が「ふちから4ブロック以内・面積最小」の対象を選び英語名バナーを出す。
- 保存：編集は `EditStore` が **localStorageへ自動保存**＋ **.kcw書出/読込**。`WorldManager.loadSpot` が build() 後に差分を再適用。

## 7. パフォーマンス/品質
- 大量ブロックは `World.setBlocksBatch()`（再メッシュ1回）。観光地切替は `World.clearAll()`。
- 描画はグリーディメッシュ（`ChunkMesher`）。dispose を忘れない。
- ブロックは `world/blocks/blockTypes.ts` の21種から選ぶ（色で表現）。

## 8. ビルド/実行
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit && vite build
```
- プロジェクト実体パス：`C:\Users\user\Desktop\マインクラフト風アプリ`
- プレビュー設定 `.claude/launch.json`（name: `kochicraft-dev`、`--prefix` でこのフォルダを指す）。

## 9. やってはいけないこと
- マウス前提の操作や `requestPointerLock` を新フローに足す。
- 外部API・CDN・外部画像/フォント・TTS外部サービスを足す。
- 依存ライブラリの無断追加・更新、フレームワーク導入。
- 温存コードを断りなく削除/大改修。
- 日本語UIへ戻す／英語を難しくする（小5を超える語彙・長文）。
- テクスチャ/商用素材の使用。
