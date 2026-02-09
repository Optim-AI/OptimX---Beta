'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/auth/supabase/client';
import { Zap, Image, Video, ArrowLeft, Plus, Minus } from 'lucide-react';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';

// PRICING CONFIGURATION - Adjust these values as needed
const PRICING = {
  IMAGE_CREDIT_PRICE: 5, // ₹5 per image credit
  VIDEO_CREDIT_PRICE: 3, // ₹3 per video second
  MIN_QUANTITY: 10,
  MAX_QUANTITY: 1000,
  DEFAULT_IMAGE_QUANTITY: 50,
  DEFAULT_VIDEO_QUANTITY: 60,
};

interface CreditBalance {
  imageCredits: { subscription: number; addon: number; total: number };
  videoCredits: { subscription: number; addon: number; total: number };
}

export default function BuyCreditsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [creditType, setCreditType] = useState<'image' | 'video'>('image');
  const [quantity, setQuantity] = useState(PRICING.DEFAULT_IMAGE_QUANTITY);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchBalance();
    }
  }, [authenticated]);

  // Reset quantity when credit type changes
  useEffect(() => {
    setQuantity(
      creditType === 'image'
        ? PRICING.DEFAULT_IMAGE_QUANTITY
        : PRICING.DEFAULT_VIDEO_QUANTITY
    );
  }, [creditType]);

  async function checkAuth() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      router.replace('/auth/signin');
      return;
    }
    setAuthenticated(true);
    setLoading(false);
  }

  async function fetchBalance() {
    try {
      const response = await authFetch('/api/credits/balance');
      const data = await response.json();
      if (data.success) {
        setBalance({
          imageCredits: data.imageCredits,
          videoCredits: data.videoCredits,
        });
      }
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  }

  const pricePerCredit = creditType === 'image'
    ? PRICING.IMAGE_CREDIT_PRICE
    : PRICING.VIDEO_CREDIT_PRICE;

  const totalPrice = quantity * pricePerCredit;

  function adjustQuantity(delta: number) {
    setQuantity((prev) => {
      const newValue = prev + delta;
      return Math.max(PRICING.MIN_QUANTITY, Math.min(PRICING.MAX_QUANTITY, newValue));
    });
  }

  async function handlePurchase() {
    setPurchasing(true);
    setError(null);

    try {
      // Create order with custom amount
      const orderResponse = await authFetch('/api/billing/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditType,
          credits: quantity,
          amount: totalPrice,
        }),
      });
      const orderData = await orderResponse.json();

      if (!orderData.success) {
        setError(orderData.error || 'Failed to create order');
        setPurchasing(false);
        return;
      }

      // Open Razorpay checkout
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.razorpayOrderId,
        name: 'OptimX',
        description: `${quantity} ${creditType === 'image' ? 'Image Credits' : 'Video Seconds'}`,
        handler: async function (response: any) {
          // Verify payment
          const verifyResponse = await authFetch('/api/billing/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyResponse.json();

          if (verifyData.success) {
            // Refresh balance
            await fetchBalance();
            alert(`Successfully purchased ${quantity} ${creditType === 'image' ? 'image credits' : 'video seconds'}!`);
          } else {
            setError('Payment verification failed');
          }
          setPurchasing(false);
        },
        prefill: {},
        theme: {
          color: colors.primary || '#0088FF',
        },
        modal: {
          ondismiss: function () {
            setPurchasing(false);
          },
        },
      };

      // @ts-ignore
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setPurchasing(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        Loading...
      </div>
    );
  }

  return (
    <>
      {/* Load Razorpay Script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <div className="page">
        <div className="container">
          <button className="back-btn" onClick={() => router.back()}>
            <ArrowLeft size={20} />
            Back
          </button>

          <div className="header">
            <Zap size={48} color={colors.primary} />
            <h1>Buy Credits</h1>
            <p>Purchase credits for image and video generation</p>
          </div>

          {balance && (
            <div className="balance-card">
              <div className="balance-item">
                <Image size={24} color={colors.primary} />
                <div>
                  <div className="balance-label">Image Credits</div>
                  <div className="balance-value">{balance.imageCredits.total}</div>
                </div>
              </div>
              <div className="balance-item">
                <Video size={24} color={colors.primary} />
                <div>
                  <div className="balance-label">Video Credits</div>
                  <div className="balance-value">{balance.videoCredits.total}s</div>
                </div>
              </div>
            </div>
          )}

          <div className="type-toggle">
            <button
              className={`toggle-btn ${creditType === 'image' ? 'active' : ''}`}
              onClick={() => setCreditType('image')}
            >
              <Image size={18} />
              Image Credits
            </button>
            <button
              className={`toggle-btn ${creditType === 'video' ? 'active' : ''}`}
              onClick={() => setCreditType('video')}
            >
              <Video size={18} />
              Video Credits (seconds)
            </button>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="purchase-section">
            <div className="quantity-selector">
              <label>
                How many {creditType === 'image' ? 'image credits' : 'video seconds'} do you want?
              </label>

              <div className="quantity-controls">
                <button
                  className="qty-btn"
                  onClick={() => adjustQuantity(-10)}
                  disabled={quantity <= PRICING.MIN_QUANTITY}
                >
                  <Minus size={20} />
                </button>

                <input
                  type="number"
                  className="qty-input"
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || PRICING.MIN_QUANTITY;
                    setQuantity(Math.max(PRICING.MIN_QUANTITY, Math.min(PRICING.MAX_QUANTITY, val)));
                  }}
                  min={PRICING.MIN_QUANTITY}
                  max={PRICING.MAX_QUANTITY}
                />

                <button
                  className="qty-btn"
                  onClick={() => adjustQuantity(10)}
                  disabled={quantity >= PRICING.MAX_QUANTITY}
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="quick-select">
                {creditType === 'image' ? (
                  <>
                    <button onClick={() => setQuantity(25)}>25</button>
                    <button onClick={() => setQuantity(50)}>50</button>
                    <button onClick={() => setQuantity(100)}>100</button>
                    <button onClick={() => setQuantity(250)}>250</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setQuantity(60)}>60s</button>
                    <button onClick={() => setQuantity(120)}>120s</button>
                    <button onClick={() => setQuantity(300)}>300s</button>
                    <button onClick={() => setQuantity(600)}>600s</button>
                  </>
                )}
              </div>
            </div>

            <div className="price-summary">
              <div className="price-row">
                <span>Price per {creditType === 'image' ? 'credit' : 'second'}:</span>
                <span className="price-value">₹{pricePerCredit}</span>
              </div>
              <div className="price-row">
                <span>Quantity:</span>
                <span className="price-value">{quantity}</span>
              </div>
              <div className="price-row total">
                <span>Total Amount:</span>
                <span className="price-value">₹{totalPrice}</span>
              </div>
            </div>

            <button
              className="purchase-btn"
              disabled={purchasing || quantity < PRICING.MIN_QUANTITY}
              onClick={handlePurchase}
            >
              {purchasing ? 'Processing...' : `Pay ₹${totalPrice}`}
            </button>

            <p className="note">
              Purchased credits never expire. All payments are processed securely through Razorpay.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 50%, #f8fafc 100%);
          padding: 40px 20px;
          font-family: Poppins, Inter, system-ui;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
        }
        .back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid #e2e8f0;
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          margin-bottom: 24px;
          transition: all 200ms;
        }
        .back-btn:hover {
          background: #f8fafc;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        .header h1 {
          font-size: 36px;
          font-weight: 800;
          margin: 16px 0 8px;
          color: #0f172a;
        }
        .header p {
          color: #64748b;
          font-size: 16px;
        }
        .balance-card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          display: flex;
          gap: 32px;
          justify-content: center;
          margin-bottom: 32px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
        }
        .balance-item {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .balance-label {
          font-size: 14px;
          color: #64748b;
          font-weight: 500;
        }
        .balance-value {
          font-size: 28px;
          font-weight: 800;
          color: #0f172a;
        }
        .type-toggle {
          display: flex;
          gap: 12px;
          margin-bottom: 32px;
        }
        .toggle-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 28px;
          border-radius: 10px;
          border: 2px solid #e2e8f0;
          background: white;
          cursor: pointer;
          font-weight: 700;
          font-size: 15px;
          transition: all 200ms;
        }
        .toggle-btn.active {
          border-color: ${colors.primary};
          background: ${colors.primary};
          color: white;
        }
        .purchase-section {
          background: white;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
        }
        .quantity-selector label {
          display: block;
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 16px;
        }
        .quantity-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .qty-btn {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          border: 2px solid #e2e8f0;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 200ms;
        }
        .qty-btn:hover:not(:disabled) {
          border-color: ${colors.primary};
          background: ${colors.primary}10;
        }
        .qty-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .qty-input {
          flex: 1;
          height: 44px;
          border-radius: 8px;
          border: 2px solid #e2e8f0;
          padding: 0 16px;
          font-size: 18px;
          font-weight: 700;
          text-align: center;
          color: #0f172a;
        }
        .qty-input:focus {
          outline: none;
          border-color: ${colors.primary};
        }
        .quick-select {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
        }
        .quick-select button {
          flex: 1;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          background: white;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 200ms;
        }
        .quick-select button:hover {
          border-color: ${colors.primary};
          background: ${colors.primary}10;
          color: ${colors.primary};
        }
        .price-summary {
          background: #f8fafc;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
        }
        .price-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          font-size: 15px;
          color: #64748b;
        }
        .price-row.total {
          border-top: 2px solid #e2e8f0;
          margin-top: 8px;
          padding-top: 16px;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }
        .price-value {
          font-weight: 700;
          color: #0f172a;
        }
        .purchase-btn {
          width: 100%;
          padding: 16px;
          border-radius: 10px;
          background: ${colors.primary};
          color: white;
          font-weight: 700;
          font-size: 16px;
          border: none;
          cursor: pointer;
          transition: all 200ms;
        }
        .purchase-btn:hover:not(:disabled) {
          background: ${colors.primaryHover || '#0073e6'};
          transform: translateY(-2px);
        }
        .purchase-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .note {
          text-align: center;
          font-size: 13px;
          color: #64748b;
          margin-top: 16px;
          margin-bottom: 0;
        }
        .error-msg {
          background: #fef2f2;
          color: #dc2626;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 24px;
          text-align: center;
          font-weight: 600;
        }
        @media (max-width: 768px) {
          .header h1 {
            font-size: 28px;
          }
          .balance-card {
            flex-direction: column;
            gap: 20px;
          }
          .type-toggle {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}
