import { collectionGroup, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc, collection, query, serverTimestamp, where } from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { CartItem, Coupon, CustomerProfile, Order, OrderStatus, Product, ReviewItem } from '../types';

export interface CustomerDataSnapshot {
  cart?: CartItem[];
  wishlist?: string[];
  profile?: CustomerProfile;
  profileExists?: boolean;
  orders?: Order[];
  /** Existing customer-subcollection orders which are read only for migration. */
  legacyOrders?: Order[];
}

const readLocal = <T>(key: string, fallback: T): T => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
};
const writeLocal = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { console.warn(error); } };
const accountLocalKey = (name: 'cart' | 'wishlist' | 'customer' | 'orders', uid: string) => `mb_${name}_${uid}`;

const guestLocalKey = (name: 'cart' | 'wishlist') => `mb_guest_${name}`;

export const cartLineKey = (item: Pick<CartItem, 'product' | 'selectedColor' | 'selectedSize' | 'isCustomTailored'>) => [
  item.product.id || item.product.sku,
  item.selectedColor.trim().toLowerCase(),
  item.selectedSize,
  item.isCustomTailored ? 'tailored' : 'ready'
].join('::');

export const normalizeCartItems = (items: CartItem[]) => {
  const normalized = new Map<string, CartItem>();
  for (const item of items) {
    if (!item?.product?.id) continue;
    const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? Math.floor(item.quantity) : 1;
    const key = cartLineKey(item);
    const existing = normalized.get(key);
    normalized.set(key, existing ? { ...existing, quantity: existing.quantity + quantity } : { ...item, quantity });
  }
  return [...normalized.values()];
};

export const normalizeWishlistProductIds = (productIds: string[]) => [...new Set(productIds.filter((productId): productId is string => typeof productId === 'string' && productId.trim().length > 0))];

const privateDoc = (name: 'carts' | 'wishlists' | 'users', uid: string) => doc(firestore!, name, uid);
const toFirestore = <T extends object>(data: T) => ({ ...data, updatedAt: serverTimestamp() });

/**
 * Firestore does not accept `undefined` at any depth. Checkout values and
 * optional product fields are normalized before the canonical document is made.
 */
const normalizeForFirestore = (value: unknown): unknown => {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(normalizeForFirestore);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeForFirestore(item)]));
  }
  return value;
};

/** `/orders/{orderId}` is the canonical record for all new orders. */
const canonicalOrderDocument = (uid: string, order: Order) => ({
  customerId: uid,
  orderNumber: order.orderNumber,
  paymentStatus: order.paymentStatus,
  orderStatus: order.orderStatus,
  data: normalizeForFirestore(order) as Order,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
});

const orderFromDocument = (value: Record<string, unknown>): Order | null => {
  const order = value.data as Order | undefined;
  return order?.id && order.orderNumber ? order : null;
};

const newestFirst = (orders: Order[]) => [...orders].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
const mergeOrders = (...groups: Order[][]) => newestFirst(
  groups.flat().reduce<Order[]>((merged, order) => merged.some((item) => item.id === order.id) ? merged : [...merged, order], [])
);

