// app/web/src/components/ui/textarea.tsx
"use client"

import * as React from "react"
import { cn } from "../../../../../lib/utils"
import colors from '@/lib/ui/colors'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        style={{
          backgroundColor: colors.background,
          color: colors.foreground,
          borderColor: colors.input,
          ["--tw-ring-color" as any]: colors.ring,
          ["--tw-ring-offset-color" as any]: colors.background,
          // use mutedForeground for placeholder text color
          ["--placeholder-color" as any]: colors.mutedForeground,
        }}
        {...props}
      />
    )
  }
)

Textarea.displayName = "Textarea"
