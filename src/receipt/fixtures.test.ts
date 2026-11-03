import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { CurrencyCode } from '../money/currency';
import { parseReceipt, type ParsedReceipt, type ReceiptStatus } from './parse';

interface Expected {
  currency: CurrencyCode;
  merchant: string | null;
  date: string | null;
  /** [name, quantity, line total, unit price or null] */
  items: [string, number, number, number | null][];
  subtotal?: number | null;
  tax?: number | null;
  taxIncluded?: boolean;
  tip?: number | null;
  fees?: number | null;
  discount?: number | null;
  total: number | null;
  status: ReceiptStatus;
  difference?: number | null;
}

const fixtures: Record<string, Expected> = {
  'us-diner': {
    currency: 'USD',
    merchant: 'The Blue Plate Diner',
    date: '2026-10-24',
    items: [
      ['Cheeseburger', 2, 2900, null],
      ['Veggie Melt', 1, 1350, null],
      ['Fries (lg)', 1, 625, null],
      ['Iced Tea', 3, 1050, 350],
      ['Apple Pie a la Mode', 1, 875, null],
    ],
    subtotal: 6800,
    tax: 587,
    taxIncluded: false,
    tip: null,
    total: 7387,
    status: 'balanced',
  },
  'lisbon-tasca': {
    currency: 'EUR',
    merchant: 'Tasca do Chico',
    date: '2026-10-14',
    items: [
      ['Pão e manteiga', 2, 300, null],
      ['Caldo verde', 1, 450, null],
      ['Bacalhau à Brás', 1, 1650, null],
      ['Polvo à lagareiro', 1, 2100, null],
      ['Imperial', 3, 540, 180],
      ['Vinho tinto jarro 0,5l', 1, 900, null],
      ['Pastel de nata', 2, 260, 130],
      ['Bica', 2, 180, 90],
    ],
    tax: null,
    total: 6380,
    status: 'balanced',
  },
  'berlin-biergarten': {
    currency: 'EUR',
    merchant: 'Prater Garten',
    date: '2026-10-16',
    items: [
      ['0,5l Helles', 1, 490, null],
      ['0,5l Helles', 1, 490, null],
      ['0,5l Radler', 1, 470, null],
      ['Brezel', 1, 320, null],
      ['Bratwurst', 2, 1100, 550],
      ['Pfand Krug', 1, 200, null],
    ],
    total: 3070,
    status: 'balanced',
  },
  'london-pub': {
    currency: 'GBP',
    merchant: 'The Crown & Anchor',
    date: '2026-10-18',
    items: [
      ['Fish & Chips', 1, 1650, null],
      ['Steak & Ale Pie', 1, 1595, null],
      ['Halloumi Burger', 2, 2700, null],
      ['Sticky Toffee Pudding', 1, 750, null],
      ['Pint London Pride', 4, 2520, null],
      ['Lime & Soda', 1, 320, null],
    ],
    subtotal: 9535,
    tax: 1788,
    taxIncluded: true,
    fees: 1192,
    total: 10727,
    status: 'balanced',
  },
  'vision-columns': {
    currency: 'EUR',
    merchant: 'Time Out Market Lisboa',
    date: '2026-10-15',
    items: [
      ['Croquete de novilho', 1, 390, null],
      ['Croquete de bacalhau', 1, 360, null],
      ['Bitoque', 1, 1250, null],
      ['Super Bock', 1, 280, null],
      ['Água 0,5L', 1, 150, null],
    ],
    subtotal: 2430,
    total: 2430,
    status: 'balanced',
  },
  'narrow-thermal': {
    currency: 'USD',
    merchant: 'Sunrise Bakery & Coffee',
    date: '2026-10-21',
    items: [
      ['Oat Milk Latte (16oz)', 1, 575, null],
      ['Almond Croissant', 1, 425, null],
      ['Breakfast Burrito w/ Chorizo + Extra Salsa', 1, 1150, null],
      ['Drip Coffee Refill', 1, 100, null],
    ],
    subtotal: 2250,
    tax: 203,
    tip: 350,
    total: 2803,
    status: 'balanced',
  },
  'us-grocery': {
    currency: 'USD',
    merchant: 'Greenleaf Market',
    date: '2026-10-26',
    items: [
      ['Organic Bananas', 1, 182, null],
      ['Hass Avocado', 3, 375, 125],
      ['Sourdough Loaf', 1, 599, null],
      ['Oat Milk 64oz', 1, 449, null],
      ['Sparkling Water 12PK', 1, 699, null],
      ['CRV', 1, 60, null],
      ['Paper Towels 6RL', 1, 949, null],
    ],
    subtotal: 3213,
    tax: 175,
    discount: 100,
    total: 3388,
    status: 'balanced',
  },
  'tokyo-ramen': {
    currency: 'JPY',
    merchant: 'らーめん 一番星',
    date: '2026-10-19',
    items: [
      ['ラーメン', 1, 980, null],
      ['味玉ラーメン', 1, 1180, null],
      ['餃子', 2, 900, 450],
      ['生ビール', 1, 600, null],
    ],
    subtotal: 3660,
    tax: 332,
    taxIncluded: true,
    total: 3660,
    status: 'balanced',
  },
  'ocr-noisy': {
    currency: 'USD',
    merchant: 'Monterey Taqueria',
    date: '2026-10-20',
    items: [
      ['Carne Asada Tacos', 2, 900, null],
      ['Burrito Al Pastor', 1, 1250, null],
      ['Chips & Guac', 1, 675, null],
      ['Horchata', 2, 700, null],
    ],
    subtotal: 3525,
    tax: 326,
    total: 3851,
    status: 'balanced',
  },
  'missed-line': {
    currency: 'USD',
    merchant: 'Noodle Bar 88',
    date: '2026-10-22',
    items: [
      ['Dan Dan Noodles', 1, 1400, null],
      ['Wonton Soup', 1, 1150, null],
      ['Mapo Tofu', 1, 1500, null],
    ],
    subtotal: 5250,
    tax: 486,
    total: 5736,
    status: 'mismatch',
    difference: 1200,
  },
  'card-slip': {
    currency: 'USD',
    merchant: 'Osteria Luce',
    date: '2026-10-23',
    items: [],
    subtotal: 8600,
    tax: 763,
    tip: 1800,
    total: 11163,
    status: 'no-items',
    difference: 0,
  },
};

