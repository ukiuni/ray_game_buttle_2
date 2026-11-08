# RAY BATTLE 2

炎・雷・氷 ― 3人の拳士がぶつかる、CPU対戦の3D格闘ゲームです（WebGL / Three.js）。
Android・iPhone・iPad のブラウザで遊べるPWAです。

## 遊び方
- 左スティック：移動 / ↑ジャンプ / ↓しゃがみ / 相手と反対方向でガード（↙でしゃがみガード）
- 右の4ボタン：弱P・強P・弱K・強K
- ↓↘→+P 飛び道具、→↓↘+P 対空技、↓↙←+K 突進技、強P+強K（ゲージMAX）超必殺技
  （強Pと強Kの境目を押すと同時押しになります）
- 2ラウンド先取。勝つと5秒後に自動で次のステージへ進み、負けるまで続きます。3ステージを越えると周回し、CPUが強くなります。
- PC ではキーボードでも操作できます：矢印キー/WASD、U/I/J/K（またはZ/X/C/V）

## キャラクター
| キャラ | ステージ | 特徴 |
|---|---|---|
| KAEN（紅蓮の拳士） | 火炎寺 | 攻撃力が高いバランス型 |
| RAIGA（迅雷の忍） | 雷鳴街 | 速い。ジャンプで宙返りする |
| HYOKA（氷華の舞姫） | 氷華神社 | リーチが長い |

モデルはプロシージャルに組み立てたリグ付きモデルで、各キャラ約2万ポリゴンです（`tests/unit/models.test.js` で確認しています）。
背景・服のテクスチャ・顔テクスチャ・ドット絵のポートレート・アプリアイコンは Codex の画像生成で作りました（元画像：`art_src/`）。

## 開発
```bash
npm install
npm run dev        # 開発サーバー
npm test           # ユニットテスト（Vitest）
npm run build      # dist/ にビルド（Service Worker にプリキャッシュ一覧を書き込みます）
npm run test:e2e   # E2E（Playwright: iPhone / iPad / Android をエミュレート）
npm run assets     # art_src/ の画像を public/ 用に変換（Python + Pillow）
```

## 公開
`main` に push すると GitHub Actions（`.github/workflows/deploy.yml`）がビルドして GitHub Pages に公開します。テストはローカルで `npm test` / `npm run test:e2e` を実行してください。
初回だけ、リポジトリの Settings → Pages → Source を **GitHub Actions** にしてください。

## アップデート
Service Worker が、起動時・5分ごと・アプリに戻ったとき・オンライン復帰時に更新を確認します。
新しいバージョンは**タイトル / キャラ選択 / ゲームオーバー画面でだけ**適用されます。試合中や連勝中には適用しません。
