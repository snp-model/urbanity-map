"""2025年国勢調査から市区町村別人口と対数人口スコアを生成する。"""

import json
from pathlib import Path

import numpy as np
import numpy.typing as npt
import pandas as pd

from census_2025 import (
    column_for_header,
    column_for_metadata,
    load_boundary_codes,
    load_census_table,
    selected_current_rows,
)
from urbanity_calibration import load_urbanity_calibration


def main() -> None:
    # パス設定
    script_dir: Path = Path(__file__).parent
    data_dir: Path = script_dir.parent / "data"
    output_dir: Path = script_dir.parent / "frontend" / "public" / "data"

    # e-Stat 令和7年国勢調査・人口等基本集計 表1-1
    census_path: Path = data_dir / "census_2025" / "census2025_table_1-1.xlsx"

    # 出力ファイル
    output_path: Path = output_dir / "population-score.json"
    raw_data_path: Path = output_dir / "population-data.json"

    # 出力ディレクトリが存在しない場合は作成
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"2025年国勢調査データを読み込み中: {census_path}")
    table, header_row = load_census_table(census_path, "b01_01")
    boundary_codes = load_boundary_codes(data_dir)

    region_col = column_for_header(table, header_row, "地域識別コード")
    municipality_col = column_for_header(table, header_row, "2025年_地域コード")
    population_col = column_for_metadata(
        table,
        header_row,
        "0_総数",
        context=((5, "人口"), (4, "男女")),
    )
    rows = selected_current_rows(
        table, header_row, region_col, municipality_col, boundary_codes
    )
    rows["_population"] = pd.to_numeric(rows[population_col], errors="coerce")
    rows = rows.dropna(subset=["_population"])
    rows = rows[rows["_population"] >= 0].copy()
    if rows.empty:
        raise ValueError("No 2025 municipality population rows matched the boundary")

    print(f"対象市区町村・区域: {len(rows):,} 件 (境界 {len(boundary_codes):,} 件)")
    
    # スコア算出（対数スケール）
    print("人口スコアを算出中...")
    pop_values: npt.NDArray[np.float64] = rows["_population"].values.astype(np.float64)
    pop_values = np.maximum(pop_values, 1)
    log_pop: npt.NDArray[np.float64] = np.log10(pop_values)
    
    population_calibration = load_urbanity_calibration()["layer_normalization"][
        "population"
    ]
    min_val = float(population_calibration["min"])
    max_val = float(population_calibration["max"])
    
    normalized: npt.NDArray[np.float64]
    if max_val > min_val:
        normalized = np.clip(
            (log_pop - min_val) / (max_val - min_val) * 100, 0, 100
        ).round(1)
    else:
        normalized = np.zeros_like(log_pop)
    
    rows["_score"] = normalized
    
    # スコアデータを保存
    result: dict[str, float] = {}
    for _, row in rows.iterrows():
        code: str = row["_municipality_code"]
        result[code] = float(row["_score"])
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    # 実数値データの保存
    raw_result: dict[str, dict[str, float]] = {}
    for _, row in rows.iterrows():
        code: str = row["_municipality_code"]
        raw_result[code] = {
            "count": int(row["_population"]),
            "score": float(row["_score"]),
        }
    
    with open(raw_data_path, 'w', encoding='utf-8') as f:
        json.dump(raw_result, f, ensure_ascii=False, indent=2)
    
    print(f"処理完了:")
    print(f"  スコアデータ: {output_path}")
    print(f"  実数値データ: {raw_data_path}")
    print(f"  対象市区町村数: {len(result)}")
    print(f"  スコア範囲: {normalized.min():.1f} - {normalized.max():.1f}")


if __name__ == "__main__":
    main()
