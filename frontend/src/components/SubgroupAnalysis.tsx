"use client";

import {
  useEffect,
  useState,
} from "react";

type SubgroupRow = {
  group: string;
  encounters: number;
  actual_readmissions: number;
  actual_non_readmissions: number;
  support_status:
    | "sufficient"
    | "limited_support";
  observed_readmission_rate: number;
  average_predicted_risk: number;
  flagged_rate: number;
  recall: number | null;
  precision: number | null;
  specificity: number | null;
  false_positive_rate: number | null;
  false_negative_rate: number | null;
};

type OverallMetrics = {
  encounters: number;
  actual_readmissions: number;
  observed_readmission_rate: number;
  average_predicted_risk: number;
  flagged_rate: number;
  recall: number | null;
  precision: number | null;
  specificity: number | null;
  false_positive_rate: number | null;
  false_negative_rate: number | null;
};

type FairnessResponse = {
  analysis_scope: string;
  model: string;
  model_version: string;
  model_artifact_sha256: string;
  decision_threshold: number;
  test_encounters: number;
  minimum_group_size: number;
  minimum_positive_outcomes: number;
  minimum_negative_outcomes: number;
  overall: OverallMetrics;
  subgroups: {
    gender: SubgroupRow[];
    race: SubgroupRow[];
    age: SubgroupRow[];
  };
  interpretation_note: string;
  support_note: string;
};

type Attribute =
  | "gender"
  | "race"
  | "age";

function percent(
  value: number | null,
) {
  if (value === null) {
    return "N/A";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function attributeLabel(
  attribute: Attribute,
) {
  switch (attribute) {
    case "gender":
      return "Gender";
    case "race":
      return "Race";
    default:
      return "Age";
  }
}

export default function SubgroupAnalysis() {
  const [data, setData] =
    useState<FairnessResponse | null>(null);

  const [activeAttribute, setActiveAttribute] =
    useState<Attribute>("gender");

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadAnalysis() {
      try {
        const apiBase =
          process.env.NEXT_PUBLIC_API_URL
            ?.trim()
            .replace(/\/$/, "") ?? "";

        const response = await fetch(
          `${apiBase}/api/fairness`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            `Subgroup API returned ${response.status}.`,
          );
        }

        const payload =
          (await response.json()) as FairnessResponse;

        setData(payload);
        setError("");
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load subgroup analysis.",
        );
      }
    }

    void loadAnalysis();
  }, []);

  const groups =
    data?.subgroups[activeAttribute] ?? [];

  return (
    <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 md:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
          Held-out subgroup analysis
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-white">
          Model behavior across demographic groups
        </h2>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
          Compares model behavior across demographic
          groups in the held-out test cohort. These are
          descriptive evaluation results, not proof that
          the model is fair, unbiased, or clinically
          equitable.
        </p>
      </div>

      {error && (
        <div className="mt-7 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
          {error}
        </div>
      )}

      {!data && !error && (
        <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
          Loading subgroup analysis...
        </div>
      )}

      {data && (
        <>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Held-out encounters
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {data.test_encounters.toLocaleString()}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Overall recall
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {percent(data.overall.recall)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Overall precision
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {percent(data.overall.precision)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Overall specificity
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {percent(
                  data.overall.specificity,
                )}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {(
              [
                "gender",
                "race",
                "age",
              ] as Attribute[]
            ).map((attribute) => (
              <button
                key={attribute}
                type="button"
                onClick={() =>
                  setActiveAttribute(attribute)
                }
                className={
                  activeAttribute === attribute
                    ? "rounded-xl border border-blue-500/40 bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-200"
                    : "rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm font-medium text-slate-400 transition hover:text-white"
                }
              >
                {attributeLabel(attribute)}
              </button>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-4">
                      Group
                    </th>

                    <th className="px-4 py-4">
                      N
                    </th>

                    <th className="px-4 py-4">
                      Observed
                    </th>

                    <th className="px-4 py-4">
                      Avg risk
                    </th>

                    <th className="px-4 py-4">
                      Flagged
                    </th>

                    <th className="px-4 py-4">
                      Recall
                    </th>

                    <th className="px-4 py-4">
                      Precision
                    </th>

                    <th className="px-4 py-4">
                      Specificity
                    </th>

                    <th className="px-4 py-4">
                      FPR
                    </th>

                    <th className="px-4 py-4">
                      FNR
                    </th>

                    <th className="px-4 py-4">
                      Support
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800 bg-slate-950/30">
                  {groups.map((group) => (
                    <tr key={group.group}>
                      <td className="whitespace-nowrap px-4 py-4 font-medium text-white">
                        {group.group}
                      </td>

                      <td className="px-4 py-4 text-slate-300">
                        {group.encounters.toLocaleString()}
                      </td>

                      <td className="px-4 py-4 text-slate-300">
                        {percent(
                          group.observed_readmission_rate,
                        )}
                      </td>

                      <td className="px-4 py-4 text-slate-300">
                        {percent(
                          group.average_predicted_risk,
                        )}
                      </td>

                      <td className="px-4 py-4 text-slate-300">
                        {percent(
                          group.flagged_rate,
                        )}
                      </td>

                      <td className="px-4 py-4 font-medium text-white">
                        {percent(group.recall)}
                      </td>

                      <td className="px-4 py-4 text-slate-300">
                        {percent(group.precision)}
                      </td>

                      <td className="px-4 py-4 text-slate-300">
                        {percent(
                          group.specificity,
                        )}
                      </td>

                      <td className="px-4 py-4 text-slate-300">
                        {percent(
                          group.false_positive_rate,
                        )}
                      </td>

                      <td className="px-4 py-4 text-slate-300">
                        {percent(
                          group.false_negative_rate,
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {group.support_status ===
                        "limited_support" ? (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                            Limited
                          </span>
                        ) : (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                            Sufficient
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <h3 className="font-semibold text-white">
                Support rules
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                A group is marked limited when it has
                fewer than{" "}
                {data.minimum_group_size} encounters,
                fewer than{" "}
                {data.minimum_positive_outcomes} positive
                outcomes, or fewer than{" "}
                {data.minimum_negative_outcomes} negative
                outcomes.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <h3 className="font-semibold text-white">
                Model traceability
              </h3>

              <p className="mt-3 text-sm text-slate-400">
                Version
              </p>

              <p className="mt-1 break-all font-mono text-sm text-white">
                {data.model_version}
              </p>

              <p className="mt-4 text-sm text-slate-400">
                Decision threshold
              </p>

              <p className="mt-1 font-semibold text-white">
                {(
                  data.decision_threshold * 100
                ).toFixed(1)}
                %
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-xs leading-5 text-slate-400">
            <p>{data.interpretation_note}</p>

            <p className="mt-2">
              {data.support_note}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
