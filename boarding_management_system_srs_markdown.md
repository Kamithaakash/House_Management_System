# Software Requirements Specification (SRS): Boarding Management System (v1.1)

## 1. Introduction

### 1.1 Purpose

This document specifies the functional, algorithmic, non-functional, and architectural requirements for the **Boarding Management System**, a mobile-friendly web application for a single boarding house. Its primary goal is to eliminate manual calculation errors, missing participants in expense splits, and disputes over shared money and house cleaning.

### 1.2 System Architecture (100% Free Tier)

* **Frontend:** React (Vite) + Tailwind CSS, configured as a **Progressive Web App (PWA)** via `vite-plugin-pwa` and hosted on Vercel (static site).

* **Backend:** FastAPI (Python), hosted on Vercel (serverless functions).

* **Database:** Neon PostgreSQL (Free tier, 1 GB storage, pooled connections with `pool_pre_ping=True`).

* **Notifications:** Manual Admin-triggered WhatsApp `wa.me` links (no paid API or separate phone number required).

## 2. User Roles & Permissions

| Role | Permissions | 
| ----- | ----- | 
| **Admin** | Manage house members (add/remove/edit phone numbers), configure cleaning groups and rotation order, set penalty thresholds and fine amounts, approve completed cleaning turns, issue/clear penalty obligations, and send WhatsApp reminders. | 
| **Member** | Log Food and Other Material expenses, view their own itemized personal bill, view simplified balances, record payments made, confirm payments received, and mark their group's cleaning turn as done. | 

## 3. Functional Requirements

### 3.1 Module A: Money Sharing (Food, Bills & Other Materials)

The "Add Expense" screen shall support five expense sections for any logged-in **Admin or Member**. Across **all sections** (`food`, `boarding_fee`, `electric_bill`, `water_bill`, `material`), the creator can select via checkboxes **which members are included or excluded**, choose equal split or per-person assignment, and see a live preview of each person's exact share before saving (minimum 1 participant required).

1. **Food Section (`food`)**

   * **Food Type:** Required selection (`Rice & Curry`, `Fried Rice`, `Kottu`, `Other`).

   * **Curry Sub-Type:** Required when `Rice & Curry` is selected (`Veg`, `Egg`, `Fish`, `Meat`).

   * **Assignment:** Supports either **per-person assignment** (e.g., Person A: Fish Rice & Curry Rs. 450; Person B: Veg Rice & Curry Rs. 350) or **shared equal split** among the selected participants.

2. **Monthly Bills & Other Materials (`boarding_fee`, `electric_bill`, `water_bill`, `material`)**

   * **Fields:** Section Type (`Monthly Boarding Fee`, `Electricity Bill`, `Water Bill`, or `Other Material`), Item/Bill Description (e.g., *March Electricity, Dish Soap, Broom*), Total Amount, Date, and Buyer/Payer (`paid_by`).

   * **Participant Selection:** Checkboxes for selecting included/excluded members with equal or per-person split and live share preview.

3. **Edit & Delete Rules**

   * Only the expense creator or Admin may edit or delete an expense.

   * Deletions must be **soft-deletes** (`deleted_at` timestamp), and all edits/deletes must be logged in `audit_log`.

### 3.2 Module B: Financial Math & Bug-Prevention Logic

To prevent calculation errors and missing-member bugs, the backend must strictly enforce the following invariants:

1. **Integer Cents Only:** Every monetary value must be stored and calculated as an integer in cents (e.g., `Rs. 50.00` = `5000`). Floating-point (`float`) arithmetic is strictly forbidden for money.

2. **Dynamic Balances (Never Stored as Truth):** A user's balance is **never** stored as a static database column. It is always computed live from `expenses`, `expense_splits`, and `confirmed` `settlements`.

3. **Exact Split Verification (No Dropped Members):**

   * When dividing `total_cents` equally among $N$ selected participants:
     

     $$
     \text{base\_share} = \lfloor \text{total\_cents} / N \rfloor, \quad \text{remainder} = \text{total\_cents} \bmod N
     $$

   * The remainder cents (at most $N - 1$ cents) are distributed 1 cent at a time to the first `remainder` participants (or the payer).

   * **Database Transaction Rule:** Saving an expense and all its `expense_splits` must occur inside a single **ACID database transaction**. Before committing, FastAPI must assert:
     

     $$
     \sum \text{expense\_splits.share\_cents} == \text{expense.total\_cents}
     $$

     
     If this check fails, the transaction rolls back immediately.

