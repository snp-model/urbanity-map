"""Load the fixed 2020 reference used by every score-generation script."""

import json
from pathlib import Path


CALIBRATION_PATH = Path(__file__).with_name("urbanity-calibration-v2.json")


def load_urbanity_calibration() -> dict:
    with CALIBRATION_PATH.open("r", encoding="utf-8") as calibration_file:
        calibration = json.load(calibration_file)

    if calibration.get("schema_version") != 1:
        raise ValueError(f"Unsupported calibration schema: {CALIBRATION_PATH}")
    return calibration
