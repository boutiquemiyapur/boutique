// Historical COD orders remain readable. No new COD purchases are accepted.
export default function handler(_request: unknown, response: { status: (code: number) => { json: (body: unknown) => unknown } }) {
  return response.status(410).json({ code: 'COD_DISABLED', error: 'New purchases require online payment through Razorpay.' });
}
