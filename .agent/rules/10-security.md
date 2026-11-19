# Security Rules (MANDATORY, essential)

Security is the top priority. Think through each item below BEFORE writing any endpoint or page. Deny by default. If a feature cannot satisfy these rules, do not ship it.

## 1. Authentication & sessions
- Hash passwords with **Argon2id** (preferred) or bcrypt (cost >= 12). Never log, return, or store plaintext passwords or hashes in responses.
- Enforce password policy: min 10 chars, reject common passwords.
- JWT: short expiry (15-30 min access token) + refresh rotation if needed; sign with `SECRET_KEY` (>= 32 random bytes) from env; pin the algorithm (HS256), never accept `none`; validate `exp`, `sub`.
- Store tokens ONLY in `HttpOnly; Secure; SameSite=Lax` cookies. NEVER in `localStorage`/`sessionStorage`.
- CSRF: because cookies are used, require a CSRF token or custom header (`X-Requested-With`) on all state-changing requests, and keep `SameSite`.
- Login errors are generic ("Invalid email or password"), no user enumeration; use constant-time comparison.
- Rate-limit `/api/auth/login` (5 failed/min per IP+email) with temporary lockout; rate-limit all write endpoints.
- Deactivated users (`is_active = false`) must be rejected on every request, not just at login.
- No public self-registration; Admin creates members (or invite-only).

## 2. Authorization (Broken Access Control / IDOR)
- Every `/api/*` route except login/health depends on `get_current_user`.
- `/api/admin/*` requires `role == 'admin'` checked server-side via a reusable dependency (`require_admin`).
- NEVER trust `user_id`, `role`, `paid_by`, `from_user` sent by the client when they should come from the session. Derive identity from the token.
- Object-level checks in the SERVICE layer for every read/write:
  - My Bill: filter by `current_user.id` only.
  - Edit/delete expense: `created_by == current_user.id` or admin.
  - Confirm settlement: only `to_user == current_user.id`; payer cannot confirm own payment; cannot confirm twice (state machine).
  - Debt redirect: only `via_middleman == current_user.id`; amounts validated against live debts.
  - Cleaning approval: admin or member of the NEXT group only; a member cannot approve their own group's turn.
  - Penalties/fulfillment: admin only.
- Return 404 (not 403) for objects the user must not know exist, where sensible.
- Add tests: unauthenticated -> 401, wrong role -> 403, other user's object -> 403/404.

## 3. Input validation & injection
- All request bodies/params validated by **Pydantic v2** with strict types: `amount_cents: int = Field(gt=0, le=<sane max>)`, enums via `Literal`/`Enum`, string `max_length`, phone regex `^94\d{9}$`, lists with `min_length=1` and no duplicate participant IDs.
- Verify every referenced user/expense ID exists and is active.
- Database access via **SQLAlchemy ORM / bound parameters only**. NO f-string/concatenated SQL. Ever.
- Reject unexpected fields (`model_config = ConfigDict(extra="forbid")`).
- Use idempotency / double-submit protection for payments and expenses.

## 4. XSS & frontend safety
- Never use `dangerouslySetInnerHTML`, `eval`, `new Function`, or `innerHTML`.
- Encode data in WhatsApp links: `encodeURIComponent` for message; validate phone from DB, never from the URL.
- Do not render user-supplied URLs without validating the scheme (`https:` only).
- Keep dependencies minimal; run `npm audit` and `pip-audit` before deploy; pin versions.
- No secrets in frontend code or `VITE_*` env vars (they are public).

## 5. Transport, headers, CORS
- HTTPS only (Vercel). Cookies `Secure`.
- Headers on all responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (disable camera/mic/geolocation), `Strict-Transport-Security: max-age=63072000; includeSubDomains`, and a restrictive `Content-Security-Policy` (`default-src 'self'`; no inline scripts).
- CORS: explicit allowlist (deployed frontend origin + `http://localhost:5173` in dev). NEVER `allow_origins=["*"]` with credentials.
- Disable API docs (`/docs`, `/redoc`, `/openapi.json`) in production.

## 6. Data protection & privacy
- Principle of least data: responses return only needed fields (separate response schemas; never return `password_hash`).
- Other members' phone numbers are visible only to admin (needed for reminders).
- Private routes are `noindex`, blocked in `robots.txt`; `robots.txt` is NOT security, auth is.
- Backups and DB credentials: Neon role with minimum privileges; rotate secrets if leaked.

## 7. Secrets & configuration
- `.env` is gitignored; commit only `.env.example` with fake values.
- Load config once in `config.py` (Pydantic Settings); fail fast if `SECRET_KEY`/`DATABASE_URL` is missing.
- Never print secrets in logs or error messages.

## 8. Error handling, logging, audit
- Production errors return generic messages with a correlation ID; no stack traces, SQL, or schema info.
- Global exception handler; log details server-side only (no PII or passwords).
- `audit_log` records: expense edit/delete, settlement create/confirm/reject, debt transfer, turn approval, penalty add/fulfil, role/user changes (who, what, entity, details JSON).
- Financial tables are append-only/soft-delete; no hard deletes of money records.

## 9. Concurrency & integrity (security of money)
- Use DB transactions and row locks (`SELECT ... FOR UPDATE`) when confirming settlements, redirecting debts, and approving turns to prevent race conditions/double-spend.
- Enforce rules also at DB level: `CHECK` constraints, `NOT NULL`, foreign keys, partial unique index for "only one active cleaning turn".
- Pending/confirmed state changes must follow the State Machine (see design patterns); invalid transitions return 409.

## 10. PWA / offline security
- Service worker caches static assets only. Never cache `/api/*` responses with private data. No offline write queue.
- Clear client state on logout.

## Security review gate (before finishing any feature)
Answer yes to ALL, otherwise fix first:
- [ ] Is the route authenticated and role/ownership checked server-side?
- [ ] Is every input validated with a strict Pydantic schema?
- [ ] Is every query parameterized (ORM)?
- [ ] Does the response expose only necessary fields?
- [ ] Are money changes in a transaction with an audit log entry?
- [ ] Is there a negative test (401/403/404/409/422)?
- [ ] Are there no secrets, tokens in localStorage, or `dangerouslySetInnerHTML`?
