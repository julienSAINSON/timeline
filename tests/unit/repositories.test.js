import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = [];
let responses;

vi.mock("../../supabase/auth/auth.js", () => ({
  getSupabaseClient: () => client,
}));

function query(table) {
  const response = () => responses[table] || { data: [], error: null };
  return {
    select: vi.fn(function select() { calls.push({ operation: "select", table }); return this; }),
    eq: vi.fn(function eq(column, value) { calls.push({ operation: "eq", table, column, value }); return this; }),
    order: vi.fn(function order(column) { calls.push({ operation: "order", table, column }); return this; }),
    maybeSingle: vi.fn(function maybeSingle() { calls.push({ operation: "maybeSingle", table }); return this; }),
    delete: vi.fn(function remove() { calls.push({ operation: "delete", table }); return this; }),
    in: vi.fn(function inFilter(column, values) { calls.push({ operation: "in", table, column, values }); return this; }),
    upsert: vi.fn((rows, options) => { calls.push({ operation: "upsert", table, rows, options }); return { error: null }; }),
    error: null,
    then: (resolve, reject) => Promise.resolve(response()).then(resolve, reject),
  };
}

const client = { from: vi.fn((table) => query(table)) };
const { PublicTimelineRepository, SupabaseTimelineRepository } = await import("../../src/repositories.js");

beforeEach(() => {
  calls.length = 0;
  client.from.mockClear();
  responses = {
    tl_timelines: { data: [], error: null },
    tl_recurrences: { data: [], error: null },
    tl_items: { data: [], error: null },
    tl_raci_assignments: { data: [], error: null },
    tl_templates: { data: [], error: null },
  };
});

describe("repositories Supabase", () => {
  it("enrichit les jalons avec les affectations RACI lors du chargement", async () => {
    responses.tl_timelines.data = [{ id: "timeline-1", is_sandbox: false }];
    responses.tl_items.data = [{ id: "item-1", type: "milestone", timeline_id: "timeline-1", label: "Jalon" }];
    responses.tl_raci_assignments.data = [
      { item_id: "item-1", role: "responsible", person: "Alice" },
      { item_id: "item-1", role: "responsible", person: "Bruno" },
    ];
    const store = await new SupabaseTimelineRepository({ id: "user-1" }).loadStore();
    expect(store.items[0].raci).toBe('{"responsible":"Alice, Bruno"}');
    expect(calls).toContainEqual({ operation: "eq", table: "tl_timelines", column: "is_sandbox", value: false });
  });

  it("persiste les timelines, elements, recurrents et affectations RACI", async () => {
    const repository = new SupabaseTimelineRepository({ id: "user-1" });
    await repository.saveStore({
      timelines: [{ id: "timeline-1", name: "Roadmap", start_date: "2026-01-01", end_date: "2026-01-31", theme: "jardin", is_public: false, public_token: "token" }],
      items: [{ id: "item-1", timeline_id: "timeline-1", type: "milestone", label: "Decision", start_date: "2026-01-10", end_date: null, color: "blue", raci: '{"responsible":"Alice, Bruno"}' }],
      recurrences: [{ id: "recurrence-1", timeline_id: "timeline-1", type: "milestone", frequency: "week", interval: 1, occurrences: 2, start_date: "2026-01-10" }],
    });
    expect(calls).toContainEqual(expect.objectContaining({ operation: "upsert", table: "tl_timelines" }));
    expect(calls).toContainEqual(expect.objectContaining({ operation: "upsert", table: "tl_timelines", rows: [expect.objectContaining({ theme: "jardin" })] }));
    expect(calls).toContainEqual(expect.objectContaining({ operation: "upsert", table: "tl_items" }));
    expect(calls).toContainEqual(expect.objectContaining({ operation: "upsert", table: "tl_recurrences" }));
    expect(calls).toContainEqual(expect.objectContaining({ operation: "upsert", table: "tl_raci_assignments", rows: expect.arrayContaining([
      { item_id: "item-1", role: "responsible", person: "Alice" },
      { item_id: "item-1", role: "responsible", person: "Bruno" },
    ]) }));
  });

  it("charge et persiste les modeles de cadence sans dates absolues", async () => {
    responses.tl_timelines.data = [{ id: "timeline-1", is_sandbox: false }];
    responses.tl_templates.data = [{
      id: "template-1",
      name: "Agile",
      iteration_duration_days: 14,
      number_of_iterations: 3,
      iteration_label: "Iteration",
      iteration_color: "blue",
      iteration_render_mode: "rectangle",
      milestones: [{ name: "Demo", position: { kind: "week-day", week: 2, dayOfWeek: 3 } }],
      periods: [{ name: "Build", startPosition: { kind: "first-day" }, endPosition: { kind: "day-of-iteration", day: 5 } }],
    }];
    const repository = new SupabaseTimelineRepository({ id: "user-1" });
    const store = await repository.loadStore();

    expect(store.templates[0]).toMatchObject({ id: "template-1", iterationDurationDays: 14, numberOfIterations: 3, periods: [{ name: "Build" }] });
    await repository.saveStore({ timelines: [], items: [], recurrences: [], templates: [store.templates[0]] });
    expect(calls).toContainEqual(expect.objectContaining({ operation: "upsert", table: "tl_templates", rows: [expect.objectContaining({ iteration_duration_days: 14, number_of_iterations: 3, periods: [{ name: "Build", startPosition: { kind: "first-day" }, endPosition: { kind: "day-of-iteration", day: 5 } }] })] }));
  });

  it("charge une consultation publique et filtre ses affectations RACI", async () => {
    responses.tl_timelines.data = [{ id: "public-1", is_public: true, public_token: "token" }];
    responses.tl_items.data = [{ id: "public-item", timeline_id: "public-1", type: "milestone", label: "Public" }];
    responses.tl_raci_assignments.data = [
      { item_id: "public-item", role: "accountable", person: "Claire" },
      { item_id: "private-item", role: "responsible", person: "Prive" },
    ];
    const store = await new PublicTimelineRepository().loadStore("token");
    expect(store.timelines).toHaveLength(1);
    expect(store.items[0].raci).toBe('{"accountable":"Claire"}');
    expect(calls).toContainEqual({ operation: "in", table: "tl_timelines", column: "public_token", values: ["token"] });
    expect(calls).toContainEqual({ operation: "eq", table: "tl_timelines", column: "is_public", value: true });
  });

  it("charge plusieurs frises pour une vue publique combinee", async () => {
    responses.tl_timelines.data = [
      { id: "public-1", is_public: true, public_token: "token-1" },
      { id: "public-2", is_public: true, public_token: "token-2" },
    ];
    responses.tl_items.data = [
      { id: "item-1", timeline_id: "public-1", type: "milestone", label: "Premier" },
      { id: "item-2", timeline_id: "public-2", type: "milestone", label: "Second" },
    ];

    const store = await new PublicTimelineRepository().loadStore("token-1,token-2");

    expect(store.timelines).toHaveLength(2);
    expect(store.items).toHaveLength(2);
    expect(calls).toContainEqual({ operation: "in", table: "tl_timelines", column: "public_token", values: ["token-1", "token-2"] });
    expect(calls).toContainEqual({ operation: "in", table: "tl_items", column: "timeline_id", values: ["public-1", "public-2"] });
  });

  it("refuse une consultation dont le token ne correspond a aucune frise publique", async () => {
    responses.tl_timelines.data = null;
    await expect(new PublicTimelineRepository().loadStore("missing")).rejects.toThrow("n'est pas disponible");
  });
});