# Razorpay payment integration – setup guide

This guide is for **RazorPay Intergration**. It explains how to connect Oli AI to Razorpay so payments and subscriptions work. Follow the steps in order.

---

## What you need

- A **Razorpay account** (sign up at [razorpay.com](https://razorpay.com) if you don’t have one).
- Access to your project’s **environment variables** (the file `.env.local` or your hosting provider’s “Environment” / “Env vars” section).  
  If you don’t edit files, ask your developer to add the values you copy from Razorpay.

---

## Step 1: Create or log in to your Razorpay account

1. Go to **https://dashboard.razorpay.com** and sign in (or sign up).
2. Complete **KYC** (business verification) when Razorpay asks. This is required for going live. For testing, you can use **Test Mode** without full KYC.

---

## Step 2: Get your API keys (Test mode first)

1. In the Razorpay Dashboard, switch to **Test Mode** (toggle in the top bar).
2. Go to **Settings** (gear icon) → **API Keys**.
3. Click **Generate Key** if you don’t have keys yet.
4. You will see:
   - **Key ID** – looks like `rzp_test_xxxxxxxxxxxx`
   - **Key Secret** – click **Reveal** to see it (copy it once; it’s shown only briefly).

Keep this tab open; you’ll paste these into your app in Step 4.

---

## Step 3: Set up the webhook (so Razorpay can notify your app)

1. In Razorpay Dashboard (still in **Test Mode**), go to **Settings** → **Webhooks**.
2. Click **+ Add New Webhook**.
3. **Webhook URL** – use your app’s public URL plus the path below:
   - If your app is at `https://yourapp.com`, use:  
     `https://yourapp.com/api/billing/webhooks/razorpay`
   - For local testing you can use a tunnel (e.g. ngrok) and put that URL here, e.g.  
     `https://xxxx.ngrok.io/api/billing/webhooks/razorpay`
4. **Active Events** – enable these:
   - `payment.captured`
   - `payment.failed`
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.cancelled`
   - `subscription.completed`
5. Click **Create Webhook**.
6. On the next screen you’ll see a **Webhook Secret**. Copy it and store it safely; you’ll add it to your environment in Step 4.

---

## Step 4: Add the keys to your project (environment variables)

Your app reads Razorpay keys from **environment variables**. You need to set these four:

| Variable name | Where you get it | Example (don’t use this literally) |
|---------------|-------------------|-------------------------------------|
| `RAZORPAY_KEY_ID` | Step 2 – Key ID | `rzp_test_xxxxxxxxxxxx` |
| `RAZORPAY_KEY_SECRET` | Step 2 – Key Secret | (long secret string) |
| `RAZORPAY_WEBHOOK_SECRET` | Step 3 – Webhook Secret | (long secret string) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Same as Key ID | `rzp_test_xxxxxxxxxxxx` |

**Important:**

- **Do not** use the placeholder values that might already be in `.env.example` (e.g. `rzp_test_placeholder`, `your_key_secret_here`). Replace them with your real values.
- **Never** share Key Secret or Webhook Secret in public (Git, screenshots, chat). Only put them in environment variables or a secure secrets manager.
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` must be **exactly** the same as `RAZORPAY_KEY_ID` (the Key ID is safe to expose in the browser).

**Where to set them:**

- **Local development:** In the project root, open (or create) the file **`.env.local`** and add or update the four lines above.
- **Hosting (Vercel, etc.):** In the project settings, find “Environment variables” or “Env” and add the same four names and values.

After saving, **restart your app** (and redeploy if you’re on a host) so it picks up the new values.

---

## Step 5: Test that payments are configured

1. Open your app and go to the **Pricing** or **Buy Credits** page.
2. Try to start a subscription or a one-time payment (you can use Razorpay test cards in Test Mode).
3. If you see an error like **“Payments are not configured yet…”**, the app is not seeing valid keys. Check that:
   - All four environment variables are set.
   - There are no typos and no leftover placeholders (e.g. `placeholder`, `your_key_id_here`).
   - You restarted the app (and redeployed if applicable).

Once the Razorpay checkout opens and you can complete a test payment, the **backend integration** is in place.

---

## Step 6: Going live (real money)

1. In Razorpay Dashboard, complete **KYC** and switch to **Live Mode**.
2. Under **Settings** → **API Keys** in **Live Mode**, generate **Live** keys (Key ID will start with `rzp_live_`).
3. Under **Settings** → **Webhooks** in **Live Mode**, create a **new webhook** with:
   - **URL:** `https://your-production-domain.com/api/billing/webhooks/razorpay`
   - **Same events** as in Step 3.
4. Copy the **new** Live Key ID, Key Secret, and **Live** Webhook Secret.
5. In your **production** environment variables, replace the test values with these **live** values (both `RAZORPAY_KEY_ID` and `NEXT_PUBLIC_RAZORPAY_KEY_ID` must be the live Key ID).
6. Redeploy and do a small real payment to confirm.

---

## Quick checklist

- [ ] Razorpay account created and (for live) KYC done  
- [ ] Test API keys generated and added to `.env.local` (or dev env)  
- [ ] Webhook created with URL `.../api/billing/webhooks/razorpay` and all 6 events  
- [ ] Webhook Secret added as `RAZORPAY_WEBHOOK_SECRET`  
- [ ] All four env vars set: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`  
- [ ] App restarted / redeployed  
- [ ] Test payment works (Razorpay checkout opens and completes)  
- [ ] For live: Live keys and live webhook configured and production env updated  

---

## If something goes wrong

- **“Payments are not configured yet…”**  
  The app detected placeholder or missing keys. Add or fix the four environment variables and restart/redeploy.

- **Razorpay checkout doesn’t open or shows “Invalid key”**  
  Check that `NEXT_PUBLIC_RAZORPAY_KEY_ID` matches your Razorpay Key ID and that you’re in the correct mode (Test vs Live).

- **Payment succeeds but credits/subscription don’t update**  
  Usually a webhook issue. Confirm the webhook URL is correct, the right events are selected, and `RAZORPAY_WEBHOOK_SECRET` matches the secret shown in Razorpay for that webhook. Check your server logs for webhook errors.

- **Need help**  
  Share this doc with your developer and point them to: `lib/razorpay/client.ts`, `pages/api/billing/webhooks/razorpay.ts`, and the env vars in `.env.example`.