4. **Pairwise Mutual Offset & Manual Debt Redirect:**

   * Balances are tracked **pairwise** between each pair of members $(u, v)$ from:
     1. `expenses` & `expense_splits` (each split where $v$ paid and $u$ participated adds to what $u$ owes $v$),
     2. `confirmed` `settlements` (reduces what $u$ owes $v$), and
     3. `debt_transfers` (manual redirects initiated by a middleman).

   * **Automatic Pairwise Mutual Offset (2 people):** If A owes B Rs. 50 and B owes A Rs. 30, the system automatically offsets their direct pair balance to **A owes B Rs. 20**.

   * **No Automatic Chain Collapse (3+ people):** If A owes B Rs. 50 and B owes C Rs. 50, the system **does not** automatically skip B. By default, A still owes B Rs. 50, and B still owes C Rs. 50.

   * **Manual Debt Redirect (Initiated by Middleman B):** From B's portal, B has an option to manually redirect/transfer the debt so A pays C directly (up to $\min(\text{A owes B}, \text{B owes C})$). When B submits this:
     * A's debt to B decreases by the transferred amount, B's debt to C decreases by the transferred amount, and A now owes C that amount.
     * **Zero-Sum Integrity Check:** Every calculation and transfer must preserve $\sum_{u} \text{NetBalance}(u) == 0$. If not `0`, block the response and log a critical error.
     * **Transparency for A:** A's portal clearly displays a notice showing that B redirected the payment to C (e.g., *"B transferred Rs. 50 of your debt to C because B owed C"*).

### 3.3 Module C: Personal "Shop-Bill" View & Two-Party Settlement

1. **Personal Itemized Bill (Privacy & Clarity)**

   * The **My Bill** screen filters `expenses` and `expense_splits` to display **only** transactions where `paid_by == current_user` OR `current_user` is in `expense_splits`. Unrelated expenses between other housemates are hidden.

   * Formatted like a **shop receipt**:

     * **Date | Item / Food Type | Paid By | Total Bill | Your Share | Status**

     * Footer summary: **Total You Owe**, **Total Owed to You**, and **Final Net Amount to Pay/Receive**.

2. **Two-Party Settlement Confirmation**

   * When Person B pays Person A, Person B submits a settlement record (`from_user = B`, `to_user = A`, `amount_cents`, `status = pending`).

   * The balance does **not** clear until Person A (the receiver) clicks **"Confirm Received"**, updating status to `confirmed` and recording `confirmed_at`.

   * While `pending`, the UI displays a *"Pending Confirmation"* badge to prevent duplicate payments.

### 3.4 Module D: Group-Based Blocking Cleaning Queue

1. **Group Configuration:** Admin creates ordered groups (e.g., `Group 1`, `Group 2`, `Group 3`) with `rotation_order = 1, 2, 3...` and assigns members to each group.

2. **Single Active Turn Rule:** Only **one** `cleaning_turn` may have status `active`, `overdue`, or `pending_approval` at any time.

3. **Blocking Logic:**

   * Each turn has a 7-day `due_date`.

   * If `current_date > due_date` and the turn is not completed, status becomes `overdue`. **The next group is strictly blocked** and cannot be assigned.

   * When the active group finishes, a member clicks **"Mark Done"**.

   * **Verification:** Either the **Admin** or **1 member from the next group** must click **"Approve"**. Only upon approval does the current turn become `completed` and the system automatically creates the next group's 7-day `active` turn.

### 3.5 Module E: Cleaning Penalty & Redemption System

1. **Individual Penalty Points:** When a turn is overdue or a member skips their group's cleaning duty, the Admin records penalty points (e.g., `+1`) in an append-only `penalty_ledger` against that specific user.

2. **Threshold Trigger:** The Admin sets a `penalty_threshold` (e.g., `3` points) and `default_fine_cents` (e.g., `Rs. 500`). When a user's sum of active penalty points reaches `>= threshold` and they have no pending obligation, the system automatically creates a `pending` record in `penalty_obligations`.

3. **Redemption Options:** To clear the obligation, the user must either:

   * **Pay Cash Fine:** Pay the configured fine amount, OR

   * **Bring Cleaning Materials:** Bring a required item (e.g., *Harpic, toilet brush, broom, or soap*).

4. **Fulfillment & Reset:** Once the Admin verifies receipt of the cash or material, the obligation is marked `fulfilled`, and a reversing entry (`-threshold` points) is appended to `penalty_ledger`.

### 3.6 Module F: Admin WhatsApp Reminder System

