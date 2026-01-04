"""smaster.indexとCSVの観測所名を比較するデバッグスクリプト"""

from pathlib import Path

jma_dir = Path(__file__).parent.parent / "data" / "JMA"

# smaster.indexから観測所名を抽出
smaster_names = set()
with open(jma_dir / "smaster.index", "r", encoding="shift_jis") as f:
    for line in f:
        # 日本語名を抽出
        for i, ch in enumerate(line):
            if (
                "\u4e00" <= ch <= "\u9fff"
                or "\u3040" <= ch <= "\u309f"
                or "\u30a0" <= ch <= "\u30ff"
            ):
                jp_part = line[i:].strip()
                jp_name = jp_part.split()[0].replace("　", "") if jp_part else None
                if jp_name:
                    smaster_names.add(jp_name)
                break

print(f"smaster.index観測所数: {len(smaster_names)}")
print(f"サンプル: {sorted(list(smaster_names))[:20]}")

# CSVから観測所名を抽出
csv_names = set()
for csv_file in jma_dir.glob("data*.csv"):
    with open(csv_file, "r", encoding="shift_jis") as f:
        lines = f.readlines()
    if len(lines) > 2:
        for name in lines[2].strip().split(","):
            if name.strip():
                csv_names.add(name.strip())

print(f"\nCSV観測所数: {len(csv_names)}")
print(f"サンプル: {sorted(list(csv_names))[:20]}")

# マッチする名前
matched = smaster_names & csv_names
print(f"\n完全一致: {len(matched)}")
print(f"サンプル: {sorted(list(matched))[:20]}")

# マッチしないCSV名
unmatched = csv_names - smaster_names
print(f"\nマッチしないCSV名: {len(unmatched)}")
print(f"サンプル: {sorted(list(unmatched))[:30]}")

# マッチしないsmaster名
unused_smaster = smaster_names - csv_names
print(f"\n未使用smaster名: {len(unused_smaster)}")
print(f"サンプル: {sorted(list(unused_smaster))[:30]}")
