import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { BRAND } from '../config/brand';
import { firestore } from '../firebase/config';
import { uploadMedia } from './mediaUploadService';
import { AboutContent, Banner, ContactInformation, CustomerProfile, Order, Product, SiteContent } from '../types';

export interface AdminSnapshot {
  products: Product[];
  orders: Order[];
  customers: CustomerProfile[];
}

export interface PublicCms {
  banners: Banner[];
  content: SiteContent;
  about: AboutContent;
  contact: ContactInformation;
  lowStockThreshold: number;
}

const defaultContent: SiteContent = {
  homeEyebrow: 'AB Collection',
  collectionHeading: 'Crafted for every occasion',
  collectionDescription: 'Discover boutique styles selected for celebrations and special moments.',
  newArrivalsHeading: 'New arrivals',
  newArrivalsDescription: 'Discover the newest additions to the AB Collection.',
  footerDescription: 'AB Collection is a boutique destination in Miyapur, Hyderabad. Discover the current catalog and contact us for store assistance.'
};

const defaultAbout: AboutContent = {
  businessName: BRAND.displayName,
  heading: 'A story ready to be told.',
  introduction: 'AB Collection’s final brand history has not yet been supplied. This page is reserved for approved business information.',
  brandStory: 'Add the approved AB Collection brand story here from the secure admin panel.',
  philosophy: 'Add the values behind the collection once they are confirmed.',
  additionalInformation: 'Current collection descriptions and product details are managed as catalog data.'
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
  banners: [], content: defaultContent, about: defaultAbout, contact: defaultContact, lowStockThreshold: 3
};

const asProduct = (value: Record<string, unknown>): Product | null => {
  const product = value.data as Product | undefined;
  if (!product || !product.id || value.status === 'archived') return null;
  return { ...product, isActive: value.status !== 'inactive' && product.isActive !== false };
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
      readDocument('settings', 'admin', { lowStockThreshold: DEFAULT_CMS.lowStockThreshold })
    ]);
    const banners = bannerSnapshot
      ? bannerSnapshot.docs.map((item) => item.data().data as Banner).filter((item): item is Banner => Boolean(item && item.isActive)).sort((a, b) => a.displayOrder - b.displayOrder)
      : [];
    return { banners, content, about, contact, lowStockThreshold: Math.max(1, Number(settings.lowStockThreshold) || DEFAULT_CMS.lowStockThreshold) };
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
    return {
      products: productSnapshot.docs.map((item) => asProduct(item.data())).filter((item): item is Product => Boolean(item)),
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

  async saveProduct(product: Product) {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    const productRef = doc(firestore, 'products', product.id);
    const exists = (await getDoc(productRef)).exists();
    await setDoc(productRef, {
      data: product,
      category: product.category,
      sku: product.sku,
      status: product.isActive === false ? 'inactive' : 'active',
      updatedAt: serverTimestamp(),
      ...(!exists ? { createdAt: serverTimestamp() } : {})
    }, { merge: true });
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
  async saveSettings(lowStockThreshold: number) { await cmsRepository.saveDocument('settings', 'admin', { lowStockThreshold }); },
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
