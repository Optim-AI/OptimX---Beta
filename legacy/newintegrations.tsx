// "use client";

// import React, { useEffect, useRef, useState } from "react";
// import { useRouter } from "next/router";

// import Sidebar from "../app/web/src/components/Sidebar";
// import { Card, CardContent } from "../app/web/src/components/ui/card";
// import { Button } from "../app/web/src/components/ui/button";
// import { Check, X } from "lucide-react";

// import { supabase } from '@/auth/supabase/client';
// import { apiFetch } from "../lib/apiFetch";

// // exact path you provided — do NOT change
// import colors from '@/lib/ui/colors';

// /* ---------- Platforms (UI names + backend authPaths) ---------- */
// type Platform = {
//   id: string;
//   name: string;
//   icon: string;
//   authPath?: string;
//   desc?: string;
// };

// const PLATFORMS: Platform[] = [
//   { id: "meta", name: "Meta Ads", icon: "📘", authPath: "/api/auth/instagram/start", desc: "Facebook & Instagram ads" },
//   { id: "google-ads", name: "Google Ads", icon: "🔍", authPath: "/api/auth/google-ads/start", desc: "Search & Display campaigns" },
//   { id: "youtube", name: "YouTube Ads", icon: "▶️", authPath: "/api/auth/youtube/start", desc: "Video advertising" },
//   { id: "linkedin", name: "LinkedIn Ads", icon: "💼", authPath: "/api/auth/linkedin/start", desc: "B2B professional network" },
//   { id: "twitter", name: "X (Twitter)", icon: "𝕏", authPath: "/api/auth/twitter/start", desc: "Social media ads" },
//   { id: "shopify", name: "Shopify", icon: "🛍️", authPath: "/api/auth/shopify/start", desc: "E-commerce integration" },
//   { id: "stripe", name: "Stripe", icon: "💳", authPath: "/api/auth/stripe/start", desc: "Payment tracking" },
//   { id: "hubspot", name: "HubSpot", icon: "🎯", authPath: "/api/auth/hubspot/start", desc: "CRM integration" },
// ];

// const LS_KEY = "integrations_status_v1";

// /* ---------- color tokens from your file (graceful fallback) ---------- */
// const {
//   green100,
//   green600,
//   green900,
//   muted,
//   mutedForeground,
//   gradientPrimary,
// } = (colors as any) || {};

// /* ---------- Page component: backend logic + React-converted UI only ---------- */
// export default function IntegrationsPage() {
//   const router = useRouter();
//   const [statuses, setStatuses] = useState<Record<string, boolean>>({});
//   const [loading, setLoading] = useState(true);
//   const [message, setMessage] = useState<string | null>(null);
//   const popupRef = useRef<Window | null>(null);
//   const pollRef = useRef<number | null>(null);
//   const crossOriginSeen = useRef<Record<string, boolean>>({});

//   function isPopupClosed(popup: Window | null) {
//     try { return !popup || popup.closed; } catch { return true; }
//   }

//   const fetchStatuses = async () => {
//     setLoading(true);

//     // 1) Try Supabase app_settings.integrations_flags
//     try {
//       const { data, error } = await supabase
//         .from("app_settings")
//         .select("value")
//         .eq("key", "integrations_flags")
//         .maybeSingle();

//       if (!error && data && typeof (data as any).value !== "undefined" && (data as any).value !== null) {
//         let val: any = (data as any).value;
//         if (typeof val === "string") {
//           try { val = JSON.parse(val); } catch { /* keep string if parse fails */ }
//         }

//         const normalized: Record<string, boolean> = {};
//         PLATFORMS.forEach((p) => {
//           normalized[p.id] = !!(val && typeof val[p.id] !== "undefined" ? val[p.id] : false);
//         });

//         setStatuses(normalized);
//         if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(normalized));
//         setLoading(false);
//         return;
//       }
//     } catch {
//       // fallthrough
//     }

//     // 2) Try status API
//     try {
//       const res = await apiFetch("/api/integrations/status");
//       if (!res.ok) throw new Error("status endpoint returned " + res.status);
//       const data = await res.json();

