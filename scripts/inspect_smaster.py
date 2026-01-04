import sys

file_path = "../data/JMA/smaster.index"

try:
    with open(file_path, "r", encoding="shift_jis") as f:
        print("Reading first 10 lines of smaster.index (Shift_JIS):")
        for i in range(10):
            line = f.readline()
            if not line:
                break
            print(f"Line {i}: {line.strip()}")
except UnicodeDecodeError:
    print("Failed to read with Shift_JIS. Trying cp932...")
    try:
        with open(file_path, "r", encoding="cp932") as f:
            for i in range(10):
                line = f.readline()
                if not line:
                    break
                print(f"Line {i}: {line.strip()}")
    except Exception as e:
        print(f"Error: {e}")
except Exception as e:
    print(f"Error: {e}")
