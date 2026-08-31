export const whatsappChatUrl = (baseUrl: string, message: string): string | null => {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' || !['wa.me', 'api.whatsapp.com', 'www.whatsapp.com'].includes(url.hostname)) return null;
    url.searchParams.set('text', message);
    return url.toString();
  } catch {
    return null;
  }
};

export const whatsappPhoneUrl = (phone: string, message: string): string | null => {
  const number = phone.replace(/\D/g, '');
  if (number.length < 11 || number.length > 15) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
};
