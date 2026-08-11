"""FastAPI service for hospital readmission risk scoring."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


PROJECT_ROOT = Path(__file__).resolve().parent

MODEL_PATH = (
    PROJECT_ROOT
    / "models"
    / "best_readmission_model.joblib"
)

THRESHOLD_PATH = (
    PROJECT_ROOT
    / "models"
    / "decision_threshold.json"
)

SCHEMA_PATH = (
    PROJECT_ROOT
    / "models"
    / "prediction_schema.json"
)

ANALYTICS_PATH = (
    PROJECT_ROOT
    / "models"
    / "dashboard_analytics.json"
)

PERFORMANCE_PATH = (
    PROJECT_ROOT
    / "models"
    / "model_performance.json"
)

THRESHOLD_SIMULATION_PATH = (
    PROJECT_ROOT
    / "models"
    / "threshold_simulation.json"
)

MODEL_REGISTRY_PATH = (
    PROJECT_ROOT
    / "models"
    / "model_registry.json"
)

FAIRNESS_PATH = (
    PROJECT_ROOT
    / "models"
    / "fairness_analysis.json"
)

CALIBRATION_PATH = (
    PROJECT_ROOT
    / "models"
    / "calibration_analysis.json"
)

IS_VERCEL = os.getenv("VERCEL") == "1"

AUDIT_STORAGE_MODE = (
    "ephemeral"
    if IS_VERCEL
    else "local"
)

AUDIT_DB_PATH = (
    Path("/tmp/prediction_audit.db")
    if IS_VERCEL
    else (
        PROJECT_ROOT
        / "data"
        / "prediction_audit.db"
    )
)


def initialize_audit_db() -> None:
    """Create the local prediction audit database."""

    AUDIT_DB_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with sqlite3.connect(AUDIT_DB_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS prediction_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                model TEXT NOT NULL,
                model_version TEXT NOT NULL,
                risk_score REAL NOT NULL,
                decision_threshold REAL NOT NULL,
                flagged_for_follow_up INTEGER NOT NULL,
                risk_band TEXT NOT NULL,
                decision_margin REAL NOT NULL,
                threshold_distance REAL NOT NULL,
                threshold_proximity TEXT NOT NULL,
                supplied_feature_count INTEGER NOT NULL
            )
            """
        )

        columns = {
            row[1]
            for row in connection.execute(
                "PRAGMA table_info(prediction_audit)"
            ).fetchall()
        }

        if "model_version" not in columns:
            connection.execute(
                """
                ALTER TABLE prediction_audit
                ADD COLUMN model_version TEXT
                """
            )

        connection.execute(
            """
            UPDATE prediction_audit
            SET model_version = ?
            WHERE model_version IS NULL
               OR model_version = ''
            """,
            (ACTIVE_MODEL_VERSION,),
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_prediction_audit_created_at
            ON prediction_audit(created_at)
            """
        )


def record_prediction_audit(
    *,
    model_name: str,
    model_version: str,
    risk_score: float,
    decision_threshold: float,
    flagged_for_follow_up: bool,
    risk_band: str,
    decision_margin: float,
    threshold_distance: float,
    threshold_proximity: str,
    supplied_feature_count: int,
) -> int:
    """Store prediction metadata without patient inputs."""

    initialize_audit_db()

    created_at = datetime.now(
        timezone.utc
    ).isoformat()

    with sqlite3.connect(AUDIT_DB_PATH) as connection:
        cursor = connection.execute(
            """
            INSERT INTO prediction_audit (
                created_at,
                model,
                model_version,
                risk_score,
                decision_threshold,
                flagged_for_follow_up,
                risk_band,
                decision_margin,
                threshold_distance,
                threshold_proximity,
                supplied_feature_count
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created_at,
                model_name,
                model_version,
                risk_score,
                decision_threshold,
                int(flagged_for_follow_up),
                risk_band,
                decision_margin,
                threshold_distance,
                threshold_proximity,
                supplied_feature_count,
            ),
        )

        return int(cursor.lastrowid)


