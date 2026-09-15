import { AMOUNT_PATTERN, toMinor, toDecimal, assertPositiveAmount } from './money';

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

    it('handles amounts far beyond Number.MAX_SAFE_INTEGER', () => {
      expect(toMinor('99999999999999999.99')).toBe(9999999999999999999n);
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
  });

  describe('assertPositiveAmount', () => {
    it('returns the minor value for a positive amount', () => {
      expect(assertPositiveAmount('0.01')).toBe(1n);
    });

    it('rejects zero', () => {
      expect(() => assertPositiveAmount('0.00')).toThrow('must be greater than zero');
    });
  });

  it('exposes a pattern that accepts valid and rejects invalid amounts', () => {
    expect(AMOUNT_PATTERN.test('10')).toBe(true);
    expect(AMOUNT_PATTERN.test('10.5')).toBe(true);
    expect(AMOUNT_PATTERN.test('10.50')).toBe(true);
    expect(AMOUNT_PATTERN.test('10.500')).toBe(false);
  });
});
