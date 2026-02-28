// GenerateCampaignModal.tsx
// Modal for generating campaign creatives from a selected hook

import React, { useState } from "react";
import colors from "@/lib/ui/colors";
import { X, Loader2, Check } from "lucide-react";
import { Button } from "@/app/web/src/components/ui/button";

export type HookData = {
  id: string;
  hookStatement: string;
  hookType: string | null;
  whyItWorks: string | null;
  supportingReviewPhrase: string | null;
};

type GenerateCampaignModalProps = {
  hook: HookData;
  brandSummary?: string | null;
  onClose: () => void;
  onGenerate: (hookId: string) => Promise<void>;
};

export default function GenerateCampaignModal({
  hook,
  brandSummary,
  onClose,
  onGenerate,
}: GenerateCampaignModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      await onGenerate(hook.id);
      setGenerated(true);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div
          className="p-6 border-b flex items-center justify-between"
          style={{ borderColor: colors.border }}
        >
          <h2 className="text-xl font-semibold" style={{ color: colors.foreground }}>
            Generate Campaign
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: colors.mutedForeground }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <p className="text-sm mb-1" style={{ color: colors.mutedForeground }}>
              Selected hook
            </p>
            <p className="text-lg font-semibold" style={{ color: colors.foreground }}>
              {hook.hookStatement}
            </p>
            {hook.whyItWorks && (
              <p className="text-sm mt-2" style={{ color: colors.mutedForeground }}>
                {hook.whyItWorks}
              </p>
            )}
          </div>

          {brandSummary && (
            <div>
              <p className="text-sm mb-1" style={{ color: colors.mutedForeground }}>
                Brand context
              </p>
              <p className="text-sm" style={{ color: colors.foreground }}>
                {brandSummary}
              </p>
            </div>
          )}

          <p className="text-sm" style={{ color: colors.mutedForeground }}>
            This will generate: 5 ad concepts, 3 reel scripts (15s), 3 reel scripts (30s),
            5 headline variations, 5 CTA variations, and visual direction notes.
          </p>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              style={{ borderColor: colors.border, color: colors.foreground }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                backgroundColor: colors.primary,
                color: colors.primaryForeground,
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Generating…
                </>
              ) : generated ? (
                <>
                  <Check size={18} className="mr-2" />
                  Generated
                </>
              ) : (
                "Generate Campaign"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
