import * as fc from 'fast-check';

import { classifyLine } from './classify';
import { extractDate, normalizeLine, splitPrice, tidyName } from './lines';
import { parseReceipt } from './parse';

const eur = { currency: 'EUR' } as const;

describe('parseReceipt', () => {
  it('reads ML Kit style multi-line blocks the same as single lines', () => {
    const lines = ['CAFE A BRASILEIRA', 'Galão 2,10', 'Torrada 3,40', 'Total 5,50'];
    const blocks = ['CAFE A BRASILEIRA\nGalão 2,10\nTorrada 3,40', 'Total 5,50'];
    expect(parseReceipt(blocks, eur)).toEqual(parseReceipt(lines, eur));
  });

  it('zips a quantity column, a name column, and a price column', () => {
    const vision = ['2', '1', 'Sardinhas', 'Salada mista', '17,00', '4,50', 'Total', '21,50'];
    // The trailing "Total" + "21,50" pair is its own run.
    const parsed = parseReceipt(vision, eur);
    expect(parsed.items.map((item) => [item.name, item.quantity, item.price])).toEqual([
      ['Sardinhas', 2, 1700],
      ['Salada mista', 1, 450],
    ]);
    expect(parsed.check.status).toBe('balanced');
  });

  it('treats any negative line as a discount', () => {
    const parsed = parseReceipt(['Pizza 12,00', 'Happy hour -2,00', 'Total 10,00'], eur);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.discount).toBe(200);
    expect(parsed.extras.discount).toBe(200);
    expect(parsed.check.status).toBe('balanced');
  });

  it('prefers the printed total that the arithmetic supports', () => {
    const parsed = parseReceipt(
      ['Pasta 18.00', 'Total 18.00', 'Tip 3.00', 'Total 21.00', 'Total 18.00'],
      { currency: 'USD' },
    );
    expect(parsed.total).toBe(2100);
    expect(parsed.check.status).toBe('balanced');
  });

  it('marks tax as included when only that reading balances', () => {
    const parsed = parseReceipt(['Menu 20,00', 'IVA 13% 2,30', 'Total 20,00'], eur);
    expect(parsed.taxIncluded).toBe(true);
    expect(parsed.extras.tax).toBe(0);
  });

  it('reports what is unaccounted for', () => {
    const parsed = parseReceipt(['Soup 6.00', 'Tax 1.00', 'Total 12.00'], { currency: 'USD' });
    expect(parsed.check).toMatchObject({ status: 'mismatch', difference: 500, computedTotal: 700 });
  });

  it('is unverified without a printed total and empty without input', () => {
    expect(parseReceipt(['Bolo 2,50'], eur).check.status).toBe('unverified');
    const empty = parseReceipt([], eur);
    expect(empty).toMatchObject({ merchant: null, date: null, items: [], total: null });
    expect(empty.check.status).toBe('no-items');
  });

  it('drops a unit price that does not multiply out', () => {
    const [item] = parseReceipt(['3 x Coffee 2.00 5.00'], { currency: 'USD' }).items;
    expect(item).toMatchObject({ quantity: 3, unitPrice: null, price: 500 });
  });

  it('reads trailing quantities', () => {
    const [item] = parseReceipt(['Burger x2 18.00'], { currency: 'USD' }).items;
    expect(item).toMatchObject({ name: 'Burger', quantity: 2, price: 1800 });
  });

  it('never throws, whatever OCR hands it', () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 60 }), { maxLength: 40 }), (lines) => {
        const parsed = parseReceipt(lines, { currency: 'USD' });
        expect(Number.isSafeInteger(parsed.check.itemsTotal)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });
});

describe('line helpers', () => {
  it('fixes OCR digit and letter swaps without touching units', () => {
    expect(normalizeLine('T0TAL   1O.5O')).toBe('TOTAL 10.50');
    expect(normalizeLine('SUBTOTA1 3.00')).toBe('SUBTOTAL 3.00');
    expect(normalizeLine('0,5l Helles 4,90')).toBe('0,5l Helles 4,90');
    expect(normalizeLine('ＴＯＴＡＬ　￥１，２００')).toBe('TOTAL ¥1,200');
  });

  it('reads dates in either order, using the locale only when ambiguous', () => {
    expect(extractDate('03/04/2026', 'mdy').date).toBe('2026-03-04');
    expect(extractDate('03/04/2026', 'dmy').date).toBe('2026-04-03');
    expect(extractDate('25/04/26 19:02', 'mdy')).toEqual({ rest: '', date: '2026-04-25' });
    expect(extractDate('2026-10-03 Lane 4', 'mdy')).toEqual({ rest: 'Lane 4', date: '2026-10-03' });
    expect(extractDate('Mesa 7', 'dmy').date).toBeNull();
  });

  it('splits labels from prices, skipping tax flags and currency marks', () => {
    expect(splitPrice('Brezel 3,20 B', 2)).toEqual({ label: 'Brezel', price: 320 });
    expect(splitPrice('Total € 15,40', 2)).toEqual({ label: 'Total', price: 1540 });
    expect(splitPrice('Coffee ........ 3.50', 2)).toEqual({ label: 'Coffee', price: 350 });
    expect(splitPrice('Table 12', 2)).toEqual({ label: 'Table 12', price: null });
    expect(splitPrice('IVA 23%', 2)).toEqual({ label: 'IVA 23%', price: null });
    expect(splitPrice('Ramen ¥980', 0)).toEqual({ label: 'Ramen', price: 980 });
    expect(splitPrice('Table 12', 0)).toEqual({ label: 'Table 12', price: null });
  });

  it('title-cases shouted names but leaves codes and mixed case alone', () => {
    expect(tidyName('TASCA DO CHICO')).toBe('Tasca do Chico');
    expect(tidyName('SPARKLING WATER 12PK')).toBe('Sparkling Water 12PK');
    expect(tidyName('Fries (lg)')).toBe('Fries (lg)');
  });

  it.each([
    ['CHANGE DUE', 'payment'],
    ['TOTAL SAVINGS', 'ignored'],
    ['Total tax', 'tax'],
    ['Total incl. VAT', 'total'],
    ['Serviço', 'fees'],
    ['Gorjeta', 'tip'],
    ['Zwischensumme', 'subtotal'],
    ['Bar', 'payment'],
    ['Bar snacks', 'item'],
  ])('classifies %p as %p', (label, role) => {
    expect(classifyLine(label, false).role).toBe(role);
  });
});
