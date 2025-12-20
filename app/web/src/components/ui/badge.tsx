'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../../../lib/utils';
import colors from '../../../../../lib/colors';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: '',
        secondary: '',
        destructive: '',
        outline: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  style,
  ...props
}) => {
  const [hover, setHover] = React.useState(false);

  // Normalize variant to a concrete key so indexing is safe for TypeScript
  const variantKey = (variant ?? 'default') as
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'outline';

  const baseStyle: React.CSSProperties = {
    border: '1px solid transparent',
    background: colors.primary,
    color: colors.primaryForeground,
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      background: colors.primary,
      color: colors.primaryForeground,
      border: '1px solid transparent',
    },
    secondary: {
      background: colors.secondary,
      color: colors.secondaryForeground,
      border: '1px solid transparent',
    },
    destructive: {
      background: colors.destructive,
      color: colors.destructiveForeground,
      border: '1px solid transparent',
    },
    outline: {
      background: 'transparent',
      color: colors.foreground,
      border: `1px solid ${colors.border}`,
    },
  };

  const hoverStyles: Record<string, React.CSSProperties> = {
    default: {
      background: colors.primaryHover,
    },
    secondary: {
      background: 'hsl(220 14% 92%)', // a bit darker on hover
    },
    destructive: {
      background: 'hsl(0 84% 55%)',
    },
    outline: {
      background: colors.accent,
      color: colors.accentForeground,
    },
  };

  const mergedStyle: React.CSSProperties = {
    ...baseStyle,
    ...(variantStyles[variantKey] ?? {}),
    ...(hover ? hoverStyles[variantKey] ?? {} : {}),
    ...(style as React.CSSProperties),
  };

  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      style={mergedStyle}
      onMouseEnter={(e) => {
        setHover(true);
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setHover(false);
        props.onMouseLeave?.(e);
      }}
      {...props}
    />
  );
};
