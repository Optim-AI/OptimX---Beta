"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "../app/web/src/components/ui/button";
import { Card, CardContent } from "../app/web/src/components/ui/card";
import { Plus, Search, Filter } from "lucide-react";
import { Input } from "../app/web/src/components/ui/input";
import Sidebar from "../app/web/src/components/Sidebar";
import { supabase } from "../lib/supabaseClient";
import { apiFetch } from "../lib/apiFetch";

// exact colors import path you requested — do NOT change
import colors from "../lib/colors";

/**
 * Campaigns Page (Next.js, Tailwind v4)
 * - Shows ROAS/CTR/Spend for ads
 * - Shows Likes/Comments for posts (if present or fetched)
 * - Attempts to fetch campaign-level metrics from /api/campaigns/metrics?campaignId=<id> when necessary
 */

type Campaign = {
  id: string;
  name: string;
  campaign_type: string | null;
  image_url: any;
  is_published: boolean;
  created_at?: string;
  spend?: number | string | null;
  roas?: string | null;
  ctr?: string | null;
  impressions?: string | null;
  platform?: string | null;

  // social/post fields
  likes?: number | null;
  comments?: number | null;
};

const {
  primary,
  mutedForeground,
  gradientPrimary,
} = (colors as any) || {};

const primaryColor = typeof primary === "string" ? primary : undefined;
const mutedFg = typeof mutedForeground === "string" ? mutedForeground : undefined;

