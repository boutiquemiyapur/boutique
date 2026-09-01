import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  AppView,
  CartItem,
  Category,
  Coupon,
  CustomerProfile,
  CustomMeasurements,
  FilterState,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  ReviewItem,
  ShippingAddress,
  ShippingMethod,
  SizeOption
} from '../types';
import { INITIAL_PRODUCTS } from '../data/mockProducts';
import { CURRENCIES, INITIAL_COUPONS, INITIAL_CUSTOMER, INITIAL_ORDERS } from '../data/initialData';
import confetti from 'canvas-confetti';
import { AuthSession, authErrorMessage, logoutFirebaseUser, registerWithEmail, requestPasswordReset, signInWithEmail, startAuthSession } from '../firebase/auth';
import { cartLineKey, commerceRepository, normalizeCartItems, normalizeWishlistProductIds } from '../services/commerceRepository';
import { cmsRepository, DEFAULT_CMS, PublicCms } from '../services/cmsRepository';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

interface StoreContextType {
  authStatus: 'loading' | 'authenticated' | 'unauthenticated';
  /** True once the signed-in customer's profile, cart, and orders have hydrated. */
  isCustomerDataReady: boolean;
  authSession: AuthSession;
  products: Product[];
  cart: CartItem[];
  wishlist: string[];
  orders: Order[];
  coupons: Coupon[];
  customer: CustomerProfile;
  cms: PublicCms;
  activeView: AppView;
  currentView: AppView;
  selectedProductId: string | null;
  selectedTrackingOrderId: string | null;
  lastPlacedOrder: Order | null;
  currentOrder: Order | null;
  filters: FilterState;
  quickViewProduct: Product | null;
  isSizeGuideOpen: boolean;
  isCartDrawerOpen: boolean;
  isWishlistDrawerOpen: boolean;
  appliedCoupon: Coupon | null;
  toasts: Toast[];

  // Navigation
  navigate: (view: AppView, productId?: string, trackingOrderId?: string) => void;
  navigateFromUrl: () => void;
  refreshCms: () => Promise<void>;
  setQuickViewProduct: (product: Product | null) => void;
  setIsSizeGuideOpen: (open: boolean) => void;
  setIsCartDrawerOpen: (open: boolean) => void;
  setIsWishlistDrawerOpen: (open: boolean) => void;

  // Cart operations
  addToCart: (
    product: Product,
    selectedColor: string,
    selectedSize: SizeOption,
    quantity?: number,
    isCustomTailored?: boolean,
    customMeasurements?: CustomMeasurements,
    giftPackaging?: boolean,
    giftNote?: string
  ) => Promise<boolean>;
  updateCartQuantity: (cartItemId: string, quantity: number) => Promise<boolean>;
  removeFromCart: (cartItemId: string) => Promise<boolean>;
  clearCart: () => Promise<boolean>;

  // Wishlist
  toggleWishlist: (productId: string) => Promise<boolean>;
  isInWishlist: (productId: string) => boolean;

  // Pricing & Currency
  formatPrice: (inrAmount: number) => string;
  convertPrice: (inrAmount: number) => number;
  freeShippingThresholdINR: number;

  // Discounts
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;

  // Cart Totals
  cartSubtotalINR: number;
  cartTailoringTotalINR: number;
  cartDiscountINR: number;
  cartTaxINR: number;
  cartShippingINR: number;
  cartTotalINR: number;

  // Checkout & Orders
  createOrder: (
    shippingAddress: ShippingAddress,
    shippingMethod: ShippingMethod,
    paymentMethod: PaymentMethod
  ) => Promise<Order>;
  cancelOrder: (orderId: string) => void;

  // Customer Vault
  updateCustomerMeasurements: (measurements: CustomMeasurements) => void;
  saveMeasurements: (measurements: CustomMeasurements) => void;
  updateCustomerProfile: (profile: Partial<CustomerProfile>) => void;
  addSavedAddress: (address: ShippingAddress) => void;

  // Admin Operations
  updateOrderStatus: (orderId: string, status: OrderStatus, trackingNumber?: string) => Promise<void>;
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (productId: string) => void;
  addCoupon: (coupon: Coupon) => void;
  deleteCoupon: (couponCode: string) => void;
  loadProductReviews: (productId: string) => Promise<ReviewItem[]>;
  submitReview: (productId: string, review: ReviewItem) => Promise<void>;

