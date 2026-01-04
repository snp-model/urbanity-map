import sys

file_path = "../data/JMA/smaster.index"


def parse_latlon(s):
    # s is like '4524901414070'
    # Lat: 452490 -> 45 deg 24.9 min
    # Lon: 1414070 -> 141 deg 40.7 min

    # Assume Lat is first 6 digits, Lon is next 7 digits?
    # Or variable length?
    # 3568 degrees? No.
    # Let's try to split by known length.
    # Lat is usually 2 digits deg + 4 digits min (decimal) -> 6 digits?
    # Lon is usually 3 digits deg + 4 digits min (decimal) -> 7 digits?

    if len(s) < 13:
        return None, None

    lat_str = s[0:6]
    lon_str = s[6:13]

    try:
        lat_deg = int(lat_str[0:2])
        lat_min = int(lat_str[2:]) / 10.0
        lat = lat_deg + lat_min / 60.0

        lon_deg = int(lon_str[0:3])
        lon_min = int(lon_str[3:]) / 10.0
        lon = lon_deg + lon_min / 60.0

        return lat, lon
    except:
        return None, None


search_terms = ["札幌", "東京", "大阪"]

try:
    with open(file_path, "r", encoding="shift_jis") as f:
        print("Searching for stations...")
        for line in f:
            for term in search_terms:
                if term in line:
                    # simplistic extraction: find the digit sequence
                    parts = line.split()
                    # The long digit sequence is usually at a specific index or identifiable
                    # In: "401 1857822 114 ﾜﾂｶﾅｲ WAKKANAI 4524901414070 ..."
                    # It seems to be the one before elevation or after Romaji?

                    # Let's look for a token with length 13+ composed of digits
                    for token in parts:
                        if token.isdigit() and len(token) >= 13:
                            lat, lon = parse_latlon(token)
                            print(
                                f"Match: {term} -> {token} -> Lat: {lat:.4f}, Lon: {lon:.4f}"
                            )
                            print(f"Line: {line.strip()}")
except Exception as e:
    print(f"Error: {e}")
