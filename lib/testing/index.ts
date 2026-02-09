// lib/testing/index.ts
// Testing utilities barrel export
// DEVELOPMENT ONLY

if (process.env.NODE_ENV === 'production') {
  throw new Error('Testing utilities cannot be imported in production');
}

export {
  generateMockSignature,
  generateMockId,
  MockPayloads,
  sendMockWebhook,
} from './razorpay-mock';
