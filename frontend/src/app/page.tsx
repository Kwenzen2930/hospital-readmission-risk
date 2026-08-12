"use client";

import ThresholdSimulator from "../components/ThresholdSimulator";
import AuditActivity from "../components/AuditActivity";
import ModelMonitoring from "../components/ModelMonitoring";
import ModelRegistry from "../components/ModelRegistry";
import SubgroupAnalysis from "../components/SubgroupAnalysis";
import CalibrationAnalysis from "../components/CalibrationAnalysis";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

type FormState = {
  age: string;
  gender: string;
  race: string;
  admissionType: string;
  dischargeDisposition: string;
  admissionSource: string;
  timeInHospital: number;
  labProcedures: number;
  procedures: number;
  medications: number;
  outpatientVisits: number;
  emergencyVisits: number;
  inpatientVisits: number;
  diagnoses: number;
  a1cResult: string;
  glucoseResult: string;
  insulin: string;
  medicationChanged: string;
  diabetesMedication: string;
};

type ExplanationItem = {
  feature: string;
  value: string;
  direction: "increases_risk" | "decreases_risk";
  impact: number;
};

type PredictionResult = {
  model: string;
  risk_score: number;
  decision_threshold: number;
  flagged_for_follow_up: boolean;
  risk_band: string;
  decision_margin: number;
  threshold_distance: number;
  threshold_proximity: string;
  supplied_feature_count: number;
  explanations: ExplanationItem[];
  disclaimer: string;
};

type BatchPredictionItem = {
  row_number: number;
  risk_score: number;
  risk_band: string;
  flagged_for_follow_up: boolean;
};

type BatchPredictionResponse = {
  total_rows: number;
  flagged_rows: number;
  average_risk: number;
  low_count: number;
  moderate_count: number;
  elevated_count: number;
  high_count: number;
  predictions: BatchPredictionItem[];
};

type DashboardAnalytics = {
  test_encounters: number;
  actual_readmissions: number;
  actual_readmission_rate: number;
  average_predicted_risk: number;
  flagged_count: number;
  flagged_rate: number;
  risk_distribution: {
    low: number;
    moderate: number;
    elevated: number;
    high: number;
  };
  age_groups: {
    age: string;
    encounters: number;
    average_risk: number;
    actual_readmission: number;
  }[];
  admission_types: {
    admission_type_id: number;
    encounters: number;
    average_risk: number;
  }[];
  length_of_stay: {
    days: number;
    encounters: number;
    average_risk: number;
  }[];
};

type ModelPerformance = {
  model: string;
  test_encounters: number;
  decision_threshold: number;
  positive_rate: number;
  predicted_positive_rate: number;
  metrics: {
    roc_auc: number;
    average_precision: number;
    precision: number;
    recall: number;
    f1: number;
    specificity: number;
    accuracy: number;
  };
  confusion_matrix: {
    true_negative: number;
    false_positive: number;
    false_negative: number;
    true_positive: number;
  };
  roc_curve: {
    x: number;
    y: number;
  }[];
  precision_recall_curve: {
    x: number;
    y: number;
  }[];
};

type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
};

type NumberFieldProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
};

const initialForm: FormState = {
  age: "[60-70)",
  gender: "Female",
  race: "Caucasian",
  admissionType: "1",
  dischargeDisposition: "1",
  admissionSource: "7",
  timeInHospital: 5,
  labProcedures: 45,
  procedures: 1,
  medications: 16,
  outpatientVisits: 0,
  emergencyVisits: 0,
  inpatientVisits: 1,
  diagnoses: 9,
  a1cResult: "None",
  glucoseResult: "None",
  insulin: "Steady",
  medicationChanged: "No",
  diabetesMedication: "Yes",
};

const ageOptions = [
  { value: "[0-10)", label: "0–9 years" },
  { value: "[10-20)", label: "10–19 years" },
  { value: "[20-30)", label: "20–29 years" },
  { value: "[30-40)", label: "30–39 years" },
  { value: "[40-50)", label: "40–49 years" },
  { value: "[50-60)", label: "50–59 years" },
  { value: "[60-70)", label: "60–69 years" },
  { value: "[70-80)", label: "70–79 years" },
  { value: "[80-90)", label: "80–89 years" },
  { value: "[90-100)", label: "90–99 years" },
] as const;

const admissionTypes = [
  { value: "1", label: "Emergency" },
  { value: "2", label: "Urgent" },
  { value: "3", label: "Elective" },
  { value: "5", label: "Not available" },
  { value: "6", label: "Unknown" },
  { value: "7", label: "Trauma center" },
  { value: "8", label: "Newborn" },
] as const;

const dischargeOptions = [
  { value: "1", label: "Discharged home" },
  { value: "2", label: "Transferred to hospital" },
  { value: "3", label: "Skilled nursing facility" },
  { value: "6", label: "Home with health service" },
  { value: "18", label: "Unknown" },
] as const;

const sourceOptions = [
  { value: "1", label: "Physician referral" },
  { value: "2", label: "Clinic referral" },
  { value: "4", label: "Transfer from hospital" },
  { value: "7", label: "Emergency room" },
  { value: "9", label: "Information unavailable" },
] as const;

function SelectField({
  label,
  value,
  options,
  onChange,
}: SelectFieldProps) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  min = 0,
  max = 100,
  onChange,
}: NumberFieldProps) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />
    </label>
  );
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  cells.push(current.trim());

  return cells;
}

function parseCsv(text: string) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error(
      "CSV must contain a header row and at least one patient row.",
    );
  }

  const headers = parseCsvLine(lines[0]).map(
    (header, index) =>
      index === 0
        ? header.replace(/^\uFEFF/, "").trim()
        : header.trim(),
  );

  if (headers.some((header) => !header)) {
    throw new Error("CSV contains an empty column name.");
  }

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);

    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}

