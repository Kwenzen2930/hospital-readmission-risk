"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type ThresholdPoint = {
  threshold: number;
  flagged_count: number;
  flagged_rate: number;
  precision: number;
  recall: number;
  specificity: number;
  f1: number;
  accuracy: number;
  true_positive: number;
  false_positive: number;
  false_negative: number;
  true_negative: number;
};

type ThresholdSimulation = {
  test_encounters: number;
  actual_positive_count: number;
  selected_threshold: number;
  points: ThresholdPoint[];
};

function findClosestIndex(
  points: ThresholdPoint[],
  threshold: number,
) {
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  points.forEach((point, index) => {
    const distance = Math.abs(
      point.threshold - threshold,
    );

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function ThresholdSimulator() {
  const [simulation, setSimulation] =
    useState<ThresholdSimulation | null>(null);

  const [thresholdIndex, setThresholdIndex] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSimulation() {
      try {
        const apiBase =
          process.env.NEXT_PUBLIC_API_URL
            ?.trim()
            .replace(/\/$/, "") ?? "";

        const response = await fetch(
          `${apiBase}/api/threshold-simulation`,
        );

        if (!response.ok) {
          throw new Error(
            `Threshold API returned ${response.status}.`,
          );
        }

        const data =
          (await response.json()) as ThresholdSimulation;

        const selectedIndex =
          findClosestIndex(
            data.points,
            data.selected_threshold,
          );

        if (!cancelled) {
          setSimulation(data);
          setThresholdIndex(selectedIndex);
          setError("");
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load threshold simulation.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSimulation();

    return () => {
      cancelled = true;
    };
  }, []);

  const point = useMemo(() => {
    if (!simulation) {
      return null;
    }

    return (
      simulation.points[thresholdIndex] ??
      simulation.points[0]
    );
  }, [
    simulation,
    thresholdIndex,
  ]);

  function resetThreshold() {
    if (!simulation) {
      return;
    }

    setThresholdIndex(
      findClosestIndex(
        simulation.points,
        simulation.selected_threshold,
      ),
    );
  }

  return (
    <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
            Decision threshold simulator
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-white">
            Explore the review threshold
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Move the threshold to see how the number of
            flagged encounters, recall, precision, and
            classification outcomes change on the held-out
            test cohort.
          </p>
        </div>

        {simulation && (
          <button
            type="button"
            onClick={resetThreshold}
            className="w-fit rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            Reset to selected threshold
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
          Loading threshold simulation...
        </div>
      )}

      {error && (
        <div className="mt-7 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
          {error}
        </div>
      )}

      {simulation && point && (
        <>
          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">
                  Current threshold
                </p>

                <p className="mt-1 text-4xl font-bold text-white">
                  {percent(point.threshold)}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-slate-500">
                  Model-selected threshold
                </p>

                <p className="mt-1 font-semibold text-blue-300">
                  {percent(
                    simulation.selected_threshold,
                  )}
                </p>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={simulation.points.length - 1}
              step={1}
              value={thresholdIndex}
              onChange={(event) =>
                setThresholdIndex(
                  Number(event.target.value),
                )
              }
              className="mt-7 h-2 w-full cursor-pointer accent-blue-500"
              aria-label="Decision threshold"
            />

            <div className="mt-3 flex justify-between text-xs text-slate-500">
              <span>
                {percent(
                  simulation.points[0].threshold,
                )}
              </span>

              <span>
                Lower threshold → more flagged
              </span>

              <span>
                {percent(
                  simulation.points[
                    simulation.points.length - 1
                  ].threshold,
                )}
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-2xl font-bold text-white">
                {point.flagged_count.toLocaleString()}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Flagged encounters
              </p>

              <p className="mt-2 text-xs text-slate-500">
                {percent(point.flagged_rate)} of test cohort
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-2xl font-bold text-white">
                {percent(point.recall)}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Recall
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Share of actual readmissions captured
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-2xl font-bold text-white">
                {percent(point.precision)}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Precision
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Share of flags that were readmissions
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-2xl font-bold text-white">
                {percent(point.specificity)}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Specificity
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Non-readmissions correctly left unflagged
              </p>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
              <p className="text-2xl font-bold text-white">
                {point.false_positive.toLocaleString()}
              </p>

              <p className="mt-1 text-sm text-red-200">
                False positives
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Extra review workload
              </p>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
              <p className="text-2xl font-bold text-white">
                {point.false_negative.toLocaleString()}
              </p>

              <p className="mt-1 text-sm text-amber-200">
                False negatives
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Actual readmissions missed
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-emerald-300">
                True positive
              </p>

              <p className="mt-2 text-xl font-bold text-white">
                {point.true_positive.toLocaleString()}
              </p>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-red-300">
                False positive
              </p>

              <p className="mt-2 text-xl font-bold text-white">
                {point.false_positive.toLocaleString()}
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-amber-300">
                False negative
              </p>

              <p className="mt-2 text-xl font-bold text-white">
                {point.false_negative.toLocaleString()}
              </p>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-blue-300">
                True negative
              </p>

              <p className="mt-2 text-xl font-bold text-white">
                {point.true_negative.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-xs leading-5 text-slate-500">
            Lower thresholds generally capture more
            readmissions but create more review flags.
            Higher thresholds reduce review volume but can
            miss more readmissions. This simulator uses
            held-out research data and is not a clinical
            decision tool.
          </div>
        </>
      )}
    </section>
  );
}
