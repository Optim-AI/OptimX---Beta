// Scheduled tasks drawer: recurring jobs your agent does on its own (no credits spent).
import React, { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Pencil, Play, Plus, Trash2 } from "lucide-react";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { friendlyError } from "@/lib/api-errors";

export type Cadence = { freq: "weekly"; weekday: number; hour: number } | { freq: "monthly"; monthday: number; hour: number };
export type AgentTask = {
  id: string; title: string; prompt: string; cadence: Cadence; enabled: boolean; emailMe: boolean;
  nextRunAt: string | null; lastRunAt: string | null; lastSessionId: string | null; lastError: string | null;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
export const describeCadence = (c: Cadence) =>
  c.freq === "weekly" ? `Every ${WEEKDAYS[c.weekday]} at ${hourLabel(c.hour)}` : `Every month on the ${ordinal(c.monthday)} at ${hourLabel(c.hour)}`;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

const PRESETS: Array<{ title: string; prompt: string; cadence: Cadence }> = [
  { title: "Weekly post plan", cadence: { freq: "weekly", weekday: 1, hour: 9 },
    prompt: "Plan this week's social media posts: 3–5 posts with the day, platform, idea, headline, caption with hashtags and best time. Use any festivals or occasions coming up. Up to 3 free preview posters are made with the plan: I only pay 1 credit for each one I keep." },
  { title: "Weekly ads check", cadence: { freq: "weekly", weekday: 1, hour: 10 },
    prompt: "Review how my Meta ads did last week: what's working, what's wasting money and what I should change this week. If my ads aren't connected, give me 3 low-cost ways to get more customers this week." },
  { title: "Monthly competitor check", cadence: { freq: "monthly", monthday: 1, hour: 10 },
    prompt: "Do a monthly competitor check: what are similar brands doing in their marketing and offers, and what should I do differently this month? Suggest research if you need fresh facts." },
  { title: "Festival planner", cadence: { freq: "monthly", monthday: 1, hour: 9 },
    prompt: "List the festivals and occasions in the next 6 weeks that suit my business, with one post or offer idea for each." },
];

const inputCls = "w-full rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[hsl(213_100%_55%/0.6)]";
const inputStyle = { background: colors.card, borderColor: colors.border, color: colors.foreground } as const;

type Draft = { id?: string; title: string; prompt: string; cadence: Cadence; emailMe: boolean };

function TaskForm({ initial, onSave, onCancel, saving }: { initial: Draft; onSave: (d: Draft) => void; onCancel: () => void; saving: boolean }) {
  const [d, setD] = useState<Draft>(initial);
  const c = d.cadence;
  const setFreq = (freq: "weekly" | "monthly") =>
    setD({ ...d, cadence: freq === "weekly" ? { freq, weekday: 1, hour: c.hour } : { freq, monthday: 1, hour: c.hour } });
  return (
    <div className="space-y-3 rounded-xl border p-3.5" style={{ borderColor: colors.border }}>
      <label className="block">
        <span className="text-[12px]" style={{ color: colors.mutedForeground }}>Name</span>
        <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} maxLength={80} className={`${inputCls} mt-1`} style={inputStyle} placeholder="e.g. Weekly post plan" />
      </label>
      <label className="block">
        <span className="text-[12px]" style={{ color: colors.mutedForeground }}>What should your agent do?</span>
        <textarea value={d.prompt} onChange={(e) => setD({ ...d, prompt: e.target.value })} maxLength={2000} rows={4} className={`${inputCls} mt-1 resize-none leading-relaxed`} style={inputStyle} />
      </label>
      <div>
        <span className="text-[12px]" style={{ color: colors.mutedForeground }}>When</span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <select value={c.freq} onChange={(e) => setFreq(e.target.value as "weekly" | "monthly")} className={`${inputCls} w-auto`} style={inputStyle} aria-label="How often">
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
          </select>
          {c.freq === "weekly" ? (
            <select value={c.weekday} onChange={(e) => setD({ ...d, cadence: { ...c, weekday: Number(e.target.value) } })} className={`${inputCls} w-auto`} style={inputStyle} aria-label="Day">
              {WEEKDAYS.map((w, i) => <option key={w} value={i}>on {w}</option>)}
            </select>
          ) : (
            <select value={c.monthday} onChange={(e) => setD({ ...d, cadence: { ...c, monthday: Number(e.target.value) } })} className={`${inputCls} w-auto`} style={inputStyle} aria-label="Date">
              {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>on the {ordinal(n)}</option>)}
            </select>
          )}
          <select value={c.hour} onChange={(e) => setD({ ...d, cadence: { ...c, hour: Number(e.target.value) } as Cadence })} className={`${inputCls} w-auto`} style={inputStyle} aria-label="Time">
            {HOURS.map((h) => <option key={h} value={h}>at {hourLabel(h)}</option>)}
          </select>
        </div>
        <p className="mt-1 text-[11px]" style={{ color: colors.mutedForeground }}>India time.</p>
      </div>
      <label className="flex items-center gap-2 text-[13px]" style={{ color: colors.secondaryForeground }}>
        <input type="checkbox" checked={d.emailMe} onChange={(e) => setD({ ...d, emailMe: e.target.checked })} className="h-4 w-4 accent-[hsl(213_100%_55%)]" />
        Also email me the result
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-[13px]" style={{ color: colors.secondaryForeground }}>Cancel</button>
        <button type="button" disabled={saving || !d.title.trim() || !d.prompt.trim()} onClick={() => onSave(d)}
          className="rounded-lg px-3.5 py-2 text-[13px] font-medium disabled:opacity-40" style={{ background: colors.primary, color: colors.primaryForeground }}>
          {saving ? "Saving…" : d.id ? "Save" : "Schedule it"}
        </button>
      </div>
    </div>
  );
}

