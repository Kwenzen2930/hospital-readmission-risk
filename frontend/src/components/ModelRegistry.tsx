"use client";

import {
  useEffect,
  useState,
} from "react";

type RegistryModel = {
  version: string;
  status: string;
  model_name: string;
  artifact: string;
  artifact_sha256: string;
  artifact_size_bytes: number;
  model_class: string;
  model_module: string;
  scikit_learn_version: string;
  decision_threshold: number;
  selection_metric: string;
  threshold_metric: string;
  feature_count: number;
  evaluation: {
    test_encounters: number;
    roc_auc: number;
    average_precision: number;
    precision: number;
    recall: number;
    f1: number;
    specificity: number;
  };
};

type RegistryResponse = {
  registry_version: number;
  active_model_version: string;
  generated_at: string;
  models: RegistryModel[];
};

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function ModelRegistry() {
  const [registry, setRegistry] =
    useState<RegistryResponse | null>(null);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadRegistry() {
      try {
        const apiBase =
          process.env.NEXT_PUBLIC_API_URL
            ?.trim()
            .replace(/\/$/, "") ?? "";

        const response = await fetch(
          `${apiBase}/api/model-registry`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            `Model registry API returned ${response.status}.`,
          );
        }

        const data =
          (await response.json()) as RegistryResponse;

        setRegistry(data);
        setError("");
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load model registry.",
        );
      }
    }

    void loadRegistry();
  }, []);

  const activeModel =
    registry?.models.find(
      (model) =>
        model.version ===
        registry.active_model_version,
    ) ?? null;

  return (
    <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 md:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
          Model registry
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-white">
          Active model version
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Traceable metadata for the exact model
          artifact currently used by the prediction
          service.
        </p>
      </div>

      {error && (
        <div className="mt-7 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
          {error}
        </div>
      )}

      {!registry && !error && (
        <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
          Loading model registry...
        </div>
      )}

      {registry && activeModel && (
        <>
          <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
                Active
              </p>

              <p className="mt-2 break-all font-mono text-base font-semibold text-white sm:text-lg">
                {activeModel.version}
              </p>
            </div>

            <div className="text-sm text-emerald-200">
              Registry v{registry.registry_version}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Model
              </p>

              <p className="mt-2 font-semibold text-white">
                {activeModel.model_name.replaceAll(
                  "_",
                  " ",
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Features
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {activeModel.feature_count}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Decision threshold
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {(
                  activeModel.decision_threshold *
                  100
                ).toFixed(1)}
                %
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Artifact size
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {formatBytes(
                  activeModel.artifact_size_bytes,
                )}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <h3 className="font-semibold text-white">
                Artifact identity
              </h3>

              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-slate-500">
                    Artifact
                  </dt>

                  <dd className="mt-1 text-slate-200">
                    {activeModel.artifact}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">
                    Model class
                  </dt>

                  <dd className="mt-1 text-slate-200">
                    {activeModel.model_class}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">
                    scikit-learn
                  </dt>

                  <dd className="mt-1 text-slate-200">
                    {activeModel.scikit_learn_version}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">
                    SHA-256
                  </dt>

                  <dd className="mt-1 break-all font-mono text-xs leading-5 text-slate-300">
                    {activeModel.artifact_sha256}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <h3 className="font-semibold text-white">
                Held-out evaluation
              </h3>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  [
                    "ROC-AUC",
                    activeModel.evaluation.roc_auc,
                  ],
                  [
                    "Avg precision",
                    activeModel.evaluation
                      .average_precision,
                  ],
                  [
                    "Recall",
                    activeModel.evaluation.recall,
                  ],
                  [
                    "Precision",
                    activeModel.evaluation.precision,
                  ],
                  [
                    "F1",
                    activeModel.evaluation.f1,
                  ],
                  [
                    "Specificity",
                    activeModel.evaluation.specificity,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                  >
                    <p className="text-lg font-semibold text-white">
                      {Number(value).toFixed(3)}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {String(label)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-xs leading-5 text-slate-500">
            The version identifier is derived from the
            model artifact fingerprint. Changing the
            serialized model changes its SHA-256 and
            therefore produces a new traceable version.
          </div>
        </>
      )}
    </section>
  );
}
