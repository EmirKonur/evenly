import { cents, type Cents } from './cents';
import { minorDigits, type CurrencyCode } from './currency';

const GROUPING_CHARS = /[\s\u00a0\u202f'\u2019]/g;
const CURRENCY_MARKS =
  /[€$£¥₹₩₺]|\b(?:EUR|USD|GBP|CHF|JPY|CAD|AUD|SEK|NOK|DKK|PLN|CZK|TRY|MXN|BRL|INR|KRW|NZD|KWD)\b/gi;
const MAX_DIGITS = 15;

/**
 * Parses a human-written decimal ("12", "12.5", "1,234.56", "1.234,56", "1'234.50") into an
 * integer scaled by 10^digits, using string manipulation only. `parseDecimal("33.33", 2)`
 * is 3333.
 *
 * Which separator is the decimal point is inferred: when both appear, the last one is; when
 * only one appears once, it is a decimal point unless it is followed by exactly three digits
 * and the scale is not three (so "1,234" is a thousand and change, not 1.234).
 *
 * Returns null for anything ambiguous or too precise, because guessing wrong on money input
 * is worse than asking again.
 */
export function parseDecimal(text: string, digits: number): number | null {
  let s = text.trim().replace(/\u2212/g, '-');
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(CURRENCY_MARKS, '').replace(GROUPING_CHARS, '');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.endsWith('-')) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d[\d.,]*$/.test(s) && !/^[.,]\d+$/.test(s)) return null;

  const split = splitDecimal(s, digits);
  if (!split) return null;
  const [major, fraction] = split;
  if (!isValidGrouping(major)) return null;

  const majorDigits = major.replace(/[.,]/g, '') || '0';
  let minor = fraction;
  if (minor.length > digits) {
    if (!/^0+$/.test(minor.slice(digits))) return null;
    minor = minor.slice(0, digits);
  }
  const scaled = (majorDigits + minor.padEnd(digits, '0')).replace(/^0+(?=\d)/, '');
  if (scaled.length > MAX_DIGITS) return null;
  const value = Number.parseInt(scaled, 10);
  return negative && value !== 0 ? -value : value;
}

/** Parses user or receipt text into money for a currency. */
export function parseMoney(text: string, currency: CurrencyCode): Cents | null {
  const value = parseDecimal(text, minorDigits(currency));
  return value === null ? null : cents(value);
}

function splitDecimal(s: string, digits: number): [major: string, fraction: string] | null {
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  const last = Math.max(lastDot, lastComma);
  if (last === -1) return [s, ''];

  const separator = s.charAt(last);
  const other = separator === '.' ? ',' : '.';
  const tail = s.slice(last + 1);
  const head = s.slice(0, last);

  if (s.includes(other)) {
    // Mixed separators: the last one is the decimal point and the other may only group.
    if (head.includes(separator)) return null;
    return tail.length > 0 ? [head, tail] : null;
  }

  const occurrences = s.split(separator).length - 1;
  if (occurrences > 1) return [s, ''];
  if (tail.length === 3 && digits !== 3) return [s, ''];
  return tail.length > 0 ? [head, tail] : [head, ''];
}

function isValidGrouping(major: string): boolean {
  if (!/[.,]/.test(major)) return true;
  const groups = major.split(/[.,]/);
  const [first, ...rest] = groups;
  if (!first || first.length > 3) return false;
  return rest.every((group, i) =>
    i === rest.length - 1 ? group.length === 3 : group.length === 2 || group.length === 3,
  );
}
