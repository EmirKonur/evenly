# Contributing

## Setup

```bash
pnpm install                              # Node 22+, pnpm 9 (see .nvmrc and packageManager)
EXPO_PUBLIC_DEMO_DATA=lisbon pnpm web     # browser, port 4511, sample groups
pnpm start --go                           # Expo Go, port 4510 (no photo OCR)
pnpm ios                                  # development build with OCR (Xcode required)
```

Copy `.env.example` to `.env` if you want the demo data on every start.

## Scripts

| Script                              | What it does                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm lint`                         | ESLint (expo config, Prettier-compatible), zero warnings allowed             |
| `pnpm format` / `pnpm format:check` | Prettier                                                                     |
| `pnpm typecheck`                    | Generates typed routes (`expo customize tsconfig.json`), then `tsc --noEmit` |
| `pnpm test` / `pnpm test:coverage`  | Jest: `domain` (Node) and `ui` (jest-expo) projects                          |
| `pnpm db:generate`                  | Generates a Drizzle migration after editing `src/data/sqlite/schema.ts`      |
| `pnpm export:web`                   | Static web build into `dist/`                                                |

## Conventions

- **Money is integer minor units.** Use `Cents` and the helpers in `src/money`. Never divide money outside `allocate()`; the linter rejects float literals, `/`, and rounding calls in `src/money` and `src/receipt`.
- **Every split must sum to its total.** If you add a split mode, add a fast-check property for it next to the others in `split.test.ts`.
- **Receipt parser changes come with a fixture.** Add the OCR text to `src/receipt/__fixtures__/` and its expectations to `fixtures.test.ts`. Write fixtures as the OCR engine returns them, typos included.
- **Schema changes go through migrations.** Edit `schema.ts`, run `pnpm db:generate`, and commit the SQL. The repository contract tests apply the same migrations to a real SQLite database.
- **Both repositories must pass the contract suite.** New repository methods need tests in `repository.contract.test.ts`.
- **Screens stay thin.** Load data in the route file, put behavior in `src/features`, and keep shared visuals in `src/ui` using the tokens in `theme.ts`.
- Comments explain why, not what. Commit messages are imperative and short ("Pool tax and tip before allocating").