export const commerceRepository = {
  async loadCatalog(fallback: Product[]) {
    if (!firestore) return readLocal('mb_products', fallback);
    try {
      const snapshot = await getDocs(collection(firestore, 'products'));
      const products = snapshot.docs
        .filter((item) => item.data().status !== 'archived' && item.data().status !== 'inactive')
        .map((item) => item.data().data as Product)
        .filter((item): item is Product => Boolean(item && item.isActive !== false));
      return products.length ? products : fallback;
    } catch (error) { console.warn('Firestore catalog unavailable; using local catalog fallback.', error); return readLocal('mb_products', fallback); }
  },
  async loadCoupons(fallback: Coupon[]) {
    if (!firestore) return readLocal('mb_coupons', fallback);
    try {
      const snapshot = await getDocs(collection(firestore, 'coupons'));
      const coupons = snapshot.docs.map((item) => item.data().data as Coupon).filter(Boolean);
      return coupons.length ? coupons : fallback;
    } catch (error) { console.warn('Firestore coupons unavailable; using local fallback.', error); return readLocal('mb_coupons', fallback); }
  },
  async loadCustomerData(uid: string | null, fallback: CustomerDataSnapshot): Promise<CustomerDataSnapshot> {
    if (!uid) {
      return {
        cart: normalizeCartItems(readLocal(guestLocalKey('cart'), fallback.cart || [])),
        wishlist: normalizeWishlistProductIds(readLocal(guestLocalKey('wishlist'), fallback.wishlist || [])),
        profile: readLocal('mb_customer', fallback.profile!),
        orders: readLocal('mb_orders', fallback.orders || [])
      };
    }
    const accountFallback = {
      cart: normalizeCartItems(readLocal(accountLocalKey('cart', uid), fallback.cart || [])),
      wishlist: normalizeWishlistProductIds(readLocal(accountLocalKey('wishlist', uid), fallback.wishlist || [])),
      profile: readLocal(accountLocalKey('customer', uid), fallback.profile!),
      profileExists: false,
      orders: readLocal(accountLocalKey('orders', uid), fallback.orders || [])
    };
    if (!firestore) return accountFallback;
    try {
      const [cart, wishlist, profile, canonicalOrders, legacyOrders] = await Promise.all([
        getDoc(privateDoc('carts', uid)),
        getDoc(privateDoc('wishlists', uid)),
        getDoc(privateDoc('users', uid)),
        getDocs(query(collection(firestore, 'orders'), where('customerId', '==', uid))),
        getDocs(collection(firestore, 'users', uid, 'orders'))
      ]);
      const legacy = legacyOrders.docs.map((item) => orderFromDocument(item.data())).filter((item): item is Order => Boolean(item));
      return {
        cart: normalizeCartItems((cart.data()?.items as CartItem[] | undefined) || accountFallback.cart),
        wishlist: normalizeWishlistProductIds((wishlist.data()?.productIds as string[] | undefined) || accountFallback.wishlist),
        profile: (profile.data()?.profile as CustomerProfile | undefined) || accountFallback.profile,
        profileExists: profile.exists(),
        orders: mergeOrders(canonicalOrders.docs.map((item) => orderFromDocument(item.data())).filter((item): item is Order => Boolean(item)), legacy),
        legacyOrders: legacy
      };
    } catch (error) { console.warn('Firestore private data unavailable; using account-local fallback.', error); return accountFallback; }
  },
  async loadAdminOrders(fallback: Order[]) {
    if (!firestore) return fallback;
    try {
      const [canonical, legacy] = await Promise.all([
        getDocs(collection(firestore, 'orders')),
        getDocs(collectionGroup(firestore, 'orders'))
      ]);
      return mergeOrders(
        canonical.docs.map((item) => orderFromDocument(item.data())).filter((item): item is Order => Boolean(item)),
        legacy.docs.map((item) => orderFromDocument(item.data())).filter((item): item is Order => Boolean(item))
      );
    } catch (error) { console.warn('Firestore admin orders unavailable; using current data.', error); return fallback; }
  },
  subscribeToCustomerOrders(uid: string, onOrders: (orders: Order[]) => void, onError: (error: Error) => void) {
    if (!firestore) return () => undefined;
    return onSnapshot(
      query(collection(firestore, 'orders'), where('customerId', '==', uid)),
      (snapshot) => onOrders(snapshot.docs.map((item) => orderFromDocument(item.data())).filter((item): item is Order => Boolean(item))),
      (error) => onError(error)
    );
  },
  subscribeToCanonicalOrders(onChange: () => void, onError: (error: Error) => void) {
    if (!firestore) return () => undefined;
    return onSnapshot(collection(firestore, 'orders'), () => onChange(), (error) => onError(error));
  },
  async saveCart(uid: string | null, items: CartItem[]) {
    const normalizedItems = normalizeCartItems(items);
    if (!uid) return writeLocal(guestLocalKey('cart'), normalizedItems);
    if (firestore) await setDoc(privateDoc('carts', uid), toFirestore({ ownerId: uid, items: normalizedItems }), { merge: true });
    writeLocal(accountLocalKey('cart', uid), normalizedItems);
  },
  async saveWishlist(uid: string | null, productIds: string[]) {
    const normalizedProductIds = normalizeWishlistProductIds(productIds);
    if (!uid) return writeLocal(guestLocalKey('wishlist'), normalizedProductIds);
    if (firestore) await setDoc(privateDoc('wishlists', uid), toFirestore({ ownerId: uid, productIds: normalizedProductIds }), { merge: true });
    writeLocal(accountLocalKey('wishlist', uid), normalizedProductIds);
  },
  async saveProfile(uid: string | null, profile: CustomerProfile) {
    if (!uid) return writeLocal('mb_customer', profile);
    writeLocal(accountLocalKey('customer', uid), profile);
    if (!firestore) return;
    try { await setDoc(privateDoc('users', uid), toFirestore({ profile: { ...profile, id: uid } }), { merge: true }); } catch (error) { console.warn('Profile was retained in this account\'s local cache after Firestore write failed.', error); }
  },
  async createProfile(uid: string | null, profile: CustomerProfile) {
    if (!uid) return writeLocal('mb_customer', profile);
    writeLocal(accountLocalKey('customer', uid), profile);
    if (!firestore) return;
    try {
      await setDoc(privateDoc('users', uid), {
        profile: { ...profile, id: uid },
        role: 'customer',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) { console.warn('Profile was retained in this account\'s local cache after Firestore write failed.', error); }
  },
  async saveOrder(uid: string | null, order: Order) {
    if (!uid) throw new Error('Please sign in before placing an order.');
    if (!firestore) throw new Error('Order service is not configured for this deployment.');
    // Do not clear the basket or confirm an order until this write succeeds.
    // Retrying the same generated id remains idempotent.
    await setDoc(doc(firestore, 'orders', order.id), canonicalOrderDocument(uid, order));
    const cachedOrders = readLocal<Order[]>(accountLocalKey('orders', uid), []);
    writeLocal(accountLocalKey('orders', uid), mergeOrders([order], cachedOrders));
  },
  async saveProduct(product: Product) {
    if (!firestore) return writeLocal('mb_products', product);
    await setDoc(doc(firestore, 'products', product.id), toFirestore({ data: product, category: product.category, sku: product.sku, status: product.isActive === false ? 'inactive' : 'active', createdAt: serverTimestamp() }), { merge: true });
  },
  async deleteProduct(productId: string) {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'products', productId), { status: 'archived', updatedAt: serverTimestamp() });
  },
  async updateOrderStatus(order: Order, status: OrderStatus, trackingNumber?: string) {
    if (!firestore) throw new Error('Order service is not configured for this deployment.');
    const timeline = [...order.timeline, {
      status,
      timestamp: new Date().toLocaleString('en-IN'),
      description: `Order status updated to ${status}.`,
      completed: true
    }];
    const updatedOrder: Order = { ...order, orderStatus: status, ...(trackingNumber ? { trackingNumber } : {}), timeline };
    await updateDoc(doc(firestore, 'orders', order.id), {
      orderStatus: status,
      'data.orderStatus': status,
      'data.timeline': timeline,
      ...(trackingNumber ? { 'data.trackingNumber': trackingNumber } : {}),
      updatedAt: serverTimestamp()
    });
    return updatedOrder;
  },
  async saveCoupon(coupon: Coupon) {
    if (!firestore) return writeLocal('mb_coupons', coupon);
    await setDoc(doc(firestore, 'coupons', coupon.code), toFirestore({ data: coupon, code: coupon.code, status: coupon.isActive ? 'active' : 'inactive' }), { merge: true });
  },
  async deleteCoupon(couponCode: string) {
    if (!firestore) return;
    await deleteDoc(doc(firestore, 'coupons', couponCode));
  },
  async loadProductReviews(productId: string) {
    if (!firestore) return [] as ReviewItem[];
    try {
      const snapshot = await getDocs(query(collection(firestore, 'reviews'), where('productId', '==', productId)));
      return snapshot.docs.map((item) => item.data().data as ReviewItem).filter(Boolean);
    } catch (error) { console.warn('Firestore reviews unavailable; using bundled reviews.', error); return [] as ReviewItem[]; }
  },
  async saveReview(uid: string, productId: string, review: ReviewItem) {
    if (!firestore) return;
    await setDoc(doc(firestore, 'reviews', review.id), toFirestore({ productId, userId: uid, data: { ...review, verifiedBuyer: false }, verifiedBuyer: false }));
  },
  saveLocalCatalog(products: Product[]) { writeLocal('mb_products', products); },
  saveLocalCoupons(coupons: Coupon[]) { writeLocal('mb_coupons', coupons); },
  saveLocalOrders(orders: Order[]) { writeLocal('mb_orders', orders); }
};
