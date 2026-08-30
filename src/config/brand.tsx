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
  email: 'Aadyaboutique2023@gamil.com',
  addressLines: [
    'AB Collection / Aadya Boutique',
    'Suvarna Heights',
    '1049/1, Matrusri Nagar',
    'Miyapur, Hyderabad – 500049',
    'India'
  ],
  mapsUrl: 'https://maps.app.goo.gl/aKAeSGga8zbM1y7H7',
  whatsappUrl: 'https://wa.me/919014461462',
  // The client logo file was not included in this project hand-off. Set this
  // to its public path (for example, /ab-collection-logo.svg) when received.
  logoSrc: ''
} as const;

export const BrandMark = ({ className = '', inverse = false }: { className?: string; inverse?: boolean }) => {
  if (BRAND.logoSrc) {
    return <img src={BRAND.logoSrc} alt={BRAND.name} className={`h-auto max-h-10 w-auto object-contain ${className}`} />;
  }
  return <span className={`font-serif font-semibold tracking-[.14em] ${inverse ? 'text-white' : 'text-[#2c2926]'} ${className}`}>{BRAND.displayName}</span>;
};