function downloadTextFile(
  filename: string,
  content: string,
  type = "text/csv;charset=utf-8",
) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function downloadBatchTemplate() {
  const headers = [
    "age",
    "gender",
    "race",
    "admission_type_id",
    "discharge_disposition_id",
    "admission_source_id",
    "time_in_hospital",
    "num_lab_procedures",
    "num_procedures",
    "num_medications",
    "number_outpatient",
    "number_emergency",
    "number_inpatient",
    "number_diagnoses",
    "a1_cresult",
    "max_glu_serum",
    "insulin",
    "change",
    "diabetes_med",
  ];

  const example = [
    "[70-80)",
    "Female",
    "Caucasian",
    "1",
    "1",
    "7",
    "8",
    "55",
    "1",
    "24",
    "1",
    "2",
    "3",
    "9",
    ">8",
    ">200",
    "Steady",
    "Ch",
    "Yes",
  ];

  downloadTextFile(
    "readmission_batch_template.csv",
    `${headers.join(",")}\n${example.join(",")}\n`,
  );
}

function downloadBatchResults(
  result: BatchPredictionResponse,
) {
  const headers = [
    "row_number",
    "risk_score",
    "risk_percentage",
    "risk_band",
    "flagged_for_follow_up",
  ];

  const rows = result.predictions.map((prediction) =>
    [
      prediction.row_number,
      prediction.risk_score,
      (prediction.risk_score * 100).toFixed(1),
      prediction.risk_band,
      prediction.flagged_for_follow_up,
    ].join(","),
  );

  downloadTextFile(
    "readmission_batch_predictions.csv",
    [headers.join(","), ...rows].join("\n") + "\n",
  );
}

function getThresholdProximityLabel(
  proximity: string,
) {
  switch (proximity) {
    case "near":
      return "Near threshold";
    case "moderate":
      return "Moderately far";
    default:
      return "Far from threshold";
  }
}

function getThresholdProximityClass(
  proximity: string,
) {
  switch (proximity) {
    case "near":
      return "rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300";
    case "moderate":
      return "rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-300";
    default:
      return "rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300";
  }
}

function getRiskBandLabel(band: string) {
  switch (band) {
    case "high":
      return "High risk";
    case "elevated":
      return "Elevated risk";
    case "moderate":
      return "Moderate risk";
    default:
      return "Low risk";
  }
}

function getRiskBandBadgeClass(band: string) {
  switch (band) {
    case "high":
      return "rounded-full bg-red-500/15 px-3 py-1 text-sm font-semibold text-red-300";
    case "elevated":
      return "rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-300";
    case "moderate":
      return "rounded-full bg-sky-500/15 px-3 py-1 text-sm font-semibold text-sky-300";
    default:
      return "rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-300";
  }
}

function getRiskBarClass(band: string) {
  switch (band) {
    case "high":
      return "h-full rounded-full bg-red-500 transition-all";
    case "elevated":
      return "h-full rounded-full bg-amber-400 transition-all";
    case "moderate":
      return "h-full rounded-full bg-sky-400 transition-all";
    default:
      return "h-full rounded-full bg-emerald-400 transition-all";
  }
}

function getWorkflowGuidance(band: string) {
  switch (band) {
    case "high":
      return {
        title: "Priority review pathway",
        summary:
          "This score is above the high-risk presentation band.",
        steps: [
          "Review recent inpatient and emergency utilization",
          "Review discharge and follow-up planning",
          "Review medication burden and recent changes",
          "Prioritize post-discharge follow-up workflow",
        ],
      };

    case "elevated":
      return {
        title: "Enhanced review pathway",
        summary:
          "This score is above the model decision threshold.",
        steps: [
          "Review previous hospital utilization",
          "Review discharge planning",
          "Check medication and diagnosis complexity",
          "Consider additional follow-up workflow",
        ],
      };

    case "moderate":
      return {
        title: "Routine review pathway",
        summary:
          "This score is below the model threshold but above the low-risk band.",
        steps: [
          "Review encounter history",
          "Check recent healthcare utilization",
          "Continue standard follow-up workflow",
        ],
      };

    default:
      return {
        title: "Standard follow-up pathway",
        summary:
          "This score falls within the low-risk presentation band.",
        steps: [
          "Continue standard discharge workflow",
          "Maintain routine follow-up",
        ],
      };
  }
}

function getPatientTimeline(form: FormState) {
  const timeline: {
    title: string;
    detail: string;
    current?: boolean;
  }[] = [];

  if (form.outpatientVisits > 0) {
    timeline.push({
      title: "Prior outpatient care",
      detail: `${form.outpatientVisits} recorded ${
        form.outpatientVisits === 1 ? "visit" : "visits"
      }`,
    });
  }

  if (form.emergencyVisits > 0) {
    timeline.push({
      title: "Prior emergency care",
      detail: `${form.emergencyVisits} recorded ${
        form.emergencyVisits === 1 ? "visit" : "visits"
      }`,
    });
  }

  if (form.inpatientVisits > 0) {
    timeline.push({
      title: "Prior inpatient admissions",
      detail: `${form.inpatientVisits} recorded ${
        form.inpatientVisits === 1 ? "admission" : "admissions"
      }`,
    });
  }

  if (
    form.outpatientVisits === 0 &&
    form.emergencyVisits === 0 &&
    form.inpatientVisits === 0
  ) {
    timeline.push({
      title: "No prior utilization recorded",
      detail: "No previous outpatient, emergency, or inpatient visits entered",
    });
  }

  const admissionLabel =
    admissionTypes.find(
      (option) => option.value === form.admissionType,
    )?.label ?? "Hospital admission";

  timeline.push({
    title: "Current encounter",
    detail: `${admissionLabel} · ${form.timeInHospital} ${
      form.timeInHospital === 1 ? "day" : "days"
    } in hospital`,
    current: true,
  });

  return timeline;
}

