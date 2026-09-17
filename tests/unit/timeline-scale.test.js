import { describe, expect, it } from "vitest";
import { createScale, dateToX, formatTick, generateCalendarContext, generateTicks, getScaleMode, xToDate } from "../../src/engine/timeline-scale.js";

const timeline = { start_date: "2026-01-01", end_date: "2026-01-31" };

describe("timeline-scale", () => {
  it("preserve une conversion date-position-date", () => {
    const scale = createScale(timeline, 10);
    expect(scale.width).toBe(900);
    expect(dateToX("2026-01-01", scale)).toBe(120);
    expect(dateToX("2026-01-11", scale)).toBe(220);
    expect(xToDate(220, scale)).toBe("2026-01-11");
  });

  it("respecte la largeur minimale et la largeur d'une longue frise", () => {
    expect(createScale(timeline, 1).width).toBe(900);
    expect(createScale({ start_date: "2026-01-01", end_date: "2027-01-01" }, 4).width).toBe(1568);
  });

  it("choisit les seuils de graduation attendus", () => {
    expect(getScaleMode(2).unit).toBe("quarter");
    expect(getScaleMode(3).unit).toBe("month");
    expect(getScaleMode(10).unit).toBe("week");
    expect(getScaleMode(26).unit).toBe("day");
  });

  it("genere les ticks et contextes calendaires adaptes au zoom", () => {
    const dayScale = createScale({ start_date: "2026-01-01", end_date: "2026-01-04" }, 26);
    const dayTicks = generateTicks(dayScale);
    expect(dayTicks.some((tick) => tick.date === "2026-01-01")).toBe(true);
    expect(dayTicks.filter((tick) => tick.isWeekend).length).toBeGreaterThan(2);
    expect(generateCalendarContext(dayScale).months.map(({ label }) => label)).toEqual(expect.arrayContaining(["décembre 2025", "janvier 2026"]));
    expect(formatTick(dayTicks.find((tick) => tick.date === "2026-01-01")).toString()).toBe("1");

    const weekScale = createScale(timeline, 10);
    expect(generateTicks(weekScale)).toEqual(expect.arrayContaining([expect.objectContaining({ date: "2026-01-05", mode: "week" })]));
    expect(generateCalendarContext(weekScale).weeks).toEqual([]);
  });

  it("affiche le mois qui contient le debut d'une frise", () => {
    const scale = createScale({ start_date: "2026-10-05", end_date: "2026-12-31" }, 3);
    const months = generateCalendarContext(scale).months;

    expect(months.map(({ label }) => label)).toEqual(expect.arrayContaining(["septembre 2026", "octobre 2026", "novembre 2026", "décembre 2026"]));
    expect(months.find(({ label }) => label === "octobre 2026").x).toBe(24);
  });
});