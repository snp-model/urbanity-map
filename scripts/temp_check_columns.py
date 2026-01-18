import pandas as pd

df = pd.read_excel('../data/economic-census/r6_sanngyoub.xlsx', sheet_name='Ⅰ産業分類【事業所】', header=7, nrows=30)

print('各列のサンプル（行5）:')
for i, col in enumerate(df.columns):
    print(f'列{i} ({col}): {df.iloc[5, i]}')
