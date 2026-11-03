import { add, cents, sum, times, type Cents } from '../money/cents';
import { minorDigits, type CurrencyCode } from '../money/currency';
import { receiptTotal, type Extras } from '../money/split';
import { classifyLine, looksLikeHeader, startsSuggestions } from './classify';
import {
  extractDate,
  letterCount,
  normalizeLine,
  splitPrice,
  tidyName,
  trailingUnitPrice,
  type DateOrder,
  type ReceiptLine,
} from './lines';

export interface ParsedItem {
  name: string;
  quantity: number;
  /** Set only when the receipt printed it and quantity x unit price equals the line total. */
  unitPrice: Cents | null;
  /** The line total. */
  price: Cents;
  /** Index of the OCR line the item came from. */
  line: number;
}

export type ReceiptStatus = 'balanced' | 'mismatch' | 'unverified' | 'no-items';

export interface ReceiptCheck {
  status: ReceiptStatus;
  itemsTotal: Cents;
  /** Items (or the printed subtotal, when no items were found) plus `extras`. */
  computedTotal: Cents;
  /** Printed total minus computed total. Non-zero means a line was missed or misread. */
  difference: Cents | null;
  /** Whether the items add up to the printed subtotal; null when there is none. */
  subtotalMatches: boolean | null;
}

export interface ParsedReceipt {
  merchant: string | null;
  /** ISO yyyy-mm-dd. */
  date: string | null;
  items: ParsedItem[];
  subtotal: Cents | null;
  tax: Cents | null;
  /** VAT-style receipts print tax that is already inside the prices. */
  taxIncluded: boolean;
  tip: Cents | null;
  fees: Cents | null;
  discount: Cents | null;
  total: Cents | null;
  /** What to add on top of the items when splitting. Included tax counts as zero. */
  extras: Extras;
  check: ReceiptCheck;
}

export interface ParseOptions {
  currency: CurrencyCode;
  /** How to read 03/04/2026. Defaults to month-first for USD and day-first otherwise. */
  dateOrder?: DateOrder;
}

