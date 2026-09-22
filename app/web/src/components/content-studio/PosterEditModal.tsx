// PosterEditModal.tsx
// Side-by-side edit UI for targeted poster changes (preserves existing poster via edit-mode)

import React, { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/app/web/src/components/ui/button";

type PosterEditModalProps = {
  imageUrl: string;
  posterIndex: number;
  onClose: () => void;
  onRegenerate: (editPrompt: string) => Promise<void>;
};

const SUGGESTIONS = [
  "Change typography",
  "Change headline",
  "Adjust CTA",
  "Refine composition",
  "Change background",
  "Make it more premium",
];

export default function PosterEditModal({
  imageUrl,
  posterIndex,
  onClose,
  onRegenerate,
}: PosterEditModalProps) {
  const [editPrompt, setEditPrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isRegenerating) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isRegenerating, onClose]);

  const handleSubmit = async () => {
    const trimmed = editPrompt.trim();
    if (!trimmed) return;
    setIsRegenerating(true);
    try {
      await onRegenerate(trimmed);
      onClose();
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => e.target === e.currentTarget && !isRegenerating && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-poster-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl shadow-2xl md:flex-row"
        style={{ backgroundColor: "#121218", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Existing poster — visual reference */}
        <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4 md:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`Poster ${posterIndex + 1}`}
            className="max-h-[70vh] w-full object-contain rounded-lg"
          />
        </div>

        {/* Edit controls */}
        <div className="flex w-full flex-col border-t border-white/10 md:w-[340px] md:border-l md:border-t-0 lg:w-[380px]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <h2 id="edit-poster-title" className="text-sm font-semibold text-white">
                Edit poster
              </h2>
              <p className="text-xs text-white/45">Modify this design — not a new random poster</p>
            </div>
            <button
              type="button"
              onClick={() => !isRegenerating && onClose()}
              className="rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">
                What would you like to change?
              </label>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Make the headline more premium and reduce the CTA size…"
                rows={5}
                disabled={isRegenerating}
                className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/50"
                autoFocus
              />
            </div>

            <div>
              <p className="mb-2 text-[11px] uppercase tracking-wider text-white/40">Suggestions</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={isRegenerating}
                    onClick={() => setEditPrompt(s)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/65 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-white disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 p-4">
            <Button
              onClick={() => void handleSubmit()}
              disabled={!editPrompt.trim() || isRegenerating}
              className="w-full gap-2 text-white"
              style={{ backgroundColor: "#3B82F6" }}
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying change…
                </>
              ) : (
                "Apply change →"
              )}
            </Button>
            <p className="mt-2 text-center text-[11px] text-white/35">
              Uses the existing poster as the base
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
