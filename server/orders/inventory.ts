import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { hasVariantInventory, productFromDocument, variantKey } from '../../src/utils/productData.js';
import { sanitizeFirestoreData } from '../../src/utils/firestoreData.js';
import { requireCondition } from '../payments/errors.js';

export type Reservation = { customerId: string; orderId: string; state: 'RESERVED' | 'CONSUMED' | 'RELEASED' | 'RESTORED'; expiresAt: number; items: { productId: string; color: string; size: string; quantity: number; variantInventory: boolean }[]; generation?: number };
// Read/validate the entire ledger-backed inventory set before any write.
export async function restoration(db: Firestore, tx: Transaction, reservation: Reservation, now: number) {
  requireCondition(Array.isArray(reservation.items) && reservation.items.length > 0 && reservation.items.length <= 30
    && reservation.items.every(l => l && typeof l.productId === 'string' && typeof l.color === 'string' && typeof l.size === 'string' && typeof l.variantInventory === 'boolean' && Number.isSafeInteger(l.quantity) && l.quantity > 0), 'RESERVATION_INVENTORY_CHANGED', 409);
  const ids = [...new Set(reservation.items.map(l => l.productId))].sort();
  const snapshots = await tx.getAll(...ids.map(id => db.collection('products').doc(id)));
  return snapshots.map(s => {
    const raw = s.data(); requireCondition(raw, 'RESERVATION_INVENTORY_CHANGED', 409);
    const variants = raw.data?.variantInventory;
    const keys = new Set<string>();
    requireCondition(Number.isSafeInteger(raw.data?.stockCount) && raw.data.stockCount >= 0 && (variants == null || (Array.isArray(variants) && variants.length <= 300 && variants.every((v: any) => v && typeof v.colorName === 'string' && typeof v.size === 'string' && v.key === variantKey(v.colorName, v.size) && !keys.has(v.key) && !!keys.add(v.key) && Number.isSafeInteger(v.stock) && v.stock >= 0) && variants.reduce((n: number, v: any) => n + v.stock, 0) === raw.data.stockCount)), 'RESERVATION_INVENTORY_CHANGED', 409);
    const p = productFromDocument(s.id, { ...raw, status: 'active' }); requireCondition(p, 'RESERVATION_INVENTORY_CHANGED', 409);
    const lines = reservation.items.filter(l => l.productId === p.id);
    requireCondition(lines.every(l => hasVariantInventory(p) === l.variantInventory), 'RESERVATION_INVENTORY_CHANGED', 409);
    if (hasVariantInventory(p)) {
      requireCondition(lines.every(l => p.variantInventory!.some(v => v.key === variantKey(l.color, l.size))), 'RESERVATION_INVENTORY_CHANGED', 409);
      p.variantInventory = p.variantInventory!.map(v => ({ ...v, stock: v.stock + lines.filter(l => variantKey(l.color, l.size) === v.key).reduce((sum, l) => sum + l.quantity, 0) }));
      p.stockCount = p.variantInventory.reduce((sum, v) => sum + v.stock, 0);
    } else p.stockCount += lines.reduce((sum, l) => sum + l.quantity, 0);
    requireCondition(Number.isSafeInteger(p.stockCount) && p.stockCount >= 0, 'RESERVATION_INVENTORY_CHANGED', 409);
    // Preserve active/archived status and all other product metadata.
    return { ref: s.ref, data: { data: sanitizeFirestoreData(p), inventoryVersion: (raw.inventoryVersion || 0) + 1, updatedAt: new Date(now) } };
  });
}
