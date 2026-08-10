"use client";

import { useState } from "react";
import type { FormEvent } from "react";

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

type PredictionResult = {
  model: string;
  risk_score: number;
  decision_threshold: number;
  flagged_for_follow_up: boolean;
  risk_band: string;
  supplied_feature_count: number;
  disclaimer: string;
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

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const riskPercentage = result
    ? Math.round(result.risk_score * 1000) / 10
    : 0;

  const thresholdPercentage = result
    ? Math.round(result.decision_threshold * 1000) / 10
    : 38.5;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <header className="mb-10 flex flex-col gap-6 border-b border-slate-800 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-300">
              Machine Learning Portfolio
            </div>

            <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
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

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <div className="grid gap-8 xl:grid-cols-[1.55fr_0.85fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-black/20 md:p-8"
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
            <section className="sticky top-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-8">
              <p className="text-sm font-medium uppercase tracking-widest text-slate-400">
                Prediction result
              </p>

              {result ? (
                <>
                  <div className="mt-6 flex items-end justify-between">
                    <div>
                      <p className="text-5xl font-bold text-white">
                        {riskPercentage}%
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        Estimated risk score
                      </p>
                    </div>

                    <span
                      className={
                        result.flagged_for_follow_up
                          ? "rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-300"
                          : "rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-300"
                      }
                    >
                      {result.flagged_for_follow_up
                        ? "Follow-up flagged"
                        : "Below threshold"}
                    </span>
                  </div>

                  <div className="mt-7">
                    <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={
                          result.flagged_for_follow_up
                            ? "h-full rounded-full bg-amber-400 transition-all"
                            : "h-full rounded-full bg-emerald-400 transition-all"
                        }
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
                      <dd className="font-medium capitalize text-slate-100">
                        {result.risk_band}
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
      </div>
    </main>
  );
}