//       const next: Record<string, boolean> = {};
//       const hasPlatformKeys = PLATFORMS.some((p) => typeof (data || {})[p.id] !== "undefined");
//       if (hasPlatformKeys) {
//         PLATFORMS.forEach((p) => (next[p.id] = !!(data[p.id])));
//       } else {
//         // older behaviour: map meta to meta (if present), else all false
//         PLATFORMS.forEach((p) => (next[p.id] = p.id === "meta" ? !!data.meta : false));
//       }

//       setStatuses(next);
//       if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(next));
//       setLoading(false);
//       return;
//     } catch {
//       // fallthrough
//     }

//     // 3) localStorage fallback
//     const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
//     if (raw) {
//       try {
//         setStatuses(JSON.parse(raw));
//         setLoading(false);
//         return;
//       } catch { /* ignore */ }
//     }

//     // 4) final fallback: all false
//     const initial: Record<string, boolean> = {};
//     PLATFORMS.forEach((p) => (initial[p.id] = false));
//     setStatuses(initial);
//     if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(initial));
//     setLoading(false);
//   };

//   useEffect(() => {
//     fetchStatuses();

//     const onMessage = (e: MessageEvent) => {
//       try {
//         const data = e.data;
//         if (!data) return;
//         if (data.type === "oauth_connected" && data.platform) {
//           const platformId = data.platform as string;
//           setStatuses((s) => {
//             const next = { ...s, [platformId]: true };
//             localStorage.setItem(LS_KEY, JSON.stringify(next));
//             return next;
//           });
//           if (popupRef.current && !popupRef.current.closed) try { popupRef.current.close(); } catch {}
//           popupRef.current = null;
//           localStorage.removeItem("pending_connect");
//           setMessage(`${platformId} connected`);
//           setTimeout(() => setMessage(null), 2500);
//           if (data.redirect) router.push(data.redirect);
//         }
//       } catch (err) { console.warn("Ignored message", err); }
//     };

//     window.addEventListener("message", onMessage);

//     if (router.isReady) {
//       const q = router.query.connected as string | undefined;
//       if (q) {
//         setStatuses((s) => {
//           const next = { ...s, [q]: true };
//           if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(next));
//           return next;
//         });
//         const { connected, ...rest } = router.query;
//         router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
//         setMessage(`${q} connected successfully`);
//         setTimeout(() => setMessage(null), 3000);
//       }
//     }

//     if (typeof window !== "undefined") {
//       const pending = localStorage.getItem("pending_connect");
//       if (pending) pollStatusFor(pending);
//     }

//     return () => {
//       window.removeEventListener("message", onMessage);
//       if (pollRef.current) window.clearInterval(pollRef.current);
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [router.isReady]);

//   const openPopup = (url: string, name = "oauth_popup") => {
//     const w = 900, h = 700;
//     const left = window.screenX + (window.innerWidth - w) / 2;
//     const top = window.screenY + (window.innerHeight - h) / 2;
//     const opts = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`;
//     const absolute = new URL(url, window.location.origin).toString();
//     const popup = window.open(absolute, name, opts);
//     if (popup) try { popup.focus(); } catch {}
//     return popup;
//   };

//   const pollStatusFor = (platformId: string, timeoutMs = 60_000) => {
//     const start = Date.now();
//     if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
//     crossOriginSeen.current[platformId] = false;

//     pollRef.current = window.setInterval(async () => {
//       try {
//         if (isPopupClosed(popupRef.current)) {
//           if (crossOriginSeen.current[platformId]) {
//             setStatuses((s) => { const next = { ...s, [platformId]: true }; localStorage.setItem(LS_KEY, JSON.stringify(next)); return next; });
//             localStorage.removeItem("pending_connect");
//             setMessage(`${platformId} connected`); setTimeout(() => setMessage(null), 2500);
//           } else { await fetchStatuses(); }
//           window.clearInterval(pollRef.current!); pollRef.current = null; popupRef.current = null; return;
//         }

