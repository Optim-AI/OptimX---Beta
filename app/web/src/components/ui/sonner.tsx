// app/web/src/components/ui/toaster.tsx
"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"
import colors from "../../../../../lib/colors"

type ToasterProps = React.ComponentProps<typeof Sonner>

export const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        style: {
          backgroundColor: colors.background,
          color: colors.foreground,
          borderColor: colors.border,
          boxShadow: colors.shadowMedium,
        },
        classNames: {
          toast: "group toast",
          description: "",
          actionButton: "",
          cancelButton: "",
        },
        descriptionClassName: "group-[.toast]:text-muted-foreground",
      }}
      {...props}
      // Inline token-based styling for button overrides since Sonner uses its own internal structure
      style={
        {
          "--toast-bg": colors.background,
          "--toast-fg": colors.foreground,
          "--toast-border": colors.border,
          "--toast-muted-fg": colors.mutedForeground,
          "--toast-primary-bg": colors.primary,
          "--toast-primary-fg": colors.primaryForeground,
          "--toast-muted-bg": colors.muted,
        } as React.CSSProperties
      }
    />
  )
}

export { toast }
