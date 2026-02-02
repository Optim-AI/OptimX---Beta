// ChatBubbles.tsx
// System and User chat bubble components

import React from 'react';
import type { Message } from './types';

type SystemBubbleProps = {
  children: React.ReactNode;
  images?: File[];
};

export function SystemBubble({ children, images }: SystemBubbleProps) {
  return (
    <div className="flex gap-4 max-w-3xl">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
        <span className="text-xs text-gray-600">AI</span>
      </div>
      <div className="flex-1 flex flex-col gap-2">
        {images && images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {images.map((img, idx) => (
              <img
                key={idx}
                src={URL.createObjectURL(img)}
                alt={`Fetched image ${idx + 1}`}
                className="w-32 h-32 object-cover rounded-lg border border-gray-200 shadow-sm"
              />
            ))}
          </div>
        )}
        <div className="bg-gray-100 text-gray-700 p-4 rounded-2xl rounded-tl-sm text-sm leading-relaxed">
          {children}
        </div>
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
                className="w-24 h-24 object-cover rounded-lg border border-gray-200"
              />
            ))}
          </div>
        )}
        {message.content && (
          <div className="bg-blue-600 text-white p-4 rounded-2xl rounded-tr-sm text-sm leading-relaxed max-w-full">
            {message.content}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
        <span className="text-xs text-white">You</span>
      </div>
    </div>
  );
}