const DECORATIVE = /^[-=_*~.#+\s]+$/;
const CONTINUES = /(?:\bw\/|\bwith|&|\+|,)$/i;
const DETAIL_MARKER = /@|×|\b\d+\s*x\b|\bx\s*\d|\/\s*(?:kg|lb|oz)\b|\b(?:kg|lb|lbs|oz)\b/i;
const UNIT_WORDS = /\b(?:kg|g|lb|lbs|oz|l|ml|ea|each|un|st|stk|pc|pcs|x)\b/gi;
const WEIGHT_DETAIL =
  /\s*\d+[.,]\d+\s*(?:kg|lb|lbs|g|oz)\s*@\s*[€$£]?\d+[.,]\d{2}\s*\/\s*(?:kg|lb|lbs|oz)\s*$/i;

/**
 * Turns OCR text lines into structured receipt data.
 *
 * OCR engines disagree about what a "line" is. Apple Vision often returns the name column
 * and the price column of a wide receipt as two separate runs; narrow thermal printers put
 * the price on the line after the name; Android's ML Kit returns multi-line blocks. The
 * parser normalises all of those into label + price rows first, then classifies each row,
 * and finally checks the arithmetic: do the items plus tax, tip, and fees minus discounts
 * land on the printed total? That check is what the review screen shows, so a misread line
 * is caught before anyone is charged for it.
 */
export function parseReceipt(rawLines: readonly string[], options: ParseOptions): ParsedReceipt {
  const digits = minorDigits(options.currency);
  const order = options.dateOrder ?? (options.currency === 'USD' ? 'mdy' : 'dmy');

  let date: string | null = null;
  const lines: ReceiptLine[] = [];
  rawLines
    .flatMap((raw) => raw.split('\n'))
    .forEach((raw, index) => {
      const extracted = extractDate(normalizeLine(raw), order);
      date ??= extracted.date;
      if (!extracted.rest || DECORATIVE.test(extracted.rest)) return;
      lines.push({ index, ...splitPrice(extracted.rest, digits) });
    });

  const rows = mergeDetailLines(reflowColumns(joinContinuations(lines)));
  const found = collect(rows, digits);
  return reconcile(found, merchantOf(lines), date);
}

interface Collected {
  items: ParsedItem[];
  subtotal: Cents | null;
  totals: Cents[];
  taxes: Cents[];
  taxMarkedIncluded: boolean;
  tip: Cents | null;
  fees: Cents[];
  discounts: Cents[];
}

function collect(rows: readonly ReceiptLine[], digits: number): Collected {
  const found: Collected = {
    items: [],
    subtotal: null,
    totals: [],
    taxes: [],
    taxMarkedIncluded: false,
    tip: null,
    fees: [],
    discounts: [],
  };
  let inSuggestions = false;

  for (const row of rows) {
    if (row.price === null) {
      if (startsSuggestions(row.label)) inSuggestions = true;
      continue;
    }
    if (inSuggestions && row.label.includes('%')) continue;

    const price = row.price;
    const { role, taxIncluded } = classifyLine(row.label, price < 0);
    switch (role) {
      case 'item':
        if (letterCount(row.label) >= 2 && !looksLikeHeader(row.label)) {
          found.items.push({ ...parseItem(row.label, price, digits), line: row.index });
        }
        break;
      case 'subtotal':
        found.subtotal ??= price;
        break;
      case 'total':
        found.totals.push(price);
        break;
      case 'tax':
        found.taxes.push(price);
        found.taxMarkedIncluded ||= taxIncluded === true;
        break;
      case 'tip':
        found.tip = price;
        break;
      case 'fees':
        found.fees.push(price);
        break;
      case 'discount':
        found.discounts.push(cents(Math.abs(price)));
        break;
      case 'payment':
      case 'ignored':
        break;
    }
  }
  return found;
}

/**
 * Picks the printed total that the numbers support and works out whether tax is already
 * inside the prices. A receipt can print several totals (a pre-tip "Amount" and a final
 * "Total", or a total repeated in the VAT table), so the one that equals items + charges
 * wins. If tax only balances when left out, the receipt is VAT-inclusive.
 */
function reconcile(found: Collected, merchant: string | null, date: string | null): ParsedReceipt {
  const itemsTotal = sum(found.items.map((item) => item.price));
  const base = found.items.length > 0 ? itemsTotal : (found.subtotal ?? cents(0));
  const tax = found.taxes.length > 0 ? sum(found.taxes) : null;
  const tip = found.tip;
  const fees = found.fees.length > 0 ? sum(found.fees) : null;
  const discount = found.discounts.length > 0 ? sum(found.discounts) : null;

  const charges = (taxIncluded: boolean): Extras => ({
    tax: taxIncluded || tax === null ? cents(0) : tax,
    tip: tip ?? cents(0),
    fees: fees ?? cents(0),
    discount: discount ?? cents(0),
  });
  const totalWith = (taxIncluded: boolean) => add(base, receiptTotal([], charges(taxIncluded)));

  let taxIncluded = found.taxMarkedIncluded;
  let total: Cents | null = null;
  for (const included of found.taxMarkedIncluded ? [true, false] : [false, true]) {
    const expected = totalWith(included);
    if (found.totals.includes(expected)) {
      total = expected;
      taxIncluded = included && tax !== null;
      break;
    }
  }
  total ??= found.totals[found.totals.length - 1] ?? null;

  const extras = charges(taxIncluded);
  const computedTotal = totalWith(taxIncluded);
  const difference = total === null ? null : cents(total - computedTotal);
  const subtotal = found.subtotal;
  const subtotalMatches =
    subtotal === null || found.items.length === 0
      ? null
      : itemsTotal === subtotal ||
        cents(itemsTotal - extras.discount) === subtotal ||
        (taxIncluded && tax !== null && itemsTotal === add(subtotal, tax));

  const status: ReceiptStatus =
    found.items.length === 0
      ? 'no-items'
      : difference === null
        ? 'unverified'
        : difference === 0
          ? 'balanced'
          : 'mismatch';

  return {
    merchant,
    date,
    items: found.items,
    subtotal,
    tax,
    taxIncluded,
    tip,
    fees,
    discount,
    total,
    extras,
    check: { status, itemsTotal, computedTotal, difference, subtotalMatches },
  };
}

/** Names that wrap onto a second line ("Breakfast Burrito w/" + "Chorizo") become one row. */
function joinContinuations(lines: readonly ReceiptLine[]): ReceiptLine[] {
  const out: ReceiptLine[] = [];
  for (const line of lines) {
    const previous = out[out.length - 1];
    if (previous && previous.price === null && CONTINUES.test(previous.label)) {
      out[out.length - 1] = {
        ...line,
        index: previous.index,
        label: `${previous.label} ${line.label}`,
      };
    } else {
      out.push(line);
    }
  }
  return out;
}

/**
 * Re-attaches prices that arrived on their own lines. A run of m bare prices is zipped with
 * the m text lines right before it (counting up from the bottom, so header lines above the
 * items are left alone). That one rule covers both the alternating name/price layout of
 * narrow printers and Vision's "all names, then all prices" column output. If the lines
 * just above the names are bare small integers, they are a quantity column.
 */
function reflowColumns(lines: readonly ReceiptLine[]): ReceiptLine[] {
  const out: ReceiptLine[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!isBarePrice(lines[i]!)) {
      out.push(lines[i]!);
      i++;
      continue;
    }
    let j = i;
    while (j < lines.length && isBarePrice(lines[j]!)) j++;
    const prices = lines.slice(i, j);

    let k = out.length;
    while (k > 0 && out[k - 1]!.price === null) k--;
    const texts = out.slice(k);
    const pairs = Math.min(texts.length, prices.length);
    const labelStart = texts.length - pairs;

    const quantities = labelStart >= pairs ? texts.slice(labelStart - pairs, labelStart) : [];
    const hasQuantityColumn =
      pairs > 0 &&
      quantities.length === pairs &&
      quantities.every((q) => /^\d{1,2}$/.test(q.label));

    const kept = texts.slice(0, hasQuantityColumn ? labelStart - pairs : labelStart);
    const zipped = texts.slice(labelStart).map((text, n) => ({
      index: text.index,
      label: hasQuantityColumn ? `${quantities[n]!.label} x ${text.label}` : text.label,
      price: prices[n]!.price,
    }));
    out.splice(k, texts.length, ...kept, ...zipped);
    i = j;
  }
  return out;
}

