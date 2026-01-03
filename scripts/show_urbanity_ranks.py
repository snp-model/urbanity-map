import json
import random

def get_municipality_name(props):
    pref = props.get('N03_001', '')
    # sub_pref = props.get('N03_002', '') # Usually not needed for identification if we have county/city
    county = props.get('N03_003', '')
    city = props.get('N03_004', '')
    
    name = f"{pref}"
    if county:
        name += f" {county}"
    if city:
        name += f" {city}"
    return name

def main():
    file_path = 'frontend/public/data/japan-with-scores-v2.geojson'
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found at {file_path}")
        return

    features = data.get('features', [])
    valid_features = []
    
    for feature in features:
        props = feature.get('properties', {})
        score = props.get('urbanity_v2')
        if score is not None:
            valid_features.append({
                'name': get_municipality_name(props),
                'score': float(score)
            })

    # Sort by score descending
    valid_features.sort(key=lambda x: x['score'], reverse=True)
    
    # 1. Divide by Score Range (Absolute) - 10 bins: 90-100, 80-90, ...
    print("=== 都会度スコアによる10分割 (絶対値 0-100) ===")
    bins = {i: [] for i in range(10)}
    
    for item in valid_features:
        score = item['score']
        # Determine bin index 0-9. 
        # 90-100 -> 9, 80-89.9 -> 8, ..., 0-9.9 -> 0
        # Special case: 100 should be in bin 9
        if score >= 100:
            bin_idx = 9
        else:
            bin_idx = int(score // 10)
            if bin_idx < 0: bin_idx = 0
            if bin_idx > 9: bin_idx = 9
        
        bins[bin_idx].append(item)

    for i in range(9, -1, -1):
        items = bins[i]
        min_score = i * 10
        max_score = (i + 1) * 10
        range_str = f"{min_score}-{max_score}"
        print(f"\nレベル {i+1} (スコア {range_str}) - 該当数: {len(items)}")
        
        # Pick top 10 from this bin (since list is already sorted by score)
        # The user said "10 municipalities belonging to each".
        # Showing the top ones in that range makes sense to represent the "best" of that class, 
        # or we could pick random ones. Top ones are more deterministic.
        
        display_items = items[:10]
        for item in display_items:
            print(f"  - {item['name']}: {item['score']}")

if __name__ == '__main__':
    main()
