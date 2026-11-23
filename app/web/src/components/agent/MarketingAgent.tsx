// Marketing Agent: a marketing strategist chat that knows the brand.
// Home (big composer + Recents) and a chat view, with a side panel for
// Instructions, Context, Memory and Scheduled tasks.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowUp, BookOpen, CalendarClock, Brain, Check, ListChecks, MoreHorizontal, Pencil, Search, Square, Trash2, X,
} from "lucide-react";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { friendlyError } from "@/lib/api-errors";
import AgentMarkdown from "./AgentMarkdown";
import AgentOrb from "./AgentOrb";
import { TasksPanel, describeCadence, type AgentTask } from "./AgentTasks";
import { ActionCard, type AgentActionUI, type PosterOptions } from "./AgentActions";
import { ContextPanel, MemoryPanel, type Automatic, type ContextItem, type Memory } from "./AgentPanels";

type Session = { id: string; title: string; source: string; unread: boolean; createdAt: string; updatedAt: string };
type Remembered = { id: string; fact: string; undone?: boolean };
type Message = { id: string; role: "user" | "assistant"; content: string; used: string[]; pending?: boolean; failed?: boolean; remembered?: Remembered[]; actions?: AgentActionUI[]; next?: string };
type Settings = { instructions: string; tagline: string | null };

const STARTERS = [
  "Plan this week's posts",
  "Ideas for the next festival",
  "How do I stand out from competitors?",
]

const LINE = "hsl(0 0% 100% / 0.08)";

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  const d = Math.floor(s / 86400);
  if (d < 7) return d === 1 ? "yesterday" : `${d} days ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Reads server-sent events from /api/agent/chat. */
async function streamChat(body: { sessionId?: string; message: string }, signal: AbortSignal, on: (ev: any) => void) {
  const res = await authFetch("/api/agent/chat", { method: "POST", body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error || "Sorry, I couldn't reply just now. Please try again.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try { on(JSON.parse(line.slice(5))); } catch { /* ignore */ }
    }
  }
}

// ---------- Composer ----------
function Composer({ big, busy, onSend, onStop, placeholder, autoFocus }: {
  big?: boolean; busy: boolean; onSend: (text: string) => void; onStop: () => void; placeholder: string; autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  // Focus without scrolling the page (the native autoFocus jumps the home view down).
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, big ? 280 : 200)}px`;
  }, [text, big]);
  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSend(t);
    setText("");
  };
  return (
    <div className="rounded-2xl border transition-colors focus-within:border-[hsl(213_100%_55%/0.6)]" style={{ background: colors.card, borderColor: colors.border }}>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
        }}
        rows={big ? 3 : 1}
        maxLength={6000}
        placeholder={placeholder}
        aria-label="Message your marketing agent"
        className={`block w-full resize-none bg-transparent px-4 outline-none placeholder:text-[hsl(0_0%_45%)] ${big ? "pt-4 text-[15px] min-h-[96px]" : "pt-3 text-[14.5px]"}`}
        style={{ color: colors.foreground }}
      />
      <div className="flex items-center justify-between px-3 pb-3 pt-1">
        <span className="pl-1 text-[11px]" style={{ color: colors.mutedForeground }}>
          {big ? "Enter to send · Shift + Enter for a new line" : ""}
        </span>
        {busy ? (
          <button type="button" onClick={onStop} aria-label="Stop" title="Stop"
            className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: colors.secondary, color: colors.foreground }}>
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={!text.trim()} aria-label="Send" title="Send"
            className="flex h-9 w-9 items-center justify-center rounded-full transition-opacity disabled:opacity-30"
            style={{ background: colors.primary, color: colors.primaryForeground }}>
            <ArrowUp size={18} strokeWidth={2.25} />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Agent setup pills (Instructions · Context · Memory · Scheduled) ----------
type PillKey = "instructions" | "context" | "memory" | "tasks";

