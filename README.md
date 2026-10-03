# brick-packing React Native app

Expo + React Native + TypeScript で構成した、日本向け梱包プランナーのアプリ原型です。

この原型では、以下のような業務課題を想定しています。

- 会社に複数サイズの紙箱がある
- 出荷対象はサイズが異なる箱入りカード商品
- 商品は `Pokemon`、`ONE PIECE`、`Dragon Ball` などのシリーズを含む
- 注文内容から、適切な紙箱、商品の向き、緩衝材を自動で提案したい
- 単に「入るかどうか」だけでなく、安定性、空隙量、緩衝材厚みも考慮したい

## 現在の実装

- Expo SDK 55 + React Native 0.83 + React 19
- TypeScript 5.9
- iOS / Android / Web を同じ React Native UI で起動可能
- 商品マスタ、箱規格マスタ、緩衝材ルールのサンプルデータ
- 説明可能なフロントエンド側のヒューリスティック装箱アルゴリズム
- 日本語 / 中文 / English UI
- 商品数量、寸法、価格、個別包装の入力
- 推奨箱、分割発送案、箱内 3D 図、箱内レイヤー俯瞰図、マスタ一覧の表示
- `expo-gl` + `@react-three/fiber` + `three` による 3D プレビュー

## 起動方法

```bash
npm install
npm run start
```

Expo CLI が起動したら、ターミナルの QR コードを Expo Go または開発ビルドで読み取ります。

Web で確認する場合:

```bash
npm run web
```

## コマンド

- `npm run start`
- `npm run android`
- `npm run ios`
- `npm run web`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

公開用ビルドは `/packing-multilingual` 配下への配信を前提にしています。別のURLへ配置する場合は `app.json` の `expo.experiments.baseUrl` を変更してください。

GitHub Actions は型チェック、lint、回帰テスト、Web build がすべて成功した場合のみ公開します。

## コード構成

```text
src/
├── App.tsx                 # React Native UI
├── components/             # 商品編集、共通UI、推薦カード、レイヤー俯瞰図
├── hooks/usePackingPlans.ts # 入力のdebounce、計算状態、古い計算のキャンセル
├── PackingScene3D.tsx      # iOS / Android 向け 3D 表示
├── PackingScene3D.web.tsx  # Web 向け 3D 表示
├── data.ts                 # 商品 / 箱 / 緩衝材のサンプルマスタ
├── localization.ts         # 多言語テキストとローカライズ済みマスタ
├── locale.ts               # ロケールと数値表示
├── main.tsx                # Expo root component 登録
├── packing.test.ts         # 装箱アルゴリズムの回帰テスト
├── packing.worker.ts       # Web用の計算Worker
├── packingTask.web.ts      # Workerの起動、キャンセル、エラー処理
├── packingTaskFallback.ts  # ネイティブ等では描画後に計算を実行
├── sceneModel.ts           # Web / iOS / Android共通の3D幾何モデル
├── numericInput.ts         # 数値の桁数制限と寸法検証
├── styles.ts               # 既存UIの共通スタイル
└── packing.ts              # 装箱推薦と評価ロジック
```

## 計算上の前提

- 箱の `volumetricWeightGrams` は容積重量です。耐荷重判定には使用しません。
- 耐荷重判定は `maxLoadWeightGrams` の実測・確認済み値のみ使用します。現在の箱マスタでは未確認のため `null` とし、画面にも「未確認」と表示します。安全な積載重量を保証するものではありません。
- 個別包装は商品本体を縮小せず、緩衝材プロファイルの `itemWrapThickness` を各面の外寸に加算して装箱します。初期値はプチプチ5mm、紙緩衝材8mm、PEフォーム10mmです。紙の厚みを含めた初期値は原型の仮定なので、実運用では包材とSKUの実測値に置き換えてください。
- 段間には10mmの緩衝材を置き、その体積は空き容積に含めません。各段の接触面は平面で、下段の面積が上段より大きい配置を選びます。
- `recommendPackingPlans({ ..., maxLayers: 3 })` のように段数上限を指定できます。既定値は従来どおり2段です。
- 寸法は1〜999、数量は0〜999の整数、価格は最大6桁です。寸法入力中の空欄・不正値は計算に反映せず、フォーカスを外すと最後の有効値へ戻します。数量の空欄は0、価格の空欄は未設定として扱います。全角数字も半角へ正規化します。
- Webでは入力を150msまとめてからWorkerで計算し、古いWorkerは停止します。Workerから画面へ送る結果は各種上位3案に絞り、応答が30秒ない場合は停止して再試行を表示します。ネイティブとWorker非対応環境では描画後にJSスレッドで計算するため、真の別スレッド計算ではありません。
- 価格と表示言語だけの変更では装箱計算をやり直しません。言語だけの変更では3D幾何も再生成しません。

## 今後の拡張候補

- 実際の SKU マスタを取り込み、寸法と重量を実測値に置き換える
- 「縦置き不可」「単独包装必須」「高単価商品の二重保護」などの業務ルールを追加する
- CSV、Shopify、楽天、Amazon、または社内システムから注文を取り込む
- 現在のヒューリスティックを、より強い 3D bin packing / cartonization サービスに置き換える
- 現場で調整した梱包結果を蓄積し、推薦ルールの改善に活用する
