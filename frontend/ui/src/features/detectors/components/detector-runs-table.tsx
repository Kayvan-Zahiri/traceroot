"use client";

import { formatDate } from "@/lib/utils";
import { describeRcaStatus, type BackendRun } from "@/features/detectors/hooks/use-findings";

interface DetectorRunsTableProps {
  rows: BackendRun[];
  /** Fired when a row's trace_id cell is clicked — opens the run's trace. */
  onTraceClick: (run: BackendRun) => void;
}

/**
 * One table for both the Runs and Findings tabs — Findings is just Runs filtered
 * to triggered rows, so the two differ only by the `rows` they receive.
 *
 * The Agent-analysis cell keys "N/A" on `finding_id` (not on `rca_status`): a
 * run with no finding has nothing to analyze, while a triggered run shows its
 * stored RCA state via `describeRcaStatus`. The `trace_id` cell — not the whole
 * row — is the click target, so a future `run_id` → self-trace cell can sit
 * beside it without conflict.
 */
export function DetectorRunsTable({ rows, onTraceClick }: DetectorRunsTableProps) {
  return (
    <table className="w-full">
      <thead className="sticky top-0 bg-background">
        <tr className="border-b border-border bg-muted/50">
          <th className="w-[160px] whitespace-nowrap border-r border-border/50 px-3 py-1.5 text-left text-[12px] font-medium text-muted-foreground">
            Timestamp
          </th>
          <th className="w-[280px] whitespace-nowrap border-r border-border/50 px-3 py-1.5 text-left text-[12px] font-medium text-muted-foreground">
            Run ID
          </th>
          <th className="whitespace-nowrap border-r border-border/50 px-3 py-1.5 text-left text-[12px] font-medium text-muted-foreground">
            Trace ID
          </th>
          <th className="w-[80px] whitespace-nowrap border-r border-border/50 px-3 py-1.5 text-left text-[12px] font-medium text-muted-foreground">
            Identified
          </th>
          <th className="w-[280px] whitespace-nowrap border-r border-border/50 px-3 py-1.5 text-left text-[12px] font-medium text-muted-foreground">
            Finding ID
          </th>
          <th className="whitespace-nowrap border-r border-border/50 px-3 py-1.5 text-left text-[12px] font-medium text-muted-foreground">
            Summary
          </th>
          <th className="w-[90px] whitespace-nowrap border-r border-border/50 px-3 py-1.5 text-left text-[12px] font-medium text-muted-foreground">
            Status
          </th>
          <th className="w-[110px] whitespace-nowrap px-3 py-1.5 text-left text-[12px] font-medium text-muted-foreground">
            Agent analysis
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((run) => {
          const rca = describeRcaStatus(run.rca_status);
          return (
            <tr
              key={run.run_id}
              className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/50"
            >
              <td className="whitespace-nowrap border-r border-border/50 px-3 py-1.5 text-[12px] text-muted-foreground">
                {formatDate(run.timestamp)}
              </td>
              <td className="border-r border-border/50 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                {run.run_id}
              </td>
              <td className="border-r border-border/50 px-3 py-1.5 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => onTraceClick(run)}
                  title={run.trace_id}
                  className="block max-w-full truncate text-left text-muted-foreground transition-colors hover:text-foreground hover:underline"
                >
                  {run.trace_id}
                </button>
              </td>
              <td className="border-r border-border/50 px-3 py-1.5 text-[12px]">
                {run.finding_id != null ? (
                  <span className="text-destructive">Yes</span>
                ) : (
                  <span className="text-muted-foreground">No</span>
                )}
              </td>
              <td className="border-r border-border/50 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                {run.finding_id ?? "—"}
              </td>
              <td className="max-w-[400px] border-r border-border/50 px-3 py-1.5 text-[12px] text-foreground">
                {run.summary ? (
                  <span className="block truncate" title={run.summary}>
                    {run.summary.length > 100 ? run.summary.slice(0, 100) + "…" : run.summary}
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-muted-foreground">—</span>
                )}
              </td>
              <td className="border-r border-border/50 px-3 py-1.5 text-[12px] capitalize text-muted-foreground">
                {run.status}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-[12px]">
                {run.finding_id == null ? (
                  <span
                    className="text-muted-foreground"
                    title="No finding — root cause analysis is not applicable"
                  >
                    N/A
                  </span>
                ) : (
                  <span className={rca.className} title={rca.title}>
                    {rca.label}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