def load_json(path: Path) -> dict[str, Any]:
    """Load and validate a required JSON file."""

    if not path.exists():
        raise RuntimeError(f"Required file not found: {path}")

    return json.loads(path.read_text(encoding="utf-8"))


if not MODEL_PATH.exists():
    raise RuntimeError(
        f"Trained model not found: {MODEL_PATH}"
    )

model = joblib.load(MODEL_PATH)
threshold_metadata = load_json(THRESHOLD_PATH)
prediction_schema = load_json(SCHEMA_PATH)
model_registry = load_json(MODEL_REGISTRY_PATH)

ACTIVE_MODEL_VERSION = model_registry[
    "active_model_version"
]

DECISION_THRESHOLD = float(
    threshold_metadata["threshold"]
)

FEATURE_ORDER = prediction_schema["feature_order"]
FEATURE_DEFINITIONS = prediction_schema["features"]

MONITORING_MIN_PREDICTIONS = 30
MONITORING_WINDOW_SIZE = 100


class PredictionRequest(BaseModel):
    """Input payload for a hospital encounter."""

    features: dict[str, Any] = Field(
        default_factory=dict,
        description="Hospital encounter feature values.",
    )


class ExplanationItem(BaseModel):
    """One model-derived feature explanation."""

    feature: str
    value: str
    direction: str
    impact: float


class PredictionResponse(BaseModel):
    """Readmission risk-scoring response."""

    model: str
    model_version: str
    risk_score: float
    decision_threshold: float
    flagged_for_follow_up: bool
    risk_band: str
    decision_margin: float
    threshold_distance: float
    threshold_proximity: str
    supplied_feature_count: int
    explanations: list[ExplanationItem]
    disclaimer: str


class BatchPredictionRequest(BaseModel):
    """Multiple hospital encounters for batch scoring."""

    rows: list[dict[str, Any]]


class BatchPredictionItem(BaseModel):
    """One batch prediction result."""

    row_number: int
    risk_score: float
    risk_band: str
    flagged_for_follow_up: bool


class BatchPredictionResponse(BaseModel):
    """Results from batch encounter scoring."""

    total_rows: int
    flagged_rows: int
    average_risk: float
    low_count: int
    moderate_count: int
    elevated_count: int
    high_count: int
    predictions: list[BatchPredictionItem]


app = FastAPI(
    title="Hospital Readmission Risk API",
    version="1.0.0",
    description=(
        "Portfolio API for estimating 30-day hospital "
        "readmission risk."
    ),
)


def convert_value(
    feature_name: str,
    value: Any,
) -> Any:
    """Convert an incoming value to its expected training type."""

    definition = FEATURE_DEFINITIONS[feature_name]

    if value is None or value == "":
        return definition["default"]

    expected_type = definition["python_type"]

    try:
        if expected_type == "integer":
            return int(value)

        if expected_type == "number":
            return float(value)

        return str(value)

    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Invalid value for '{feature_name}': {value}"
            ),
        ) from error


def create_model_frame(
    supplied_features: dict[str, Any],
) -> pd.DataFrame:
    """Create one complete model-ready encounter row."""

    unknown_features = sorted(
        set(supplied_features).difference(FEATURE_ORDER)
    )

    if unknown_features:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Unknown features supplied.",
                "unknown_features": unknown_features,
            },
        )

    row: dict[str, Any] = {}

    for feature_name in FEATURE_ORDER:
        supplied_value = supplied_features.get(
            feature_name,
            FEATURE_DEFINITIONS[feature_name]["default"],
        )

        row[feature_name] = convert_value(
            feature_name,
            supplied_value,
        )

    return pd.DataFrame(
        [row],
        columns=FEATURE_ORDER,
    )


