// ChatBubbles.tsx
// System and User chat bubble components

import React from 'react';
import type { Message } from './types';
import colors from '@/lib/ui/colors';

type SystemBubbleProps = {
  children: React.ReactNode;
  images?: File[];
  imageUrls?: string[];
  onImageClick?: (url: string) => void;
  onUseAsReference?: (url: string) => void;
  onDownload?: (url: string) => void;
};

export function SystemBubble({ children, images, imageUrls, onImageClick, onUseAsReference, onDownload }: SystemBubbleProps) {
  const hasImages = (images && images.length > 0) || (imageUrls && imageUrls.length > 0);
  
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
    <div className="flex gap-4 max-w-4xl">
<<<<<<< HEAD
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.muted }}>
        <span className="text-xs" style={{ color: colors.foreground }}>AI</span>
      </div>
      <div className="flex-1 flex flex-col gap-2">
        <div className="p-4 rounded-2xl rounded-tl-sm text-sm leading-relaxed" style={{ backgroundColor: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}>
=======
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
        <span className="text-xs text-gray-200">AI</span>
      </div>
      <div className="flex-1 flex flex-col gap-2">
        <div className="bg-gray-800 text-gray-100 p-4 rounded-2xl rounded-tl-sm text-sm leading-relaxed border border-gray-700">
>>>>>>> ec66f5da06316f46f3cfbc565018ba171f1e5c49
          {children}
        </div>
        {hasImages && (
          <div className="flex flex-wrap gap-4 mt-2">
            {/* File images */}
            {images && images.map((img, idx) => (
              <img
                key={`file-${idx}`}
                src={URL.createObjectURL(img)}
                alt={`Image ${idx + 1}`}
<<<<<<< HEAD
                className="w-32 h-32 object-cover rounded-lg shadow-sm"
                style={{ border: `1px solid ${colors.border}` }}
=======
                className="w-32 h-32 object-cover rounded-lg border border-gray-700 shadow-sm"
>>>>>>> ec66f5da06316f46f3cfbc565018ba171f1e5c49
              />
            ))}
            {/* URL images (generated posters) with action buttons */}
            {imageUrls && imageUrls.map((url, idx) => (
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
<<<<<<< HEAD
                src={url}
                alt={`Generated ${idx + 1}`}
                className="w-40 h-auto max-h-48 object-contain rounded-lg shadow-sm transition-transform group-hover:scale-[1.02]"
                style={{ border: `1px solid ${colors.border}` }}
=======
                    src={url}
                    alt={`Generated ${idx + 1}`}
                    className="w-40 h-auto max-h-48 object-contain rounded-lg border border-gray-700 shadow-sm transition-transform group-hover:scale-[1.02]"
>>>>>>> ec66f5da06316f46f3cfbc565018ba171f1e5c49
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
<<<<<<< HEAD
                      className="px-2.5 py-1.5 rounded-md text-xs font-medium shadow-lg transition-colors flex items-center gap-1"
                    style={{ backgroundColor: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}
=======
                      className="px-2.5 py-1.5 bg-gray-800 text-gray-100 rounded-md text-xs font-medium shadow-lg hover:bg-gray-700 transition-colors flex items-center gap-1 border border-gray-600"
>>>>>>> ec66f5da06316f46f3cfbc565018ba171f1e5c49
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
<<<<<<< HEAD
                    className="p-1.5 rounded-md shadow-lg transition-colors"
                    style={{ backgroundColor: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}
=======
                    className="p-1.5 bg-gray-800 text-gray-100 rounded-md shadow-lg hover:bg-gray-700 transition-colors border border-gray-600"
>>>>>>> ec66f5da06316f46f3cfbc565018ba171f1e5c49
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
  return (
    <div className="flex gap-4 max-w-3xl ml-auto">
      <div className="flex-1 flex flex-col items-end gap-2">
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.images.map((img, idx) => (
              <img
                key={idx}
                src={URL.createObjectURL(img)}
                alt={`Upload ${idx + 1}`}
<<<<<<< HEAD
                className="w-24 h-24 object-cover rounded-lg"
                style={{ border: `1px solid ${colors.border}` }}
=======
                className="w-24 h-24 object-cover rounded-lg border border-gray-700"
>>>>>>> ec66f5da06316f46f3cfbc565018ba171f1e5c49
              />
            ))}
          </div>
        )}
        {message.content && (
          <div className="p-4 rounded-2xl rounded-tr-sm text-sm leading-relaxed max-w-full" style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}>
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
