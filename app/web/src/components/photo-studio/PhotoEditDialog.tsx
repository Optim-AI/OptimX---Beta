// PhotoEditDialog.tsx
// Photo Studio: describe how a delivered photo should change ("model scooping it out
// with a spoon"). No area selection — the whole photo is reshot from the description.

import React, { useEffect, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { ArcSpinner } from "@/app/web/src/components/ui/loaders";
import { VoiceInputButton } from "@/app/web/src/components/creative-studio/GuidedAdSetup";

type Group = { title: string; items: string[] };

/** One-tap requests worded the way a product photographer would brief them. */
function suggestionGroups(opts: { withPeople: boolean; isFood: boolean }): Group[] {
  const groups: Group[] = [];
  if (opts.withPeople) {
    groups.push({
      title: "Pose & hands",
      items: [
        opts.isFood ? "Model scooping some out of the jar with a spoon" : "Model using the product",
        "Holding it in one hand, pointing at it with the other",
        "Both hands presenting it to the camera",
        "Model smiling at the camera, product held near the face",
        opts.isFood ? "Model taking a sip, product on the table beside" : "Model looking at the product",
      ],
    });
  }
  groups.push(
    {
      title: "Camera",
      items: ["Closer shot of the product", "Wider shot showing more of the room", "Shot from above", "Eye-level, straight on"],
    },
    {
      title: "Light & mood",
      items: ["Warm morning sunlight", "Softer shadows", "Brighter and cleaner", "Evening, cosy warm light"],
    },
    {
      title: "Setting & props",
      items: [
        opts.isFood ? "Add almonds and a glass of milk" : "Add a few simple props around it",
        "Plain background, nothing else",
        "Remove the extra items",
      ],
    }
  );
  return groups;
}

export default function PhotoEditDialog({
  imageUrl,
  title,
  withPeople,
  isFood,
  language,
  onSubmit,
  onClose,
}: {
  imageUrl: string;
  /** e.g. "Model with product 1" */
  title: string;
  withPeople: boolean;
  isFood: boolean;
  language?: string;
  /** Resolves when the edited photo is ready; throw a readable message on failure. */
  onSubmit: (request: string) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const groups = suggestionGroups({ withPeople, isFood });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !working) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [working, onClose]);

  const pick = (s: string) => {
    setText(s);
    requestAnimationFrame(() => {
      const el = boxRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(s.length, s.length);
    });
  };

  const submit = async () => {
    const request = text.trim();
    if (!request || working) return;
    setError(null);
    setWorking(true);
    try {
      await onSubmit(request);
      onClose();
    } catch (e) {
      setError((e as Error)?.message || "This edit didn't come out. Try again.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => e.target === e.currentTarget && !working && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-photo-title"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl shadow-2xl md:flex-row"
        style={{ backgroundColor: "#121218", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4 md:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={title} className={`block max-h-[40vh] w-auto max-w-full rounded-lg object-contain md:max-h-[72vh] ${working ? "opacity-40" : ""}`} />
          {working && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center" aria-live="polite">
              <ArcSpinner className="h-7 w-7 animate-spin text-blue-400" />
              <p className="text-base font-medium text-white">Reshooting your photo…</p>
              <p className="text-sm text-white/60">About 30–60 seconds. Your original photo is kept.</p>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col border-t border-white/10 md:w-[380px] md:border-l md:border-t-0">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <h2 id="edit-photo-title" className="text-base font-semibold text-white">
                Edit photo
              </h2>
              <p className="text-sm text-white/50">{title}</p>
            </div>
            <button
              type="button"
              onClick={() => !working && onClose()}
              className="rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div>
              <div className="mb-2 flex items-end justify-between gap-2">
                <label htmlFor="photo-edit-request" className="block text-sm font-medium text-white/85">
                  Describe how this photo should look
                </label>
                <VoiceInputButton
                  language={language}
                  onText={(t) => {
                    setText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t));
                    requestAnimationFrame(() => boxRef.current?.focus());
                  }}
                />
              </div>
              <textarea
                id="photo-edit-request"
                ref={boxRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
                }}
                placeholder="e.g. Model holding the jar in one hand and pointing at it with the other"
                rows={4}
                maxLength={500}
                disabled={working}
                autoFocus
                className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[15px] text-white outline-none placeholder:text-white/30 focus:border-blue-500/50"
              />
              <p className="mt-1 text-xs text-white/40">Write in any language. We turn it into exact photo directions for you.</p>
            </div>

            {groups.map((g) => (
              <div key={g.title}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/45">{g.title}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={working}
                      onClick={() => pick(s)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/75 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-white disabled:opacity-40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="border-t border-white/10 p-4">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!text.trim() || working}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              style={{ backgroundColor: "#3B82F6" }}
            >
              {working ? <ArcSpinner className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {working ? "Reshooting…" : "Make this change"}
            </button>
            <p className="mt-2 text-center text-xs text-white/40">The new photo is added next to the original · Free during beta</p>
          </div>
        </div>
      </div>
    </div>
  );
}
