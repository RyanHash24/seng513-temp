# FinClear Schema Milestone Implementation Plan

> Execute inline using superpowers:executing-plans. The user approved the full proposal scope in chat.

**Goal** Deliver a runnable PostgreSQL schema and synthetic seed dataset with the required submission materials.

**Architecture** Plain transactional psql scripts, explicit initialization after Docker startup, and SQL reporting views. Production startup initializes structure without demo data.

**Tech Stack** PostgreSQL 15+, psql, Docker Compose, Python PDF tooling.

**Spec** `docs/superpowers/specs/2026-11-05-schema-design.md`

## Global constraints

- Preserve the existing backend API and Docker environment.
- Use exact monetary values and enforce ownership through composite foreign keys.
- Include separate schema/seed scripts, README, PDF and ZIP.
- Use synthetic credentials and data only.

## Review focus

- Cross-user and cross-currency relationships must fail.
- Reruns must preserve edits and avoid duplicate imports or seeds.
- Refunds, pending items and transfers must produce correct totals.
- Removing a budget or disconnecting a bank must preserve transaction history.
- Existing Docker volumes must support explicit initialization without deletion.

## Tasks

- [x] Write SQL acceptance assertions and observe failure before schema creation.
- [x] Implement `database/schema.sql`, `database/seed.sql` and reporting views. Run assertions and rerun checks.
- [x] Add root README instructions and standalone `database/README.md` with fresh/existing volume and production commands.
- [x] Generate and visually inspect `output/pdf/seng513-schema-pg-8.pdf`. Package instructions, SQL, Compose and supporting files without secrets in a submission ZIP.
- [ ] Commit milestone files and create `schema-milestone`. Review and verification are complete, but commit permission was declined.

## Validation record

- The initial acceptance run failed because `users` did not exist, then passed after implementation.
- Schema and seeds passed on a fresh isolated PostgreSQL 18 database, including a second database created from the extracted ZIP. Four users, seven accounts and 27 transactions were loaded.
- Same-version schema/seed reruns preserved an edited transaction and added no duplicate rows.
- SQL assertions cover UI totals, ownership, currency, duplicate imports, invalid amounts, refunds, pending entries, transfers, savings progress and retained transaction history.
- Node crypto verified all three registered demo password hashes.
- Both Compose configurations validated in the repository and extracted submission. Docker runtime execution was unavailable because Docker Desktop was stopped. PostgreSQL 15 compatibility received static review, while SQL execution used PostgreSQL 18.
- The existing backend npm test command exits with `Error: no test specified`. Database acceptance checks are independent of that placeholder.
- Independent static review found no Important or Critical issues. Its two minor suggestions were addressed in the refund fixture and seed rerun documentation.
- The four-page PDF was rendered and visually inspected. ZIP integrity and required contents passed checks, with local credentials excluded.
- Publication to GitLab and D2L upload remain manual.

Commit permission was declined by the user. No milestone commit or tag was created. Implementation files were staged before that denial.

## Follow-up scope

The user requested restoring the original root README and committing the remaining work while deferring README publication. Keep the new database README as a local draft excluded from the commit. The existing submission PDF and ZIP retain their prepared instructions, with the ZIP root README restored to match the checkout. Defer the milestone tag until the README instructions are finalized.
