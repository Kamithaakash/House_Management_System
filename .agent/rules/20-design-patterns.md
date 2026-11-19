# Design Patterns Rules

Use patterns to solve a real problem, not for decoration. Name the pattern in a short comment/docstring where used. Keep it simple for a beginner codebase.

## Backend patterns

| Pattern | Where to use | Rule |
|---|---|---|
| **Layered / Service + Repository** | All backend features | Router -> Service -> Repository -> DB. Routers only parse/return HTTP. Services hold business rules and authorization. Repositories hold SQLAlchemy queries only. |
| **Pure Functional Core** | `money.py` | No DB, no HTTP, no `datetime.now()` inside. Inputs in, outputs out. Fast pytest. |
| **Strategy** | Expense splitting (`EqualSplit`, `PerPersonSplit`); penalty redemption (`CashFine`, `MaterialRedemption`) | Common interface `compute(...) -> dict[user_id, cents]`; all strategies must pass the sum-equals-total assertion. |
| **State Machine** | `settlements` (pending -> confirmed/rejected); `cleaning_turns` (active/overdue -> pending_approval -> completed); `penalty_obligations` (pending -> fulfilled) | Central dict of allowed transitions; invalid -> HTTP 409. Never set status ad hoc. |
| **Factory** | Creating the next cleaning turn; creating penalty obligation from threshold; building WhatsApp messages | One function builds a valid object with defaults (7-day due date, fine amount copy). |
| **Unit of Work (transaction per request)** | Saving expense + splits; confirming settlement; redirecting debt | One session/transaction; commit once; rollback on any failed assertion. |
| **Dependency Injection** | FastAPI `Depends` | `get_db`, `get_current_user`, `require_admin`, settings. Makes tests easy (override dependencies). |
| **Singleton (via module/`lru_cache`)** | Settings, DB engine | `@lru_cache` on `get_settings()`; one engine, pooled. |
| **Flyweight** | Shared immutable lookup data: food types, curry types, statuses, roles, penalty reasons, member list lookups | Define enums/constants ONCE (frozen dataclass / `Enum`) and reuse the same object everywhere; cache the member `id -> name` map per request instead of re-querying/copying per row. Never create duplicate copies per expense row. |
| **Observer / Domain events (light)** | After expense/settlement/transfer: write `audit_log`; after 3rd penalty point: create obligation | Simple function hooks called by the service after commit-safe steps; no heavy frameworks. |
| **Append-only Ledger / Audit** | `audit_log`, `penalty_ledger`, `debt_transfers` | Insert only; corrections are reversing entries. |
| **Proxy (guard)** | Authorization | `require_admin`, `require_owner_or_admin` dependencies wrap services. |
| **Builder** | Reminder message per debtor | Assemble debts + penalties into one message step by step, then `encodeURIComponent`. |

## Frontend patterns

| Pattern | Where to use | Rule |
|---|---|---|
| **Lazy Loading / Code Splitting** | Routes | `React.lazy` + `Suspense`; only `/` and `/login` in the main bundle. |
| **Container/Presentational + Custom Hooks** | All pages | Hooks (`useAuth`, `useExpenses`, `useBalances`, `useOnlineStatus`) hold logic; components are dumb and reusable. |
| **Flyweight (frontend)** | Constants & icons: food types, status badges, formatters | One shared constants module and one shared `Intl.NumberFormat` instance (formatCents) reused everywhere; avoid recreating objects per render/row. |
| **Memoization** | Live share preview, totals, long lists | `useMemo`/`useCallback`/`React.memo`; keys stable. |
| **Context Provider (Singleton state)** | Auth, toast notifications | One `AuthContext`; avoid prop drilling. |
| **Adapter / API Client (Facade)** | `services/api.js` | One fetch wrapper: base URL, credentials, CSRF header, error normalization, 401 handling. Components never call `fetch` directly. |
| **Guard / Higher-Order Route** | `ProtectedRoute`, `AdminRoute` | UI hide only; server still enforces. |
| **Debounce/Throttle + Double-submit guard** | Inputs, submit buttons | Disable while pending or offline. |
| **Stale-While-Revalidate** | PWA app shell | Cache static shell; never private API data. |
| **Virtualization / Pagination** | Long bill histories | Paginate API (`limit`, `offset`, capped max) and render lists efficiently. |

## Performance optimization checklist
- Index DB columns used in filters: `expenses(paid_by, expense_date)`, `expense_splits(expense_id, user_id)`, `settlements(from_user, to_user, status)`, `cleaning_turns(status)`.
- Avoid N+1 queries (use `selectinload`/joins); compute balances with aggregated SQL or a single pass in memory.
- Paginate all list endpoints; cap page size.
- Serverless cold starts: lightweight imports, reuse engine at module level.
- Frontend: small bundle, lazy routes, optimized images (`alt`, width/height), no unnecessary re-renders.

## Anti-patterns to avoid
- Business logic inside routers or React components.
- Global mutable state, God classes, copy-paste splitting logic.
- Float money; stored balances; status strings scattered as literals (use enums).
- Premature abstraction: add a pattern only when two or more cases exist or it protects an invariant.
