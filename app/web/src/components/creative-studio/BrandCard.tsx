// BrandCard.tsx
// Brand snapshot display and edit card component

import React from 'react';
import type { BrandSnapshot } from './types';

type BrandCardProps = {
  brand: BrandSnapshot;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onChange: (brand: BrandSnapshot) => void;
  onConfirm: () => void;
};

export default function BrandCard({
  brand,
  editing,
  onEdit,
  onDone,
  onChange,
  onConfirm,
}: BrandCardProps) {
  return (
    <div className="flex gap-4 max-w-4xl">
      <div className="flex-shrink-0 w-8" />
      <div className="flex-1">
        <div className="border-2 border-gray-700 rounded-xl p-6 bg-gray-800 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-100">Brand Snapshot</h3>
            {!editing ? (
              <button
                onClick={onEdit}
                className="text-sm text-blue-400 hover:text-blue-300 font-medium"
              >
                Edit
              </button>
            ) : (
              <button
                onClick={onDone}
                className="text-sm text-blue-400 hover:text-blue-300 font-medium"
              >
                Done
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  Brand Name
                </label>
                <input
                  type="text"
                  value={brand.name}
                  onChange={(e) => onChange({ ...brand, name: e.target.value })}
                  className="w-full border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  Description
                </label>
                <textarea
                  value={brand.description}
                  onChange={(e) => onChange({ ...brand, description: e.target.value })}
                  className="w-full border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  Audience
                </label>
                <input
                  type="text"
                  value={brand.audience}
                  onChange={(e) => onChange({ ...brand, audience: e.target.value })}
                  className="w-full border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  Offering
                </label>
                <input
                  type="text"
                  value={brand.offering}
                  onChange={(e) => onChange({ ...brand, offering: e.target.value })}
                  className="w-full border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  Tone
                </label>
                <input
                  type="text"
                  value={brand.tone}
                  onChange={(e) => onChange({ ...brand, tone: e.target.value })}
                  className="w-full border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                  Brand Name
                </div>
                <div className="text-lg font-semibold text-gray-100">{brand.name}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                  About
                </div>
                <div className="text-sm text-gray-300 leading-relaxed">{brand.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700">
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                    Audience
                  </div>
                  <div className="text-sm text-gray-300">{brand.audience}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                    Offering
                  </div>
                  <div className="text-sm text-gray-300">{brand.offering}</div>
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                  Tone
                </div>
                <div className="text-sm text-gray-300">{brand.tone}</div>
              </div>
            </div>
          )}

          {!editing && (
            <div className="flex justify-end pt-4 mt-4 border-t border-gray-700">
              <button
                onClick={onConfirm}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Looks right → Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
