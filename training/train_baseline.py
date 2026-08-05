"""Train and evaluate a baseline hospital readmission model."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    PrecisionRecallDisplay,
    RocCurveDisplay,
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


PROJECT_ROOT = Path(__file__).resolve().parents[1]

TRAIN_PATH = PROJECT_ROOT / "data" / "processed" / "train.csv"
TEST_PATH = PROJECT_ROOT / "data" / "processed" / "test.csv"
METADATA_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "feature_metadata.json"
)

MODEL_PATH = PROJECT_ROOT / "models" / "baseline_logistic_pipeline.joblib"
METRICS_PATH = PROJECT_ROOT / "reports" / "baseline_metrics.json"
SUMMARY_PATH = PROJECT_ROOT / "reports" / "baseline_model_summary.txt"
COEFFICIENTS_PATH = (
    PROJECT_ROOT
    / "reports"
    / "baseline_feature_coefficients.csv"
)

FIGURES_DIR = PROJECT_ROOT / "reports" / "figures"


def load_data() -> tuple[
    pd.DataFrame,
    pd.DataFrame,
    pd.Series,
    pd.Series,
    list[str],
    list[str],
]:
    """Load train/test datasets and feature metadata."""

    train_data = pd.read_csv(TRAIN_PATH, low_memory=False)
    test_data = pd.read_csv(TEST_PATH, low_memory=False)

    metadata = json.loads(
        METADATA_PATH.read_text(encoding="utf-8")
    )

    target_column = metadata["target"]
    numeric_features = metadata["numeric_features"]
    categorical_features = metadata["categorical_features"]

    feature_columns = numeric_features + categorical_features

    missing_train_columns = set(feature_columns).difference(
        train_data.columns
    )
    missing_test_columns = set(feature_columns).difference(
        test_data.columns
    )

    if missing_train_columns:
        raise ValueError(
            "Train columns missing: "
            f"{sorted(missing_train_columns)}"
        )

    if missing_test_columns:
        raise ValueError(
            "Test columns missing: "
            f"{sorted(missing_test_columns)}"
        )

    x_train = train_data[feature_columns].copy()
    x_test = test_data[feature_columns].copy()

    y_train = train_data[target_column].astype(int)
    y_test = test_data[target_column].astype(int)

    return (
        x_train,
        x_test,
        y_train,
        y_test,
        numeric_features,
        categorical_features,
    )


def build_pipeline(
    numeric_features: list[str],
    categorical_features: list[str],
) -> Pipeline:
    """Create the preprocessing and classification pipeline."""

    numeric_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="median"),
            ),
            (
                "scaler",
                StandardScaler(),
            ),
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="most_frequent"),
            ),
            (
                "encoder",
                OneHotEncoder(
                    handle_unknown="ignore",
                    min_frequency=10,
                    sparse_output=True,
                ),
            ),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                numeric_pipeline,
                numeric_features,
            ),
            (
                "categorical",
                categorical_pipeline,
                categorical_features,
            ),
        ],
        remainder="drop",
    )

    classifier = LogisticRegression(
        class_weight="balanced",
        solver="liblinear",
        max_iter=1000,
        random_state=42,
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ]
    )


def calculate_metrics(
    y_test: pd.Series,
    predictions: np.ndarray,
    probabilities: np.ndarray,
) -> tuple[dict[str, float | int], np.ndarray]:
    """Calculate classification metrics."""

    matrix = confusion_matrix(y_test, predictions)

    true_negative, false_positive, false_negative, true_positive = (
        matrix.ravel()
    )

    specificity = true_negative / (
        true_negative + false_positive
    )

    metrics = {
        "test_rows": int(len(y_test)),
        "actual_positive_cases": int(y_test.sum()),
        "predicted_positive_cases": int(predictions.sum()),
        "accuracy": float(
            accuracy_score(y_test, predictions)
        ),
        "balanced_accuracy": float(
            balanced_accuracy_score(y_test, predictions)
        ),
        "precision": float(
            precision_score(
                y_test,
                predictions,
                zero_division=0,
            )
        ),
        "recall": float(
            recall_score(
                y_test,
                predictions,
                zero_division=0,
            )
        ),
        "specificity": float(specificity),
        "f1_score": float(
            f1_score(
                y_test,
                predictions,
                zero_division=0,
            )
        ),
        "roc_auc": float(
            roc_auc_score(y_test, probabilities)
        ),
        "average_precision": float(
            average_precision_score(
                y_test,
                probabilities,
            )
        ),
        "true_negative": int(true_negative),
        "false_positive": int(false_positive),
        "false_negative": int(false_negative),
        "true_positive": int(true_positive),
    }

    return metrics, matrix


def save_feature_coefficients(
    model: Pipeline,
) -> pd.DataFrame:
    """Save Logistic Regression coefficients."""

    preprocessor = model.named_steps["preprocessor"]
    classifier = model.named_steps["classifier"]

    feature_names = preprocessor.get_feature_names_out()
    coefficients = classifier.coef_[0]

    coefficient_data = pd.DataFrame(
        {
            "feature": feature_names,
            "coefficient": coefficients,
        }
    )

    coefficient_data["absolute_coefficient"] = (
        coefficient_data["coefficient"].abs()
    )

    coefficient_data = coefficient_data.sort_values(
        "absolute_coefficient",
        ascending=False,
    )

    coefficient_data.to_csv(
        COEFFICIENTS_PATH,
        index=False,
    )

    return coefficient_data


def save_figures(
    y_test: pd.Series,
    predictions: np.ndarray,
    probabilities: np.ndarray,
) -> None:
    """Save evaluation figures."""

    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    confusion_display = ConfusionMatrixDisplay.from_predictions(
        y_test,
        predictions,
        display_labels=[
            "Not within 30 days",
            "Within 30 days",
        ],
        values_format=",",
    )

    confusion_display.ax_.set_title(
        "Baseline Model Confusion Matrix"
    )
    confusion_display.figure_.tight_layout()
    confusion_display.figure_.savefig(
        FIGURES_DIR / "baseline_confusion_matrix.png",
        dpi=160,
        bbox_inches="tight",
    )
    plt.close(confusion_display.figure_)

    roc_display = RocCurveDisplay.from_predictions(
        y_test,
        probabilities,
        name="Logistic Regression",
    )

    roc_display.ax_.set_title(
        "Baseline Model ROC Curve"
    )
    roc_display.figure_.tight_layout()
    roc_display.figure_.savefig(
        FIGURES_DIR / "baseline_roc_curve.png",
        dpi=160,
        bbox_inches="tight",
    )
    plt.close(roc_display.figure_)

    precision_recall_display = (
        PrecisionRecallDisplay.from_predictions(
            y_test,
            probabilities,
            name="Logistic Regression",
        )
    )

    precision_recall_display.ax_.set_title(
        "Baseline Precision-Recall Curve"
    )
    precision_recall_display.figure_.tight_layout()
    precision_recall_display.figure_.savefig(
        FIGURES_DIR
        / "baseline_precision_recall_curve.png",
        dpi=160,
        bbox_inches="tight",
    )
    plt.close(precision_recall_display.figure_)


def main() -> None:
    """Train, evaluate, and save the baseline model."""

    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

    (
        x_train,
        x_test,
        y_train,
        y_test,
        numeric_features,
        categorical_features,
    ) = load_data()

    print("Training baseline Logistic Regression...")
    print(f"Training rows: {len(x_train):,}")
    print(f"Testing rows: {len(x_test):,}")
    print(f"Numeric features: {len(numeric_features)}")
    print(
        f"Categorical features: {len(categorical_features)}"
    )

    model = build_pipeline(
        numeric_features,
        categorical_features,
    )

    model.fit(x_train, y_train)

    probabilities = model.predict_proba(x_test)[:, 1]
    predictions = (probabilities >= 0.50).astype(int)

    metrics, _ = calculate_metrics(
        y_test,
        predictions,
        probabilities,
    )

    report = classification_report(
        y_test,
        predictions,
        target_names=[
            "No 30-day readmission",
            "30-day readmission",
        ],
        digits=4,
        zero_division=0,
    )

    coefficients = save_feature_coefficients(model)

    joblib.dump(model, MODEL_PATH)

    METRICS_PATH.write_text(
        json.dumps(metrics, indent=2),
        encoding="utf-8",
    )

    save_figures(
        y_test,
        predictions,
        probabilities,
    )

    metric_lines = [
        "BASELINE LOGISTIC REGRESSION",
        "=" * 40,
        f"Accuracy: {metrics['accuracy']:.4f}",
        (
            "Balanced accuracy: "
            f"{metrics['balanced_accuracy']:.4f}"
        ),
        f"Precision: {metrics['precision']:.4f}",
        f"Recall: {metrics['recall']:.4f}",
        f"Specificity: {metrics['specificity']:.4f}",
        f"F1 score: {metrics['f1_score']:.4f}",
        f"ROC-AUC: {metrics['roc_auc']:.4f}",
        (
            "Average precision: "
            f"{metrics['average_precision']:.4f}"
        ),
        "",
        "CONFUSION MATRIX VALUES",
        (
            "True negatives: "
            f"{metrics['true_negative']:,}"
        ),
        (
            "False positives: "
            f"{metrics['false_positive']:,}"
        ),
        (
            "False negatives: "
            f"{metrics['false_negative']:,}"
        ),
        (
            "True positives: "
            f"{metrics['true_positive']:,}"
        ),
        "",
        "CLASSIFICATION REPORT",
        report,
        "",
        "TOP POSITIVE RISK SIGNALS",
        coefficients.sort_values(
            "coefficient",
            ascending=False,
        )
        .head(15)[["feature", "coefficient"]]
        .to_string(index=False),
        "",
        "TOP NEGATIVE RISK SIGNALS",
        coefficients.sort_values(
            "coefficient",
            ascending=True,
        )
        .head(15)[["feature", "coefficient"]]
        .to_string(index=False),
    ]

    summary = "\n".join(metric_lines)

    SUMMARY_PATH.write_text(
        summary + "\n",
        encoding="utf-8",
    )

    print("\n" + summary)

    print("\nFiles created:")
    print(MODEL_PATH)
    print(METRICS_PATH)
    print(SUMMARY_PATH)
    print(COEFFICIENTS_PATH)
    print(FIGURES_DIR)


if __name__ == "__main__":
    main()
