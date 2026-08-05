"""Clean the hospital dataset and create patient-safe train/test splits."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold


PROJECT_ROOT = Path(__file__).resolve().parents[1]

RAW_DATA_PATH = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "hospital_readmissions_full.csv"
)

PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
REPORTS_DIR = PROJECT_ROOT / "reports"

CLEAN_DATA_PATH = PROCESSED_DIR / "cleaned_readmissions.csv"
TRAIN_DATA_PATH = PROCESSED_DIR / "train.csv"
TEST_DATA_PATH = PROCESSED_DIR / "test.csv"
METADATA_PATH = PROCESSED_DIR / "feature_metadata.json"
SUMMARY_PATH = REPORTS_DIR / "data_preparation_summary.txt"


# These discharge outcomes do not provide a normal opportunity
# for a later hospital readmission.
EXCLUDED_DISCHARGE_IDS = {
    11,  # Expired
    13,  # Hospice / home
    14,  # Hospice / medical facility
    19,  # Expired at home
    20,  # Expired in medical facility
    21,  # Expired, place unknown
}

DROP_COLUMNS = [
    "weight",
    "payer_code",
    "examide",
    "citoglipton",
    "diag_1",
    "diag_2",
    "diag_3",
    "readmitted",
]

NUMERIC_FEATURES = [
    "time_in_hospital",
    "num_lab_procedures",
    "num_procedures",
    "num_medications",
    "number_outpatient",
    "number_emergency",
    "number_inpatient",
    "number_diagnoses",
    "service_utilization",
    "had_prior_utilization",
]

FORCED_CATEGORICAL_FEATURES = [
    "admission_type_id",
    "discharge_disposition_id",
    "admission_source_id",
]


def snake_case(value: str) -> str:
    """Convert a column name to snake_case."""

    value = re.sub(r"(?<!^)(?=[A-Z])", "_", value)
    value = re.sub(r"[^a-zA-Z0-9]+", "_", value)

    return value.strip("_").lower()


def diagnosis_group(value: object) -> str:
    """Convert an ICD-9 diagnosis code into a broad disease group."""

    if pd.isna(value):
        return "Missing"

    text = str(value).strip()

    if not text:
        return "Missing"

    if text.upper().startswith(("V", "E")):
        return "External_or_Supplementary"

    try:
        code = float(text)
    except ValueError:
        return "Other"

    if 390 <= code <= 459 or code == 785:
        return "Circulatory"

    if 460 <= code <= 519 or code == 786:
        return "Respiratory"

    if 520 <= code <= 579 or code == 787:
        return "Digestive"

    if 250 <= code < 251:
        return "Diabetes"

    if 800 <= code <= 999:
        return "Injury"

    if 710 <= code <= 739:
        return "Musculoskeletal"

    if 580 <= code <= 629 or code == 788:
        return "Genitourinary"

    if 140 <= code <= 239:
        return "Neoplasm"

    return "Other"


def load_and_clean_data() -> pd.DataFrame:
    """Load and clean the complete UCI dataset."""

    data = pd.read_csv(
        RAW_DATA_PATH,
        low_memory=False,
        na_values=["?"],
    )

    data.columns = [snake_case(column) for column in data.columns]

    required_columns = {
        "encounter_id",
        "patient_nbr",
        "readmitted",
        "discharge_disposition_id",
    }

    missing_columns = required_columns.difference(data.columns)

    if missing_columns:
        raise ValueError(
            f"Required columns missing: {sorted(missing_columns)}"
        )

    initial_rows = len(data)

    data = data.drop_duplicates(subset=["encounter_id"]).copy()

    data = data[
        ~data["discharge_disposition_id"].isin(
            EXCLUDED_DISCHARGE_IDS
        )
    ].copy()

    data = data[
        data["gender"].fillna("Unknown") != "Unknown/Invalid"
    ].copy()

    data["readmitted_30d"] = (
        data["readmitted"] == "<30"
    ).astype(int)

    for diagnosis_column in ["diag_1", "diag_2", "diag_3"]:
        group_column = f"{diagnosis_column}_group"

        data[group_column] = data[diagnosis_column].apply(
            diagnosis_group
        )

    utilization_columns = [
        "number_outpatient",
        "number_emergency",
        "number_inpatient",
    ]

    data["service_utilization"] = (
        data[utilization_columns]
        .fillna(0)
        .sum(axis=1)
    )

    data["had_prior_utilization"] = (
        data["service_utilization"] > 0
    ).astype(int)

    columns_to_drop = [
        column
        for column in DROP_COLUMNS
        if column in data.columns
    ]

    data = data.drop(columns=columns_to_drop)

    data = data.reset_index(drop=True)

    print(f"Initial rows: {initial_rows:,}")
    print(f"Rows after cleaning: {len(data):,}")

    return data


def create_patient_safe_split(
    data: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Create an 80/20 split without sharing patients between sets."""

    features = data.drop(columns=["readmitted_30d"])
    target = data["readmitted_30d"]
    patient_groups = data["patient_nbr"]

    splitter = StratifiedGroupKFold(
        n_splits=5,
        shuffle=True,
        random_state=42,
    )

    train_indices, test_indices = next(
        splitter.split(
            features,
            target,
            groups=patient_groups,
        )
    )

    train_data = data.iloc[train_indices].copy()
    test_data = data.iloc[test_indices].copy()

    shared_patients = set(train_data["patient_nbr"]).intersection(
        set(test_data["patient_nbr"])
    )

    if shared_patients:
        raise RuntimeError(
            "Patient leakage detected between train and test sets."
        )

    return train_data, test_data


