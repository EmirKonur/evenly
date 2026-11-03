import { cents, type Cents } from '../money/cents';
import { parseDecimal } from '../money/parse';

/** One receipt row after normalisation: a text label and, if present, its trailing price. */
export interface ReceiptLine {
  /** Index of the OCR line this row starts on, so the UI can point back at it. */
  index: number;
  label: string;
  price: Cents | null;
}

export type DateOrder = 'dmy' | 'mdy';

const LETTERS = /[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ぀-ヿ㐀-鿿]/g;
const CURRENCY_SYMBOLS = '€$£¥₹₩₺';
const CURRENCY_CODE =
  /^(?:EUR|USD|GBP|CHF|JPY|CAD|AUD|SEK|NOK|DKK|PLN|CZK|TRY|MXN|BRL|INR|KRW|NZD|KWD)$/i;
/** Single-letter VAT/tax class flags printed after prices: "4,90 A", "3.49 T", "1.99 *". */
const TAX_FLAG = /^(?:[A-Z]|\*|[A-Z]\*|\*[A-Z])$/;

const DATE_PATTERNS: [
  RegExp,
  (m: RegExpMatchArray, order: DateOrder) => [string, string, string],
][] = [
  [/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, (m) => [m[1]!, m[2]!, m[3]!]],
  [/\b(\d{4})[-./](\d{1,2})[-./](\d{1,2})\b/, (m) => [m[1]!, m[2]!, m[3]!]],
  [
    /\b(\d{1,2})[-./](\d{1,2})[-./](\d{4}|\d{2})\b/,
    (m, order) => {
      const year = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
      const [a, b] = [m[1]!, m[2]!];
      // A number above 12 can only be the day; otherwise fall back to the locale's order.
      const dayFirst = Number(a) > 12 ? true : Number(b) > 12 ? false : order === 'dmy';
      return dayFirst ? [year, b, a] : [year, a, b];
    },
  ],
];
const TIME = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?(?=\s|$)/g;

export function letterCount(text: string): number {
  return text.match(LETTERS)?.length ?? 0;
}

/**
 * Cleans one OCR line: Unicode compatibility forms (full-width digits, ￥), dash variants,
 * repeated whitespace, and the classic OCR digit swaps inside numeric tokens ("1O.5O" is
 * 10.50) and letter swaps inside words ("T0TAL", "TAQUERlA").
 */
export function normalizeLine(raw: string): string {
  const text = (typeof raw.normalize === 'function' ? raw.normalize('NFKC') : raw)
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return text.split(' ').map(fixOcrToken).join(' ');
}

function fixOcrToken(token: string): string {
  const digits = token.match(/\d/g)?.length ?? 0;
  const confusable = token.match(/[OoIl|]/g)?.length ?? 0;
  // Mostly digits with a few look-alike letters: a number OCR misread. A trailing "l"
  // after a digit is a unit ("0,5l"), not a one.
  const numeric = /^[-(]?[€$£¥]?[\dOoIl|.,/:-]+\)?$/.test(token) && !/\dl$/.test(token);
  if (digits > 0 && confusable > 0 && numeric) {
    return token.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
  }
  // Mostly capital letters with a stray 0/1 or lowercase l: a word OCR misread.
  const upper = token.match(/[A-Z]/g)?.length ?? 0;
  if (upper >= 3 && /^[A-Z01l]+$/.test(token) && /[01l]/.test(token) && !/^\d/.test(token)) {
    return token
      .replace(/0/g, 'O')
      .replace(/[1l]/g, (char, offset: number) =>
        offset === token.length - 1 && char === '1' ? 'L' : 'I',
      );
  }
  return token;
}

/** Removes a date (returning it as ISO yyyy-mm-dd) and any clock time from a line. */
export function extractDate(line: string, order: DateOrder): { rest: string; date: string | null } {
  let rest = line.replace(TIME, ' ');
  let date: string | null = null;
  for (const [pattern, toParts] of DATE_PATTERNS) {
    const match = rest.match(pattern);
    if (!match) continue;
    const [year, month, day] = toParts(match, order);
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      rest = rest.replace(match[0], ' ');
    }
    break;
  }
  return { rest: rest.replace(/\s+/g, ' ').trim(), date };
}

