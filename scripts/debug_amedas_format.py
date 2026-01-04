"""AMeDASマスターファイルの構造を確認するスクリプト"""

from pathlib import Path

jma_dir = Path(__file__).parent.parent / "data" / "JMA"

print("=== ame_master ===")
ame_file = jma_dir / "ame_master_20251120.csv"
with open(ame_file, "r", encoding="shift_jis") as f:
    for i, line in enumerate(f):
        if i < 5:
            print(f"Line {i}: {line.strip()}")

print("\n=== snow_master ===")
snow_file = jma_dir / "snow_master_20251120.csv"
with open(snow_file, "r", encoding="shift_jis") as f:
    for i, line in enumerate(f):
        if i < 5:
            print(f"Line {i}: {line.strip()}")