* In the Admin Panel, clicking **"Generate Reminders"** calls `GET /api/admin/reminders`.

* FastAPI computes all simplified debts and checks for any `pending` `penalty_obligations`, grouping everything into **one combined message per debtor**.

* The Admin Panel displays each debtor with a **"Send via WhatsApp"** button opening `https://wa.me/<phone>?text=<encoded_message>` using the Admin's own WhatsApp, tracking clicked buttons in session state.

## 4. Non-Functional Requirements: SEO & Progressive Web App (PWA)

### 4.1 SEO & Crawlability Architecture

The application shall separate public discovery routes from private boarding house data:

* **Public Routes (Indexed):** The landing page (`/`), features overview, and login/join page shall be crawlable and optimized for search engines and link previews.

* **Private Routes (Blocked from Indexing):** All authenticated routes (`/dashboard`, `/my-bill`, `/balances`, `/chores`, `/admin`, `/api/*`) must be blocked from search engines using `public/robots.txt` (`Disallow`) and `<meta name="robots" content="noindex, nofollow" />`.

* **Metadata & Social Previews (`index.html`):** Include semantic `<title>`, `<meta name="description">`, and Open Graph tags (`og:title`, `og:description`, `og:image`) so URLs shared in WhatsApp groups display a clean preview card.

* **Semantic HTML & Crawl Files:** Enforce proper heading hierarchy (`<h1>`, `<h2>`), descriptive button labels, `alt` attributes on images, and include `public/robots.txt` and `public/sitemap.xml`.

* **Future SaaS Expansion Note:** If the project expands into a public multi-house platform with marketing/content pages in Phase 5, public routes may be migrated to Next.js for Server-Side Rendering (SSR).

### 4.2 Progressive Web App (PWA) Requirements

The frontend shall be installable as a mobile app on Android and iOS without app store fees:

* **Web App Manifest (`vite-plugin-pwa`):**

  * `display: "standalone"` so the installed app launches full-screen without the browser address bar.

  * Defined `name`, `short_name`, `theme_color`, `background_color`, and PNG app icons (`192x192` and `512x512`) stored in `public/`.

* **HTTPS & Automatic Updates:** Served over HTTPS via Vercel with `registerType: 'autoUpdate'` so all housemates receive bug fixes automatically on next launch without redistributing `.apk` files.

* **Online-First Financial Integrity:** The service worker may cache static UI assets (HTML, CSS, JS, icons) for fast startup, but **must not** queue or allow offline writes for expenses, settlements, or cleaning approvals. If the device loses internet connectivity, the UI must display a clear *"No internet connection"* banner and disable form submissions to prevent conflicting balances.

* **Mobile UX Speed:** Touch-friendly inputs and mobile-responsive layouts designed so logging a food or material expense takes under 10 seconds.

### 4.3 Software & Webpage Optimization Design Patterns

To keep the codebase clean, maintainable, and fast on mobile devices, the system shall apply the following design patterns:

#### Frontend (React + Vite + PWA) Optimization Patterns
* **Route-Based Code Splitting & Lazy Loading (`React.lazy` + `Suspense`):** Public routes (`/`, `/login`) load immediately for fast First Contentful Paint (FCP), while authenticated modules (`/my-bill`, `/balances`, `/chores`, `/admin`) are lazy-loaded on demand to minimize initial bundle size.
* **Custom Hooks + Presentational Component Pattern:** Business logic, API calls, authentication state (`useAuth`), and network monitoring (`useOnlineStatus`) are isolated inside custom React hooks, keeping UI components (`ReceiptCard`, `ExpenseForm`, `OfflineBanner`) stateless, reusable, and easy to test.
* **Memoization for Live Previews (`useMemo`):** Live expense share previews and bill totals are memoized so typing amounts or toggling participant checkboxes re-renders smoothly without lag.
* **App Shell Caching + Stale-While-Revalidate (PWA):** Static UI shell assets (HTML, CSS, JS, icons) are cached by the service worker for instant mobile launch, while live financial/cleaning data is always fetched fresh from the API.
* **Double-Submit & Offline Guard Pattern:** Mutation buttons (Add Expense, Confirm Received, Approve Turn, Redirect Debt) lock during in-flight requests and disable when `navigator.onLine` is `false` to prevent duplicate entries.

