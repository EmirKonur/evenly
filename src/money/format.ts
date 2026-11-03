import type { Cents } from './cents';
import { minorDigits, type CurrencyCode } from './currency';

export interface FormatOptions {
  locale?: string;
  /** `exceptZero` renders "+€4.00" and "-€4.00", which is how balances read best. */
  signDisplay?: 'auto' | 'exceptZero' | 'never';
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: CurrencyCode, digits: number, options: FormatOptions) {
  const key = `${options.locale ?? ''}|${currency}|${options.signDisplay ?? 'auto'}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(options.locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      signDisplay: options.signDisplay ?? 'auto',
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Formats minor units for display with `Intl.NumberFormat` without ever building a
 * fractional number.
 *
 * `Intl` only accepts numbers, so the whole-unit part (an integer) goes through
 * `formatToParts` and the fraction digits are spliced back in from the amount's own
 * decimal string. That keeps the locale's symbol, grouping, and sign placement while
 * guaranteeing the digits on screen are exactly the digits in the database. Amounts
 * smaller than one whole unit are formatted as ±1 so the locale still decides where the
 * sign goes, and the integer is then rewritten to 0.
 */
export function formatMoney(
  amount: Cents,
  currency: CurrencyCode,
  options: FormatOptions = {},
): string {
  const digits = minorDigits(currency);
  const magnitude = Math.abs(amount)
    .toString()
    .padStart(digits + 1, '0');
  const majorText = digits === 0 ? magnitude : magnitude.slice(0, -digits);
  const minorText = digits === 0 ? '' : magnitude.slice(-digits);
  const major = Number.parseInt(majorText, 10);
  const sign = Math.sign(amount);
  const belowOneUnit = major === 0 && sign !== 0;

  const parts = formatterFor(currency, digits, options).formatToParts(
    sign * (belowOneUnit ? 1 : major),
  );
  return parts
    .map((part) => {
      if (part.type === 'fraction') return minorText;
      if (part.type === 'integer' && belowOneUnit) return '0';
      return part.value;
    })
    .join('');
}

/** The currency's symbol in the given locale, e.g. "€" or "CHF". */
export function currencySymbol(currency: CurrencyCode, locale?: string): string {
  const parts = formatterFor(currency, minorDigits(currency), { locale }).formatToParts(0);
  return parts.find((part) => part.type === 'currency')?.value ?? currency;
}

/**
 * A plain decimal for editable fields: "1234.50", "-3.00", "980" for JPY. No symbol, no
 * grouping, always a dot, so it parses back with `parseMoney` in any locale.
 */
export function formatPlain(amount: Cents, currency: CurrencyCode): string {
  const digits = minorDigits(currency);
  const magnitude = Math.abs(amount)
    .toString()
    .padStart(digits + 1, '0');
  const sign = amount < 0 ? '-' : '';
  return digits === 0
    ? `${sign}${magnitude}`
    : `${sign}${magnitude.slice(0, -digits)}.${magnitude.slice(-digits)}`;
}