export default function CampaignsPage(): JSX.Element {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Record<string, any> | null>(null);
  const LS_KEY = "integrations_status_v1";

  useEffect(() => {
    fetchCampaigns();
    fetchStatuses();

    function onStorage(e: StorageEvent) {
      if (e.key === LS_KEY) {
        try {
          const parsed = e.newValue ? JSON.parse(e.newValue) : null;
          setStatuses(parsed);
        } catch {}
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching campaigns:", error);
        setCampaigns([]);
      } else {
        // normalize fields used by UI (backwards compatible with your static example)
        const normalized = (data as any[] || []).map((c) => ({
          id: c.id ?? (c.name || Math.random()).toString(),
          name: c.name ?? "Untitled",
          campaign_type: c.campaign_type ?? c.type ?? null,
          image_url: c.image_url ?? null,
          is_published: !!c.is_published,
          created_at: c.created_at ?? undefined,
          spend: c.spend ?? (c.spend_usd ? `$${c.spend_usd}` : undefined) ?? null,
          roas: c.roas ?? c.roas_text ?? null,
          ctr: c.ctr ?? null,
          impressions: Array.isArray(c.image_url) ? `${(c.image_url.length || 0)} imgs` : (c.impressions ?? null),
          platform: c.platform ?? c.source ?? (c.campaign_type ?? "Meta"),
          likes: (c.likes ?? c.social_likes) ?? null,
          comments: (c.comments ?? c.social_comments) ?? null,
        })) as Campaign[];

        setCampaigns(normalized);

        // After setting campaigns, try to fetch missing metrics where applicable
        // (do this after state is set to avoid race conditions)
        setTimeout(() => {
          normalized.forEach((camp) => {
            // If it's a post and likes/comments missing -> try fetch
            const isPost = String(camp.campaign_type ?? "").toLowerCase().includes("post");
            if (isPost && (camp.likes == null || camp.comments == null)) {
              fetchCampaignMetrics(camp.id);
            }
            // If it's an ad and roas/ctr/spend missing -> try fetch
            if (!isPost && (camp.roas == null || camp.ctr == null || camp.spend == null)) {
              fetchCampaignMetrics(camp.id);
            }
          });
        }, 200);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatuses = async () => {
    try {
      const res = await apiFetch("/api/integrations/status");
      if (res.ok) {
        const j = await res.json();
        setStatuses(j);
        try { localStorage.setItem(LS_KEY, JSON.stringify(j)); } catch {}
      }
    } catch (err) {
      // ignore
    }
  };

  /**
   * Try to fetch campaign-level metrics from a backend endpoint.
   * Expected response shape (any subset):
   * { likes?: number, comments?: number, roas?: string, ctr?: string, spend?: string }
   *
   * This function is intentionally defensive — if the endpoint doesn't exist or fails,
   * we silently ignore and keep whatever values are already present in the DB row.
   */
  const fetchCampaignMetrics = async (campaignId: string) => {
    try {
      const resp = await fetch(`/api/campaigns/metrics?campaignId=${encodeURIComponent(campaignId)}`);
      if (!resp.ok) return;
      const json = await resp.json();
      // Accept either { likes, comments } or { roas, ctr, spend } etc.
      setCampaigns((prev) =>
        prev.map((c) => {
          if (c.id !== campaignId) return c;
          return {
            ...c,
            likes: typeof json.likes === "number" ? json.likes : c.likes,
            comments: typeof json.comments === "number" ? json.comments : c.comments,
            roas: json.roas ?? c.roas,
            ctr: json.ctr ?? c.ctr,
            spend: json.spend ?? c.spend,
          };
        })
      );
    } catch (err) {
      // endpoint absent or failure — ignore to keep UI resilient
      // console.debug("campaign metrics fetch failed", err);
    }
  };

  const filtered = campaigns.filter((c) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (c.name ?? "").toLowerCase().includes(q) ||
      (c.platform ?? "").toLowerCase().includes(q) ||
      (c.campaign_type ?? "").toLowerCase().includes(q)
    );
  });

  const isMetaConnectedLocal = (s?: Record<string, any> | null) => {
    const st = s ?? statuses;
    if (!st) return false;
    if (st.meta === true) return true;
    if (typeof st.meta === "object" && (st.meta.connected === true || st.meta === true)) return true;
    for (const [k, v] of Object.entries(st)) {
      const low = k.toLowerCase();
      if (low.includes("meta") || low.includes("facebook") || low.includes("instagram")) {
        if (v === true) return true;
        if (typeof v === "object" && v.connected === true) return true;
        if (typeof v === "string" && v === "true") return true;
      }
    }
    return false;
  };

  const goToIntegrations = (platform?: string) => {
    if (platform) window.location.href = `/integrations?connected=${platform}`;
    else window.location.href = "/integrations";
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <main className="flex-1 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Campaigns</h1>
            <p className="text-sm" style={mutedFg ? { color: mutedFg } : undefined}>Manage and optimize your ad campaigns</p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/create-campaign" legacyBehavior>
              <a>
                <Button size="lg" className="gradient-primary" style={primaryColor ? { background: gradientPrimary ?? primaryColor } : undefined}>
                  <Plus className="w-5 h-5 mr-2" />
                  New Campaign
                </Button>
              </a>
            </Link>
            <Button variant="outline" onClick={() => { fetchCampaigns(); fetchStatuses(); }}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              className="pl-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>

        {/* Meta connection CTA */}
        {!isMetaConnectedLocal() && (
          <div className="mb-4 p-4 rounded-lg bg-yellow-50 border border-yellow-100 flex items-center justify-between">
            <div>
              <div className="font-medium">Meta not connected</div>
              <div className="text-sm text-slate-600">Connect your Facebook / Instagram account to see live campaign insights and auto-posting features.</div>
            </div>
            <div>
              <button onClick={() => goToIntegrations("meta")} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Connect Meta</button>
            </div>
          </div>
        )}

        {/* Campaigns Grid */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-sm text-slate-500">Loading campaigns...</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-slate-500">No campaigns found. Create one to get started.</div>
          ) : null}

          {filtered.map((campaign, i) => {
            const isPost = String(campaign.campaign_type ?? "").toLowerCase().includes("post");

            return (
              <Card key={campaign.id ?? i} className="glass-card hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">{campaign.name}</h3>
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            campaign.is_published ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          }`}
                        >
                          {campaign.is_published ? "Active" : "Paused"}
                        </div>
                      </div>
                      <p className="text-sm" style={mutedFg ? { color: mutedFg } : undefined}>
                        {(campaign.platform ?? "Meta")} • {campaign.impressions ?? "—"} impressions
                      </p>
                    </div>

                    <div className="flex items-center gap-8">
                      {/* Show Likes/Comments for posts, OR ROAS/CTR/Spend for ads */}
                      {isPost ? (
                        <>
                          <div className="text-center">
                            <div className="text-2xl font-bold">{campaign.likes ?? "—"}</div>
                            <div className="text-xs" style={mutedFg ? { color: mutedFg } : undefined}>Likes</div>
                          </div>

                          <div className="text-center">
                            <div className="text-2xl font-bold">{campaign.comments ?? "—"}</div>
                            <div className="text-xs" style={mutedFg ? { color: mutedFg } : undefined}>Comments</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-center">
                            <div
                              className="text-2xl font-bold"
                              style={primaryColor ? { color: primaryColor } : undefined}
                            >
                              {campaign.roas ?? "—"}
                            </div>
                            <div className="text-xs" style={mutedFg ? { color: mutedFg } : undefined}>ROAS</div>
                          </div>

                          <div className="text-center">
                            <div className="text-2xl font-bold">{campaign.ctr ?? "—"}</div>
                            <div className="text-xs" style={mutedFg ? { color: mutedFg } : undefined}>CTR</div>
                          </div>

                          <div className="text-center">
                            <div className="text-2xl font-bold">{campaign.spend ?? "—"}</div>
                            <div className="text-xs" style={mutedFg ? { color: mutedFg } : undefined}>Spend</div>
                          </div>
                        </>
                      )}

                      <div className="flex gap-2">
                        <Link href={`/campaigns/${campaign.id}/edit`} legacyBehavior>
                          <a><Button variant="outline" size="sm">Edit</Button></a>
                        </Link>
                        <Link href={`/campaigns/${campaign.id}`} legacyBehavior>
                          <a><Button variant="outline" size="sm">View</Button></a>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
