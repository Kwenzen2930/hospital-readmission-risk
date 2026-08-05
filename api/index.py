"""FastAPI service for hospital readmission risk scoring."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


PROJECT_ROOT = Path(__file__).resolve().parents[1]

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

DECISION_THRESHOLD = float(
    threshold_metadata["threshold"]
)

FEATURE_ORDER = prediction_schema["feature_order"]
FEATURE_DEFINITIONS = prediction_schema["features"]


class PredictionRequest(BaseModel):
    """Input payload for a hospital encounter."""

    features: dict[str, Any] = Field(
        default_factory=dict,
        description="Hospital encounter feature values.",
    )


class PredictionResponse(BaseModel):
    """Readmission risk-scoring response."""

    model: str
    risk_score: float
    decision_threshold: float
    flagged_for_follow_up: bool
    risk_band: str
    supplied_feature_count: int
    disclaimer: str


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
        "decision_threshold": DECISION_THRESHOLD,
        "feature_count": len(FEATURE_ORDER),
    }


@app.get("/api/schema")
def get_prediction_schema() -> dict[str, Any]:
    """Return the feature definitions for the frontend form."""

    return prediction_schema


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

    if risk_score >= DECISION_THRESHOLD:
        risk_band = "elevated"
    elif risk_score >= DECISION_THRESHOLD * 0.75:
        risk_band = "moderate"
    else:
        risk_band = "lower"

    if not np.isfinite(risk_score):
        raise HTTPException(
            status_code=500,
            detail="The model returned an invalid score.",
        )

    return PredictionResponse(
        model=threshold_metadata["model"],
        risk_score=round(risk_score, 4),
        decision_threshold=round(
            DECISION_THRESHOLD,
            4,
        ),
        flagged_for_follow_up=flagged,
        risk_band=risk_band,
        supplied_feature_count=len(request.features),
        disclaimer=(
            "Research portfolio demonstration only. "
            "Not calibrated or validated for clinical use."
        ),
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
