'use client';

import React, { useEffect, useCallback, useState, useRef } from 'react';
import colors from '@/lib/ui/colors';
import {
  registerAlertModal,
  type AlertModalState,
} from './alert-modal-api';

type AlertType = AlertModalState['type'];

const INITIAL: AlertModalState = {
  open: false,
  type: 'info',
  title: '',
  message: '',
};

// ── Icons ──────────────────────────────────────────────

function InfoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function ConfirmIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ── Accent color per type ──────────────────────────────

function accentColor(type: AlertType): string {
  switch (type) {
    case 'success':
      return colors.green600;
    case 'error':
      return colors.destructive;
    case 'confirm':
      return '#f59e0b';
    default:
      return colors.primary;
  }
}

function IconForType({ type }: { type: AlertType }) {
  switch (type) {
    case 'success':
      return <SuccessIcon />;
    case 'error':
      return <ErrorIcon />;
    case 'confirm':
      return <ConfirmIcon />;
    default:
      return <InfoIcon />;
  }
}

// ── Component ──────────────────────────────────────────

export default function AlertModal() {
  const [state, setState] = useState<AlertModalState>(INITIAL);

  useEffect(() => {
    registerAlertModal(setState);
    return () => {
      registerAlertModal(null);
    };
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  const close = useCallback(() => {
    stateRef.current.onCancel?.();
    setState(INITIAL);
  }, []);

  const confirm = useCallback(() => {
    stateRef.current.onConfirm?.();
    setState(INITIAL);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!state.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.open, close]);

  if (!state.open) return null;

  const accent = accentColor(state.type);

  return (
    <div
      className="alert-modal-overlay"
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        padding: 20,
        animation: 'alertFadeIn 150ms ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'alertSlideIn 200ms ease-out',
        }}
      >
        {/* Header accent bar */}
        <div style={{ height: 3, background: accent }} />

        {/* Body */}
        <div style={{ padding: '28px 28px 24px' }}>
          {/* Icon + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `${accent}20`,
                color: accent,
                flexShrink: 0,
              }}
            >
              <IconForType type={state.type} />
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: colors.foreground,
                fontFamily: 'Poppins, Inter, system-ui',
              }}
            >
              {state.title}
            </h3>
          </div>

          {/* Message */}
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: colors.mutedForeground,
              fontFamily: 'Poppins, Inter, system-ui',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {state.message}
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            padding: '16px 28px 24px',
          }}
        >
          {state.type === 'confirm' ? (
            <>
              <button
                onClick={close}
                style={{
                  padding: '10px 22px',
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: colors.muted,
                  color: colors.foreground,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'Poppins, Inter, system-ui',
                  transition: 'opacity 150ms',
                }}
              >
                {state.cancelLabel || 'Cancel'}
              </button>
              <button
                onClick={confirm}
                style={{
                  padding: '10px 22px',
                  borderRadius: 10,
                  border: 'none',
                  background: accent,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'Poppins, Inter, system-ui',
                  transition: 'opacity 150ms',
                }}
              >
                {state.confirmLabel || 'Confirm'}
              </button>
            </>
          ) : (
            <button
              onClick={close}
              style={{
                padding: '10px 28px',
                borderRadius: 10,
                border: 'none',
                background: accent,
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'Poppins, Inter, system-ui',
                transition: 'opacity 150ms',
              }}
            >
              OK
            </button>
          )}
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes alertFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes alertSlideIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
