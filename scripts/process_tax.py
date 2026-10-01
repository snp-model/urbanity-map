"""総務省「市町村税課税状況等の調」から市区町村別平均所得を作成する。"""

import json
from pathlib import Path

import pandas as pd


SURVEY_YEAR = 2025
HAMAMATSU_NEW_CODES = {"22138", "22139", "22140"}


def municipality_code(value: object) -> str | None:
    """総務省の6桁団体コードを地図用の5桁コードに変換する。"""
    if pd.isna(value):
        return None

    try:
        digits = str(int(float(str(value).replace(",", "").strip())))
    except (TypeError, ValueError):
        digits = str(value).strip()

    if not digits.isdigit():
        return None
    # Excel上で数値として保存された北海道のコードは先頭の0が落ちる。
    digits = digits.zfill(6)
    if len(digits) != 6:
        raise ValueError(f"想定外の団体コードです: {value!r}")
    return digits[:5]


def main() -> None:
    project_dir = Path(__file__).resolve().parent.parent
    data_dir = project_dir / "data"
    output_dir = project_dir / "frontend" / "public" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)

    input_xlsx = data_dir / "J51-25-b.xlsx"
    output_json = output_dir / "tax_income.json"
    if not input_xlsx.exists():
        raise FileNotFoundError(
            f"入力ファイルが見つかりません: {input_xlsx}\n"
            "総務省の令和7年度 第11表（J51-25-b.xlsx）をdata/に配置してください。"
        )

    print(f"Reading Tax Excel: {input_xlsx}")
    # 1行目は表題、2行目が列名。下の単位・項目名行は年度で除外する。
    df = pd.read_excel(input_xlsx, header=1)
    required_columns = {
        "年度",
        "団体コード",
        "表側",
        "所得割の納税義務者数",
        "総所得金額等",
    }
    missing_columns = required_columns - set(df.columns)
    if missing_columns:
        raise ValueError(f"第11表に必要な列がありません: {sorted(missing_columns)}")

    years = pd.to_numeric(df["年度"], errors="coerce")
    tax_type = df["表側"].astype("string").str.strip()
    municipal_rows = df.loc[
        (years == SURVEY_YEAR) & (tax_type == "市町村民税")
    ]
    if municipal_rows.empty:
        raise ValueError(f"第11表に令和{SURVEY_YEAR - 2018}年度の市町村民税データがありません")

    result: dict[str, int] = {}
    for _, row in municipal_rows.iterrows():
        code = municipality_code(row["団体コード"])
        taxpayers = pd.to_numeric(row["所得割の納税義務者数"], errors="coerce")
        total_income_thousand_yen = pd.to_numeric(row["総所得金額等"], errors="coerce")
        if code is None or pd.isna(taxpayers) or pd.isna(total_income_thousand_yen):
            continue
        if taxpayers <= 0:
            continue
        if code in result:
            raise ValueError(f"団体コードが重複しています: {code}")

        # 総所得金額等は千円単位。従来の平均所得の定義を維持する。
        result[code] = round(total_income_thousand_yen * 1000 / taxpayers)

    if not result:
        raise ValueError("有効な市町村別所得データを読み込めませんでした")

    # 政令指定都市の区別データがない場合は、市全体の値を区に補う。
    # 浜松市の新3区だけは統合処理側で補完し、市全体値であることを記録する。
    geojson_path = output_dir / "japan-with-scores-v2.geojson"
    if geojson_path.exists():
        print(f"Loading GeoJSON from {geojson_path} to identify missing wards...")
        with open(geojson_path, "r", encoding="utf-8") as f:
            geojson = json.load(f)

        filled_count = 0
        for feature in geojson["features"]:
            code = feature.get("properties", {}).get("N03_007")
            if not code or code in result:
                continue
            if code in HAMAMATSU_NEW_CODES:
                # integrate_scores.pyで補完元フラグを付けるため、ここでは埋めない。
                continue

            # 例: 札幌市の区 01101 -> 市全体 01100。
            parent_candidate = code[:-1] + "0"
            if parent_candidate in result:
                result[code] = result[parent_candidate]
                filled_count += 1
                continue

            # 例: 横浜市の区 14110 -> 市全体 14100。
            parent_candidate_2 = code[:-2] + "00"
            if parent_candidate_2 in result:
                result[code] = result[parent_candidate_2]
                filled_count += 1

        print(f"Filled {filled_count} missing wards using city-level data.")
    else:
        print("Warning: GeoJSON not found. Skipping ward filling.")

    print(f"Processed {len(result)} municipalities (including filled wards).")
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"Saved to {output_json}")


if __name__ == "__main__":
    main()
