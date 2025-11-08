// app/web/src/components/ui/skeleton.tsx
import * as React from "react"
import { cn } from "../../../../../lib/utils"
import colors from "../../../../../lib/colors"

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md", className)}
      style={{ backgroundColor: colors.muted }}
      {...props}
    />
  )
}
