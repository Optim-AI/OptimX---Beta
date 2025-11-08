'use client';

import * as React from 'react';
import * as AspectRatioPrimitive from '@radix-ui/react-aspect-ratio';

/**
 * A simple wrapper for Radix UI's AspectRatio component.
 * Ensures consistent usage with Tailwind & Next.js 13+ App Router.
 *
 * Example:
 * ```tsx
 * <AspectRatio ratio={16 / 9} className="bg-gray-200">
 *   <img src="/example.jpg" alt="Example" className="object-cover w-full h-full" />
 * </AspectRatio>
 * ```
 */
const AspectRatio = AspectRatioPrimitive.Root;

export { AspectRatio };
