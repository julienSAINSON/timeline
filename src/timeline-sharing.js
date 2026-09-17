import { getSupabaseClient } from "../supabase/auth/auth.js";

function client() { return getSupabaseClient(); }
function fail(error) { if (error) throw new Error(error.message); }

export async function searchTimelineUsers(search) {
  const value = String(search || "").trim().toLowerCase();
  if (!value) return [];
  const { data, error } = await client().from("tl_profiles").select("user_id,display_name,email").or(`display_name.ilike.%${value}%,email.ilike.%${value}%`).limit(10);
  fail(error);
  return data || [];
}

export async function getTimelineShares(timelineId) {
  const { data, error } = await client().from("tl_timeline_shares").select("id,timeline_id,user_id,permission,created_at,updated_at").eq("timeline_id", timelineId).order("created_at");
  fail(error);
  return data || [];
}

export async function getTimelineShareDetails(timelineId) {
  const shares = await getTimelineShares(timelineId);
  if (!shares.length) return [];
  const { data, error } = await client().from("tl_profiles").select("user_id,display_name,email").in("user_id", shares.map(({ user_id }) => user_id));
  fail(error);
  const profiles = new Map((data || []).map((profile) => [profile.user_id, profile]));
  return shares.map((share) => ({ ...share, profile: profiles.get(share.user_id) || null }));
}

export async function shareTimeline(timelineId, userId, permission) {
  if (!["viewer", "editor"].includes(permission)) throw new Error("Permission invalide.");
  const { data, error } = await client().from("tl_timeline_shares").upsert({ timeline_id: timelineId, user_id: userId, permission }, { onConflict: "timeline_id,user_id" }).select("id,timeline_id,user_id,permission").single();
  fail(error);
  return data;
}

export async function updateTimelinePermission(timelineId, userId, permission) {
  return shareTimeline(timelineId, userId, permission);
}

export async function removeTimelineShare(timelineId, userId) {
  const { error } = await client().from("tl_timeline_shares").delete().eq("timeline_id", timelineId).eq("user_id", userId);
  fail(error);
}
