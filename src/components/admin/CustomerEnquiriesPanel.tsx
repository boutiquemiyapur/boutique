import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Mail, MessageCircle, Search, Trash2, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { contactMessageRepository } from '../../services/contactMessageRepository';
import { ContactMessage, ContactMessageStatus } from '../../types';
import { whatsappPhoneUrl } from '../../utils/whatsapp';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

const statusText: Record<ContactMessageStatus, string> = { new: 'New', read: 'Read', replied: 'Replied' };
const statusClass: Record<ContactMessageStatus, string> = { new: 'bg-amber-100 text-amber-900', read: 'bg-sky-100 text-sky-900', replied: 'bg-emerald-100 text-emerald-900' };
const displayDate = (date: Date | null) => date ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'Processing…';

export const CustomerEnquiriesPanel: React.FC = () => {
  const { showToast } = useStore();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | ContactMessageStatus>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setMessages(await contactMessageRepository.loadForAdmin()); }
    catch { setError('Customer enquiries could not be loaded. Check your Firebase admin access and connection.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => messages.filter((message) => {
    const matchesQuery = `${message.name} ${message.email}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (filter === 'all' || message.status === filter);
  }), [messages, query, filter]);
  const updateStatus = async (message: ContactMessage, status: ContactMessageStatus) => {
    try {
      await contactMessageRepository.updateStatus(message.id, status);
      const next = { ...message, status };
      setMessages((items) => items.map((item) => item.id === message.id ? next : item));
      setSelected((current) => current?.id === message.id ? next : current);
      showToast('Enquiry updated', `Marked as ${statusText[status].toLowerCase()}.`);
    } catch { showToast('Update failed', 'The enquiry status could not be changed.', 'error'); }
  };
  const remove = async (message: ContactMessage) => {
    if (!window.confirm('Delete this customer enquiry? This cannot be undone.')) return;
    try { await contactMessageRepository.delete(message.id); setMessages((items) => items.filter((item) => item.id !== message.id)); setSelected(null); showToast('Enquiry deleted', 'The customer enquiry was deleted.', 'info'); }
    catch { showToast('Delete failed', 'The enquiry could not be deleted.', 'error'); }
  };
  return <section className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative max-w-md flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-stone-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer name or email" className="w-full border border-[#d8d1c9] bg-white py-2.5 pl-9 pr-3 text-xs" /></div><label className="text-xs text-stone-600">Status <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="ml-2 border border-stone-300 bg-white p-2"><option value="all">All</option><option value="new">New</option><option value="read">Read</option><option value="replied">Replied</option></select></label></div>{loading && <div className="border border-[#ddd7cf] bg-white p-6 text-sm text-stone-500">Loading customer enquiries…</div>}{error && <div role="alert" className="border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}<button onClick={() => void load()} className="ml-3 underline">Try again</button></div>}{!loading && !error && !visible.length && <div className="border border-[#ddd7cf] bg-white p-8"><h2 className="font-serif text-2xl">You’re all caught up.</h2><p className="mt-2 text-sm text-stone-500">Customer enquiries will appear here when visitors contact AB Collection.</p></div>}{!loading && !error && visible.length > 0 && <div className="overflow-x-auto border border-[#ddd7cf] bg-white"><div className="min-w-[760px] divide-y divide-stone-100">{visible.map((message) => <article key={message.id} className="grid grid-cols-[1.2fr_1fr_1.8fr_.9fr_auto] items-center gap-4 p-4 text-xs"><div><b>{message.name}</b><p className="mt-1 text-stone-500">{message.email}</p></div><span className={`w-fit px-2 py-1 text-[10px] font-semibold uppercase tracking-[.1em] ${statusClass[message.status]}`}>{statusText[message.status]}</span><p className="line-clamp-2 text-stone-600">{message.message}</p><span className="text-stone-500">{displayDate(message.createdAt)}</span><button onClick={() => setSelected(message)} className="border border-stone-300 px-3 py-2 font-semibold hover:bg-stone-100">View</button></article>)}</div></div>}{selected && <EnquiryDetail message={selected} onClose={() => setSelected(null)} onStatus={updateStatus} onDelete={remove} />}</section>;
};

const EnquiryDetail = ({ message, onClose, onStatus, onDelete }: { message: ContactMessage; onClose: () => void; onStatus: (message: ContactMessage, status: ContactMessageStatus) => Promise<void>; onDelete: (message: ContactMessage) => Promise<void> }) => {
  useBodyScrollLock(true);
  const mailto = `mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent('AB Collection — Re: Your Enquiry')}&body=${encodeURIComponent(`Hello ${message.name},\n\nThank you for contacting AB Collection.\n\nRegards,\nAB Collection\nMiyapur, Hyderabad`)}`;
  const whatsapp = message.phone ? whatsappPhoneUrl(message.phone, `Hello ${message.name},\n\nThank you for contacting AB Collection.\n\nRegarding your enquiry:\n“${message.message.slice(0, 280)}”\n\nRegards,\nAB Collection`) : null;
  return <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/45 p-4"><div role="dialog" aria-modal="true" aria-label="Customer enquiry details" className="mx-auto my-8 w-full max-w-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between border-b border-stone-200 pb-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-stone-500">Customer enquiry</p><h2 className="mt-1 font-serif text-2xl">{message.name}</h2></div><button onClick={onClose} aria-label="Close enquiry details" className="p-1"><X /></button></div><dl className="mt-5 grid gap-4 text-sm"><div><dt className="text-xs text-stone-500">Email</dt><dd className="mt-1">{message.email}</dd></div>{message.phone && <div><dt className="text-xs text-stone-500">Phone</dt><dd className="mt-1">{message.phone}</dd></div>}<div><dt className="text-xs text-stone-500">Submitted</dt><dd className="mt-1">{displayDate(message.createdAt)}</dd></div><div><dt className="text-xs text-stone-500">Message</dt><dd className="mt-1 whitespace-pre-wrap leading-6 text-stone-700">{message.message}</dd></div><div><dt className="text-xs text-stone-500">Current status</dt><dd className={`mt-1 inline-block px-2 py-1 text-[10px] font-semibold uppercase tracking-[.1em] ${statusClass[message.status]}`}>{statusText[message.status]}</dd></div></dl><div className="mt-7 flex flex-wrap gap-3"><button onClick={() => void onStatus(message, 'read')} disabled={message.status === 'read'} className="border border-stone-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Mark as read</button><button onClick={() => void onStatus(message, 'replied')} disabled={message.status === 'replied'} className="border border-stone-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Mark as replied</button><a href={mailto} className="inline-flex items-center gap-2 border border-stone-300 px-3 py-2 text-xs font-semibold hover:bg-stone-100"><Mail className="h-4 w-4" />Reply via email</a>{whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border border-stone-300 px-3 py-2 text-xs font-semibold hover:bg-stone-100"><MessageCircle className="h-4 w-4" />Reply via WhatsApp<ExternalLink className="h-3 w-3" /></a> : <span className="px-3 py-2 text-xs text-stone-400">No WhatsApp number supplied</span>}<button onClick={() => void onDelete(message)} className="ml-auto inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" />Delete</button></div></div></div>;
};
