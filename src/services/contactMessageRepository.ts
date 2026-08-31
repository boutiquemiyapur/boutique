import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { ContactMessage, ContactMessageStatus } from '../types';

export interface ContactSubmission {
  name: string;
  email: string;
  message: string;
  phone?: string;
}

const messages = () => collection(firestore!, 'contactMessages');
const asDate = (value: unknown): Date | null => value instanceof Timestamp ? value.toDate() : null;
const asContactMessage = (id: string, data: Record<string, unknown>): ContactMessage => ({
  id,
  name: String(data.name || ''),
  email: String(data.email || ''),
  ...(typeof data.phone === 'string' && data.phone ? { phone: data.phone } : {}),
  message: String(data.message || ''),
  status: data.status === 'read' || data.status === 'replied' ? data.status : 'new',
  source: 'contact_form',
  createdAt: asDate(data.createdAt),
  updatedAt: asDate(data.updatedAt)
});

export const contactMessageRepository = {
  async submit(submission: ContactSubmission) {
    if (!firestore) throw new Error('Contact messaging is unavailable right now.');
    await addDoc(messages(), {
      name: submission.name,
      email: submission.email,
      message: submission.message,
      ...(submission.phone ? { phone: submission.phone } : {}),
      status: 'new',
      source: 'contact_form',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  async loadForAdmin(): Promise<ContactMessage[]> {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    const snapshot = await getDocs(query(messages(), orderBy('createdAt', 'desc'), limit(100)));
    return snapshot.docs.map((item) => asContactMessage(item.id, item.data()));
  },

  async updateStatus(id: string, status: ContactMessageStatus) {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    await updateDoc(doc(firestore, 'contactMessages', id), { status, updatedAt: serverTimestamp() });
  },

  async delete(id: string) {
    if (!firestore) throw new Error('Firebase is not configured for this deployment.');
    await deleteDoc(doc(firestore, 'contactMessages', id));
  }
};
