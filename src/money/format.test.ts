import { cents } from './cents';
import { currencySymbol, formatMoney, formatPlain } from './format';

describe('formatMoney', () => {
  it.each([
    [123456, 'EUR', 'en-US', '€1,234.56'],
    [123456, 'EUR', 'de-DE', '1.234,56 €'],
    [123456, 'EUR', 'pt-PT', '1234,56 €'],
    [5, 'USD', 'en-US', '$0.05'],
    [-5, 'USD', 'en-US', '-$0.05'],
    [0, 'GBP', 'en-GB', '£0.00'],
    [2460, 'JPY', 'ja-JP', '￥2,460'],
    [1234, 'KWD', 'en-US', 'KWD 1.234'],
  ] as const)('formats %p %s in %s as %p', (amount, currency, locale, expected) => {
    expect(formatMoney(cents(amount), currency, { locale })).toBe(expected);
  });

  it('keeps every digit of amounts far beyond float-safe decimals', () => {
    expect(formatMoney(cents(9_007_199_254_740_991), 'USD', { locale: 'en-US' })).toBe(
      '$90,071,992,547,409.91',
    );
  });

  it('shows explicit signs for balances, including amounts under one unit', () => {
    const balance = { locale: 'en-US', signDisplay: 'exceptZero' } as const;
    expect(formatMoney(cents(420), 'EUR', balance)).toBe('+€4.20');
    expect(formatMoney(cents(-7), 'EUR', balance)).toBe('-€0.07');
    expect(formatMoney(cents(7), 'EUR', balance)).toBe('+€0.07');
    expect(formatMoney(cents(0), 'EUR', balance)).toBe('€0.00');
  });

  it('can hide the sign entirely', () => {
    expect(formatMoney(cents(-1999), 'EUR', { locale: 'en-US', signDisplay: 'never' })).toBe(
      '€19.99',
    );
  });

  it('exposes the currency symbol', () => {
    expect(currencySymbol('EUR', 'en-US')).toBe('€');
    expect(currencySymbol('GBP', 'en-GB')).toBe('£');
  });
});

describe('formatPlain', () => {
  it('prints editable decimals with no grouping or symbol', () => {
    expect(formatPlain(cents(123456), 'EUR')).toBe('1234.56');
    expect(formatPlain(cents(-5), 'USD')).toBe('-0.05');
    expect(formatPlain(cents(2460), 'JPY')).toBe('2460');
    expect(formatPlain(cents(1234), 'KWD')).toBe('1.234');
  });
});
