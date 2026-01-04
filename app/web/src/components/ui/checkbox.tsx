"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "../../../../../lib/utils";
import colors from '@/lib/ui/colors';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, style, ...props }, ref) => {
  const [checked, setChecked] = React.useState(false);
  const [focused, setFocused] = React.useState(false);

  const baseStyle: React.CSSProperties = {
    width: "1rem",
    height: "1rem",
    borderRadius: "0.25rem",
    border: `1px solid ${colors.primary}`,
    background: checked ? colors.primary : colors.background,
    color: checked ? colors.primaryForeground : colors.foreground,
    boxShadow: focused ? `0 0 0 2px ${colors.ring}` : "none",
    transition: "all 0.2s ease-in-out",
    cursor: props.disabled ? "not-allowed" : "pointer",
    opacity: props.disabled ? 0.6 : 1,
    ...style,
  };

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      onCheckedChange={(v) => setChecked(Boolean(v))}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={cn("peer flex items-center justify-center shrink-0", className)}
      style={baseStyle}
      {...props}
    >
      <CheckboxPrimitive.Indicator asChild>
        <Check
          className="h-4 w-4"
          style={{
            color: checked ? colors.primaryForeground : "transparent",
            transition: "color 0.15s ease-in-out",
          }}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
