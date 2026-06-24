// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  runs: undefined as unknown,
  isLoading: false,
  error: null as unknown,
  push: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("@/features/detectors/hooks/use-findings", () => ({
  useTraceDetectorRuns: () => ({
    data: mocks.runs === undefined ? undefined : { runs: mocks.runs },
    isLoading: mocks.isLoading,
    error: mocks.error,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, prefetch: mocks.prefetch }),
}));

vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils");
  return {
    ...actual,
    buildUrlWithFilters: (path: string, opts?: { extraParams?: Record<string, string> }) =>
      `URL(${path}${opts?.extraParams?.tab ? `?tab=${opts.extraParams.tab}` : ""})`,
  };
});

import { TraceDetectorsTab, sortDetectorRuns } from "./TraceDetectorsTab";
import type { BackendRun } from "@/features/detectors/hooks/use-findings";

function run(partial: Partial<BackendRun>): BackendRun {
  return {
    run_id: "r",
    detector_id: "d",
    project_id: "p",
    trace_id: "t",
    finding_id: null,
    status: "completed",
    timestamp: "2026-06-01T00:00:00",
    summary: "",
    ...partial,
  };
}

afterEach(() => {
  cleanup();
  mocks.runs = undefined;
  mocks.isLoading = false;
  mocks.error = null;
  mocks.push.mockReset();
  mocks.prefetch.mockReset();
});

describe("sortDetectorRuns", () => {
  it("orders triggered runs first, then alphabetically by name", () => {
    const runs = [
      run({ run_id: "1", name: "Zeta", finding_id: null }),
      run({ run_id: "2", name: "Beta", finding_id: "f-2" }),
      run({ run_id: "3", name: "Alpha", finding_id: null }),
      run({ run_id: "4", name: "Delta", finding_id: "f-4" }),
    ];
    const sorted = sortDetectorRuns(runs).map((r) => r.run_id);
    // triggered (Beta, Delta) sorted alpha first, then non-triggered (Alpha, Zeta)
    expect(sorted).toEqual(["2", "4", "3", "1"]);
  });
});

describe("TraceDetectorsTab", () => {
  it("renders each run's name and outcome badge", () => {
    mocks.runs = [
      run({ run_id: "1", name: "Latency detector", finding_id: "f-1", status: "completed" }),
      run({ run_id: "2", name: "Safety detector", finding_id: null, status: "completed" }),
    ];
    render(<TraceDetectorsTab projectId="proj-1" traceId="trace-1" />);

    expect(screen.getByText("Latency detector")).toBeTruthy();
    expect(screen.getByText("Safety detector")).toBeTruthy();
    // Outcome badges: triggered -> "Finding", clean -> "Clean".
    expect(screen.getByText("Finding")).toBeTruthy();
    expect(screen.getByText("Clean")).toBeTruthy();
  });

  it("expands a triggered row's summary on click, without navigating", () => {
    mocks.runs = [
      run({
        run_id: "1",
        detector_id: "det-9",
        name: "Latency",
        finding_id: "f-1",
        summary: "Too slow",
      }),
    ];
    render(<TraceDetectorsTab projectId="proj-1" traceId="trace-1" />);

    // Summary hidden until expanded; expanding must not navigate.
    expect(screen.queryByText("Too slow")).toBeNull();
    fireEvent.click(screen.getByText("Latency"));
    expect(screen.getByText("Too slow")).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("navigates to the runs tab when the expanded summary is clicked", () => {
    mocks.runs = [
      run({
        run_id: "1",
        detector_id: "det-9",
        name: "Latency",
        finding_id: "f-1",
        summary: "Too slow",
      }),
    ];
    render(<TraceDetectorsTab projectId="proj-1" traceId="trace-1" />);

    fireEvent.click(screen.getByText("Latency"));
    fireEvent.click(screen.getByText("Too slow"));
    expect(mocks.push).toHaveBeenCalledWith("URL(/projects/proj-1/detectors/det-9?tab=runs)");
  });

  it("navigates straight to the runs tab when a clean row is clicked", () => {
    mocks.runs = [run({ run_id: "1", detector_id: "det-9", name: "Safety", finding_id: null })];
    render(<TraceDetectorsTab projectId="proj-1" traceId="trace-1" />);

    fireEvent.click(screen.getByText("Safety"));
    expect(mocks.push).toHaveBeenCalledWith("URL(/projects/proj-1/detectors/det-9?tab=runs)");
  });

  it("prefetches the detector route on row hover so navigation feels instant", () => {
    mocks.runs = [run({ run_id: "1", detector_id: "det-9", name: "Safety", finding_id: null })];
    render(<TraceDetectorsTab projectId="proj-1" traceId="trace-1" />);

    const row = screen.getByText("Safety").closest("button") as HTMLElement;
    fireEvent.mouseEnter(row);
    expect(mocks.prefetch).toHaveBeenCalledWith("URL(/projects/proj-1/detectors/det-9?tab=runs)");
  });

  it("shows an empty state when no detectors ran", () => {
    mocks.runs = [];
    render(<TraceDetectorsTab projectId="proj-1" traceId="trace-1" />);
    expect(screen.getByText(/no detectors ran/i)).toBeTruthy();
  });
});
