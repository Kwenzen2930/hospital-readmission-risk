"""Compare readmission models using patient-safe validation."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import (
    OneHotEncoder,
    OrdinalEncoder,
    StandardScaler,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]

TRAIN_PATH = PROJECT_ROOT / "data" / "processed" / "train.csv"
TEST_PATH = PROJECT_ROOT / "data" / "processed" / "test.csv"
METADATA_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "feature_metadata.json"
)

MODEL_PATH = PROJECT_ROOT / "models" / "best_readmission_model.joblib"
THRESHOLD_PATH = PROJECT_ROOT / "models" / "decision_threshold.json"

COMPARISON_PATH = PROJECT_ROOT / "reports" / "model_comparison.csv"
SUMMARY_PATH = (
    PROJECT_ROOT
    / "reports"
    / "model_comparison_summary.txt"
)


def load_data() -> tuple[
    pd.DataFrame,
    pd.Series,
    pd.Series,
    pd.DataFrame,
    pd.Series,
    list[str],
    list[str],
]:
    """Load prepared train/test data and metadata."""

    train_data = pd.read_csv(TRAIN_PATH, low_memory=False)
    test_data = pd.read_csv(TEST_PATH, low_memory=False)

    metadata = json.loads(
        METADATA_PATH.read_text(encoding="utf-8")
    )

    target = metadata["target"]
    group_column = metadata["group_column"]
    numeric_features = metadata["numeric_features"]
    categorical_features = metadata["categorical_features"]

    feature_columns = numeric_features + categorical_features

    x_train = train_data[feature_columns].copy()
    y_train = train_data[target].astype(int)
    groups = train_data[group_column]

    x_test = test_data[feature_columns].copy()
    y_test = test_data[target].astype(int)

    return (
        x_train,
        y_train,
        groups,
        x_test,
        y_test,
        numeric_features,
        categorical_features,
    )


def build_logistic_model(
    numeric_features: list[str],
    categorical_features: list[str],
) -> Pipeline:
    """Build the class-balanced Logistic Regression pipeline."""

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
        ]
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


def build_gradient_boosting_model(
    numeric_features: list[str],
    categorical_features: list[str],
) -> Pipeline:
    """Build a gradient-boosting pipeline with ordinal categories."""

    numeric_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="median"),
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
                OrdinalEncoder(
                    handle_unknown="use_encoded_value",
                    unknown_value=-1,
                    encoded_missing_value=-1,
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
        ]
    )

    categorical_mask = (
        [False] * len(numeric_features)
        + [True] * len(categorical_features)
    )

    classifier = HistGradientBoostingClassifier(
        learning_rate=0.08,
        max_iter=250,
        max_leaf_nodes=31,
        min_samples_leaf=40,
        l2_regularization=1.0,
        class_weight="balanced",
        categorical_features=categorical_mask,
        early_stopping=False,
        random_state=42,
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ]
    )


def find_f2_threshold(
    target: pd.Series,
    probabilities: np.ndarray,
) -> tuple[float, float]:
    """Select the threshold that maximizes the F2 score."""

    precision, recall, thresholds = precision_recall_curve(
        target,
        probabilities,
    )

    precision = precision[:-1]
    recall = recall[:-1]

    denominator = (4 * precision) + recall

    f2_scores = np.divide(
        5 * precision * recall,
        denominator,
        out=np.zeros_like(denominator),
        where=denominator != 0,
    )

    best_index = int(np.argmax(f2_scores))

    return (
        float(thresholds[best_index]),
        float(f2_scores[best_index]),
    )


def calculate_metrics(
    target: pd.Series,
    probabilities: np.ndarray,
    threshold: float,
) -> dict[str, float | int]:
    """Calculate threshold-dependent and ranking metrics."""

    predictions = (probabilities >= threshold).astype(int)

    true_negative, false_positive, false_negative, true_positive = (
        confusion_matrix(
            target,
            predictions,
            labels=[0, 1],
        ).ravel()
    )

    return {
        "threshold": threshold,
        "accuracy": float(
            accuracy_score(target, predictions)
        ),
        "balanced_accuracy": float(
            balanced_accuracy_score(target, predictions)
        ),
        "precision": float(
            precision_score(
                target,
                predictions,
                zero_division=0,
            )
        ),
        "recall": float(
            recall_score(
                target,
                predictions,
                zero_division=0,
            )
        ),
        "f1_score": float(
            f1_score(
                target,
                predictions,
                zero_division=0,
            )
        ),
        "roc_auc": float(
            roc_auc_score(target, probabilities)
        ),
        "average_precision": float(
            average_precision_score(
                target,
                probabilities,
            )
        ),
        "true_negative": int(true_negative),
        "false_positive": int(false_positive),
        "false_negative": int(false_negative),
        "true_positive": int(true_positive),
    }


def main() -> None:
    """Train, compare, select, and save the best model."""

    (
        x_train,
        y_train,
        groups,
        x_test,
        y_test,
        numeric_features,
        categorical_features,
    ) = load_data()

    splitter = StratifiedGroupKFold(
        n_splits=5,
        shuffle=True,
        random_state=123,
    )

    fit_indices, validation_indices = next(
        splitter.split(
            x_train,
            y_train,
            groups=groups,
        )
    )

    x_fit = x_train.iloc[fit_indices]
    y_fit = y_train.iloc[fit_indices]

    x_validation = x_train.iloc[validation_indices]
    y_validation = y_train.iloc[validation_indices]

    builders: dict[str, Callable[[], Pipeline]] = {
        "logistic_regression": lambda: build_logistic_model(
            numeric_features,
            categorical_features,
        ),
        "hist_gradient_boosting": (
            lambda: build_gradient_boosting_model(
                numeric_features,
                categorical_features,
            )
        ),
    }

    comparison_rows: list[dict[str, Any]] = []
    final_models: dict[str, Pipeline] = {}
    thresholds: dict[str, float] = {}

    print("Model comparison")
    print("=" * 50)
    print(f"Model fitting rows: {len(x_fit):,}")
    print(f"Validation rows: {len(x_validation):,}")
    print(f"Final test rows: {len(x_test):,}")

    for model_name, builder in builders.items():
        print(f"\nTraining validation model: {model_name}")

        validation_model = builder()
        validation_model.fit(x_fit, y_fit)

        validation_probabilities = (
            validation_model.predict_proba(x_validation)[:, 1]
        )

        threshold, validation_f2 = find_f2_threshold(
            y_validation,
            validation_probabilities,
        )

        validation_metrics = calculate_metrics(
            y_validation,
            validation_probabilities,
            threshold,
        )

        print(f"Selected threshold: {threshold:.4f}")
        print(
            "Validation ROC-AUC: "
            f"{validation_metrics['roc_auc']:.4f}"
        )
        print(
            "Validation average precision: "
            f"{validation_metrics['average_precision']:.4f}"
        )
        print(
            f"Validation recall: "
            f"{validation_metrics['recall']:.4f}"
        )

        print(f"Refitting {model_name} on full training data...")

        final_model = builder()
        final_model.fit(x_train, y_train)

        test_probabilities = final_model.predict_proba(x_test)[:, 1]

        test_metrics = calculate_metrics(
            y_test,
            test_probabilities,
            threshold,
        )

        comparison_rows.append(
            {
                "model": model_name,
                "validation_f2": validation_f2,
                "validation_roc_auc": validation_metrics["roc_auc"],
                "validation_average_precision": (
                    validation_metrics["average_precision"]
                ),
                "decision_threshold": threshold,
                "test_accuracy": test_metrics["accuracy"],
                "test_balanced_accuracy": (
                    test_metrics["balanced_accuracy"]
                ),
                "test_precision": test_metrics["precision"],
                "test_recall": test_metrics["recall"],
                "test_f1_score": test_metrics["f1_score"],
                "test_roc_auc": test_metrics["roc_auc"],
                "test_average_precision": (
                    test_metrics["average_precision"]
                ),
                "test_true_negative": (
                    test_metrics["true_negative"]
                ),
                "test_false_positive": (
                    test_metrics["false_positive"]
                ),
                "test_false_negative": (
                    test_metrics["false_negative"]
                ),
                "test_true_positive": (
                    test_metrics["true_positive"]
                ),
            }
        )

        final_models[model_name] = final_model
        thresholds[model_name] = threshold

    comparison = pd.DataFrame(comparison_rows)

    comparison = comparison.sort_values(
        "validation_average_precision",
        ascending=False,
    ).reset_index(drop=True)

    best_model_name = str(comparison.iloc[0]["model"])
    best_model = final_models[best_model_name]
    best_threshold = thresholds[best_model_name]

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(best_model, MODEL_PATH)

    threshold_metadata = {
        "model": best_model_name,
        "threshold": best_threshold,
        "selection_metric": "validation_average_precision",
        "threshold_metric": "validation_f2",
    }

    THRESHOLD_PATH.write_text(
        json.dumps(threshold_metadata, indent=2),
        encoding="utf-8",
    )

    comparison.to_csv(COMPARISON_PATH, index=False)

    display_columns = [
        "model",
        "decision_threshold",
        "test_precision",
        "test_recall",
        "test_f1_score",
        "test_roc_auc",
        "test_average_precision",
        "test_false_positive",
        "test_false_negative",
    ]

    summary = "\n".join(
        [
            "HOSPITAL READMISSION MODEL COMPARISON",
            "=" * 50,
            "",
            comparison[display_columns].to_string(
                index=False,
                float_format=lambda value: f"{value:.4f}",
            ),
            "",
            f"Selected model: {best_model_name}",
            f"Selected threshold: {best_threshold:.4f}",
            "",
            "Model selection used validation average precision.",
            "The decision threshold was tuned using validation F2.",
            "The test set was not used for threshold selection.",
        ]
    )

    SUMMARY_PATH.write_text(
        summary + "\n",
        encoding="utf-8",
    )

    print("\n" + summary)

    print("\nFiles created:")
    print(MODEL_PATH)
    print(THRESHOLD_PATH)
    print(COMPARISON_PATH)
    print(SUMMARY_PATH)


if __name__ == "__main__":
    main()
