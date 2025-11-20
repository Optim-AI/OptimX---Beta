// lib/integrationStore.ts
import { supabaseAdmin } from "./supabaseClient";

export const PLATFORMS = ["meta", "google-ads", "whatsapp", "linkedin", "twitter"] as const;
export type PlatformId = (typeof PLATFORMS)[number];

type IntegrationRow = any;

/**
 * NOTE (security):
 * - This module exposes two different kinds of helpers:
 *   1) Global (admin) app_settings flags: getStatuses / setStatus
 *   2) Per-user integration helpers: getUserStatuses / setUserStatusForUser,
 *      saveIntegration(userId optional) and readSavedIntegration(userId optional)
 *
 * By default the integration read/write helpers are now user-scoped when a userId
 * is passed. They will NOT silently update or return another user's row.
 */

/* -------------------- Admin/global app_settings helpers -------------------- */

/** Get integration flags from app_settings (init if missing) — global (admin) flags */
export async function getStatuses(): Promise<Record<string, boolean>> {
  const key = "integrations_flags";
  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    let val = data?.value ?? null;
    if (!val) {
      val = {};
      PLATFORMS.forEach((p) => (val[p] = false));
      await supabaseAdmin.from("app_settings").insert([{ key, value: val }]);
    } else {
      PLATFORMS.forEach((p) => { if (typeof val[p] === "undefined") val[p] = false; });
    }
    return val;
  } catch (err) {
    const fallback: Record<string, boolean> = {};
    PLATFORMS.forEach((p) => (fallback[p] = false));
    return fallback;
  }
}

/** Set connection flag in app_settings — global (admin) flags */
export async function setStatus(platformId: string, connected: boolean): Promise<void> {
  const key = "integrations_flags";
  const current = await getStatuses();
  current[platformId] = connected;
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert([{ key, value: current }], { onConflict: "key" });
  if (error) throw error;
}

/* -------------------- Per-user integration flag helpers -------------------- */

/** Get per-user integration flags stored in app_settings_user (creates if missing) */
export async function getUserStatuses(userId: string): Promise<Record<string, boolean>> {
  if (!userId) throw new Error("getUserStatuses requires userId");
  const key = `integrations_flags_user:${userId}`;
  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    let val = data?.value ?? null;
    if (!val) {
      val = {};
      PLATFORMS.forEach((p) => (val[p] = false));
      await supabaseAdmin.from("app_settings").insert([{ key, value: val }]);
    } else {
      PLATFORMS.forEach((p) => { if (typeof val[p] === "undefined") val[p] = false; });
    }
    return val;
  } catch (err) {
    const fallback: Record<string, boolean> = {};
    PLATFORMS.forEach((p) => (fallback[p] = false));
    return fallback;
  }
}

/** Set per-user integration flag in app_settings (user-scoped) */
export async function setUserStatusForUser(userId: string, platformId: string, connected: boolean): Promise<void> {
  if (!userId) throw new Error("setUserStatusForUser requires userId");
  const key = `integrations_flags_user:${userId}`;
  const current = await getUserStatuses(userId);
  current[platformId] = connected;
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert([{ key, value: current }], { onConflict: "key" });
  if (error) throw error;
}

/* -------------------- Integration rows (user-scoped) -------------------- */

/**
 * Save or update integration row.
 * - IMPORTANT: store pageAccessToken in access_token column.
 * - If userId is provided, this will only upsert rows for that user (no cross-user updates).
 * - If userId is NOT provided, behavior is admin-style: find an existing provider row (last updated) or insert new.
 */
