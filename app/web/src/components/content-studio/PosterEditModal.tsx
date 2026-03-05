// PosterEditModal.tsx
// Modal for user to describe exact changes and regenerate the poster

import React, { useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { Button } from "@/app/web/src/components/ui/button";
import colors from "@/lib/ui/colors";

type PosterEditModalProps = {
  imageUrl: string;
  posterIndex: number;
  onClose: () => void;
  onRegenerate: (editPrompt: string) => Promise<void>;
};

const EXAMPLES = [
  "Fix typo: change TRANSFRMATION to TRANSFORMATION",
  "Change headline to be more emotional",
  "Add testimonial quote: 'Best face wash I've ever used'",
  "Make the CTA button more prominent",
  "Correct Science-backicked to Science-backed",
];

export default function PosterEditModal({
  imageUrl,
  posterIndex,
  onClose,
  onRegenerate,
}: PosterEditModalProps) {
  const [editPrompt, setEditPrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

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
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && !isRegenerating && onClose()}
    >
      <div
        className="rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden"
        style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: colors.border }}>
          <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>
            Edit Poster {posterIndex + 1}
          </h2>
          <button
            onClick={() => !isRegenerating && onClose()}
            className="p-2 rounded-lg hover:bg-black/10 transition-colors"
            style={{ color: colors.mutedForeground }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex gap-6">
            <div className="w-32 flex-shrink-0 rounded-lg overflow-hidden border" style={{ borderColor: colors.border }}>
              <img src={imageUrl} alt="Poster" className="w-full aspect-[4/5] object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>
                Describe the exact change you want
              </label>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="e.g. Fix the typo - change TRANSFRMATION to TRANSFORMATION. Or: Add a testimonial quote below the headline."
                rows={4}
                className="w-full rounded-lg p-3 text-sm resize-none bg-[hsl(0_0%_12%)] border placeholder:text-[hsl(0_0%_50%)]"
                style={{
                  borderColor: colors.border,
                  color: colors.foreground,
                }}
              />
              <p className="text-xs mt-2" style={{ color: colors.mutedForeground }}>
                Be specific. The AI will regenerate the poster with only your requested change.
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2" style={{ color: colors.mutedForeground }}>
              Examples
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setEditPrompt(ex)}
                  className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:border-[hsl(213_100%_55%)]"
                  style={{ borderColor: colors.border, color: colors.foreground }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t" style={{ borderColor: colors.border }}>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isRegenerating}
            style={{ borderColor: colors.border, color: colors.foreground }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!editPrompt.trim() || isRegenerating}
            style={{ background: colors.primary, color: colors.primaryForeground }}
          >
            {isRegenerating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate with changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
