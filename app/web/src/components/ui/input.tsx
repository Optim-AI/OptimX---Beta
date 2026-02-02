"use client"

import * as React from "react"
import { cn } from "../../../../../lib/utils"
import colors from "../../../../../lib/colors" // <-- bring in your color tokens

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          // keep spacing, radius, transitions, and focus-visible classes
          "flex h-10 w-full rounded-md px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        style={{
          // background and text
          background: colors.background,
          color: colors.foreground,
          // borders and ring offsets
          borderColor: colors.input,
          outlineColor: colors.ring,
          // placeholder and file input colors
          // (Tailwind doesn't support inline placeholder colors directly, so use global or CSS variables if needed)
        }}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
