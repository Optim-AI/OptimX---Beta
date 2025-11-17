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
import type { JSX } from "react"; 
// exact colors import path you requested — do NOT change
import colors from "../lib/colors";

/**
 * Campaigns Page (Next.js, Tailwind v4)
 * - UI kept from your React component
 * - dynamic campaign list fetched from Supabase (same logic as your library.tsx)
 * - shows connect CTA if Meta not connected (reads integrations status)
 * - uses color tokens from your lib/colors when available, otherwise falls back to Tailwind classes
 */

type Campaign = {
  id: string;
  name: string;
  campaign_type: string | null;
  image_url: any;
  is_published: boolean;
  created_at?: string;
  spend?: number | string;
  roas?: string;
  ctr?: string;
  impressions?: string;
  platform?: string;
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
          spend: c.spend ?? (c.spend_usd ? `$${c.spend_usd}` : undefined),
          roas: c.roas ?? c.roas_text ?? undefined,
          ctr: c.ctr ?? undefined,
          impressions: Array.isArray(c.image_url) ? `${(c.image_url.length || 0)} imgs` : (c.impressions ?? undefined),
          platform: c.platform ?? c.source ?? (c.campaign_type ?? "Meta"),
        })) as Campaign[];

        setCampaigns(normalized);
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
            <Link href="/campaigns/create" legacyBehavior>
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

          {filtered.map((campaign, i) => (
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
          ))}
        </div>
      </main>
    </div>
  );
}
