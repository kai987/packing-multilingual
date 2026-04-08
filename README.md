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
npm run dev
```

開発サーバーのデフォルト URL:

```text
http://localhost:5173
```

## コマンド

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

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
