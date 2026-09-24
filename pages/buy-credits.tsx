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
  formatVideoCapacityLabel,
} from '@/lib/billing/pricing';
import { VIDEO_CREDIT_BLOCK_SIZE, getVideoSecondsForCredits } from '@/lib/billing/video-credits';

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
  const [livePricing, setLivePricing] = useState<{
    imageCreditPriceInr: number;
    videoCreditBlockPriceInr: number;
  } | null>(null);

  useEffect(() => {
    checkAuth();
    fetch('/api/billing/pricing')
      .then((res) => res.json())
      .then((data) => {
        if (data.imageCreditPriceInr && data.videoCreditBlockPriceInr) {
          setLivePricing({
            imageCreditPriceInr: data.imageCreditPriceInr,
            videoCreditBlockPriceInr: data.videoCreditBlockPriceInr,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchBalance();
    }
  }, [authenticated]);

  useEffect(() => {
    const def =
      creditType === 'image'
        ? BUY_CREDITS_PRICING.defaultImageQuantity
        : BUY_CREDITS_PRICING.defaultVideoQuantity;
    setQuantity(def);
    setInputValue(String(def));
    setQuantityError(null);
    setSelectedVoucherId(null);
  }, [creditType]);

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

  const totals = calculateTotalsInr({
    creditType,
    credits: quantity,
    overrides:
      creditType === 'image'
        ? livePricing
          ? { unitPriceInr: livePricing.imageCreditPriceInr }
          : undefined
        : livePricing
          ? { videoBlockPriceInr: livePricing.videoCreditBlockPriceInr }
          : undefined,
  });

  const videoCapacityLabel =
    creditType === 'video' ? formatVideoCapacityLabel(quantity) : null;

  function setQuantitySynced(next: number) {
    const clamped = clampQuantity(creditType, next);
    setQuantity(clamped);
    setInputValue(String(clamped));
    setQuantityError(null);
  }

  function adjustQuantity(delta: number) {
    const step = getQuantityStep(creditType);
    setQuantitySynced(quantity + delta * step);
  }

  function validateQuantity(value: string): boolean {
    const num = parseInt(value, 10);
    const min = getMinQuantity(creditType);
    const unit = creditType === 'image' ? 'credits' : 'Video Credits';
    if (value === '' || Number.isNaN(num)) {
      setQuantityError(`Minimum order is ${min} ${unit}.`);
      return false;
    }
    if (num < min) {
      setQuantityError(`Minimum order is ${min} ${unit}.`);
      return false;
    }
    if (num > getMaxQuantity(creditType)) {
      setQuantityError(`Maximum order is ${getMaxQuantity(creditType)} ${unit}.`);
      return false;
    }
    if (creditType === 'video' && num % getQuantityStep('video') !== 0) {
      setQuantityError(`Video credits must be a multiple of ${getQuantityStep('video')}.`);
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
      setQuantityError(
        `Minimum order is ${getMinQuantity(creditType)} ${creditType === 'image' ? 'credits' : 'Video Credits'}.`
      );
      return;
    }
    const num = parseInt(val, 10);
    if (Number.isNaN(num)) return;
    setQuantity(num);
    validateQuantity(val);
  }

  function handleQuantityBlur() {
    const trimmed = inputValue.trim();
    if (trimmed === '') {
      setQuantitySynced(getMinQuantity(creditType));
      return;
    }
    const num = parseInt(trimmed, 10);
    if (Number.isNaN(num)) {
      setQuantitySynced(getMinQuantity(creditType));
      return;
    }
    setQuantitySynced(num);
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

      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.razorpayOrderId,
        name: 'SkalX AI',
        description: `${quantity} ${creditType === 'image' ? 'Image Credits' : 'Video Credits'} (incl. GST)`,
        handler: async function (response: any) {
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
            await fetchBalance();
            const voucherBonus = orderData.voucherCredits || 0;
            setPurchaseInfo({
              quantity,
              type: creditType === 'image' ? 'image credits' : 'Video Credits',
              ...(voucherBonus > 0 ? { voucherCredits: voucherBonus } : {}),
            });
            setShowSuccess(true);
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

  const imagePresets = BUY_CREDITS_PRICING.imagePresets;
  const videoPresets = BUY_CREDITS_PRICING.videoPresets;
  const blockPrice = livePricing?.videoCreditBlockPriceInr ?? BUY_CREDITS_PRICING.videoCreditBlockPriceInr;

  return (
    <>
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
                <div className="balance-value" style={{ color: 'hsl(270 80% 70%)' }}>{balance.videoCredits.total}</div>
                <div className="balance-label" style={{ color: 'hsl(270 80% 70%)' }}>Available</div>
                <div className="balance-type" style={{ color: 'hsl(270 80% 70%)' }}>Video Credits</div>
                <div className="balance-capacity" style={{ color: 'hsl(270 80% 70%)', fontSize: 12, marginTop: 4, opacity: 0.85 }}>
                  ≈{getVideoSecondsForCredits(balance.videoCredits.total)} sec video capacity
                </div>
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
                    Video Credits
                  </button>
                </div>
              </div>

              <div className="quantity-selector">
                <label>
                  How many {creditType === 'image' ? 'image credits' : 'Video Credits'} do you want?
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
                    {(creditType === 'image' ? imagePresets : videoPresets).map((preset) => (
                      <button
                        key={preset}
                        className={`preset-chip ${quantity === preset ? 'selected' : ''}`}
                        onClick={() => setQuantitySynced(preset)}
                      >
                        {creditType === 'video' ? preset : preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

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
                        <span>+{voucher.credits} {voucher.creditType === 'image' ? 'credits' : 'Video Credits'}</span>
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
                    <span className="price-label">
                      {creditType === 'image'
                        ? 'Price per credit'
                        : `Price per ${VIDEO_CREDIT_BLOCK_SIZE} credits`}
                    </span>
                    <span className="price-value">
                      ₹{creditType === 'image' ? totals.unitPriceInr : blockPrice}
                    </span>
                  </div>
                  <div className="price-row">
                    <span className="price-label">Credits</span>
                    <span className="price-value">{quantity}</span>
                  </div>
                  {creditType === 'video' && videoCapacityLabel && (
                    <div className="price-row">
                      <span className="price-label">Video capacity</span>
                      <span className="price-value">{videoCapacityLabel}</span>
                    </div>
                  )}
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
                          +{v.credits} {v.creditType === 'image' ? 'credits' : 'Video Credits'}
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
          border-radius: 10px;
          padding: 10px 14px;
          color: ${colors.foreground};
          cursor: pointer;
          font-size: 14px;
        }
        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin: 0;
        }
        .header p {
          margin: 4px 0 0;
          color: ${colors.mutedForeground};
          font-size: 14px;
        }
        .balance-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 28px;
        }
        .balance-card-item {
          border-radius: 16px;
          border: 1px solid;
          padding: 20px 24px;
        }
        .balance-value {
          font-size: 32px;
          font-weight: 700;
        }
        .balance-label {
          font-size: 13px;
          opacity: 0.85;
        }
        .balance-type {
          font-size: 14px;
          font-weight: 600;
          margin-top: 4px;
        }
        .error-msg {
          background: hsl(0 70% 50% / 0.15);
          border: 1px solid hsl(0 70% 50% / 0.4);
          color: hsl(0 70% 70%);
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 20px;
        }
        .main-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 24px;
          align-items: start;
        }
        .segmented-control {
          display: flex;
          background: ${colors.muted};
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 24px;
        }
        .segmented-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border: none;
          background: transparent;
          border-radius: 10px;
          color: ${colors.mutedForeground};
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
        }
        .segmented-tab.active {
          background: ${colors.card};
          color: ${colors.foreground};
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .quantity-selector label {
          display: block;
          font-weight: 600;
          margin-bottom: 12px;
          font-size: 15px;
        }
        .quantity-controls {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }
        .qty-btn {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          border: 1px solid ${colors.border};
          background: ${colors.card};
          color: ${colors.foreground};
          cursor: pointer;
          display: grid;
          place-items: center;
        }
        .qty-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .qty-input-wrap {
          flex: 1;
        }
        .qty-input {
          width: 100%;
          height: 44px;
          border-radius: 10px;
          border: 1px solid ${colors.border};
          background: ${colors.card};
          color: ${colors.foreground};
          font-size: 20px;
          font-weight: 700;
          text-align: center;
          padding: 0 12px;
        }
        .qty-validation-error {
          color: hsl(0 70% 65%);
          font-size: 12px;
          margin: 6px 0 0;
        }
        .preset-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .preset-chip {
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid ${colors.border};
          background: transparent;
          color: ${colors.foreground};
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
        }
        .preset-chip.selected {
          background: ${colors.primary};
          border-color: ${colors.primary};
          color: white;
        }
        .voucher-section {
          margin-top: 24px;
        }
        .voucher-section label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .voucher-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .voucher-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid ${colors.border};
          background: transparent;
          color: ${colors.foreground};
          cursor: pointer;
          font-size: 13px;
        }
        .voucher-chip.selected {
          border-color: #16a34a;
          background: hsl(142 70% 40% / 0.15);
        }
        .voucher-expiry {
          opacity: 0.7;
          font-size: 11px;
        }
        .trust-section {
          margin-top: 28px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .trust-row {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        .trust-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: ${colors.mutedForeground};
        }
        .trust-email-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .invoice-email-input {
          background: ${colors.card};
          border: 1px solid ${colors.border};
          border-radius: 8px;
          padding: 6px 10px;
          color: ${colors.foreground};
          font-size: 13px;
          min-width: 200px;
        }
        .invoice-email-input:focus {
          outline: 2px solid ${colors.primary};
        }
        .summary-card {
          background: ${colors.card};
          border: 1px solid ${colors.border};
          border-radius: 16px;
          padding: 24px;
          position: sticky;
          top: 24px;
        }
        .price-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 14px;
        }
        .price-label {
          color: ${colors.mutedForeground};
        }
        .price-value {
          font-weight: 600;
        }
        .price-divider {
          height: 1px;
          background: ${colors.border};
          margin: 16px 0;
        }
        .price-row.total .price-label {
          font-weight: 700;
          color: ${colors.foreground};
          font-size: 16px;
        }
        .price-value-total {
          font-size: 22px;
          font-weight: 700;
          color: ${colors.primary};
        }
        .purchase-btn {
          width: 100%;
          margin-top: 20px;
          padding: 14px;
          border: none;
          border-radius: 12px;
          background: ${colors.primary};
          color: white;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
        }
        .purchase-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: grid;
          place-items: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal-card {
          background: ${colors.card};
          border-radius: 20px;
          padding: 32px;
          max-width: 420px;
          width: 100%;
          position: relative;
          text-align: center;
        }
        .modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          color: ${colors.mutedForeground};
          cursor: pointer;
        }
        .modal-icon {
          margin-bottom: 16px;
        }
        .modal-title {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 8px;
        }
        .modal-subtitle {
          color: ${colors.mutedForeground};
          margin: 0 0 20px;
          line-height: 1.5;
        }
        .invoice-section {
          background: ${colors.muted};
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 20px;
        }
        .invoice-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          color: ${colors.mutedForeground};
          margin-bottom: 6px;
        }
        .invoice-email-display {
          font-weight: 600;
          margin: 0;
        }
        .modal-done-btn {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 12px;
          background: ${colors.primary};
          color: white;
          font-weight: 700;
          cursor: pointer;
        }
        @media (max-width: 800px) {
          .main-grid, .balance-cards {
            grid-template-columns: 1fr;
          }
          .summary-card {
            position: static;
          }
        }
      `}</style>
    </>
  );
}
