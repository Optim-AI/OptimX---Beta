// app/web/src/components/ui/toaster.tsx
"use client"

import { useToast } from "../../hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast"
import colors from '@/lib/ui/colors'

export function Toaster() {
  const { toasts } = useToast()

  return (
    // expose tokens as CSS vars for descendant components (color-only change)
    <div
      style={
        {
          // sidebar tokens kept out — only the common toast/foreground/background tokens
          ["--toast-bg" as any]: colors.background,
          ["--toast-fg" as any]: colors.foreground,
          ["--toast-border" as any]: colors.border,
          ["--toast-shadow" as any]: colors.shadowMedium,
          ["--toast-muted-fg" as any]: colors.mutedForeground,
          ["--toast-primary-bg" as any]: colors.primary,
          ["--toast-primary-fg" as any]: colors.primaryForeground,
        } as React.CSSProperties
      }
    >
      <ToastProvider>
        {toasts.map(({ id, title, description, action, ...props }) => (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </div>
  )
}
