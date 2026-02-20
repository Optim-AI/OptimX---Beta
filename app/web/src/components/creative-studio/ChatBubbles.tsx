// ChatBubbles.tsx
// System and User chat bubble components

import React from 'react';
import type { Message } from './types';
import colors from '@/lib/ui/colors';

type SystemBubbleProps = {
  children: React.ReactNode;
  images?: File[];
  imageUrls?: string[];
  expiredImageCount?: number;
  imageThumbnail?: boolean;
  onImageClick?: (url: string) => void;
  onUseAsReference?: (url: string) => void;
  onDownload?: (url: string) => void;
};

export function SystemBubble({ children, images, imageUrls, expiredImageCount, imageThumbnail, onImageClick, onUseAsReference, onDownload }: SystemBubbleProps) {
  const hasImages = (images && images.length > 0) || (imageUrls && imageUrls.length > 0);
  const hasExpired = expiredImageCount && expiredImageCount > 0;
  
  const handleDownload = (url: string, idx: number) => {
    if (onDownload) {
      onDownload(url);
    } else {
      // Default download behavior
      const link = document.createElement('a');
      link.href = url;
      link.download = `poster-${idx + 1}.png`;
      link.click();
    }
  };
  
  return (
    <div className="flex gap-4 max-w-4xl overflow-hidden">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.muted }}>
        <span className="text-xs" style={{ color: colors.foreground }}>AI</span>
      </div>
      <div className="flex-1 flex flex-col gap-2">
        <div className="p-4 rounded-2xl rounded-tl-sm text-sm leading-relaxed" style={{ backgroundColor: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}>
          {children}
        </div>
        {hasExpired && (
          <div className="flex flex-wrap gap-4 mt-2">
            {Array.from({ length: expiredImageCount! }).map((_, idx) => (
              <div
                key={`expired-${idx}`}
                className="w-40 h-40 rounded-lg flex flex-col items-center justify-center gap-2"
                style={{
                  border: `2px dashed ${colors.border}`,
                  backgroundColor: colors.muted,
                }}
              >
                <svg
                  className="w-8 h-8"
                  style={{ color: colors.mutedForeground }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span
                  className="text-xs font-medium"
                  style={{ color: colors.mutedForeground }}
                >
                  Image removed
                </span>
              </div>
            ))}
          </div>
        )}
        {hasImages && (
          <div className="flex flex-wrap gap-4 mt-2">
            {/* File images */}
            {images && images.map((img, idx) => (
              <img
                key={`file-${idx}`}
                src={URL.createObjectURL(img)}
                alt={`Image ${idx + 1}`}
                className="w-32 h-32 object-cover rounded-lg shadow-sm"
                style={{ border: `1px solid ${colors.border}` }}
              />
            ))}
            {/* URL images (generated posters / product images) */}
            {imageUrls && imageUrls.map((url, idx) => imageThumbnail ? (
              <img
                key={`url-${idx}`}
                src={url}
                alt={`Image ${idx + 1}`}
                className="w-32 h-32 object-cover rounded-lg shadow-sm"
                style={{ border: `1px solid ${colors.border}` }}
              />
            ) : (
              <div
                key={`url-${idx}`}
                className="relative group"
              >
                {/* Image thumbnail */}
                <div
                  className="cursor-pointer"
                  onClick={() => onImageClick?.(url)}
                >
                  <img
                src={url}
                alt={`Generated ${idx + 1}`}
                className="w-40 h-auto max-h-48 object-contain rounded-lg shadow-sm transition-transform group-hover:scale-[1.02]"
                style={{ border: `1px solid ${colors.border}` }}
                  />
                  {/* Preview hint overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center pointer-events-none">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white bg-black/70 px-2 py-1 rounded text-xs font-medium">
                      Click to preview
                    </span>
                  </div>
                </div>

                {/* Action buttons - shown on hover */}
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onUseAsReference && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUseAsReference(url);
                      }}
                      className="px-2.5 py-1.5 rounded-md text-xs font-medium shadow-lg transition-colors flex items-center gap-1"
                      style={{ backgroundColor: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}
                      title="Use as Reference"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reference
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(url, idx);
                    }}
                    className="p-1.5 rounded-md shadow-lg transition-colors"
                    style={{ backgroundColor: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}
                    title="Download"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type UserBubbleProps = {
  message: Message;
};

export function UserBubble({ message }: UserBubbleProps) {
  const hasFileImages = message.images && message.images.length > 0;
  const hasUrlImages = !hasFileImages && message.imageUrls && message.imageUrls.length > 0;

  return (
    <div className="flex gap-4 max-w-4xl ml-auto overflow-hidden">
      <div className="flex-1 flex flex-col items-end gap-2 min-w-0">
        {hasFileImages && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.images!.map((img, idx) => (
              <img
                key={idx}
                src={URL.createObjectURL(img)}
                alt={`Upload ${idx + 1}`}
                className="w-24 h-24 object-cover rounded-lg"
                style={{ border: `1px solid ${colors.border}` }}
              />
            ))}
          </div>
        )}
        {hasUrlImages && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.imageUrls!.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt={`Upload ${idx + 1}`}
                className="w-24 h-24 object-cover rounded-lg"
                style={{ border: `1px solid ${colors.border}` }}
              />
            ))}
          </div>
        )}
        {message.content && (
          <div className="p-4 rounded-2xl rounded-tr-sm text-sm leading-relaxed max-w-full" style={{ backgroundColor: colors.primary, color: colors.primaryForeground, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
            {message.content}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.primary }}>
        <span className="text-xs" style={{ color: colors.primaryForeground }}>You</span>
      </div>
    </div>
  );
}