def build_explanations(
    frame: pd.DataFrame,
    supplied_features: dict[str, Any],
    risk_score: float,
) -> list[ExplanationItem]:
    """Estimate local feature effects by resetting inputs to defaults."""

    explanations: list[ExplanationItem] = []

    for feature_name in supplied_features:
        if feature_name not in FEATURE_DEFINITIONS:
            continue

        default_value = FEATURE_DEFINITIONS[feature_name]["default"]
        current_value = frame.iloc[0][feature_name]

        if str(current_value) == str(default_value):
            continue

        perturbed_frame = frame.copy()

        perturbed_frame.at[0, feature_name] = convert_value(
            feature_name,
            default_value,
        )

        try:
            perturbed_risk = float(
                model.predict_proba(perturbed_frame)[0, 1]
            )
        except Exception:
            continue

        delta = risk_score - perturbed_risk

        if abs(delta) < 0.0001:
            continue

        explanations.append(
            ExplanationItem(
                feature=feature_name,
                value=str(current_value),
                direction=(
                    "increases_risk"
                    if delta > 0
                    else "decreases_risk"
                ),
                impact=round(abs(delta), 4),
            )
        )

    explanations.sort(
        key=lambda item: item.impact,
        reverse=True,
    )

    return explanations[:5]


@app.get("/api")
def api_root() -> dict[str, str]:
    """Return basic service information."""

    return {
        "service": "Hospital Readmission Risk API",
        "status": "online",
        "documentation": "/docs",
    }


@app.get("/api/health")
def health_check() -> dict[str, Any]:
    """Return model and API status."""

    return {
        "status": "healthy",
        "model_loaded": True,
        "model": threshold_metadata["model"],
        "model_version": ACTIVE_MODEL_VERSION,
        "decision_threshold": DECISION_THRESHOLD,
        "feature_count": len(FEATURE_ORDER),
    }


@app.get("/api/model-registry")
def get_model_registry() -> dict[str, Any]:
    """Return model registry and active version metadata."""

    return model_registry


@app.get("/api/schema")
def get_prediction_schema() -> dict[str, Any]:
    """Return the feature definitions for the frontend form."""

    return prediction_schema


@app.get("/api/calibration")
def get_calibration_analysis() -> dict[str, Any]:
    """Return held-out probability calibration analysis."""

    if not CALIBRATION_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail=(
                "Calibration analysis has not been generated."
            ),
        )

    return load_json(CALIBRATION_PATH)


@app.get("/api/fairness")
def get_fairness_analysis() -> dict[str, Any]:
    """Return held-out subgroup evaluation metrics."""

    if not FAIRNESS_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail=(
                "Subgroup analysis has not been generated."
            ),
        )

    return load_json(FAIRNESS_PATH)


@app.get("/api/analytics")
def get_dashboard_analytics() -> dict[str, Any]:
    """Return precomputed analytics for the dashboard."""

    if not ANALYTICS_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="Dashboard analytics have not been generated.",
        )

    return load_json(ANALYTICS_PATH)


@app.get("/api/performance")
def get_model_performance() -> dict[str, Any]:
    """Return held-out model evaluation metrics."""

    if not PERFORMANCE_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="Model performance data has not been generated.",
        )

    return load_json(PERFORMANCE_PATH)


@app.get("/api/threshold-simulation")
def get_threshold_simulation() -> dict[str, Any]:
    """Return precomputed threshold trade-off data."""

    if not THRESHOLD_SIMULATION_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="Threshold simulation data has not been generated.",
        )

    return load_json(THRESHOLD_SIMULATION_PATH)


