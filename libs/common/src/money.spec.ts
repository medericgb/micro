import {
  AMOUNT_PATTERN,
  MAX_AMOUNT,
  MAX_AMOUNT_MINOR,
  toMinor,
  toDecimal,
  assertPositiveAmount,
} from './money';

describe('money', () => {
  describe('toMinor', () => {
    it('converts whole amounts', () => {
      expect(toMinor('50')).toBe(5000n);
    });

    it('converts two-decimal amounts', () => {
      expect(toMinor('50.25')).toBe(5025n);
    });

    it('pads a single decimal place', () => {
      expect(toMinor('50.2')).toBe(5020n);
    });

    it('accepts the largest amount the format allows', () => {
      expect(toMinor(MAX_AMOUNT)).toBe(MAX_AMOUNT_MINOR);
    });

    it('rejects an amount one digit past the cap', () => {
      expect(() => toMinor('9999999999999.99')).toThrow('Invalid amount');
      expect(() => toMinor('999999999999999999999999')).toThrow(
        'Invalid amount',
      );
    });

    it('rejects a malformed amount', () => {
      expect(() => toMinor('50.255')).toThrow('Invalid amount');
      expect(() => toMinor('-50')).toThrow('Invalid amount');
      expect(() => toMinor('abc')).toThrow('Invalid amount');
      expect(() => toMinor('')).toThrow('Invalid amount');
    });
  });

  describe('toDecimal', () => {
    it('formats with two decimal places', () => {
      expect(toDecimal(5000n)).toBe('50.00');
      expect(toDecimal(5025n)).toBe('50.25');
    });

    it('pads amounts below one unit', () => {
      expect(toDecimal(5n)).toBe('0.05');
      expect(toDecimal(0n)).toBe('0.00');
    });

    it('round-trips with toMinor', () => {
      expect(toDecimal(toMinor('1234.56'))).toBe('1234.56');
    });

    // A single amount is capped, an accumulated balance is not: this is the
    // case that rules out Number for balances.
    it('formats balances far beyond Number.MAX_SAFE_INTEGER', () => {
      expect(toDecimal(9999999999999999999n)).toBe('99999999999999999.99');
    });
  });

  describe('assertPositiveAmount', () => {
    it('returns the minor value for a positive amount', () => {
      expect(assertPositiveAmount('0.01')).toBe(1n);
    });

    it('rejects zero', () => {
      expect(() => assertPositiveAmount('0.00')).toThrow(
        'must be greater than zero',
      );
    });
  });

  it('exposes a pattern that accepts valid and rejects invalid amounts', () => {
    expect(AMOUNT_PATTERN.test('10')).toBe(true);
    expect(AMOUNT_PATTERN.test('10.5')).toBe(true);
    expect(AMOUNT_PATTERN.test('10.50')).toBe(true);
    expect(AMOUNT_PATTERN.test('10.500')).toBe(false);
    expect(AMOUNT_PATTERN.test(MAX_AMOUNT)).toBe(true);
    expect(AMOUNT_PATTERN.test('999999999999999999999999')).toBe(false);
  });

  // The DTOs validate with AMOUNT_PATTERN and the services parse with toMinor.
  // If those two ever disagree, one layer accepts what the other rejects.
  it('keeps MAX_AMOUNT, MAX_AMOUNT_MINOR and the pattern in agreement', () => {
    expect(toDecimal(MAX_AMOUNT_MINOR)).toBe(MAX_AMOUNT);
    expect(AMOUNT_PATTERN.test(toDecimal(MAX_AMOUNT_MINOR + 1n))).toBe(false);
  });
});
