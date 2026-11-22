// Context and Memory drawers for the Marketing Agent.
import React, { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ExternalLink, FileText, Globe, Image as ImageIcon, Link2, Pencil, Plus, StickyNote, Trash2, Upload, X } from "lucide-react";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { friendlyError } from "@/lib/api-errors";
import { supabase } from "@/auth/supabase/client";

export type ContextItem = {
  id: string; kind: "file" | "note" | "link"; title: string; mime: string | null; url: string | null;
  summary: string | null; status: string; createdAt: string;
};
export type Automatic = { brandKit: boolean; brandResearch: boolean; focusedReports: number; meta: string };
export type Memory = { id: string; fact: string; createdAt: string };

const FILE_ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,text/plain,text/csv,text/markdown,.md,.csv,.txt";
const LINE = "hsl(0 0% 100% / 0.08)";

const inputStyle = { background: colors.card, borderColor: colors.border, color: colors.foreground } as const;
const inputCls = "w-full rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[hsl(213_100%_55%/0.6)]";

function PrimaryButton({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...p} className={`rounded-lg px-3.5 py-2 text-[13px] font-medium disabled:opacity-40 ${p.className ?? ""}`}
      style={{ background: colors.primary, color: colors.primaryForeground }}>{children}</button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.mutedForeground }}>{children}</h3>;
}

