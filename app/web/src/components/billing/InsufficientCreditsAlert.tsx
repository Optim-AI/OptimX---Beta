'use client';

import React from 'react';
import { useRouter } from 'next/router';
import { AlertCircle, Zap } from 'lucide-react';
import colors from '@/lib/ui/colors';

interface InsufficientCreditsAlertProps {
  type: 'image' | 'video';
  onClose?: () => void;
}

export function InsufficientCreditsAlert({ type, onClose }: InsufficientCreditsAlertProps) {
  const router = useRouter();

  return (
    <div className="alert">
      <div className="alert-icon">
        <AlertCircle size={24} />
      </div>
      <div className="alert-content">
        <h3>Insufficient {type === 'image' ? 'Image' : 'Video'} Credits</h3>
        <p>
          You don't have enough credits to generate {type === 'image' ? 'images' : 'videos'}. Purchase more
          credits to continue creating.
        </p>
      </div>
      <button className="buy-btn" onClick={() => router.push('/buy-credits')}>
        <Zap size={18} />
        Buy Credits
      </button>
      {onClose && (
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      )}

      <style jsx>{`
        .alert {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 2px solid #f59e0b;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 16px 0;
          position: relative;
        }
        .alert-icon {
          color: #d97706;
          flex-shrink: 0;
        }
        .alert-content {
          flex: 1;
        }
        .alert-content h3 {
          font-size: 16px;
          font-weight: 700;
          color: #92400e;
          margin: 0 0 4px 0;
        }
        .alert-content p {
          font-size: 14px;
          color: #78350f;
          margin: 0;
        }
        .buy-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: ${colors.primary};
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          transition: all 200ms;
          flex-shrink: 0;
        }
        .buy-btn:hover {
          background: ${colors.primaryHover || '#0073e6'};
          transform: translateY(-2px);
        }
        .close-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          font-size: 24px;
          color: #92400e;
          cursor: pointer;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }
        .close-btn:hover {
          background: rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
}
