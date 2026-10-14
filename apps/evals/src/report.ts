import type { MetricsSummary as Summary } from "./metrics.js";
import type { EvalDataset } from "./types.js";

export type FailedCaseSummary = {
  id: string;
  question: string;
  expectedAnswer: string | null;
  answer: string;
  abstained: boolean;
  reason?: string;
};

function percentage(value: number | null) {
  return value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

function higherWins(
  label: string,
  vector: number | null,
  dementia: number | null,
  lowerIsBetter = false,
): string | null {
  if (vector === null || dementia === null) return null;
  if (vector === dementia) return null;
  const dementiaWins = lowerIsBetter ? dementia < vector : dementia > vector;
  const winner = dementiaWins ? "Dementia" : "Vector-RAG";
  const delta = lowerIsBetter ? vector - dementia : dementia - vector;
  const formatted = label.includes("latency") || label.includes("tokens")
    ? `${Math.round(Math.abs(delta))}${label.includes("latency") ? "ms" : ""}`
    : `${(Math.abs(delta) * 100).toFixed(1)}pp`;
  return `- **${label}:** ${winner} (+${formatted})`;
}

function renderHeadline(vectorRag: Summary, dementia: Summary): string[] {
  const results = [
    higherWins("Accuracy", vectorRag.accuracy, dementia.accuracy),
    higherWins("Temporal accuracy", vectorRag.temporalAccuracy, dementia.temporalAccuracy),
    higherWins("Revision accuracy", vectorRag.revisionAccuracy, dementia.revisionAccuracy),
    higherWins("Abstention accuracy", vectorRag.abstentionAccuracy, dementia.abstentionAccuracy),
    higherWins("Read tokens", vectorRag.readTokens, dementia.readTokens, true),
    higherWins("p50 retrieval latency", vectorRag.p50LatencyMs, dementia.p50LatencyMs, true),
  ];
  const wins: string[] = [];
  for (const line of results) if (line) wins.push(line);

  // The metric label is bold Markdown (`**Accuracy:**`), so the winner is
  // preceded by `:**`, not a plain colon. Match the rendered winner token.
  const dementiaTrack03 = wins.filter((line) => line.includes("** Dementia ("));
  const vectorOps = wins.filter((line) => line.includes("** Vector-RAG ("));

  return [
    "## Track 03 headline",
    "",
    "Metrics the hackathon brief cares about (accuracy, chronology, revisions, abstention):",
    "",
    ...(dementiaTrack03.length ? dementiaTrack03 : ["- Dementia did not lead on scored accuracy dimensions in this run."]),
    "",
    "Expected tradeoffs (Vector-RAG has no extraction layer):",
    "",
    ...(vectorOps.length ? vectorOps : ["- No operational wins for Vector-RAG in this sample."]),
    "",
  ];
}

export function renderComparisonReport(input: {
  dataset: EvalDataset;
  vectorRag: Summary;
  thred: Summary;
  vectorRagFailures?: FailedCaseSummary[];
  thredFailures?: FailedCaseSummary[];
  vectorRagErrors?: FailedCaseSummary[];
  thredErrors?: FailedCaseSummary[];
}): string {
  const rows = [
    ["Accuracy", percentage(input.vectorRag.accuracy), percentage(input.thred.accuracy)],
    ["Temporal accuracy", percentage(input.vectorRag.temporalAccuracy), percentage(input.thred.temporalAccuracy)],
    ["Revision accuracy", percentage(input.vectorRag.revisionAccuracy), percentage(input.thred.revisionAccuracy)],
    ["Abstention accuracy", percentage(input.vectorRag.abstentionAccuracy), percentage(input.thred.abstentionAccuracy)],
    ["Eval errors", String(input.vectorRag.evalErrors), String(input.thred.evalErrors)],
    ["Cases scored", String(input.vectorRag.casesScored), String(input.thred.casesScored)],
    ["Write tokens", String(input.vectorRag.writeTokens), String(input.thred.writeTokens)],
    ["Read tokens", String(input.vectorRag.readTokens), String(input.thred.readTokens)],
    ["p50 retrieval latency", `${input.vectorRag.p50LatencyMs}ms`, `${input.thred.p50LatencyMs}ms`],
    ["p95 retrieval latency", `${input.vectorRag.p95LatencyMs}ms`, `${input.thred.p95LatencyMs}ms`],
  ];
  const failures = (strategy: string, items: FailedCaseSummary[]) => [
    `## ${strategy} failed-case summaries`,
    "",
    ...(items.length
      ? items.map((item) => `- \`${item.id}\`: expected ${JSON.stringify(item.expectedAnswer)}; got ${JSON.stringify(item.answer)}${item.abstained ? " (NOT_FOUND)" : ""}${item.reason ? `; retrieval: ${item.reason}` : ""}. Question: ${item.question}`)
      : ["- None."]),
  ];
  const errors = (strategy: string, items: FailedCaseSummary[]) => [
    `## ${strategy} eval-error summaries`,
    "",
    ...(items.length
      ? items.map((item) => `- \`${item.id}\`: ${item.reason ?? "unknown error"}. Question: ${item.question}`)
      : ["- None."]),
  ];

  return [
    `# Dementia Track 03 evaluation: ${input.dataset}`,
    "",
    "| Metric | Vector-RAG | Dementia |",
    "| --- | ---: | ---: |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    "",
    "Both strategies use the same answer model. The vector baseline is deterministic hashed-vector retrieval.",
    "Accuracy excludes EVAL_ERROR cases; see eval-error summaries below.",
    "",
    ...renderHeadline(input.vectorRag, input.thred),
    ...failures("Vector-RAG", input.vectorRagFailures ?? []),
    "",
    ...failures("Dementia", input.thredFailures ?? []),
    "",
    ...errors("Vector-RAG", input.vectorRagErrors ?? []),
    "",
    ...errors("Dementia", input.thredErrors ?? []),
  ].join("\n");
}
