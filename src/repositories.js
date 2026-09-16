import { getSupabaseClient } from "../supabase/auth/auth.js";
import { loadStore, saveStore } from "./storage.js";
import { DEMO_ITEMS, DEMO_TIMELINE } from "./data.js";

function emptyStore() { return { timelines: [], items: [], recurrences: [], templates: [] }; }
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
function normalizeTemplate(template) {
  return {
    ...template,
    iterationDurationDays: template.iterationDurationDays ?? template.iteration_duration_days,
    numberOfIterations: template.numberOfIterations ?? template.number_of_iterations,
    iterationLabel: template.iterationLabel ?? template.iteration_label,
    iterationColor: template.iterationColor ?? template.iteration_color,
    iterationRenderMode: template.iterationRenderMode ?? template.iteration_render_mode,
    milestones: template.milestones || [],
    periods: template.periods || [],
  };
}

export class LocalTimelineRepository {
  async loadStore() { return loadStore(); }
  async saveStore(store) { saveStore(store); }
  async loadTimelines() { return loadStore().timelines; }
  async loadItems(timelineId) { return loadStore().items.filter(({ timeline_id }) => timeline_id === timelineId); }
  async createTimeline(store, data) { const timeline = { id: crypto.randomUUID(), public_token: crypto.randomUUID(), is_public: false, ...data }; store.timelines.push(timeline); return timeline; }
  async updateTimeline() {}
  async deleteTimeline(store, timelineId) { store.timelines = store.timelines.filter(({ id }) => id !== timelineId); store.items = store.items.filter(({ timeline_id }) => timeline_id !== timelineId); store.recurrences = store.recurrences.filter(({ timeline_id }) => timeline_id !== timelineId); }
  async createItem(store, item) { store.items.push(item); }
  async updateItem(store, item) { const index = store.items.findIndex(({ id }) => id === item.id); store.items[index] = item; }
  async deleteItem(store, itemId) { store.items = store.items.filter(({ id }) => id !== itemId); }
}

