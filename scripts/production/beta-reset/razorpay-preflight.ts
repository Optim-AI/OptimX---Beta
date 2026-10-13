/**
 * Read-only Razorpay status check. Does not cancel, capture, refund, or create anything.
 *
 * Usage, with LIVE keys in the environment (this workspace's .env.local is test mode):
 *   RAZORPAY_KEY_ID=rzp_live_... RAZORPAY_KEY_SECRET=... \
 *     npx tsx scripts/production/beta-reset/razorpay-preflight.ts
 */

const SUBSCRIPTIONS = ['sub_TfuTAUSCkW2op5', 'sub_TfuVAbIRkECZ3V'];
const OPEN_ORDER = 'order_SKNxOrZ07qOaxy';

async function fetchResource(kind: 'subscriptions' | 'orders', id: string, token: string) {
  const response = await fetch(`https://api.razorpay.com/v1/${kind}/${id}`, {
    headers: { Authorization: `Basic ${token}` },
  });
  const body = (await response.json()) as Record<string, unknown>;
  const error = body.error as { description?: string } | undefined;
  const fields = [
    'status',
    'amount',
    'amount_paid',
    'amount_due',
    'attempts',
    'paid_count',
    'remaining_count',
    'total_count',
    'cancel_at_cycle_end',
  ];
  const summary: Record<string, unknown> = { http: response.status };
  for (const field of fields) {
    if (field in body) summary[field] = body[field];
  }
  if (error?.description) summary.error = error.description;
  console.log(`${kind} ${id} ${JSON.stringify(summary)}`);
}

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!keyId || !keySecret) {
    throw new Error('Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET. This command does not read .env files.');
  }
  const mode = keyId.startsWith('rzp_live_') ? 'live' : keyId.startsWith('rzp_test_') ? 'test' : 'unknown';
  console.log(`Razorpay key mode: ${mode}`);
  if (mode !== 'live') {
    console.log('These production ids were not found with the workspace test key. Use the live key.');
  }
  const token = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  for (const id of SUBSCRIPTIONS) {
    await fetchResource('subscriptions', id, token);
  }
  await fetchResource('orders', OPEN_ORDER, token);
  console.log('No Razorpay write was attempted.');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : 'Razorpay preflight failed');
  process.exit(1);
});
