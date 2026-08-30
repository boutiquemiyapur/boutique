import { Coupon, CurrencyConfig, CustomerProfile, Order, ShippingAddress } from '../types';

export const CURRENCIES: Record<string, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', rateAgainstINR: 1, label: 'Indian Rupee (INR)' },
  USD: { code: 'USD', symbol: '$', rateAgainstINR: 0.012, label: 'US Dollar (USD)' },
  EUR: { code: 'EUR', symbol: '€', rateAgainstINR: 0.011, label: 'Euro (EUR)' },
  GBP: { code: 'GBP', symbol: '£', rateAgainstINR: 0.0095, label: 'British Pound (GBP)' },
  AED: { code: 'AED', symbol: 'AED ', rateAgainstINR: 0.044, label: 'UAE Dirham (AED)' }
};

export const INITIAL_COUPONS: Coupon[] = [
  {
    code: 'WELCOME10',
    discountType: 'percentage',
    discountValue: 10,
    minCartValueINR: 5000,
    maxDiscountINR: 3000,
    description: '10% Off on your First Luxury Purchase (Min ₹5,000)',
    isActive: true,
    expiryDate: '2026-12-31'
  },
  {
    code: 'ROYALFESTIVE',
    discountType: 'percentage',
    discountValue: 15,
    minCartValueINR: 25000,
    maxDiscountINR: 7500,
    description: '15% Off on Bridal Trousseau & Heritage Silks (Min ₹25,000)',
    isActive: true,
    expiryDate: '2026-11-30'
  },
  {
    code: 'FESTIVE500',
    discountType: 'fixed',
    discountValue: 500,
    minCartValueINR: 3000,
    description: 'Flat ₹500 Off on any Handloom Order',
    isActive: true,
    expiryDate: '2026-12-31'
  }
];

