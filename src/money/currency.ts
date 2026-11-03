/**
 * Currencies a group can use, with their ISO 4217 minor-unit exponent.
 *
 * The exponent is hard-coded rather than read from `Intl` because it decides how stored
 * integers are interpreted. Two devices that disagree about whether JPY has decimals would
 * disagree about every balance, so this table is data, not a runtime lookup.
 */
export const CURRENCIES = {
  EUR: { name: 'Euro', exponent: 2 },
  USD: { name: 'US dollar', exponent: 2 },
  GBP: { name: 'British pound', exponent: 2 },
  CHF: { name: 'Swiss franc', exponent: 2 },
  CAD: { name: 'Canadian dollar', exponent: 2 },
  AUD: { name: 'Australian dollar', exponent: 2 },
  NZD: { name: 'New Zealand dollar', exponent: 2 },
  SEK: { name: 'Swedish krona', exponent: 2 },
  NOK: { name: 'Norwegian krone', exponent: 2 },
  DKK: { name: 'Danish krone', exponent: 2 },
  PLN: { name: 'Polish zloty', exponent: 2 },
  CZK: { name: 'Czech koruna', exponent: 2 },
  TRY: { name: 'Turkish lira', exponent: 2 },
  MXN: { name: 'Mexican peso', exponent: 2 },
  BRL: { name: 'Brazilian real', exponent: 2 },
  INR: { name: 'Indian rupee', exponent: 2 },
  JPY: { name: 'Japanese yen', exponent: 0 },
  KRW: { name: 'South Korean won', exponent: 0 },
  KWD: { name: 'Kuwaiti dinar', exponent: 3 },
} as const satisfies Record<string, { name: string; exponent: 0 | 2 | 3 }>;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.hasOwn(CURRENCIES, value);
}

export function minorDigits(currency: CurrencyCode): number {
  return CURRENCIES[currency].exponent;
}
