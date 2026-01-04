"""マッチしなかった観測所名の一覧を出力する"""

from pathlib import Path
import json

jma_dir = Path(__file__).parent.parent / "data" / "JMA"

# smaster.indexから全ての名前を抽出
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

# CSVから観測所名を抽出
csv_names = set()
for csv_file in jma_dir.glob("data*.csv"):
    with open(csv_file, "r", encoding="shift_jis") as f:
        lines = f.readlines()
    if len(lines) > 2:
        for name in lines[2].strip().split(","):
            if name.strip():
                csv_names.add(name.strip())

unmatched = csv_names - smaster_names

print("=== マッチしなかったCSV観測所名 ===")
print(f"総数: {len(unmatched)}")

# カテゴリ別に分類
hiragana = [n for n in unmatched if any("\u3040" <= c <= "\u309f" for c in n)]
katakana = [
    n
    for n in unmatched
    if any("\u30a0" <= c <= "\u30ff" for c in n) and n not in hiragana
]
kanji_only = [n for n in unmatched if n not in hiragana and n not in katakana]

print(f"\nひらがな含む: {len(hiragana)}")
print(f"カタカナ含む: {len(katakana)}")
print(f"漢字のみ: {len(kanji_only)}")

print("\n漢字のみの観測所名（smaster.indexになさそうなもの）:")
for name in sorted(kanji_only)[:50]:
    print(f"  {name}")
