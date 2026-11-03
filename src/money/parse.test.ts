import * as fc from 'fast-check';

import { cents } from './cents';
import { formatMoney } from './format';
import { parseDecimal, parseMoney } from './parse';

describe('parseDecimal', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12,50', 1250],
    ['0.07', 7],
    ['.99', 99],
    ['1,234.56', 123456],
    ['1.234,56', 123456],
    ['1 234,56', 123456],
    ['1 234,56', 123456],
    ["1'234.50", 123450],
    ['1,23,456.00', 12345600],
    ['1,234', 123400],
    ['1.234.567', 123456700],
    ['€12,50', 1250],
    ['12.50 EUR', 1250],
    ['$ 3.99', 399],
    ['-3.00', -300],
    ['−3.00', -300],
    ['3.00-', -300],
    ['(3.00)', -300],
    ['+4', 400],
    ['12.500', 1250000],
    ['12.345', 1234500],
  ])('reads %p as %p minor units', (text, expected) => {
    expect(parseDecimal(text, 2)).toBe(expected);
  });

  it.each([
    '',
    'abc',
    '1.2.3,4,5',
    '12,34,56',
    '--3',
    '1,2345',
    '12.3.4',
    '1e5',
    '1234567890123456',
  ])('rejects %p', (text) => {
    expect(parseDecimal(text, 2)).toBeNull();
  });

  it('respects the currency exponent', () => {
    expect(parseMoney('2,460', 'JPY')).toBe(2460);
    expect(parseMoney('980', 'JPY')).toBe(980);
    expect(parseMoney('12.50', 'JPY')).toBeNull();
    expect(parseMoney('1.234', 'KWD')).toBe(1234);
    expect(parseMoney('7', 'KWD')).toBe(7000);
  });

  it('turns percentages into basis points', () => {
    expect(parseDecimal('33.33', 2)).toBe(3333);
    expect(parseDecimal('12,5', 2)).toBe(1250);
    expect(parseDecimal('100', 2)).toBe(10000);
  });

  it('never returns negative zero', () => {
    expect(Object.is(parseDecimal('-0.00', 2), -0)).toBe(false);
  });

  it('property: parses back whatever it formats', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -9_999_999_99, max: 9_999_999_99 }),
        fc.constantFrom('en-US', 'de-DE', 'pt-PT', 'fr-FR', 'en-IN', 'de-CH'),
        fc.constantFrom('EUR', 'USD', 'GBP', 'CHF') as fc.Arbitrary<'EUR' | 'USD' | 'GBP' | 'CHF'>,
        (value, locale, currency) => {
          const amount = cents(value);
          const text = formatMoney(amount, currency, { locale });
          expect(parseMoney(text, currency)).toBe(amount);
        },
      ),
      { numRuns: 1_000 },
    );
  });
});
