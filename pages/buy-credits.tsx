'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/auth/supabase/client';
import { Image, Video, ArrowLeft, Plus, Minus, Check, Shield, CheckCircle, Mail, X, Ticket } from 'lucide-react';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import Sidebar from '@/app/web/src/components/Sidebar';
import { SkeletonPageLoader } from '@/app/web/src/components/ui/skeletons';
import {
    BUY_CREDITS_PRICING,
    calculateTotalsInr,
    getMinQuantity,
    getMaxQuantity,
    getQuantityStep,
    clampQuantity,
  } from '@/lib/billing/pricing';

interface CreditBalance {
  imageCredits: { subscription: number; addon: number; total: number };
  videoCredits: { subscription: number; addon: number; total: number };
}

interface VoucherItem {
  id: string;
  creditType: string;
  credits: number;
  expiresAt: string | null;
  note: string | null;
}

export default function BuyCreditsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [creditType, setCreditType] = useState<'image' | 'video'>('image');
  const [quantity, setQuantity] = useState<number>(BUY_CREDITS_PRICING.defaultImageQuantity);
  const [inputValue, setInputValue] = useState<string>(String(BUY_CREDITS_PRICING.defaultImageQuantity));
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState<{ quantity: number; type: string; voucherCredits?: number } | null>(null);
  const [billingEmail, setBillingEmail] = useState('');
  const [availableVouchers, setAvailableVouchers] = useState<VoucherItem[]>([]);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [livePricing, setLivePricing] = useState<{ imageCreditPriceInr: number; videoSecondPriceInr: number } | null>(null);

  useEffect(() => {
    checkAuth();
    // Fetch live pricing (public endpoint, no auth needed)
    fetch('/api/billing/pricing')
      .then((res) => res.json())
      .then((data) => {
        if (data.imageCreditPriceInr && data.videoSecondPriceInr) {
          setLivePricing({
            imageCreditPriceInr: data.imageCreditPriceInr,
            videoSecondPriceInr: data.videoSecondPriceInr,
          });
        }
      })
      .catch(() => {
        // Fall back to hardcoded defaults — livePricing stays null
      });
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchBalance();
    }
  }, [authenticated]);

  // Reset quantity when credit type changes
  useEffect(() => {
    const def = creditType === 'image'
      ? BUY_CREDITS_PRICING.defaultImageQuantity
      : BUY_CREDITS_PRICING.defaultVideoQuantity;
    setQuantity(def);
    setInputValue(String(def));
    setQuantityError(null);
    setSelectedVoucherId(null);
  }, [creditType]);

  // Fetch available vouchers when credit type changes
  useEffect(() => {
    if (!authenticated) return;
    async function fetchVouchers() {
      setVouchersLoading(true);
      try {
        const response = await authFetch(`/api/vouchers/my-vouchers?creditType=${creditType}`);
        const data = await response.json();
        if (data.success) {
          setAvailableVouchers(data.vouchers);
        } else {
          setAvailableVouchers([]);
        }
      } catch {
        setAvailableVouchers([]);
      } finally {
        setVouchersLoading(false);
      }
    }
    fetchVouchers();
  }, [creditType, authenticated]);

  async function checkAuth() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      router.replace('/auth/signin');
      return;
    }
    if (data.user.email) {
      setBillingEmail(data.user.email);
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

  const unitPrice = livePricing
    ? (creditType === 'image' ? livePricing.imageCreditPriceInr : livePricing.videoSecondPriceInr)
    : undefined;
  const totals = calculateTotalsInr({ creditType, credits: quantity, overrides: unitPrice ? { unitPriceInr: unitPrice } : undefined });

  function adjustQuantity(delta: number) {
    const step = getQuantityStep(creditType);
    const newQty = clampQuantity(creditType, quantity + delta * step);
    setQuantity(newQty);
    setInputValue(String(newQty));
    setQuantityError(null);
  }

  function validateQuantity(value: string): boolean {
    const num = parseInt(value, 10);
    const min = getMinQuantity(creditType);
    if (value === '' || Number.isNaN(num)) {
      setQuantityError(`Minimum order value is ${creditType === 'image' ? '10 credits' : '8 seconds'} for ${creditType === 'image' ? 'image' : 'video'}.`);
      return false;
    }
    if (num < min) {
      setQuantityError(`Minimum order value is ${creditType === 'image' ? '10 credits' : '8 seconds'} for ${creditType === 'image' ? 'image' : 'video'}.`);
      return false;
    }
    if (num > getMaxQuantity(creditType)) {
      setQuantityError(`Maximum order is ${getMaxQuantity(creditType)} ${creditType === 'image' ? 'credits' : 'seconds'}.`);
      return false;
    }
    setQuantityError(null);
    return true;
  }

  function handleQuantityInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val !== '' && !/^\d*$/.test(val)) return;
    setInputValue(val);
    if (val === '') {
      setQuantityError(`Minimum order value is ${creditType === 'image' ? '10 credits' : '8 seconds'} for ${creditType === 'image' ? 'image' : 'video'}.`);
      return;
    }
    const num = parseInt(val, 10);
    if (Number.isNaN(num)) return;
    const min = getMinQuantity(creditType);
    const max = getMaxQuantity(creditType);
    if (num < min) {
      setQuantityError(`Minimum order value is ${creditType === 'image' ? '10 credits' : '8 seconds'} for ${creditType === 'image' ? 'image' : 'video'}.`);
    } else if (num > max) {
      setQuantityError(`Maximum order is ${max} ${creditType === 'image' ? 'credits' : 'seconds'}.`);
    } else {
      setQuantityError(null);
    }
    setQuantity(num);
  }

  function handleQuantityBlur() {
    const trimmed = inputValue.trim();
    if (trimmed === '') {
      const min = getMinQuantity(creditType);
      setInputValue(String(min));
      setQuantity(min);
      setQuantityError(null);
      return;
    }
    const num = parseInt(trimmed, 10);
    if (Number.isNaN(num)) {
      const min = getMinQuantity(creditType);
      setInputValue(String(min));
      setQuantity(min);
      setQuantityError(null);
      return;
    }
    const clamped = clampQuantity(creditType, num);
    setInputValue(String(clamped));
    setQuantity(clamped);
    validateQuantity(String(clamped));
  }

  function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function handlePurchase() {
    if (!isValidEmail(billingEmail)) {
      setError('Please enter a valid billing email address');
      return;
    }

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
          billingEmail,
          ...(selectedVoucherId ? { voucherId: selectedVoucherId } : {}),
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
            const voucherBonus = orderData.voucherCredits || 0;
            setPurchaseInfo({
              quantity,
              type: creditType === 'image' ? 'image credits' : 'video seconds',
              ...(voucherBonus > 0 ? { voucherCredits: voucherBonus } : {}),
            });
            setShowSuccess(true);
            // Remove used voucher from available list
            if (selectedVoucherId) {
              setAvailableVouchers((prev) => prev.filter((v) => v.id !== selectedVoucherId));
              setSelectedVoucherId(null);
            }
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
      <div className="min-h-screen flex app-page">
        <Sidebar />
        <div className="flex-1" style={{ display: 'grid', placeItems: 'center', color: colors.foreground }}>
          <SkeletonPageLoader variant="buy-credits" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Load Razorpay Script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <div className="min-h-screen flex app-page">
        <Sidebar />
        <div className="page flex-1" style={{ borderLeft: `1px solid ${colors.border}` }}>
        <div className="container">
          <header className="top-bar">
            <button className="back-btn" onClick={() => router.back()}>
              <ArrowLeft size={20} />
              Back
            </button>
            <div className="header">
              <h1>Buy Credits</h1>
              <p>Purchase credits for image and video generation</p>
            </div>
          </header>

          {balance && (
            <div className="balance-cards">
              <div className="balance-card-item balance-card-image" style={{ background: 'hsl(213 100% 55% / 0.15)', borderColor: 'hsl(213 100% 55% / 0.35)' }}>
                <div className="balance-value" style={{ color: colors.primary }}>{balance.imageCredits.total}</div>
                <div className="balance-label" style={{ color: colors.primary }}>Available</div>
                <div className="balance-type" style={{ color: colors.primary }}>Image Credits</div>
              </div>
              <div className="balance-card-item balance-card-video" style={{ background: 'hsl(270 80% 55% / 0.15)', borderColor: 'hsl(270 80% 55% / 0.35)' }}>
                <div className="balance-value" style={{ color: 'hsl(270 80% 70%)' }}>{balance.videoCredits.total}s</div>
                <div className="balance-label" style={{ color: 'hsl(270 80% 70%)' }}>Seconds Remaining</div>
                <div className="balance-type" style={{ color: 'hsl(270 80% 70%)' }}>Video Credits</div>
              </div>
            </div>
          )}

          {error && <div className="error-msg">{error}</div>}

          <div className="main-grid">
            <div className="main-left">
              <div className="type-toggle">
                <div className="segmented-control">
                  <button
                    className={`segmented-tab ${creditType === 'image' ? 'active' : ''}`}
                    onClick={() => setCreditType('image')}
                  >
                    <Image size={18} />
                    Image Credits
                  </button>
                  <button
                    className={`segmented-tab ${creditType === 'video' ? 'active' : ''}`}
                    onClick={() => setCreditType('video')}
                  >
                    <Video size={18} />
                    Video Credits (seconds)
                  </button>
                </div>
              </div>

              <div className="quantity-selector">
                <label>
                  How many {creditType === 'image' ? 'image credits' : 'video seconds'} do you want?
                </label>
                <div className="quantity-row">
                  <div className="quantity-controls">
                    <button
                      className="qty-btn"
                      onClick={() => adjustQuantity(-1)}
                      disabled={quantity <= getMinQuantity(creditType)}
                    >
                      <Minus size={20} />
                    </button>
                    <div className="qty-input-wrap">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="qty-input"
                        value={inputValue}
                        onChange={handleQuantityInputChange}
                        onBlur={handleQuantityBlur}
                        aria-invalid={!!quantityError}
                      />
                      {quantityError && (
                        <p className="qty-validation-error" role="alert">
                          {quantityError}
                        </p>
                      )}
                    </div>
                    <button
                      className="qty-btn"
                      onClick={() => adjustQuantity(1)}
                      disabled={quantity >= getMaxQuantity(creditType)}
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <div className="preset-chips">
                    {creditType === 'image' ? (
                      <>
                        <button
                          className={`preset-chip ${quantity === 25 ? 'selected' : ''}`}
                          onClick={() => setQuantity(25)}
                        >
                          25
                        </button>
                        <button
                          className={`preset-chip ${quantity === 50 ? 'selected' : ''}`}
                          onClick={() => setQuantity(50)}
                        >
                          50
                        </button>
                        <button
                          className={`preset-chip ${quantity === 100 ? 'selected' : ''}`}
                          onClick={() => setQuantity(100)}
                        >
                          100
                        </button>
                        <button
                          className={`preset-chip ${quantity === 250 ? 'selected' : ''}`}
                          onClick={() => setQuantity(250)}
                        >
                          250
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className={`preset-chip ${quantity === 8 ? 'selected' : ''}`}
                          onClick={() => setQuantity(8)}
                        >
                          8s
                        </button>
                        <button
                          className={`preset-chip ${quantity === 24 ? 'selected' : ''}`}
                          onClick={() => setQuantity(24)}
                        >
                          24s
                        </button>
                        <button
                          className={`preset-chip ${quantity === 48 ? 'selected' : ''}`}
                          onClick={() => setQuantity(48)}
                        >
                          48s
                        </button>
                        <button
                          className={`preset-chip ${quantity === 96 ? 'selected' : ''}`}
                          onClick={() => setQuantity(96)}
                        >
                          96s
                        </button>
                        <button
                          className={`preset-chip ${quantity === 192 ? 'selected' : ''}`}
                          onClick={() => setQuantity(192)}
                        >
                          192s
                        </button>
                        <button
                          className={`preset-chip ${quantity === 384 ? 'selected' : ''}`}
                          onClick={() => setQuantity(384)}
                        >
                          384s
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Voucher Selection */}
              {availableVouchers.length > 0 && (
                <div className="voucher-section">
                  <label>
                    <Ticket size={16} />
                    Apply a voucher (optional)
                  </label>
                  <div className="voucher-chips">
                    {availableVouchers.map((voucher) => (
                      <button
                        key={voucher.id}
                        className={`voucher-chip ${selectedVoucherId === voucher.id ? 'selected' : ''}`}
                        onClick={() => setSelectedVoucherId(selectedVoucherId === voucher.id ? null : voucher.id)}
                      >
                        <Ticket size={14} />
                        <span>+{voucher.credits} {voucher.creditType === 'image' ? 'credits' : 'seconds'}</span>
                        {voucher.expiresAt && (
                          <span className="voucher-expiry">
                            expires {new Date(voucher.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                        {selectedVoucherId === voucher.id && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="trust-section">
                <div className="trust-row">
                  <div className="trust-item">
                    <Check size={16} color={colors.green600} />
                    <span>Credits never expire</span>
                  </div>
                  <div className="trust-item">
                    <Shield size={16} color={colors.primary} />
                    <span>Secure via Razorpay</span>
                  </div>
                </div>
                <div className="trust-item trust-email-row">
                  <Mail size={16} color={colors.mutedForeground} />
                  <div className="trust-email-wrap">
                    <span>GST invoice to</span>
                    <input
                      type="email"
                      className="invoice-email-input"
                      placeholder="your@email.com"
                      value={billingEmail}
                      onChange={(e) => setBillingEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="main-right">
              <div className="summary-card">
                <div className="price-summary">
                  <div className="price-row">
                    <span className="price-label">Price per {creditType === 'image' ? 'credit' : 'second'}</span>
                    <span className="price-value">₹{totals.unitPriceInr}</span>
                  </div>
                  <div className="price-row">
                    <span className="price-label">Quantity</span>
                    <span className="price-value">{quantity}</span>
                  </div>
                  <div className="price-row">
                    <span className="price-label">Subtotal</span>
                    <span className="price-value">₹{totals.subtotalInr}</span>
                  </div>
                  <div className="price-row">
                    <span className="price-label">GST ({Math.round(totals.gstRate * 100)}%)</span>
                    <span className="price-value">₹{totals.gstAmountInr}</span>
                  </div>
                  {selectedVoucherId && (() => {
                    const v = availableVouchers.find((v) => v.id === selectedVoucherId);
                    return v ? (
                      <div className="price-row" style={{ color: '#16a34a' }}>
                        <span className="price-label" style={{ color: '#16a34a' }}>
                          <Ticket size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          Voucher Bonus
                        </span>
                        <span className="price-value" style={{ color: '#16a34a' }}>
                          +{v.credits} {v.creditType === 'image' ? 'credits' : 'seconds'}
                        </span>
                      </div>
                    ) : null;
                  })()}
                  <div className="price-divider" />
                  <div className="price-row total">
                    <span className="price-label">Total</span>
                    <span className="price-value-total">₹{totals.totalInr}</span>
                  </div>
                </div>
                <button
                  className="purchase-btn"
                  disabled={purchasing || !!quantityError || quantity < getMinQuantity(creditType) || !isValidEmail(billingEmail)}
                  onClick={handlePurchase}
                >
                  {purchasing ? 'Processing...' : `Pay ₹${totals.totalInr}`}
                </button>
              </div>
            </div>
          </div>
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
              {purchaseInfo.voucherCredits && purchaseInfo.voucherCredits > 0 && (
                <>
                  <br />
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>
                    Plus {purchaseInfo.voucherCredits} bonus {purchaseInfo.type} from your voucher!
                  </span>
                </>
              )}
            </p>

            <div className="invoice-section">
              <div className="invoice-header">
                <Mail size={18} color={colors.primary} />
                <span>Invoice will be sent to</span>
              </div>
              <p className="invoice-email-display">{billingEmail}</p>
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
          padding: 40px 32px;
          font-family: Poppins, Inter, system-ui;
          color: ${colors.foreground};
          overflow-y: auto;
        }
        .container {
          max-width: 1100px;
          margin: 0 auto;
        }
        .top-bar {
          display: flex;
          align-items: center;
          gap: 32px;
          margin-bottom: 32px;
        }
        .back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: 1px solid ${colors.border};
          color: ${colors.foreground};
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .back-btn:hover {
          background: ${colors.card};
          border-color: hsl(0 0% 30%);
        }
        .header {
          flex: 1;
        }
        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 4px;
          color: ${colors.foreground};
          letter-spacing: -0.02em;
        }
        .header p {
          color: ${colors.mutedForeground};
          font-size: 14px;
          margin: 0;
        }
        .balance-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 32px;
        }
        .balance-card-item {
          background: ${colors.card};
          border: 1px solid ${colors.border};
          border-radius: 12px;
          padding: 20px 24px;
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .balance-card-item:hover {
          box-shadow: 0 4px 12px hsl(0 0% 0% / 0.25);
          transform: translateY(-1px);
        }
        .balance-card-item .balance-value {
          font-size: 28px;
          font-weight: 700;
          color: ${colors.foreground};
          letter-spacing: -0.02em;
          margin-bottom: 4px;
        }
        .balance-card-item .balance-label {
          font-size: 12px;
          color: ${colors.mutedForeground};
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .balance-card-item .balance-type {
          font-size: 13px;
          color: ${colors.mutedForeground};
          margin-top: 8px;
        }
        .main-grid {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 32px;
          align-items: start;
        }
        .main-left {
          background: ${colors.card};
          border: 1px solid ${colors.border};
          border-radius: 16px;
          padding: 28px 32px;
        }
        .main-right {
          position: sticky;
          top: 24px;
        }
        .summary-card {
          background: ${colors.card};
          border: 1px solid ${colors.border};
          border-radius: 16px;
          padding: 24px;
        }
        .type-toggle {
          margin-bottom: 28px;
        }
        .segmented-control {
          display: flex;
          background: ${colors.input};
          border: 1px solid ${colors.border};
          border-radius: 10px;
          padding: 4px;
          gap: 0;
        }
        .segmented-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: ${colors.mutedForeground};
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.25s ease;
        }
        .segmented-tab.active {
          background: hsl(213 100% 55% / 0.15);
          color: ${colors.primary};
          border: 1px solid hsl(213 100% 55% / 0.35);
        }
        .segmented-tab:hover:not(.active) {
          color: ${colors.foreground};
        }
        .quantity-selector {
          margin-bottom: 28px;
        }
        .quantity-selector label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: ${colors.foreground};
          margin-bottom: 12px;
        }
        .quantity-row {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }
        .quantity-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .preset-chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .preset-chip {
          padding: 10px 18px;
          border-radius: 8px;
          border: 1px solid ${colors.border};
          background: transparent;
          color: ${colors.foreground};
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        .preset-chip:hover {
          border-color: hsl(213 100% 55% / 0.5);
          background: hsl(213 100% 55% / 0.08);
        }
        .preset-chip.selected {
          background: hsl(213 100% 55% / 0.2);
          border-color: ${colors.primary};
          color: ${colors.primary};
        }
        .qty-btn {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          border: 1px solid ${colors.border};
          background: ${colors.input};
          color: ${colors.foreground};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .qty-btn:hover:not(:disabled) {
          border-color: ${colors.primary};
          background: hsl(213 100% 55% / 0.12);
        }
        .qty-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .qty-input-wrap {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .qty-input {
          width: 100%;
          height: 44px;
          border-radius: 8px;
          border: 1px solid ${colors.border};
          background: ${colors.input};
          padding: 0 16px;
          font-size: 16px;
          font-weight: 600;
          text-align: center;
          color: ${colors.foreground};
        }
        .qty-input:focus {
          outline: none;
          border-color: ${colors.primary};
        }
        .qty-input[aria-invalid="true"] {
          border-color: hsl(0 84% 55% / 0.6);
        }
        .qty-validation-error {
          font-size: 12px;
          color: ${colors.destructive};
          margin: 0;
          line-height: 1.3;
        }
        .trust-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-top: 20px;
          border-top: 1px solid ${colors.border};
        }
        .voucher-section {
          margin-bottom: 28px;
          padding-top: 20px;
          border-top: 1px solid ${colors.border};
        }
        .voucher-section label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: ${colors.foreground};
          margin-bottom: 12px;
        }
        .voucher-chips {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .voucher-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 10px;
          border: 1px solid ${colors.border};
          background: transparent;
          color: ${colors.foreground};
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.2s ease;
          text-align: left;
        }
        .voucher-chip:hover {
          border-color: hsl(142 70% 45% / 0.5);
          background: hsl(142 70% 45% / 0.06);
        }
        .voucher-chip.selected {
          background: hsl(142 70% 45% / 0.12);
          border-color: hsl(142 70% 45% / 0.6);
          color: hsl(142 70% 30%);
        }
        .voucher-expiry {
          font-size: 12px;
          color: ${colors.mutedForeground};
          margin-left: auto;
        }
        .trust-row {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }
        .trust-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: ${colors.mutedForeground};
        }
        .trust-item svg {
          flex-shrink: 0;
        }
        .trust-email-row {
          align-items: flex-start;
        }
        .trust-email-wrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }
        .trust-email-wrap span {
          font-size: 13px;
        }
        .invoice-email-input {
          background: ${colors.input};
          border: 1px solid ${colors.border};
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 14px;
          color: ${colors.foreground};
          outline: none;
          transition: border-color 0.2s;
        }
        .invoice-email-input:focus {
          border-color: ${colors.primary};
        }
        .invoice-email-input::placeholder {
          color: ${colors.mutedForeground};
          opacity: 0.7;
        }
        .price-summary {
          padding: 0 0 20px;
          margin-bottom: 20px;
          border-bottom: 1px solid ${colors.border};
        }
        .price-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          font-size: 14px;
        }
        .price-label {
          color: ${colors.mutedForeground};
          font-weight: 500;
        }
        .price-value {
          font-weight: 700;
          color: ${colors.foreground};
          font-size: 15px;
        }
        .price-divider {
          height: 1px;
          background: ${colors.border};
          margin: 12px 0;
        }
        .price-row.total {
          padding: 0;
        }
        .price-row.total .price-label {
          font-size: 15px;
          font-weight: 600;
          color: ${colors.foreground};
        }
        .price-value-total {
          font-size: 24px;
          font-weight: 700;
          color: ${colors.foreground};
          letter-spacing: -0.02em;
        }
        .purchase-btn {
          width: 100%;
          padding: 16px 24px;
          border-radius: 10px;
          background: ${colors.gradientPrimary || colors.primary};
          color: white;
          font-weight: 700;
          font-size: 16px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .purchase-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px hsl(213 100% 55% / 0.25);
        }
        .purchase-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .error-msg {
          background: hsl(0 84% 55% / 0.12);
          border: 1px solid hsl(0 84% 55% / 0.3);
          color: ${colors.destructive};
          padding: 16px;
          border-radius: 10px;
          margin-bottom: 24px;
          font-size: 14px;
          font-weight: 500;
        }
        @media (max-width: 900px) {
          .main-grid {
            grid-template-columns: 1fr;
          }
          .main-right {
            position: static;
          }
        }
        @media (max-width: 768px) {
          .page {
            padding: 24px 16px;
          }
          .top-bar {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
          .header h1 {
            font-size: 24px;
          }
          .balance-cards {
            grid-template-columns: 1fr;
          }
          .quantity-row {
            flex-direction: column;
            align-items: stretch;
          }
          .trust-row {
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
          margin-bottom: 8px;
        }
        .invoice-email-display {
          font-size: 15px;
          color: ${colors.primary};
          font-weight: 600;
          margin: 0;
          word-break: break-all;
        }
        .billing-email-section {
          margin-bottom: 24px;
        }
        .billing-email-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: ${colors.foreground};
          margin-bottom: 8px;
        }
        .billing-email-input {
          width: 100%;
          height: 44px;
          border-radius: 8px;
          border: 2px solid ${colors.border};
          background: ${colors.input};
          color: ${colors.foreground};
          padding: 0 14px;
          font-size: 15px;
          outline: none;
          transition: border-color 200ms;
          box-sizing: border-box;
        }
        .billing-email-input:focus {
          border-color: ${colors.primary};
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
