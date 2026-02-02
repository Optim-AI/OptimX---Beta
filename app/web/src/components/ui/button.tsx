'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../../../../lib/utils';
import colors from '../../../../../lib/colors';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'shadow-elegant transition-all duration-300',
        destructive: '',
        outline:
          'shadow-elegant transition-all duration-300',
        secondary: '',
        ghost: '',
        link: 'underline-offset-4',
        hero: 'transform hover:scale-105 transition-all duration-300 font-semibold',
        cta: 'shadow-medium transform hover:scale-105 transition-all duration-300 font-semibold',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const variantBaseStyles: Record<string, React.CSSProperties> = {
  default: {
    background: colors.primary,
    color: colors.primaryForeground,
    boxShadow: colors.shadowSoft,
    border: 'none',
  },
  destructive: {
    background: colors.destructive,
    color: colors.destructiveForeground,
    border: 'none',
  },
  outline: {
    background: colors.background,
    color: colors.primary,
    border: `1px solid ${colors.primary}`,
  },
  secondary: {
    background: colors.secondary,
    color: colors.secondaryForeground,
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: colors.accentForeground,
    border: 'none',
  },
  link: {
    background: 'transparent',
    color: colors.primary,
    textDecoration: 'underline',
    border: 'none',
    padding: 0,
    height: 'auto',
  },
  hero: {
    backgroundImage: colors.gradientPrimary,
    color: colors.primaryForeground,
    border: 'none',
    boxShadow: colors.shadowGlow,
  },
  cta: {
    background: colors.primary,
    color: colors.primaryForeground,
    boxShadow: colors.shadowMedium,
    border: 'none',
  },
};

const variantHoverStyles: Record<string, React.CSSProperties> = {
  default: {
    background: colors.primaryHover,
    boxShadow: colors.shadowMedium,
  },
  destructive: {
    background: `${colors.destructive}`, // keep same, could darken if needed
  },
  outline: {
    background: colors.primary,
    color: colors.primaryForeground,
    border: `1px solid ${colors.primary}`,
    boxShadow: colors.shadowSoft,
  },
  secondary: {
    background: 'c' /* placeholder - no-op */,
  },
  ghost: {
    background: colors.accent,
    color: colors.accentForeground,
  },
  hero: {
    // subtle stronger glow on hover
    boxShadow: colors.shadowStrong,
    transform: 'scale(1.03)',
  },
  cta: {
    background: colors.primaryHover,
    boxShadow: colors.shadowStrong,
    transform: 'scale(1.03)',
  },
  link: {
    textDecoration: 'underline',
    opacity: 0.9,
  },
};

type VariantKey =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link'
  | 'hero'
  | 'cta';

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size, asChild = false, style, ...props }, ref) => {
    const Comp: any = asChild ? Slot : 'button';
    const [hover, setHover] = React.useState(false);

    // Normalize variant so TypeScript won't allow null/undefined to be used as an index
    const variantKey = (variant ?? 'default') as VariantKey;

    const base = (variantBaseStyles[variantKey] ?? (variantBaseStyles as any).default) as React.CSSProperties;
    const hoverStyle = hover ? (variantHoverStyles[variantKey] ?? {}) : {};
    const mergedStyle: React.CSSProperties = {
      ...base,
      ...hoverStyle,
      // allow callers to override / extend
      ...(style as React.CSSProperties),
      // ensure transitions for hover/transform look smooth
      transition: `${(style && (style as React.CSSProperties).transition) || 'all 200ms ease'}`,
    };

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        style={mergedStyle}
        onMouseEnter={(e) => {
          setHover(true);
          if (props.onMouseEnter) props.onMouseEnter(e);
        }}
        onMouseLeave={(e) => {
          setHover(false);
          if (props.onMouseLeave) props.onMouseLeave(e);
        }}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
