import { beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map();
const localStorage = {
  getItem: vi.fn((key) => values.get(key) ?? null),
  setItem: vi.fn((key, value) => values.set(key, value)),
  clear: () => values.clear(),
};

beforeEach(() => {
  values.clear();
  localStorage.getItem.mockClear();
  localStorage.setItem.mockClear();
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "generated-id") });
});

describe("storage local", () => {
  it("initialise le jeu de demonstration quand aucun stockage n'existe", async () => {
    const { loadStore } = await import("../../src/storage.js");
    const store = loadStore();
    expect(store.timelines).toHaveLength(1);
    expect(store.items).toHaveLength(14);
  });

  it("sauvegarde et recharge un store", async () => {
    const { loadStore, saveStore } = await import("../../src/storage.js");
    const store = { timelines: [{ id: "timeline-1" }], items: [], recurrences: [] };
    saveStore(store);
    expect(loadStore()).toEqual(store);
  });

  it("revient au jeu de demonstration si le JSON est corrompu", async () => {
    const { loadStore } = await import("../../src/storage.js");
    values.set("timeline-beta-v1", "{");
    expect(loadStore().items).toHaveLength(14);
  });

  it("cree, met a jour et supprime un element", async () => {
    const { createTimeline, deleteItem, saveItem } = await import("../../src/storage.js");
    const store = { timelines: [], items: [], recurrences: [] };
    const timeline = createTimeline(store, { name: "Nouvelle", start_date: "2026-01-01", end_date: "2026-01-31" });
    saveItem(store, { id: "item-1", timeline_id: timeline.id, label: "Initial" });
    saveItem(store, { id: "item-1", timeline_id: timeline.id, label: "Modifie" });
    deleteItem(store, "item-1");
    expect(store.timelines[0].id).toBe("generated-id");
    expect(store.items).toEqual([]);
    expect(localStorage.setItem).toHaveBeenCalledTimes(4);
  });
});