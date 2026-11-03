# 0003: Greedy debt simplification with an exact-pair pass

## Context

"Settle up" turns net balances into payments. Paying back every individual IOU is correct but needlessly long; the minimum number of payments is n − k, where k is the largest number of disjoint zero-sum groups the n non-zero balances can be split into. Finding k is a partition problem, NP-hard in general.

## Decision

`simplifyDebts` runs two passes. First it pairs any debtor and creditor with exactly opposite balances. Then it repeatedly matches the largest debtor with the largest creditor for the smaller of the two amounts. Ties break by person id. An exact solver (a bitmask DP over all subsets, O(2^n · n)) lives in the test suite as an oracle.

## Alternatives considered

- **Exact solver in the app.** Feasible up to about 15 people, but its cost doubles with each person and the result can change shape dramatically after one small expense, which makes the suggestions feel unstable.
- **Plain greedy without the pair pass.** Measured: on 400 seeded trip-shaped ledgers per size, it found the optimum in 399 (6 people), 392 (8), 385 (10), and 379 (12) cases. With the pair pass: 400, 395, 386, and 383.
- **Pairwise debts (no simplification).** Easy to explain ("you owe Joana for the groceries"), but a five-person trip quickly needs ten or more payments.

## Consequences

Suggestions are at most n − 1 payments, never route money through a third person, and are stable under input order. In the measured samples the greedy result is never more than one payment above optimal, and the optimality test pins the exact counts so a change to the heuristic shows up in CI and in the README. Payments can go between two people who never shared an expense, which the settle screen explains in one line.
