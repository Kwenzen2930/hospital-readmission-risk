"use client";

import {
  useEffect,
  useState,
} from "react";

type ReliabilityBin = {
  bin: number;
  encounters: number;
  minimum_predicted_risk: number;
  maximum_predicted_risk: number;
  average_predicted_risk: number;
  observed_readmission_rate: number;
  absolute_calibration_gap: number;
};

type CalibrationResponse = {
  analysis_scope: string;
  model: string;
  model_version: string;
  model_artifact_sha256: string;
  test_encounters: number;
  actual_readmissions: number;
  observed_readmission_rate: number;
  average_predicted_risk: number;
  mean_probability_gap: number;
  brier_score: number;
  log_loss: number;
  expected_calibration_error: number;
  maximum_calibration_error: number;
  binning_method: string;
  reliability_bins: ReliabilityBin[];
  interpretation_note: string;
  metric_note: string;
};

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function ReliabilityChart({
  bins,
}: {
  bins: ReliabilityBin[];
}) {
  const width = 720;
  const height = 420;
  const padding = 55;
  const innerWidth =
    width - padding * 2;
  const innerHeight =
    height - padding * 2;

  const x = (value: number) =>
    padding + value * innerWidth;

  const y = (value: number) =>
    height -
    padding -
    value * innerHeight;

  const points = bins
    .map(
      (bin) =>
        `${x(bin.average_predicted_risk)},${y(
          bin.observed_readmission_rate,
        )}`,
    )
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[640px] w-full"
        role="img"
        aria-label="Probability reliability chart"
      >
        {[0, 0.25, 0.5, 0.75, 1].map(
          (value) => (
            <g key={value}>
              <line
                x1={padding}
                x2={width - padding}
                y1={y(value)}
                y2={y(value)}
                stroke="currentColor"
                className="text-slate-800"
              />

              <text
                x={padding - 12}
                y={y(value) + 4}
                textAnchor="end"
                className="fill-slate-500 text-[11px]"
              >
                {(value * 100).toFixed(0)}%
              </text>

              <text
                x={x(value)}
                y={height - padding + 25}
                textAnchor="middle"
                className="fill-slate-500 text-[11px]"
              >
                {(value * 100).toFixed(0)}%
              </text>
            </g>
          ),
        )}

        {[0, 0.25, 0.5, 0.75, 1].map(
          (value) => (
            <line
              key={`vertical-${value}`}
              x1={x(value)}
              x2={x(value)}
              y1={padding}
              y2={height - padding}
              stroke="currentColor"
              className="text-slate-800"
            />
          ),
        )}

        <line
          x1={x(0)}
          y1={y(0)}
          x2={x(1)}
          y2={y(1)}
          stroke="currentColor"
          strokeDasharray="8 7"
          className="text-slate-500"
        />

        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-blue-400"
        />

        {bins.map((bin) => (
          <circle
            key={bin.bin}
            cx={x(
              bin.average_predicted_risk,
            )}
            cy={y(
              bin.observed_readmission_rate,
            )}
            r="6"
            fill="currentColor"
            className="text-blue-300"
          >
            <title>
              {`Bin ${bin.bin}: model ${percent(
                bin.average_predicted_risk,
              )}, observed ${percent(
                bin.observed_readmission_rate,
              )}`}
            </title>
          </circle>
        ))}

        <text
          x={width / 2}
          y={height - 8}
          textAnchor="middle"
          className="fill-slate-400 text-[12px]"
        >
          Average model score
        </text>

        <text
          x="16"
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${height / 2})`}
          className="fill-slate-400 text-[12px]"
        >
          Observed readmission rate
        </text>
      </svg>
    </div>
  );
}

export default function CalibrationAnalysis() {
  const [data, setData] =
    useState<CalibrationResponse | null>(
      null,
    );

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadCalibration() {
      try {
        const apiBase =
          process.env.NEXT_PUBLIC_API_URL
            ?.trim()
            .replace(/\/$/, "") ?? "";

        const response = await fetch(
          `${apiBase}/api/calibration`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            `Calibration API returned ${response.status}.`,
          );
        }

        const payload =
          (await response.json()) as CalibrationResponse;

        setData(payload);
        setError("");
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load calibration analysis.",
        );
      }
    }

    void loadCalibration();
  }, []);

  return (
    <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
          Probability calibration
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-white">
          Reliability of the raw model score
        </h2>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
          Checks whether model scores align with
          observed readmission rates in the held-out
          test cohort. The raw score is not presented
          as a calibrated clinical probability.
        </p>
      </div>

      {error && (
        <div className="mt-7 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
          {error}
        </div>
      )}

      {!data && !error && (
        <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
          Loading calibration analysis...
        </div>
      )}

      {data && (
        <>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Observed rate
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {percent(
                  data.observed_readmission_rate,
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Avg model score
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {percent(
                  data.average_predicted_risk,
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <p className="text-xs uppercase tracking-wider text-amber-300/70">
                Mean score gap
              </p>

              <p className="mt-2 text-2xl font-bold text-amber-200">
                {(
                  data.mean_probability_gap *
                  100
                ).toFixed(1)}
                pp
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Brier score
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {data.brier_score.toFixed(4)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <div>
                <h3 className="font-semibold text-white">
                  Reliability curve
                </h3>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  The dashed diagonal represents
                  perfect probability calibration.
                </p>
              </div>

              <div className="mt-5">
                <ReliabilityChart
                  bins={
                    data.reliability_bins
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <h3 className="font-semibold text-white">
                Calibration metrics
              </h3>

              <dl className="mt-5 space-y-5 text-sm">
                <div>
                  <dt className="text-slate-500">
                    Expected calibration error
                  </dt>

                  <dd className="mt-1 text-xl font-semibold text-white">
                    {(
                      data.expected_calibration_error *
                      100
                    ).toFixed(1)}
                    pp
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">
                    Maximum calibration gap
                  </dt>

                  <dd className="mt-1 text-xl font-semibold text-white">
                    {(
                      data.maximum_calibration_error *
                      100
                    ).toFixed(1)}
                    pp
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">
                    Log loss
                  </dt>

                  <dd className="mt-1 text-xl font-semibold text-white">
                    {data.log_loss.toFixed(4)}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">
                    Held-out encounters
                  </dt>

                  <dd className="mt-1 text-xl font-semibold text-white">
                    {data.test_encounters.toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-4">
                      Bin
                    </th>

                    <th className="px-4 py-4">
                      N
                    </th>

                    <th className="px-4 py-4">
                      Avg model score
                    </th>

                    <th className="px-4 py-4">
                      Observed
                    </th>

                    <th className="px-4 py-4">
                      Gap
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800 bg-slate-950/30">
                  {data.reliability_bins.map(
                    (bin) => (
                      <tr key={bin.bin}>
                        <td className="px-4 py-4 font-medium text-white">
                          {bin.bin}
                        </td>

                        <td className="px-4 py-4 text-slate-300">
                          {bin.encounters.toLocaleString()}
                        </td>

                        <td className="px-4 py-4 text-slate-300">
                          {percent(
                            bin.average_predicted_risk,
                          )}
                        </td>

                        <td className="px-4 py-4 text-slate-300">
                          {percent(
                            bin.observed_readmission_rate,
                          )}
                        </td>

                        <td className="px-4 py-4 font-medium text-amber-200">
                          {(
                            bin.absolute_calibration_gap *
                            100
                          ).toFixed(1)}
                          pp
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <h3 className="font-semibold text-white">
                Interpretation
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                {data.interpretation_note}
              </p>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                {data.metric_note}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <h3 className="font-semibold text-white">
                Model traceability
              </h3>

              <p className="mt-3 text-sm text-slate-500">
                Version
              </p>

              <p className="mt-1 font-mono text-sm text-white">
                {data.model_version}
              </p>

              <p className="mt-4 text-sm text-slate-500">
                Binning
              </p>

              <p className="mt-1 text-sm leading-6 text-slate-300">
                {data.binning_method}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm leading-6 text-amber-100">
            A model score of 70% should not be read as
            a 70% chance of readmission. In this
            held-out cohort, the highest-score bin
            averaged about 71.2% model score but had
            an observed readmission rate of about
            26.2%.
          </div>
        </>
      )}
    </section>
  );
}
