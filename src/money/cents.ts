declare const centsBrand: unique symbol;

/**
 * An amount of money in integer minor units: cents for EUR and USD, pence for GBP,
 * whole yen for JPY.
 *
 * The brand means a plain `number` cannot be used where money is expected. The only
 * ways in are `cents()` (which rejects anything that is not a safe integer) and the
 * arithmetic helpers in this module, so a stray `price * 1.23` fails to typecheck
 * instead of leaking a float into a balance.
 */
export type Cents = number & { readonly [centsBrand]: true };

/**
 * Brands an integer as money. Throws on fractions, NaN, Infinity, and anything outside
 * the safe integer range, since each of those would silently corrupt a ledger.
 * Negative zero is normalised to zero so it never renders as "-€0.00".
 */
export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Money must be a safe integer number of minor units, got ${value}`);
  }
  return (value === 0 ? 0 : value) as Cents;
}

export const ZERO: Cents = cents(0);

export function add(a: Cents, b: Cents): Cents {
  return cents(a + b);
}

export function subtract(a: Cents, b: Cents): Cents {
  return cents(a - b);
}

export function negate(a: Cents): Cents {
  return cents(-a);
}

export function absolute(a: Cents): Cents {
  return cents(Math.abs(a));
}

/** Multiplies by an integer factor, e.g. a unit price by a quantity. */
export function times(a: Cents, factor: number): Cents {
  if (!Number.isSafeInteger(factor)) {
    throw new RangeError(`Money can only be multiplied by an integer, got ${factor}`);
  }
  return cents(a * factor);
}

export function sum(values: Iterable<Cents>): Cents {
  let total = 0;
  for (const value of values) total += value;
  return cents(total);
}

export function min(a: Cents, b: Cents): Cents {
  return a < b ? a : b;
}
