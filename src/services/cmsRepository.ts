import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, onSnapshot, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { hasVariantInventory, normalizeVariantInventory, productFromDocument, productForStorage, totalProductStock, variantKey } from '../utils/productData';
import { normalizeCategory } from '../utils/categoryData';
import { normalizeCheckoutCharges } from '../utils/checkoutTotals';
import { InventorySaveInput, StaleInventoryError } from '../utils/inventoryData';
import { BRAND } from '../config/brand';
import { firestore } from '../firebase/config';
import { uploadMedia } from './mediaUploadService';
import { AboutContent, Banner, CheckoutCharge, ContactInformation, CustomerProfile, Order, Product, SiteContent, StoreCategory } from '../types';

export interface AdminSnapshot {
  products: Product[];
  inventoryVersions: Record<string, number>;
  orders: Order[];
  customers: CustomerProfile[];
}

const normalizedSku = (value: string) => value.trim().toLocaleLowerCase('en-IN');
const skuReservationId = (value: string) => encodeURIComponent(normalizedSku(value));
const documentIdentity = (snapshot: { id: string; data: () => Record<string, unknown> }) => {
  const document = snapshot.data();
  const data = document.data as Partial<Product> | undefined;
  return { id: snapshot.id, sku: typeof document.sku === 'string' ? document.sku : data?.sku || '', title: data?.title || 'another product' };
};
const inventoryVersion = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;

export interface PublicCms {
  banners: Banner[];
  content: SiteContent;
  about: AboutContent;
  contact: ContactInformation;
  lowStockThreshold: number;
  checkoutCharges: CheckoutCharge[];
}

export interface StoreSettings {
  lowStockThreshold: number;
  checkoutCharges: CheckoutCharge[];
}

const defaultContent: SiteContent = {
  homeEyebrow: '', collectionHeading: '', collectionDescription: '',
  newArrivalsHeading: '', newArrivalsDescription: '', footerDescription: ''
};
const defaultAbout: AboutContent = {
  businessName: '', heading: '', introduction: '', brandStory: '', philosophy: '', additionalInformation: ''
};

const defaultContact: ContactInformation = {
  businessName: BRAND.displayName,
  phone: BRAND.phone,
  email: BRAND.email,
  addressLines: [...BRAND.addressLines],
  mapsUrl: 'https://maps.app.goo.gl/YWUASJtbLWpz5DiaA',
  whatsappUrl: BRAND.whatsappUrl
};

export const DEFAULT_CMS: PublicCms = {
  banners: [], content: defaultContent, about: defaultAbout, contact: defaultContact, lowStockThreshold: 3, checkoutCharges: []
};

const readDocument = async <T extends object>(name: string, id: string, fallback: T): Promise<T> => {
  if (!firestore) return fallback;
  try {
    const snapshot = await getDoc(doc(firestore, name, id));
    return snapshot.exists() ? { ...fallback, ...(snapshot.data().data as Partial<T>) } : fallback;
  } catch {
    return fallback;
  }
};

