"""Audit the raw hospital readmission dataset."""

from pathlib import Path

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DATA_PATH = PROJECT_ROOT / "data" / "raw" / "hospital_readmissions.csv"
REPORTS_DIR = PROJECT_ROOT / "reports"

MISSINGNESS_PATH = REPORTS_DIR / "missing_value_report.csv"
AUDIT_PATH = REPORTS_DIR / "data_audit_summary.txt"


def clean_column_names(columns: pd.Index) -> pd.Index:
    """Convert column names to lowercase snake_case."""

    return (
        columns.str.strip()
        .str.lower()
        .str.replace(r"[^a-z0-9]+", "_", regex=True)
        .str.strip("_")
    )


def main() -> None:
    """Generate an audit report for the raw dataset."""

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading dataset...")

    data = pd.read_csv(
        RAW_DATA_PATH,
        low_memory=False,
        na_values=["?"],
    )

    data.columns = clean_column_names(data.columns)

    if "readmitted" not in data.columns:
        raise ValueError("Expected target column 'readmitted' was not found.")

    missing_report = pd.DataFrame(
        {
            "missing_count": data.isna().sum(),
            "missing_percent": data.isna().mean().mul(100).round(2),
            "unique_values": data.nunique(dropna=True),
            "data_type": data.dtypes.astype(str),
        }
    ).sort_values("missing_percent", ascending=False)

    target_counts = data["readmitted"].value_counts(dropna=False)
    target_percentages = (
        data["readmitted"]
        .value_counts(normalize=True, dropna=False)
        .mul(100)
        .round(2)
    )

    duplicate_rows = int(data.duplicated().sum())

    constant_columns = [
        column
        for column in data.columns
        if data[column].nunique(dropna=False) <= 1
    ]

    summary_lines = [
        "HOSPITAL READMISSION DATA AUDIT",
        "=" * 40,
        f"Rows: {data.shape[0]:,}",
        f"Columns: {data.shape[1]}",
        f"Duplicate rows: {duplicate_rows:,}",
        "",
        "TARGET COUNTS",
        target_counts.to_string(),
        "",
        "TARGET PERCENTAGES",
        target_percentages.to_string(),
        "",
        "DATA TYPE COUNTS",
        data.dtypes.astype(str).value_counts().to_string(),
        "",
        "TOP 15 COLUMNS BY MISSINGNESS",
        missing_report.head(15).to_string(),
        "",
        "CONSTANT COLUMNS",
        ", ".join(constant_columns) if constant_columns else "None",
        "",
        "COLUMN NAMES",
        "\n".join(data.columns),
    ]

    summary_text = "\n".join(summary_lines)

    missing_report.to_csv(MISSINGNESS_PATH)
    AUDIT_PATH.write_text(summary_text, encoding="utf-8")

    print("\n" + summary_text)
    print(f"\nMissing-value report saved to: {MISSINGNESS_PATH}")
    print(f"Audit summary saved to: {AUDIT_PATH}")


if __name__ == "__main__":
    main()
