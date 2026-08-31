import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { whatsappChatUrl } from '../../utils/whatsapp';

export const FloatingWhatsAppButton: React.FC = () => {
  const { cms } = useStore();
  const href = whatsappChatUrl(cms.contact.whatsappUrl, 'Hello AB Collection, I would like to know more about your collection.');
  if (!href) return null;
  return <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Chat with AB Collection on WhatsApp" className="fixed bottom-5 right-5 z-40 grid h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 hover:bg-[#1fb85a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25D366] sm:bottom-7 sm:right-7" title="Chat on WhatsApp"><MessageCircle className="h-6 w-6" aria-hidden="true" /></a>;
};
