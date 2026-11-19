# Project Core Rules: Boarding Management System

Source of truth: `boarding_management_system_srs_markdown.md`. Read the relevant SRS section BEFORE writing any code. If code and SRS conflict, stop and ask the user.

## Stack
- Frontend: React (Vite) + Tailwind + PWA (`vite-plugin-pwa`), Vercel static.
- Backend: FastAPI (Python) on Vercel serverless, SQLAlchemy ORM, Pydantic v2.
- DB: Neon PostgreSQL (`pool_pre_ping=True`).
- Tests: `pytest` (backend). Every money/cleaning/penalty rule needs a test.

## Folder structure
```
backend/app/
  main.py            # app creation, middleware, router registration only
  config.py          # settings from env (single source)
  database.py        # engine + session
  models.py          # SQLAlchemy models
  schemas/           # Pydantic request/response models
  routers/           # thin HTTP handlers (no business logic)
  services/          # business logic, transactions, authorization checks
  repositories/      # DB queries only
  money.py           # PURE math, no DB/IO imports
  security.py        # hashing, JWT, cookies, rate limit
backend/tests/
frontend/src/{pages,components,hooks,services,context,utils}/
```

## Money invariants (never break)
1. Money = integer cents. NEVER `float`, never `Decimal` for storage. Convert to Rs. only for display.
2. Balances are NEVER stored; always computed from expenses, splits, confirmed settlements, debt_transfers.
3. Saving an expense + splits = ONE DB transaction; assert `sum(splits) == total_cents` before commit, else rollback.
4. Zero-sum check on every balance computation; if not 0, block response and log critical error.
5. 2-person mutual offset is automatic. 3-person chain collapse is NOT automatic; only the middleman B may redirect via a `debt_transfer` (limited to min(A owes B, B owes C)); A must see a transparency notice.
6. Settlements are two-party: payer creates `pending`; only the receiver (`to_user`) can confirm. Pending never reduces a balance.
7. Deletes are soft (`deleted_at`). Edits/deletes/approvals/transfers are written to `audit_log`.

## Workflow rules for the agent
- Work in small steps; explain each step simply (the user is a beginner).
- Write the test first (or together) for any business rule.
- Never commit secrets. Never hard-code `DATABASE_URL`/`SECRET_KEY`.
- After coding, run `python -m pytest -v` and report results honestly.
- Finish the pre-code checklist in `.agent/skills/pre-code-checklist/SKILL.md` before each feature.