/**
 * Builds the pattern for a price token. With two minor digits a price must show exactly
 * two decimals ("4,90", "$13.30", "-1.00", "3.00-"); that single rule is what keeps
 * quantities, years, postcodes, and "0,5l" out of the price column. Zero-decimal
 * currencies need a symbol, digit grouping, or at least three digits instead.
 */
function priceTokenPattern(digits: number): RegExp {
  const symbol = `[${CURRENCY_SYMBOLS}]`;
  const body =
    digits === 0
      ? `(?:${symbol}?\\d{1,3}(?:,\\d{3})+|${symbol}\\d+|\\d{3,})円?`
      : `${symbol}?(?:\\d{1,3}(?:[.,'’]\\d{3})+|\\d+)[.,]\\d{${digits}}${symbol}?`;
  return new RegExp(`^[-(]?-?${body}\\)?-?$`);
}

/**
 * Splits a normalised line into its label and trailing price. Tax-class flags and lone
 * currency marks after the price are skipped; a currency mark before it ("Total € 15,40")
 * is trimmed from the label.
 */
export function splitPrice(line: string, digits: number): { label: string; price: Cents | null } {
  const tokens = line.split(' ').filter(Boolean);
  const pattern = priceTokenPattern(digits);
  let end = tokens.length - 1;
  while (end > 0 && (TAX_FLAG.test(tokens[end]!) || isCurrencyMark(tokens[end]!))) end--;

  const candidate = tokens[end];
  if (candidate === undefined || !pattern.test(candidate)) {
    return { label: cleanLabel(line), price: null };
  }
  const unbalanced = candidate.endsWith(')') && !candidate.startsWith('(');
  const value = parseDecimal(
    unbalanced ? candidate.slice(0, -1) : candidate.replace(/円$/, ''),
    digits,
  );
  if (value === null) return { label: cleanLabel(line), price: null };

  let labelTokens = tokens.slice(0, end);
  while (labelTokens.length > 0 && isCurrencyMark(labelTokens[labelTokens.length - 1]!)) {
    labelTokens = labelTokens.slice(0, -1);
  }
  return { label: cleanLabel(labelTokens.join(' ')), price: cents(value) };
}

/** Finds a price token at the end of a label: the unit price in "3 x Imperial 1,80". */
export function trailingUnitPrice(
  label: string,
  digits: number,
): { rest: string; price: Cents } | null {
  const { label: rest, price } = splitPrice(label, digits);
  return price === null || rest === label ? null : { rest, price };
}

function isCurrencyMark(token: string): boolean {
  return (token.length === 1 && CURRENCY_SYMBOLS.includes(token)) || CURRENCY_CODE.test(token);
}

function cleanLabel(label: string): string {
  return label
    .replace(/^[(\s]+/, '')
    .replace(/[\s.:_…-]{2,}$/, '')
    .replace(/[\s:]+$/, '')
    .trim();
}

const SMALL_WORDS = new Set([
  'a',
  'à',
  'e',
  'o',
  'da',
  'de',
  'do',
  'das',
  'dos',
  'of',
  'the',
  'and',
  'la',
  'le',
  'del',
  'w/',
]);

/** "SUPER BOCK" becomes "Super Bock"; mixed-case text is left exactly as printed. */
export function tidyName(text: string): string {
  const name = text.replace(/\s+/g, ' ').trim();
  if (/[a-z]/.test(name) || !/[A-Z]{2}/.test(name)) return name;
  return name
    .split(' ')
    .map((word, i) => {
      // Words without vowels are usually codes or abbreviations: CRV, BBQ, 12PK.
      if (!/[AEIOUYÀ-Ý]/.test(word)) return word;
      const lower = word.toLowerCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}
