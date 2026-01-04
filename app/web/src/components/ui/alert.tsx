'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../../../lib/utils';
import colors from '@/lib/ui/colors';

const alertVariants = cva(
  'relative w-full rounded-lg p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4',
  {
    variants: {
      variant: {
        default: '',
        destructive: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', style, ...props }, ref) => {
    const baseStyle: React.CSSProperties = {
      border: `1px solid ${colors.border}`,
      background: colors.background,
      color: colors.foreground,
      boxShadow: colors.shadowSoft,
    };

    const destructiveStyle: React.CSSProperties =
      variant === 'destructive'
        ? {
            border: `1px solid ${colors.destructive}`,
            background: `hsl(0 100% 98%)`, // a soft red tint background
            color: colors.destructive,
            boxShadow: colors.shadowSoft,
          }
        : {};

    const mergedStyle: React.CSSProperties = {
      ...baseStyle,
      ...destructiveStyle,
      ...(style as React.CSSProperties),
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        style={mergedStyle}
        {...props}
      />
    );
  }
);
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, style, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    style={{ color: colors.foreground, ...(style as React.CSSProperties) }}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    style={{ color: colors.mutedForeground, ...(style as React.CSSProperties) }}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
