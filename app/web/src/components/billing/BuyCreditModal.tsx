'use client';

import React from 'react';
import { useRouter } from 'next/router';
import { X, Zap } from 'lucide-react';
import colors from '@/lib/ui/colors';

interface BuyCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'image' | 'video';
}

/**
 * Simple modal that redirects to the /buy-credits page
 * This is a lightweight wrapper for when you need a modal trigger
 */
export function BuyCreditModal({ isOpen, onClose, defaultType = 'image' }: BuyCreditModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleBuyCredits = () => {
    onClose();
    router.push('/buy-credits');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-body">
          <Zap size={48} color={colors.primary} />
          <h2>Buy More Credits</h2>
          <p>
            Purchase {defaultType === 'image' ? 'image' : 'video'} credits to continue creating amazing content.
          </p>
          <button className="buy-btn" onClick={handleBuyCredits}>
            Go to Credit Store
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal-content {
          background: white;
          border-radius: 16px;
          padding: 32px;
          max-width: 400px;
          width: 100%;
          position: relative;
        }
        .close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          color: #64748b;
        }
        .close-btn:hover {
          background: #f1f5f9;
        }
        .modal-body {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .modal-body h2 {
          font-size: 24px;
          font-weight: 700;
          margin: 0;
          color: #0f172a;
        }
        .modal-body p {
          color: #64748b;
          font-size: 15px;
          margin: 0;
        }
        .buy-btn {
          width: 100%;
          margin-top: 8px;
          padding: 14px;
          border-radius: 10px;
          background: ${colors.primary};
          color: white;
          font-weight: 700;
          font-size: 15px;
          border: none;
          cursor: pointer;
          transition: all 200ms;
        }
        .buy-btn:hover {
          background: ${colors.primaryHover || '#0073e6'};
        }
      `}</style>
    </div>
  );
}