#### Backend (FastAPI + PostgreSQL) Architecture Patterns
* **Repository / Service Layer Pattern:** Database queries (SQLAlchemy) are separated from FastAPI route handlers and pure financial math (`money.py`), keeping serverless endpoints thin and enabling fast, database-free `pytest` unit tests.
* **Strategy Pattern:** Expense splitting (`EqualSplit` vs. `PerPersonSplit`) and penalty redemption (`CashFine` vs. `MaterialRedemption`) use interchangeable strategy functions sharing a common validation contract.
* **State Machine Pattern:** `cleaning_turns` (`active` -> `pending_approval` -> `completed`, or `overdue` -> `pending_approval` -> `completed`) and `settlements` (`pending` -> `confirmed` | `rejected`) enforce strict allowed state transitions on the server.
* **Append-Only Ledger & Audit Pattern:** Financial accountability and penalties use immutable history records (`audit_log`, `penalty_ledger`, `debt_transfers`) rather than silent overwrites, ensuring full traceability.

### 4.4 Application Security & Vulnerability Prevention

To protect user accounts and financial records against common web vulnerabilities (OWASP Top 10), the system shall enforce the following security controls:

* **Password & Session Security:**
  * Passwords must be hashed using **Argon2** or **bcrypt** (never stored in plaintext or fast hashes like MD5/SHA256).
  * Authentication uses short-lived **JWT** tokens stored in **`HttpOnly`, `Secure`, `SameSite=Lax` cookies** (preventing XSS token theft from `localStorage`).
* **Strict Authorization & IDOR Prevention (Broken Object Level Authorization):**
  * Every private `/api/*` endpoint requires a valid authenticated user (`get_current_user`).
  * **Role-Based Access Control (RBAC):** All `/api/admin/*` routes strictly verify `current_user.role == 'admin'`.
  * **Ownership & Party Checks:**
    * **My Bill:** Filtered server-side using `current_user.id` (never trusting a client-supplied `user_id` parameter).
    * **Edit/Delete Expense:** Allowed only if `expense.created_by == current_user.id` or `current_user.role == 'admin'`.
    * **Confirm Settlement:** Only `settlement.to_user == current_user.id` can confirm receipt (a payer cannot confirm their own payment).
    * **Manual Debt Redirect:** Only `via_middleman == current_user.id` can initiate a transfer of their own debt/credit.
    * **Cleaning Turn Approval:** Only `admin` or a member of the **next** cleaning group can approve a turn.
* **Injection & XSS Prevention:**
  * All database queries must use **SQLAlchemy ORM parameterized queries**; raw string-concatenated SQL is strictly forbidden (prevents SQL Injection).
  * All API request bodies are validated with **Pydantic v2** schemas (strict types, positive `amount_cents > 0`, valid enums, phone regex, max string lengths).
  * React JSX auto-escaping must be preserved; `dangerouslySetInnerHTML` is forbidden (prevents XSS).
* **CORS, Security Headers & Rate Limiting:**
  * **CORS:** Allow only the exact deployed Vercel frontend origin and `http://localhost:5173` in development (never `*` with credentials).
  * **Security Headers:** Configure `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive `Content-Security-Policy` (CSP) in `vercel.json` / FastAPI middleware.
  * **Brute-Force Protection:** Rate-limit `/api/auth/login` (e.g., max 5 failed attempts per minute per IP/email).
* **Secrets & Safe Error Handling:**
  * `DATABASE_URL` and `SECRET_KEY` must live only in `.env` (gitignored) and Vercel Environment Variables.
  * Production API errors must return generic messages (never exposing database schemas, SQL queries, or stack traces).

## 5. Database Schema (Neon PostgreSQL)

```
-- Users & Auth
users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20),                  -- Format: 94771234567 (no '+')
  password_hash TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'member',  -- 'admin' | 'member'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
)

-- Money Sharing
expenses (
  id SERIAL PRIMARY KEY,
  paid_by INT REFERENCES users(id) NOT NULL,
  section VARCHAR(20) NOT NULL,       -- 'food' | 'boarding_fee' | 'electric_bill' | 'water_bill' | 'material'
  item_name VARCHAR(150) NOT NULL,
  food_type VARCHAR(30),              -- 'rice_curry' | 'fried_rice' | 'kottu' | 'other'
  curry_type VARCHAR(20),             -- 'veg' | 'egg' | 'fish' | 'meat'
  total_cents INT NOT NULL CHECK (total_cents > 0),
  expense_date DATE NOT NULL,
  created_by INT REFERENCES users(id) NOT NULL,
  deleted_at TIMESTAMP                -- Soft delete
)

expense_splits (
  id SERIAL PRIMARY KEY,
  expense_id INT REFERENCES expenses(id) NOT NULL,
  user_id INT REFERENCES users(id) NOT NULL,
  share_cents INT NOT NULL CHECK (share_cents >= 0)
)

