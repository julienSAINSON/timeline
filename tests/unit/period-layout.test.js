import { describe, expect, it } from "vitest";
import { layoutPeriods, periodStartOffset, periodWidth } from "../../src/engine/period-layout.js";
import { createScale } from "../../src/engine/timeline-scale.js";

const scale = createScale({ start_date: "2026-01-01", end_date: "2026-01-31" }, 20);
const period = (id, start_date, end_date, label = id, render_mode = "bracket") => ({ id, start_date, end_date, label, render_mode });

describe("layoutPeriods", () => {
  it("place les periodes qui se chevauchent sur des voies distinctes", () => {
    const positioned = layoutPeriods([
      period("second", "2026-01-05", "2026-01-12"),
      period("first", "2026-01-01", "2026-01-10"),
    ], scale);
    expect(positioned.map(({ id, lane }) => ({ id, lane }))).toEqual([
      { id: "first", lane: 0 },
      { id: "second", lane: 1 },
    ]);
    expect(positioned[1].laneOffset).toBeGreaterThan(positioned[0].laneOffset);
  });

  it("reutilise une voie pour des periodes adjacentes", () => {
    const positioned = layoutPeriods([
      period("one", "2026-01-01", "2026-01-05"),
      period("two", "2026-01-06", "2026-01-10"),
    ], scale);
    expect(positioned.map(({ lane }) => lane)).toEqual([0, 0]);
  });

  it("retire un espace visuel de chaque cote des periodes", () => {
    const seriesPeriod = period("series", "2026-01-01", "2026-01-05");
    const regularPeriod = period("regular", "2026-01-01", "2026-01-05");

    expect(periodWidth(seriesPeriod, scale)).toBe(periodWidth(regularPeriod, scale));
    expect(periodStartOffset()).toBe(4);
  });

  it("augmente la hauteur d'une periode a libelle long et conserve le mode rectangle", () => {
    const [longLabel, rectangle] = layoutPeriods([
      period("long", "2026-01-01", "2026-01-01", "Un libelle tres long qui ne tient pas dans la periode"),
      period("rectangle", "2026-01-03", "2026-01-05", "Court", "rectangle"),
    ], scale);
    expect(longLabel.laneHeight).toBe(46);
    expect(rectangle.laneHeight).toBe(34);
  });
});