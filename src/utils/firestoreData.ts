const isPlainObject = (value: object): value is Record<string, unknown> => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
 * Produces Firestore-safe data without changing legitimate falsy values.
 * Undefined object properties are omitted. Undefined array entries are rejected
 * because removing them would change item indexes and variant associations.
 */
export const sanitizeFirestoreData = <T>(value: T, path = 'data'): T => {
  if (value === undefined) throw new TypeError(`Undefined array value at ${path}.`);
  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeFirestoreData(item, `${path}[${index}]`)) as T;
  }

  if (!isPlainObject(value)) return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) sanitized[key] = sanitizeFirestoreData(item, `${path}.${key}`);
  }
  return sanitized as T;
};