// ---------- Context ----------
export function ContextPanel({ items, automatic, onChange }: {
  items: ContextItem[] | null; automatic: Automatic | null; onChange: (items: ContextItem[]) => void;
}) {
  const [mode, setMode] = useState<null | "note" | "link">(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<null | string>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const list = items ?? [];

  const add = (item: ContextItem) => onChange([item, ...list]);

  const post = async (body: unknown) => {
    const res = await authFetch("/api/agent/context", { method: "POST", body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Something went wrong. Please try again.");
    return json;
  };

  const saveNote = async () => {
    setBusy("Saving note…");
    try {
      const { item } = await post({ kind: "note", title: noteTitle, text: noteText });
      add(item); setNoteTitle(""); setNoteText(""); setMode(null);
      toast.success("Note added");
    } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(null); }
  };

  const saveLink = async () => {
    setBusy("Reading the page… this takes a few seconds");
    try {
      const { item } = await post({ kind: "link", url });
      add(item); setUrl(""); setMode(null);
      toast.success("Link added");
    } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(null); }
  };

  const upload = async (file: File) => {
    setBusy(`Uploading ${file.name}…`);
    try {
      const start = await post({ kind: "file", step: "start", name: file.name, mime: file.type, size: file.size });
      const up = await supabase.storage.from("agent-context").uploadToSignedUrl(start.path, start.token, file, { contentType: file.type });
      if (up.error) throw new Error("Upload failed. Please try again.");
      setBusy(`Reading ${file.name}… this can take up to a minute`);
      const { item } = await post({ kind: "file", step: "finish", path: start.path, name: file.name });
      add(item);
      toast.success("File added");
    } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(null); if (fileRef.current) fileRef.current.value = ""; }
  };

  const remove = async (id: string) => {
    setConfirmId(null);
    const prev = list;
    onChange(list.filter((x) => x.id !== id));
    const res = await authFetch(`/api/agent/context?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { onChange(prev); toast.error("Couldn't delete that."); }
  };

  const open = async (it: ContextItem) => {
    if (it.kind === "link" && it.url) { window.open(it.url, "_blank", "noopener"); return; }
    const res = await authFetch(`/api/agent/context?id=${it.id}&open=1`).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (json?.url) window.open(json.url, "_blank", "noopener"); else toast.error("Couldn't open that file.");
  };

  const autoRows: Array<{ label: string; on: boolean; detail: string; href: string }> = automatic ? [
    { label: "Brand Kit", on: automatic.brandKit, detail: automatic.brandKit ? "Name, products, audience, tone and brand rules" : "Not set up yet", href: "/brand-kit" },
    { label: "Brand Research", on: automatic.brandResearch, detail: automatic.brandResearch ? "Your market, competitors and customers" : "Not run yet", href: "/brand-research" },
    { label: "Product & region reports", on: automatic.focusedReports > 0, detail: automatic.focusedReports ? `${automatic.focusedReports} report${automatic.focusedReports > 1 ? "s" : ""} (newest 3 used)` : "None yet", href: "/brand-research" },
    { label: "Meta ads", on: automatic.meta === "ready", detail: automatic.meta === "ready" ? "Last 30 days of results" : automatic.meta === "pending" ? "Connected, still loading" : "Not connected", href: "/meta-intelligence" },
  ] : [];

  return (
    <div className="space-y-7">
      <section>
        <SectionTitle>Used automatically</SectionTitle>
        <div className="mt-2.5 space-y-1">
          {automatic === null ? [0, 1, 2].map((i) => <div key={i} className="h-11 animate-pulse rounded-lg" style={{ background: colors.card }} />) :
            autoRows.map((r) => (
              <Link key={r.label} href={r.href} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.on ? colors.green600 : "hsl(0 0% 35%)" }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px]" style={{ color: colors.foreground }}>{r.label}</span>
                  <span className="block text-[12px]" style={{ color: colors.mutedForeground }}>{r.detail}</span>
                </span>
                <ExternalLink size={14} style={{ color: colors.mutedForeground }} />
              </Link>
            ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <SectionTitle>Added by you</SectionTitle>
          <span className="text-[11px]" style={{ color: colors.mutedForeground }}>{list.length} / 30</span>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: colors.mutedForeground }}>
          Price lists, menus, catalogues, offers, past ads you liked, customer reviews: anything that helps your agent know your business.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {([
            { key: "file", label: "Upload file", Icon: Upload, onClick: () => fileRef.current?.click() },
            { key: "note", label: "Write note", Icon: StickyNote, onClick: () => setMode(mode === "note" ? null : "note") },
            { key: "link", label: "Add link", Icon: Link2, onClick: () => setMode(mode === "link" ? null : "link") },
          ] as const).map((b) => (
            <button key={b.key} type="button" onClick={b.onClick} disabled={!!busy}
              className="flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[12.5px] transition-colors hover:bg-white/5 disabled:opacity-40"
              style={{ borderColor: mode === b.key ? colors.primary : colors.border, color: colors.secondaryForeground }}>
              <b.Icon size={17} strokeWidth={1.75} /> {b.label}
            </button>
          ))}
        </div>
        <input ref={fileRef} type="file" accept={FILE_ACCEPT} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        <p className="mt-1.5 text-[11px]" style={{ color: colors.mutedForeground }}>PDF, image or text file, up to 10 MB.</p>

        {mode === "note" && (
          <div className="mt-3 space-y-2 rounded-xl border p-3" style={{ borderColor: colors.border }}>
            <input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} maxLength={80} placeholder="Title (optional)" className={inputCls} style={inputStyle} aria-label="Note title" />
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} maxLength={8000} rows={6} autoFocus
              placeholder="e.g. Diwali offer: buy 2 get 1 free on all 250 g packs, 20 Oct to 5 Nov." className={`${inputCls} resize-none leading-relaxed`} style={inputStyle} aria-label="Note" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMode(null)} className="px-3 py-2 text-[13px]" style={{ color: colors.secondaryForeground }}>Cancel</button>
              <PrimaryButton onClick={saveNote} disabled={!noteText.trim() || !!busy}>Add note</PrimaryButton>
            </div>
          </div>
        )}
        {mode === "link" && (
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) saveLink(); }}>
            <input value={url} onChange={(e) => setUrl(e.target.value)} autoFocus placeholder="https://…" className={inputCls} style={inputStyle} aria-label="Link" inputMode="url" />
            <PrimaryButton type="submit" disabled={!url.trim() || !!busy}>Add</PrimaryButton>
          </form>
        )}
        {busy && (
          <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px]" style={{ background: colors.accent, color: colors.accentForeground }}>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> {busy}
          </div>
        )}

        <div className="mt-4 space-y-1.5">
          {items === null ? [0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg" style={{ background: colors.card }} />) :
            list.length === 0 ? (
              <p className="py-4 text-center text-[13px]" style={{ color: colors.mutedForeground }}>Nothing added yet.</p>
            ) : list.map((it) => {
              const Icon = it.kind === "note" ? StickyNote : it.kind === "link" ? Globe : it.mime?.startsWith("image/") ? ImageIcon : FileText;
              return (
                <div key={it.id} className="group flex items-start gap-3 rounded-lg border px-3 py-2.5" style={{ borderColor: LINE }}>
                  <span className="mt-0.5" style={{ color: colors.secondaryForeground }}><Icon size={16} strokeWidth={1.75} /></span>
                  <button type="button" onClick={() => it.kind !== "note" && open(it)} className="min-w-0 flex-1 text-left" disabled={it.kind === "note"}>
                    <span className="block truncate text-[14px]" style={{ color: colors.foreground }}>{it.title}</span>
                    {it.summary && <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug" style={{ color: colors.mutedForeground }}>{it.summary}</span>}
                  </button>
                  {confirmId === it.id ? (
                    <button type="button" onClick={() => remove(it.id)} className="shrink-0 rounded-md px-2 py-1 text-[12px]" style={{ color: colors.destructive }}>Delete?</button>
                  ) : (
                    <button type="button" onClick={() => setConfirmId(it.id)} aria-label={`Delete ${it.title}`} className="shrink-0 rounded-md p-1.5 opacity-60 hover:bg-white/5 group-hover:opacity-100" style={{ color: colors.mutedForeground }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}

// ---------- Memory ----------
function MemoryRow({ m, onSave, onDelete }: { m: Memory; onSave: (fact: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(m.fact);
  const [confirm, setConfirm] = useState(false);
  if (editing) {
    return (
      <div className="rounded-lg border p-2.5" style={{ borderColor: colors.primary }}>
        <textarea value={value} onChange={(e) => setValue(e.target.value)} maxLength={300} rows={3} autoFocus aria-label="Edit fact"
          className="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none" style={{ color: colors.foreground }} />
        <div className="mt-1 flex justify-end gap-1">
          <button type="button" aria-label="Cancel" onClick={() => { setValue(m.fact); setEditing(false); }} className="rounded-md p-1.5 hover:bg-white/5" style={{ color: colors.mutedForeground }}><X size={16} /></button>
          <button type="button" aria-label="Save" disabled={!value.trim()} onClick={() => { onSave(value.trim()); setEditing(false); }} className="rounded-md p-1.5 hover:bg-white/5 disabled:opacity-40" style={{ color: colors.green600 }}><Check size={16} /></button>
        </div>
      </div>
    );
  }
  return (
    <div className="group flex items-start gap-2 rounded-lg px-2.5 py-2.5 hover:bg-white/[0.03]">
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colors.accentForeground }} />
      <p className="min-w-0 flex-1 text-[14px] leading-relaxed" style={{ color: colors.secondaryForeground }}>{m.fact}</p>
      <div className="flex shrink-0 items-center opacity-60 group-hover:opacity-100">
        <button type="button" aria-label="Edit" onClick={() => setEditing(true)} className="rounded-md p-1.5 hover:bg-white/5" style={{ color: colors.mutedForeground }}><Pencil size={14} /></button>
        {confirm ? (
          <button type="button" onClick={onDelete} className="rounded-md px-1.5 py-1 text-[12px]" style={{ color: colors.destructive }}>Delete?</button>
        ) : (
          <button type="button" aria-label="Delete" onClick={() => setConfirm(true)} className="rounded-md p-1.5 hover:bg-white/5" style={{ color: colors.mutedForeground }}><Trash2 size={14} /></button>
        )}
      </div>
    </div>
  );
}

export function MemoryPanel({ memories, onChange }: { memories: Memory[] | null; onChange: (m: Memory[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [fact, setFact] = useState("");
  const list = memories ?? [];

  const add = async () => {
    const res = await authFetch("/api/agent/memory", { method: "POST", body: JSON.stringify({ fact }) }).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (!json?.ok) { toast.error(json?.error || "Couldn't save that."); return; }
    onChange([json.memory, ...list]); setFact(""); setAdding(false);
  };
  const save = async (m: Memory, value: string) => {
    onChange(list.map((x) => (x.id === m.id ? { ...x, fact: value } : x)));
    const res = await authFetch(`/api/agent/memory?id=${m.id}`, { method: "PATCH", body: JSON.stringify({ fact: value }) }).catch(() => null);
    if (!res?.ok) { onChange(list); toast.error("Couldn't save that."); }
  };
  const remove = async (m: Memory) => {
    onChange(list.filter((x) => x.id !== m.id));
    const res = await authFetch(`/api/agent/memory?id=${m.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { onChange(list); toast.error("Couldn't delete that."); }
  };

  return (
    <div>
      <p className="text-[13px] leading-relaxed" style={{ color: colors.mutedForeground }}>
        When you tell your agent something lasting about your business, it remembers it here for future chats. Edit or delete anything that&apos;s wrong.
      </p>
      {adding ? (
        <div className="mt-4 rounded-xl border p-3" style={{ borderColor: colors.border }}>
          <textarea value={fact} onChange={(e) => setFact(e.target.value)} maxLength={300} rows={3} autoFocus aria-label="New fact"
            placeholder="e.g. Our shop is closed on Tuesdays." className={`${inputCls} resize-none`} style={inputStyle} />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => { setAdding(false); setFact(""); }} className="px-3 py-2 text-[13px]" style={{ color: colors.secondaryForeground }}>Cancel</button>
            <PrimaryButton onClick={add} disabled={!fact.trim()}>Save</PrimaryButton>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-4 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] hover:bg-white/5"
          style={{ borderColor: colors.border, color: colors.secondaryForeground }}>
          <Plus size={15} /> Add a fact
        </button>
      )}
      <div className="mt-4 space-y-0.5">
        {memories === null ? [0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg" style={{ background: colors.card }} />) :
          list.length === 0 ? (
            <p className="py-6 text-center text-[13px]" style={{ color: colors.mutedForeground }}>Nothing remembered yet. Tell your agent about your best sellers, prices or busy seasons.</p>
          ) : list.map((m) => <MemoryRow key={m.id} m={m} onSave={(v) => save(m, v)} onDelete={() => remove(m)} />)}
      </div>
    </div>
  );
}
