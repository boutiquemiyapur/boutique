import React, { useState } from 'react';
import { CheckCircle2, Mail, MapPin, Phone, Send } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { contactMessageRepository } from '../../services/contactMessageRepository';

const emailPattern = /^\S+@\S+\.\S+$/;

export const ContactConciergePage: React.FC = () => {
  const { showToast, cms } = useStore();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); const [error, setError] = useState(''); const [wasSent, setWasSent] = useState(false);
  const contact = cms.contact;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    const cleanName = name.trim(); const cleanEmail = email.trim().toLowerCase(); const cleanPhone = phone.trim(); const cleanMessage = message.trim();
    if (cleanName.length < 2 || cleanName.length > 80 || !emailPattern.test(cleanEmail) || cleanEmail.length > 160 || cleanMessage.length < 10 || cleanMessage.length > 2000 || cleanPhone.length > 30) {
      setError('Please enter your name, a valid email address, and a message between 10 and 2,000 characters.'); return;
    }
    setError(''); setWasSent(false); setIsSubmitting(true);
    try {
      await contactMessageRepository.submit({ name: cleanName, email: cleanEmail, message: cleanMessage, ...(cleanPhone ? { phone: cleanPhone } : {}) });
      setName(''); setEmail(''); setPhone(''); setMessage(''); setWasSent(true);
      showToast('Message sent successfully', 'Thank you for contacting AB Collection. Your enquiry has been received.');
    } catch {
      setError('Something went wrong while sending your message. Please try again or contact us directly on WhatsApp.');
    } finally { setIsSubmitting(false); }
  };
  return <main className="min-h-screen bg-[#fffdf9] px-4 py-12 sm:px-7 sm:py-16"><div className="mx-auto max-w-6xl"><header className="max-w-2xl"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-stone-500">Contact {contact.businessName}</p><h1 className="mt-3 font-serif text-4xl sm:text-6xl">We’d love to hear from you.</h1><p className="mt-4 text-sm leading-6 text-stone-600">Have a question about our collection, availability, sizing, or your next occasion? Send us a message and our team will get back to you.</p></header><div className="mt-10 grid gap-8 lg:grid-cols-[.9fr_1.1fr]"><aside className="border border-[#ddd7cf] bg-[#f7f5f2] p-6 sm:p-8"><h2 className="font-serif text-2xl">Visit {contact.businessName}</h2><div className="mt-6 space-y-5 text-sm text-stone-600"><a href={contact.mapsUrl} target="_blank" rel="noopener noreferrer" className="flex gap-3 hover:text-stone-950"><MapPin className="mt-0.5 h-5 w-5 shrink-0" /><span>{contact.addressLines.map((line) => <React.Fragment key={line}>{line}<br /></React.Fragment>)}</span></a><a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-stone-950"><Phone className="h-5 w-5" />WhatsApp: {contact.phone}</a><a href={`mailto:${contact.email}`} className="flex items-center gap-3 hover:text-stone-950"><Mail className="h-5 w-5" />{contact.email}</a></div><a href={contact.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex border border-[#2c2926] px-5 py-3 text-[11px] font-semibold uppercase tracking-[.12em] hover:bg-[#2c2926] hover:text-white">Open in Google Maps</a>{contact.businessHours && <p className="mt-7 border-t border-[#ddd7cf] pt-5 text-xs leading-5 text-stone-500">{contact.businessHours}</p>}</aside><section className="border border-[#ddd7cf] bg-white p-6 sm:p-8"><h2 className="font-serif text-2xl">Send a message</h2><p className="mt-2 text-sm text-stone-600">Your enquiry is sent securely to AB Collection.</p>{wasSent && <p role="status" className="mt-5 flex items-center gap-2 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="h-5 w-5 shrink-0" />Thank you for contacting AB Collection. Your enquiry has been received.</p>}{error && <p role="alert" className="mt-5 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}<form onSubmit={submit} className="mt-6 grid gap-4"><label className="text-xs text-stone-600">Full name<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} autoComplete="name" className="mt-1.5 w-full border border-[#cfc6bd] p-3 text-sm text-stone-900" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-stone-600">Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required maxLength={160} autoComplete="email" className="mt-1.5 w-full border border-[#cfc6bd] p-3 text-sm text-stone-900" /></label><label className="text-xs text-stone-600">Phone <span className="text-stone-400">(optional, with country code)</span><input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} inputMode="tel" autoComplete="tel" placeholder="+91 90144 61462" className="mt-1.5 w-full border border-[#cfc6bd] p-3 text-sm text-stone-900" /></label></div><label className="text-xs text-stone-600">How can we help?<textarea value={message} onChange={(event) => setMessage(event.target.value)} required minLength={10} maxLength={2000} rows={5} className="mt-1.5 w-full border border-[#cfc6bd] p-3 text-sm text-stone-900" /><span className="mt-1 block text-right text-[10px] text-stone-400">{message.length}/2000</span></label><button disabled={isSubmitting} className="inline-flex w-fit items-center gap-2 bg-[#2c2926] px-5 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-white disabled:cursor-wait disabled:opacity-60"><Send className="h-4 w-4" />{isSubmitting ? 'Sending…' : 'Send message'}</button></form></section></div></div></main>;
};