def main() -> None:
    """Prepare cleaned datasets and save feature metadata."""

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    print("Preparing hospital readmission data...\n")

    data = load_and_clean_data()
    train_data, test_data = create_patient_safe_split(data)

    excluded_model_columns = {
        "encounter_id",
        "patient_nbr",
        "readmitted_30d",
    }

    available_feature_columns = [
        column
        for column in data.columns
        if column not in excluded_model_columns
    ]

    numeric_features = [
        column
        for column in NUMERIC_FEATURES
        if column in available_feature_columns
    ]

    categorical_features = [
        column
        for column in available_feature_columns
        if column not in numeric_features
    ]

    # Ensure hospital code identifiers are treated as categories,
    # not continuous numbers.
    for column in FORCED_CATEGORICAL_FEATURES:
        if column in data.columns:
            data[column] = data[column].astype("string")
            train_data[column] = train_data[column].astype("string")
            test_data[column] = test_data[column].astype("string")

    metadata = {
        "target": "readmitted_30d",
        "group_column": "patient_nbr",
        "identifier_column": "encounter_id",
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "excluded_discharge_ids": sorted(EXCLUDED_DISCHARGE_IDS),
    }

    data.to_csv(CLEAN_DATA_PATH, index=False)
    train_data.to_csv(TRAIN_DATA_PATH, index=False)
    test_data.to_csv(TEST_DATA_PATH, index=False)

    METADATA_PATH.write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )

    train_rate = train_data["readmitted_30d"].mean()
    test_rate = test_data["readmitted_30d"].mean()

    shared_patient_count = len(
        set(train_data["patient_nbr"]).intersection(
            set(test_data["patient_nbr"])
        )
    )

    summary = "\n".join(
        [
            "HOSPITAL READMISSION DATA PREPARATION",
            "=" * 45,
            f"Cleaned rows: {len(data):,}",
            f"Cleaned columns: {data.shape[1]}",
            "",
            f"Train rows: {len(train_data):,}",
            f"Test rows: {len(test_data):,}",
            "",
            (
                "Train unique patients: "
                f"{train_data['patient_nbr'].nunique():,}"
            ),
            (
                "Test unique patients: "
                f"{test_data['patient_nbr'].nunique():,}"
            ),
            f"Patients shared across sets: {shared_patient_count}",
            "",
            f"Train 30-day readmission rate: {train_rate:.2%}",
            f"Test 30-day readmission rate: {test_rate:.2%}",
            "",
            f"Numeric features: {len(numeric_features)}",
            f"Categorical features: {len(categorical_features)}",
        ]
    )

    SUMMARY_PATH.write_text(summary, encoding="utf-8")

    print("\n" + summary)

    print("\nFiles created:")
    print(CLEAN_DATA_PATH)
    print(TRAIN_DATA_PATH)
    print(TEST_DATA_PATH)
    print(METADATA_PATH)
    print(SUMMARY_PATH)


if __name__ == "__main__":
    main()
