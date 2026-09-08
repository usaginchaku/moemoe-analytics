# moemoe-analytics

「好き」を1本のランキングにせず、キャラクターごとに4軸で評価する静的Webアプリです。

## 4軸

- キャラとして好き
- メロつきたい
- 付き合いたい
- 性的に刺さる（成人キャラ／成人版想定のみ）

各軸は 0〜10。0も正式な回答として扱い、未回答は数値とは別に管理します。SVGレーダーチャートで可視化します。

分析タブでは、4軸ランキング、スコア分布、2軸散布図、4軸パターンマップ、タグ・声優・身長・作品別傾向、軸差を確認できます。

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
        "character": 8,
        "mero": 6,
        "dating": 4,
        "sexual": 7
      },
      "answered": {
        "character": true,
        "mero": true,
        "dating": true,
        "sexual": true
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

- 評価履歴
