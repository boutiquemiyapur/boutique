import { randomUUID } from 'node:crypto';
import type { CartItem, Coupon, Order, Product, ShippingAddress } from '../../src/types/index.js';
import { calculateCheckoutTotals, legacyChargeAmounts, normalizeCheckoutCharges } from '../../src/utils/checkoutTotals.js';
import { sanitizeFirestoreData } from '../../src/utils/firestoreData.js';
import { cartCatalogIssue, productFromDocument, withDeductedStock } from '../../src/utils/productData.js';

type RequestItem = Pick<CartItem, 'selectedColor' | 'selectedSize' | 'quantity' | 'isCustomTailored' | 'customMeasurements' | 'giftPackaging' | 'giftNote'> & { productId: string; expectedPriceINR: number; expectedTailoringFeeINR: number };
type RequestBody = { requestId?: string; items?: RequestItem[]; shippingAddress?: ShippingAddress; couponCode?: string | null; expectedTotalINR?: number };
type ApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type ApiResponse = { status: (code: number) => { json: (value: unknown) => void } };

const parseBody = (body: unknown): RequestBody | null => {
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    return parsed && typeof parsed === 'object' ? parsed as RequestBody : null;
  } catch { return null; }
};

const addressError = (address: ShippingAddress | undefined) => {
  if (!address) return 'Enter a delivery address.';
  const required = [address.fullName, address.phone, address.email, address.addressLine1, address.city, address.state, address.pincode, address.country];
  return required.every((value) => typeof value === 'string' && value.trim()) ? null : 'Complete all required delivery address fields.';
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const authorization = request.headers.authorization;
  const token = typeof authorization === 'string' && authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return response.status(401).json({ error: 'Please sign in before placing an order.' });
  const body = parseBody(request.body);
  if (!body || !Array.isArray(body.items) || !body.items.length || addressError(body.shippingAddress)) return response.status(400).json({ error: addressError(body?.shippingAddress) || 'Your shopping bag is empty.' });
  if (typeof body.expectedTotalINR !== 'number' || !Number.isFinite(body.expectedTotalINR) || body.expectedTotalINR < 0 || body.items.length > 100 || body.items.some((item) => !item || typeof item.productId !== 'string' || !item.productId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 25 || !Number.isFinite(item.expectedPriceINR) || !Number.isFinite(item.expectedTailoringFeeINR))) return response.status(400).json({ error: 'One or more shopping bag values are invalid.' });

  try {
    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    const { FieldValue, getFirestore } = await import('firebase-admin/firestore');
    let app = getApps()[0];
    if (!app) {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
      if (!projectId || !clientEmail || !privateKey) return response.status(503).json({ error: 'Order service configuration is incomplete.' });
      app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    }
    const decoded = await getAuth(app).verifyIdToken(token);
    const uid = decoded.uid;
    const database = getFirestore(app);
    const requestId = typeof body.requestId === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(body.requestId) ? body.requestId : randomUUID();
    const orderRef = database.collection('orders').doc(`ord-${uid.slice(0, 12)}-${requestId}`);

    const order = await database.runTransaction(async (transaction) => {
      const existingOrder = await transaction.get(orderRef);
      if (existingOrder.exists) return existingOrder.data()?.data as Order;

      const productIds = [...new Set(body.items!.map((item) => item.productId))];
      const productRefs = productIds.map((id) => database.collection('products').doc(id));
      const settingsRef = database.collection('settings').doc('admin');
      const couponCode = typeof body.couponCode === 'string' ? body.couponCode.trim().toUpperCase() : '';
      const couponRef = couponCode ? database.collection('coupons').doc(couponCode) : null;
      const snapshots = await transaction.getAll(...productRefs, settingsRef, ...(couponRef ? [couponRef] : []));
      const productSnapshots = snapshots.slice(0, productRefs.length);
      const settingsSnapshot = snapshots[productRefs.length];
      const couponSnapshot = couponRef ? snapshots[productRefs.length + 1] : null;
      const products = productSnapshots.map((snapshot) => productFromDocument(snapshot.id, snapshot.data() || {})).filter((item): item is Product => Boolean(item));
      const productMap = new Map(products.map((product) => [product.id, product]));
      const items: CartItem[] = body.items!.map((requested, index) => {
        const product = productMap.get(requested.productId);
        if (!product) throw new Error('A product in your shopping bag is no longer available.');
        const isCustomTailored = requested.isCustomTailored === true;
        if (requested.expectedPriceINR !== product.priceINR || (isCustomTailored && requested.expectedTailoringFeeINR !== product.customStitchingFeeINR)) throw new Error('Product prices have changed. Review the updated shopping bag before placing the order.');
        return {
          cartItemId: `${requestId}-${index + 1}`,
          product,
          selectedColor: typeof requested.selectedColor === 'string' ? requested.selectedColor.trim() : '',
          selectedSize: typeof requested.selectedSize === 'string' ? requested.selectedSize.trim() : '',
          quantity: requested.quantity,
          isCustomTailored,
          ...(isCustomTailored && requested.customMeasurements ? { customMeasurements: requested.customMeasurements } : {}),
          tailoringFeeINR: isCustomTailored ? product.customStitchingFeeINR : 0,
          giftPackaging: requested.giftPackaging === true,
          ...(typeof requested.giftNote === 'string' && requested.giftNote.trim() ? { giftNote: requested.giftNote.trim().slice(0, 500) } : {}),
        };
      });
      const issue = cartCatalogIssue(items, products);
      if (issue) throw new Error(issue);

      let coupon: Coupon | null = null;
      if (couponCode) {
        const candidate = couponSnapshot?.data()?.data as Coupon | undefined;
        const expired = candidate?.expiryDate ? new Date(candidate.expiryDate).getTime() < Date.now() : false;
        if (!candidate?.isActive || couponSnapshot?.data()?.status === 'archived' || expired) throw new Error('This coupon is no longer available.');
        coupon = candidate;
      }
      const settings = settingsSnapshot.data()?.data as { checkoutCharges?: unknown } | undefined;
      const totals = calculateCheckoutTotals(items, coupon, normalizeCheckoutCharges(settings?.checkoutCharges));
      if (coupon && totals.couponDiscountINR <= 0) throw new Error(`This coupon requires a minimum merchandise subtotal of INR ${coupon.minCartValueINR}.`);
      if (Math.abs(totals.totalINR - body.expectedTotalINR!) > 0.001) throw new Error('Checkout charges have changed. Review the updated total before placing the order.');
      const legacy = legacyChargeAmounts(totals.charges);
      const createdAt = new Date().toISOString();
      const newOrder: Order = {
        id: orderRef.id,
        orderNumber: `AB-${createdAt.slice(2, 10).replace(/-/g, '')}-${requestId.slice(0, 6).toUpperCase()}`,
        createdAt,
        items,
        shippingAddress: body.shippingAddress!,
        shippingMethod: 'standard',
        shippingCostINR: legacy.shippingCostINR,
        subtotalINR: totals.subtotalINR,
        tailoringTotalINR: totals.tailoringTotalINR,
        couponDiscountINR: totals.couponDiscountINR,
        couponCodeApplied: coupon?.code || null,
        taxGstINR: legacy.taxGstINR,
        charges: totals.charges,
        totalINR: totals.totalINR,
        currency: 'INR',
        paymentMethod: 'cod',
        paymentStatus: 'Pending',
        orderStatus: 'Order Placed',
        timeline: [{ status: 'Order Placed', timestamp: createdAt, description: 'Your Cash on Delivery order request has been received.', completed: true }],
      };
      const storedOrder = sanitizeFirestoreData(newOrder);

      for (const product of products) {
        const requested = items.filter((item) => item.product.id === product.id).map((item) => ({ colorName: item.selectedColor, size: item.selectedSize, quantity: item.quantity }));
        const updated = sanitizeFirestoreData(withDeductedStock(product, requested));
        const inventoryWrite = sanitizeFirestoreData({ data: updated, updatedAt: FieldValue.serverTimestamp() });
        transaction.update(database.collection('products').doc(product.id), inventoryWrite);
      }
      const orderWrite = sanitizeFirestoreData({ customerId: uid, orderNumber: storedOrder.orderNumber, paymentStatus: storedOrder.paymentStatus, orderStatus: storedOrder.orderStatus, data: storedOrder, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      transaction.set(orderRef, orderWrite);
      return storedOrder;
    });
    return response.status(200).json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not place this order.';
    const safeMessage = /shopping bag|product|price|charge|stock|available|option|tailoring|coupon|minimum|address/i.test(message) ? message : 'Could not place this order. Please try again.';
    return response.status(400).json({ error: safeMessage });
  }
}
