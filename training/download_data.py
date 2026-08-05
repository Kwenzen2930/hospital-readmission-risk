"""Download the UCI hospital readmission dataset."""

from pathlib import Path

import pandas as pd
from ucimlrepo import fetch_ucirepo


PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"

DATA_PATH = RAW_DATA_DIR / "hospital_readmissions.csv"
VARIABLES_PATH = RAW_DATA_DIR / "variable_descriptions.csv"


def main() -> None:
    """Download and save the hospital readmission dataset."""

    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)

    print("Downloading hospital readmission dataset...")

    dataset = fetch_ucirepo(id=296)

    features = dataset.data.features.copy()
    target = dataset.data.targets.copy()

    data = pd.concat([features, target], axis=1)

    if "readmitted" not in data.columns:
        raise ValueError("Target column 'readmitted' was not found.")

    data.to_csv(DATA_PATH, index=False)
    dataset.variables.to_csv(VARIABLES_PATH, index=False)

    print("\nDownload completed successfully.")
    print(f"Rows: {data.shape[0]:,}")
    print(f"Columns: {data.shape[1]}")

    print("\nReadmission categories:")
    print(data["readmitted"].value_counts(dropna=False))

    print(f"\nDataset saved to: {DATA_PATH}")
    print(f"Variable descriptions saved to: {VARIABLES_PATH}")


if __name__ == "__main__":
    main()
