// app/web/src/components/ui/switch.tsx
"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "../../../../../lib/utils"
import colors from '@/lib/ui/colors'

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    style={{
      backgroundColor: colors.input,
      ["--tw-ring-color" as any]: colors.ring,
      ["--tw-ring-offset-color" as any]: colors.background,
    }}
    {...props}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform"
      )}
      style={{
        backgroundColor: colors.background,
        transition: "transform 0.2s ease",
      }}
      data-state="unchecked"
      {...({
        onCheckedChange: (checked: boolean) => {
          const root = ref as any
          if (root?.current) {
            root.current.style.backgroundColor = checked
              ? colors.primary
              : colors.input
          }
        },
      } as any)}
    />
  </SwitchPrimitives.Root>
))

Switch.displayName = SwitchPrimitives.Root.displayName
