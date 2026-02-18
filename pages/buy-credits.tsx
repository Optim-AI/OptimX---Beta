'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/auth/supabase/client';
import { Zap, Image, Video, ArrowLeft, Plus, Minus, CheckCircle, Mail, X } from 'lucide-react';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import { BUY_CREDITS_PRICING, calculateTotalsInr } from '@/lib/billing/pricing';

interface CreditBalance {
  imageCredits: { subscription: number; addon: number; total: number };
  videoCredits: { subscription: number; addon: number; total: number };
}

export default function BuyCreditsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [creditType, setCreditType] = useState<'image' | 'video'>('image');
  const [quantity, setQuantity] = useState<number>(BUY_CREDITS_PRICING.defaultImageQuantity);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState<{ quantity: number; type: string } | null>(null);
  const [invoiceEmail, setInvoiceEmail] = useState('optimx.tech@gmail.com');
  const [invoiceEmailSaved, setInvoiceEmailSaved] = useState(false);

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
        ? BUY_CREDITS_PRICING.defaultImageQuantity
        : BUY_CREDITS_PRICING.defaultVideoQuantity
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

  const totals = calculateTotalsInr({ creditType, credits: quantity });

  function adjustQuantity(delta: number) {
    setQuantity((prev) => {
      const newValue = prev + delta;
      return Math.max(BUY_CREDITS_PRICING.minQuantity, Math.min(BUY_CREDITS_PRICING.maxQuantity, newValue));
    });
  }

  async function handlePurchase() {
    setPurchasing(true);
    setError(null);

    try {
      // Create order (amount is computed server-side and includes GST)
      const orderResponse = await authFetch('/api/billing/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditType,
          credits: quantity,
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
        name: 'SkalX AI',
        description: `${quantity} ${creditType === 'image' ? 'Image Credits' : 'Video Seconds'} (incl. GST)`,
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
            setPurchaseInfo({ quantity, type: creditType === 'image' ? 'image credits' : 'video seconds' });
            setShowSuccess(true);
            setInvoiceEmailSaved(false);
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
      <div className="app-page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: colors.foreground }}>
        Loading...
      </div>
    );
  }

  return (
    <>
      {/* Load Razorpay Script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <div className="page app-page">
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
                  disabled={quantity <= BUY_CREDITS_PRICING.minQuantity}
                >
                  <Minus size={20} />
                </button>

                <input
                  type="number"
                  className="qty-input"
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || BUY_CREDITS_PRICING.minQuantity;
                    setQuantity(Math.max(BUY_CREDITS_PRICING.minQuantity, Math.min(BUY_CREDITS_PRICING.maxQuantity, val)));
                  }}
                  min={BUY_CREDITS_PRICING.minQuantity}
                  max={BUY_CREDITS_PRICING.maxQuantity}
                />

                <button
                  className="qty-btn"
                  onClick={() => adjustQuantity(10)}
                  disabled={quantity >= BUY_CREDITS_PRICING.maxQuantity}
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
                <span className="price-value">₹{totals.unitPriceInr}</span>
              </div>
              <div className="price-row">
                <span>Quantity:</span>
                <span className="price-value">{quantity}</span>
              </div>
              <div className="price-row">
                <span>Subtotal:</span>
                <span className="price-value">₹{totals.subtotalInr}</span>
              </div>
              <div className="price-row">
                <span>GST ({Math.round(totals.gstRate * 100)}%):</span>
                <span className="price-value">₹{totals.gstAmountInr}</span>
              </div>
              <div className="price-row total">
                <span>Total (incl. GST):</span>
                <span className="price-value">₹{totals.totalInr}</span>
              </div>
            </div>

            <button
              className="purchase-btn"
              disabled={purchasing || quantity < BUY_CREDITS_PRICING.minQuantity}
              onClick={handlePurchase}
            >
              {purchasing ? 'Processing...' : `Pay ₹${totals.totalInr}`}
            </button>

            <p className="note">
              Purchased credits never expire. All payments are processed securely through Razorpay.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Success Modal */}
      {showSuccess && purchaseInfo && (
        <div className="modal-overlay" onClick={() => setShowSuccess(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowSuccess(false)}>
              <X size={20} />
            </button>
            <div className="modal-icon">
              <CheckCircle size={56} color="#22c55e" />
            </div>
            <h2 className="modal-title">Payment Successful!</h2>
            <p className="modal-subtitle">
              You have purchased <strong>{purchaseInfo.quantity} {purchaseInfo.type}</strong>.
            </p>

            <div className="invoice-section">
              <div className="invoice-header">
                <Mail size={18} color={colors.primary} />
                <span>We will mail your invoice to</span>
              </div>
              <div className="invoice-email-row">
                <input
                  type="email"
                  className="invoice-email-input"
                  value={invoiceEmail}
                  onChange={(e) => { setInvoiceEmail(e.target.value); setInvoiceEmailSaved(false); }}
                />
                <button
                  className="invoice-save-btn"
                  onClick={() => setInvoiceEmailSaved(true)}
                  disabled={!invoiceEmail.trim() || invoiceEmailSaved}
                >
                  {invoiceEmailSaved ? 'Saved' : 'Save'}
                </button>
              </div>
              {invoiceEmailSaved && (
                <p className="invoice-saved-msg">Invoice will be sent to this email.</p>
              )}
            </div>

            <button className="modal-done-btn" onClick={() => setShowSuccess(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: ${colors.background};
          padding: 40px 20px;
          font-family: Poppins, Inter, system-ui;
          color: ${colors.foreground};
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
        }
        .back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: ${colors.card};
          border: 1px solid ${colors.border};
          color: ${colors.foreground};
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          margin-bottom: 24px;
          transition: all 200ms;
        }
        .back-btn:hover {
          background: ${colors.muted};
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        .header h1 {
          font-size: 36px;
          font-weight: 800;
          margin: 16px 0 8px;
          color: ${colors.foreground};
        }
        .header p {
          color: ${colors.mutedForeground};
          font-size: 16px;
        }
        .balance-card {
          background: ${colors.card};
          border: 1px solid ${colors.border};
          border-radius: 16px;
          padding: 24px;
          display: flex;
          gap: 32px;
          justify-content: center;
          margin-bottom: 32px;
          box-shadow: ${colors.shadowSoft};
        }
        .balance-item {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .balance-label {
          font-size: 14px;
          color: ${colors.mutedForeground};
          font-weight: 500;
        }
        .balance-value {
          font-size: 28px;
          font-weight: 800;
          color: ${colors.foreground};
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
          border: 2px solid ${colors.border};
          background: ${colors.card};
          color: ${colors.foreground};
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
          background: ${colors.card};
          border: 1px solid ${colors.border};
          border-radius: 16px;
          padding: 32px;
          box-shadow: ${colors.shadowSoft};
        }
        .quantity-selector label {
          display: block;
          font-size: 16px;
          font-weight: 600;
          color: ${colors.foreground};
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
          border: 2px solid ${colors.border};
          background: ${colors.card};
          color: ${colors.foreground};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 200ms;
        }
        .qty-btn:hover:not(:disabled) {
          border-color: ${colors.primary};
          background: hsl(213 100% 55% / 0.15);
        }
        .qty-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .qty-input {
          flex: 1;
          height: 44px;
          border-radius: 8px;
          border: 2px solid ${colors.border};
          background: ${colors.input};
          padding: 0 16px;
          font-size: 18px;
          font-weight: 700;
          text-align: center;
          color: ${colors.foreground};
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
          border: 1px solid ${colors.border};
          background: ${colors.card};
          color: ${colors.foreground};
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 200ms;
        }
        .quick-select button:hover {
          border-color: ${colors.primary};
          background: hsl(213 100% 55% / 0.15);
          color: ${colors.primary};
        }
        .price-summary {
          background: ${colors.muted};
          border: 1px solid ${colors.border};
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
          color: ${colors.mutedForeground};
        }
        .price-row.total {
          border-top: 2px solid ${colors.border};
          margin-top: 8px;
          padding-top: 16px;
          font-size: 18px;
          font-weight: 700;
          color: ${colors.foreground};
        }
        .price-value {
          font-weight: 700;
          color: ${colors.foreground};
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
          background: ${colors.primaryHover || 'hsl(213 100% 60%)'};
          transform: translateY(-2px);
        }
        .purchase-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .note {
          text-align: center;
          font-size: 13px;
          color: ${colors.mutedForeground};
          margin-top: 16px;
          margin-bottom: 0;
        }
        .error-msg {
          background: hsl(0 84% 55% / 0.15);
          border: 1px solid ${colors.destructive};
          color: ${colors.destructive};
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
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: grid;
          place-items: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal-card {
          background: ${colors.card};
          border: 1px solid ${colors.border};
          border-radius: 20px;
          padding: 40px 36px;
          max-width: 440px;
          width: 100%;
          text-align: center;
          position: relative;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: modalIn 300ms cubic-bezier(.2,.9,.3,1);
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .modal-close {
          position: absolute;
          top: 14px;
          right: 14px;
          background: ${colors.muted};
          border: 1px solid ${colors.border};
          border-radius: 8px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: ${colors.mutedForeground};
          transition: all 200ms;
        }
        .modal-close:hover {
          background: ${colors.border};
          color: ${colors.foreground};
        }
        .modal-icon {
          margin-bottom: 16px;
        }
        .modal-title {
          font-size: 22px;
          font-weight: 800;
          color: ${colors.foreground};
          margin: 0 0 8px;
        }
        .modal-subtitle {
          font-size: 15px;
          color: ${colors.mutedForeground};
          margin: 0 0 28px;
        }
        .invoice-section {
          background: ${colors.muted};
          border: 1px solid ${colors.border};
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          text-align: left;
        }
        .invoice-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: ${colors.foreground};
          margin-bottom: 12px;
        }
        .invoice-email-row {
          display: flex;
          gap: 8px;
        }
        .invoice-email-input {
          flex: 1;
          height: 40px;
          border-radius: 8px;
          border: 1px solid ${colors.border};
          background: ${colors.card};
          color: ${colors.foreground};
          padding: 0 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 200ms;
        }
        .invoice-email-input:focus {
          border-color: ${colors.primary};
        }
        .invoice-save-btn {
          padding: 0 18px;
          height: 40px;
          border-radius: 8px;
          border: none;
          background: ${colors.primary};
          color: white;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 200ms;
          white-space: nowrap;
        }
        .invoice-save-btn:hover:not(:disabled) {
          opacity: 0.9;
        }
        .invoice-save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .invoice-saved-msg {
          font-size: 13px;
          color: #22c55e;
          margin: 8px 0 0;
          font-weight: 500;
        }
        .modal-done-btn {
          width: 100%;
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
        .modal-done-btn:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }
      `}</style>
    </>
  );
}