/** Detail rows like "3 @ 1.25" or "2.31 lb @ 0.79/lb" belong to the name above them. */
function mergeDetailLines(lines: readonly ReceiptLine[]): ReceiptLine[] {
  const out: ReceiptLine[] = [];
  for (const line of lines) {
    const previous = out[out.length - 1];
    const isDetail =
      line.price !== null &&
      DETAIL_MARKER.test(line.label) &&
      letterCount(line.label.replace(UNIT_WORDS, '')) === 0;
    if (isDetail && previous && previous.price === null && letterCount(previous.label) >= 2) {
      out[out.length - 1] = {
        index: previous.index,
        label: `${previous.label} ${line.label}`,
        price: line.price,
      };
    } else {
      out.push(line);
    }
  }
  return out;
}

function isBarePrice(line: ReceiptLine): boolean {
  return line.price !== null && line.label === '';
}

function parseItem(label: string, price: Cents, digits: number): Omit<ParsedItem, 'line'> {
  let name = label
    .replace(/^\d{4,}\s+/, '')
    .replace(WEIGHT_DETAIL, '')
    .trim();
  let quantity = 1;
  let unitPrice: Cents | null = null;

  const withUnit = name.match(/^(.*?)\s*(\d{1,3})\s*(?:x|×|\*|@)\s*(\S+)$/i);
  const unitFromMatch = withUnit ? trailingUnitPrice(`unit ${withUnit[3]}`, digits) : null;
  if (withUnit && unitFromMatch) {
    name = withUnit[1]!;
    quantity = Number(withUnit[2]);
    unitPrice = unitFromMatch.price;
  } else {
    const leading =
      name.match(/^(\d{1,3})\s*(?:x|×|\*)\s*(.+)$/i) ?? name.match(/^(\d{1,3})\s+(?=[^\d\s])(.+)$/);
    const trailing = leading ? null : name.match(/^(.+?)\s+(?:x|×)\s*(\d{1,3})$/i);
    if (leading) {
      quantity = Number(leading[1]);
      name = leading[2]!;
    } else if (trailing) {
      quantity = Number(trailing[2]);
      name = trailing[1]!;
    }
    const unit =
      quantity > 1 ? trailingUnitPrice(name.replace(/\s*@\s*(?=\S+$)/, ' '), digits) : null;
    if (unit) {
      name = unit.rest;
      unitPrice = unit.price;
    }
  }

  if (quantity < 1) quantity = 1;
  if (unitPrice !== null && times(unitPrice, quantity) !== price) unitPrice = null;
  const tidied = tidyName(name.replace(/(?:\s+(?:[@×*-]|x))+$/i, '').replace(/[\s@*-]+$/, ''));
  return { name: tidied, quantity, unitPrice, price };
}

function merchantOf(lines: readonly ReceiptLine[]): string | null {
  const candidate = lines
    .slice(0, 3)
    .find(
      (line) =>
        line.price === null &&
        letterCount(line.label) >= 3 &&
        !/^\d/.test(line.label) &&
        !looksLikeHeader(line.label),
    );
  return candidate ? tidyName(candidate.label.replace(/\s*#\s*\d+$/, '')) : null;
}
