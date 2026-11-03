import { absolute, add, cents, min, negate, subtract, sum, times } from './cents';
import { isCurrencyCode, minorDigits } from './currency';

describe('cents', () => {
  it('accepts safe integers only', () => {
    expect(cents(1999)).toBe(1999);
    expect(() => cents(19.99)).toThrow(RangeError);
    expect(() => cents(Number.NaN)).toThrow(RangeError);
    expect(() => cents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => cents(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it('normalises negative zero', () => {
    expect(Object.is(cents(-0), 0)).toBe(true);
    expect(Object.is(negate(cents(0)), 0)).toBe(true);
  });

  it('does arithmetic without leaving the integer domain', () => {
    expect(add(cents(1), cents(2))).toBe(3);
    expect(subtract(cents(1), cents(2))).toBe(-1);
    expect(absolute(cents(-250))).toBe(250);
    expect(times(cents(350), 3)).toBe(1050);
    expect(sum([cents(1), cents(2), cents(3)])).toBe(6);
    expect(sum([])).toBe(0);
    expect(min(cents(5), cents(3))).toBe(3);
  });

  it('refuses to multiply by a fraction', () => {
    expect(() => times(cents(100), 1.5)).toThrow(RangeError);
  });

  it('throws when a sum overflows the safe range', () => {
    expect(() => add(cents(Number.MAX_SAFE_INTEGER), cents(1))).toThrow(RangeError);
  });
});

describe('currencies', () => {
  it('knows which codes it supports and their minor units', () => {
    expect(isCurrencyCode('EUR')).toBe(true);
    expect(isCurrencyCode('XYZ')).toBe(false);
    expect(isCurrencyCode('toString')).toBe(false);
    expect(minorDigits('JPY')).toBe(0);
    expect(minorDigits('KWD')).toBe(3);
  });
});
