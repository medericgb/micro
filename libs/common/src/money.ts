/**
 * Amounts cross the wire as decimal strings with at most two decimal places and
 * at most twelve digits before the point. The digit bound is part of the format,
 * not a business rule: without it a hostile client can hand us a megabyte of
 * digits and we turn it into a BigInt. Widen the pattern to lift the cap —
 * MAX_AMOUNT and MAX_AMOUNT_MINOR are pinned to it by test.
 */
export const AMOUNT_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

const MINOR_UNIT_DIGITS = 2;

/** The largest single amount any endpoint accepts. */
export const MAX_AMOUNT = '999999999999.99';

/** MAX_AMOUNT in minor units. Balances may exceed it; a single amount may not. */
export const MAX_AMOUNT_MINOR = 99_999_999_999_999n;

/** Parse a decimal string into minor units. String arithmetic only — never Number. */
export function toMinor(amount: string): bigint {
  if (typeof amount !== 'string' || !AMOUNT_PATTERN.test(amount)) {
    throw new Error(`Invalid amount: ${amount} (at most ${MAX_AMOUNT})`);
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