@app.get("/api/audit")
def get_prediction_audit() -> dict[str, Any]:
    """Return privacy-safe prediction audit activity."""

    initialize_audit_db()

    with sqlite3.connect(AUDIT_DB_PATH) as connection:
        connection.row_factory = sqlite3.Row

        summary = connection.execute(
            """
            SELECT
                COUNT(*) AS total_predictions,
                SUM(flagged_for_follow_up) AS flagged_predictions,
                AVG(risk_score) AS average_risk
            FROM prediction_audit
            """
        ).fetchone()

        risk_rows = connection.execute(
            """
            SELECT
                risk_band,
                COUNT(*) AS count
            FROM prediction_audit
            GROUP BY risk_band
            """
        ).fetchall()

        proximity_rows = connection.execute(
            """
            SELECT
                threshold_proximity,
                COUNT(*) AS count
            FROM prediction_audit
            GROUP BY threshold_proximity
            """
        ).fetchall()

        recent_rows = connection.execute(
            """
            SELECT
                id,
                created_at,
                model,
                model_version,
                risk_score,
                decision_threshold,
                flagged_for_follow_up,
                risk_band,
                decision_margin,
                threshold_distance,
                threshold_proximity,
                supplied_feature_count
            FROM prediction_audit
            ORDER BY id DESC
            LIMIT 20
            """
        ).fetchall()

    total_predictions = int(
        summary["total_predictions"] or 0
    )

    flagged_predictions = int(
        summary["flagged_predictions"] or 0
    )

    average_risk = float(
        summary["average_risk"] or 0
    )

    return {
        "storage_mode": AUDIT_STORAGE_MODE,
        "persistent_storage": not IS_VERCEL,
        "active_model_version": ACTIVE_MODEL_VERSION,
        "total_predictions": total_predictions,
        "flagged_predictions": flagged_predictions,
        "flagged_rate": (
            flagged_predictions / total_predictions
            if total_predictions
            else 0
        ),
        "average_risk": average_risk,
        "risk_bands": {
            row["risk_band"]: int(row["count"])
            for row in risk_rows
        },
        "threshold_proximity": {
            row["threshold_proximity"]: int(
                row["count"]
            )
            for row in proximity_rows
        },
        "recent_predictions": [
            {
                "id": int(row["id"]),
                "created_at": row["created_at"],
                "model": row["model"],
                "model_version": row["model_version"],
                "risk_score": float(
                    row["risk_score"]
                ),
                "decision_threshold": float(
                    row["decision_threshold"]
                ),
                "flagged_for_follow_up": bool(
                    row["flagged_for_follow_up"]
                ),
                "risk_band": row["risk_band"],
                "decision_margin": float(
                    row["decision_margin"]
                ),
                "threshold_distance": float(
                    row["threshold_distance"]
                ),
                "threshold_proximity": (
                    row["threshold_proximity"]
                ),
                "supplied_feature_count": int(
                    row["supplied_feature_count"]
                ),
            }
            for row in recent_rows
        ],
    }


