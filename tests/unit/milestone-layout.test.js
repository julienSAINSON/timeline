import { describe, expect, it } from "vitest";
import { estimateLabelWidth, layoutMilestones, positionMilestoneLanes } from "../../src/engine/milestone-layout.js";
import { createScale } from "../../src/engine/timeline-scale.js";

const scale = createScale({ start_date: "2026-01-01", end_date: "2026-01-31" }, 20);
const milestone = (id, start_date, label = id) => ({ id, start_date, label });

describe("milestone-layout", () => {
  it("borne la largeur estimee des libelles", () => {
    expect(estimateLabelWidth("a")).toBe(116);
    expect(estimateLabelWidth("x".repeat(100))).toBe(240);
  });

  it("evite les recouvrements sur le meme cote et niveau", () => {
    const positioned = layoutMilestones([
      milestone("first", "2026-01-10", "Lancement produit"),
      milestone("second", "2026-01-10", "Validation client"),
      milestone("third", "2026-01-10", "Communication"),
    ], scale);
    const occupied = new Set();
    positioned.forEach(({ side, level }) => {
      const key = `${side}:${level}`;
      expect(occupied.has(key)).toBe(false);
      occupied.add(key);
    });
  });

  it("calcule des positions de cartes coherentes au-dessus et au-dessous de l'axe", () => {
    const laidOut = layoutMilestones([
      milestone("top", "2026-01-03"),
      milestone("bottom", "2026-01-20"),
    ], scale);
    const positioned = positionMilestoneLanes(laidOut, { axisTop: 280, calendarTop: 218, bottomTop: 340 });
    const top = positioned.find(({ side }) => side === "top");
    const bottom = positioned.find(({ side }) => side === "bottom");
    expect(top.cardTop + top.cardHeight).toBeLessThanOrEqual(210);
    expect(bottom.cardTop).toBeGreaterThanOrEqual(340);
    expect(positioned.every(({ axisTop }) => axisTop === 280)).toBe(true);
  });
});