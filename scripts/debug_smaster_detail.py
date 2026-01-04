"""smaster.indexからすべての観測所情報を抽出するデバッグスクリプト"""

from pathlib import Path
import re

jma_dir = Path(__file__).parent.parent / "data" / "JMA"

# smaster.indexの構造を詳細解析
# 例: "401 1857822 114 ﾜﾂｶﾅｲ WAKKANAI 4524901414070 235 110 5 11986010119890331稚内　　　稚内地方気象台　宗谷支庁"

stations = {}

with open(jma_dir / "smaster.index", "r", encoding="shift_jis") as f:
    for line in f:
        parts = line.split()
        if len(parts) < 6:
            continue

        # 半角カナ名を探す（ｱ-ﾝの範囲）
        kana_name = None
        romaji_name = None
        coord_str = None

        for p in parts:
            # 半角カナ（0xFF65-0xFF9F）
            if all("\uff65" <= c <= "\uff9f" for c in p) and len(p) >= 2:
                kana_name = p
            # ローマ字（大文字英字のみ）
            elif p.isalpha() and p.isupper() and len(p) >= 3:
                romaji_name = p
            # 座標（13桁数字）
            elif p.isdigit() and len(p) == 13:
                coord_str = p

        if coord_str:
            try:
                lat_deg = int(coord_str[0:2])
                lat_min = int(coord_str[2:6]) / 100.0
                lat = lat_deg + lat_min / 60.0

                lon_deg = int(coord_str[6:9])
                lon_min = int(coord_str[9:13]) / 100.0
                lon = lon_deg + lon_min / 60.0

                # 日本語名
                jp_name = None
                for i, ch in enumerate(line):
                    if (
                        "\u4e00" <= ch <= "\u9fff"
                        or "\u3040" <= ch <= "\u309f"
                        or "\u30a0" <= ch <= "\u30ff"
                    ):
                        jp_part = line[i:].strip()
                        jp_name = (
                            jp_part.split()[0].replace("　", "") if jp_part else None
                        )
                        break

                # ローマ字名をキーとして保存（一意性が高い）
                if romaji_name:
                    stations[romaji_name] = {
                        "romaji": romaji_name,
                        "kana": kana_name,
                        "jp": jp_name,
                        "lat": lat,
                        "lon": lon,
                    }
            except:
                pass

print(f"抽出した観測所数: {len(stations)}")
print("\nサンプル:")
for name, info in list(stations.items())[:20]:
    print(
        f"  {name}: kana={info['kana']}, jp={info['jp']}, lat={info['lat']:.3f}, lon={info['lon']:.3f}"
    )

# CSVの観測所名との対応を確認
csv_names = set()
for csv_file in jma_dir.glob("data*.csv"):
    with open(csv_file, "r", encoding="shift_jis") as f:
        lines = f.readlines()
    if len(lines) > 2:
        for name in lines[2].strip().split(","):
            if name.strip():
                csv_names.add(name.strip())

print(f"\nCSV観測所名サンプル（ひらがな・カタカナ含む）:")
hiragana_katakana = [n for n in csv_names if any("\u3040" <= c <= "\u30ff" for c in n)]
print(f"  {sorted(hiragana_katakana)[:30]}")