function AnalyticsBarRow({
  label,
  value,
  maxValue,
  displayValue,
}: {
  label: string;
  value: number;
  maxValue: number;
  displayValue: string;
}) {
  const width =
    maxValue > 0
      ? Math.max(2, Math.min(100, (value / maxValue) * 100))
      : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="font-medium text-white">
          {displayValue}
        </span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function ComparisonBarRow({
  label,
  predicted,
  actual,
}: {
  label: string;
  predicted: number;
  actual: number;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-slate-200">
          {label}
        </p>

        <p className="text-xs text-slate-500">
          Pred {(predicted * 100).toFixed(1)}%
          {" · "}
          Actual {(actual * 100).toFixed(1)}%
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider text-blue-300">
            Predicted risk
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{
                width: `${Math.min(
                  predicted * 100,
                  100,
                )}%`,
              }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider text-emerald-300">
            Actual readmission
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{
                width: `${Math.min(
                  actual * 100,
                  100,
                )}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PerformanceCurveChart({
  title,
  subtitle,
  points,
  metricLabel,
  metricValue,
  diagonal = false,
  baselineY,
}: {
  title: string;
  subtitle: string;
  points: {
    x: number;
    y: number;
  }[];
  metricLabel: string;
  metricValue: string;
  diagonal?: boolean;
  baselineY?: number;
}) {
  const width = 560;
  const height = 340;
  const paddingLeft = 52;
  const paddingRight = 24;
  const paddingTop = 28;
  const paddingBottom = 48;

  const chartWidth =
    width - paddingLeft - paddingRight;

  const chartHeight =
    height - paddingTop - paddingBottom;

  const coordinates = points
    .map((point) => {
      const x =
        paddingLeft + point.x * chartWidth;

      const y =
        paddingTop +
        (1 - point.y) * chartHeight;

      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {title}
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            {subtitle}
          </p>
        </div>

        <div className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-left sm:w-auto sm:shrink-0 sm:text-right">
          <p className="text-xs text-slate-500">
            {metricLabel}
          </p>

          <p className="mt-1 text-lg font-bold text-white">
            {metricValue}
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label={title}
        >
          {ticks.map((tick) => {
            const x =
              paddingLeft + tick * chartWidth;

            const y =
              paddingTop +
              (1 - tick) * chartHeight;

            return (
              <g key={tick}>
                <line
                  x1={paddingLeft}
                  x2={width - paddingRight}
                  y1={y}
                  y2={y}
                  className="stroke-slate-800"
                  strokeWidth="1"
                />

                <line
                  x1={x}
                  x2={x}
                  y1={paddingTop}
                  y2={height - paddingBottom}
                  className="stroke-slate-800"
                  strokeWidth="1"
                />

                <text
                  x={paddingLeft - 12}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 text-[10px]"
                >
                  {(tick * 100).toFixed(0)}%
                </text>

                <text
                  x={x}
                  y={height - paddingBottom + 22}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px]"
                >
                  {(tick * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}

          {diagonal && (
            <line
              x1={paddingLeft}
              y1={height - paddingBottom}
              x2={width - paddingRight}
              y2={paddingTop}
              className="stroke-slate-600"
              strokeWidth="1.5"
              strokeDasharray="7 7"
            />
          )}

          {baselineY !== undefined && (
            <line
              x1={paddingLeft}
              x2={width - paddingRight}
              y1={
                paddingTop +
                (1 - baselineY) * chartHeight
              }
              y2={
                paddingTop +
                (1 - baselineY) * chartHeight
              }
              className="stroke-slate-600"
              strokeWidth="1.5"
              strokeDasharray="7 7"
            />
          )}

          <polyline
            points={coordinates}
            fill="none"
            className="stroke-blue-500"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <line
            x1={paddingLeft}
            x2={width - paddingRight}
            y1={height - paddingBottom}
            y2={height - paddingBottom}
            className="stroke-slate-600"
            strokeWidth="1.5"
          />

          <line
            x1={paddingLeft}
            x2={paddingLeft}
            y1={paddingTop}
            y2={height - paddingBottom}
            className="stroke-slate-600"
            strokeWidth="1.5"
          />

          <text
            x={paddingLeft + chartWidth / 2}
            y={height - 8}
            textAnchor="middle"
            className="fill-slate-400 text-[11px]"
          >
            {diagonal
              ? "False positive rate"
              : "Recall"}
          </text>

          <text
            x="14"
            y={paddingTop + chartHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 14 ${
              paddingTop + chartHeight / 2
            })`}
            className="fill-slate-400 text-[11px]"
          >
            {diagonal
              ? "True positive rate"
              : "Precision"}
          </text>
        </svg>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <span className="h-0.5 w-5 bg-blue-500" />
        <span>Model</span>

        <span className="ml-4 h-0 w-5 border-t border-dashed border-slate-500" />
        <span>
          {diagonal
            ? "Random baseline"
            : "Positive-rate baseline"}
        </span>
      </div>
    </article>
  );
}


type DashboardSection =
  | "overview"
  | "predict"
  | "analytics"
  | "model"
  | "monitoring";

const dashboardSections: {
  id: DashboardSection;
  label: string;
  description: string;
}[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Project and model summary",
  },
  {
    id: "predict",
    label: "Predict",
    description: "Patient and batch scoring",
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Performance and thresholds",
  },
  {
    id: "model",
    label: "Model",
    description: "Registry, groups and calibration",
  },
  {
    id: "monitoring",
    label: "Monitoring",
    description: "Prediction activity and drift",
  },
];

