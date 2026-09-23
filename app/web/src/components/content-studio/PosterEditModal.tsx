// PosterEditModal.tsx
// Natural-language poster iteration (Phase 8) with legacy fallback

import React, { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/app/web/src/components/ui/button";

export type PosterIterationPlanPreview = {
  iterationId: string;
  mode: "LOCAL" | "DESIGN" | "CREATIVE" | "FULL";
  userRequest: string;
  userFacingSummary: string;
  target: string;
  preserved: string[];
};

type PosterEditModalProps = {
  imageUrl: string;
  posterIndex: number;
  onClose: () => void;
  /** Legacy path — immediate regenerate via old API */
  onRegenerate?: (editPrompt: string) => Promise<void>;
  /** Phase 8 — classify/plan (0 credits) */
  onPlanChange?: (editPrompt: string) => Promise<PosterIterationPlanPreview>;
  /** Phase 8 — execute planned iteration (1 credit on success) */
  onExecuteChange?: (iterationId: string) => Promise<void>;
  /** Optional version label e.g. "Version 2" */
  versionLabel?: string | null;
  parentVersionLabel?: string | null;
};

const SUGGESTIONS = [
  "Make the product larger",
  "Make it more premium",
  "Change the background",
  "Move the CTA lower",
  "Show someone using the product",
  "Change the headline",
];

function preservedLines(plan: PosterIterationPlanPreview): string[] {
  if (plan.preserved.length) return plan.preserved;
  switch (plan.mode) {
    case "LOCAL":
      return [
        "Product identity preserved",
        "Marketing message preserved",
        "Creative direction preserved",
      ];
    case "DESIGN":
      return [
        "Product identity preserved",
        "Marketing message preserved",
        "Campaign objective preserved",
      ];
    case "CREATIVE":
      return [
        "Product identity preserved",
        "Marketing objective preserved",
        "Campaign strategy preserved",
      ];
    case "FULL":
      return [
        "Product identity preserved",
        "Campaign strategy preserved",
      ];
  }
}

export default function PosterEditModal({
  imageUrl,
  posterIndex,
  onClose,
  onRegenerate,
  onPlanChange,
  onExecuteChange,
  versionLabel,
  parentVersionLabel,
}: PosterEditModalProps) {
  const engineMode = !!(onPlanChange && onExecuteChange);
  const [editPrompt, setEditPrompt] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [step, setStep] = useState<"compose" | "confirm" | "generating">(
    "compose"
  );
  const [plan, setPlan] = useState<PosterIterationPlanPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isWorking) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isWorking, onClose]);

  const handleReview = async () => {
    const trimmed = editPrompt.trim();
    if (!trimmed) return;
    setError(null);

    if (!engineMode) {
      if (!onRegenerate) return;
      setIsWorking(true);
      setStep("generating");
      try {
        await onRegenerate(trimmed);
        onClose();
      } catch (e: any) {
        setError(e?.message || "Something went wrong");
        setStep("compose");
      } finally {
        setIsWorking(false);
      }
      return;
    }

    setIsWorking(true);
    try {
      const preview = await onPlanChange!(trimmed);
      setPlan(preview);
      setStep("confirm");
    } catch (e: any) {
      setError(e?.message || "Could not understand that change");
    } finally {
      setIsWorking(false);
    }
  };

  const handleGenerateUpdate = async () => {
    if (!plan || !onExecuteChange) return;
    setError(null);
    setIsWorking(true);
    setStep("generating");
    try {
      await onExecuteChange(plan.iterationId);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Could not create the updated poster");
      setStep("confirm");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => e.target === e.currentTarget && !isWorking && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-poster-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl shadow-2xl md:flex-row"
        style={{
          backgroundColor: "#121218",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4 md:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`Poster ${posterIndex + 1}`}
            className="max-h-[70vh] w-full object-contain rounded-lg"
          />
        </div>

        <div className="flex w-full flex-col border-t border-white/10 md:w-[340px] md:border-l md:border-t-0 lg:w-[380px]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <h2
                id="edit-poster-title"
                className="text-sm font-semibold text-white"
              >
                {versionLabel || "Edit poster"}
              </h2>
              <p className="text-xs text-white/45">
                {parentVersionLabel
                  ? `Based on ${parentVersionLabel}`
                  : "What would you like to change?"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => !isWorking && onClose()}
              className="rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            {step === "compose" && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/80">
                    What would you like to change?
                  </label>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Make the product larger…"
                    rows={5}
                    disabled={isWorking}
                    className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/50"
                    autoFocus
                  />
                </div>

                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-white/40">
                    Suggestions
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={isWorking}
                        onClick={() => setEditPrompt(s)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/65 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-white disabled:opacity-40"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {step === "confirm" && plan && (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/40">
                    You want to
                  </p>
                  <p className="mt-1 text-sm text-white/90">{plan.userRequest}</p>
                </div>
                <p className="text-sm text-white/55">{plan.userFacingSummary}</p>
                <ul className="space-y-1.5 text-sm text-white/60">
                  {preservedLines(plan).map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      {line}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="text-xs text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
                  onClick={() => {
                    setStep("compose");
                    setPlan(null);
                  }}
                  disabled={isWorking}
                >
                  Edit request
                </button>
              </div>
            )}

            {step === "generating" && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                <p className="text-sm text-white/80">Creating your update…</p>
                <p className="text-xs text-white/40">
                  Checking the final creative after generation
                </p>
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </p>
            )}
          </div>

          <div className="border-t border-white/10 p-4">
            {step === "compose" && (
              <>
                <Button
                  onClick={() => void handleReview()}
                  disabled={!editPrompt.trim() || isWorking}
                  className="w-full gap-2 text-white"
                  style={{ backgroundColor: "#3B82F6" }}
                >
                  {isWorking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Understanding change…
                    </>
                  ) : engineMode ? (
                    "Review change →"
                  ) : (
                    "Apply change →"
                  )}
                </Button>
                <p className="mt-2 text-center text-[11px] text-white/35">
                  {engineMode
                    ? "Review is free · Generation uses 1 image credit"
                    : "Uses the existing poster as the base"}
                </p>
              </>
            )}
            {step === "confirm" && (
              <>
                <Button
                  onClick={() => void handleGenerateUpdate()}
                  disabled={isWorking}
                  className="w-full gap-2 text-white"
                  style={{ backgroundColor: "#3B82F6" }}
                >
                  Generate update
                </Button>
                <p className="mt-2 text-center text-[11px] text-white/35">
                  Create updated poster · 1 image credit
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
