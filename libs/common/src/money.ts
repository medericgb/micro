/** Amounts cross the wire as decimal strings with at most two decimal places. */
export const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

const MINOR_UNIT_DIGITS = 2;

/** Parse a decimal string into minor units. String arithmetic only — never Number. */
export function toMinor(amount: string): bigint {
  if (typeof amount !== 'string' || !AMOUNT_PATTERN.test(amount)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole + fraction.padEnd(MINOR_UNIT_DIGITS, '0'));
}

/** Format minor units as a decimal string for display or transport. */
export function toDecimal(minor: bigint): string {
  const digits = minor.toString().padStart(MINOR_UNIT_DIGITS + 1, '0');
  const cut = digits.length - MINOR_UNIT_DIGITS;
  return `${digits.slice(0, cut)}.${digits.slice(cut)}`;
}

/** Parse and require a strictly positive amount. */
export function assertPositiveAmount(amount: string): bigint {
  const minor = toMinor(amount);
  if (minor <= 0n) {
    throw new Error(`Amount must be greater than zero: ${amount}`);
  }
  return minor;
}
