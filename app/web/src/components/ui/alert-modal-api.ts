import type React from 'react';

type AlertType = 'info' | 'success' | 'error' | 'confirm';

export interface AlertModalState {
  open: boolean;
  type: AlertType;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

let _setState: React.Dispatch<React.SetStateAction<AlertModalState>> | null = null;

export function registerAlertModal(
  setter: React.Dispatch<React.SetStateAction<AlertModalState>> | null
) {
  _setState = setter;
}

function show(opts: Omit<AlertModalState, 'open'>) {
  _setState?.({ ...opts, open: true });
}

export function showAlert(message: string, title?: string) {
  show({ type: 'info', title: title || 'Notice', message });
}

export function showSuccess(message: string, title?: string) {
  show({ type: 'success', title: title || 'Success', message });
}

export function showError(message: string, title?: string) {
  show({ type: 'error', title: title || 'Error', message });
}

export function showConfirm(
  message: string,
  opts?: { title?: string; confirmLabel?: string; cancelLabel?: string }
): Promise<boolean> {
  return new Promise((resolve) => {
    show({
      type: 'confirm',
      title: opts?.title || 'Confirm',
      message,
      confirmLabel: opts?.confirmLabel || 'Confirm',
      cancelLabel: opts?.cancelLabel || 'Cancel',
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