//         try {
//           if (popupRef.current) {
//             const href = popupRef.current.location.href;
//             if (href) {
//               try {
//                 const u = new URL(href);
//                 const q = u.searchParams.get("connected");
//                 if (q === platformId) {
//                   setStatuses((s) => { const next = { ...s, [platformId]: true }; localStorage.setItem(LS_KEY, JSON.stringify(next)); return next; });
//                   if (popupRef.current && !popupRef.current.closed) try { popupRef.current.close(); } catch {}
//                   popupRef.current = null;
//                   localStorage.removeItem("pending_connect");
//                   setMessage(`${platformId} connected`); setTimeout(() => setMessage(null), 2500);
//                   window.clearInterval(pollRef.current!); pollRef.current = null; return;
//                 }
//               } catch {}
//             }
//           }
//         } catch { crossOriginSeen.current[platformId] = true; }

//         const res = await apiFetch("/api/integrations/status");
//         if (res.ok) {
//           const data = await res.json();
//           setStatuses((s) => ({ ...s, ...(data || {}) }));
//           if (data && data[platformId]) {
//             setMessage(`${platformId} connected`);
//             if (popupRef.current && !popupRef.current.closed) try { popupRef.current.close(); } catch {}
//             localStorage.removeItem("pending_connect");
//             window.clearInterval(pollRef.current!); pollRef.current = null; popupRef.current = null;
//             setTimeout(() => setMessage(null), 2500); return;
//           }
//         } else {
//           if (crossOriginSeen.current[platformId] && isPopupClosed(popupRef.current)) {
//             setStatuses((s) => { const next = { ...s, [platformId]: true }; localStorage.setItem(LS_KEY, JSON.stringify(next)); return next; });
//             localStorage.removeItem("pending_connect");
//             setMessage(`${platformId} connected`);
//             setTimeout(() => setMessage(null), 2500);
//             window.clearInterval(pollRef.current!); pollRef.current = null; popupRef.current = null; return;
//           }
//         }
//       } catch (err) { /* ignore */ }

//       if (Date.now() - start > timeoutMs) {
//         setMessage("Sign-in timed out — try again");
//         if (popupRef.current && !popupRef.current.closed) try { popupRef.current.close(); } catch {}
//         localStorage.removeItem("pending_connect");
//         window.clearInterval(pollRef.current!); pollRef.current = null; popupRef.current = null;
//         setTimeout(() => setMessage(null), 2500);
//       }
//     }, 1200);
//   };

//   const getSupabaseAccessToken = async (): Promise<string | null> => {
//     try {
//       const { data } = await supabase.auth.getSession();
//       return (data as any)?.session?.access_token ?? null;
//     } catch { return null; }
//   };

//   const handleConnect = async (platform: Platform) => {
//     if (!platform.authPath) {
//       setStatuses((s) => { const next = { ...s, [platform.id]: true }; localStorage.setItem(LS_KEY, JSON.stringify(next)); return next; });
//       setMessage(`${platform.name} connected (local demo)`); setTimeout(() => setMessage(null), 2000); return;
//     }

//     try {
//       let url = platform.authPath;
//       try {
//         const token = await getSupabaseAccessToken();
//         if (token) {
//           const u = new URL(platform.authPath as string, window.location.origin);
//           u.searchParams.set("sb", token);
//           url = u.toString();
//         } else url = new URL(platform.authPath as string, window.location.origin).toString();
//       } catch { url = new URL(platform.authPath as string, window.location.origin).toString(); }

//       const popup = openPopup(url, `oauth_${platform.id}`);
//       popupRef.current = popup;
//       if (typeof window !== "undefined") localStorage.setItem("pending_connect", platform.id);
//       pollStatusFor(platform.id);
//     } catch {
//       setMessage("Failed to open OAuth popup. Please allow popups for this site.");
//       setTimeout(() => setMessage(null), 3000);
//     }
//   };

