"""都会度スコアの分布分析スクリプト

現在のスコアデータ（urbanity-score-v2.json）を読み込み、
ヒストグラムと基本統計量をコンソールに表示します。

使用方法:
    cd scripts
    uv run analyze_score_distribution.py
"""

import json
import sys
from pathlib import Path
import numpy as np

def main():
    script_dir = Path(__file__).parent
    data_path = script_dir.parent / "frontend" / "public" / "data" / "urbanity-score-v2.json"

    if not data_path.exists():
        print(f"Error: {data_path} not found.")
        sys.exit(1)

    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 都会度スコアを抽出
    scores = [v['urbanity'] for v in data.values() if v.get('urbanity') is not None]
    
    if not scores:
        print("No scores found.")
        sys.exit(1)

    scores = np.array(scores)

    print(f"\n=== 都会度スコア分布分析 ===")
    print(f"総数: {len(scores)}")
    print(f"平均: {np.mean(scores):.2f}")
    print(f"中央値: {np.median(scores):.2f}")
    print(f"最小: {np.min(scores):.2f}")
    print(f"最大: {np.max(scores):.2f}")
    print(f"標準偏差: {np.std(scores):.2f}")
    
    print("\n--- パーセンタイル ---")
    for p in [10, 25, 50, 75, 90, 95, 99]:
        print(f"{p}%: {np.percentile(scores, p):.2f}")

    print("\n--- ヒストグラム ---")
    # 0から100まで5刻みのビンを作成
    bins = range(0, 101, 5)
    hist, bin_edges = np.histogram(scores, bins=bins)
    
    max_count = np.max(hist)
    scale = 50 / max_count if max_count > 0 else 1

    print(f"{ 'Range':<10} | {'Count':<5} | Distribution")
    print("-" * 40)
    
    for i in range(len(hist)):
        lower = bin_edges[i]
        upper = bin_edges[i+1]
        count = hist[i]
        bar_len = int(count * scale)
        bar = "#" * bar_len
        print(f"{lower:3d} - {upper:3d}  | {count:5d} | {bar}")

if __name__ == "__main__":
    main()