export async function saveIntegration(
  savedObj: any,
  options?: { userId?: string | null; provider?: string }
) {
  const provider = options?.provider ?? "meta";
  const userId = options?.userId ?? null;

  const pageAccessToken = savedObj?.pageAccessToken ?? savedObj?.page_access_token ?? null;
  const userAccessToken = savedObj?.userAccessToken ?? savedObj?.user_access_token ?? null;
  const pageId = savedObj?.pageId ?? savedObj?.page_id ?? null;
  const igUserId = savedObj?.igUserId ?? savedObj?.ig_user_id ?? null;
  const adAccountIdRaw = savedObj?.adAccountId ?? savedObj?.ad_account_id ?? null;
  const ad_account_id = typeof adAccountIdRaw === "string"
    ? adAccountIdRaw.replace(/^act_/, "").replace(/^act_act_/, "")
    : null;

  const metadata = {
    pageId,
    igUserId,
    adAccountIdRaw,
    savedAt: new Date().toISOString(),
  };

  const row: IntegrationRow = {
    user_id: userId,
    provider,
    provider_user_id: igUserId ?? pageId ?? null,
    ad_account_id: ad_account_id ?? null,
    page_id: pageId ?? null,
    ig_user_id: igUserId ?? null,
    // CRITICAL mapping:
    access_token: pageAccessToken ?? null,   // page token used for Graph calls
    refresh_token: userAccessToken ?? null,  // user token stored (optional)
    token_expires_at: savedObj?.token_expires_at ? new Date(savedObj.token_expires_at).toISOString() : null,
    scopes: savedObj?.scopes ?? null,
    raw: savedObj?.raw ?? savedObj,
    metadata: metadata,
  };

  try {
    let existingId: string | null = null;

    // If userId supplied: only look up rows for that user -> never touch other user's rows
    if (userId) {
      const { data, error } = await supabaseAdmin
        .from("integrations")
        .select("id")
        .eq("user_id", userId)
        .eq("provider", provider)
        .limit(1)
        .maybeSingle();
      if (!error && data?.id) existingId = data.id;

      // Also allow matching by page_id for that same user (if present)
      if (!existingId && pageId) {
        const { data: d2, error: e2 } = await supabaseAdmin
          .from("integrations")
          .select("id")
          .eq("user_id", userId)
          .eq("page_id", pageId)
          .eq("provider", provider)
          .limit(1)
          .maybeSingle();
        if (!e2 && d2?.id) existingId = d2.id;
      }

      // Also allow matching by ig_user_id for that same user (if present)
      if (!existingId && igUserId) {
        const { data: d3, error: e3 } = await supabaseAdmin
          .from("integrations")
          .select("id")
          .eq("user_id", userId)
          .eq("ig_user_id", igUserId)
          .eq("provider", provider)
          .limit(1)
          .maybeSingle();
        if (!e3 && d3?.id) existingId = d3.id;
      }
    } else {
      // Admin fallback: find a recent provider row (existing behavior)
      const { data, error } = await supabaseAdmin
        .from("integrations")
        .select("id")
        .eq("provider", provider)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (!error && Array.isArray(data) && data.length) existingId = data[0].id;
    }

    if (existingId) {
      // update only that specific row
      const { data, error } = await supabaseAdmin
        .from("integrations")
        .update(row)
        .eq("id", existingId)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    } else {
      // insert new row (with user_id possibly null for admin/global)
      const { data, error } = await supabaseAdmin
        .from("integrations")
        .insert([row])
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  } catch (err) {
    console.error("saveIntegration error:", err);
    throw err;
  }
}

/**
 * Read latest integration for provider and optional userId.
 * - If userId is provided, returns the latest integration row for that user and provider (or null).
 * - If userId is NOT provided, returns the latest provider row (admin fallback).
 *
 * IMPORTANT: to avoid leaking other users' tokens, prefer calling this with userId.
 */
export async function readSavedIntegration(options?: { userId?: string | null; provider?: string }) {
  const provider = options?.provider ?? "meta";
  const userId = options?.userId ?? null;
  try {
    let q = supabaseAdmin
      .from("integrations")
      .select("*")
      .eq("provider", provider)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (userId) q = q.eq("user_id", userId);

    const { data, error } = await q;
    if (error) {
      console.error("readSavedIntegration error:", error);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    const rebuilt = {
      createdAt: row.created_at ?? null,
      pageAccessToken: row.access_token ?? row.metadata?.pageAccessToken ?? null,
      userAccessToken: row.refresh_token ?? row.access_token ?? null,
      pageId: row.page_id ?? row.metadata?.pageId ?? null,
      igUserId: row.ig_user_id ?? row.metadata?.igUserId ?? null,
      adAccountId: row.ad_account_id ? `act_${row.ad_account_id}` : (row.metadata?.adAccountIdRaw ?? null),
      longUserToken: row.refresh_token ?? null,
      raw: row.raw ?? null,
      savedRowId: row.id ?? null,
      user_id: row.user_id ?? null,
    };

    return rebuilt;
  } catch (err) {
    console.error("readSavedIntegration fatal:", err);
    return null;
  }
}

/* -------------------- small admin helpers (tweak: allow user-scoped listing) -------------------- */

/** List integrations — if userId provided, list only that user's integrations. Otherwise admin list. */
export async function listIntegrations(provider?: string, userId?: string | null) {
  let q = supabaseAdmin.from("integrations").select("*").order("created_at", { ascending: false }) as any;
  if (provider) q = q.eq("provider", provider);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/** Delete integration by id (admin). Keep this explicit. */
export async function deleteIntegration(id: string) {
  const { error } = await supabaseAdmin.from("integrations").delete().eq("id", id);
  if (error) throw error;
  return true;
}
