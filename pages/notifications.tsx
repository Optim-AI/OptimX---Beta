// pages/notifications.tsx
"use client";
import type { JSX } from "react";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "../app/web/src/components/Sidebar";
import { supabase } from '@/auth/supabase/client';
import { apiFetch } from '@/api/fetch';

/**
 * Notifications page
 *
 * - Shows last 30 days of notifications merged from:
 *   1) campaigns (Supabase `campaigns` table) => "New campaign ran"
 *   2) integrations recent media => "New post", "New like", "New comment"
 *
 * - Minimal UI consistent with Analytics page.
 * - Stores "read" ids in localStorage under NOTIF_READ_KEY so Mark All Read works.
 */

type CampaignRow = {
  id: string;
  user_id?: string;
  name?: string;
  created_at?: string | null;
  is_published?: boolean;
  [k: string]: any;
};

type MediaItem = {
  id: string;
  caption?: string;
  media_type?: string;
  permalink?: string;
  timestamp?: string;
  likes?: number;
  comments?: number;
  [k: string]: any;
};

type Notification = {
  id: string; // unique id (prefix + original id)
  type: "campaign" | "post" | "like" | "comment";
  title: string;
  body?: string;
  url?: string;
  at: string; // ISO timestamp
  meta?: any;
};

const NOTIF_READ_KEY = "notifications_read_v1";

