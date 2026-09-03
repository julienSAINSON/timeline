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
  name: "Roadmap Produit 2026",
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  is_public: false,
  public_token: "demo-roadmap-2026",
};

export const DEMO_ITEMS = [
  ["period", "Sprint 1", "2026-01-05", "2026-02-06", "blue"],
  ["period", "Sprint 2", "2026-02-09", "2026-03-13", "blue"],
  ["period", "Sprint 3", "2026-03-16", "2026-04-17", "blue"],
  ["period", "Sprint 4", "2026-04-20", "2026-05-22", "blue"],
  ["period", "Sprint 5", "2026-05-25", "2026-06-26", "blue"],
  ["period", "Sprint 6", "2026-06-29", "2026-07-31", "blue"],
  ["milestone", "Kick-off", "2026-01-05", null, "green"],
  ["milestone", "Perimetre fige", "2026-02-20", null, "green"],
  ["milestone", "Code fige", "2026-05-29", null, "orange"],
  ["milestone", "Release", "2026-06-26", null, "orange"],
  ["milestone", "Recette", "2026-07-17", null, "red"],
  ["milestone", "MEP", "2026-07-31", null, "red"],
  ["annotation", "15 jours ouvres pour terminer nos developpements", "2026-04-20", "2026-05-08", "red"],
  ["annotation", "Semaine sans activite", "2026-08-03", "2026-08-07", "red"],
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