@app.get("/api/monitoring")
def get_model_monitoring() -> dict[str, Any]:
    """Compare recent prediction activity with the reference cohort."""

    initialize_audit_db()

    if not ANALYTICS_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="Reference analytics have not been generated.",
        )

    reference = load_json(ANALYTICS_PATH)

    with sqlite3.connect(AUDIT_DB_PATH) as connection:
        connection.row_factory = sqlite3.Row

        recent_rows = connection.execute(
            """
            SELECT
                risk_score,
                flagged_for_follow_up,
                risk_band,
                threshold_proximity
            FROM prediction_audit
            WHERE model_version = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (
                ACTIVE_MODEL_VERSION,
                MONITORING_WINDOW_SIZE,
            ),
        ).fetchall()

    sample_size = len(recent_rows)

    reference_total = int(
        reference["test_encounters"]
    )

    reference_average_risk = float(
        reference["average_predicted_risk"]
    )

    reference_flagged_rate = float(
        reference["flagged_rate"]
    )

    reference_band_counts = (
        reference["risk_distribution"]
    )

    reference_band_shares = {
        band: (
            float(reference_band_counts.get(band, 0))
            / reference_total
        )
        for band in (
            "low",
            "moderate",
            "elevated",
            "high",
        )
    }

    if sample_size:
        current_average_risk = (
            sum(
                float(row["risk_score"])
                for row in recent_rows
            )
            / sample_size
        )

        current_flagged_rate = (
            sum(
                int(row["flagged_for_follow_up"])
                for row in recent_rows
            )
            / sample_size
        )
    else:
        current_average_risk = 0.0
        current_flagged_rate = 0.0

    current_band_counts = {
        "low": 0,
        "moderate": 0,
        "elevated": 0,
        "high": 0,
    }

    current_proximity_counts = {
        "near": 0,
        "moderate": 0,
        "far": 0,
    }

    for row in recent_rows:
        band = row["risk_band"]

        if band in current_band_counts:
            current_band_counts[band] += 1

        proximity = row["threshold_proximity"]

        if proximity in current_proximity_counts:
            current_proximity_counts[
                proximity
            ] += 1

    current_band_shares = {
        band: (
            count / sample_size
            if sample_size
            else 0.0
        )
        for band, count
        in current_band_counts.items()
    }

    average_risk_shift = (
        current_average_risk
        - reference_average_risk
    )

    flagged_rate_shift = (
        current_flagged_rate
        - reference_flagged_rate
    )

    band_shift = {
        band: (
            current_band_shares[band]
            - reference_band_shares[band]
        )
        for band in current_band_shares
    }

    max_band_shift = max(
        (
            abs(value)
            for value in band_shift.values()
        ),
        default=0.0,
    )

    if sample_size < MONITORING_MIN_PREDICTIONS:
        status = "insufficient_data"
        status_message = (
            "More logged predictions are required "
            "before drift signals are evaluated."
        )
        signals = []
    else:
        signals = []

        average_risk_abs = abs(
            average_risk_shift
        )

        flagged_rate_abs = abs(
            flagged_rate_shift
        )

        if average_risk_abs >= 0.10:
            signals.append({
                "metric": "average_risk",
                "severity": "alert",
                "shift": average_risk_shift,
            })
        elif average_risk_abs >= 0.05:
            signals.append({
                "metric": "average_risk",
                "severity": "warning",
                "shift": average_risk_shift,
            })

        if flagged_rate_abs >= 0.15:
            signals.append({
                "metric": "flagged_rate",
                "severity": "alert",
                "shift": flagged_rate_shift,
            })
        elif flagged_rate_abs >= 0.08:
            signals.append({
                "metric": "flagged_rate",
                "severity": "warning",
                "shift": flagged_rate_shift,
            })

        if max_band_shift >= 0.15:
            signals.append({
                "metric": "risk_band_distribution",
                "severity": "alert",
                "shift": max_band_shift,
            })
        elif max_band_shift >= 0.08:
            signals.append({
                "metric": "risk_band_distribution",
                "severity": "warning",
                "shift": max_band_shift,
            })

        if any(
            signal["severity"] == "alert"
            for signal in signals
        ):
            status = "alert"
            status_message = (
                "Large distribution changes are present "
                "relative to the reference cohort."
            )
        elif signals:
            status = "warning"
            status_message = (
                "Some prediction behavior has shifted "
                "relative to the reference cohort."
            )
        else:
            status = "stable"
            status_message = (
                "No monitoring thresholds are currently exceeded."
            )

    return {
        "status": status,
        "status_message": status_message,
        "sample_size": sample_size,
        "minimum_sample_size": (
            MONITORING_MIN_PREDICTIONS
        ),
        "window_size": MONITORING_WINDOW_SIZE,
        "reference": {
            "test_encounters": reference_total,
            "average_risk": reference_average_risk,
            "flagged_rate": reference_flagged_rate,
            "risk_band_shares": reference_band_shares,
        },
        "current": {
            "average_risk": current_average_risk,
            "flagged_rate": current_flagged_rate,
            "risk_band_counts": current_band_counts,
            "risk_band_shares": current_band_shares,
            "threshold_proximity_counts": (
                current_proximity_counts
            ),
        },
        "shifts": {
            "average_risk": average_risk_shift,
            "flagged_rate": flagged_rate_shift,
            "risk_band_shares": band_shift,
            "maximum_band_shift": max_band_shift,
        },
        "signals": signals,
        "method_note": (
            "Monitoring uses operational heuristic thresholds "
            "on prediction-output distributions. It does not "
            "measure clinical performance or prove data drift."
        ),
    }


@app.post(
    "/api/predict",
    response_model=PredictionResponse,
)
def predict_readmission(
    request: PredictionRequest,
) -> PredictionResponse:
    """Score one hospital encounter."""

    frame = create_model_frame(request.features)

    try:
        risk_score = float(
            model.predict_proba(frame)[0, 1]
        )
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="The model could not score this encounter.",
        ) from error

    flagged = risk_score >= DECISION_THRESHOLD

    if risk_score >= 0.60:
        risk_band = "high"
    elif risk_score >= DECISION_THRESHOLD:
        risk_band = "elevated"
    elif risk_score >= 0.20:
        risk_band = "moderate"
    else:
        risk_band = "low"

    if not np.isfinite(risk_score):
        raise HTTPException(
            status_code=500,
            detail="The model returned an invalid score.",
        )

    decision_margin = (
        risk_score - DECISION_THRESHOLD
    )

    threshold_distance = abs(
        decision_margin
    )

    if threshold_distance <= 0.05:
        threshold_proximity = "near"
    elif threshold_distance <= 0.15:
        threshold_proximity = "moderate"
    else:
        threshold_proximity = "far"

    explanations = build_explanations(
        frame,
        request.features,
        risk_score,
    )

    audit_id = record_prediction_audit(
        model_name=threshold_metadata["model"],
        model_version=ACTIVE_MODEL_VERSION,
        risk_score=risk_score,
        decision_threshold=DECISION_THRESHOLD,
        flagged_for_follow_up=flagged,
        risk_band=risk_band,
        decision_margin=decision_margin,
        threshold_distance=threshold_distance,
        threshold_proximity=threshold_proximity,
        supplied_feature_count=len(request.features),
    )

    return PredictionResponse(
        model=threshold_metadata["model"],
        model_version=ACTIVE_MODEL_VERSION,
        risk_score=round(risk_score, 4),
        decision_threshold=round(
            DECISION_THRESHOLD,
            4,
        ),
        flagged_for_follow_up=flagged,
        risk_band=risk_band,
        decision_margin=round(
            decision_margin,
            4,
        ),
        threshold_distance=round(
            threshold_distance,
            4,
        ),
        threshold_proximity=threshold_proximity,
        supplied_feature_count=len(request.features),
        explanations=explanations,
        disclaimer=(
            "Research portfolio demonstration only. "
            "Not calibrated or validated for clinical use."
        ),
    )


@app.post(
    "/api/predict/batch",
    response_model=BatchPredictionResponse,
)
def predict_batch(
    request: BatchPredictionRequest,
) -> BatchPredictionResponse:
    """Score multiple hospital encounters."""

    if not request.rows:
        raise HTTPException(
            status_code=422,
            detail="Batch must contain at least one row.",
        )

    if len(request.rows) > 1000:
        raise HTTPException(
            status_code=422,
            detail="Batch is limited to 1,000 rows.",
        )

    predictions: list[BatchPredictionItem] = []

    band_counts = {
        "low": 0,
        "moderate": 0,
        "elevated": 0,
        "high": 0,
    }

    total_risk = 0.0
    flagged_rows = 0

    for index, features in enumerate(request.rows, start=1):
        prediction = predict_readmission(
            PredictionRequest(features=features)
        )

        predictions.append(
            BatchPredictionItem(
                row_number=index,
                risk_score=prediction.risk_score,
                risk_band=prediction.risk_band,
                flagged_for_follow_up=(
                    prediction.flagged_for_follow_up
                ),
            )
        )

        total_risk += prediction.risk_score

        band_counts[prediction.risk_band] += 1

        if prediction.flagged_for_follow_up:
            flagged_rows += 1

    return BatchPredictionResponse(
        total_rows=len(predictions),
        flagged_rows=flagged_rows,
        average_risk=round(
            total_risk / len(predictions),
            4,
        ),
        low_count=band_counts["low"],
        moderate_count=band_counts["moderate"],
        elevated_count=band_counts["elevated"],
        high_count=band_counts["high"],
        predictions=predictions,
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
