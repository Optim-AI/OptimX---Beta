"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

import { Card, CardContent } from "@/app/web/src/components/ui/card";
import { Button } from "@/app/web/src/components/ui/button";
import { Badge } from "@/app/web/src/components/ui/badge";
import {
  Check,
  X,
  Facebook,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";

import { supabase } from "@/auth/supabase/client";
import { apiFetch } from "@/api/fetch";
import colors from "@/lib/ui/colors";
import { isIntegrationBetaMode } from "@/integrations/mode";
import {
  deriveMetaUiState,
  type MetaStatusPayload,
  type MetaUiState,
} from "@/lib/ads/meta/ui-state";

const META_AUTH_PATH = "/api/meta/oauth/start";
const LS_KEY = "integrations_status_v1";

const {
  green100,
  green600,
  muted,
  mutedForeground,
  gradientPrimary,
} = (colors as any) || {};

type BetaStatus = "need_to_approve" | "pending" | "completed";

export type MetaStatus = MetaStatusPayload & {
  connected: boolean;
  healthMessage?: string;
};

export type IntegrationStatusMap = Record<string, boolean | MetaStatus>;

export type IntegrationsConnectPanelProps = {
  showHeader?: boolean;
  showFooter?: boolean;
  requireAuth?: boolean;
  onStatusesChange?: (statuses: IntegrationStatusMap) => void;
  oauthRedirectPath?: string;
};

function toStatusMap(meta: MetaStatusPayload): IntegrationStatusMap {
  return {
    meta: {
      connected: !!meta.connected,
      ...meta,
    },
  };
}

export function IntegrationsConnectPanel({
  showHeader = true,
  showFooter = true,
  requireAuth = true,
  onStatusesChange,
  oauthRedirectPath = "/integrations",
}: IntegrationsConnectPanelProps) {
  const router = useRouter();
  const [metaStatus, setMetaStatus] = useState<MetaStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);
  const onStatusesChangeRef = useRef(onStatusesChange);
  onStatusesChangeRef.current = onStatusesChange;

  const isBetaMode = isIntegrationBetaMode();
  const [betaStatus, setBetaStatus] = useState<BetaStatus>("need_to_approve");

  const ui: MetaUiState = deriveMetaUiState(
    syncBusy ? { ...metaStatus, syncStatus: "running" } : metaStatus
  );

  const publishStatuses = useCallback((meta: MetaStatusPayload) => {
    setMetaStatus(meta);
    const map = toStatusMap(meta);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(map));
    } catch {}
    onStatusesChangeRef.current?.(map);
  }, []);

  const fetchStatuses = useCallback(async () => {
    setLoading(true);
    try {
      // Prefer ads status (selected accounts + sync + pending session)
      const adsRes = await apiFetch("/api/ads/status");
      if (adsRes.ok) {
        const adsJson = await adsRes.json();
        const meta = (adsJson?.providers?.meta || {}) as MetaStatusPayload;
        publishStatuses(meta);
        setLoading(false);
        return;
      }

      const res = await apiFetch("/api/integrations/status");
      if (!res.ok) throw new Error("status_failed");
      const data = await res.json();
      const meta =
        data.meta && typeof data.meta === "object"
          ? (data.meta as MetaStatusPayload)
          : { connected: !!data.meta };
      publishStatuses(meta);
    } catch {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as IntegrationStatusMap;
          const meta =
            parsed.meta && typeof parsed.meta === "object"
              ? (parsed.meta as MetaStatusPayload)
              : { connected: !!parsed.meta };
          setMetaStatus(meta);
          onStatusesChangeRef.current?.(parsed);
        } else {
          publishStatuses({ connected: false });
        }
      } catch {
        publishStatuses({ connected: false });
      }
    } finally {
      setLoading(false);
    }
  }, [publishStatuses]);

  function isPopupClosed(popup: Window | null) {
    try {
      return !popup || popup.closed;
    } catch {
      return true;
    }
  }

  const openPopup = (url: string, name = "oauth_popup") => {
    const w = 900;
    const h = 700;
    const left = window.screenX + (window.innerWidth - w) / 2;
    const top = window.screenY + (window.innerHeight - h) / 2;
    const opts = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`;
    const absolute = new URL(url, window.location.origin).toString();
    const popup = window.open(absolute, name, opts);
    if (popup) {
      try {
        popup.focus();
      } catch {}
    }
    return popup;
  };

  const pollUntilSettled = (timeoutMs = 120000) => {
    const start = performance.now();
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = window.setInterval(async () => {
      try {
        await fetchStatuses();

        // Re-read via API directly for decision (state may lag one tick)
        const adsRes = await apiFetch("/api/ads/status");
        if (adsRes.ok) {
          const adsJson = await adsRes.json();
          const meta = (adsJson?.providers?.meta || {}) as MetaStatusPayload;
          const derived = deriveMetaUiState(meta);
          if (derived.isConnected || derived.awaitingAccountSelection) {
            if (derived.awaitingAccountSelection) {
              setMessage("Meta authorized — select Page & Ad Account");
            } else {
              setMessage("Meta connected");
            }
            setTimeout(() => setMessage(null), 3000);
            localStorage.removeItem("pending_connect");
            if (derived.isConnected) {
              popupRef.current?.close?.();
              popupRef.current = null;
            }
            clearInterval(pollRef.current!);
            pollRef.current = null;
            return;
          }
        }

        if (isPopupClosed(popupRef.current)) {
          await fetchStatuses();
          localStorage.removeItem("pending_connect");
          clearInterval(pollRef.current!);
          pollRef.current = null;
          popupRef.current = null;
          return;
        }
      } catch {}

      if (performance.now() - start > timeoutMs) {
        setMessage("sign-in timed out");
        localStorage.removeItem("pending_connect");
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setTimeout(() => setMessage(null), 2000);
      }
    }, 1500);
  };

  const getSupabaseAccessToken = async (): Promise<string | null> => {
    try {
      const { data } = await supabase.auth.getSession();
      return (data as any)?.session?.access_token ?? null;
    } catch {
      return null;
    }
  };

  const handleConnect = async () => {
    if (isBetaMode) {
      if (betaStatus === "need_to_approve" || betaStatus === "pending") {
        if (betaStatus === "pending") return;
        router.push("/integrationsbeta");
        return;
      }
    }

    try {
      let url = META_AUTH_PATH;
      const token = await getSupabaseAccessToken();
      try {
        const u = new URL(META_AUTH_PATH, window.location.origin);
        if (token) u.searchParams.set("sb", token);
        url = u.toString();
      } catch {}

      const popup = openPopup(url, "oauth_meta");
      popupRef.current = popup;
      localStorage.setItem("pending_connect", "meta");
      pollUntilSettled();
    } catch {
      setMessage("popup blocked — allow popups");
      setTimeout(() => setMessage(null), 2500);
    }
  };

  const handleSelectAccounts = () => {
    const sessionId = ui.sessionId;
    if (sessionId) {
      router.push(
        `/integrations/meta/select-assets?sessionId=${encodeURIComponent(sessionId)}`
      );
      return;
    }
    // Connected but missing selection — restart OAuth to refresh session assets
    handleConnect();
  };

  const handleDisconnect = async () => {
    try {
      await apiFetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "meta" }),
      });
      await fetchStatuses();
      setMessage("disconnected");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("failed to disconnect");
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const handleSync = async () => {
    setSyncBusy(true);
    setMessage("Syncing Meta Ads performance…");
    try {
      const res = await apiFetch("/api/ads/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "meta", lookbackDays: 30 }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || "Sync failed");
      }
      setMessage(
        `Sync complete (${json.metricsUpserted ?? 0} metric rows)`
      );
      await fetchStatuses();
    } catch (e: any) {
      setMessage(e?.message || "Sync failed");
      await fetchStatuses();
    } finally {
      setSyncBusy(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  // Popup opener handshake after finalize redirects here with query params
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.opener && !window.opener.closed) {
      const params = new URLSearchParams(window.location.search);
      const connected = params.get("connected");
      const status = params.get("status");
      if (connected === "meta" && status) {
        try {
          window.opener.postMessage(
            {
              type: "oauth_completed",
              platform: "meta",
              status,
              redirect: oauthRedirectPath,
            },
            "*"
          );
          setTimeout(() => window.close(), 800);
        } catch (e) {
          console.warn("Failed to postMessage to parent:", e);
        }
      }
    }
  }, [oauthRedirectPath]);

  // Refresh when landing with success query (same-window finalize)
  useEffect(() => {
    if (!router.isReady) return;
    const connected = router.query.connected;
    const status = router.query.status;
    if (connected === "meta") {
      fetchStatuses().then(() => {
        if (status === "success") {
          setMessage("Meta connected");
          setTimeout(() => setMessage(null), 2500);
        }
      });
      // Clear stale query without full reload
      router.replace(oauthRedirectPath, undefined, { shallow: true });
    }
  }, [router.isReady, router.query.connected, router.query.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;
        if (!user) {
          if (requireAuth) router.push("/auth/signin");
          return;
        }

        if (isBetaMode) {
          const { data: betaRow, error: betaErr } = await supabase
            .from("integrationsbeta")
            .select("status, instagram_username, facebook_username, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!betaErr && betaRow) {
            const s = String((betaRow as any).status ?? "").toLowerCase();
            const ig = (betaRow as any).instagram_username as string | null;
            const fb = (betaRow as any).facebook_username as string | null;
            const hasUsernames =
              (ig && ig.trim().length > 0) || (fb && fb.trim().length > 0);
            if (s === "completed") setBetaStatus("completed");
            else if (hasUsernames) setBetaStatus("pending");
            else setBetaStatus("need_to_approve");
          } else {
            setBetaStatus("need_to_approve");
          }
        }

        if (!mounted) return;
        await fetchStatuses();
      } catch (e) {
        console.warn("integrations init error", e);
        if (mounted) await fetchStatuses();
      }
    })();

    const onMessage = (e: MessageEvent) => {
      try {
        const data = e.data;
        if (data?.type === "oauth_completed" && data.platform === "meta") {
          fetchStatuses();

          if (data.status === "pending_selection") {
            // OAuth popup landed on select-assets. Do NOT close that window
            // until we hand selection off to the main window — otherwise the
            // user only sees /integrations and never the asset picker.
            const sid =
              typeof data.sessionId === "string" && data.sessionId
                ? data.sessionId
                : null;
            setMessage("Select Page & Ad Account to finish");
            setTimeout(() => setMessage(null), 3000);
            localStorage.removeItem("pending_connect");
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            if (sid) {
              const selectUrl = `/integrations/meta/select-assets?sessionId=${encodeURIComponent(sid)}`;
              try {
                popupRef.current?.close?.();
              } catch {}
              popupRef.current = null;
              router.push(selectUrl);
            }
            return;
          }

          if (data.status === "success") {
            setMessage("Meta connected");
          } else if (data.status === "cancelled") {
            setMessage("Connection cancelled");
          } else {
            setMessage("Connection failed");
          }
          setTimeout(() => setMessage(null), 3000);
          popupRef.current?.close?.();
          popupRef.current = null;
          localStorage.removeItem("pending_connect");
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {}
    };

    window.addEventListener("message", onMessage);
    return () => {
      mounted = false;
      window.removeEventListener("message", onMessage);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [router, isBetaMode, requireAuth, fetchStatuses]);

  const connectBtnStyle = gradientPrimary
    ? { background: gradientPrimary, border: "none" }
    : undefined;

  const statusIconConnected = ui.isConnected || ui.phase === "syncing" || ui.phase === "sync_failed";
  const statusBg = statusIconConnected ? green100 : muted;
  const statusIconColor = statusIconConnected ? green600 : mutedForeground;

  return (
    <div className="space-y-6">
      {showHeader ? (
        <div>
          <h1 className="text-3xl font-bold mb-2">integrations</h1>
          <p
            className={!mutedForeground ? "text-muted-foreground" : ""}
            style={mutedForeground ? { color: mutedForeground } : undefined}
          >
            connect your advertising platforms and tools
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card
          className="glass-card hover:shadow-2xl transition-all"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.22)" }}
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <Facebook className="w-10 h-10 text-[#0866FF]" />
              <div
                className="p-2 rounded-full"
                style={{ backgroundColor: statusBg || undefined }}
              >
                {ui.phase === "syncing" ? (
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    style={{ color: statusIconColor || undefined }}
                  />
                ) : statusIconConnected ? (
                  <Check
                    className="w-4 h-4"
                    style={{ color: statusIconColor || undefined }}
                  />
                ) : (
                  <X
                    className="w-4 h-4"
                    style={{ color: statusIconColor || undefined }}
                  />
                )}
              </div>
            </div>

            <h3 className="text-xl font-bold mb-2">Meta Ads</h3>
            <p
              className={`text-sm mb-4 ${!mutedForeground ? "text-muted-foreground" : ""}`}
              style={mutedForeground ? { color: mutedForeground } : {}}
            >
              Facebook & Instagram advertising performance
            </p>

            <div className="mb-3 space-y-2">
              {ui.phase === "needs_reconnect" ? (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Reconnect Required
                </Badge>
              ) : ui.phase === "pending_selection" ? (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1"
                  style={{
                    background: "hsl(45 93% 47% / 0.15)",
                    borderColor: "hsl(45 93% 47% / 0.4)",
                    color: "hsl(45 93% 60%)",
                  }}
                >
                  <Clock className="w-3 h-3" />
                  Select accounts
                </Badge>
              ) : ui.phase === "syncing" ? (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Syncing
                </Badge>
              ) : ui.phase === "sync_failed" ? (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Sync failed
                </Badge>
              ) : ui.phase === "connected" ? (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1"
                  style={{
                    background: "hsl(142 76% 36% / 0.15)",
                    borderColor: "hsl(142 76% 36% / 0.4)",
                    color: "#22c55e",
                  }}
                >
                  <Check className="w-3 h-3" />
                  Connected
                </Badge>
              ) : null}

              <p className="text-xs" style={{ color: colors.mutedForeground }}>
                {loading ? "checking integration status…" : ui.statusLabel}
              </p>

              {ui.phase === "connected" && ui.selectedAccountCount > 0 ? (
                <p className="text-xs" style={{ color: colors.mutedForeground }}>
                  {ui.selectedAccountCount} ad account selected
                  {ui.selectedAccountName ? ` · ${ui.selectedAccountName}` : ""}
                  {ui.hasMetrics ? " · metrics available" : " · no metrics synced yet"}
                </p>
              ) : null}

              {ui.phase === "sync_failed" && ui.syncErrorMessage ? (
                <p className="text-xs text-red-400">{ui.syncErrorMessage}</p>
              ) : null}
            </div>

            {ui.primaryAction === "connect" || ui.primaryAction === "reconnect" ? (
              <Button
                className="w-full"
                style={connectBtnStyle}
                disabled={loading || (isBetaMode && betaStatus === "pending")}
                onClick={handleConnect}
              >
                {isBetaMode && betaStatus === "need_to_approve"
                  ? "verify please"
                  : isBetaMode && betaStatus === "pending"
                    ? "verify"
                    : ui.primaryAction === "reconnect"
                      ? "Reconnect Meta Ads"
                      : "Connect Meta Ads"}
              </Button>
            ) : null}

            {ui.primaryAction === "select_accounts" ? (
              <Button className="w-full" style={connectBtnStyle} onClick={handleSelectAccounts}>
                Select accounts
              </Button>
            ) : null}

            {ui.primaryAction === "manage_accounts" ? (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSelectAccounts}
                >
                  Manage accounts
                </Button>
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  disabled={syncBusy}
                  onClick={handleSync}
                >
                  {syncBusy ? "Syncing…" : "Sync performance"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={handleDisconnect}
                >
                  Disconnect
                </Button>
              </>
            ) : null}

            {ui.primaryAction === "retry_sync" ? (
              <>
                <Button
                  className="w-full"
                  style={connectBtnStyle}
                  disabled={syncBusy}
                  onClick={handleSync}
                >
                  {syncBusy ? "Retrying…" : "Retry sync"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={handleSelectAccounts}
                >
                  Manage accounts
                </Button>
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={handleDisconnect}
                >
                  Disconnect
                </Button>
              </>
            ) : null}

            {ui.primaryAction === "none" && ui.phase === "syncing" ? (
              <Button className="w-full" disabled>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing…
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {showFooter ? (
        <div className="text-sm" style={{ color: colors.mutedForeground }}>
          {loading ? "checking integration status..." : "status synced."}
          {message && (
            <div className="mt-2 text-sm" style={{ color: "#22c55e" }}>
              {message}
            </div>
          )}
        </div>
      ) : message ? (
        <div className="text-sm" style={{ color: "#22c55e" }}>
          {message}
        </div>
      ) : null}
    </div>
  );
}

export default IntegrationsConnectPanel;
