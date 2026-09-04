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
  title: 'AB Collection by Aadya',
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

export const BrandMark = ({ className = '', inverse = false }: { className?: string; inverse?: boolean }) => (
  <span className={`inline-flex min-w-0 max-w-full items-center gap-2.5 leading-none sm:gap-3 lg:gap-3.5 ${className}`}>
    <img
      src={BRAND.logoSrc}
      alt=""
      className="block h-16 w-auto shrink-0 object-contain object-center sm:h-[4.5rem] lg:h-[5.5rem] xl:h-24"
    />
    <span className={`min-w-0 text-left font-serif font-semibold leading-[1.2] tracking-[-0.01em] text-sm whitespace-normal sm:whitespace-nowrap sm:text-[17px] lg:text-[21px] xl:text-[23px] ${inverse ? 'text-white' : 'text-[#2c2926]'}`}>
      {BRAND.title}
    </span>
  </span>
);
