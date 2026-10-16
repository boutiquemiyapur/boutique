import assert from 'node:assert/strict';
const host = process.env.FIRESTORE_EMULATOR_HOST;
assert.equal(host, '127.0.0.1:8189', 'Rules tests may only run against the dedicated local emulator.');
const base = `http://${host}/v1/projects/demo-ab-payments/databases/(default)/documents/`;
const encode = v => typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : Array.isArray(v) ? { arrayValue: { values: v.map(encode) } } : { mapValue: { fields: fields(v) } };
const fields = v => Object.fromEntries(Object.entries(v).map(([k, value]) => [k, encode(value)]));
function token(uid, admin = false) {
  const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ aud: 'demo-ab-payments', iss: 'https://securetoken.google.com/demo-ab-payments', sub: uid, user_id: uid, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, admin, firebase: { sign_in_provider: 'custom' } })}.`;
}
async function request(path, method, auth, data) {
  return fetch(base + path, { method, headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify({ fields: fields(data) }) } : {}) });
}
const uid = token('customer'); const other = token('other'); const admin = token('admin', true);
const order = { customerId: 'customer', orderStatus: 'Order Placed', paymentStatus: 'PAID', data: { id: 'online', paymentMethod: 'razorpay', paymentProvider: 'razorpay', paymentStatus: 'PAID', paymentReviewRequired: false, amountPaise: 149900, currency: 'INR', razorpayOrderId: 'order_test', razorpayPaymentId: 'pay_test', orderStatus: 'Order Placed', timeline: [] } };
let checks = 0;
async function expect(path, method, auth, data, allowed) {
  const result = await request(path, method, auth, data); checks++;
  assert.equal(result.ok, allowed, `${method} ${path}: ${result.status} ${await result.text()}`);
}
// Pricing remains restricted to the trusted custom-claim admin role.
const saleWindow = { status: 'published', startsAt: Date.now() - 1000, endsAt: Date.now() + 600000 };
for (const [id, data] of Object.entries({ active: saleWindow, draft: { ...saleWindow, status: 'draft' }, paused: { ...saleWindow, status: 'paused' }, archived: { ...saleWindow, status: 'archived' }, ended: { ...saleWindow, endsAt: Date.now() - 1 }, future: { ...saleWindow, startsAt: Date.now() + 300000 } })) {
  await expect(`saleCampaigns/${id}`, 'PATCH', 'owner', data, true);
  await expect(`saleCampaigns/${id}/products/item`, 'PATCH', 'owner', { productId: 'item', fixedPriceINR: 750 }, true);
  await expect(`saleCampaigns/${id}`, 'GET', '', null, id === 'active');
  await expect(`saleCampaigns/${id}/products/item`, 'GET', uid, null, id === 'active');
  await expect(`saleCampaigns/${id}`, 'GET', admin, null, true);
  for (const auth of [uid, admin]) await expect(`saleCampaigns/${id}`, 'PATCH', auth, saleWindow, false);
}
for (const path of ['saleCampaignControl/published', 'saleProductAssignments/item', 'saleCampaignSlugs/private']) {
  await expect(path, 'PATCH', 'owner', { value: 'private' }, true);
  await expect(path, 'GET', '', null, false);
  for (const auth of [uid, admin]) await expect(path, 'PATCH', auth, { ids: ['forged'] }, false);
}
await expect('saleCampaigns/active/products/forged', 'PATCH', admin, { fixedPriceINR: 1 }, false);
await expect('saleCampaigns/active/products/item', 'DELETE', uid, null, false);
await expect('products/pricing-security', 'PATCH', admin, { status: 'active', data: { priceINR: 1000, originalPriceINR: 1500, discountPercentage: 33.33 } }, true);
await expect('products/pricing-security', 'PATCH', uid, { data: { priceINR: 1, originalPriceINR: 1500, discountPercentage: 99.99 } }, false);
await expect('products/pricing-forged', 'PATCH', uid, { data: { priceINR: 1 } }, false);
await expect('products/pricing-security', 'DELETE', uid, null, false);
await expect('products/pricing-security', 'PATCH', admin, { status: 'active', data: { priceINR: 750, originalPriceINR: 1500, discountPercentage: 50 } }, true);
await expect('orders/online', 'PATCH', 'owner', order, true);
await expect('orders/online', 'GET', uid, null, true); await expect('orders/online', 'GET', other, null, false); await expect('orders/online', 'GET', admin, null, true);
for (const auth of [uid, admin]) {
  for (const [field, value] of Object.entries({ paymentStatus: 'REFUNDED', paymentProvider: 'cod', amountPaise: 1, currency: 'USD', razorpayOrderId: 'order_forged', razorpayPaymentId: 'pay_forged', paidAt: 'forged', paymentVerifiedAt: 'forged', refundedAmountPaise: 149900, paymentReviewRequired: false })) {
    const existing = { ...order, data: { ...order.data } }; if (field === 'paymentReviewRequired') existing.data[field] = true; else existing.data[field] = value;
    await expect('orders/online', 'PATCH', auth, existing, false);
  }
  await expect('orders/fabricated', 'PATCH', auth, order, false); await expect('orders/online', 'DELETE', auth, null, false);
  for (const name of ['checkoutRequests', 'paymentAttempts', 'paymentEvents', 'inventoryReservations', 'inventoryMovements', 'paymentRateLimits', 'cancellationAudits']) await expect(`${name}/fake`, 'PATCH', auth, { state: 'PAID' }, false);
}
await expect('orders/online', 'PATCH', admin, { ...order, orderStatus: 'Processing', data: { ...order.data, orderStatus: 'Processing' } }, false);
await expect('orders/online', 'PATCH', admin, { ...order, orderStatus: 'PAID', data: { ...order.data, orderStatus: 'PAID' } }, false);
await expect('orders/online', 'PATCH', 'owner', { ...order, data: { ...order.data, paymentReviewRequired: true } }, true);
await expect('orders/online', 'PATCH', admin, { ...order, orderStatus: 'Processing', data: { ...order.data, paymentReviewRequired: true, orderStatus: 'Processing' } }, false);
const historical = { ...order, data: { ...order.data, paymentMethod: 'cod', paymentStatus: 'Pending' }, paymentStatus: 'Pending' };
await expect('orders/historical', 'PATCH', 'owner', historical, true); await expect('orders/historical', 'GET', uid, null, true);
await expect('orders/historical', 'PATCH', admin, { ...historical, orderStatus: 'Processing', data: { ...historical.data, orderStatus: 'Processing' } }, false);
await expect('users/customer/orders/old', 'PATCH', 'owner', historical, true); await expect('users/customer/orders/old', 'GET', uid, null, true); await expect('users/customer/orders/old', 'GET', other, null, false); await expect('users/customer/orders/old', 'PATCH', admin, order, false);
for (const auth of [uid, admin]) {
 await expect('orders/online', 'PATCH', auth, {...order,data:{...order.data,cancellationRequest:{status:'APPROVED'},refund:{state:'PROCESSED'},cartCleanupStatus:'DONE'}}, false);
 await expect('orders/historical','PATCH',auth,{...historical,orderStatus:'Cancelled',data:{...historical.data,orderStatus:'Cancelled'}},false);
}
await expect('carts/customer','PATCH','owner',{ownerId:'customer',items:[],lastPurchasedOrderId:'trusted-order'},true);
await expect('carts/customer','PATCH',uid,{ownerId:'customer',items:[],lastPurchasedOrderId:'forged-order'},false);
await expect('carts/customer','PATCH',uid,{ownerId:'customer',items:[],lastPurchasedOrderId:'trusted-order',checkoutGeneration:'forged-generation'},false);
for (const path of ['refundSettings/control','refundSettings/control/history/change','refundReviews/review']) {
 await expect(path,'PATCH','owner',{enabled:false},true);
 for(const auth of [uid,other,admin]) {
  await expect(path,'GET',auth,null,false); await expect(path,'PATCH',auth,{enabled:true},false); await expect(path,'DELETE',auth,null,false);
 }
}
console.log(`${checks} Firestore payment authorization checks passed.`);
