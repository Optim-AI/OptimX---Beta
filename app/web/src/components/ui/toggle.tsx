// app/web/src/components/ui/toggle.tsx
"use client"

import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../../../../lib/utils"
import colors from '@/lib/ui/colors'

export const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        outline: "border",
      },
      size: {
        default: "h-10 px-3",
        sm: "h-9 px-2.5",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size }), className)}
    style={{
      backgroundColor: colors.background,
      color: colors.foreground,
      borderColor: colors.input,
      ["--tw-ring-color" as any]: colors.ring,
      ["--tw-ring-offset-color" as any]: colors.background,
      // hover / active states
      transition: "background-color 0.2s ease, color 0.2s ease",
    }}
    {...props}
    // Use data attributes to toggle active state colors
    data-state={props["data-state"]}
    onPointerDown={(e) => {
      const el = e.currentTarget
      el.style.backgroundColor = colors.accent
      el.style.color = colors.accentForeground
    }}
    onPointerUp={(e) => {
      const el = e.currentTarget
      el.style.backgroundColor = colors.background
      el.style.color = colors.foreground
    }}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName
