"""Create prediction defaults and a sample API request."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]

TRAIN_PATH = PROJECT_ROOT / "data" / "processed" / "train.csv"
TEST_PATH = PROJECT_ROOT / "data" / "processed" / "test.csv"
METADATA_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "feature_metadata.json"
)

SCHEMA_PATH = PROJECT_ROOT / "models" / "prediction_schema.json"
SAMPLE_PATH = (
    PROJECT_ROOT
    / "reports"
    / "sample_prediction_request.json"
)


def json_safe(value: Any) -> Any:
    """Convert pandas and NumPy values into JSON-safe Python values."""

    if pd.isna(value):
        return None

    if isinstance(value, np.generic):
        return value.item()

    return value


def detect_python_type(series: pd.Series) -> str:
    """Determine how an API value should be converted."""

    if pd.api.types.is_integer_dtype(series.dtype):
        return "integer"

    if pd.api.types.is_float_dtype(series.dtype):
        return "number"

    return "string"


def main() -> None:
    """Create schema metadata and a full sample request."""

    train_data = pd.read_csv(TRAIN_PATH, low_memory=False)
    test_data = pd.read_csv(TEST_PATH, low_memory=False)

    metadata = json.loads(
        METADATA_PATH.read_text(encoding="utf-8")
    )

    numeric_features = metadata["numeric_features"]
    categorical_features = metadata["categorical_features"]

    feature_order = numeric_features + categorical_features
    feature_schema: dict[str, dict[str, Any]] = {}

    for feature in numeric_features:
        series = pd.to_numeric(
            train_data[feature],
            errors="coerce",
        )

        median = series.median()

        default = (
            float(median)
            if pd.notna(median)
            else 0.0
        )

        feature_schema[feature] = {
            "kind": "numeric",
            "python_type": "number",
            "default": default,
            "minimum": json_safe(series.min()),
            "maximum": json_safe(series.max()),
        }

    for feature in categorical_features:
        series = train_data[feature]
        non_missing = series.dropna()

        if non_missing.empty:
            default: Any = "Unknown"
            allowed_values: list[Any] = []
            python_type = "string"
        else:
            mode = non_missing.mode(dropna=True)

            default = json_safe(
                mode.iloc[0]
                if not mode.empty
                else non_missing.iloc[0]
            )

            python_type = detect_python_type(non_missing)

            allowed_values = [
                json_safe(value)
                for value in sorted(
                    non_missing.unique().tolist(),
                    key=lambda value: str(value),
                )
            ]

        feature_schema[feature] = {
            "kind": "categorical",
            "python_type": python_type,
            "default": default,
            "allowed_values": allowed_values,
        }

    schema = {
        "feature_order": feature_order,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "features": feature_schema,
    }

    SCHEMA_PATH.write_text(
        json.dumps(schema, indent=2),
        encoding="utf-8",
    )

    sample_row = test_data.iloc[0]

    sample_features = {
        feature: json_safe(sample_row[feature])
        for feature in feature_order
        if pd.notna(sample_row[feature])
    }

    sample_payload = {
        "features": sample_features,
    }

    SAMPLE_PATH.write_text(
        json.dumps(sample_payload, indent=2),
        encoding="utf-8",
    )

    print("Prediction schema created successfully")
    print(f"Features: {len(feature_order)}")
    print(f"Schema: {SCHEMA_PATH}")
    print(f"Sample request: {SAMPLE_PATH}")


if __name__ == "__main__":
    main()
