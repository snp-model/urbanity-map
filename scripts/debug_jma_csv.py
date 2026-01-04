"""JMA CSV構造のデバッグスクリプト"""

from pathlib import Path

jma_dir = Path(__file__).parent.parent / "data" / "JMA"
csv_file = jma_dir / "data.csv"

with open(csv_file, "r", encoding="shift_jis") as f:
    lines = f.readlines()

print("=== Row 2 (観測所名) ===")
row2 = lines[2].strip().split(",")
print(f"カラム数: {len(row2)}")
# 非空のカラムのみ表示
non_empty = [(i, v) for i, v in enumerate(row2) if v.strip()]
print(f"非空カラム数: {len(non_empty)}")
print(f"最初の10件: {non_empty[:10]}")

print("\n=== Row 3 (データ種別) ===")
row3 = lines[3].strip().split(",")
non_empty3 = [(i, v) for i, v in enumerate(row3) if v.strip()]
print(f"非空カラム数: {len(non_empty3)}")
print(f"最初の10件: {non_empty3[:10]}")

print("\n=== Row 6 (データ行) ===")
row6 = lines[6].strip().split(",")
print(f"カラム数: {len(row6)}")
print(f"最初の20件: {row6[:20]}")

# 特定の観測所を確認
print("\n=== 観測所名サンプル ===")
for i, name in non_empty[:10]:
    dtype_at_i = row3[i] if i < len(row3) else ""
    data_at_i = row6[i] if i < len(row6) else ""
    print(f"  Col {i}: name='{name}', dtype='{dtype_at_i}', data='{data_at_i}'")