export class SupabaseTimelineRepository {
  constructor(user, isSandbox = false) { this.user = user; this.isSandbox = isSandbox; this.client = getSupabaseClient(); }
  async loadStore() {
    const [timelines, recurrences, items, assignments, templates] = await Promise.all([
      this.client.from("tl_timelines").select("id,name,start_date,end_date,theme,is_sandbox,is_public,public_token,template_id,template_start_date").eq("is_sandbox", this.isSandbox).order("created_at"),
      this.client.from("tl_recurrences").select("*").order("created_at"),
      this.client.from("tl_items").select("*").order("start_date"),
      this.client.from("tl_raci_assignments").select("item_id,role,person"),
      this.client.from("tl_templates").select("*").eq("is_sandbox", this.isSandbox).order("created_at")
    ]);
    [timelines, recurrences, items, assignments, templates].forEach(({ error }) => { if (error) throw new Error(error.message); });
    const store = { timelines: timelines.data || [], recurrences: recurrences.data || [], items: enrichRaci(items.data || [], assignments.data || []), templates: (templates.data || []).map(normalizeTemplate) };
    if (this.isSandbox && !store.timelines.length) return this.createSandboxDemo();
    return store;
  }
  async loadTimelines() { return (await this.loadStore()).timelines; }
  async loadItems(timelineId) { return (await this.loadStore()).items.filter((item) => item.timeline_id === timelineId); }
  async createTimeline(store, data) { const timeline = { id: crypto.randomUUID(), public_token: crypto.randomUUID(), is_public: false, ...data }; store.timelines.push(timeline); return timeline; }
  async updateTimeline() {}
  async deleteTimeline(store, timelineId) {
    const { error } = await this.client.from("tl_timelines").delete().eq("id", timelineId);
    if (error) throw new Error(error.message);
    store.timelines = store.timelines.filter(({ id }) => id !== timelineId);
    store.items = store.items.filter(({ timeline_id }) => timeline_id !== timelineId);
    store.recurrences = store.recurrences.filter(({ timeline_id }) => timeline_id !== timelineId);
  }
  async createItem(store, item) { store.items.push(item); }
  async updateItem(store, item) { const index = store.items.findIndex(({ id }) => id === item.id); store.items[index] = item; }
  async deleteItem(store, itemId) { store.items = store.items.filter(({ id }) => id !== itemId); }
  async saveStore(store) {
    const timelineRows = store.timelines.map(({ id, name, start_date, end_date, theme = "atelier", is_sandbox = this.isSandbox, is_public, public_token, template_id = null, template_start_date = null }) => ({ id, name, start_date, end_date, theme, is_sandbox, is_public, public_token, template_id, template_start_date, ...(is_sandbox ? { user_id: null } : {}) }));
    const itemRows = store.items.map(({ id, timeline_id, type, label, description = "", time = "", link_alias = "", link_url = "", start_date, end_date, color, render_mode = "bracket", recurrence_id }) => ({ id, timeline_id, type, label, description, time, link_alias, link_url, start_date, end_date, color, render_mode, recurrence_id }));
    const recurrenceRows = store.recurrences.map(({ id, timeline_id, type, frequency, interval, occurrences, start_date, duration, duration_unit }) => ({ id, timeline_id, type, frequency, interval, occurrences, start_date, duration, duration_unit }));
    const templateRows = (store.templates || []).map(({ id, name, description = "", iterationDurationDays, numberOfIterations, iterationLabel = "Iteration", iterationColor = "blue", iterationRenderMode = "rectangle", milestones = [], periods = [], is_sandbox = this.isSandbox }) => ({ id, name, description, iteration_duration_days: iterationDurationDays, number_of_iterations: numberOfIterations, iteration_label: iterationLabel, iteration_color: iterationColor, iteration_render_mode: iterationRenderMode, milestones, periods, is_sandbox, ...(is_sandbox ? { user_id: null } : {}) }));
    const timelineIds = store.timelines.map(({ id }) => id);
    const itemIds = store.items.filter(({ timeline_id }) => timelineIds.includes(timeline_id)).map(({ id }) => id);
    const deletedTemplates = await this.client.from("tl_templates").delete().eq("is_sandbox", this.isSandbox);
    if (deletedTemplates.error) throw new Error(deletedTemplates.error.message);
    if (templateRows.length) { const { error } = await this.client.from("tl_templates").upsert(templateRows); if (error) throw new Error(error.message); }
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
    const publicTokens = publicToken.split(",").map((token) => token.trim()).filter(Boolean);
    const { data: timelines, error: timelineError } = await this.client.from("tl_timelines").select("id,name,start_date,end_date,theme,is_sandbox,is_public,public_token").in("public_token", publicTokens).eq("is_public", true).order("created_at");
    if (timelineError) throw new Error(timelineError.message);
    if (!timelines?.length) throw new Error("Cette frise n'est pas disponible en consultation.");
    const timelineIds = timelines.map(({ id }) => id);
    const [recurrences, items, assignments] = await Promise.all([
      this.client.from("tl_recurrences").select("*").in("timeline_id", timelineIds).order("created_at"),
      this.client.from("tl_items").select("*").in("timeline_id", timelineIds).order("start_date"),
      this.client.from("tl_raci_assignments").select("item_id,role,person")
    ]);
    [recurrences, items, assignments].forEach(({ error }) => { if (error) throw new Error(error.message); });
    const itemIds = new Set((items.data || []).map(({ id }) => id));
    return { timelines, recurrences: recurrences.data || [], items: enrichRaci(items.data || [], (assignments.data || []).filter(({ item_id }) => itemIds.has(item_id))), templates: [] };
  }
}

export class SandboxTimelineRepository extends SupabaseTimelineRepository {
  constructor() { super(null, true); }
}