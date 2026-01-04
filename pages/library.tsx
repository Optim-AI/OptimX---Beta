// pages/campaigns.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "../app/web/src/components/ui/button";
import { Card, CardContent } from "../app/web/src/components/ui/card";
import { Plus, Search } from "lucide-react";
import { Input } from "../app/web/src/components/ui/input";
import Sidebar from "../app/web/src/components/Sidebar";
import { supabase } from '@/auth/supabase/client';
import { campaignClient } from '@/database/client-helpers';
import type { JSX } from "react";
// exact colors import path you requested — do NOT change
import colors from '@/lib/ui/colors';

type Campaign = {
  id: string;
  name: string;
  campaign_type: string | null;
  image_url?: string | null;
  is_published: boolean;
  created_at?: string;
  platform?: string | null;
  _raw?: Record<string, any>;
  [k: string]: any;
};

const { mutedForeground, gradientPrimary, primary } = (colors as any) || {};
const primaryColor = typeof primary === "string" ? primary : undefined;
const mutedFg = typeof mutedForeground === "string" ? mutedForeground : undefined;

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function CampaignsPage(): JSX.Element {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Try to fetch campaigns owned by the signed-in user.
   * We attempt a few common column names to be defensive:
   *  - user_id
   *  - created_by
   *  - owner
   *
   * If no user is present we redirect to signin.
   */
  async function fetchCampaigns() {
    setLoading(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();

      if (userErr) {
        console.error("Error getting user from supabase.auth:", userErr);
        // If we cannot get the user, treat as not-signed-in
        router.push("/auth/signin");
        return;
      }

      const user = (userData as any)?.user ?? null;
      if (!user) {
        // not signed in -> redirect to sign in
        router.push("/auth/signin");
        return;
      }

      // Use campaignClient.list() which handles user-scoped queries
      const result = await campaignClient.list();

      if (!result.success) {
        console.warn('campaigns query error:', result.error);
        setCampaigns([]);
        return;
      }

      const rows = result.data || [];

      if (!rows || rows.length === 0) {
        setCampaigns([]);
        return;
      }

      const normalized = (rows || []).map((c) => ({
        id: c.id ?? (c.name || Math.random()).toString(),
        name: c.name ?? "Untitled",
        campaign_type: c.campaign_type ?? c.type ?? null,
        image_url: c.image_url ?? c.image_url_public ?? c.preview_url ?? null,
        is_published: !!c.is_published,
        created_at: c.created_at ?? undefined,
        platform: c.platform ?? c.source ?? null,
        _raw: c,
      })) as Campaign[];

      setCampaigns(normalized);
    } catch (err) {
      console.error("Fetch error:", err);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = campaigns.filter((c) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (c.name ?? "").toLowerCase().includes(q) ||
      (c.platform ?? "").toLowerCase().includes(q) ||
      (c.campaign_type ?? "").toLowerCase().includes(q)
    );
  });

  // Open image in new tab if image exists; otherwise open campaign detail page
  const handleView = (campaign: Campaign) => {
    if (campaign.image_url) {
      // if it's a relative path, browser will resolve it; open in new tab
      window.open(campaign.image_url, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = `/campaigns/${campaign.id}`;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <main className="flex-1 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Campaigns</h1>
            <p className="text-sm" style={mutedFg ? { color: mutedFg } : undefined}>
              Manage your ad & post campaigns (only your campaigns are shown)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/create-campaign" legacyBehavior>
              <a>
                <Button
                  size="lg"
                  className="gradient-primary"
                  style={primaryColor ? { background: gradientPrimary ?? primaryColor } : undefined}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  New Campaign
                </Button>
              </a>
            </Link>

            <Button
              variant="outline"
              onClick={() => {
                fetchCampaigns();
              }}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Search */}
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

          <div>
            <Button variant="outline" onClick={() => setQuery("")}>
              Clear
            </Button>
          </div>
        </div>

        {/* Campaigns List */}
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
                  <div className="flex-1 pr-6">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-xl font-bold">{campaign.name}</h3>
                        <div className="text-sm mt-1" style={mutedFg ? { color: mutedFg } : undefined}>
                          {campaign.campaign_type ? `${campaign.campaign_type}` : "Campaign"} •{" "}
                          {fmtDate(campaign.created_at)}
                        </div>
                      </div>

                      {/* STATUS TEXT (plain text, not a button) */}
                      <div className="text-sm font-medium select-none self-start" aria-hidden>
                        {campaign.is_published ? "Active" : "Paused"}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" onClick={() => handleView(campaign)}>
                        View
                      </Button>
                    </div>
                  </div>

                  {/* Image on the right */}
                  <div className="w-40 h-28 flex-shrink-0 rounded overflow-hidden border border-slate-100 bg-white flex items-center justify-center">
                    {campaign.image_url ? (
                      <a href={campaign.image_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={campaign.image_url}
                          alt={campaign.name || "campaign image"}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ) : (
                      <div className="text-xs text-slate-500">No image</div>
                    )}
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
