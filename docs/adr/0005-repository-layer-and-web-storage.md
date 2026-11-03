# 0005: A repository interface, SQLite on phones, a memory store on the web

## Context

Data has to persist locally with migrations (expo-sqlite plus Drizzle on iOS and Android), the web build has to run for demos and screenshots, and the code that computes balances should not care where rows come from. The app also needs some cross-screen state for a receipt that is being reviewed and assigned before it becomes an expense.

## Decision

Screens talk to a `Repository` interface (`src/data/types.ts`). `createSqliteRepository` implements it with Drizzle over any synchronous SQLite driver: expo-sqlite in the app, better-sqlite3 in tests, both applying the same generated migrations. `createMemoryRepository` implements it over a JSON snapshot that the web build saves to `localStorage` after every write. One contract test suite runs against both. Both validate writes with the same functions, so an expense whose shares do not add up never reaches storage. Reads go through `useLiveQuery`, which re-runs after every write. The receipt draft lives in a small Zustand store; everything else is local component state or comes from the repository.

## Alternatives considered

- **expo-sqlite on web.** Supported, but it needs SharedArrayBuffer and therefore `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers, which a static host for `expo export` output cannot be assumed to send.
- **Drizzle's `useLiveQuery`.** Tied to expo-sqlite change events, so it would not work with the memory store, and it would put query code in components.
- **A global store (Zustand, Redux) holding all groups.** Duplicates the database in memory and adds invalidation logic. The data set is small enough that re-reading a ledger after a write is cheap.
- **Passing the receipt draft through route params.** Items and assignments do not fit in a URL, and the draft has to survive going back and forth between three screens.

## Consequences

The web build is the same UI code with a different store, which is what the screenshots show. Repository methods are async even though both implementations are synchronous today, so a sync engine or an async driver can slot in. The memory store is not meant for large data sets; it copies the snapshot on every read.