export const cmsRepository = {
  async loadPublicCms(): Promise<PublicCms> {
    if (!firestore) return DEFAULT_CMS;
    const [bannerSnapshot, content, about, contact, settings] = await Promise.all([
      getDocs(collection(firestore, 'banners')).catch(() => null),
      readDocument('siteContent', 'home', defaultContent),
      readDocument('about', 'main', defaultAbout),
      readDocument('contact', 'main', defaultContact),
      readDocument('settings', 'admin', { lowStockThreshold: DEFAULT_CMS.lowStockThreshold, checkoutCharges: [] as CheckoutCharge[] })
    ]);
    const banners = bannerSnapshot
      ? bannerSnapshot.docs.map((item) => item.data().data as Banner).filter((item): item is Banner => Boolean(item && item.isActive)).sort((a, b) => a.displayOrder - b.displayOrder)
      : [];
    return { banners, content, about, contact, lowStockThreshold: Math.max(1, Number(settings.lowStockThreshold) || DEFAULT_CMS.lowStockThreshold), checkoutCharges: normalizeCheckoutCharges(settings.checkoutCharges) };
  },

  subscribeToStoreSettings(onSettings: (settings: StoreSettings) => void, onError: (error: Error) => void) {
    if (!firestore) { onSettings({ lowStockThreshold: DEFAULT_CMS.lowStockThreshold, checkoutCharges: [] }); return () => undefined; }
    return onSnapshot(doc(firestore, 'settings', 'admin'), (snapshot) => {
      const data = snapshot.data()?.data as Partial<StoreSettings> | undefined;
      onSettings({
        lowStockThreshold: Math.max(1, Number(data?.lowStockThreshold) || DEFAULT_CMS.lowStockThreshold),
        checkoutCharges: normalizeCheckoutCharges(data?.checkoutCharges),
      });
    }, onError);
  },

  subscribeToCategories(onCategories: (categories: StoreCategory[]) => void, onError: (error: Error) => void) {
    if (!firestore) { onCategories([]); return () => undefined; }
    return onSnapshot(collection(firestore, 'categories'), (snapshot) => {
      onCategories(snapshot.docs.map((item) => { const value = item.data(); return normalizeCategory((value.data || value) as Partial<StoreCategory>, item.id); })
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
    }, onError);
  },

  async loadAdminSnapshot(): Promise<AdminSnapshot> {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    const [productSnapshot, canonicalOrderSnapshot, legacyOrderSnapshot, customerSnapshot] = await Promise.all([
      getDocs(collection(firestore, 'products')),
      getDocs(collection(firestore, 'orders')),
      getDocs(collectionGroup(firestore, 'orders')),
      getDocs(collection(firestore, 'users'))
    ]);
    const orders = [...canonicalOrderSnapshot.docs, ...legacyOrderSnapshot.docs]
      .map((item) => item.data().data as Order)
      .filter((item): item is Order => Boolean(item?.id && item.orderNumber))
      .reduce<Order[]>((all, order) => all.some((item) => item.id === order.id) ? all : [...all, order], [])
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const products = productSnapshot.docs.map((item) => productFromDocument(item.id, item.data())).filter((item): item is Product => Boolean(item));
    return {
      products,
      inventoryVersions: Object.fromEntries(productSnapshot.docs.map((item) => [item.id, inventoryVersion(item.data().inventoryVersion)])),
      orders,
      customers: customerSnapshot.docs.map((item) => item.data().profile as CustomerProfile).filter(Boolean)
    };
  },

  async migrateLegacyOrdersForAdmin(): Promise<void> {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    const legacyOrders = await getDocs(collectionGroup(firestore, 'orders'));
    await Promise.all(legacyOrders.docs.map(async (legacyRef) => {
      const legacy = legacyRef.data();
      const order = legacy.data as Order | undefined;
      const customerId = legacy.customerId as string | undefined;
      if (!order?.id || !order.orderNumber || !customerId) return;
      const canonicalRef = doc(firestore, 'orders', order.id);
      if (legacyRef.ref.path === canonicalRef.path || (await getDoc(canonicalRef)).exists()) return;
      // An admin may promote only an existing customer record. The identical
      // id keeps this operation safe to retry and prevents duplicate orders.
      await setDoc(canonicalRef, {
        customerId,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        data: order,
        createdAt: legacy.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }));
  },

  async loadAllBanners(): Promise<Banner[]> {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    const snapshot = await getDocs(collection(firestore, 'banners'));
    return snapshot.docs.map((item) => item.data().data as Banner).filter(Boolean).sort((a, b) => a.displayOrder - b.displayOrder);
  },

  async saveProduct(product: Product, expectedInventoryVersion?: number) {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    product = productForStorage(product);
    const allProducts = await getDocs(collection(firestore, 'products'));
    const conflict = allProducts.docs.map(documentIdentity).find((candidate) => candidate.id !== product.id && normalizedSku(candidate.sku) === normalizedSku(product.sku));
    if (conflict) throw new Error(`SKU ${product.sku} is already used by ${conflict.title}. Enter a unique SKU.`);
    const productRef = doc(firestore, 'products', product.id);
    const reservationRef = doc(firestore, 'productSkus', skuReservationId(product.sku));
    await runTransaction(firestore, async (transaction) => {
      const existing = await transaction.get(productRef);
      const existingData = existing.data();
      const previousSku = typeof existingData?.sku === 'string' ? existingData.sku : (existingData?.data as Partial<Product> | undefined)?.sku || '';
      const previousReservationRef = previousSku && normalizedSku(previousSku) !== normalizedSku(product.sku) ? doc(firestore, 'productSkus', skuReservationId(previousSku)) : null;
      const reservation = await transaction.get(reservationRef);
      const previousReservation = previousReservationRef ? await transaction.get(previousReservationRef) : null;
      if (reservation.exists() && reservation.data()?.productId !== product.id) throw new Error(`SKU ${product.sku} is already assigned to another product.`);
      const currentVersion = inventoryVersion(existingData?.inventoryVersion);
      if (expectedInventoryVersion !== undefined && currentVersion !== expectedInventoryVersion) throw new StaleInventoryError();
      const nextVersion = currentVersion + 1;
      transaction.set(productRef, { data: product, category: product.category, sku: product.sku, status: product.isActive === false ? 'inactive' : 'active', inventoryVersion: nextVersion, updatedAt: serverTimestamp(), ...(!existing.exists() ? { createdAt: serverTimestamp() } : {}) }, { merge: true });
      transaction.set(reservationRef, { productId: product.id, sku: product.sku, updatedAt: serverTimestamp() });
      if (previousReservationRef && previousReservation?.data()?.productId === product.id) transaction.delete(previousReservationRef);
    });
  },

  async loadInventoryProduct(productId: string): Promise<{ product: Product; version: number } | null> {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    const snapshot = await getDoc(doc(firestore, 'products', productId));
    if (!snapshot.exists()) return null;
    const product = productFromDocument(snapshot.id, snapshot.data());
    return product ? { product, version: inventoryVersion(snapshot.data().inventoryVersion) } : null;
  },

  async saveInventory(input: InventorySaveInput): Promise<number> {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    if (!Number.isInteger(input.stockCount) || input.stockCount < 0) throw new Error('Stock must be a non-negative whole number.');
    const productRef = doc(firestore, 'products', input.productId);
    return runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(productRef);
      if (!snapshot.exists()) throw new Error('This product no longer exists.');
      const currentVersion = inventoryVersion(snapshot.data().inventoryVersion);
      if (currentVersion !== input.expectedVersion) throw new StaleInventoryError();
      const current = productFromDocument(snapshot.id, snapshot.data());
      if (!current) throw new Error('This product is no longer available for inventory editing.');

      if (!hasVariantInventory(current)) {
        if (input.variantInventory !== undefined) throw new StaleInventoryError();
        transaction.update(productRef, { 'data.stockCount': input.stockCount, inventoryVersion: currentVersion + 1, updatedAt: serverTimestamp() });
        return currentVersion + 1;
      }

      if (!Array.isArray(input.variantInventory) || input.variantInventory.some((row) => !Number.isInteger(row.stock) || row.stock < 0)) throw new Error('Every variant stock value must be a non-negative whole number.');
      const rows = normalizeVariantInventory(input.variantInventory) || [];
      const currentKeys = (current.variantInventory || []).map((row) => variantKey(row.colorName, row.size)).sort();
      const submittedKeys = rows.map((row) => variantKey(row.colorName, row.size)).sort();
      if (currentKeys.length !== submittedKeys.length || currentKeys.some((key, index) => key !== submittedKeys[index])) throw new StaleInventoryError();
      const stockCount = totalProductStock({ stockCount: input.stockCount, variantInventory: rows });
      transaction.update(productRef, { 'data.stockCount': stockCount, 'data.variantInventory': rows, inventoryVersion: currentVersion + 1, updatedAt: serverTimestamp() });
      return currentVersion + 1;
    });
  },

  async archiveProduct(productId: string) {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    await setDoc(doc(firestore, 'products', productId), { status: 'archived', updatedAt: serverTimestamp() }, { merge: true });
  },

  async saveBanner(banner: Banner) {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    const bannerRef = doc(firestore, 'banners', banner.id);
    const exists = (await getDoc(bannerRef)).exists();
    const { mobileImage, ...legacyCompatibleBanner } = banner;
    const data = mobileImage ? { ...legacyCompatibleBanner, mobileImage } : legacyCompatibleBanner;
    await setDoc(bannerRef, { data, updatedAt: serverTimestamp(), ...(!exists ? { createdAt: serverTimestamp() } : {}) }, { merge: true });
  },

  async deleteBanner(bannerId: string) {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    await deleteDoc(doc(firestore, 'banners', bannerId));
  },

  async saveContent(content: SiteContent) { await cmsRepository.saveDocument('siteContent', 'home', content); },
  async saveAbout(about: AboutContent) { await cmsRepository.saveDocument('about', 'main', about); },
  async saveContact(contact: ContactInformation) { await cmsRepository.saveDocument('contact', 'main', contact); },
  async saveSettings(settings: StoreSettings) { await cmsRepository.saveDocument('settings', 'admin', { lowStockThreshold: Math.max(1, Math.floor(settings.lowStockThreshold)), checkoutCharges: normalizeCheckoutCharges(settings.checkoutCharges) }); },
  async saveCategory(category: StoreCategory) {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    const normalized = normalizeCategory(category, category.id || category.slug);
    if (!normalized.id || !normalized.name || !normalized.slug) throw new Error('Category name and URL slug are required.');
    const categoryRef = doc(firestore, 'categories', normalized.id);
    const existingCategories = await getDocs(collection(firestore, 'categories'));
    const conflict = existingCategories.docs.find((item) => item.id !== normalized.id && ((item.data().slug as string | undefined) || (item.data().data as Partial<StoreCategory> | undefined)?.slug)?.toLowerCase() === normalized.slug.toLowerCase());
    const nameConflict = existingCategories.docs.find((item) => item.id !== normalized.id && ((item.data().name as string | undefined) || (item.data().data as Partial<StoreCategory> | undefined)?.name)?.toLowerCase() === normalized.name.toLowerCase());
    if (conflict) throw new Error('This category URL slug is already in use.');
    if (nameConflict) throw new Error('A category with this name already exists.');
    await setDoc(categoryRef, { data: normalized, name: normalized.name, slug: normalized.slug, isActive: normalized.isActive, sortOrder: normalized.sortOrder, updatedAt: serverTimestamp(), ...(!(await getDoc(categoryRef)).exists() ? { createdAt: serverTimestamp() } : {}) }, { merge: true });
    return normalized;
  },
  async deleteCategory(category: StoreCategory) {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    const products = await getDocs(collection(firestore, 'products'));
    const inUse = products.docs.some((item) => item.data().status !== 'archived' && ((item.data().category as string | undefined) === category.name || (item.data().data as Partial<Product> | undefined)?.category === category.name));
    if (inUse) throw new Error(`Move or archive products in ${category.name} before deleting this category.`);
    await deleteDoc(doc(firestore, 'categories', category.id));
  },
  async saveDocument(collectionName: string, id: string, data: object) {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    const contentRef = doc(firestore, collectionName, id);
    const exists = (await getDoc(contentRef)).exists();
    await setDoc(contentRef, { data, updatedAt: serverTimestamp(), ...(!exists ? { createdAt: serverTimestamp() } : {}) }, { merge: true });
  },

  uploadImage(file: File, folder: 'products' | 'banners' | 'about', recordId: string, onProgress: (percent: number) => void): Promise<string> {
    return uploadMedia(file, folder, recordId, onProgress).then((media) => media.secureUrl);
  }
};