function SetupPills({ counts, onOpen, compact }: {
  counts: { instructions: boolean; context: number | null; memory: number | null; tasks: number | null };
  onOpen: (k: PillKey) => void; compact?: boolean;
}) {
  const pills: Array<{ key: PillKey; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; badge: string | null }> = [
    { key: "instructions", label: "Instructions", Icon: ListChecks, badge: counts.instructions ? "On" : null },
    { key: "context", label: "Context", Icon: BookOpen, badge: counts.context ? String(counts.context) : null },
    { key: "memory", label: "Memory", Icon: Brain, badge: counts.memory ? String(counts.memory) : null },
    { key: "tasks", label: "Scheduled", Icon: CalendarClock, badge: counts.tasks ? String(counts.tasks) : null },
  ];
  return (
    <div className={`flex flex-wrap items-center ${compact ? "gap-1" : "justify-center gap-2"}`}>
      {pills.map((p) => (
        <button key={p.key} type="button" onClick={() => onOpen(p.key)} title={p.label}
          className={`flex items-center gap-1.5 rounded-full transition-colors hover:bg-white/[0.06] ${compact ? "px-2.5 py-1.5 text-[13px]" : "border px-3.5 py-2 text-[13px]"}`}
          style={{ borderColor: "hsl(0 0% 100% / 0.1)", color: colors.secondaryForeground }}>
          <p.Icon size={15} strokeWidth={1.75} />
          <span className={compact ? "hidden md:inline" : ""}>{p.label}</span>
          {p.badge && (
            <span className="rounded-full px-1.5 text-[11px] font-medium leading-[18px]" style={{ background: "hsl(213 80% 18%)", color: colors.accentForeground }}>{p.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" style={{ background: "hsl(0 0% 0% / 0.55)" }} onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col border-l shadow-2xl" style={{ background: "#151515", borderColor: colors.border }}>
        <div className="flex items-center justify-between border-b px-7 py-5" style={{ borderColor: LINE }}>
          <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 hover:bg-white/5" style={{ color: colors.mutedForeground }}><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">{children}</div>
      </div>
    </div>
  );
}

function InstructionsEditor({ initial, onSaved, onCancel }: { initial: string; onSaved: (s: Settings) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const res = await authFetch("/api/agent/settings", { method: "PUT", body: JSON.stringify({ instructions: value }) });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error || "Couldn't save");
      onSaved(json.settings);
      toast.success("Instructions saved");
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex h-full flex-col">
      <p className="text-[13px] leading-relaxed" style={{ color: colors.mutedForeground }}>
        Your agent follows these in every chat. Write them the way you would brief a new marketing hire.
      </p>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} maxLength={4000} rows={12}
        placeholder={"For example:\n• Always reply in simple English, with a Tamil line for local posts\n• We never give discounts above 20%\n• Our best sellers are the filter coffee and ghee\n• Never mention competitor names in ads"}
        className="mt-4 w-full flex-1 resize-none rounded-xl border px-3.5 py-3 text-[14px] leading-relaxed outline-none focus:border-[hsl(213_100%_55%/0.6)]"
        style={{ background: colors.card, borderColor: colors.border, color: colors.foreground, minHeight: 260 }} />
      <div className="mt-1.5 text-right text-[11px]" style={{ color: colors.mutedForeground }}>{value.length} / 4000</div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm" style={{ color: colors.secondaryForeground }}>Cancel</button>
        <button type="button" onClick={save} disabled={saving || value === initial}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40" style={{ background: colors.primary, color: colors.primaryForeground }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ---------- Recents ----------
function RecentRow({ s, onOpen, onRename, onDelete }: { s: Session; onOpen: () => void; onRename: (t: string) => void; onDelete: () => void }) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(s.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setTitle(s.title), [s.title]);
  if (editing) {
    return (
      <form className="flex items-center gap-2 px-3 py-2" onSubmit={(e) => { e.preventDefault(); if (title.trim()) onRename(title.trim()); setEditing(false); }}>
        <input autoFocus onFocus={(e) => e.currentTarget.select()} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Chat name"
          className="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1.5 text-[14px] outline-none" style={{ borderColor: colors.primary, color: colors.foreground }} />
        <button type="submit" aria-label="Save name" className="rounded-md p-1.5 hover:bg-white/5" style={{ color: colors.green600 }}><Check size={16} /></button>
        <button type="button" aria-label="Cancel" onClick={() => { setTitle(s.title); setEditing(false); }} className="rounded-md p-1.5 hover:bg-white/5" style={{ color: colors.mutedForeground }}><X size={16} /></button>
      </form>
    );
  }
  return (
    <div className="group relative flex items-center">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[hsl(0_0%_100%/0.04)]">
        {s.unread && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colors.primary }} aria-label="New" />}
        <span className="min-w-0 flex-1 truncate text-[14px]" style={{ color: colors.foreground }}>{s.title}</span>
        {s.source === "schedule" && <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: colors.accent, color: colors.accentForeground }}>Scheduled</span>}
        <span className="shrink-0 text-[12px]" style={{ color: colors.mutedForeground }}>{timeAgo(s.updatedAt)}</span>
      </button>
      <button type="button" aria-label={`Options for ${s.title}`} onClick={() => { setMenu((m) => !m); setConfirmDelete(false); }}
        className="ml-1 rounded-md p-1.5 opacity-60 hover:bg-white/5 group-hover:opacity-100 sm:opacity-0" style={{ color: colors.mutedForeground }}>
        <MoreHorizontal size={16} />
      </button>
      {menu && (
        <>
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border py-1 shadow-xl" style={{ background: colors.popover, borderColor: colors.border }}>
            <button type="button" onClick={() => { setMenu(false); setEditing(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-white/5" style={{ color: colors.foreground }}>
              <Pencil size={14} /> Rename
            </button>
            <button type="button" onClick={() => (confirmDelete ? (setMenu(false), onDelete()) : setConfirmDelete(true))}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-white/5" style={{ color: colors.destructive }}>
              <Trash2 size={14} /> {confirmDelete ? "Tap again to delete" : "Delete"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Chat thread ----------
type ActionHandlers = { running: string | null; balance: number | null; onRun: (a: AgentActionUI) => void; onDismiss: (a: AgentActionUI) => void; onStartPosters: (a: AgentActionUI, o: PosterOptions) => void; onPostersChanged: (actionId: string, result: Record<string, unknown>) => void };

function Thread({ messages, onUndo, actions, onNext }: { messages: Message[]; onUndo: (messageId: string, memoryId: string) => void; actions: ActionHandlers; onNext?: (text: string) => void }) {
  const lastId = messages[messages.length - 1]?.id;
  return (
    <div className="space-y-8">
      {messages.map((m) => m.role === "user" ? (
        <div key={m.id} className="flex justify-end">
          <div className="max-w-[80%] whitespace-pre-wrap rounded-[20px] rounded-br-md px-4 py-2.5 text-[14.5px] leading-relaxed" style={{ background: "hsl(213 60% 22%)", color: colors.foreground }}>
            {m.content}
          </div>
        </div>
      ) : (
        <div key={m.id} className="flex gap-3.5">
          <AgentOrb size={34} active={!!m.pending} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-2 text-[13px]">
              <span className="font-semibold" style={{ color: colors.foreground }}>SkalX Agent</span>
              {m.pending && <span className="animate-pulse text-[12px]" style={{ color: colors.accentForeground }}>{m.content ? "writing…" : "thinking…"}</span>}
            </div>
            {m.content ? <AgentMarkdown text={m.content} /> : <div className="h-4" />}
            {m.failed && <p className="mt-2 text-[13px]" style={{ color: colors.destructive }}>Sorry, I couldn&apos;t finish that reply. Please try again.</p>}
            {m.remembered?.map((r) => (
              <div key={r.id} className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px]" style={{ background: "hsl(213 80% 18% / 0.45)", color: colors.secondaryForeground }}>
                <Brain size={14} className="mt-0.5 shrink-0" style={{ color: colors.accentForeground }} />
                <span className="min-w-0 flex-1">{r.undone ? <s style={{ color: colors.mutedForeground }}>{r.fact}</s> : <>Remembered: {r.fact}</>}</span>
                {!r.undone && (
                  <button type="button" onClick={() => onUndo(m.id, r.id)} className="shrink-0 font-medium underline-offset-2 hover:underline" style={{ color: colors.accentForeground }}>Undo</button>
                )}
              </div>
            ))}
            {m.actions?.map((a) => (
              <ActionCard key={a.id} a={a} running={actions.running === a.id} balance={actions.balance}
                onRun={() => actions.onRun(a)} onDismiss={() => actions.onDismiss(a)} onStartPosters={actions.onStartPosters} onPostersChanged={actions.onPostersChanged} />
            ))}
            {m.next && m.id === lastId && onNext && (
              <button type="button" onClick={() => onNext(m.next!)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors hover:bg-white/5"
                style={{ borderColor: "hsl(213 100% 55% / 0.45)", color: colors.accentForeground }}>
                {m.next} <span aria-hidden="true">→</span>
              </button>
            )}
            {!m.pending && m.used.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px]" style={{ color: colors.mutedForeground }}>Based on</span>
                {m.used.map((u) => (
                  <span key={u} className="rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: colors.border, color: colors.secondaryForeground }}>{u}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Page ----------
export default function MarketingAgent() {
  const router = useRouter();
  const routeId = useMemo(() => {
    const raw = router.query.id;
    const v = Array.isArray(raw) ? raw[0] : raw;
    return typeof v === "string" ? v : null;
  }, [router.query.id]);

  const [brandName, setBrandName] = useState("");
  const [settings, setSettings] = useState<Settings>({ instructions: "", tagline: null });
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [query, setQuery] = useState("");
  const [showAllChats, setShowAllChats] = useState(false);
  const [current, setCurrent] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState<null | "instructions" | "context" | "memory" | "tasks">(null);
  const [tasks, setTasks] = useState<AgentTask[] | null>(null);
  const [contextItems, setContextItems] = useState<ContextItem[] | null>(null);
  const [automatic, setAutomatic] = useState<Automatic | null>(null);
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [imageCredits, setImageCredits] = useState<number | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [editingTagline, setEditingTagline] = useState(false);
  const [taglineDraft, setTaglineDraft] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const skipLoadRef = useRef<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const res = await authFetch("/api/agent/sessions");
      const json = await res.json();
      setSessions(json.ok ? json.sessions : []);
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/agent/settings");
        const json = await res.json();
        if (json.ok) { setSettings(json.settings); setBrandName(json.brand?.name || ""); }
      } catch { /* defaults */ }
    })();
    loadSessions();
    (async () => {
      try {
        const json = await (await authFetch("/api/agent/tasks")).json();
        setTasks(json.ok ? json.tasks : []);
      } catch { setTasks([]); }
    })();
    (async () => {
      try {
        const json = await (await authFetch("/api/credits/balance")).json();
        if (json?.success) setImageCredits(Number(json.imageCredits?.total ?? 0));
      } catch { /* balance unknown */ }
    })();
    (async () => {
      try {
        const json = await (await authFetch("/api/agent/memory")).json();
        setMemories(json.ok ? json.memories : []);
      } catch { setMemories([]); }
    })();
    (async () => {
      try {
        const json = await (await authFetch("/api/agent/context")).json();
        setContextItems(json.ok ? json.items : []);
        if (json.ok) setAutomatic(json.automatic);
      } catch { setContextItems([]); }
    })();
  }, [loadSessions]);

  // Open a chat from the URL.
  useEffect(() => {
    if (!router.isReady) return;
    if (!routeId) { setCurrent(null); setMessages([]); return; }
    if (skipLoadRef.current === routeId) { skipLoadRef.current = null; return; }
    let cancelled = false;
    setLoadingChat(true);
    (async () => {
      try {
        const res = await authFetch(`/api/agent/sessions?id=${encodeURIComponent(routeId)}`);
        const json = await res.json();
        if (cancelled) return;
        if (!json.ok) { toast.error(json.error || "That chat no longer exists."); router.replace("/marketing-agent"); return; }
        setCurrent(json.session);
        const byMessage = new Map<string, AgentActionUI[]>();
        for (const a of (json.actions ?? []) as AgentActionUI[]) {
          if (a.messageId) byMessage.set(a.messageId, [...(byMessage.get(a.messageId) ?? []), a]);
        }
        setMessages((json.messages as Message[]).map((m) => (byMessage.has(m.id) ? { ...m, actions: byMessage.get(m.id) } : m)));
        setSessions((list) => list?.map((s) => (s.id === routeId ? { ...s, unread: false } : s)) ?? list);
      } catch (e) {
        if (!cancelled) toast.error(friendlyError(e));
      } finally {
        if (!cancelled) setLoadingChat(false);
      }
    })();
    return () => { cancelled = true; };
  }, [routeId, router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (current) bottomRef.current?.scrollIntoView({ behavior: busy ? "auto" : "smooth", block: "end" });
  }, [messages, current, busy]);

  const send = useCallback(async (text: string) => {
    if (busy) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text, used: [] };
    const replyId = `a-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: replyId, role: "assistant", content: "", used: [], pending: true }]);
    if (!current) setCurrent({ id: "", title: text.slice(0, 60), source: "chat", unread: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let sessionId = current?.id || "";
    let finalId = replyId;
    try {
      await streamChat({ sessionId: sessionId || undefined, message: text }, ctrl.signal, (ev) => {
        if (ev.type === "session") {
          sessionId = ev.session.id;
          setCurrent(ev.session);
          setSessions((list) => [ev.session, ...(list ?? [])]);
          skipLoadRef.current = ev.session.id;
          router.replace(`/marketing-agent/${ev.session.id}`, undefined, { shallow: true });
        } else if (ev.type === "delta") {
          setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content: x.content + ev.text } : x)));
        } else if (ev.type === "done") {
          finalId = ev.messageId;
          setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, id: ev.messageId, used: ev.used || [], pending: false } : x)));
        } else if (ev.type === "next") {
          const text: string = ev.text || "";
          setMessages((m) => m.map((x) => (x.id === finalId ? { ...x, next: text } : x)));
        } else if (ev.type === "actions") {
          const items: AgentActionUI[] = ev.items || [];
          setMessages((m) => m.map((x) => (x.id === finalId ? { ...x, actions: items } : x)));
        } else if (ev.type === "memory") {
          const items: Remembered[] = ev.items || [];
          setMessages((m) => m.map((x) => (x.id === finalId ? { ...x, remembered: items } : x)));
          setMemories((list) => [...items.map((i) => ({ id: i.id, fact: i.fact, createdAt: new Date().toISOString() })), ...(list ?? [])]);
        } else if (ev.type === "error") {
          setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, pending: false, failed: true } : x)));
        }
      });
      setMessages((m) => m.map((x) => (x.id === replyId && x.pending ? { ...x, pending: false } : x)));
      if (sessionId) {
        const now = new Date().toISOString();
        setSessions((list) => {
          if (!list) return list;
          const hit = list.find((s) => s.id === sessionId);
          return hit ? [{ ...hit, updatedAt: now }, ...list.filter((s) => s.id !== sessionId)] : list;
        });
      }
    } catch (e) {
      if (ctrl.signal.aborted) {
        setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, pending: false } : x)).filter((x) => !(x.id === replyId && !x.content)));
      } else {
        toast.error(friendlyError(e));
        setMessages((m) => m.filter((x) => x.id !== replyId && x.id !== userMsg.id));
        if (!sessionId) setCurrent(null);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [busy, current, router]);

  const stop = () => abortRef.current?.abort();

  const patchAction = (id: string, patch: Partial<AgentActionUI>) =>
    setMessages((m) => m.map((x) => (x.actions?.some((a) => a.id === id) ? { ...x, actions: x.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)) } : x)));

  const runAgentAction = useCallback(async (a: AgentActionUI) => {
    if (runningAction) return;
    setRunningAction(a.id);
    try {
      const res = await authFetch("/api/agent/actions", { method: "POST", body: JSON.stringify({ id: a.id, op: "run" }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        patchAction(a.id, { status: "failed", error: json?.error || "Something went wrong. Please try again." });
        return;
      }
      patchAction(a.id, { status: "done", error: null, result: json.action?.result ?? null });
      if (json.message) setMessages((m) => [...m, { ...json.message, used: [] }]);
      if (json.redirect) router.push(json.redirect);
    } catch (e) {
      patchAction(a.id, { status: "failed", error: friendlyError(e) });
    } finally {
      setRunningAction(null);
    }
  }, [runningAction, router]);

  const refreshCredits = useCallback(async () => {
    try {
      const json = await (await authFetch("/api/credits/balance")).json();
      if (json?.success) setImageCredits(Number(json.imageCredits?.total ?? 0));
    } catch { /* keep last known */ }
  }, []);

  const startPosters = useCallback(async (a: AgentActionUI, o: PosterOptions) => {
    if (runningAction) return;
    setRunningAction(a.id);
    try {
      const res = await authFetch("/api/agent/actions", { method: "POST", body: JSON.stringify({ id: a.id, op: "run", posters: o }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { toast.error(json?.error || "Couldn't start the posters. Please try again."); return; }
      patchAction(a.id, { status: json.action.status, result: json.action.result, error: null });
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setRunningAction(null);
    }
  }, [runningAction]); // eslint-disable-line react-hooks/exhaustive-deps

  // While posters are being made, refresh their tiles every few seconds.
  const runningPosterIds = messages.flatMap((m) => m.actions ?? []).filter((x) => x.type === "posters" && x.status === "running").map((x) => x.id).join(",");
  useEffect(() => {
    if (!runningPosterIds) return;
    const ids = runningPosterIds.split(",");
    const timer = setInterval(async () => {
      for (const id of ids) {
        try {
          const json = await (await authFetch(`/api/agent/actions?id=${id}`)).json();
          if (!json?.ok) continue;
          patchAction(id, { status: json.action.status, result: json.action.result, error: json.action.error });
          if (json.action.status !== "running") refreshCredits();
        } catch { /* try again next tick */ }
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [runningPosterIds, refreshCredits]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissAgentAction = useCallback(async (a: AgentActionUI) => {
    patchAction(a.id, { status: "dismissed" });
    await authFetch("/api/agent/actions", { method: "POST", body: JSON.stringify({ id: a.id, op: "dismiss" }) }).catch(() => {});
  }, []);

  const undoMemory = useCallback(async (messageId: string, memoryId: string) => {
    setMessages((m) => m.map((x) => (x.id === messageId ? { ...x, remembered: x.remembered?.map((r) => (r.id === memoryId ? { ...r, undone: true } : r)) } : x)));
    setMemories((list) => list?.filter((x) => x.id !== memoryId) ?? list);
    const res = await authFetch(`/api/agent/memory?id=${memoryId}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) toast.error("Couldn't undo that. You can delete it from Memory.");
  }, []);

  const rename = async (s: Session, title: string) => {
    setSessions((list) => list?.map((x) => (x.id === s.id ? { ...x, title } : x)) ?? list);
    if (current?.id === s.id) setCurrent({ ...current, title });
    const res = await authFetch(`/api/agent/sessions?id=${s.id}`, { method: "PATCH", body: JSON.stringify({ title }) }).catch(() => null);
    if (!res?.ok) { toast.error("Couldn't rename that chat."); loadSessions(); }
  };
  const remove = async (s: Session) => {
    setSessions((list) => list?.filter((x) => x.id !== s.id) ?? list);
    const res = await authFetch(`/api/agent/sessions?id=${s.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { toast.error("Couldn't delete that chat."); loadSessions(); return; }
    toast.success("Chat deleted");
    if (current?.id === s.id) router.push("/marketing-agent");
  };

  const saveTagline = async () => {
    const t = taglineDraft.trim();
    setEditingTagline(false);
    setSettings((s) => ({ ...s, tagline: t || null }));
    await authFetch("/api/agent/settings", { method: "PUT", body: JSON.stringify({ tagline: t || null }) }).catch(() => toast.error("Couldn't save that."));
  };

  const defaultTagline = brandName ? `Your marketing strategist for ${brandName}. Ask anything about growing your business.` : "Your marketing strategist. Ask anything about growing your business.";
  const tagline = settings.tagline || defaultTagline;
  const filtered = (sessions ?? []).filter((s) => !query.trim() || s.title.toLowerCase().includes(query.trim().toLowerCase()));
  // asPath is known before the router is ready, so a chat link never flashes the home view.
  const inChat = !!current || !!routeId || /^\/marketing-agent\/[0-9a-f-]{36}/i.test(router.asPath);

  const pillCounts = {
    instructions: !!settings.instructions.trim(),
    context: contextItems?.length ?? null,
    memory: memories?.length ?? null,
    tasks: tasks ? tasks.filter((t) => t.enabled).length : null,
  };
  const openPill = (k: PillKey) => setDrawer(k);
  const RECENT_LIMIT = 5;
  const shownSessions = showAllChats ? filtered : filtered.slice(0, RECENT_LIMIT);

  return (
    <>
      {inChat ? (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center gap-2 border-b px-3 py-2.5 sm:px-5" style={{ borderColor: LINE }}>
            <button type="button" onClick={() => { stop(); router.push("/marketing-agent"); }} aria-label="Back to Marketing Agent"
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-white/5" style={{ color: colors.mutedForeground }}>
              <ArrowLeft size={16} />
            </button>
            <AgentOrb size={22} active={busy} />
            <h1 className="ml-1 min-w-0 flex-1 truncate text-[14.5px] font-medium" style={{ color: colors.foreground }}>{current?.title || ""}</h1>
            <SetupPills compact counts={pillCounts} onOpen={openPill} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
              {loadingChat ? (
                <div className="space-y-4">
                  {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl" style={{ background: colors.card }} />)}
                </div>
              ) : (
                <Thread messages={messages} onUndo={undoMemory} actions={{ running: runningAction, balance: imageCredits, onRun: runAgentAction, onDismiss: dismissAgentAction, onStartPosters: startPosters, onPostersChanged: (id, result) => { patchAction(id, { result }); refreshCredits(); } }} onNext={(t) => { if (!busy) void send(t); }} />
              )}
              <div ref={bottomRef} />
            </div>
          </div>
          <div className="px-4 pb-4 pt-2 sm:px-6">
            <div className="mx-auto max-w-3xl">
              <Composer busy={busy} onSend={send} onStop={stop} placeholder="Reply to your agent…" autoFocus />
              <p className="mt-2 text-center text-[11px]" style={{ color: colors.mutedForeground }}>
                Your agent can make mistakes. Check prices, dates and offers before you publish.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative h-full overflow-y-auto">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
            style={{ background: "radial-gradient(ellipse 50% 60% at 50% 0%, hsl(230 80% 55% / 0.10), transparent 70%)" }} />
          <div className="relative mx-auto flex min-h-full max-w-2xl flex-col px-4 sm:px-6">
            <div className="flex flex-col items-center pb-10 pt-14 sm:pt-20">
              <AgentOrb size={120} active={busy} />
              <h1 className="mt-9 text-center text-[26px] font-semibold leading-tight tracking-[-0.01em] sm:text-[30px]" style={{ color: colors.foreground }}>
                {brandName ? <>Hi, what should <span style={{ color: "hsl(213 100% 72%)" }}>{brandName}</span> do next?</> : "Hi, what should we work on today?"}
              </h1>
              {editingTagline ? (
                <form className="mt-3 flex w-full max-w-lg items-center gap-2" onSubmit={(e) => { e.preventDefault(); saveTagline(); }}>
                  <input autoFocus value={taglineDraft} onChange={(e) => setTaglineDraft(e.target.value)} maxLength={140} aria-label="Description"
                    className="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1.5 text-[14px] outline-none" style={{ borderColor: colors.primary, color: colors.foreground }} />
                  <button type="submit" aria-label="Save" className="rounded-md p-1.5 hover:bg-white/5" style={{ color: colors.green600 }}><Check size={16} /></button>
                  <button type="button" aria-label="Cancel" onClick={() => setEditingTagline(false)} className="rounded-md p-1.5 hover:bg-white/5" style={{ color: colors.mutedForeground }}><X size={16} /></button>
                </form>
              ) : (
                <button type="button" onClick={() => { setTaglineDraft(settings.tagline || ""); setEditingTagline(true); }}
                  className="group mt-3 inline-flex items-center gap-2 text-center text-[14.5px]" style={{ color: colors.mutedForeground }}>
                  <span className="w-[13px]" aria-hidden="true" />
                  {tagline}
                  <Pencil size={13} className="opacity-0 transition-opacity group-hover:opacity-100" aria-label="Edit description" />
                </button>
              )}

              <div className="mt-9 w-full">
                <Composer big busy={busy} onSend={send} onStop={stop} placeholder="Ask about posts, offers, festivals, ads, competitors…" autoFocus />
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} disabled={busy}
                    className="rounded-full px-3.5 py-1.5 text-[13px] transition-colors hover:bg-white/[0.06] disabled:opacity-40"
                    style={{ background: "hsl(0 0% 100% / 0.04)", color: colors.secondaryForeground }}>
                    {s}
                  </button>
                ))}
              </div>

              <div className="mt-10 w-full">
                <p className="mb-2.5 text-center text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: "hsl(0 0% 45%)" }}>Your agent&apos;s setup</p>
                <SetupPills counts={pillCounts} onOpen={openPill} />
              </div>
            </div>

            <section className="pb-12" aria-label="Recent chats">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="text-[13px] font-medium" style={{ color: colors.mutedForeground }}>Recent chats</h2>
                {showAllChats && (sessions?.length ?? 0) > RECENT_LIMIT && (
                  <label className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5" style={{ borderColor: colors.border }}>
                    <Search size={14} style={{ color: colors.mutedForeground }} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" aria-label="Search chats"
                      className="w-32 bg-transparent text-[13px] outline-none sm:w-44" style={{ color: colors.foreground }} />
                  </label>
                )}
              </div>
              <div className="mt-2">
                {sessions === null ? (
                  [0, 1, 2].map((i) => <div key={i} className="my-2 h-10 animate-pulse rounded-lg" style={{ background: colors.card }} />)
                ) : filtered.length === 0 ? (
                  <p className="px-3 py-5 text-[13.5px]" style={{ color: colors.mutedForeground }}>
                    {query ? "No chats match that." : "Your chats will show here so you can pick up where you left off."}
                  </p>
                ) : (
                  shownSessions.map((s) => (
                    <RecentRow key={s.id} s={s} onOpen={() => router.push(`/marketing-agent/${s.id}`)} onRename={(t) => rename(s, t)} onDelete={() => remove(s)} />
                  ))
                )}
                {!showAllChats && filtered.length > RECENT_LIMIT && (
                  <button type="button" onClick={() => setShowAllChats(true)} className="mt-1 px-3 py-2 text-[13px] hover:underline" style={{ color: colors.accentForeground }}>
                    See all {filtered.length} chats
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      <Drawer open={drawer === "tasks"} title="Scheduled" onClose={() => setDrawer(null)}>
        <TasksPanel tasks={tasks} onChange={setTasks}
          onOpenSession={(id) => { setDrawer(null); loadSessions(); router.push(`/marketing-agent/${id}`); }} />
      </Drawer>
      <Drawer open={drawer === "context"} title="Context" onClose={() => setDrawer(null)}>
        <ContextPanel items={contextItems} automatic={automatic} onChange={setContextItems} />
      </Drawer>
      <Drawer open={drawer === "memory"} title="Memory" onClose={() => setDrawer(null)}>
        <MemoryPanel memories={memories} onChange={setMemories} />
      </Drawer>
      <Drawer open={drawer === "instructions"} title="Instructions" onClose={() => setDrawer(null)}>
        <InstructionsEditor initial={settings.instructions} onCancel={() => setDrawer(null)}
          onSaved={(s) => { setSettings(s); setDrawer(null); }} />
      </Drawer>
    </>
  );
}
