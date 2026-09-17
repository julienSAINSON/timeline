import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateTimelineFromTemplate } from "../../src/engine/template-generator.js";

beforeEach(() => {
  let index = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `template-item-${++index}` });
});

const agileTemplate = {
  id: "agile-14",
  name: "Iteration Agile 2 semaines",
  iterationDurationDays: 14,
  numberOfIterations: 3,
  periods: [
    { id: "build", name: "Build", iteration: null, startPosition: { kind: "first-day" }, endPosition: { kind: "day-of-iteration", day: 5 }, color: "green", renderMode: "rectangle" },
  ],
  milestones: [
    { id: "demo", name: "System Demo", iteration: null, time: "14:00", color: "violet", position: { kind: "week-day", week: 2, dayOfWeek: 3 } },
    { id: "retro", name: "Retrospective", iteration: null, position: { kind: "last-day" } },
  ],
};

describe("generateTimelineFromTemplate", () => {
  it("genere des iterations de 14 jours", () => {
    const result = generateTimelineFromTemplate(agileTemplate, "2026-10-05");

    expect(result.start_date).toBe("2026-10-05");
    expect(result.end_date).toBe("2026-11-15");
    expect(result.items.filter(({ label }) => label === "Build").every(({ color, render_mode }) => color === "green" && render_mode === "rectangle")).toBe(true);
    expect(result.items.filter(({ type }) => type === "period").map(({ start_date, end_date }) => [start_date, end_date])).toEqual([
      ["2026-10-05", "2026-10-18"],
      ["2026-10-05", "2026-10-09"],
      ["2026-10-19", "2026-11-01"],
      ["2026-10-19", "2026-10-23"],
      ["2026-11-02", "2026-11-15"],
      ["2026-11-02", "2026-11-06"],
    ]);
  });

  it("place le mercredi de la semaine 2 et le dernier jour", () => {
    const result = generateTimelineFromTemplate(agileTemplate, "2026-10-05");

    expect(result.items.filter(({ label }) => label === "System Demo").map(({ start_date, time, color }) => [start_date, time, color])).toEqual([["2026-10-14", "14:00", "violet"], ["2026-10-28", "14:00", "violet"], ["2026-11-11", "14:00", "violet"]]);
    expect(result.items.filter(({ label }) => label === "Retrospective").map(({ start_date }) => start_date)).toEqual(["2026-10-16", "2026-10-30", "2026-11-13"]);
  });

  it("place le dernier jour ouvré lorsque la fin d'iteration tombe le week-end", () => {
    const template = { ...agileTemplate, numberOfIterations: 1, periods: [], milestones: [{ name: "Cloture", position: { kind: "last-day" } }] };

    const result = generateTimelineFromTemplate(template, "2026-10-05");

    expect(result.items.find(({ label }) => label === "Cloture").start_date).toBe("2026-10-16");
  });

  it("reporte explicitement le samedi 12 decembre 2026 au vendredi 11", () => {
    const template = { iterationDurationDays: 14, numberOfIterations: 1, periods: [], milestones: [{ name: "Cloture", position: { kind: "last-day" } }] };

    const result = generateTimelineFromTemplate(template, "2026-11-29");

    expect(result.items.find(({ label }) => label === "Cloture").start_date).toBe("2026-12-11");
  });

  it("traverse les mois et les annees sans modifier le modele", () => {
    const template = structuredClone(agileTemplate);
    const snapshot = structuredClone(template);
    const result = generateTimelineFromTemplate(template, "2026-12-21", { numberOfIterations: 2 });

    expect(result.end_date).toBe("2027-01-17");
    expect(template).toEqual(snapshot);
  });

  it("supporte le jour N et plusieurs jalons dans la meme iteration", () => {
    const template = { ...agileTemplate, numberOfIterations: 1, milestones: [
      { name: "Jour 3", iteration: 1, position: { kind: "day-of-iteration", day: 3 } },
      { name: "Debut", iteration: 1, position: { kind: "first-day" } },
    ] };
    const result = generateTimelineFromTemplate(template, "2026-10-05");

    expect(result.items.filter(({ type }) => type === "milestone").map(({ start_date }) => start_date)).toEqual(["2026-10-07", "2026-10-05"]);
  });
});