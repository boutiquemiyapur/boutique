const logoSrc = 'https://res.cloudinary.com/fflrcufi/image/upload/v1788420352/abcollectionslogo.png';

/**
 * Client-approved public business details. Keep this file (and the Settings
 * record in Firestore once configured) as the single source of truth for
 * storefront copy. The supplied address deliberately retains Miyapur because
 * it is the shop location, not the former brand name.
 */
export const BRAND = {
  name: 'AB Collection',
  displayName: 'AB COLLECTION',
  contactPerson: 'Yesodha Vimala',
  phone: '9014461462',
  email: 'boutiquemiyapur@gmail.com',
  addressLines: [
    'AB Collection / Aadya Boutique',
    'Suvarna Heights',
    '1049/1, Matrusri Nagar',
    'Miyapur, Hyderabad – 500049',
    'India'
  ],
  mapsUrl: 'https://maps.app.goo.gl/YWUASJtbLWpz5DiaA',
  whatsappUrl: 'https://wa.me/919014461462',
  logoSrc
} as const;

export const BrandMark = ({ className = '', inverse = false }: { className?: string; inverse?: boolean }) => {
  if (BRAND.logoSrc) {
    return <img src={BRAND.logoSrc} alt={BRAND.name} className={`h-11 w-11 shrink-0 object-contain sm:h-12 sm:w-12 ${className}`} />;
  }
  return <span className={`font-serif font-semibold tracking-[.14em] ${inverse ? 'text-white' : 'text-[#2c2926]'} ${className}`}>{BRAND.displayName}</span>;
};
