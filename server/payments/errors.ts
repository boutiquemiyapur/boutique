export class PaymentError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export const requireCondition: (condition: unknown, code: string, status?: number) => asserts condition = (condition, code, status = 400) => {
  if (!condition) throw new PaymentError(code, status);
};
