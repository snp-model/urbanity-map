"""人口データ解凍スクリプト

data/population_mesh ディレクトリ内のzipファイルを解凍し、
GeoJSONファイルを抽出します。

使用方法:
    cd scripts
    uv run unzip_population.py
"""

import zipfile
from pathlib import Path

def main() -> None:
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / "data" / "population_mesh"
    
    if not data_dir.exists():
        print(f"ディレクトリが見つかりません: {data_dir}")
        return

    # zipファイルを検索
    zip_files = list(data_dir.glob("*.zip"))
    print(f"{len(zip_files)} 個のzipファイルが見つかりました。")

    for zip_path in zip_files:
        print(f"解凍中: {zip_path.name}")
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # GeoJSONファイルのみ抽出（なければすべて）
                file_list = zip_ref.namelist()
                geojson_files = [f for f in file_list if f.lower().endswith('.geojson') or f.lower().endswith('.json')]
                
                if geojson_files:
                    for file in geojson_files:
                        zip_ref.extract(file, data_dir)
                        print(f"  -> {file}")
                else:
                    # GeoJSONが見つからない場合はすべて解凍
                    zip_ref.extractall(data_dir)
                    print("  -> (全ファイル展開)")
        except Exception as e:
            print(f"エラー: {zip_path.name} の解凍に失敗しました: {e}")

    print("解凍完了。")

if __name__ == "__main__":
    main()