function timeAgo(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function normalizeIso(ts?: any) {
  if (!ts) return null;
  const parsed = Date.parse(String(ts));
  if (!isNaN(parsed)) return new Date(parsed).toISOString();
  return null;
}

export default function NotificationsPage(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [readIds, setReadIds] = useState<Record<string, true>>(() => {
    try {
      const v = localStorage.getItem(NOTIF_READ_KEY);
      return v ? JSON.parse(v) : {};
    } catch {
      return {};
    }
  });

  // last 30 days cutoff
  const cutoffIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, []);

  // sync read ids across tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === NOTIF_READ_KEY && e.newValue) {
        try {
          setReadIds(JSON.parse(e.newValue));
        } catch {}
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAll() {
    setLoading(true);
    setError(null);

    try {
      // get signed in user
      // ‹ CHANGED ›: scope campaigns to the signed-in user
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        console.warn("supabase.getUser error", userErr);
      }
      const userId = (userData as any)?.user?.id ?? (userData as any)?.id ?? null;

      if (!userId) {
        // not signed in, show nothing and bail
        setCampaigns([]);
        setMedia([]);
        setLoading(false);
        return;
      }

      // 1) Campaigns from Supabase within last 30 days, scoped to current user
      const { data: campData, error: campErr } = await supabase
        .from("campaigns")
        .select("*")
        .eq("user_id", userId) // ‹ CHANGED › ensure only current user's campaigns
        .gte("created_at", cutoffIso)
        .order("created_at", { ascending: false })
        .limit(50);

      if (campErr) {
        console.error("fetch campaigns error", campErr);
        setCampaigns([]);
      } else {
        setCampaigns((campData as any[]) ?? []);
      }

      // 2) Integrations recent media (defensive, best-effort)
      // We'll add userId to the query so backend can optionally filter by user.
      const sinceDate = cutoffIso.slice(0, 10); // YYYY-MM-DD
      try {
        // ‹ CHANGED ›: append userId param so server can filter results to the current user
        const res = await apiFetch(`/api/integrations/recent_media?since=${sinceDate}&userId=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const j = await res.json();
          // support different shapes: j.recent_media or j.compact?.recent_media or j.data
          let items: any[] = [];
          if (Array.isArray(j.recent_media)) items = j.recent_media;
          else if (j.compact && Array.isArray(j.compact.recent_media)) items = j.compact.recent_media;
          else if (Array.isArray(j.data)) items = j.data;
          else if (Array.isArray(j)) items = j;
          // normalize timestamps to ISO if possible
          const normalized = items
            .map((m: any) => {
              const iso = normalizeIso(m.timestamp) ?? new Date().toISOString();
              return {
                id: String(m.id),
                caption: m.caption,
                media_type: m.media_type,
                permalink: m.permalink,
                timestamp: iso,
                likes: typeof m.likes === "number" ? m.likes : (m.likes ? Number(m.likes) : 0),
                comments: typeof m.comments === "number" ? m.comments : (m.comments ? Number(m.comments) : 0),
                raw: m,
              };
            })
            .filter(Boolean) as MediaItem[];
          setMedia(normalized);
        } else {
          // try fallback JSON body text for debug, but do not set as error to avoid noise
          console.warn("/api/integrations/recent_media returned non-ok");
          setMedia([]);
        }
      } catch (e) {
        console.warn("recent media fetch failed", e);
        setMedia([]);
      }
    } catch (e: any) {
      console.error("notifications fetch error", e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // Build notifications from campaigns + media
  const notifications: Notification[] = useMemo(() => {
    const out: Notification[] = [];

    // campaigns -> "New campaign ran"
    for (const c of campaigns) {
      const at = c.created_at ?? new Date().toISOString();
      out.push({
        id: `campaign:${c.id}`,
        type: "campaign",
        title: `New campaign ran: ${c.name ?? "Untitled"}`,
        body: c.campaign_type ? `${c.campaign_type}` : undefined,
        url: `/campaigns/${c.id}`,
        at,
        meta: c,
      });
    }

    // media -> for each post, create a "New post" notification
    for (const m of media) {
      const at = m.timestamp ?? new Date().toISOString();
      out.push({
        id: `post:${m.id}`,
        type: "post",
        title: `New post: ${m.caption ? (m.caption.length > 90 ? m.caption.slice(0, 90) + "…" : m.caption) : "Untitled post"}`,
        body: m.media_type,
        url: m.permalink,
        at,
        meta: m,
      });

      // likes
      if ((m.likes ?? 0) > 0) {
        out.push({
          id: `like:${m.id}`,
          type: "like",
          title: `New like on post`,
          body: `${m.likes} like${m.likes === 1 ? "" : "s"}`,
          url: m.permalink,
          at,
          meta: m,
        });
      }

      // comments
      if ((m.comments ?? 0) > 0) {
        out.push({
          id: `comment:${m.id}`,
          type: "comment",
          title: `New comment on post`,
          body: `${m.comments} comment${m.comments === 1 ? "" : "s"}`,
          url: m.permalink,
          at,
          meta: m,
        });
      }
    }

    // sort by timestamp desc
    out.sort((a, b) => {
      const ta = new Date(a.at).getTime();
      const tb = new Date(b.at).getTime();
      return tb - ta;
    });

    // keep only last 30 days just in case
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return out.filter(n => new Date(n.at) >= cutoff).slice(0, 200);
  }, [campaigns, media]);

  function markAllRead() {
    const updated: Record<string, true> = { ...(readIds || {}) };
    for (const n of notifications) updated[n.id] = true;
    try {
      localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(updated));
    } catch {}
    setReadIds(updated);
  }

  function markRead(id: string) {
    const updated = { ...(readIds || {}) };
    updated[id] = true;
    try {
      localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(updated));
    } catch {}
    setReadIds(updated);
  }

  return (
    <div className="min-h-screen flex app-page">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Notifications</h2>

          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-500">
              Showing last 30 days
            </div>

            <button
              onClick={markAllRead}
              className="px-4 py-2 text-sm rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300"
            >
              Mark All Read
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Loading notifications…</div>
        ) : error ? (
          <div className="text-sm text-red-600">Error: {error}</div>
        ) : notifications.length === 0 ? (
          <div className="p-6 bg-white rounded-xl shadow-sm text-slate-500">
            No notifications in the last 30 days.
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((n) => {
              const isRead = Boolean(readIds[n.id]);
              const timeLabel = timeAgo(n.at);
              const icon =
                n.type === "campaign" ? "🚀" :
                n.type === "post" ? "🖼️" :
                n.type === "like" ? "❤️" :
                n.type === "comment" ? "💬" : "🔔";

              return (
                <div
                  key={n.id}
                  className={`p-5 rounded-xl border bg-white shadow-sm flex items-start transition-opacity ${isRead ? "opacity-60" : ""}`}
                >
                  <div className="text-2xl mr-3">{icon}</div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-800">
                          {n.url ? (
                            <a
                              href={n.url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline"
                              onClick={() => markRead(n.id)}
                            >
                              {n.title}
                            </a>
                          ) : (
                            <span>{n.title}</span>
                          )}
                        </div>

                        {n.body && (
                          <div className="text-sm text-slate-600 mt-1">
                            {n.body}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-slate-400">{timeLabel} ago</div>
                        {!isRead ? (
                          <button
                            onClick={() => markRead(n.id)}
                            className="mt-2 text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                          >
                            Mark read
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
