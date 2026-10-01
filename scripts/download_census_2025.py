"""Download fixed-version official 2025 Census and boundary source files."""

import argparse
import hashlib
import json
import shutil
import tempfile
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
CENSUS_DIR = DATA_DIR / "census_2025"
BOUNDARY_DIR = DATA_DIR / "geojson-s0001"
BOUNDARY_GEOJSON = BOUNDARY_DIR / "N03-20250101.geojson"

FILES = {
    "table_1-1": {
        "path": CENSUS_DIR / "census2025_table_1-1.xlsx",
        "url": "https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040506423&fileKind=0",
        "expected_sha256": "c1ff781e05af6fce6510ee9cfbeba856106c97ae780ca030a549466b0074d856",
    },
    "table_2-7": {
        "path": CENSUS_DIR / "census2025_table_2-7.xlsx",
        "url": "https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040506431&fileKind=0",
        "expected_sha256": "3d0dab20893d8fca43ef33d521a0651841de105cf5b2720582e5024469030e75",
    },
    "municipality-boundaries": {
        "path": BOUNDARY_DIR / "N03-20250101_GML.zip",
        "url": "https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2025/N03-20250101_GML.zip",
        "expected_sha256": "df20ebf7193e445ef3846b41578068848bb1a79836151cc8c1ec6275cca984a5",
    },
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_verified(name: str, path: Path, url: str, expected_sha256: str) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and sha256_file(path) == expected_sha256:
        print(f"Verified existing {name}: {path}")
        return {"path": str(path.relative_to(ROOT)), "url": url, "sha256": expected_sha256}

    print(f"Downloading {name}...")
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix=f".{path.name}.", suffix=".part", dir=path.parent, delete=False
        ) as destination:
            temp_path = Path(destination.name)
            request = urllib.request.Request(url, headers={"User-Agent": "urbanity-map-data-refresh/1.0"})
            with urllib.request.urlopen(request, timeout=120) as response:
                shutil.copyfileobj(response, destination, length=1024 * 1024)

        actual_sha256 = sha256_file(temp_path)
        if actual_sha256 != expected_sha256:
            raise ValueError(
                f"SHA-256 mismatch for {name}: expected {expected_sha256}, got {actual_sha256}"
            )
        if path.suffix == ".zip":
            with zipfile.ZipFile(temp_path) as archive:
                if archive.testzip() is not None:
                    raise ValueError(f"Downloaded archive is corrupt: {name}")
        path.unlink(missing_ok=True)
        temp_path.replace(path)
        print(f"Saved {name}: {path}")
        return {"path": str(path.relative_to(ROOT)), "url": url, "sha256": expected_sha256}
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


def extract_boundary_geojson(archive_path: Path) -> None:
    BOUNDARY_DIR.mkdir(parents=True, exist_ok=True)
    temp_path: Path | None = None
    try:
        with zipfile.ZipFile(archive_path) as archive:
            member = "N03-20250101.geojson"
            if member not in archive.namelist():
                raise ValueError(f"{member} was not found in {archive_path}")
            expected_size = archive.getinfo(member).file_size
            if BOUNDARY_GEOJSON.exists() and BOUNDARY_GEOJSON.stat().st_size == expected_size:
                print(f"Verified extracted boundary source exists: {BOUNDARY_GEOJSON}")
                return
            with tempfile.NamedTemporaryFile(
                prefix=".N03-20250101.", suffix=".part", dir=BOUNDARY_DIR, delete=False
            ) as destination:
                temp_path = Path(destination.name)
                with archive.open(member) as source:
                    shutil.copyfileobj(source, destination, length=1024 * 1024)
        temp_path.replace(BOUNDARY_GEOJSON)
        print(f"Extracted official boundary source: {BOUNDARY_GEOJSON}")
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--with-boundaries",
        action="store_true",
        help="also download and extract MLIT's 2025 municipality boundary archive (about 600 MB)",
    )
    args = parser.parse_args()

    manifest_files = {}
    for name in ("table_1-1", "table_2-7"):
        item = FILES[name]
        manifest_files[name] = download_verified(name, **item)

    if args.with_boundaries:
        item = FILES["municipality-boundaries"]
        manifest_files["municipality-boundaries"] = download_verified(
            "municipality-boundaries", **item
        )
        extract_boundary_geojson(item["path"])

    manifest = {
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": manifest_files,
    }
    CENSUS_DIR.mkdir(parents=True, exist_ok=True)
    (CENSUS_DIR / "download-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Download manifest: {CENSUS_DIR / 'download-manifest.json'}")


if __name__ == "__main__":
    main()
