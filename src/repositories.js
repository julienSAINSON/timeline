import { getSupabaseClient } from "../supabase/auth/auth.js";
import { loadStore, saveStore } from "./storage.js";
import { DEMO_ITEMS, DEMO_TIMELINE } from "./data.js";

function emptyStore() { return { timelines: [], items: [], recurrences: [] }; }
function raciAssignments(items) {
  return items.flatMap((item) => {
    if (item.type !== "milestone" || !item.raci) return [];
    const raci = typeof item.raci === "string" ? JSON.parse(item.raci || "{}") : item.raci;
    return Object.entries(raci).flatMap(([role, people]) => String(people || "").split(",").map((person) => person.trim()).filter(Boolean).map((person) => ({ item_id: item.id, role, person })));
  });
}
function enrichRaci(items, assignments) {
  const grouped = new Map(items.map((item) => [item.id, {}]));
  assignments.forEach(({ item_id, role, person }) => {
    const raci = grouped.get(item_id);
    if (raci) raci[role] = [...(raci[role] || []), person];
  });
  return items.map((item) => ({ ...item, raci: JSON.stringify(Object.fromEntries(Object.entries(grouped.get(item.id) || {}).map(([role, people]) => [role, people.join(", ")])) ) }));
}

export class LocalTimelineRepository {
  async loadStore() { return loadStore(); }
  async saveStore(store) { saveStore(store); }
  async loadTimelines() { return loadStore().timelines; }
  async loadItems(timelineId) { return loadStore().items.filter(({ timeline_id }) => timeline_id === timelineId); }
  async createTimeline(store, data) { const timeline = { id: crypto.randomUUID(), public_token: crypto.randomUUID(), is_public: false, ...data }; store.timelines.push(timeline); return timeline; }
  async updateTimeline() {}
  async deleteTimeline(store, timelineId) { store.timelines = store.timelines.filter(({ id }) => id !== timelineId); store.items = store.items.filter(({ timeline_id }) => timeline_id !== timelineId); }
  async createItem(store, item) { store.items.push(item); }
  async updateItem(store, item) { const index = store.items.findIndex(({ id }) => id === item.id); store.items[index] = item; }
  async deleteItem(store, itemId) { store.items = store.items.filter(({ id }) => id !== itemId); }
}

