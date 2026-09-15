// Categories are data, not a code-level enumeration. This allows the catalog
// to grow or shrink through the admin category collection without a release.
export type Category = string;

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  isActive: boolean;
  sortOrder: number;
}

export type FabricType = string;
export type OccasionType = string;
export type SizeOption = string;

export interface CustomMeasurements {
  bust: number; // inches
  waist: number;
  hips: number;
  shoulder: number;
  armHole: number;
  sleeveLength: number;
  frontNeckDepth: number;
  backNeckDepth: number;
  blouseLength: number;
  lehengaLength?: number;
  specialNotes?: string;
  blouseStyle?: 'Classic Round' | 'Deep V-Neck' | 'Boat Neck' | 'Sweetheart' | 'High Collar Backless' | 'Princess Cut';
  liningPreference?: 'Pure Cotton' | 'Butter Silk' | 'Satin';
  paddingOption?: 'With Bra Pads' | 'Without Pads';
}

export interface ProductVariant {
  colorName: string;
  colorHex: string;
  images: string[];
}

export interface VariantInventoryItem {
  /** Stable, normalized key generated from the selected color and size. */
  key: string;
  colorName: string;
  size: SizeOption;
  stock: number;
}

export interface ReviewItem {
  id: string;
  userName: string;
  userCity: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  verifiedBuyer: boolean;
  image?: string;
}

export interface Product {
  id: string;
  title: string;
  subtitle: string;
  sku: string;
  category: Category;
  fabric: FabricType;
  occasion: OccasionType;
  priceINR: number;
  originalPriceINR?: number;
  discountPercentage?: number;
  rating: number;
  reviewCount: number;
  images: string[];
  colors: ProductVariant[];
  availableSizes: SizeOption[];
  /** When present, this is the authoritative stock for each selectable combination. */
  variantInventory?: VariantInventoryItem[];
  stockCount: number;
  isReadyToShip: boolean;
  isBestseller?: boolean;
  isNewArrival?: boolean;
  isHandloomCertified?: boolean;
  zariType?: string;
  specifications?: Array<{ label: string; value: string }>;
  description: string;
  craftDetails: string;
  careInstructions: string;
  includesBlousePiece?: boolean;
  blouseLength?: string;
  sareeLength?: string;
  weightGrams?: number;
  customStitchingAvailable: boolean;
  customStitchingFeeINR: number;
  tags: string[];
  reviews?: ReviewItem[];
  /** Publication is controlled by an admin-only Firestore record. */
  isActive?: boolean;
}

export interface Banner {
  id: string;
  image: string;
  /** Optional 4:5 asset. `image` remains the desktop and legacy fallback. */
  mobileImage?: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaDestination: string;
  isActive: boolean;
  displayOrder: number;
}

export interface SiteContent {
  homeEyebrow: string;
  collectionHeading: string;
  collectionDescription: string;
  newArrivalsHeading: string;
  newArrivalsDescription: string;
  footerDescription: string;
}

export interface AboutContent {
  businessName: string;
  heading: string;
  introduction: string;
  brandStory: string;
  philosophy: string;
  additionalInformation: string;
  image?: string;
}

export interface ContactInformation {
  businessName: string;
  phone: string;
  email: string;
  addressLines: string[];
  mapsUrl: string;
  whatsappUrl: string;
  instagramUrl?: string;
  businessHours?: string;
}

export type ContactMessageStatus = 'new' | 'read' | 'replied';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  status: ContactMessageStatus;
  source: 'contact_form';
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CartItem {
  cartItemId: string;
  product: Product;
  selectedColor: string;
  selectedSize: SizeOption;
  quantity: number;
  isCustomTailored: boolean;
  customMeasurements?: CustomMeasurements;
  tailoringFeeINR: number;
  giftPackaging?: boolean;
  giftNote?: string;
}

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  rateAgainstINR: number;
  label: string;
}

export interface ShippingAddress {
  id?: string;
  fullName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault?: boolean;
}

export interface OrderCancellation { reason?: string; cancelledAt: string; cancelledBy: string; }

export type ShippingMethod = 'standard' | 'express';

export type CheckoutChargeType = 'fixed' | 'percentage';

export interface CheckoutCharge {
  id: string;
  name: string;
  type: CheckoutChargeType;
  value: number;
  enabled: boolean;
  sortOrder: number;
}

export interface AppliedCheckoutCharge extends CheckoutCharge {
  amountINR: number;
}

// Online payment methods are intentionally not enabled in the current checkout.
export type PaymentMethod = 'cod';

export type OrderStatus = 
  | 'Order Placed'
  | 'Artisan Tailoring'
  | 'Confirmed'
  | 'Processing'
  | 'Ready for Dispatch'
  | 'Quality Inspection'
  | 'Dispatched'
  | 'In Transit'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export interface OrderTimelineEvent {
  status: OrderStatus;
  timestamp: string;
  description: string;
  location?: string;
  completed: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  items: CartItem[];
  shippingAddress: ShippingAddress;
  shippingMethod: ShippingMethod;
  shippingCostINR: number;
  subtotalINR: number;
  tailoringTotalINR: number;
  couponDiscountINR: number;
  couponCodeApplied?: string | null;
  taxGstINR: number;
  /** Exact charge configuration and calculated amount captured at checkout. */
  charges?: AppliedCheckoutCharge[];
  totalINR: number;
  currency: CurrencyCode;
  paymentMethod: PaymentMethod;
  paymentStatus: 'Paid' | 'Pending' | 'Failed';
  orderStatus: OrderStatus;
  /** Populated only after a real dispatch has been arranged. */
  trackingNumber?: string;
  courierPartner?: 'BlueDart Luxury Express' | 'Delhivery Air' | 'DHL Express International';
  /** An estimate is optional until the boutique confirms fulfilment. */
  estimatedDeliveryDate?: string;
  timeline: OrderTimelineEvent[];
  cancellation?: OrderCancellation;
}

export interface Coupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number; // % or INR
  minCartValueINR: number;
  maxDiscountINR?: number;
  description: string;
  isActive: boolean;
  expiryDate: string;
}

export interface CustomerProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  tier: 'Silver Patron' | 'Gold Aristocrat' | 'Royal Heirloom VIP';
  savedAddresses: ShippingAddress[];
  savedMeasurements?: CustomMeasurements;
  totalSpendINR: number;
  ordersCount: number;
}

export type AppView = 
  | 'home'
  | 'shop'
  | 'product-detail'
  | 'cart'
  | 'wishlist'
  | 'checkout'
  | 'order-confirmation'
  | 'order-tracking'
  | 'account'
  | 'admin'
  | 'about'
  | 'tailoring-guide'
  | 'contact'
  | 'shipping-policy'
  | 'returns-policy'
  | 'cancellation-policy'
  | 'privacy-policy'
  | 'terms-policy'
  | 'cookie-policy'
  | 'not-found'
  | 'login'
  | 'register'
  | 'forgot-password';

export interface FilterState {
  category: Category;
  fabrics: FabricType[];
  occasions: OccasionType[];
  sizes: SizeOption[];
  colors: string[];
  minPriceINR: number;
  maxPriceINR: number;
  readyToShipOnly: boolean;
  handloomOnly: boolean;
  searchQuery: string;
  sortBy: 'featured' | 'newest' | 'price-low-high' | 'price-high-low' | 'rating' | 'name-a-z';
}