export const INITIAL_CUSTOMER: CustomerProfile = {
  id: 'cust-991',
  fullName: 'Sample Customer',
  email: 'pooja.reddy@example.com',
  phone: '+91 98490 12345',
  tier: 'Royal Heirloom VIP',
  savedAddresses: [
    {
      fullName: 'Sample Customer',
      phone: '+91 98490 12345',
      email: 'pooja.reddy@example.com',
      addressLine1: 'Villa 42, Palm Meadows, Jubilee Hills Road No. 36',
      addressLine2: 'Near Peddamma Temple',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500033',
      country: 'India',
      isDefault: true
    }
  ],
  savedMeasurements: {
    bust: 36,
    waist: 29,
    hips: 39,
    shoulder: 14.5,
    armHole: 16.5,
    sleeveLength: 11,
    frontNeckDepth: 7,
    backNeckDepth: 9.5,
    blouseLength: 14.5,
    lehengaLength: 42,
    blouseStyle: 'Princess Cut',
    liningPreference: 'Butter Silk',
    paddingOption: 'With Bra Pads',
    specialNotes: 'Require 2-inch inner margin for future alterations.'
  },
  totalSpendINR: 132000,
  ordersCount: 4
};

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-881',
    orderNumber: 'MB-89241',
    createdAt: '2026-08-25T14:30:00Z',
    items: [
      {
        cartItemId: 'item-1',
        product: {
          id: 'mb-kanjeevaram-01',
          title: 'Maharani Crimson Gold Pure Kanjeevaram Silk Saree',
          subtitle: 'Woven with 24K Pure Gold Tested Zari & Korvai Korai Temple Border',
          sku: 'MB-KJ-7701',
          category: 'Kanjeevaram Silks',
          fabric: 'Kanjeevaram Silk',
          occasion: 'Bridal Trousseau',
          priceINR: 42500,
          originalPriceINR: 52000,
          discountPercentage: 18,
          rating: 4.9,
          reviewCount: 48,
          images: [
            'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85'
          ],
          colors: [
            {
              colorName: 'Royal Crimson & Gold',
              colorHex: '#8B1E3F',
              images: ['https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85']
            }
          ],
          availableSizes: ['Custom Made-to-Measure'],
          stockCount: 4,
          isReadyToShip: true,
          description: 'Authentic Korvai handloom Kanjeevaram silk saree.',
          craftDetails: 'Handloom certified.',
          careInstructions: 'Dry clean only.',
          includesBlousePiece: true,
          customStitchingAvailable: true,
          customStitchingFeeINR: 1800,
          tags: ['Bridal', 'Kanjeevaram']
        },
        selectedColor: 'Royal Crimson & Gold',
        selectedSize: 'Custom Made-to-Measure',
        quantity: 1,
        isCustomTailored: true,
        tailoringFeeINR: 1800,
        customMeasurements: {
          bust: 36,
          waist: 29,
          hips: 39,
          shoulder: 14.5,
          armHole: 16.5,
          sleeveLength: 11,
          frontNeckDepth: 7,
          backNeckDepth: 9.5,
          blouseLength: 14.5,
          blouseStyle: 'Princess Cut',
          liningPreference: 'Butter Silk',
          paddingOption: 'With Bra Pads'
        }
      }
    ],
    shippingAddress: {
      fullName: 'Sample Customer',
      phone: '+91 98490 12345',
      email: 'pooja.reddy@example.com',
      addressLine1: 'Villa 42, Palm Meadows, Jubilee Hills Road No. 36',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500033',
      country: 'India'
    },
    shippingMethod: 'express',
    shippingCostINR: 0,
    subtotalINR: 42500,
    tailoringTotalINR: 1800,
    couponDiscountINR: 4250,
    couponCodeApplied: 'WELCOME10',
    taxGstINR: 2002,
    totalINR: 42052,
    currency: 'INR',
    paymentMethod: 'cod',
    paymentStatus: 'Pending',
    orderStatus: 'In Transit',
    trackingNumber: 'BLUEDART-HYD-9812903',
    courierPartner: 'BlueDart Luxury Express',
    estimatedDeliveryDate: '2026-08-30',
    timeline: [
      {
        status: 'Order Placed',
        timestamp: '25 Aug 2026, 02:30 PM',
        description: 'Cash on Delivery order recorded. Fulfilment updates will appear when available.',
        location: 'Hyderabad Studio',
        completed: true
      },
      {
        status: 'Artisan Tailoring',
        timestamp: '26 Aug 2026, 11:00 AM',
        description: 'Blouse handcrafted to custom measurements by Master Tailor.',
        location: 'Miyapur Atelier, Hyderabad',
        completed: true
      },
      {
        status: 'Quality Inspection',
        timestamp: '27 Aug 2026, 04:15 PM',
        description: 'Silk Mark verification & zari quality audit passed.',
        location: 'Quality Hub, Miyapur',
        completed: true
      },
      {
        status: 'Dispatched',
        timestamp: '28 Aug 2026, 09:30 AM',
        description: 'Package handed over to BlueDart Luxury Air Express.',
        location: 'Shamshabad Air Cargo Hub',
        completed: true
      },
      {
        status: 'In Transit',
        timestamp: '28 Aug 2026, 06:45 PM',
        description: 'Shipment arrived at Jubilee Hills Local Delivery Center.',
        location: 'Jubilee Hills Hub, Hyderabad',
        completed: true
      },
      {
        status: 'Out for Delivery',
        timestamp: 'Expected 29 Aug 2026',
        description: 'Courier executive assigned for scheduled white-glove doorstep delivery.',
        location: 'Jubilee Hills Delivery Station',
        completed: false
      },
      {
        status: 'Delivered',
        timestamp: 'Expected 29 Aug 2026, 02:00 PM',
        description: 'Delivery confirmation with OTP verification.',
        completed: false
      }
    ]
  }
];

export const SIZE_CHART_DATA = [
  { size: 'XS', bustInches: '32', waistInches: '26', hipsInches: '35', shoulderInches: '13.5' },
  { size: 'S', bustInches: '34', waistInches: '28', hipsInches: '37', shoulderInches: '14.0' },
  { size: 'M', bustInches: '36', waistInches: '30', hipsInches: '39', shoulderInches: '14.5' },
  { size: 'L', bustInches: '38', waistInches: '32', hipsInches: '41', shoulderInches: '15.0' },
  { size: 'XL', bustInches: '40', waistInches: '34', hipsInches: '43', shoulderInches: '15.5' },
  { size: 'XXL', bustInches: '42', waistInches: '36', hipsInches: '45', shoulderInches: '16.0' }
];
