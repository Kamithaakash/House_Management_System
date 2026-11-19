---
name: pre-code-checklist
description: Mandatory thinking checklist (requirements, security threats, design patterns, tests) the agent must complete before writing or changing any code in the Boarding Management System. Use before every new feature, endpoint, page, or schema change.
---

# Pre-Code Checklist

Run this in order. Write brief answers (in your reply) before coding.

## 1. Requirements
- Which SRS section/module (A-F) does this feature belong to? Quote the rule.
- Any conflict or ambiguity with the SRS? If yes, ask the user first.
- Which roles (Admin/Member) can do this?

## 2. Threat model (STRIDE quick pass)
- **Spoofing:** how is the caller authenticated?
- **Tampering:** which client-sent fields could be forged (user ids, amounts, status)? Derive from session/DB instead.
- **Repudiation:** which `audit_log` entry is written?
- **Information disclosure:** which fields must NOT be returned? Can user A see user B's data?
- **Denial of service:** rate limit, pagination, max list sizes, max amounts?
- **Elevation of privilege:** is role/ownership checked in the service layer?
- Re-read `.agent/rules/10-security.md` review gate.

## 3. Data & money
- Are all amounts integer cents? Any float anywhere?
- Is it one transaction? Which assertion guarantees sum/zero-sum?
- Which race condition can occur (double confirm, double submit)? Use row lock / state check.
- Which DB constraints/indexes back this rule?

## 4. Design
- Which layer owns each piece (router / service / repository / pure core)?
- Which pattern fits (Strategy, State Machine, Factory, Flyweight, Unit of Work...)? See `.agent/rules/20-design-patterns.md`. If none fits, keep it simple.
- Can shared constants/lookup data be a Flyweight (defined once, reused)?

## 4b. SEO (for any frontend page/route)
- Is the route public or private? Apply `.agent/skills/seo-architecture/SKILL.md` (noindex + `robots.txt` + metadata + semantic HTML).

## 5. Tests (write first or together)
- Happy path.
- Boundary: 1 participant, remainder cents, max amount, empty list.
- Security negatives: 401, 403, 404, 409, 422.
- Invariants: sum(splits)==total, sum(balances)==0.

## 6. After coding
- Run `python -m pytest -v`; report the real output.
- Run dependency audit before deploy (`pip-audit`, `npm audit`).
- Confirm no secrets committed and `.env` is gitignored.
- Explain to the user in simple words what was built and how to run it.
