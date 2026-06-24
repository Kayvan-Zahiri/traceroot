"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ArrowRight } from "lucide-react";
import { cn, buildUrlWithFilters } from "@/lib/utils";
import { useTraceDetectorRuns, type BackendRun } from "@/features/detectors/hooks/use-findings";

/** A run is "triggered" when it produced a finding. */
function isTriggered(run: BackendRun): boolean {
  return run.finding_id != null;
}

/** Display name for a run, falling back to its detector id. */
function runName(run: BackendRun): string {
  return run.name ?? run.detector_id;
}

/**
 * Order detector runs triggered-first, then alphabetically by name. Pure so it
 * can be unit-tested in the default node environment.
 */
export function sortDetectorRuns(runs: BackendRun[]): BackendRun[] {
  return [...runs].sort((a, b) => {
    const ta = isTriggered(a);
    const tb = isTriggered(b);
    if (ta !== tb) return ta ? -1 : 1;
    return runName(a).localeCompare(runName(b));
  });
}

/** The pill shown on the right of each row: finding, clean, or a raw run state. */
function outcomeBadge(run: BackendRun): { label: string; className: string } {
  if (isTriggered(run)) {
    return {
      label: "Finding",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    };
  }
  if (run.status === "completed") {
    return { label: "Clean", className: "border-border bg-muted/60 text-muted-foreground" };
  }
  return { label: run.status, className: "border-border bg-muted/60 text-muted-foreground" };
}

interface TraceDetectorsTabProps {
  projectId: string;
  traceId: string;
}

/**
 * Lists every detector that ran on a trace as a borderless status list.
 *
 * Triggered rows expand (rotating chevron) into a threaded summary whose body
 * opens the detector's Findings tab; clean rows have no finding, so clicking the
 * row jumps straight to the detector's Runs tab. Fetches its own data by
 * traceId, independent of the trace fetch in the parent panel.
 */
export function TraceDetectorsTab({ projectId, traceId }: TraceDetectorsTabProps) {
  const router = useRouter();
  const { data, isLoading, error } = useTraceDetectorRuns(projectId, traceId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px] text-muted-foreground">Loading detectors...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px] text-destructive">Error loading detectors</p>
      </div>
    );
  }

  const runs = sortDetectorRuns(data?.runs ?? []);

  if (runs.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px] text-muted-foreground">No detectors ran on this trace</p>
      </div>
    );
  }

  const triggeredCount = runs.filter(isTriggered).length;

  function toggle(runId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-7 flex-shrink-0 items-center justify-between border-b border-border bg-muted/10 px-3">
        <span className="text-[11px] font-medium text-muted-foreground">Detectors</span>
        <span className="text-[11px] text-muted-foreground">
          {triggeredCount > 0
            ? `${triggeredCount} of ${runs.length} triggered`
            : `${runs.length} ran · all clean`}
        </span>
      </div>

      <div className="flex-1 divide-y divide-border/60 overflow-auto">
        {runs.map((r) => {
          const triggered = isTriggered(r);
          const isOpen = expanded.has(r.run_id);
          const badge = outcomeBadge(r);
          // Both clean rows and a triggered row's "View finding" deep-link to
          // the detector's Runs tab — the Findings tab is just that runs list
          // filtered to triggered runs, so Runs is the canonical destination.
          // (Future: deep-link to this run's detector self-trace in the Runs tab.)
          const detectorHref = buildUrlWithFilters(
            `/projects/${projectId}/detectors/${r.detector_id}`,
            { extraParams: { tab: "runs" } },
          );
          return (
            <div key={r.run_id} className={cn(isOpen && "bg-muted/20")}>
              <button
                type="button"
                aria-expanded={triggered ? isOpen : undefined}
                onClick={() => (triggered ? toggle(r.run_id) : router.push(detectorHref))}
                onMouseEnter={() => router.prefetch(detectorHref)}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-muted/40"
              >
                {/* Reserved chevron slot keeps every row's text and badge
                  aligned; the chevron only surfaces for triggered (expandable)
                  rows. */}
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {triggered && (
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
                        isOpen && "rotate-90",
                      )}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full ring-1",
                    triggered
                      ? "bg-destructive/15 ring-destructive/60"
                      : "bg-muted-foreground/20 ring-muted-foreground/40",
                  )}
                />
                <span className="flex-1 truncate text-[12px] text-foreground">{runName(r)}</span>
                <span
                  className={cn(
                    "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium",
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
              </button>

              {triggered && isOpen && (
                // pl is tuned so the accent's 2px border centers on the status
                // dot above it: px-3 (12) + chevron slot (16) + gap (10) +
                // half-dot (4) = 42px dot centre, so the border starts at 41px.
                <div className="pb-3 pl-[41px] pr-4">
                  {/* Threaded under the row by a left accent (aligned to the
                    dot) so it reads as the row's detail; opens the Findings tab. */}
                  <button
                    type="button"
                    onClick={() => router.push(detectorHref)}
                    onMouseEnter={() => router.prefetch(detectorHref)}
                    className="group/sum block w-full border-l-2 border-destructive/40 pl-3 text-left"
                  >
                    {/* Clamped preview so long reasoning can't blow up the row;
                      the full text lives on the finding the body links to. */}
                    <p className="line-clamp-3 text-[12px] leading-relaxed text-muted-foreground">
                      {r.summary || "No summary provided."}
                    </p>
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors group-hover/sum:text-foreground">
                      View finding
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