//   const handleDisconnect = async (platformId: string) => {
//     try {
//       await apiFetch("/api/integrations/disconnect", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ platform: platformId }),
//       });
//       await fetchStatuses();
//       setMessage("Disconnected"); setTimeout(() => setMessage(null), 2000);
//     } catch {
//       setMessage("Failed to disconnect"); setTimeout(() => setMessage(null), 2000);
//     }
//   };

//   /* ---------- UI: ONLY the React-converted card grid + header (no legacy list) ---------- */
//   return (
//     <div className="min-h-screen flex bg-slate-50">
//       <Sidebar />

//       <main className="flex-1 p-8">

//         <div className="p-6 space-y-6">
//           {/* Header (React converted UI header) */}
//           <div>
//             <h1 className="text-3xl font-bold mb-2">Integrations</h1>
//             <p
//               // fallback to tailwind class if mutedForeground not provided
//               style={mutedForeground ? { color: mutedForeground } : undefined}
//               className={!mutedForeground ? "text-muted-foreground" : ""}
//             >
//               Connect your advertising platforms and tools
//             </p>
//           </div>

//           {/* Platforms Grid — React converted UI cards only */}
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//             {PLATFORMS.map((platform, i) => {
//               const connected = !!statuses[platform.id];

//               const statusBg = connected
//                 ? green100 ?? undefined
//                 : muted ?? undefined;

//               const statusIconColor = connected
//                 ? green600 ?? undefined
//                 : mutedForeground ?? undefined;

//               const connectBtnStyle = !connected && (gradientPrimary as string | undefined)
//                 ? { background: gradientPrimary as string, border: "none" }
//                 : undefined;

//               return (
//                 <Card key={i} className="glass-card hover:shadow-lg transition-all">
//                   <CardContent className="pt-6">
//                     <div className="flex items-start justify-between mb-4">
//                       <div className="text-5xl">{platform.icon}</div>

//                       <div
//                         className={`p-2 rounded-full ${!statusBg ? (connected ? "bg-green-100 dark:bg-green-900/30" : "bg-muted") : ""
//                           }`}
//                         style={statusBg ? { backgroundColor: statusBg, boxShadow: "inset 0 0 0 9999px rgba(0,0,0,0)" } : undefined}
//                         aria-hidden
//                       >
//                         {connected ? (
//                           <Check
//                             className="w-4 h-4"
//                             style={statusIconColor ? { color: statusIconColor } : undefined}
//                           />
//                         ) : (
//                           <X
//                             className="w-4 h-4"
//                             style={statusIconColor ? { color: statusIconColor } : undefined}
//                           />
//                         )}
//                       </div>
//                     </div>

//                     <h3 className="text-xl font-bold mb-2">{platform.name}</h3>

//                     <p
//                       className={!mutedForeground ? "text-sm text-muted-foreground mb-4" : "text-sm mb-4"}
//                       style={mutedForeground ? { color: mutedForeground } : undefined}
//                     >
//                       {platform.desc}
//                     </p>

//                     <Button
//                       variant={connected ? "outline" : "default"}
//                       className={!connected ? "gradient-primary w-full" : "w-full"}
//                       style={!connected ? connectBtnStyle : undefined}
//                       onClick={() => (connected ? handleDisconnect(platform.id) : handleConnect(platform))}
//                     >
//                       {connected ? "Disconnect" : "Connect"}
//                     </Button>
//                   </CardContent>
//                 </Card>
//               );
//             })}
//           </div>
//         </div>

//         <div className="mt-8 p-5 rounded-xl border bg-blue-50 text-slate-700 shadow-sm">
//           <h3 className="font-semibold">🔒 Security Notice</h3>
//           <p className="text-sm mt-2">
//             API tokens should be stored server-side and encrypted at rest. For production: tighten postMessage origins, use PKCE and server-side token exchange, and store refresh tokens in a DB.
//           </p>
//         </div>

//         <div className="mt-4 text-sm text-slate-500">
//           {loading ? "Checking integration status..." : "Status synced."}
//           {message && <div className="mt-2 text-sm text-green-700">{message}</div>}
//         </div>
//       </main>
//     </div>
//   );
// }
