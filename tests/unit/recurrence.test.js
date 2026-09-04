import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateOccurrences } from "../../src/engine/recurrence.js";

beforeEach(() => {
  let index = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `id-${++index}` });
});

describe("generateOccurrences", () => {
  it("genere une serie de jalons hebdomadaires", () => {
    const occurrences = generateOccurrences({ id: "rec-1", timeline_id: "timeline-1", type: "milestone", label: "Comite", start_date: "2026-01-05", occurrences: 3, frequency: "week", interval: 2, color: "blue" });
    expect(occurrences).toMatchObject([
      { label: "Comite 1", start_date: "2026-01-05", end_date: null, recurrence_id: "rec-1" },
      { label: "Comite 2", start_date: "2026-01-19" },
      { label: "Comite 3", start_date: "2026-02-02" },
    ]);
  });

  it("enchaine sans trou les periodes avec un intervalle nul", () => {
    const occurrences = generateOccurrences({ id: "rec-2", timeline_id: "timeline-1", type: "period", label: "Sprint", start_date: "2026-01-01", occurrences: 2, frequency: "week", interval: 0, duration: 2, duration_unit: "week", color: "green", render_mode: "rectangle" });
    expect(occurrences).toMatchObject([
      { start_date: "2026-01-01", end_date: "2026-01-14", render_mode: "rectangle" },
      { start_date: "2026-01-15", end_date: "2026-01-28" },
    ]);
  });

  it("calcule la duree mensuelle d'une periode", () => {
    const [occurrence] = generateOccurrences({ id: "rec-3", timeline_id: "timeline-1", type: "period", label: "Phase", start_date: "2026-01-15", occurrences: 1, frequency: "month", interval: 1, duration: 2, duration_unit: "month", color: "red" });
    expect(occurrence).toMatchObject({ start_date: "2026-01-15", end_date: "2026-03-15" });
  });
});