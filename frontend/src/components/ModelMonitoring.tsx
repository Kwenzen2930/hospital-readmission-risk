"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type MonitoringSignal = {
  metric: string;
  severity: string;
  shift: number;
};

type MonitoringResponse = {
  status:
    | "insufficient_data"
    | "stable"
    | "warning"
    | "alert";
  status_message: string;
  sample_size: number;
  minimum_sample_size: number;
  window_size: number;
  reference: {
    test_encounters: number;
    average_risk: number;
    flagged_rate: number;
    risk_band_shares: Record<string, number>;
  };
  current: {
    average_risk: number;
    flagged_rate: number;
    risk_band_counts: Record<string, number>;
    risk_band_shares: Record<string, number>;
    threshold_proximity_counts: Record<
      string,
      number
    >;
  };
  shifts: {
    average_risk: number;
    flagged_rate: number;
    risk_band_shares: Record<string, number>;
    maximum_band_shift: number;
  };
  signals: MonitoringSignal[];
  method_note: string;
};

function statusLabel(status: string) {
  switch (status) {
    case "stable":
      return "Stable";
    case "warning":
      return "Watch";
    case "alert":
      return "Alert";
    default:
      return "Insufficient data";
  }
}

function statusClass(status: string) {
  switch (status) {
    case "stable":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "warning":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "alert":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    default:
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
  }
}

function formatShift(value: number) {
  const points = value * 100;

  return `${points >= 0 ? "+" : ""}${points.toFixed(
    1,
  )} pp`;
}

const riskBands = [
  "low",
  "moderate",
  "elevated",
  "high",
];

export default function ModelMonitoring() {
  const [monitoring, setMonitoring] =
    useState<MonitoringResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadMonitoring = useCallback(
    async () => {
      setLoading(true);

      try {
        const apiBase =
          process.env.NEXT_PUBLIC_API_URL
            ?.trim()
            .replace(/\/$/, "") ?? "";

        const response = await fetch(
          `${apiBase}/api/monitoring`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            `Monitoring API returned ${response.status}.`,
          );
        }

        const data =
          (await response.json()) as MonitoringResponse;

        setMonitoring(data);
        setError("");
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load model monitoring.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadMonitoring();
  }, [loadMonitoring]);

  return (
    <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
            Model monitoring
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-white">
            Prediction behavior monitoring
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Compares recent prediction outputs with the
            held-out reference cohort. Monitoring starts
            producing signals only after enough
            predictions have been logged.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadMonitoring()
          }
          className="w-full rounded-xl sm:w-fit border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
        >
          Refresh monitoring
        </button>
      </div>

      {loading && !monitoring && (
        <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
          Loading monitoring data...
        </div>
      )}

      {error && (
        <div className="mt-7 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
          {error}
        </div>
      )}

      {monitoring && (
        <>
          <div
            className={`mt-7 rounded-2xl border p-5 ${statusClass(
              monitoring.status,
            )}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest">
                  Monitoring status
                </p>

                <p className="mt-2 text-xl font-semibold">
                  {statusLabel(
                    monitoring.status,
                  )}
                </p>
              </div>

              <div className="text-sm">
                {monitoring.sample_size} /{" "}
                {
                  monitoring.minimum_sample_size
                }{" "}
                predictions
              </div>
            </div>

            <p className="mt-3 max-w-3xl text-sm leading-6 opacity-80">
              {monitoring.status_message}
            </p>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-950/40">
              <div
                className="h-full rounded-full bg-current transition-all"
                style={{
                  width: `${Math.min(
                    (monitoring.sample_size /
                      monitoring.minimum_sample_size) *
                      100,
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Recent predictions
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {monitoring.sample_size}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Window up to{" "}
                {monitoring.window_size}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Current average risk
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {(
                  monitoring.current
                    .average_risk * 100
                ).toFixed(1)}
                %
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Reference{" "}
                {(
                  monitoring.reference
                    .average_risk * 100
                ).toFixed(1)}
                %
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Current flagged rate
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {(
                  monitoring.current
                    .flagged_rate * 100
                ).toFixed(1)}
                %
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Reference{" "}
                {(
                  monitoring.reference
                    .flagged_rate * 100
                ).toFixed(1)}
                %
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Reference cohort
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {monitoring.reference.test_encounters.toLocaleString()}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Held-out encounters
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <h3 className="font-semibold text-white">
                Output shifts
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Difference between recent predictions
                and reference behavior.
              </p>

              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <span className="text-sm text-slate-400">
                    Average risk
                  </span>

                  <span className="font-semibold text-white">
                    {formatShift(
                      monitoring.shifts
                        .average_risk,
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <span className="text-sm text-slate-400">
                    Flagged rate
                  </span>

                  <span className="font-semibold text-white">
                    {formatShift(
                      monitoring.shifts
                        .flagged_rate,
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <span className="text-sm text-slate-400">
                    Largest band shift
                  </span>

                  <span className="font-semibold text-white">
                    {(
                      monitoring.shifts
                        .maximum_band_shift *
                      100
                    ).toFixed(1)}
                    {" pp"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <h3 className="font-semibold text-white">
                Threshold proximity
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Recent predictions by distance from
                the decision boundary.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  "near",
                  "moderate",
                  "far",
                ].map((proximity) => (
                  <div
                    key={proximity}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center"
                  >
                    <p className="text-2xl font-bold text-white">
                      {monitoring.current
                        .threshold_proximity_counts[
                        proximity
                      ] ?? 0}
                    </p>

                    <p className="mt-1 text-xs capitalize text-slate-500">
                      {proximity}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
            <h3 className="font-semibold text-white">
              Risk-band distribution
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Recent output distribution compared
              with the held-out reference cohort.
            </p>

            <div className="mt-6 space-y-6">
              {riskBands.map((band) => {
                const current =
                  monitoring.current
                    .risk_band_shares[band] ??
                  0;

                const reference =
                  monitoring.reference
                    .risk_band_shares[
                    band
                  ] ?? 0;

                return (
                  <div key={band}>
                    <div className="mb-2 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="capitalize text-slate-300">
                        {band}
                      </span>

                      <span className="text-slate-500">
                        Current{" "}
                        {(
                          current * 100
                        ).toFixed(1)}
                        % · Reference{" "}
                        {(
                          reference * 100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-blue-400"
                          style={{
                            width: `${Math.min(
                              current *
                                100,
                              100,
                            )}%`,
                          }}
                        />
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-slate-500"
                          style={{
                            width: `${Math.min(
                              reference *
                                100,
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-5 text-xs text-slate-500">
              <span>
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-400" />
                Recent
              </span>

              <span>
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-slate-500" />
                Reference
              </span>
            </div>
          </div>

          {monitoring.signals.length > 0 && (
            <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
              <h3 className="font-semibold text-amber-200">
                Monitoring signals
              </h3>

              <div className="mt-4 space-y-3">
                {monitoring.signals.map(
                  (signal) => (
                    <div
                      key={signal.metric}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-amber-100">
                        {signal.metric.replaceAll(
                          "_",
                          " ",
                        )}
                      </span>

                      <span className="font-semibold uppercase text-amber-300">
                        {signal.severity}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-xs leading-5 text-slate-500">
            {monitoring.method_note}
          </div>
        </>
      )}
    </section>
  );
}
