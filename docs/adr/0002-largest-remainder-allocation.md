# 0002: Largest remainder allocation and who gets the leftover cent

## Context

Every split mode (equal, shares, percent, itemized) eventually has to divide an integer total into integer parts proportional to some weights. The parts must sum to the total exactly, stay as close as possible to the exact proportions, and be identical on every device that computes them, because balances are derived from stored shares and a future sync layer must not see two versions of the same expense.

## Decision

`allocate(total, weights, { priority })` implements the largest remainder (Hamilton) method in BigInt: floor every exact quota, then hand the missing units to the largest remainders. Equal remainders are broken by a priority list. For expenses, `leftoverPriority` puts the payer first and orders everyone else by a rotation derived from an FNV-1a hash of the expense id (and of the item id for itemized lines). Itemized splits pool tax, tip, fees, and discount and allocate the pool once by item subtotal.

## Alternatives considered

- **Round each share, give the difference to the first person.** Simple, but the first person in the list pays the extra cent on every expense, forever.
- **Random tie-breaking.** Fair on average, but two devices would compute different shares for the same expense.
- **Banker's rounding per share.** Still does not guarantee the parts sum to the total.
- **Allocating tax and tip separately.** Makes the per-person breakdown slightly more detailed, but can stack two rounding units on one person. Pooling keeps everyone within one unit of their exact share.

## Consequences

Splits are deterministic and sum exactly, which property tests check on thousands of random inputs. The payer-first rule is a product opinion: it means the person who fronted the money covers the odd cent, which matches how people settle in practice. Changing the hash or the rotation would change historical shares, so stored shares are kept as the source of truth rather than recomputed on read.