settlements (
  id SERIAL PRIMARY KEY,
  from_user INT REFERENCES users(id) NOT NULL,
  to_user INT REFERENCES users(id) NOT NULL,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'confirmed' | 'rejected'
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP
)

debt_transfers (
  id SERIAL PRIMARY KEY,
  from_debtor INT REFERENCES users(id) NOT NULL,   -- A (who pays)
  via_middleman INT REFERENCES users(id) NOT NULL, -- B (who initiates the transfer)
  to_creditor INT REFERENCES users(id) NOT NULL,   -- C (who receives)
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  created_at TIMESTAMP DEFAULT NOW()
)

-- Cleaning Queue & Penalties
cleaning_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  rotation_order INT UNIQUE NOT NULL
)

cleaning_group_members (
  group_id INT REFERENCES cleaning_groups(id),
  user_id INT REFERENCES users(id),
  PRIMARY KEY (group_id, user_id)
)

cleaning_turns (
  id SERIAL PRIMARY KEY,
  group_id INT REFERENCES cleaning_groups(id) NOT NULL,
  status VARCHAR(20) NOT NULL,        -- 'active' | 'overdue' | 'pending_approval' | 'completed'
  due_date DATE NOT NULL,
  completed_at TIMESTAMP,
  approved_by INT REFERENCES users(id)
)

house_settings (
  id INT PRIMARY KEY DEFAULT 1,
  penalty_threshold INT DEFAULT 3,
  default_fine_cents INT DEFAULT 50000
)

penalty_ledger (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) NOT NULL,
  turn_id INT REFERENCES cleaning_turns(id),
  points INT NOT NULL,                -- Positive for penalty, negative for clearance
  reason TEXT NOT NULL,
  created_by INT REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
)

penalty_obligations (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) NOT NULL,
  redemption_type VARCHAR(20),        -- 'cash' | 'material'
  amount_cents INT,
  material_name VARCHAR(100),         -- e.g., 'Harpic', 'Toilet Brush'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'fulfilled'
  created_at TIMESTAMP DEFAULT NOW(),
  fulfilled_at TIMESTAMP,
  verified_by INT REFERENCES users(id)
)

audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
)

```

## 6. Mandatory Verification & Test Cases

Before deploying to Vercel, the backend (`pytest`) and frontend must pass these checks:

| Test Case | Input / Condition | Expected Output | 
| ----- | ----- | ----- | 
| **Mutual Offset** | A owes B Rs. 50; B owes A Rs. 30 | Auto-offset: **A pays B Rs. 20** | 
| **No Auto Chain Collapse** | A owes B Rs. 50; B owes C Rs. 50 | Stays separate: **A pays B Rs. 50** and **B pays C Rs. 50** | 
| **Manual Debt Redirect** | A owes B Rs. 50; B owes C Rs. 50; B clicks transfer | **A pays C Rs. 50** (with notice to A showing B transferred it) | 
| **Rounding Remainder** | Rs. 100.00 split among 3 people | `3334`, `3333`, `3333` cents (Sum = `10000` exactly) | 
| **Pending Settlement** | A owes B Rs. 50; A records Rs. 50 (`pending`) | Live balance still shows A owes B Rs. 50 until B confirms | 
| **Confirmed Settlement** | B confirms A's Rs. 50 payment | Live balance becomes `0`; empty payment list | 
| **Blocking Cleaning** | Group 1 `due_date` passes without approval | Group 1 flips to `overdue`; Group 2 is **not** created | 
| **Penalty Trigger** | User receives 3rd penalty point (threshold = 3) | `pending` penalty obligation auto-created | 
| **PWA Installability** | Open deployed HTTPS URL on mobile Chrome/Safari | Valid `manifest.json` + service worker; installs in `standalone` mode | 
| **Offline Write Guard** | Toggle device offline and open Add Expense | *"No internet connection"* banner shown; submit button disabled | 
| **SEO Privacy Guard** | Inspect `robots.txt` and `/dashboard` `<head>` | Private routes disallowed in `robots.txt`; `noindex` meta tag present | 
| **Auth & RBAC Guard** | Member calls `/api/admin/*` or unauthenticated call to `/api/expenses` | `401 Unauthorized` / `403 Forbidden` returned | 
| **IDOR & Party Guard** | Payer tries to confirm own settlement, or non-creator edits expense | `403 Forbidden` returned; database unchanged | 
