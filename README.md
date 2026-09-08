# moemoe-analytics

「好き」を1本のランキングにせず、キャラクターごとに4軸で評価する静的Webアプリです。

## 4軸

- キャラとして好き
- メロつきたい
- 付き合いたい
- 性的に刺さる（成人キャラ／成人版想定のみ）

各軸は 0〜100。SVGレーダーチャートで可視化します。

## データ

初期キャラクターは `characters.json` に分離しています。
ブラウザ上の編集結果は `localStorage` に保存されるため、GitHub上のJSON自体は自動変更されません。

- JSON読み込み: 他のデータセットに差し替え
- JSON書き出し: 現在の評価をバックアップ
- 初期JSONに戻す: `characters.json` の内容へリセット

### 形式

```json
{
  "version": 1,
  "characters": [
    {
      "id": "sample",
      "name": "キャラ名",
      "work": "作品名",
      "tags": ["ギャップ", "賢い"],
      "imageUrl": "",
      "notes": "",
      "scores": {
        "character": 80,
        "mero": 60,
        "dating": 40,
        "sexual": 70
      }
    }
  ]
}
```

## ローカル起動

`fetch()` で `characters.json` を読むため、`index.html` の直開きより簡易HTTPサーバー推奨です。

```bash
python3 -m http.server 8000
```

その後 `http://localhost:8000` を開いてください。

## 今後の候補

- 全キャラ比較ビュー
- 作品別平均・ランキング
- 4軸散布図／クラスタリング
- タグ別集計（ギャップ萌え、女好き、賢い、強い等）
- 評価履歴
- GitHub Pages公開
