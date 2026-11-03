# 0001: Integer minor units, a branded type, and lint rules

## Context

Every number in Evenly that means money ends up summed, compared to a printed total, or shown to a friend who will check it. Binary floats cannot represent 0.10 exactly, so `0.1 + 0.2 !== 0.3`, and rounding each share of a split independently loses or invents cents. A ledger that is off by one cent is a ledger nobody trusts.

## Decision

All amounts are safe integers of minor units (cents, pence, whole yen), typed as `Cents = number & { [brand]: true }`. The only way to get a `Cents` is `cents(value)`, which throws on anything that is not a safe integer, or the arithmetic helpers (`add`, `subtract`, `times` by an integer, `sum`). Inside `src/money` and `src/receipt`, ESLint rejects decimal literals, `/`, `Math.round`/`floor`/`ceil`/`trunc`, `parseFloat`, and `toFixed`. Parsing (`parseDecimal`) and formatting (`formatMoney`) work on digit strings; `Intl.NumberFormat` only ever sees the integer number of whole units. The minor-unit exponent per currency is a hard-coded table.

## Alternatives considered

- **A decimal library (decimal.js, dinero.js).** Correct, but it adds a dependency and an object allocation per amount, and arbitrary-precision decimals still need a rounding rule at split time, which is exactly the part that needs to be explicit. Integers plus one allocation function are smaller and easier to reason about.
- **Plain `number` with care.** Works until the first `total / 3`. The brand makes the mistake a type error instead of a code review comment.
- **Reading the exponent from `Intl`.** `resolvedOptions().maximumFractionDigits` is right on modern engines, but it is data from ICU that can differ between platforms. Two devices that disagree about whether JPY has decimals disagree about every stored amount.

## Consequences

Arithmetic is slightly more verbose (`add(a, b)` instead of `a + b` when the result must stay `Cents`). Division only happens in `allocate()`, in BigInt, so every split has one place to look at. The lint rules are scoped to the domain folders; UI code can still divide pixels.
