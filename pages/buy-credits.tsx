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
import SubscriptionPlansSection from '@/app/web/src/components/billing/SubscriptionPlansSection';
import type { PaidPlanEntitlement } from '@/lib/billing/plan-card-actions';
import { isMarketingPlanId } from '@/lib/billing/marketing-plans';

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
  const [currentSubscription, setCurrentSubscription] = useState<PaidPlanEntitlement | null>(
    null
  );
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

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
      fetchCurrentSubscription();
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

  async function fetchCurrentSubscription() {
    setSubscriptionLoading(true);
    try {
      const response = await authFetch('/api/billing/subscriptions/current');
      const data = await response.json();
      const status = data?.subscription?.status;
      const planId = data?.subscription?.plan?.id;
      const entitled =
        data?.success &&
        data?.hasSubscription &&
        (status === 'active' || status === 'trialing') &&
        typeof planId === 'string' &&
        isMarketingPlanId(planId);
      setCurrentSubscription(entitled ? { planId, status: String(status) } : null);
    } catch {
      setCurrentSubscription(null);
    } finally {
      setSubscriptionLoading(false);
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
            <button type="button" className="back-btn" onClick={() => router.back()} aria-label="Go back">
              <ArrowLeft size={18} strokeWidth={2} />
              <span>Back</span>
            </button>
            <div className="header">
              <h1>Plans &amp; Purchases</h1>
              <p>Buy credits or choose a subscription plan for your marketing workflow.</p>
            </div>
          </header>

          <div className="balance-cards" aria-live="polite">
            <div className="balance-card-item balance-card-image">
              <div className="balance-value">
                {balance ? balance.imageCredits.total : '—'}
              </div>
              <div className="balance-label">Available</div>
              <div className="balance-type">
                <Image size={15} strokeWidth={2} aria-hidden />
                Image Credits
              </div>
            </div>
            <div className="balance-card-item balance-card-video">
              <div className="balance-value">
                {balance ? balance.videoCredits.total : '—'}
              </div>
              <div className="balance-label">Available</div>
              <div className="balance-type">
                <Video size={15} strokeWidth={2} aria-hidden />
                Video Credits
              </div>
              {balance ? (
                <div className="balance-capacity">
                  ≈{getVideoSecondsForCredits(balance.videoCredits.total)} sec video capacity
                </div>
              ) : null}
            </div>
          </div>

          {error && <div className="error-msg" role="alert">{error}</div>}

          <div className="main-grid">
            <div className="main-left">
              <div className="type-toggle">
                <div
                  className="segmented-control"
                  role="tablist"
                  aria-label="Credit type"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={creditType === 'image'}
                    className={`segmented-tab ${creditType === 'image' ? 'active' : ''}`}
                    onClick={() => setCreditType('image')}
                  >
                    <Image size={17} strokeWidth={2} />
                    Image Credits
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={creditType === 'video'}
                    className={`segmented-tab ${creditType === 'video' ? 'active' : ''}`}
                    onClick={() => setCreditType('video')}
                  >
                    <Video size={17} strokeWidth={2} />
                    Video Credits
                  </button>
                </div>
              </div>

              <div className="quantity-selector">
                <label htmlFor="credit-quantity-input">
                  How many {creditType === 'image' ? 'image credits' : 'video credits'} do you want?
                </label>
                <div className="quantity-row">
                  <div className="quantity-controls">
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => adjustQuantity(-1)}
                      disabled={quantity <= getMinQuantity(creditType)}
                      aria-label="Decrease quantity"
                    >
                      <Minus size={18} />
                    </button>
                    <div className="qty-input-wrap">
                      <input
                        id="credit-quantity-input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="qty-input"
                        value={inputValue}
                        onChange={handleQuantityInputChange}
                        onBlur={handleQuantityBlur}
                        aria-invalid={!!quantityError}
                        aria-describedby={quantityError ? 'credit-quantity-error' : undefined}
                      />
                      {quantityError && (
                        <p id="credit-quantity-error" className="qty-validation-error" role="alert">
                          {quantityError}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => adjustQuantity(1)}
                      disabled={quantity >= getMaxQuantity(creditType)}
                      aria-label="Increase quantity"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="preset-chips" role="group" aria-label="Quantity presets">
                    {(creditType === 'image' ? imagePresets : videoPresets).map((preset) => (
                      <button
                        type="button"
                        key={preset}
                        className={`preset-chip ${quantity === preset ? 'selected' : ''}`}
                        onClick={() => setQuantitySynced(preset)}
                      >
                        {preset}
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
                        type="button"
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
                    <Check size={15} color={colors.green600} />
                    <span>Credits never expire</span>
                  </div>
                  <div className="trust-item">
                    <Shield size={15} color={colors.primary} />
                    <span>Secure via Razorpay</span>
                  </div>
                </div>
                <div className="trust-item trust-email-row">
                  <Mail size={15} color={colors.mutedForeground} />
                  <div className="trust-email-wrap">
                    <label htmlFor="gst-invoice-email">GST invoice to</label>
                    <input
                      id="gst-invoice-email"
                      type="email"
                      className="invoice-email-input"
                      placeholder="your@email.com"
                      value={billingEmail}
                      onChange={(e) => setBillingEmail(e.target.value)}
                      autoComplete="email"
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
                    const v = availableVouchers.find((item) => item.id === selectedVoucherId);
                    return v ? (
                      <div className="price-row voucher-bonus-row">
                        <span className="price-label">
                          <Ticket size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          Voucher Bonus
                        </span>
                        <span className="price-value">
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
                  type="button"
                  className="purchase-btn"
                  disabled={purchasing || !!quantityError || quantity < getMinQuantity(creditType) || !isValidEmail(billingEmail)}
                  onClick={handlePurchase}
                >
                  {purchasing ? 'Processing…' : `Pay ₹${totals.totalInr}`}
                </button>
              </div>
            </div>
          </div>

          <SubscriptionPlansSection
            currentSubscription={currentSubscription}
            loading={subscriptionLoading}
          />
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
          padding: 36px 28px 48px;
          font-family: Poppins, Inter, system-ui;
          color: ${colors.foreground};
          overflow-y: auto;
        }
        .container {
          max-width: 1080px;
          margin: 0 auto;
        }
        .top-bar {
          display: flex;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 28px;
        }
        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          background: hsl(0 0% 14%);
          border: 1px solid ${colors.border};
          border-radius: 10px;
          padding: 10px 14px;
          color: ${colors.foreground};
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.15s, border-color 0.15s;
        }
        .back-btn:hover {
          background: hsl(0 0% 18%);
          border-color: hsl(0 0% 30%);
        }
        .back-btn:focus-visible {
          outline: 2px solid ${colors.primary};
          outline-offset: 2px;
        }
        .header h1 {
          font-size: clamp(24px, 3vw, 30px);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0;
          line-height: 1.2;
        }
        .header p {
          margin: 6px 0 0;
          color: ${colors.mutedForeground};
          font-size: 14px;
          line-height: 1.45;
          max-width: 42rem;
        }
        .balance-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 26px;
        }
        .balance-card-item {
          border-radius: 16px;
          border: 1px solid;
          padding: 22px 24px;
          min-height: 132px;
        }
        .balance-card-image {
          background: hsl(213 100% 55% / 0.12);
          border-color: hsl(213 100% 55% / 0.34);
          box-shadow: inset 0 1px 0 hsl(213 100% 70% / 0.08);
        }
        .balance-card-video {
          background: hsl(270 80% 55% / 0.12);
          border-color: hsl(270 80% 55% / 0.3);
          box-shadow: inset 0 1px 0 hsl(270 80% 75% / 0.08);
        }
        .balance-card-image .balance-value,
        .balance-card-image .balance-label,
        .balance-card-image .balance-type {
          color: hsl(213 100% 70%);
        }
        .balance-card-video .balance-value,
        .balance-card-video .balance-label,
        .balance-card-video .balance-type,
        .balance-card-video .balance-capacity {
          color: hsl(270 80% 74%);
        }
        .balance-value {
          font-size: clamp(30px, 4vw, 36px);
          font-weight: 700;
          letter-spacing: -0.03em;
          line-height: 1.1;
        }
        .balance-label {
          margin-top: 4px;
          font-size: 13px;
          opacity: 0.88;
        }
        .balance-type {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 10px;
          font-size: 14px;
          font-weight: 600;
        }
        .balance-capacity {
          margin-top: 6px;
          font-size: 12px;
          opacity: 0.82;
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
          grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.9fr);
          gap: 22px;
          align-items: start;
        }
        .segmented-control {
          display: flex;
          background: hsl(0 0% 14%);
          border: 1px solid ${colors.border};
          border-radius: 14px;
          padding: 5px;
          margin-bottom: 22px;
          gap: 4px;
        }
        .segmented-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 14px;
          border: none;
          background: transparent;
          border-radius: 10px;
          color: ${colors.mutedForeground};
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: background 0.15s, color 0.15s, box-shadow 0.15s;
        }
        .segmented-tab:hover:not(.active) {
          color: ${colors.foreground};
          background: hsl(0 0% 100% / 0.03);
        }
        .segmented-tab.active {
          background: hsl(0 0% 18%);
          color: ${colors.foreground};
          box-shadow: 0 1px 0 hsl(0 0% 100% / 0.04), 0 6px 16px rgba(0, 0, 0, 0.22);
        }
        .segmented-tab:focus-visible {
          outline: 2px solid ${colors.primary};
          outline-offset: 1px;
        }
        .quantity-selector label {
          display: block;
          font-weight: 600;
          margin-bottom: 12px;
          font-size: 15px;
          color: ${colors.foreground};
        }
        .quantity-controls {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 14px;
        }
        .qty-btn {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          border: 1px solid ${colors.border};
          background: hsl(0 0% 14%);
          color: ${colors.foreground};
          cursor: pointer;
          display: grid;
          place-items: center;
          transition: background 0.15s, border-color 0.15s;
        }
        .qty-btn:hover:not(:disabled) {
          background: hsl(0 0% 18%);
          border-color: hsl(0 0% 30%);
        }
        .qty-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .qty-btn:focus-visible {
          outline: 2px solid ${colors.primary};
          outline-offset: 2px;
        }
        .qty-input-wrap {
          flex: 1;
          min-width: 0;
        }
        .qty-input {
          width: 100%;
          height: 46px;
          border-radius: 12px;
          border: 1px solid ${colors.border};
          background: hsl(0 0% 14%);
          color: ${colors.foreground};
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.02em;
          text-align: center;
          padding: 0 12px;
        }
        .qty-input:focus {
          outline: none;
          border-color: ${colors.primary};
          box-shadow: 0 0 0 3px hsl(213 100% 55% / 0.18);
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
          min-width: 52px;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid ${colors.border};
          background: transparent;
          color: ${colors.foreground};
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
        }
        .preset-chip:hover:not(.selected) {
          border-color: hsl(0 0% 32%);
          background: hsl(0 0% 100% / 0.03);
        }
        .preset-chip.selected {
          background: ${colors.primary};
          border-color: ${colors.primary};
          color: white;
          box-shadow: 0 6px 16px hsl(213 100% 55% / 0.28);
        }
        .preset-chip:focus-visible {
          outline: 2px solid ${colors.primary};
          outline-offset: 2px;
        }
        .voucher-section {
          margin-top: 22px;
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
          margin-top: 26px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .trust-row {
          display: flex;
          gap: 18px;
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
          gap: 10px;
          flex-wrap: wrap;
        }
        .trust-email-wrap label {
          font-size: 13px;
          color: ${colors.mutedForeground};
        }
        .invoice-email-input {
          background: hsl(0 0% 14%);
          border: 1px solid ${colors.border};
          border-radius: 10px;
          padding: 8px 12px;
          color: ${colors.foreground};
          font-size: 13px;
          min-width: 220px;
        }
        .invoice-email-input:focus {
          outline: none;
          border-color: ${colors.primary};
          box-shadow: 0 0 0 3px hsl(213 100% 55% / 0.16);
        }
        .summary-card {
          background: hsl(0 0% 12%);
          border: 1px solid ${colors.border};
          border-radius: 18px;
          padding: 22px 22px 20px;
          position: sticky;
          top: 24px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
        }
        .price-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 16px;
          margin-bottom: 12px;
          font-size: 14px;
        }
        .price-label {
          color: ${colors.mutedForeground};
        }
        .price-value {
          font-weight: 600;
          color: ${colors.foreground};
        }
        .voucher-bonus-row .price-label,
        .voucher-bonus-row .price-value {
          color: #16a34a;
        }
        .price-divider {
          height: 1px;
          background: ${colors.border};
          margin: 14px 0 16px;
        }
        .price-row.total {
          margin-bottom: 0;
          align-items: center;
        }
        .price-row.total .price-label {
          font-weight: 700;
          color: ${colors.foreground};
          font-size: 16px;
        }
        .price-value-total {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: ${colors.primary};
        }
        .purchase-btn {
          width: 100%;
          margin-top: 18px;
          padding: 14px 16px;
          border: none;
          border-radius: 12px;
          background: ${colors.primary};
          color: white;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          transition: filter 0.15s, transform 0.15s, box-shadow 0.15s;
          box-shadow: 0 8px 20px hsl(213 100% 55% / 0.28);
        }
        .purchase-btn:hover:not(:disabled) {
          filter: brightness(1.05);
        }
        .purchase-btn:focus-visible {
          outline: 2px solid white;
          outline-offset: 2px;
        }
        .purchase-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
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
          .page {
            padding: 24px 16px 40px;
          }
          .top-bar {
            flex-direction: column;
            gap: 14px;
          }
          .main-grid,
          .balance-cards {
            grid-template-columns: 1fr;
          }
          .summary-card {
            position: static;
          }
          .invoice-email-input {
            min-width: 0;
            width: 100%;
          }
          .trust-email-wrap {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