export function TasksPanel({ tasks, onChange, onOpenSession }: {
  tasks: AgentTask[] | null; onChange: (t: AgentTask[]) => void; onOpenSession: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const list = tasks ?? [];

  const call = async (url: string, init: RequestInit) => {
    const res = await authFetch(url, init);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Something went wrong. Please try again.");
    return json;
  };

  const save = async (d: Draft) => {
    setSaving(true);
    try {
      const body = JSON.stringify({ title: d.title, prompt: d.prompt, cadence: d.cadence, emailMe: d.emailMe });
      const { task } = d.id ? await call(`/api/agent/tasks?id=${d.id}`, { method: "PATCH", body }) : await call("/api/agent/tasks", { method: "POST", body });
      onChange(d.id ? list.map((t) => (t.id === task.id ? task : t)) : [...list, task]);
      setDraft(null);
      toast.success(d.id ? "Task updated" : `Scheduled: ${describeCadence(task.cadence).replace(/^Every/, "every")}`);
    } catch (e) { toast.error(friendlyError(e)); } finally { setSaving(false); }
  };

  const toggle = async (t: AgentTask) => {
    try {
      const { task } = await call(`/api/agent/tasks?id=${t.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !t.enabled }) });
      onChange(list.map((x) => (x.id === t.id ? task : x)));
    } catch (e) { toast.error(friendlyError(e)); }
  };

  const remove = async (t: AgentTask) => {
    setConfirmId(null);
    try {
      await call(`/api/agent/tasks?id=${t.id}`, { method: "DELETE" });
      onChange(list.filter((x) => x.id !== t.id));
    } catch (e) { toast.error(friendlyError(e)); }
  };

  const runNow = async (t: AgentTask) => {
    setRunning(t.id);
    try {
      const { sessionId } = await call("/api/agent/tasks", { method: "POST", body: JSON.stringify({ id: t.id, op: "run" }) });
      onChange(list.map((x) => (x.id === t.id ? { ...x, lastRunAt: new Date().toISOString(), lastSessionId: sessionId, lastError: null } : x)));
      onOpenSession(sessionId);
    } catch (e) { toast.error(friendlyError(e)); } finally { setRunning(null); }
  };

  return (
    <div>
      <p className="text-[13px] leading-relaxed" style={{ color: colors.mutedForeground }}>
        Jobs your agent does on its own. Each run shows up in Recent chats with a <b>Scheduled</b> tag. Scheduled runs never spend credits; anything that costs credits waits for you to press its button.
      </p>

      {draft ? (
        <div className="mt-4"><TaskForm initial={draft} saving={saving} onSave={save} onCancel={() => setDraft(null)} /></div>
      ) : list.length < 5 && (
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.mutedForeground }}>Quick start</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PRESETS.filter((p) => !list.some((t) => t.title === p.title)).map((p) => (
              <button key={p.title} type="button" onClick={() => setDraft({ ...p, emailMe: false })}
                className="rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-white/5" style={{ borderColor: colors.border }}>
                <span className="block text-[13px] font-medium" style={{ color: colors.foreground }}>{p.title}</span>
                <span className="mt-0.5 block text-[11.5px]" style={{ color: colors.mutedForeground }}>{describeCadence(p.cadence)}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setDraft({ title: "", prompt: "", cadence: { freq: "weekly", weekday: 1, hour: 9 }, emailMe: false })}
            className="mt-2 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] hover:bg-white/5" style={{ borderColor: colors.border, color: colors.secondaryForeground }}>
            <Plus size={15} /> Your own task
          </button>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {tasks === null ? [0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl" style={{ background: colors.card }} />) :
          list.length === 0 ? (
            <p className="py-4 text-center text-[13px]" style={{ color: colors.mutedForeground }}>No scheduled tasks yet. Pick a quick start above.</p>
          ) : list.map((t) => (
            <div key={t.id} className="rounded-xl border p-3.5" style={{ borderColor: colors.border, opacity: t.enabled ? 1 : 0.65 }}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5" style={{ color: colors.accentForeground }}><CalendarClock size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium" style={{ color: colors.foreground }}>{t.title}</div>
                  <div className="text-[12px]" style={{ color: colors.secondaryForeground }}>{describeCadence(t.cadence)}{t.emailMe ? " · email on" : ""}</div>
                  <div className="mt-1 text-[11.5px]" style={{ color: colors.mutedForeground }}>
                    {t.enabled ? (t.nextRunAt ? `Next: ${when(t.nextRunAt)}` : "") : "Paused"}
                    {t.lastRunAt && <> · Last ran {when(t.lastRunAt)}{t.lastError ? " (didn't finish)" : ""}</>}
                  </div>
                </div>
                <button type="button" role="switch" aria-checked={t.enabled} aria-label={t.enabled ? "Pause task" : "Turn task on"} onClick={() => toggle(t)}
                  className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors" style={{ background: t.enabled ? colors.primary : "hsl(0 0% 30%)" }}>
                  <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: t.enabled ? 18 : 2 }} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-end gap-1">
                {t.lastSessionId && (
                  <button type="button" onClick={() => onOpenSession(t.lastSessionId!)} className="rounded-md px-2.5 py-1.5 text-[12.5px] hover:bg-white/5" style={{ color: colors.accentForeground }}>Open last result</button>
                )}
                <button type="button" onClick={() => runNow(t)} disabled={!!running} className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12.5px] hover:bg-white/5 disabled:opacity-50" style={{ color: colors.secondaryForeground }}>
                  {running === t.id ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> Running…</> : <><Play size={13} /> Run now</>}
                </button>
                <button type="button" onClick={() => setDraft({ id: t.id, title: t.title, prompt: t.prompt, cadence: t.cadence, emailMe: t.emailMe })} aria-label={`Edit ${t.title}`} className="rounded-md p-1.5 hover:bg-white/5" style={{ color: colors.mutedForeground }}><Pencil size={14} /></button>
                {confirmId === t.id ? (
                  <button type="button" onClick={() => remove(t)} className="rounded-md px-2 py-1 text-[12px]" style={{ color: colors.destructive }}>Delete?</button>
                ) : (
                  <button type="button" onClick={() => setConfirmId(t.id)} aria-label={`Delete ${t.title}`} className="rounded-md p-1.5 hover:bg-white/5" style={{ color: colors.mutedForeground }}><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
