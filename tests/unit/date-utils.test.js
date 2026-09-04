import { describe, expect, it } from "vitest";
import { addDays, addMonths, compareDates, daysBetween, formatDate, formatHumanDate, isDateInRange, parseDate } from "../../src/engine/date-utils.js";

describe("date-utils", () => {
  it("normalise et formate les dates sans decalage", () => {
    expect(formatDate(parseDate("2026-02-03"))).toBe("2026-02-03");
    expect(formatDate(new Date(2026, 1, 3, 23, 59))).toBe("2026-02-03");
    expect(formatHumanDate("2026-02-03")).toMatch(/3\s+févr\.\s+2026/i);
  });

  it("calcule les ecarts et les bornes de maniere inclusive", () => {
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
    expect(daysBetween("2026-02-27", "2026-03-02")).toBe(3);
    expect(compareDates("2026-01-02", "2026-01-01")).toBeGreaterThan(0);
    expect(isDateInRange("2026-01-01", "2026-01-01", "2026-01-31")).toBe(true);
    expect(isDateInRange("2026-02-01", "2026-01-01", "2026-01-31")).toBe(false);
  });

  it("franchit correctement mois, annee et annee bissextile", () => {
    expect(formatDate(addDays("2024-02-28", 1))).toBe("2024-02-29");
    expect(formatDate(addDays("2026-12-31", 1))).toBe("2027-01-01");
    expect(formatDate(addMonths("2026-01-15", 2))).toBe("2026-03-15");
  });
});