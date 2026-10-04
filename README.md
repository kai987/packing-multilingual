# brick-packing frontend

`Vite + React + TypeScript` で構成した、日本向け梱包プランナーのフロントエンド原型です。  
<https://kai987.github.io/packing-multilingual/>

この原型では、以下のような業務課題を想定しています。

- 会社に複数サイズの紙箱がある
- 出荷対象はサイズが異なる箱入りカード商品
- 商品は `Pokemon`、`ONE PIECE`、`Dragon Ball` などのシリーズを含む
- 注文内容から、適切な紙箱、商品の向き、緩衝材を自動で提案したい
- 単に「入るかどうか」だけでなく、安定性、空隙量、緩衝材厚みも考慮したい

## 現在の実装

- React 19 + TypeScript 5.9
- Vite 7
- 商品マスタ、箱規格マスタ、緩衝材ルールのサンプルデータ
- 説明可能なフロントエンド側のヒューリスティック装箱アルゴリズム
- 日本語 UI
  - 商品数量の入力
  - 箱規格と緩衝材の表示
  - 推奨箱の比較
  - 箱内の立体図と俯視図による可視化
  - 単箱案と分割発送案の比較

## 起動方法

```bash
npm install
rustup target add wasm32-unknown-unknown
npm run dev
```

Web開発・テスト・公開ビルドにはRust 1.93以降が必要です。`wasm-bindgen-cli` 0.2.129は初回にプロジェクト内の `.tools/` に自動インストールされます。グローバルのCLIは変更しません。初回は取得・コンパイルに時間がかかります。

開発サーバーのデフォルト URL:

```text
http://localhost:5173
```

## コマンド

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:rust`
- `npm run build:wasm`
- `npm run bench:packing`

## 3D依存関係の互換性

- React Three Fiber 9は `Clock` APIを使うため、Three.jsと型定義を `0.182.0` に固定しています。r183以降の非推奨警告を隠すのではなく、安定版の対応APIを揃えます。更新時はレンダラーの対応状況と `threeCompatibility.test.ts` を確認してください。
- Dreiは `Edges` / `OrbitControls` のみを直接参照し、Three.jsのコアとWebGLレンダラーを別チャンクにします。Viteの500kB警告閾値は変更しません。
- npm 12の依存スクリプト審査では、確認済みの `esbuild@0.28.2` のみを許可します。`fsevents` は配布済みバイナリを使い、不要な再ビルドを拒否します。未承認スクリプトを一括で許可せず、esbuild更新時は安全性を確認して承認バージョンも更新してください。

## Rust / WASMの計算コア

- React / Viteのページ、CSS、Three.jsの表示コンポーネントは維持しています。Expo / React NativeのUIや依存関係は取り込みません。
- `rust/packing-core/` が単箱配置、分割探索、包装外寸、支持面積、安定性スコアと緩衝材量を計算します。WebではESM Worker内でWASMを初期化し、各種上位3案を返します。TypeScript実装は回帰テストの比較対象・障害時のフォールバックとして残します。
- `npm run dev` / `npm test` / `npm run build` は先にWASMを生成します。ハッシュ付きESM / WASMとマニフェストは `public/wasm/` に置き、Viteが `dist/wasm/` にコピーします。生成物やビルドツールはGit管理外です。
- WorkerとマニフェストのURLはViteのbaseに対応します。ローカルでは `/`、GitHub Actionsの公開ビルドでは `/packing-multilingual/` を使います。
- 初期化全体を5秒で制限し、404・ESM読み込み失敗・計算例外時にはWorker内のTypeScriptへフォールバックします。Workerが起動できない場合は描画後にJSスレッドで計算します。Worker全体の30秒タイムアウト、150msの入力debounce、古いWorkerの停止、再試行表示も実装しています。
- 数量・寸法・包装・戦略の変更で再計算し、価格だけの編集や表示言語の変更では再計算しません。
- GitHub Actionsは依存監査（`npm audit --audit-level=low`）、Rustのformat / clippy / test、型チェック、lint、TS / 実WASM差分テスト、Webビルドの成功後に公開します。デプロイ対象は従来どおり `main` です。
- `bench:packing` は初期化後の計算とJSON境界を測定します。ダウンロードやWorker起動を含むブラウザー全体の性能測定ではありません。

### 計算上の前提

- 容積重量は送料計算用の値であり、耐荷重判定には使用しません。最大積載重量は確認済みの値のみを使います。現在のマスタでは未確認のため `null` と表示します。
- 商品本体を縮小せず、個別包装の厚みを各面へ加えた外寸で配置します。初期値はプチプチ5mm、紙8mm、PEフォーム10mmであり、実運用では実測値へ置き換えてください。3D・俯視図の本体寸法と外側の包装寸法を区別します。
- 既定値は2段、段間には10mmの緩衝材を置きます。段の接触面を平面にし、下段の面積が上段より大きい配置を選びます。
- 既存の装箱ヒューリスティックを移植したもので、数学的な最適解や実際の梱包安全性を保証するものではありません。

## コード構成

```text
src/
├── App.tsx          # 業務 UI
├── App.css          # ページスタイル
├── data.ts          # 商品 / 箱 / 緩衝材のサンプルマスタ
├── packing.ts       # 装箱推薦と評価ロジック
├── PackingScene3D.tsx
├── index.css
└── main.tsx
```

## 今後の拡張候補

- 実際の SKU マスタを取り込み、寸法と重量を実測値に置き換える
- 「縦置き不可」「単独包装必須」「高単価商品の二重保護」などの業務ルールを追加する
- CSV、Shopify、楽天、Amazon、または社内システムから注文を取り込む
- 現在のヒューリスティックを、より強い 3D bin packing / cartonization サービスに置き換える
- 現場で調整した梱包結果を蓄積し、推薦ルールの改善に活用する
