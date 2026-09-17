import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = [];
const responses = new Map();
const client = {
  from: vi.fn((table) => {
    const query = {
      select: vi.fn(function select() { return this; }),
      or: vi.fn(function or(value) { calls.push({ table, operation: "or", value }); return this; }),
      eq: vi.fn(function eq(column, value) { calls.push({ table, operation: "eq", column, value }); return this; }),
      in: vi.fn(function inFilter(column, values) { calls.push({ table, operation: "in", column, values }); return this; }),
      order: vi.fn(function order() { return this; }),
      limit: vi.fn(function limit() { return this; }),
      upsert: vi.fn(function upsert(row, options) { calls.push({ table, operation: "upsert", row, options }); return this; }),
      single: vi.fn(function single() { return this; }),
      delete: vi.fn(function remove() { calls.push({ table, operation: "delete" }); return this; }),
      then: (resolve, reject) => Promise.resolve(responses.get(table) || { data: [], error: null }).then(resolve, reject),
    };
    return query;
  }),
};

vi.mock("../../supabase/auth/auth.js", () => ({ getSupabaseClient: () => client }));
const { searchTimelineUsers, shareTimeline, removeTimelineShare } = await import("../../src/timeline-sharing.js");

beforeEach(() => {
  calls.length = 0;
  responses.clear();
});

describe("timeline-sharing", () => {
  it("recherche des utilisateurs par nom ou email", async () => {
    responses.set("tl_profiles", { data: [{ user_id: "user-2", display_name: "Bob", email: "bob@example.com" }], error: null });

    await expect(searchTimelineUsers("bob")).resolves.toHaveLength(1);
    expect(calls).toContainEqual({ table: "tl_profiles", operation: "or", value: "display_name.ilike.%bob%,email.ilike.%bob%" });
  });

  it("cree ou met a jour un partage et peut le retirer", async () => {
    responses.set("tl_timeline_shares", { data: { id: "share-1", timeline_id: "timeline-1", user_id: "user-2", permission: "editor" }, error: null });

    await shareTimeline("timeline-1", "user-2", "editor");
    await removeTimelineShare("timeline-1", "user-2");

    expect(calls).toContainEqual(expect.objectContaining({ table: "tl_timeline_shares", operation: "upsert", row: { timeline_id: "timeline-1", user_id: "user-2", permission: "editor" } }));
    expect(calls).toContainEqual({ table: "tl_timeline_shares", operation: "delete" });
  });
});