export default function Home() {
  const [activeSection, setActiveSection] =
    useState<DashboardSection>("overview");

  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [batchResult, setBatchResult] =
    useState<BatchPredictionResponse | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [batchFileName, setBatchFileName] = useState("");
  const [analytics, setAnalytics] =
    useState<DashboardAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] =
    useState(true);
  const [analyticsError, setAnalyticsError] =
    useState("");
  const [performance, setPerformance] =
    useState<ModelPerformance | null>(null);
  const [performanceLoading, setPerformanceLoading] =
    useState(true);
  const [performanceError, setPerformanceError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      try {
        const apiBase =
          process.env.NEXT_PUBLIC_API_URL
            ?.trim()
            .replace(/\/$/, "") ?? "";

        const response = await fetch(
          `${apiBase}/api/analytics`,
        );

        if (!response.ok) {
          throw new Error(
            `Analytics API returned ${response.status}.`,
          );
        }

        const data =
          (await response.json()) as DashboardAnalytics;

        if (!cancelled) {
          setAnalytics(data);
          setAnalyticsError("");
        }
      } catch (requestError) {
        if (!cancelled) {
          setAnalyticsError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load analytics.",
          );
        }
      } finally {
        if (!cancelled) {
          setAnalyticsLoading(false);
        }
      }
    }

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPerformance() {
      try {
        const apiBase =
          process.env.NEXT_PUBLIC_API_URL
            ?.trim()
            .replace(/\/$/, "") ?? "";

        const response = await fetch(
          `${apiBase}/api/performance`,
        );

        if (!response.ok) {
          throw new Error(
            `Performance API returned ${response.status}.`,
          );
        }

        const data =
          (await response.json()) as ModelPerformance;

        if (!cancelled) {
          setPerformance(data);
          setPerformanceError("");
        }
      } catch (requestError) {
        if (!cancelled) {
          setPerformanceError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load model performance.",
          );
        }
      } finally {
        if (!cancelled) {
          setPerformanceLoading(false);
        }
      }
    }

    void loadPerformance();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleBatchFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setBatchLoading(true);
    setBatchError("");
    setBatchResult(null);
    setBatchFileName(file.name);

    try {
      const parsedRows = parseCsv(await file.text());

      if (parsedRows.length > 1000) {
        throw new Error(
          "CSV contains more than 1,000 rows. Split it into smaller batches.",
        );
      }

      const rows = parsedRows.map((row) => {
        const prepared: Record<string, string | number> = {
          ...row,
        };

        const outpatient = Number(
          row.number_outpatient || 0,
        );
        const emergency = Number(
          row.number_emergency || 0,
        );
        const inpatient = Number(
          row.number_inpatient || 0,
        );

        const utilization =
          outpatient + emergency + inpatient;

        if (!("service_utilization" in row)) {
          prepared.service_utilization = utilization;
        }

        if (!("had_prior_utilization" in row)) {
          prepared.had_prior_utilization =
            utilization > 0 ? 1 : 0;
        }

        return prepared;
      });

      const apiBase =
        process.env.NEXT_PUBLIC_API_URL
          ?.trim()
          .replace(/\/$/, "") ?? "";

      const response = await fetch(
        `${apiBase}/api/predict/batch`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rows }),
        },
      );

      if (!response.ok) {
        const message = await response.text();

        throw new Error(
          message || "Batch prediction request failed.",
        );
      }

      const result =
        (await response.json()) as BatchPredictionResponse;

      setBatchResult(result);
    } catch (requestError) {
      setBatchError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to process CSV batch.",
      );
    } finally {
      setBatchLoading(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const serviceUtilization =
      form.outpatientVisits +
      form.emergencyVisits +
      form.inpatientVisits;

    const apiBase =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

    try {
      const response = await fetch(`${apiBase}/api/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          features: {
            age: form.age,
            gender: form.gender,
            race: form.race,
            admission_type_id: Number(form.admissionType),
            discharge_disposition_id: Number(
              form.dischargeDisposition,
            ),
            admission_source_id: Number(form.admissionSource),
            time_in_hospital: form.timeInHospital,
            num_lab_procedures: form.labProcedures,
            num_procedures: form.procedures,
            num_medications: form.medications,
            number_outpatient: form.outpatientVisits,
            number_emergency: form.emergencyVisits,
            number_inpatient: form.inpatientVisits,
            number_diagnoses: form.diagnoses,
            service_utilization: serviceUtilization,
            had_prior_utilization: serviceUtilization > 0 ? 1 : 0,
            a1_cresult: form.a1cResult,
            max_glu_serum: form.glucoseResult,
            insulin: form.insulin,
            change: form.medicationChanged,
            diabetes_med: form.diabetesMedication,
          },
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Prediction request failed.");
      }

      const prediction = (await response.json()) as PredictionResult;
      setResult(prediction);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to connect to the prediction API.",
      );
    } finally {
      setLoading(false);
    }
  }

  function changeSection(section: DashboardSection) {
    setActiveSection(section);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  const riskPercentage = result
    ? Math.round(result.risk_score * 1000) / 10
    : 0;

  const thresholdPercentage = result
    ? Math.round(result.decision_threshold * 1000) / 10
    : 38.5;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
        <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
          <aside className="hidden lg:block">
            <div className="sticky top-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-black/10">
              <div className="border-b border-slate-800 px-2 pb-5 pt-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
                  ML Portfolio
                </p>

                <p className="mt-2 text-lg font-bold leading-6 text-white">
                  Hospital Readmission Risk
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  End-to-end prediction dashboard
                </p>
              </div>

              <nav
                className="mt-4 space-y-1"
                aria-label="Dashboard navigation"
              >
                {dashboardSections.map((item) => {
                  const active =
                    activeSection === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        changeSection(item.id)
                      }
                      aria-current={
                        active ? "page" : undefined
                      }
                      className={
                        active
                          ? "w-full rounded-xl border border-blue-500/30 bg-blue-500/15 px-3 py-3 text-left"
                          : "w-full rounded-xl border border-transparent px-3 py-3 text-left transition hover:border-slate-800 hover:bg-slate-950/60"
                      }
                    >
                      <p
                        className={
                          active
                            ? "text-sm font-semibold text-blue-200"
                            : "text-sm font-medium text-slate-300"
                        }
                      >
                        {item.label}
                      </p>

                      <p className="mt-1 text-xs leading-4 text-slate-500">
                        {item.description}
                      </p>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <p className="text-xs uppercase tracking-wider text-emerald-300">
                  Model online
                </p>

                <p className="mt-1 text-xs font-medium text-emerald-100">
                  HistGradientBoosting
                </p>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="sticky top-0 z-40 -mx-4 mb-5 border-b border-slate-800 bg-slate-950/95 px-4 pb-3 pt-3 backdrop-blur lg:hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold uppercase tracking-wider text-blue-300">
                    Hospital Readmission Risk
                  </p>

                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {
                      dashboardSections.find(
                        (item) =>
                          item.id === activeSection,
                      )?.description
                    }
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  Online
                </span>
              </div>

              <div className="mt-3">
                <label
                  htmlFor="mobile-dashboard-section"
                  className="sr-only"
                >
                  Dashboard section
                </label>

                <select
                  id="mobile-dashboard-section"
                  value={activeSection}
                  onChange={(event) =>
                    changeSection(
                      event.target.value as DashboardSection,
                    )
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-base font-medium text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  {dashboardSections.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeSection === "overview" && (
              <>
        <header className="mb-10 flex flex-col gap-6 border-b border-slate-800 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-300">
              Machine Learning Portfolio
            </div>

            <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Hospital Readmission Risk
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
              Estimate the likelihood of a diabetes-related patient being
              readmitted within 30 days using a trained gradient boosting
              model.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4">
            <p className="text-xs uppercase tracking-wider text-emerald-300">
              Model status
            </p>
            <p className="mt-1 font-semibold text-emerald-100">
              HistGradientBoosting ready
            </p>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4">
          {[
            ["74.0%", "Test recall"],
            ["0.658", "ROC-AUC"],
            ["19,867", "Test encounters"],
            ["38.5%", "Decision threshold"],
          ].map(([value, label]) => (
            <article
              key={label}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
            >
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="mt-1 text-sm text-slate-400">{label}</p>
            </article>
          ))}
        </section>


        <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
              About this system
            </p>

            <h2 className="mt-3 text-2xl font-semibold text-white">
              End-to-end readmission risk workflow
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              This project estimates 30-day hospital readmission risk for
              diabetes-related encounters and demonstrates the full machine
              learning workflow around the prediction model.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                "Individual patient scoring",
                "CSV batch predictions",
                "Model performance analysis",
                "Threshold simulation",
                "Calibration and subgroup analysis",
                "Prediction monitoring",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
              Model snapshot
            </p>

            <div className="mt-5 space-y-4">
              {[
                ["Model", "HistGradientBoosting"],
                ["Processed features", "45"],
                ["Decision threshold", "38.5%"],
                ["Test encounters", "19,867"],
                ["Test recall", "74.0%"],
                ["ROC-AUC", "0.658"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3 last:border-0 last:pb-0"
                >
                  <span className="text-sm text-slate-500">
                    {label}
                  </span>

                  <span className="text-right text-sm font-semibold text-slate-200">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-xs leading-5 text-amber-200">
                Research and portfolio demonstration only. The model is not
                clinically validated or intended for medical decision-making.
              </p>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
              Quick actions
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Explore the dashboard
            </h2>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ["predict", "Run prediction", "Score a patient or CSV batch"],
              ["analytics", "View analytics", "Inspect performance and thresholds"],
              ["model", "Inspect model", "Registry, groups and calibration"],
              ["monitoring", "Open monitoring", "Prediction activity and drift"],
            ].map(([section, title, description]) => (
              <button
                key={section}
                type="button"
                onClick={() =>
                  changeSection(section as DashboardSection)
                }
                className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-left transition hover:border-blue-500/40 hover:bg-blue-500/5"
              >
                <p className="text-sm font-semibold text-white">
                  {title}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {description}
                </p>
              </button>
            ))}
          </div>
        </section>

              </>
            )}

            {activeSection === "predict" && (
              <>
        <div className="grid gap-5 sm:gap-8 xl:grid-cols-[1.55fr_0.85fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 shadow-2xl shadow-black/20 sm:p-4 sm:p-6 md:p-8"
          >
            <div className="mb-7">
              <h2 className="text-2xl font-semibold">Patient information</h2>
              <p className="mt-2 text-sm text-slate-400">
                Enter encounter and utilization information to generate a
                risk estimate.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <SelectField
                label="Age range"
                value={form.age}
                options={ageOptions}
                onChange={(value) =>
                  setForm((current) => ({ ...current, age: value }))
                }
              />

              <SelectField
                label="Gender"
                value={form.gender}
                options={[
                  { value: "Female", label: "Female" },
                  { value: "Male", label: "Male" },
                ]}
                onChange={(value) =>
                  setForm((current) => ({ ...current, gender: value }))
                }
              />

              <SelectField
                label="Race"
                value={form.race}
                options={[
                  { value: "Caucasian", label: "Caucasian" },
                  {
                    value: "AfricanAmerican",
                    label: "African American",
                  },
                  { value: "Asian", label: "Asian" },
                  { value: "Hispanic", label: "Hispanic" },
                  { value: "Other", label: "Other" },
                ]}
                onChange={(value) =>
                  setForm((current) => ({ ...current, race: value }))
                }
              />

              <SelectField
                label="Admission type"
                value={form.admissionType}
                options={admissionTypes}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    admissionType: value,
                  }))
                }
              />

              <SelectField
                label="Discharge disposition"
                value={form.dischargeDisposition}
                options={dischargeOptions}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    dischargeDisposition: value,
                  }))
                }
              />

              <SelectField
                label="Admission source"
                value={form.admissionSource}
                options={sourceOptions}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    admissionSource: value,
                  }))
                }
              />

              <NumberField
                label="Days in hospital"
                value={form.timeInHospital}
                min={1}
                max={14}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    timeInHospital: value,
                  }))
                }
              />

              <NumberField
                label="Lab procedures"
                value={form.labProcedures}
                max={150}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    labProcedures: value,
                  }))
                }
              />

              <NumberField
                label="Other procedures"
                value={form.procedures}
                max={10}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    procedures: value,
                  }))
                }
              />

              <NumberField
                label="Medications"
                value={form.medications}
                max={80}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    medications: value,
                  }))
                }
              />

              <NumberField
                label="Outpatient visits"
                value={form.outpatientVisits}
                max={50}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    outpatientVisits: value,
                  }))
                }
              />

              <NumberField
                label="Emergency visits"
                value={form.emergencyVisits}
                max={50}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    emergencyVisits: value,
                  }))
                }
              />

              <NumberField
                label="Prior inpatient visits"
                value={form.inpatientVisits}
                max={30}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    inpatientVisits: value,
                  }))
                }
              />

              <NumberField
                label="Number of diagnoses"
                value={form.diagnoses}
                max={20}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    diagnoses: value,
                  }))
                }
              />

              <SelectField
                label="A1C result"
                value={form.a1cResult}
                options={[
                  { value: "None", label: "Not measured" },
                  { value: "Norm", label: "Normal" },
                  { value: ">7", label: "Above 7%" },
                  { value: ">8", label: "Above 8%" },
                ]}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    a1cResult: value,
                  }))
                }
              />

              <SelectField
                label="Glucose result"
                value={form.glucoseResult}
                options={[
                  { value: "None", label: "Not measured" },
                  { value: "Norm", label: "Normal" },
                  { value: ">200", label: "Above 200" },
                  { value: ">300", label: "Above 300" },
                ]}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    glucoseResult: value,
                  }))
                }
              />

              <SelectField
                label="Insulin status"
                value={form.insulin}
                options={[
                  { value: "No", label: "No insulin" },
                  { value: "Steady", label: "Steady" },
                  { value: "Up", label: "Dose increased" },
                  { value: "Down", label: "Dose decreased" },
                ]}
                onChange={(value) =>
                  setForm((current) => ({ ...current, insulin: value }))
                }
              />

              <SelectField
                label="Medication changed"
                value={form.medicationChanged}
                options={[
                  { value: "No", label: "No" },
                  { value: "Ch", label: "Yes" },
                ]}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    medicationChanged: value,
                  }))
                }
              />

              <SelectField
                label="Diabetes medication"
                value={form.diabetesMedication}
                options={[
                  { value: "Yes", label: "Yes" },
                  { value: "No", label: "No" },
                ]}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    diabetesMedication: value,
                  }))
                }
              />
            </div>

            <div className="mt-8 border-t border-slate-800 pt-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
                  Patient history
                </p>

                <h3 className="mt-2 text-lg font-semibold text-white">
                  Encounter timeline
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Timeline generated from the utilization information entered
                  above. No patient identifiers are stored.
                </p>
              </div>

              <div className="mt-6">
                {getPatientTimeline(form).map(
                  (item, index, timeline) => (
                    <div
                      key={`${item.title}-${index}`}
                      className="relative flex gap-4 pb-6 last:pb-0"
                    >
                      <div className="relative flex w-8 shrink-0 justify-center">
                        {index < timeline.length - 1 && (
                          <div className="absolute bottom-0 top-7 w-px bg-slate-700" />
                        )}

                        <div
                          className={
                            item.current
                              ? "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-blue-400/40 bg-blue-500/20 text-xs font-semibold text-blue-300"
                              : "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-400"
                          }
                        >
                          {index + 1}
                        </div>
                      </div>

                      <div
                        className={
                          item.current
                            ? "flex-1 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4"
                            : "flex-1 rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                        }
                      >
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm font-semibold text-slate-200">
                            {item.title}
                          </p>

                          {item.current && (
                            <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-300">
                              Current
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            {error && (
              <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-8 w-full rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Calculating risk..." : "Calculate readmission risk"}
            </button>
          </form>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-4 sm:p-4 sm:p-6 md:p-8 xl:sticky xl:top-6">
              <p className="text-sm font-medium uppercase tracking-widest text-slate-400">
                Prediction result
              </p>

              {result ? (
                <>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-4xl font-bold text-white sm:text-5xl">
                        {riskPercentage}%
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        Estimated risk score
                      </p>
                    </div>

                    <span
                      className={getRiskBandBadgeClass(result.risk_band)}
                    >
                      {getRiskBandLabel(result.risk_band)}
                    </span>
                  </div>

                  <div className="mt-7">
                    <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={getRiskBarClass(result.risk_band)}
                        style={{
                          width: `${Math.min(riskPercentage, 100)}%`,
                        }}
                      />
                    </div>

                    <div className="mt-2 flex justify-between text-xs text-slate-500">
                      <span>0%</span>
                      <span>
                        Threshold {thresholdPercentage}%
                      </span>
                      <span>100%</span>
                    </div>
                  </div>

                  <dl className="mt-8 space-y-4 border-t border-slate-800 pt-6 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-400">Risk band</dt>
                      <dd className="font-medium text-slate-100">
                        {getRiskBandLabel(result.risk_band)}
                      </dd>
                    </div>

                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-400">Follow-up status</dt>
                      <dd className="font-medium text-slate-100">
                        {result.flagged_for_follow_up
                          ? "Flagged for review"
                          : "Below model threshold"}
                      </dd>
                    </div>

                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-400">
                        Decision margin
                      </dt>

                      <dd className="text-right font-medium text-slate-100">
                        {result.decision_margin >= 0 ? "+" : ""}
                        {(result.decision_margin * 100).toFixed(1)}
                        {" percentage points"}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-400">
                        Threshold proximity
                      </dt>

                      <dd>
                        <span
                          className={getThresholdProximityClass(
                            result.threshold_proximity,
                          )}
                        >
                          {getThresholdProximityLabel(
                            result.threshold_proximity,
                          )}
                        </span>
                      </dd>
                    </div>

                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-400">Model</dt>
                      <dd className="text-right font-medium text-slate-100">
                        {result.model.replaceAll("_", " ")}
                      </dd>
                    </div>

                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-400">Features supplied</dt>
                      <dd className="font-medium text-slate-100">
                        {result.supplied_feature_count}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-8 border-t border-slate-800 pt-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
                      Suggested demo workflow
                    </p>

                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {getWorkflowGuidance(result.risk_band).title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {getWorkflowGuidance(result.risk_band).summary}
                    </p>

                    <div className="mt-5 space-y-3">
                      {getWorkflowGuidance(result.risk_band).steps.map(
                        (step, index) => (
                          <div
                            key={step}
                            className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-300">
                              {index + 1}
                            </div>

                            <p className="pt-1 text-sm text-slate-300">
                              {step}
                            </p>
                          </div>
                        ),
                      )}
                    </div>

                    <p className="mt-4 text-xs leading-5 text-slate-500">
                      Demonstration workflow only. These steps are not medical
                      recommendations and are not validated for clinical use.
                    </p>
                  </div>

                  {result.explanations.length > 0 && (
                    <div className="mt-8 border-t border-slate-800 pt-6">
                      <div>
                        <h3 className="font-semibold text-white">
                          Why this prediction?
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Model-derived local effects based on how the risk
                          changes when each input is reset to its default.
                        </p>
                      </div>

                      <div className="mt-5 space-y-3">
                        {result.explanations.map((explanation) => {
                          const increasesRisk =
                            explanation.direction === "increases_risk";

                          return (
                            <div
                              key={explanation.feature}
                              className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-sm font-medium capitalize text-slate-200">
                                    {explanation.feature.replaceAll("_", " ")}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    Patient value: {explanation.value}
                                  </p>
                                </div>

                                <span
                                  className={
                                    increasesRisk
                                      ? "rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300"
                                      : "rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300"
                                  }
                                >
                                  {increasesRisk
                                    ? "Raises risk"
                                    : "Lowers risk"}
                                </span>
                              </div>

                              <div className="mt-3 flex items-center justify-between text-xs">
                                <span className="text-slate-500">
                                  Estimated local impact
                                </span>

                                <span className="font-semibold text-slate-200">
                                  {(explanation.impact * 100).toFixed(1)}{" "}
                                  percentage points
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-8 rounded-2xl border border-dashed border-slate-700 p-8 text-center">
                  <p className="text-lg font-medium text-slate-300">
                    No prediction yet
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Complete the patient form and calculate the risk to view
                    the model result.
                  </p>
                </div>
              )}

              <div className="mt-8 rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-500">
                Research portfolio demonstration only. This model is not
                calibrated or validated for clinical decision-making.
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
                Batch analysis
              </p>

              <h2 className="mt-2 text-2xl font-semibold text-white">
                CSV batch prediction
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Upload up to 1,000 hospital encounters and score them
                together using the same readmission model.
              </p>
            </div>

            <button
              type="button"
              onClick={downloadBatchTemplate}
              className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
            >
              Download CSV template
            </button>
          </div>

          <div className="mt-7 rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-6">
            <label className="block cursor-pointer">
              <span className="block text-sm font-semibold text-white">
                Select patient CSV
              </span>

              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Maximum 1,000 encounter rows. Use the template if you
                need the expected column names.
              </span>

              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleBatchFile}
                disabled={batchLoading}
                className="mt-4 block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-500 disabled:opacity-60"
              />
            </label>

            {batchFileName && (
              <p className="mt-3 text-xs text-slate-500">
                Selected file: {batchFileName}
              </p>
            )}

            {batchLoading && (
              <p className="mt-4 text-sm text-blue-300">
                Analyzing CSV...
              </p>
            )}

            {batchError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {batchError}
              </div>
            )}
          </div>

          {batchResult && (
            <>
              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {[
                  ["Total", batchResult.total_rows],
                  [
                    "Average risk",
                    `${(batchResult.average_risk * 100).toFixed(1)}%`,
                  ],
                  ["Flagged", batchResult.flagged_rows],
                  ["Low", batchResult.low_count],
                  ["Moderate", batchResult.moderate_count],
                  ["Elevated", batchResult.elevated_count],
                  ["High", batchResult.high_count],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
                  >
                    <p className="text-xl font-bold text-white">
                      {value}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-white">
                    Prediction results
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    One result for every uploaded encounter.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    downloadBatchResults(batchResult)
                  }
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  Download results CSV
                </button>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">
                        Row
                      </th>
                      <th className="px-4 py-3">
                        Risk score
                      </th>
                      <th className="px-4 py-3">
                        Risk band
                      </th>
                      <th className="px-4 py-3">
                        Follow-up
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {batchResult.predictions.map(
                      (prediction) => (
                        <tr
                          key={prediction.row_number}
                          className="border-t border-slate-800"
                        >
                          <td className="px-4 py-3 text-slate-400">
                            {prediction.row_number}
                          </td>

                          <td className="px-4 py-3 font-semibold text-white">
                            {(prediction.risk_score * 100).toFixed(1)}%
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={getRiskBandBadgeClass(
                                prediction.risk_band,
                              )}
                            >
                              {getRiskBandLabel(
                                prediction.risk_band,
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-300">
                            {prediction.flagged_for_follow_up
                              ? "Flagged for review"
                              : "Below threshold"}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
                      </>
            )}

            {activeSection === "analytics" && (
              <>
        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 md:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
              Model analytics
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-white">
              Test cohort dashboard
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Analytics generated from the held-out test cohort using the
              trained HistGradientBoosting model.
            </p>
          </div>

          {analyticsLoading && (
            <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 sm:p-6 text-sm text-slate-400">
              Loading model analytics...
            </div>
          )}

          {analyticsError && (
            <div className="mt-7 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
              {analyticsError}
            </div>
          )}

          {analytics && (
            <>
              <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                  <p className="text-2xl font-bold text-white">
                    {analytics.test_encounters.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Test encounters
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                  <p className="text-2xl font-bold text-white">
                    {(analytics.actual_readmission_rate * 100).toFixed(1)}%
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Actual readmission rate
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                  <p className="text-2xl font-bold text-white">
                    {(analytics.average_predicted_risk * 100).toFixed(1)}%
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Average predicted risk
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                  <p className="text-2xl font-bold text-white">
                    {(analytics.flagged_rate * 100).toFixed(1)}%
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Flagged for review
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-6 xl:grid-cols-2">
                <article className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 sm:p-6">
                  <h3 className="text-lg font-semibold text-white">
                    Risk distribution
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Model risk bands across the held-out test cohort.
                  </p>

                  <div className="mt-6 space-y-5">
                    {[
                      ["Low", analytics.risk_distribution.low],
                      [
                        "Moderate",
                        analytics.risk_distribution.moderate,
                      ],
                      [
                        "Elevated",
                        analytics.risk_distribution.elevated,
                      ],
                      ["High", analytics.risk_distribution.high],
                    ].map(([label, value]) => (
                      <AnalyticsBarRow
                        key={String(label)}
                        label={String(label)}
                        value={Number(value)}
                        maxValue={analytics.test_encounters}
                        displayValue={`${Number(
                          value,
                        ).toLocaleString()} · ${(
                          (Number(value) /
                            analytics.test_encounters) *
                          100
                        ).toFixed(1)}%`}
                      />
                    ))}
                  </div>
                </article>

                <article className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 sm:p-6">
                  <h3 className="text-lg font-semibold text-white">
                    Risk by age group
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Average model score compared with observed
                    30-day readmission.
                  </p>

                  <div className="mt-6 max-h-[520px] space-y-3 overflow-y-auto pr-2">
                    {analytics.age_groups.map((group) => (
                      <ComparisonBarRow
                        key={group.age}
                        label={group.age}
                        predicted={group.average_risk}
                        actual={group.actual_readmission}
                      />
                    ))}
                  </div>
                </article>

                <article className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 sm:p-6">
                  <h3 className="text-lg font-semibold text-white">
                    Risk by admission type
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Average predicted risk for each admission category.
                  </p>

                  <div className="mt-6 space-y-5">
                    {analytics.admission_types.map((group) => {
                      const label =
                        admissionTypes.find(
                          (option) =>
                            Number(option.value) ===
                            group.admission_type_id,
                        )?.label ??
                        `Admission type ${group.admission_type_id}`;

                      return (
                        <AnalyticsBarRow
                          key={group.admission_type_id}
                          label={label}
                          value={group.average_risk}
                          maxValue={1}
                          displayValue={`${(
                            group.average_risk * 100
                          ).toFixed(1)}% · ${group.encounters.toLocaleString()} encounters`}
                        />
                      );
                    })}
                  </div>
                </article>

                <article className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 sm:p-6">
                  <h3 className="text-lg font-semibold text-white">
                    Risk by length of stay
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Average predicted risk by days spent in hospital.
                  </p>

                  <div className="mt-6 max-h-[520px] space-y-5 overflow-y-auto pr-2">
                    {analytics.length_of_stay.map((group) => (
                      <AnalyticsBarRow
                        key={group.days}
                        label={`${group.days} ${
                          group.days === 1
                            ? "day"
                            : "days"
                        }`}
                        value={group.average_risk}
                        maxValue={1}
                        displayValue={`${(
                          group.average_risk * 100
                        ).toFixed(1)}% · ${group.encounters.toLocaleString()} encounters`}
                      />
                    ))}
                  </div>
                </article>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-xs leading-5 text-slate-500">
                Charts are calculated from the held-out test cohort.
                Predicted risk should not be interpreted as clinical
                calibration or medical guidance.
              </div>
            </>
          )}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 md:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
              Model performance
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-white">
              Held-out evaluation
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Performance measured on the 19,867-encounter test cohort
              using the selected 38.5% decision threshold.
            </p>
          </div>

          {performanceLoading && (
            <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 sm:p-6 text-sm text-slate-400">
              Loading model performance...
            </div>
          )}

          {performanceError && (
            <div className="mt-7 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
              {performanceError}
            </div>
          )}

          {performance && (
            <>
              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  [
                    "ROC-AUC",
                    performance.metrics.roc_auc.toFixed(3),
                  ],
                  [
                    "Average precision",
                    performance.metrics.average_precision.toFixed(3),
                  ],
                  [
                    "Recall",
                    `${(performance.metrics.recall * 100).toFixed(1)}%`,
                  ],
                  [
                    "Precision",
                    `${(performance.metrics.precision * 100).toFixed(1)}%`,
                  ],
                  [
                    "F1 score",
                    performance.metrics.f1.toFixed(3),
                  ],
                  [
                    "Specificity",
                    `${(performance.metrics.specificity * 100).toFixed(1)}%`,
                  ],
                  [
                    "Accuracy",
                    `${(performance.metrics.accuracy * 100).toFixed(1)}%`,
                  ],
                  [
                    "Decision threshold",
                    `${(performance.decision_threshold * 100).toFixed(1)}%`,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5"
                  >
                    <p className="text-2xl font-bold text-white">
                      {value}
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-6 xl:grid-cols-2">
                <PerformanceCurveChart
                  title="ROC curve"
                  subtitle="Sensitivity across false-positive rates on the held-out test cohort."
                  points={performance.roc_curve}
                  metricLabel="ROC-AUC"
                  metricValue={performance.metrics.roc_auc.toFixed(
                    3,
                  )}
                  diagonal
                />

                <PerformanceCurveChart
                  title="Precision–Recall curve"
                  subtitle="Precision versus recall across possible classification thresholds."
                  points={
                    performance.precision_recall_curve
                  }
                  metricLabel="Average precision"
                  metricValue={
                    performance.metrics.average_precision.toFixed(
                      3,
                    )
                  }
                  baselineY={performance.positive_rate}
                />
              </div>

              <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Confusion matrix
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Classification outcomes at the selected threshold.
                    </p>
                  </div>

                  <p className="text-xs text-slate-500">
                    {performance.test_encounters.toLocaleString()} test encounters
                  </p>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                      True positive
                    </p>

                    <p className="mt-2 text-3xl font-bold text-white">
                      {performance.confusion_matrix.true_positive.toLocaleString()}
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Readmissions correctly flagged by the model.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-300">
                      False positive
                    </p>

                    <p className="mt-2 text-3xl font-bold text-white">
                      {performance.confusion_matrix.false_positive.toLocaleString()}
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Non-readmissions that were still flagged.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                      False negative
                    </p>

                    <p className="mt-2 text-3xl font-bold text-white">
                      {performance.confusion_matrix.false_negative.toLocaleString()}
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Readmissions missed at the selected threshold.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                      True negative
                    </p>

                    <p className="mt-2 text-3xl font-bold text-white">
                      {performance.confusion_matrix.true_negative.toLocaleString()}
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Non-readmissions correctly left below threshold.
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-xs leading-5 text-slate-500">
                  This threshold prioritizes recall, which increases the
                  number of false-positive review flags. Results are for
                  research and portfolio demonstration only.
                </p>
              </div>
            </>
          )}
        </section>

        <ThresholdSimulator />
              </>
            )}

            {activeSection === "model" && (
              <>
                <ModelRegistry />
                <SubgroupAnalysis />
                <CalibrationAnalysis />
              </>
            )}

            {activeSection === "monitoring" && (
              <>
                <AuditActivity />
                <ModelMonitoring />
              </>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}
