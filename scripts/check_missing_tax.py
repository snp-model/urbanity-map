
import json
import os

def check_missing_data():
    # Load GeoJSON
    with open('frontend/public/data/japan-with-scores-v2.geojson', 'r') as f:
        geojson = json.load(f)
    
    # Load Tax Data
    with open('frontend/public/data/tax_income.json', 'r') as f:
        tax_data = json.load(f)
        
    missing_municipalities = []
    
    for feature in geojson['features']:
        props = feature['properties']
        code = props.get('N03_007') # 5-digit code
        name = (props.get('N03_003') or '') + (props.get('N03_004') or '')
        
        if not code:
            continue
            
        if code not in tax_data:
            missing_municipalities.append(f"{name} ({code})")
            
    print(f"Total features in GeoJSON: {len(geojson['features'])}")
    print(f"Total records in Tax Data: {len(tax_data)}")
    print(f"Missing Tax Data for {len(missing_municipalities)} municipalities:")
    for m in missing_municipalities[:20]: # Show first 20
        print(f" - {m}")
    if len(missing_municipalities) > 20:
        print(f"... and {len(missing_municipalities) - 20} more.")

if __name__ == "__main__":
    check_missing_data()
