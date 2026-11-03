# Architecture

Evenly is an Expo app (SDK 58, React Native 0.88, New Architecture) with three layers: screens in `src/app` and `src/features`, a pure domain in `src/money` and `src/receipt`, and a repository layer in `src/data`. Dependencies point inward: screens call the domain and the repository; the domain imports nothing from React or storage.

## Layers

**Domain (`src/money`, `src/receipt`).** Plain TypeScript functions over integers. `allocate` is the only place money is divided. `computeSplit` turns a total plus a split description into shares or a typed error. `netBalances` and `personTotals` read a ledger; `simplifyDebts` turns balances into payments. `parseReceipt` turns OCR lines into a structured receipt with an arithmetic check. These modules have their own ESLint rules (no float literals, no `/`, no rounding calls) and the highest test coverage in the repo.

**Repository (`src/data`).** An async `Repository` interface with two implementations:

- `sqlite/repository.ts`: Drizzle ORM over a synchronous SQLite database. On phones that is expo-sqlite (`openDatabaseSync`, WAL, foreign keys on), migrated on launch with `useMigrations` and the SQL files in `drizzle/`. In tests it is better-sqlite3 with the same migration folder.
- `memory/repository.ts`: a JSON snapshot in memory. The web build restores it from `localStorage` at startup and writes it back after every change.

Both run `validate.ts` before writing and both pass `repository.contract.test.ts`. `useLiveQuery(load, key)` runs a read, subscribes to the repository, and re-runs the read after each write; screens never cache.

**Screens (`src/app`, `src/features`, `src/ui`).** expo-router with typed routes. Screen files are thin: they load a ledger and render a feature component. `src/ui` holds the design tokens (`theme.ts`), the type scale, and shared components (buttons with a press spring, generated avatars, money text with tabular figures, empty-state illustrations, toasts).

## Data model

```mermaid
erDiagram
  people ||--o{ group_members : joins
  groups ||--o{ group_members : has
  groups ||--o{ expenses : contains
  groups ||--o{ settlements : contains
  people ||--o{ expenses : pays
  expenses ||--o{ expense_shares : "split into"
  expenses ||--o| receipts : "itemized by"
  expenses ||--o{ receipt_items : lists
  people {
    text id PK
    text name
    bool is_self
    int created_at
    int updated_at
  }
  groups {
    text id PK
    text name
    text currency
    int created_at
    int updated_at
  }
  group_members {
    text group_id PK
    text person_id PK
    int position
  }
  expenses {
    text id PK
    text group_id FK
    text description
    int amount
    text payer_id FK
    text split_mode
    int spent_at
    int deleted_at
  }
  expense_shares {
    text expense_id PK
    text person_id PK
    int input
    int amount
  }
  receipts {
    text expense_id PK
    text merchant
    int tax
    int tip
    int fees
    int discount
  }
  receipt_items {
    text id PK
    text expense_id FK
    int position
    text name
    int quantity
    int price
    json assignee_ids
  }
  settlements {
    text id PK
    text group_id FK
    text from_id FK
    text to_id FK
    int amount
    int settled_at
    int deleted_at
  }
```

Notes on the shape:

- **Money is INTEGER minor units** everywhere; the group's currency decides the exponent.
- **Shares store both the input and the result.** `input` is what the editor showed (a share count, basis points, an exact amount), so an expense reopens exactly as it was entered; `amount` is what the person owes. Balances only read `amount`, so changing the allocation policy later never rewrites history.
- **Ids are client-generated UUIDs** and every top-level row has `created_at` and `updated_at`. Expenses and settlements are soft-deleted with `deleted_at`, which is also what makes undo a single write.
- **An expense is an aggregate.** Shares, the receipt, and receipt items are rewritten together inside one transaction when the expense is saved, and the expense row's `updated_at` versions all of them. That is the unit a sync layer would merge.
- **`group_members.position`** keeps join order, which drives display order and who absorbs leftover cents after the payer.

## Key flows

### Scanning a receipt into an itemized expense

```mermaid
sequenceDiagram
  actor User
  participant Scan as Scan screen
  participant OCR as expo-text-extractor
  participant Parser as parseReceipt
  participant Draft as Receipt draft store
  participant Assign as Assign screen
  participant Form as Expense form
  participant Repo as Repository

  User->>Scan: Take or choose a photo
  Scan->>OCR: extractTextFromImage(uri)
  OCR-->>Scan: lines (Vision) or blocks (ML Kit)
  Scan->>Parser: parseReceipt(lines, currency)
  Parser-->>Scan: items, charges, printed total, check
  User->>Scan: Fix misread lines (banner shows "Off by" or "adds up")
  Scan->>Draft: start(items, extras, printedTotal)
  Scan->>Assign: navigate
  User->>Assign: Pick a person, tap items
  Assign->>Draft: toggleAssignee(item, person)
  Assign->>Form: Done
  Form->>Form: computeSplit(itemized) and validate
  User->>Form: Add expense
  Form->>Repo: saveExpense(shares, receipt)
  Repo-->>Form: saved (one transaction)
  Form->>Draft: clear()
```

In Expo Go and on the web the first two steps are replaced by pasting text or typing items; everything after `parseReceipt` is identical.

### Saving any expense

```mermaid
sequenceDiagram
  participant Form as Expense form
  participant Editor as evaluateEditor
  participant Money as computeSplit
  participant Repo as Repository
  participant Live as useLiveQuery subscribers

  Form->>Editor: state on every keystroke
  Editor->>Money: total + split input + {payer, seed: expense id}
  Money-->>Editor: shares, or an error (exact-mismatch, unassigned-items, ...)
  Editor-->>Form: shares preview, or "€12.40 still to assign."
  Form->>Repo: saveExpense(input)
  Repo->>Repo: validateExpense (shares sum, members, receipt total)
  Repo->>Repo: transaction: upsert expense, replace shares and items
  Repo-->>Live: notify
  Live->>Repo: re-read ledgers
```

### Settling up

```mermaid
sequenceDiagram
  actor User
  participant Settle as Settle screen
  participant Money as netBalances + simplifyDebts
  participant Repo as Repository

  Settle->>Money: ledger
  Money-->>Settle: at most n - 1 suggested payments
  User->>Settle: Mark as paid
  Settle->>Repo: recordSettlement(from, to, amount)
  Repo-->>Settle: change notification, suggestions recomputed
  Settle-->>User: Toast with Undo (soft-deletes the settlement)
```

### App start

The root layout loads fonts and the repository in parallel while the splash screen stays up. On phones, `useMigrations` applies any pending Drizzle migrations to `evenly.db`; if that fails, the app shows a startup error instead of a half-working UI. On the web, the snapshot is restored from `localStorage`. With `EXPO_PUBLIC_DEMO_DATA=lisbon`, an empty database is seeded through the public repository API, so the sample data obeys the same validation as anything a user enters.

## Platform notes

- **OCR availability** is decided once, at import time, with `requireOptionalNativeModule`. The package is imported lazily so Expo Go never evaluates it.
- **Haptics** are a no-op on web. **Keyboard shortcuts** (`e`, `r`, `s`, `f`, `?`) only register on web.
- **Reduced motion**: Reanimated's springs and layout animations follow the OS setting; the flying avatar chip is skipped entirely when it is on.
- **Dynamic type** is on for all text; the hero and title sizes cap their scale at 1.25x so a balance cannot push the layout off screen.
