"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type AuditRecord = {
  id: number;
  created_at: string;
  model: string;
  risk_score: number;
  decision_threshold: number;
  flagged_for_follow_up: boolean;
  risk_band: string;
  decision_margin: number;
  threshold_distance: number;
  threshold_proximity: string;
  supplied_feature_count: number;
};

type AuditResponse = {
  total_predictions: number;
  flagged_predictions: number;
  flagged_rate: number;
  average_risk: number;
  risk_bands: Record<string, number>;
  threshold_proximity: Record<string, number>;
  recent_predictions: AuditRecord[];
};

function bandLabel(value: string) {
  switch (value) {
    case "high":
      return "High";
    case "elevated":
      return "Elevated";
    case "moderate":
      return "Moderate";
    default:
      return "Low";
  }
}

function proximityLabel(value: string) {
  switch (value) {
    case "near":
      return "Near";
    case "moderate":
      return "Moderate";
    default:
      return "Far";
  }
}

function bandClass(value: string) {
  switch (value) {
    case "high":
      return "bg-red-500/15 text-red-300";
    case "elevated":
      return "bg-amber-500/15 text-amber-300";
    case "moderate":
      return "bg-sky-500/15 text-sky-300";
    default:
      return "bg-emerald-500/15 text-emerald-300";
  }
}

export default function AuditActivity() {
  const [audit, setAudit] =
    useState<AuditResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadAudit = useCallback(async () => {
    setLoading(true);

    try {
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL
          ?.trim()
          .replace(/\/$/, "") ?? "";

      const response = await fetch(
        `${apiBase}/api/audit`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(
          `Audit API returned ${response.status}.`,
        );
      }

      const data =
        (await response.json()) as AuditResponse;

      setAudit(data);
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load prediction activity.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  return (
    <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
            Prediction audit
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-white">
            Recent prediction activity
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Privacy-safe prediction metadata recorded by
            the local scoring service. Raw patient inputs
            are not stored in this audit log.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAudit()}
          className="w-fit rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
        >
          Refresh activity
        </button>
      </div>

      {loading && !audit && (
        <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
          Loading prediction activity...
        </div>
      )}

      {error && (
        <div className="mt-7 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
          {error}
        </div>
      )}

      {audit && (
        <>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-2xl font-bold text-white">
                {audit.total_predictions.toLocaleString()}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Predictions logged
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-2xl font-bold text-white">
                {audit.flagged_predictions.toLocaleString()}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Flagged for review
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-2xl font-bold text-white">
                {(audit.flagged_rate * 100).toFixed(1)}%
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Flagged rate
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-2xl font-bold text-white">
                {(audit.average_risk * 100).toFixed(1)}%
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Average logged risk
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <p className="text-sm font-semibold text-white">
                Risk bands
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {[
                  "low",
                  "moderate",
                  "elevated",
                  "high",
                ].map((band) => (
                  <div
                    key={band}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
                  >
                    <span className="capitalize text-slate-400">
                      {band}
                    </span>

                    <span className="font-semibold text-white">
                      {audit.risk_bands[band] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <p className="text-sm font-semibold text-white">
                Threshold proximity
              </p>

              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                {[
                  "near",
                  "moderate",
                  "far",
                ].map((proximity) => (
                  <div
                    key={proximity}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center"
                  >
                    <p className="text-xl font-bold text-white">
                      {audit.threshold_proximity[
                        proximity
                      ] ?? 0}
                    </p>

                    <p className="mt-1 capitalize text-slate-500">
                      {proximity}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40">
            <div className="border-b border-slate-800 px-5 py-4">
              <h3 className="font-semibold text-white">
                Latest predictions
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Showing up to 20 most recent audit records.
              </p>
            </div>

            {audit.recent_predictions.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                No predictions have been logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[850px] w-full text-left text-sm">
                  <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3">
                        Time
                      </th>

                      <th className="px-5 py-3">
                        Risk
                      </th>

                      <th className="px-5 py-3">
                        Band
                      </th>

                      <th className="px-5 py-3">
                        Margin
                      </th>

                      <th className="px-5 py-3">
                        Proximity
                      </th>

                      <th className="px-5 py-3">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800">
                    {audit.recent_predictions.map(
                      (record) => (
                        <tr key={record.id}>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-400">
                            {new Date(
                              record.created_at,
                            ).toLocaleString()}
                          </td>

                          <td className="px-5 py-4 font-semibold text-white">
                            {(
                              record.risk_score * 100
                            ).toFixed(1)}
                            %
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${bandClass(
                                record.risk_band,
                              )}`}
                            >
                              {bandLabel(
                                record.risk_band,
                              )}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-slate-300">
                            {record.decision_margin >= 0
                              ? "+"
                              : ""}
                            {(
                              record.decision_margin *
                              100
                            ).toFixed(1)}
                            {" pp"}
                          </td>

                          <td className="px-5 py-4 text-slate-300">
                            {proximityLabel(
                              record.threshold_proximity,
                            )}
                          </td>

                          <td className="px-5 py-4 text-slate-300">
                            {record.flagged_for_follow_up
                              ? "Flagged"
                              : "Below threshold"}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-xs leading-5 text-slate-500">
            This local audit log stores model output
            metadata only. It does not store the raw
            encounter form or patient-identifying
            information.
          </div>
        </>
      )}
    </section>
  );
}
