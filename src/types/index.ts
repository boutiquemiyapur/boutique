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

export type FabricType = 
  | 'Pure Mulberry Silk'
  | 'Kanjeevaram Silk'
  | 'Banarasi Katan Silk'
  | 'Organza Silk'
  | 'Raw Silk'
  | 'Chanderi'
  | 'Georgette'
  | 'Velvet'
  | 'Tussar Silk'
  | 'Chikankari Cotton';

export type OccasionType = 
  | 'Bridal Trousseau'
  | 'Wedding Guest'
  | 'Festive & Puja'
  | 'Reception & Party'
  | 'Sangeet & Mehendi'
  | 'Cocktail & Evening';

export type SizeOption = 'Unstitched' | 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'Custom Made-to-Measure';

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
  stockCount: number;
  isReadyToShip: boolean;
  isBestseller?: boolean;
  isNewArrival?: boolean;
  isHandloomCertified?: boolean;
  zariType?: 'Pure Gold Zari' | 'Tested Zari' | 'Silver Zari' | 'Antique Zari' | 'Thread Embroidery';
  description: string;
  craftDetails: string;
  careInstructions: string;
  includesBlousePiece: boolean;
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

export type ShippingMethod = 'standard' | 'express';

// Online payment methods are intentionally not enabled in the current checkout.
export type PaymentMethod = 'cod';

export type OrderStatus = 
  | 'Order Placed'
  | 'Artisan Tailoring'
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
  couponCodeApplied?: string;
  taxGstINR: number;
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