  // Filters & Search
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  resetFilters: () => void;

  // Notifications
  showToast: (title: string, message: string, type?: 'success' | 'info' | 'error') => void;
  removeToast: (id: string) => void;
  requireAuth: (view?: AppView) => void;
  completeAuthentication: () => void;
  login: (email: string, password: string, remember?: boolean) => Promise<AuthSession>;
  register: (fullName: string, email: string, phone: string, password: string) => Promise<AuthSession>;
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const initialFilterState: FilterState = {
  category: 'All',
  fabrics: [],
  occasions: [],
  sizes: [],
  colors: [],
  minPriceINR: 0,
  maxPriceINR: 150000,
  readyToShipOnly: false,
  handloomOnly: false,
  searchQuery: '',
  sortBy: 'featured'
};

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const categoryFromSlug = (slug: string): Category | null => {
  const match: Record<string, Category> = {
    'kanjeevaram-silks': 'Kanjeevaram Silks', 'banarasi-brocades': 'Banarasi Sarees',
    'designer-sarees': 'Designer Sarees', 'bridal-lehengas': 'Bridal Lehengas',
    'chikankari-suits': 'Unstitched Suits', 'temple-antique-jewelry': 'Temple Jewelry'
  };
  return match[slug] || null;
};

const pathForView = (view: AppView, productId?: string, orderId?: string) => {
  const paths: Partial<Record<AppView, string>> = {
    home: '/', shop: '/shop', cart: '/cart', wishlist: '/wishlist', checkout: '/checkout', account: '/account',
    admin: '/admin', about: '/about', 'tailoring-guide': '/tailoring', contact: '/contact', login: '/login', register: '/register',
    'forgot-password': '/forgot-password', 'shipping-policy': '/shipping', 'returns-policy': '/returns', 'cancellation-policy': '/cancellation',
    'privacy-policy': '/privacy', 'terms-policy': '/terms', 'cookie-policy': '/cookies', 'not-found': '/404'
  };
  if (view === 'product-detail' && productId) return `/product/${encodeURIComponent(productId)}`;
  if (view === 'order-confirmation' && orderId) return `/order-confirmation/${encodeURIComponent(orderId)}`;
  if (view === 'order-tracking' && orderId) return `/orders/${encodeURIComponent(orderId)}`;
  return paths[view] || '/';
};

const customerForSession = (session: NonNullable<AuthSession>): CustomerProfile => ({
  id: session.uid,
  fullName: session.displayName || '',
  email: session.email,
  phone: '',
  tier: 'Silver Patron',
  savedAddresses: [],
  totalSpendINR: 0,
  ordersCount: 0
});

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Persistent State initializers with localStorage fallbacks
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('mb_products');
      return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  // Do not hydrate cart or wishlist before Firebase resolves the owner.
  // This prevents a prior account's browser state from flashing for another user.
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('mb_orders');
      return saved ? JSON.parse(saved) : INITIAL_ORDERS;
    } catch {
      return INITIAL_ORDERS;
    }
  });

  const [coupons, setCoupons] = useState<Coupon[]>(() => {
    try {
      const saved = localStorage.getItem('mb_coupons');
      return saved ? JSON.parse(saved) : INITIAL_COUPONS;
    } catch {
      return INITIAL_COUPONS;
    }
  });

  const [customer, setCustomer] = useState<CustomerProfile>(() => {
    try {
      const saved = localStorage.getItem('mb_customer');
      return saved ? JSON.parse(saved) : INITIAL_CUSTOMER;
    } catch {
      return INITIAL_CUSTOMER;
    }
  });

  const [cms, setCms] = useState<PublicCms>(DEFAULT_CMS);
  const selectedCurrency = 'INR' as const;
  const [activeView, setActiveView] = useState<AppView>('home');
  const [selectedProductId, setSelectedProductId] = useState<string | null>('mb-kanjeevaram-01');
  const [selectedTrackingOrderId, setSelectedTrackingOrderId] = useState<string | null>('ord-881');
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState<boolean>(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);
  const [isWishlistDrawerOpen, setIsWishlistDrawerOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [firebaseUserId, setFirebaseUserId] = useState<string | null>(null);
  const [privateDataReady, setPrivateDataReady] = useState(false);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [authSession, setAuthSession] = useState<AuthSession>(null);
  const [pendingProtectedView, setPendingProtectedView] = useState<AppView | null>(null);
  const activePrivateUidRef = useRef<string | null>(null);
  const privateLoadVersionRef = useRef(0);
  const pendingCartLineKeysRef = useRef(new Set<string>());
  const pendingWishlistProductIdsRef = useRef(new Set<string>());

  const freeShippingThresholdINR = 5000;

  const refreshCms = async () => {
    setCms(await cmsRepository.loadPublicCms());
  };

  useEffect(() => { void refreshCms(); }, []);

  // Firebase is accessed only through the repository. The local browser storage
  // remains an offline/unauthenticated fallback while authentication is enabled.
  useEffect(() => {
    commerceRepository.saveLocalCatalog(products);
  }, [products]);

  useEffect(() => {
    commerceRepository.saveLocalCoupons(coupons);
  }, [coupons]);


  useEffect(() => {
    if (!firebaseUserId) commerceRepository.saveLocalOrders(orders);
  }, [orders, firebaseUserId]);

  useEffect(() => {
    if (!firebaseUserId) {
      try { localStorage.setItem('mb_customer', JSON.stringify(customer)); } catch { /* browser storage is only a guest fallback */ }
    }
  }, [customer, firebaseUserId]);

  const resetPrivateState = (session: AuthSession = null) => {
    pendingCartLineKeysRef.current.clear();
    pendingWishlistProductIdsRef.current.clear();
    setPrivateDataReady(false);
    setCart([]);
    setWishlist([]);
    setOrders([]);
    setCustomer(session ? customerForSession(session) : INITIAL_CUSTOMER);
    setLastPlacedOrder(null);
    setSelectedTrackingOrderId(null);
    setAppliedCoupon(null);
    setIsCartDrawerOpen(false);
    setIsWishlistDrawerOpen(false);
  };

  const applyAuthSession = (session: AuthSession) => {
    const nextUid = session?.uid || null;
    if (activePrivateUidRef.current !== nextUid) {
      privateLoadVersionRef.current += 1;
      resetPrivateState(session);
      activePrivateUidRef.current = nextUid;
    }
    setAuthSession(session);
    setFirebaseUserId(nextUid);
    setAuthStatus(session ? 'authenticated' : 'unauthenticated');
  };

  useEffect(() => startAuthSession(applyAuthSession), []);

  useEffect(() => {
    void Promise.all([
      commerceRepository.loadCatalog(INITIAL_PRODUCTS),
      commerceRepository.loadCoupons(INITIAL_COUPONS)
    ]).then(([loadedProducts, loadedCoupons]) => {
      setProducts(loadedProducts);
      setCoupons(loadedCoupons);
    });
  }, []);

  useEffect(() => {
    const loadVersion = ++privateLoadVersionRef.current;

    if (!firebaseUserId) {
      // Guest data is separate from customer records and loads only after
      // Firebase has confirmed that no customer is signed in.
      if (authStatus === 'loading') return;
      void commerceRepository.loadCustomerData(null, { cart: [], wishlist: [], orders: [] }).then((snapshot) => {
        if (privateLoadVersionRef.current !== loadVersion || activePrivateUidRef.current !== null) return;
        setCart(snapshot.cart || []);
        setWishlist(snapshot.wishlist || []);
        setPrivateDataReady(true);
      });
      return;
    }

    setPrivateDataReady(false);
    const uid = firebaseUserId;
    const sessionCustomer = authSession ? customerForSession(authSession) : INITIAL_CUSTOMER;
    void commerceRepository.loadCustomerData(uid, {
      cart: [],
      wishlist: [],
      profile: sessionCustomer,
      orders: []
    }).then((snapshot) => {
      // Ignore stale reads from a previous user after a sign-out or account switch.
      if (privateLoadVersionRef.current !== loadVersion || activePrivateUidRef.current !== uid) return;
      setCart(snapshot.cart || []);
      setWishlist(snapshot.wishlist || []);
      if (snapshot.profile) setCustomer(snapshot.profile);
      if (!snapshot.profileExists && authSession) {
        void commerceRepository.createProfile(uid, sessionCustomer);
        setCustomer(sessionCustomer);
      }
      if (authSession?.isAdmin) {
        void commerceRepository.loadAdminOrders(snapshot.orders || []).then((adminOrders) => {
          if (privateLoadVersionRef.current === loadVersion && activePrivateUidRef.current === uid) setOrders(adminOrders);
        });
      } else {
        setOrders(snapshot.orders || []);
      }
      setPrivateDataReady(true);
    });
    // Authentication ownership changes are the only reason to rehydrate private state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, firebaseUserId]);

  // Customer tracking reads the same canonical order documents that the
  // admin fulfils. Legacy subcollection records remain as read-only history.
  useEffect(() => {
    if (!firebaseUserId || authSession?.isAdmin) return;
    return commerceRepository.subscribeToCustomerOrders(firebaseUserId, (canonicalOrders) => {
      setOrders((current) => {
        const legacy = current.filter((order) => !canonicalOrders.some((item) => item.id === order.id));
        return [...canonicalOrders, ...legacy].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      });
    }, (error) => console.warn('Customer order tracking listener failed.', error));
  }, [authSession?.isAdmin, firebaseUserId]);

  const login = async (email: string, password: string, remember = true) => {
    try {
      const session = await signInWithEmail(email, password, remember);
      applyAuthSession(session);
      return session;
    } catch (error) {
      throw new Error(authErrorMessage(error));
    }
  };

  const register = async (fullName: string, email: string, phone: string, password: string) => {
    try {
      const session = await registerWithEmail(email, password);
      const profile: CustomerProfile = { ...customerForSession(session), fullName: fullName.trim(), phone: phone.trim() };
      await commerceRepository.createProfile(session.uid, profile);
      applyAuthSession(session);
      setCustomer(profile);
      return session;
    } catch (error) {
      throw new Error(authErrorMessage(error));
    }
  };

  const resetPassword = async (email: string) => {
    try { await requestPasswordReset(email); } catch (error) { throw new Error(authErrorMessage(error)); }
  };

  const logout = async () => {
    await logoutFirebaseUser();
    applyAuthSession(null);
    setActiveView('home');
  };

  const requireAuth = (view: AppView = 'account') => {
    if (authStatus === 'authenticated') {
      setActiveView(view);
      return;
    }
    setPendingProtectedView(view);
    setActiveView('login');
  };

  const completeAuthentication = () => {
    const destination = pendingProtectedView || 'account';
    setPendingProtectedView(null);
    setActiveView(destination);
  };

  // Toast Helper
  const showToast = (title: string, message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Currency & Price conversion
  const formatPrice = (inrAmount: number): string => {
    const curr = CURRENCIES[selectedCurrency] || CURRENCIES.INR;
    const converted = inrAmount * curr.rateAgainstINR;
    
    if (selectedCurrency === 'INR') {
      return `₹${Math.round(converted).toLocaleString('en-IN')}`;
    }
    return `${curr.symbol}${converted.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;
  };

  const convertPrice = (inrAmount: number): number => {
    const curr = CURRENCIES[selectedCurrency] || CURRENCIES.INR;
    return Math.round(inrAmount * curr.rateAgainstINR);
  };

  const canChangePrivateData = () => {
    if (privateDataReady) return true;
    showToast('Your selections are loading', 'Please wait a moment before updating your bag or wishlist.', 'info');
    return false;
  };

  const stillOwnsPrivateData = (uid: string | null, version: number) => activePrivateUidRef.current === uid && privateLoadVersionRef.current === version;

  const commitCart = async (nextCart: CartItem[]) => {
    const uid = firebaseUserId;
    const version = privateLoadVersionRef.current;
    try {
      await commerceRepository.saveCart(uid, nextCart);
      if (!stillOwnsPrivateData(uid, version)) return false;
      setCart(normalizeCartItems(nextCart));
      return true;
    } catch (error) {
      console.error('Unable to save shopping bag.', error);
      showToast('Unable to update shopping bag', 'Your shopping bag was not changed. Please try again.', 'error');
      return false;
    }
  };

  const commitWishlist = async (nextWishlist: string[]) => {
    const uid = firebaseUserId;
    const version = privateLoadVersionRef.current;
    try {
      await commerceRepository.saveWishlist(uid, nextWishlist);
      if (!stillOwnsPrivateData(uid, version)) return false;
      setWishlist(normalizeWishlistProductIds(nextWishlist));
      return true;
    } catch (error) {
      console.error('Unable to save wishlist.', error);
      showToast('Unable to update wishlist', 'Your wishlist was not changed. Please try again.', 'error');
      return false;
    }
  };

  // Cart operations
  const addToCart = async (
    product: Product,
    selectedColor: string,
    selectedSize: SizeOption,
    quantity: number = 1,
    isCustomTailored: boolean = false,
    customMeasurements?: CustomMeasurements,
    giftPackaging: boolean = false,
    giftNote?: string
  ): Promise<boolean> => {
    if (!canChangePrivateData()) return false;
    const newItem: CartItem = {
      cartItemId: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      product,
      selectedColor,
      selectedSize,
      quantity: Math.max(1, Math.floor(quantity)),
      isCustomTailored,
      customMeasurements: isCustomTailored ? (customMeasurements || customer.savedMeasurements) : undefined,
      tailoringFeeINR: isCustomTailored ? product.customStitchingFeeINR : 0,
      giftPackaging,
      giftNote
    };
    const lineKey = cartLineKey(newItem);
    const currentCart = normalizeCartItems(cart);
    if (currentCart.some((item) => cartLineKey(item) === lineKey) || pendingCartLineKeysRef.current.has(lineKey)) {
      showToast('Already added', `${product.title} is already in your shopping bag.`, 'info');
      return false;
    }

    pendingCartLineKeysRef.current.add(lineKey);
    try {
      const saved = await commitCart([newItem, ...currentCart]);
      if (saved) {
        showToast('Added to Shopping Bag', `${product.title} (${selectedSize}) is now in your bag.`);
        setIsCartDrawerOpen(true);
      }
      return saved;
    } finally {
      pendingCartLineKeysRef.current.delete(lineKey);
    }
  };

  const updateCartQuantity = async (cartItemId: string, quantity: number): Promise<boolean> => {
    if (!canChangePrivateData()) return false;
    if (quantity <= 0) return removeFromCart(cartItemId);
    const currentCart = normalizeCartItems(cart);
    if (!currentCart.some((item) => item.cartItemId === cartItemId)) return false;
    return commitCart(currentCart.map((item) => item.cartItemId === cartItemId ? { ...item, quantity: Math.max(1, Math.floor(quantity)) } : item));
  };

  const removeFromCart = async (cartItemId: string): Promise<boolean> => {
    if (!canChangePrivateData()) return false;
    const currentCart = normalizeCartItems(cart);
    if (!currentCart.some((item) => item.cartItemId === cartItemId)) return false;
    const removed = await commitCart(currentCart.filter((item) => item.cartItemId !== cartItemId));
    if (removed) showToast('Item Removed', 'Product removed from shopping bag.', 'info');
    return removed;
  };

  const clearCart = async (): Promise<boolean> => {
    if (!canChangePrivateData()) return false;
    if (!cart.length) {
      setAppliedCoupon(null);
      return true;
    }
    const cleared = await commitCart([]);
    if (cleared) setAppliedCoupon(null);
    return cleared;
  };

  // Wishlist
  const toggleWishlist = async (productId: string): Promise<boolean> => {
    if (!canChangePrivateData()) return false;
    if (pendingWishlistProductIdsRef.current.has(productId)) return false;
    const product = products.find((item) => item.id === productId);
    if (!product) {
      showToast('Unavailable product', 'This item is no longer available to save.', 'error');
      return false;
    }
    const currentWishlist = normalizeWishlistProductIds(wishlist);
    const isSaved = currentWishlist.includes(productId);
    pendingWishlistProductIdsRef.current.add(productId);
    try {
      const saved = await commitWishlist(isSaved ? currentWishlist.filter((id) => id !== productId) : [...currentWishlist, productId]);
      if (saved) showToast(isSaved ? 'Removed from Wishlist' : 'Saved to Wishlist', isSaved ? `${product.title} removed.` : `${product.title} added to your wishlist.`, isSaved ? 'info' : 'success');
      return saved;
    } finally {
      pendingWishlistProductIdsRef.current.delete(productId);
    }
  };

  const isInWishlist = (productId: string) => normalizeWishlistProductIds(wishlist).includes(productId);

  // Cart Totals Calculations
  const cartSubtotalINR = cart.reduce((sum, item) => sum + item.product.priceINR * item.quantity, 0);
  const cartTailoringTotalINR = cart.reduce(
    (sum, item) => sum + (item.isCustomTailored ? item.tailoringFeeINR * item.quantity : 0),
    0
  );

  let cartDiscountINR = 0;
  if (appliedCoupon && cartSubtotalINR >= appliedCoupon.minCartValueINR) {
    if (appliedCoupon.discountType === 'percentage') {
      const calcDiscount = (cartSubtotalINR * appliedCoupon.discountValue) / 100;
      cartDiscountINR = appliedCoupon.maxDiscountINR
        ? Math.min(calcDiscount, appliedCoupon.maxDiscountINR)
        : calcDiscount;
    } else {
      cartDiscountINR = appliedCoupon.discountValue;
    }
  }

  const taxableAmount = Math.max(0, cartSubtotalINR + cartTailoringTotalINR - cartDiscountINR);
  const cartTaxINR = Math.round(taxableAmount * 0.05); // 5% GST on apparel
  const cartShippingINR = cartSubtotalINR >= freeShippingThresholdINR || cart.length === 0 ? 0 : 450;
  const cartTotalINR = Math.max(0, taxableAmount + cartTaxINR + cartShippingINR);

  // Coupon handling
  const applyCoupon = (code: string): boolean => {
    const formatted = code.trim().toUpperCase();
    const found = coupons.find((c) => c.code.toUpperCase() === formatted && c.isActive);
    if (!found) {
      showToast('Invalid Coupon', 'The promo code entered does not exist or has expired.', 'error');
      return false;
    }
    if (cartSubtotalINR < found.minCartValueINR) {
      showToast(
        'Minimum Order Not Met',
        `This coupon requires a minimum cart value of ₹${found.minCartValueINR.toLocaleString('en-IN')}`,
        'error'
      );
      return false;
    }
    setAppliedCoupon(found);
    showToast('Coupon Applied!', `Promo code ${found.code} successfully applied.`);
    return true;
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    showToast('Coupon Removed', 'Promo code removed from your order.', 'info');
  };

  // Checkout & Order creation
  const createOrder = async (
    shippingAddress: ShippingAddress,
    shippingMethod: ShippingMethod,
    paymentMethod: PaymentMethod
  ): Promise<Order> => {
    const orderNum = `MB-${Math.floor(10000 + Math.random() * 90000)}`;
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: orderNum,
      createdAt: new Date().toISOString(),
      items: [...cart],
      shippingAddress,
      shippingMethod,
      shippingCostINR: shippingMethod === 'express' ? 350 : cartShippingINR,
      subtotalINR: cartSubtotalINR,
      tailoringTotalINR: cartTailoringTotalINR,
      couponDiscountINR: cartDiscountINR,
      // Keep the canonical schema stable and never send undefined to Firestore.
      couponCodeApplied: appliedCoupon?.code ?? null,
      taxGstINR: cartTaxINR,
      totalINR: cartSubtotalINR + cartTailoringTotalINR - cartDiscountINR + cartTaxINR + (shippingMethod === 'express' ? 350 : cartShippingINR),
      currency: 'INR',
      paymentMethod,
      paymentStatus: 'Pending',
      orderStatus: 'Order Placed',
      timeline: [
        {
          status: 'Order Placed',
          timestamp: 'Just now',
          description: 'Your Cash on Delivery order request has been received. Fulfilment updates will appear here when they are recorded.',
          completed: true
        }
      ]
    };

    // Firestore is the source of truth: success UI and cart clearing happen
    // only after the canonical order document is committed.
    await commerceRepository.saveOrder(firebaseUserId, newOrder);
    setOrders((prev) => [newOrder, ...prev.filter((order) => order.id !== newOrder.id)]);
    setLastPlacedOrder(newOrder);
    setSelectedTrackingOrderId(newOrder.id);
    const cartCleared = await clearCart();
    if (!cartCleared) showToast('Order placed', 'Your order was placed, but your shopping bag could not be cleared. Please refresh before shopping again.', 'info');

    // Trigger celebratory confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8B1E3F', '#C5A059', '#E6D5B8', '#DFBF77']
      });
    } catch {
      // ignore
    }

    return newOrder;
  };

  const cancelOrder = (orderId: string) => {
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId
          ? {
              ...ord,
              orderStatus: 'Cancelled',
              timeline: [
                ...ord.timeline,
                {
                  status: 'Cancelled',
                  timestamp: 'Just now',
                  description: 'Order cancelled by customer. Refund initiated to source account.',
                  completed: true
                }
              ]
            }
          : ord
      )
    );
    showToast('Order Cancelled', 'Your order was cancelled. Refund processed.', 'info');
  };

  // Customer Profile & Measurements
  const updateCustomerMeasurements = (measurements: CustomMeasurements) => {
    setCustomer((prev) => {
      const next = { ...prev, savedMeasurements: measurements };
      void commerceRepository.saveProfile(firebaseUserId, next);
      return next;
    });
    showToast('Measurements Saved', 'Your bespoke profile has been updated for 1-click tailoring.');
  };

  const currentOrder = lastPlacedOrder || orders.find((order) => order.id === selectedTrackingOrderId) || null;

  const updateCustomerProfile = (profile: Partial<CustomerProfile>) => {
    setCustomer((prev) => {
      const next = { ...prev, ...profile };
      void commerceRepository.saveProfile(firebaseUserId, next);
      return next;
    });
    showToast('Profile Updated', 'Account details have been saved.');
  };

  const addSavedAddress = (address: ShippingAddress) => {
    setCustomer((prev) => {
      const next = { ...prev, savedAddresses: [...prev.savedAddresses, address] };
      void commerceRepository.saveProfile(firebaseUserId, next);
      return next;
    });
    showToast('Address Saved', 'New delivery destination added to your address book.');
  };

  // Admin actions
  const updateOrderStatus = async (orderId: string, status: OrderStatus, trackingNumber?: string) => {
    if (!authSession?.isAdmin) {
      throw new Error('Only an authorized Firebase admin can update fulfilment status.');
    }
    const order = orders.find((item) => item.id === orderId);
    if (!order) throw new Error('Order could not be found. Refresh the admin dashboard and try again.');
    const updated = await commerceRepository.updateOrderStatus(order, status, trackingNumber);
    setOrders((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const addProduct = (product: Product) => {
    if (!authSession?.isAdmin) {
      showToast('Admin Access Required', 'Only an authorized Firebase admin can publish products.', 'error');
      return;
    }
    setProducts((prev) => [product, ...prev]);
    void commerceRepository.saveProduct(product).catch((error) => {
      console.warn(error);
      showToast('Cloud Save Pending', 'Product is visible locally but requires an authenticated Firebase admin to publish.', 'error');
    });
    showToast('Product Created', `Added ${product.title} to boutique catalog.`);
  };

  const updateProduct = (product: Product) => {
    if (!authSession?.isAdmin) {
      showToast('Admin Access Required', 'Only an authorized Firebase admin can change catalog data.', 'error');
      return;
    }
    setProducts((prev) => prev.map((p) => (p.id === product.id ? product : p)));
    void commerceRepository.saveProduct(product).catch((error) => console.warn(error));
    showToast('Product Updated', `Saved modifications to ${product.title}.`);
  };

  const deleteProduct = (productId: string) => {
    if (!authSession?.isAdmin) {
      showToast('Admin Access Required', 'Only an authorized Firebase admin can remove products.', 'error');
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    void commerceRepository.deleteProduct(productId).catch((error) => console.warn(error));
    showToast('Product Removed', 'Item removed from boutique catalog.', 'info');
  };

  const addCoupon = (coupon: Coupon) => {
    if (!authSession?.isAdmin) {
      showToast('Admin Access Required', 'Only an authorized Firebase admin can manage coupons.', 'error');
      return;
    }
    setCoupons((prev) => [coupon, ...prev]);
    void commerceRepository.saveCoupon(coupon).catch((error) => {
      console.warn(error);
      showToast('Coupon Save Failed', 'The coupon could not be published to Firebase.', 'error');
    });
    showToast('Coupon Created', `Created promo code ${coupon.code}`);
  };

  const deleteCoupon = (couponCode: string) => {
    if (!authSession?.isAdmin) {
      showToast('Admin Access Required', 'Only an authorized Firebase admin can manage coupons.', 'error');
      return;
    }
    setCoupons((prev) => prev.filter((c) => c.code !== couponCode));
    void commerceRepository.deleteCoupon(couponCode).catch((error) => {
      console.warn(error);
      showToast('Coupon Delete Failed', 'The coupon could not be removed from Firebase.', 'error');
    });
    showToast('Coupon Deleted', `Promo code ${couponCode} removed.`, 'info');
  };

  const loadProductReviews = (productId: string) => commerceRepository.loadProductReviews(productId);

  const submitReview = async (productId: string, review: ReviewItem) => {
    if (!authSession?.uid) {
      requireAuth('product-detail');
      throw new Error('Please sign in to submit a review.');
    }
    const pendingReview = { ...review, verifiedBuyer: false };
    await commerceRepository.saveReview(authSession.uid, productId, pendingReview);
    setProducts((previous) => previous.map((product) => product.id === productId ? {
      ...product,
      reviews: [pendingReview, ...(product.reviews || [])],
      reviewCount: product.reviewCount + 1
    } : product));
    showToast('Review Submitted', 'Thank you. Your review has been received for moderation.');
  };

  // Navigation router
  const navigate = (view: AppView, productId?: string, trackingOrderId?: string) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (productId) setSelectedProductId(productId);
    if (trackingOrderId) setSelectedTrackingOrderId(trackingOrderId);
    const nextPath = pathForView(view, productId, trackingOrderId);
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
    setActiveView(view);
  };

  const navigateFromUrl = () => {
    const [first, second] = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/');
    const paths: Record<string, AppView> = {
      '': 'home', shop: 'shop', cart: 'cart', wishlist: 'wishlist', checkout: 'checkout', account: 'account', admin: 'admin', about: 'about',
      tailoring: 'tailoring-guide', contact: 'contact', login: 'login', register: 'register', 'forgot-password': 'forgot-password',
      shipping: 'shipping-policy', returns: 'returns-policy', cancellation: 'cancellation-policy', privacy: 'privacy-policy', terms: 'terms-policy', cookies: 'cookie-policy', '404': 'not-found'
    };
    if (first === 'product' && second) { setSelectedProductId(decodeURIComponent(second)); setActiveView('product-detail'); return; }
    if (first === 'order-confirmation' && second) { setSelectedTrackingOrderId(decodeURIComponent(second)); setActiveView('order-confirmation'); return; }
    if (first === 'orders' && second) { setSelectedTrackingOrderId(decodeURIComponent(second)); setActiveView('order-tracking'); return; }
    if (first === 'collections' && second) {
      const category = categoryFromSlug(second);
      if (category) { setFilters((current) => ({ ...current, category, searchQuery: '' })); setActiveView('shop'); return; }
    }
    setActiveView(paths[first] || 'not-found');
  };

  const resetFilters = () => {
    setFilters(initialFilterState);
  };

  return (
    <StoreContext.Provider
      value={{
        authStatus,
        isCustomerDataReady: privateDataReady,
        authSession,
        products,
        cart,
        wishlist,
        orders,
        coupons,
        customer,
        cms,
        activeView,
        currentView: activeView,
        selectedProductId,
        selectedTrackingOrderId,
        lastPlacedOrder,
        currentOrder,
        filters,
        quickViewProduct,
        isSizeGuideOpen,
        isCartDrawerOpen,
        isWishlistDrawerOpen,
        appliedCoupon,
        toasts,
        navigate,
        navigateFromUrl,
        refreshCms,
        setQuickViewProduct,
        setIsSizeGuideOpen,
        setIsCartDrawerOpen,
        setIsWishlistDrawerOpen,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        toggleWishlist,
        isInWishlist,
        formatPrice,
        convertPrice,
        freeShippingThresholdINR,
        applyCoupon,
        removeCoupon,
        cartSubtotalINR,
        cartTailoringTotalINR,
        cartDiscountINR,
        cartTaxINR,
        cartShippingINR,
        cartTotalINR,
        createOrder,
        cancelOrder,
        updateCustomerMeasurements,
        saveMeasurements: updateCustomerMeasurements,
        updateCustomerProfile,
        addSavedAddress,
        updateOrderStatus,
        addProduct,
        updateProduct,
        deleteProduct,
        addCoupon,
        deleteCoupon,
        loadProductReviews,
        submitReview,
        setFilters,
        resetFilters,
        showToast,
        removeToast,
        requireAuth,
        completeAuthentication,
        login,
        register,
        requestPasswordReset: resetPassword,
        logout
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
