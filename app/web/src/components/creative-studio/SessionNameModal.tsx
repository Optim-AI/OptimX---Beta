// SessionNameModal.tsx
// Modal for naming new creative studio sessions

import React, { useState, useRef, useEffect } from 'react';
import type { SessionType } from './types';
import colors from '@/lib/ui/colors';

type SessionNameModalProps = {
  isOpen: boolean;
  sessionType: SessionType;
  onClose: () => void;
  onSubmit: (name: string) => void;
  isLoading?: boolean;
};

export default function SessionNameModal({
  isOpen,
  sessionType,
  onClose,
  onSubmit,
  isLoading = false,
}: SessionNameModalProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setName('');
    }
  }, [isOpen]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName && !isLoading) {
      onSubmit(trimmedName);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && !isLoading) {
      onClose();
    }
  }

  if (!isOpen) return null;

  const typeLabel = sessionType === 'poster' ? 'Poster' : 'Video';
  const typeIcon = sessionType === 'poster' ? '🖼️' : '🎬';
  const typeColor = sessionType === 'poster' ? 'blue' : 'purple';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="rounded-xl shadow-xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: colors.border }}>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-12 h-12 rounded-xl"
              style={{ backgroundColor: typeColor === 'blue' ? 'hsl(213 100% 55% / 0.2)' : 'hsl(270 80% 55% / 0.2)' }}
            >
              <span className="text-2xl">{typeIcon}</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: colors.foreground }}>
                New {typeLabel} Session
              </h2>
              <p className="text-sm" style={{ color: colors.mutedForeground }}>
                Give your session a name to get started
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label
              htmlFor="session-name"
              className="block text-sm font-medium mb-2"
              style={{ color: colors.foreground }}
            >
              Session Name
            </label>
            <input
              ref={inputRef}
              id="session-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                sessionType === 'poster'
                  ? 'e.g., Summer Sale Campaign'
                  : 'e.g., Product Launch Video'
              }
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }}
              disabled={isLoading}
              maxLength={100}
              autoComplete="off"
            />
            <p className="text-xs mt-2" style={{ color: colors.mutedForeground }}>
              This helps you identify your session later
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: colors.foreground, backgroundColor: colors.muted }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isLoading}
              className={`flex-1 px-4 py-3 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                typeColor === 'blue'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating...
                </span>
              ) : (
                `Start ${typeLabel} Session`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
