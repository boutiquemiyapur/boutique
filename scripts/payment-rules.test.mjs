import assert from 'node:assert/strict';
const host = process.env.FIRESTORE_EMULATOR_HOST;
assert.equal(host, '127.0.0.1:8189', 'Rules tests may only run against the dedicated local emulator.');
const base = `http://${host}/v1/projects/demo-ab-payments/databases/(default)/documents/`;
const encode = v => typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) } : Array.isArray(v) ? { arrayValue: { values: v.map(encode) } } : { mapValue: { fields: fields(v) } };
const fields = v => Object.fromEntries(Object.entries(v).map(([k, value]) => [k, encode(value)]));
function token(uid, admin = false) {
  const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ aud: 'demo-ab-payments', iss: 'https://securetoken.google.com/demo-ab-payments', sub: uid, user_id: uid, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, admin, firebase: { sign_in_provider: 'custom' } })}.`;
}
async function request(path, method, auth, data) {
  return fetch(base + path, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify({ fields: fields(data) }) } : {}) });
}
const uid = token('customer'); const other = token('other'); const admin = token('admin', true);
const order = { customerId: 'customer', orderStatus: 'Order Placed', paymentStatus: 'PAID', data: { id: 'online', paymentMethod: 'razorpay', paymentProvider: 'razorpay', paymentStatus: 'PAID', paymentReviewRequired: false, amountPaise: 149900, currency: 'INR', razorpayOrderId: 'order_test', razorpayPaymentId: 'pay_test', orderStatus: 'Order Placed', timeline: [] } };
let checks = 0;
async function expect(path, method, auth, data, allowed) {
  const result = await request(path, method, auth, data); checks++;
  assert.equal(result.ok, allowed, `${method} ${path}: ${result.status} ${await result.text()}`);
}
await expect('orders/online', 'PATCH', 'owner', order, true);
await expect('orders/online', 'GET', uid, null, true); await expect('orders/online', 'GET', other, null, false); await expect('orders/online', 'GET', admin, null, true);
for (const auth of [uid, admin]) {
  for (const [field, value] of Object.entries({ paymentStatus: 'REFUNDED', paymentProvider: 'cod', amountPaise: 1, currency: 'USD', razorpayOrderId: 'order_forged', razorpayPaymentId: 'pay_forged', paidAt: 'forged', paymentVerifiedAt: 'forged', refundedAmountPaise: 149900, paymentReviewRequired: false })) {
    const existing = { ...order, data: { ...order.data } }; if (field === 'paymentReviewRequired') existing.data[field] = true; else existing.data[field] = value;
    await expect('orders/online', 'PATCH', auth, existing, false);
  }
  await expect('orders/fabricated', 'PATCH', auth, order, false); await expect('orders/online', 'DELETE', auth, null, false);
  for (const name of ['checkoutRequests', 'paymentAttempts', 'paymentEvents', 'inventoryReservations', 'inventoryMovements', 'paymentRateLimits']) await expect(`${name}/fake`, 'PATCH', auth, { state: 'PAID' }, false);
}
await expect('orders/online', 'PATCH', admin, { ...order, orderStatus: 'Processing', data: { ...order.data, orderStatus: 'Processing' } }, true);
await expect('orders/online', 'PATCH', admin, { ...order, orderStatus: 'PAID', data: { ...order.data, orderStatus: 'PAID' } }, false);
await expect('orders/online', 'PATCH', 'owner', { ...order, data: { ...order.data, paymentReviewRequired: true } }, true);
await expect('orders/online', 'PATCH', admin, { ...order, orderStatus: 'Processing', data: { ...order.data, paymentReviewRequired: true, orderStatus: 'Processing' } }, false);
const historical = { ...order, data: { ...order.data, paymentMethod: 'cod', paymentStatus: 'Pending' }, paymentStatus: 'Pending' };
await expect('orders/historical', 'PATCH', 'owner', historical, true); await expect('orders/historical', 'GET', uid, null, true);
await expect('orders/historical', 'PATCH', admin, { ...historical, orderStatus: 'Processing', data: { ...historical.data, orderStatus: 'Processing' } }, true);
await expect('users/customer/orders/old', 'PATCH', 'owner', historical, true); await expect('users/customer/orders/old', 'GET', uid, null, true); await expect('users/customer/orders/old', 'GET', other, null, false); await expect('users/customer/orders/old', 'PATCH', admin, order, false);
console.log(`${checks} Firestore payment authorization checks passed.`);
