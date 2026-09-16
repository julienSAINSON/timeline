import { DEMO_ITEMS, DEMO_TIMELINE } from "./data.js";

const STORAGE_KEY = "timeline-beta-v1";

function seed() {
  return { timelines: [DEMO_TIMELINE], items: DEMO_ITEMS, recurrences: [], templates: [] };
}

export function loadStore() {
  try {
    const store = JSON.parse(localStorage.getItem(STORAGE_KEY)) || seed();
    return { ...store, templates: store.templates || [] };
  } catch {
    return seed();
  }
}

export function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function createTimeline(store, data) {
  const timeline = { id: crypto.randomUUID(), public_token: crypto.randomUUID(), is_public: false, ...data };
  store.timelines.push(timeline);
  saveStore(store);
  return timeline;
}

export function saveItem(store, item) {
  const itemIndex = store.items.findIndex(({ id }) => id === item.id);
  if (itemIndex === -1) store.items.push(item);
  else store.items[itemIndex] = item;
  saveStore(store);
}

export function deleteItem(store, itemId) {
  store.items = store.items.filter(({ id }) => id !== itemId);
  saveStore(store);
}