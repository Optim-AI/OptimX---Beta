"use client";

import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import colors from '@/lib/ui/colors';
import { cn } from "../../../../../lib/utils";

// Root container for collapsible logic
const Collapsible = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Root>
>(({ className, style, ...props }, ref) => (
  <CollapsiblePrimitive.Root
    ref={ref}
    className={cn("w-full", className)}
    style={{
      background: colors.background,
      color: colors.foreground,
      border: `1px solid ${colors.border}`,
      borderRadius: "0.75rem",
      boxShadow: colors.shadowSoft,
      transition: "all 0.25s ease-in-out",
      ...(style as React.CSSProperties),
    }}
    {...props}
  />
));
Collapsible.displayName = CollapsiblePrimitive.Root.displayName;

// Trigger button — usually wraps a header or icon
const CollapsibleTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleTrigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleTrigger>
>(({ className, style, children, ...props }, ref) => (
  <CollapsiblePrimitive.CollapsibleTrigger
    ref={ref}
    className={cn(
      "flex w-full items-center justify-between cursor-pointer select-none px-4 py-3 font-medium",
      className
    )}
    style={{
      background: colors.secondary,
      color: colors.foreground,
      borderBottom: `1px solid ${colors.border}`,
      transition: "background 0.2s ease",
      ...(style as React.CSSProperties),
    }}
    {...props}
  >
    {children}
  </CollapsiblePrimitive.CollapsibleTrigger>
));
CollapsibleTrigger.displayName = CollapsiblePrimitive.CollapsibleTrigger.displayName;

// Content area — shown/hidden when collapsed/expanded
const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>(({ className, style, children, ...props }, ref) => (
  <CollapsiblePrimitive.CollapsibleContent
    ref={ref}
    className={cn("overflow-hidden text-sm", className)}
    style={{
      background: colors.card,
      color: colors.cardForeground,
      padding: "0.75rem 1rem",
      borderTop: `1px solid ${colors.border}`,
      transition: "all 0.3s ease-in-out",
      ...(style as React.CSSProperties),
    }}
    {...props}
  >
    {children}
  </CollapsiblePrimitive.CollapsibleContent>
));
CollapsibleContent.displayName =
  CollapsiblePrimitive.CollapsibleContent.displayName;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
