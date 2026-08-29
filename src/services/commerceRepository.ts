import { collectionGroup, deleteDoc, deleteField, doc, getDoc, getDocs, setDoc, updateDoc, collection, query, serverTimestamp, where } from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { CartItem, Coupon, CustomerProfile, Order, OrderStatus, Product, ReviewItem } from '../types';

export interface CustomerDataSnapshot {
  cart?: CartItem[];
  wishlist?: string[];
  profile?: CustomerProfile;
  profileExists?: boolean;
  orders?: Order[];
}

const readLocal = <T>(key: string, fallback: T): T => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
};
const writeLocal = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { console.warn(error); } };

const privateDoc = (name: 'carts' | 'wishlists' | 'users', uid: string) => doc(firestore!, name, uid);
const toFirestore = <T extends object>(data: T) => ({ ...data, updatedAt: serverTimestamp() });

export const commerceRepository = {
  async loadCatalog(fallback: Product[]) {
    if (!firestore) return readLocal('mb_products', fallback);
    try {
      const snapshot = await getDocs(collection(firestore, 'products'));
      const products = snapshot.docs.map((item) => item.data().data as Product).filter(Boolean);
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
    if (!firestore || !uid) return { cart: readLocal('mb_cart', fallback.cart || []), wishlist: readLocal('mb_wishlist', fallback.wishlist || []), profile: readLocal('mb_customer', fallback.profile!), orders: readLocal('mb_orders', fallback.orders || []) };
    try {
      const [cart, wishlist, profile, orders] = await Promise.all([
        getDoc(privateDoc('carts', uid)), getDoc(privateDoc('wishlists', uid)), getDoc(privateDoc('users', uid)), getDocs(collection(firestore, 'users', uid, 'orders'))
      ]);
      return {
        cart: (cart.data()?.items as CartItem[] | undefined) || [],
        wishlist: (wishlist.data()?.productIds as string[] | undefined) || [],
        profile: (profile.data()?.profile as CustomerProfile | undefined) || fallback.profile,
        profileExists: profile.exists(),
        orders: orders.docs.map((item) => item.data().data as Order).filter(Boolean)
      };
    } catch (error) { console.warn('Firestore private data unavailable; using local fallback.', error); return this.loadCustomerData(null, fallback); }
  },
  async loadAdminOrders(fallback: Order[]) {
    if (!firestore) return fallback;
    try {
      const snapshot = await getDocs(collectionGroup(firestore, 'orders'));
      return snapshot.docs.map((item) => item.data().data as Order).filter(Boolean);
    } catch (error) { console.warn('Firestore admin orders unavailable; using current data.', error); return fallback; }
  },
  async saveCart(uid: string | null, items: CartItem[]) {
    if (!firestore || !uid) return writeLocal('mb_cart', items);
    try { await setDoc(privateDoc('carts', uid), toFirestore({ ownerId: uid, items }), { merge: true }); } catch (error) { console.warn('Cart was retained locally after Firestore write failed.', error); writeLocal('mb_cart', items); }
  },
  async saveWishlist(uid: string | null, productIds: string[]) {
    if (!firestore || !uid) return writeLocal('mb_wishlist', productIds);
    try { await setDoc(privateDoc('wishlists', uid), toFirestore({ ownerId: uid, productIds }), { merge: true }); } catch (error) { console.warn('Wishlist was retained locally after Firestore write failed.', error); writeLocal('mb_wishlist', productIds); }
  },
  async saveProfile(uid: string | null, profile: CustomerProfile) {
    if (!firestore || !uid) return writeLocal('mb_customer', profile);
    try { await setDoc(privateDoc('users', uid), toFirestore({ profile: { ...profile, id: uid } }), { merge: true }); } catch (error) { console.warn('Profile was retained locally after Firestore write failed.', error); writeLocal('mb_customer', profile); }
  },
  async createProfile(uid: string | null, profile: CustomerProfile) {
    if (!firestore || !uid) return writeLocal('mb_customer', profile);
    try {
      await setDoc(privateDoc('users', uid), {
        profile: { ...profile, id: uid },
        role: 'customer',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) { console.warn('Profile was retained locally after Firestore write failed.', error); writeLocal('mb_customer', profile); }
  },
  async saveOrder(uid: string | null, order: Order) {
    if (!firestore || !uid) { const previous = readLocal<Order[]>('mb_orders', []); return writeLocal('mb_orders', [order, ...previous.filter((item) => item.id !== order.id)]); }
    try {
      // Client documents are display snapshots only. A trusted Cloud Function must recalculate prices, stock, coupon and payment state before fulfilment.
      await setDoc(doc(firestore, 'users', uid, 'orders', order.id), toFirestore({ customerId: uid, data: { ...order, paymentStatus: 'Pending', orderStatus: 'Order Placed' }, createdAt: serverTimestamp() }), { merge: true });
    } catch (error) { console.warn('Order was retained locally after Firestore write failed.', error); const previous = readLocal<Order[]>('mb_orders', []); writeLocal('mb_orders', [order, ...previous.filter((item) => item.id !== order.id)]); }
  },
  async saveProduct(product: Product) {
    if (!firestore) return writeLocal('mb_products', product);
    await setDoc(doc(firestore, 'products', product.id), toFirestore({ data: product, category: product.category, sku: product.sku, status: 'active', createdAt: serverTimestamp() }), { merge: true });
  },
  async deleteProduct(productId: string) {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'products', productId), { status: 'archived', updatedAt: serverTimestamp(), data: deleteField() });
  },
  async updateOrderStatus(orderId: string, customerId: string, status: OrderStatus, trackingNumber?: string) {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'users', customerId, 'orders', orderId), { 'data.orderStatus': status, ...(trackingNumber ? { 'data.trackingNumber': trackingNumber } : {}), updatedAt: serverTimestamp() });
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
