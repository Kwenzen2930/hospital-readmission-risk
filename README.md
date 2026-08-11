# Hospital Readmission Risk

Machine learning portfolio project that estimates the risk of a diabetes-related patient being readmitted to the hospital within 30 days.

The project includes a trained gradient boosting model, FastAPI prediction API, interactive Next.js dashboard, model evaluation, threshold analysis, calibration analysis, subgroup analysis, monitoring, batch prediction, and model registry information.

## Live Demo

**Production:** https://hospital-readmission-risk-umber.vercel.app

## Model Performance

| Metric | Result |
|---|---:|
| Test Recall | 74.0% |
| ROC-AUC | 0.658 |
| Average Precision | 0.217 |
| Precision | 14.9% |
| F1 Score | 0.247 |
| Specificity | 45.5% |
| Test Encounters | 19,867 |
| Decision Threshold | 38.5% |

The threshold was selected to prioritize recall, which means the model identifies more readmissions at the cost of more false positives.

## What the App Includes

- Individual patient risk scoring
- Risk bands: Low, Moderate, Elevated, and High
- Model-derived feature explanations
- Decision-threshold distance
- Patient encounter timeline
- CSV batch prediction for up to 1,000 encounters
- Held-out test cohort analytics
- ROC and precision-recall evaluation
- Interactive threshold simulator
- Prediction audit interface
- Prediction behavior monitoring
- Model registry and version tracking
- Demographic subgroup analysis
- Probability calibration analysis

## Dataset

This project uses the [**Diabetes 130-US Hospitals for Years 1999-2008**](https://archive.ics.uci.edu/dataset/296/diabetes%2B130-us%2Bhospitals%2Bfor%2Byears%2B1999-2008) dataset from the UCI Machine Learning Repository.

The original dataset contains:

- 101,766 hospital encounters
- 50 original columns
- 71,518 unique patients

After preprocessing:

- 99,340 encounters remained
- 79,473 encounters were used for training
- 19,867 encounters were used for testing

The train/test split was performed at the patient level so the same patient does not appear in both datasets.

## Model

The selected model is:

**HistGradientBoostingClassifier**

The active deployed model version is:

`hgb-e144fb0e6e40`

The model uses 45 processed features.

Examples include:

- Age
- Gender
- Race
- Admission type
- Discharge disposition
- Admission source
- Time in hospital
- Lab procedures
- Medication count
- Previous inpatient visits
- Previous emergency visits
- Previous outpatient visits
- Number of diagnoses
- A1C result
- Glucose result
- Insulin status

## Architecture

```text
Browser
   |
   v
Next.js Frontend
   |
   | /api/*
   v
FastAPI Backend
   |
   v
HistGradientBoosting Model
```

Both frontend and backend are deployed through Vercel Services.

## Tech Stack

**Machine Learning**
- Python
- pandas
- NumPy
- scikit-learn
- joblib

**Backend**
- FastAPI
- Python
- SQLite for local prediction audit data

**Frontend**
- Next.js
- React
- TypeScript
- Tailwind CSS

**Deployment**
- Vercel
- GitHub

## API

### Health

```text
GET /api/health
```

Returns model status, active model version, threshold, and feature count.

### Prediction

```text
POST /api/predict
```

Returns:

- model version
- risk score
- risk band
- follow-up flag
- decision threshold
- distance from threshold
- model-derived explanations

### Other Endpoints

```text
GET  /api/analytics
GET  /api/performance
GET  /api/threshold-simulation
GET  /api/audit
GET  /api/monitoring
GET  /api/model-registry
GET  /api/fairness
GET  /api/calibration
POST /api/predict/batch
```

## Run Locally

From the repository root, run:

```bash
./run.sh
```

The application starts:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:8000
```

## Important Limitations

This project is a **research and portfolio demonstration only**.

The model has not been externally validated or clinically validated.

The raw model score is not a calibrated clinical probability and should not be used for medical decision-making.

The subgroup analysis is descriptive and does not prove that the model is fair or unbiased.

Production prediction-audit storage on Vercel is ephemeral because the current implementation uses temporary serverless storage. Local audit data uses SQLite and persists locally.

## Project Goal

The goal of this project was not only to train a machine learning model, but to build a more complete ML system around it:

- reproducible preprocessing and training
- patient-level leakage prevention
- model evaluation
- API serving
- interactive frontend
- threshold analysis
- model monitoring
- model version tracking
- subgroup evaluation
- calibration analysis
- production deployment
