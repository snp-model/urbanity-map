import csv

file_path = "../data/JMA/data.csv"

with open(file_path, "r", encoding="shift_jis") as f:
    reader = csv.reader(f)
    rows = []
    for i in range(6):
        rows.append(next(reader))

print("Checking first 6 rows for metadata...")

# Row containing Station Names (likely row 2 or 3, 0-indexed)
# Row containing Data Types (likely row 3 or 4)

for i, row in enumerate(rows):
    # Print distinct values to avoid printing 2000 columns
    distinct_values = sorted(list(set([x for x in row if x.strip()])))
    print(f"\n--- Row {i} ---")
    print(f"Distinct values (first 20): {distinct_values[:20]}")

    if any("最高気温" in x for x in distinct_values):
        print("FOUND: 最高気温")
    if any("最深積雪" in x for x in distinct_values):
        print("FOUND: 最深積雪")
