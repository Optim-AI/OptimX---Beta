'use client';

import * as React from 'react';
import { cn } from '../../../../../lib/utils';
import colors from '@/lib/ui/colors';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => {
    const mergedStyle: React.CSSProperties = {
      background: colors.card,
      color: colors.cardForeground,
      border: `1px solid ${colors.border}`,
      boxShadow: colors.shadowSoft,
      borderRadius: '0.75rem',
      ...(style as React.CSSProperties),
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-lg', className)}
        style={mergedStyle}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      style={{ color: colors.foreground, ...(style as React.CSSProperties) }}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, style, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-2xl font-semibold leading-none tracking-tight', className)}
      style={{ color: colors.foreground, ...(style as React.CSSProperties) }}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, style, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm', className)}
      style={{ color: colors.mutedForeground, ...(style as React.CSSProperties) }}
      {...props}
    />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('p-6 pt-0', className)}
      style={{ color: colors.foreground, ...(style as React.CSSProperties) }}
      {...props}
    />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center p-6 pt-0', className)}
      style={{ color: colors.foreground, ...(style as React.CSSProperties) }}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