export class SupabaseTimelineRepository {
  constructor(user, isSandbox = false) { this.user = user; this.isSandbox = isSandbox; this.client = getSupabaseClient(); }
  async loadStore() {
    const [timelines, recurrences, items, assignments] = await Promise.all([
      this.client.from("tl_timelines").select("id,name,start_date,end_date,is_sandbox,is_public,public_token").eq("is_sandbox", this.isSandbox).order("created_at"),
      this.client.from("tl_recurrences").select("*").order("created_at"),
      this.client.from("tl_items").select("*").order("start_date"),
      this.client.from("tl_raci_assignments").select("item_id,role,person")
    ]);
    [timelines, recurrences, items, assignments].forEach(({ error }) => { if (error) throw new Error(error.message); });
    const store = { timelines: timelines.data || [], recurrences: recurrences.data || [], items: enrichRaci(items.data || [], assignments.data || []) };
    if (this.isSandbox && !store.timelines.length) return this.createSandboxDemo();
    return store;
  }
  async loadTimelines() { return (await this.loadStore()).timelines; }
  async loadItems(timelineId) { return (await this.loadStore()).items.filter((item) => item.timeline_id === timelineId); }
  async createTimeline(store, data) { const timeline = { id: crypto.randomUUID(), public_token: crypto.randomUUID(), is_public: false, ...data }; store.timelines.push(timeline); return timeline; }
  async updateTimeline() {}
  async deleteTimeline(store, timelineId) { store.timelines = store.timelines.filter(({ id }) => id !== timelineId); store.items = store.items.filter(({ timeline_id }) => timeline_id !== timelineId); }
  async createItem(store, item) { store.items.push(item); }
  async updateItem(store, item) { const index = store.items.findIndex(({ id }) => id === item.id); store.items[index] = item; }
  async deleteItem(store, itemId) { store.items = store.items.filter(({ id }) => id !== itemId); }
  async saveStore(store) {
    const timelineRows = store.timelines.map(({ id, name, start_date, end_date, is_sandbox = this.isSandbox, is_public, public_token }) => ({ id, name, start_date, end_date, is_sandbox, is_public, public_token, ...(is_sandbox ? { user_id: null } : {}) }));
    const itemRows = store.items.map(({ id, timeline_id, type, label, description = "", link_alias = "", link_url = "", start_date, end_date, color, render_mode = "bracket", recurrence_id }) => ({ id, timeline_id, type, label, description, link_alias, link_url, start_date, end_date, color, render_mode, recurrence_id }));
    const recurrenceRows = store.recurrences.map(({ id, timeline_id, type, frequency, interval, occurrences, start_date, duration, duration_unit }) => ({ id, timeline_id, type, frequency, interval, occurrences, start_date, duration, duration_unit }));
    const timelineIds = store.timelines.map(({ id }) => id);
    const itemIds = store.items.filter(({ timeline_id }) => timelineIds.includes(timeline_id)).map(({ id }) => id);
    if (timelineRows.length) { const { error } = await this.client.from("tl_timelines").upsert(timelineRows); if (error) throw new Error(error.message); }
    if (timelineIds.length) {
      if (itemIds.length) { const assignments = await this.client.from("tl_raci_assignments").delete().in("item_id", itemIds); if (assignments.error) throw new Error(assignments.error.message); }
      const deletedItems = await this.client.from("tl_items").delete().in("timeline_id", timelineIds); if (deletedItems.error) throw new Error(deletedItems.error.message);
      const deletedRecurrences = await this.client.from("tl_recurrences").delete().in("timeline_id", timelineIds); if (deletedRecurrences.error) throw new Error(deletedRecurrences.error.message);
    }
    if (recurrenceRows.length) { const { error } = await this.client.from("tl_recurrences").upsert(recurrenceRows); if (error) throw new Error(error.message); }
    if (itemRows.length) { const { error } = await this.client.from("tl_items").upsert(itemRows); if (error) throw new Error(error.message); }
    const assignments = raciAssignments(store.items);
    if (assignments.length) { const { error } = await this.client.from("tl_raci_assignments").upsert(assignments, { onConflict: "item_id,role,person" }); if (error) throw new Error(error.message); }
  }
  async createSandboxDemo() {
    const timelineId = crypto.randomUUID();
    const store = {
      timelines: [{ ...DEMO_TIMELINE, id: timelineId, public_token: crypto.randomUUID(), is_sandbox: true }],
      items: DEMO_ITEMS.map((item) => ({ ...item, id: crypto.randomUUID(), timeline_id: timelineId })),
      recurrences: []
    };
    await this.saveStore(store);
    return store;
  }
}

export class PublicTimelineRepository {
  constructor() { this.client = getSupabaseClient(); }
  async loadStore(publicToken) {
    const { data: timeline, error: timelineError } = await this.client.from("tl_timelines").select("id,name,start_date,end_date,is_sandbox,is_public,public_token").eq("public_token", publicToken).eq("is_public", true).maybeSingle();
    if (timelineError) throw new Error(timelineError.message);
    if (!timeline) throw new Error("Cette frise n'est pas disponible en consultation.");
    const [recurrences, items, assignments] = await Promise.all([
      this.client.from("tl_recurrences").select("*").eq("timeline_id", timeline.id).order("created_at"),
      this.client.from("tl_items").select("*").eq("timeline_id", timeline.id).order("start_date"),
      this.client.from("tl_raci_assignments").select("item_id,role,person")
    ]);
    [recurrences, items, assignments].forEach(({ error }) => { if (error) throw new Error(error.message); });
    const itemIds = new Set((items.data || []).map(({ id }) => id));
    return { timelines: [timeline], recurrences: recurrences.data || [], items: enrichRaci(items.data || [], (assignments.data || []).filter(({ item_id }) => itemIds.has(item_id))) };
  }
}

export class SandboxTimelineRepository extends SupabaseTimelineRepository {
  constructor() { super(null, true); }
}