function load(name: string): string[] {
  return readFileSync(join(__dirname, '__fixtures__', `${name}.txt`), 'utf8').split('\n');
}

describe.each(Object.entries(fixtures))('receipt fixture %s', (name, expected) => {
  let parsed: ParsedReceipt;
  beforeAll(() => {
    parsed = parseReceipt(load(name), { currency: expected.currency });
  });

  it('finds the merchant and date', () => {
    expect(parsed.merchant).toBe(expected.merchant);
    expect(parsed.date).toBe(expected.date);
  });

  it('reads every item with quantity and price', () => {
    expect(parsed.items.map((i) => [i.name, i.quantity, i.price, i.unitPrice])).toEqual(
      expected.items,
    );
  });

  it('reads the totals and adjustments', () => {
    expect(parsed.total).toBe(expected.total);
    if (expected.subtotal !== undefined) expect(parsed.subtotal).toBe(expected.subtotal);
    if (expected.tax !== undefined) expect(parsed.tax).toBe(expected.tax);
    if (expected.taxIncluded !== undefined) expect(parsed.taxIncluded).toBe(expected.taxIncluded);
    if (expected.tip !== undefined) expect(parsed.tip).toBe(expected.tip);
    if (expected.fees !== undefined) expect(parsed.fees).toBe(expected.fees);
    if (expected.discount !== undefined) expect(parsed.discount).toBe(expected.discount);
  });

  it('validates the arithmetic', () => {
    expect(parsed.check.status).toBe(expected.status);
    if (expected.difference !== undefined)
      expect(parsed.check.difference).toBe(expected.difference);
  });
});
