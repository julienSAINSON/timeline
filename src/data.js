export const COLORS = {
  blue: "#159bd7",
  green: "#31ae14",
  orange: "#f17b35",
  red: "#e72a32",
  violet: "#8759d6",
  rose: "#e04b89",
};

export const DEMO_TIMELINE = {
  id: "demo-roadmap-2026",
  name: "Roadmap produit",
  start_date: "2026-09-01",
  end_date: "2027-01-31",
  is_public: false,
  public_token: "demo-roadmap-2026",
};

export const DEMO_ITEMS = [
  ["period", "Sprint 4.4", "2026-09-07", "2026-09-25", "blue"],
  ["period", "Sprint 4.5", "2026-09-28", "2026-10-16", "blue"],
  ["period", "Sprint 4.6", "2026-10-19", "2026-11-20", "blue"],
  ["period", "Sprint 5.1", "2026-11-24", "2026-12-18", "blue"],
  ["milestone", "Aujourd'hui", "2026-09-18", null, "red"],
  ["milestone", "Perimetre fige", "2026-10-02", null, "green"],
  ["milestone", "Code fige", "2026-10-10", null, "green"],
  ["milestone", "Release figee", "2026-10-13", null, "green"],
  ["milestone", "Jalon recette", "2026-10-22", null, "green"],
  ["milestone", "MEP", "2026-12-09", null, "green"],
  ["annotation", "15 jours ouvres pour terminer nos developpements", "2026-09-07", "2026-10-10", "red"],
  ["annotation", "Semaines sans activite", "2026-11-03", "2026-11-24", "red"],
].map(([type, label, start_date, end_date, color], index) => ({
  id: `demo-item-${index + 1}`,
  timeline_id: DEMO_TIMELINE.id,
  type,
  label,
  start_date,
  end_date,
  color,
  recurrence_id: null,
}));