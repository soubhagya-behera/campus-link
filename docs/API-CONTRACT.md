# CAMPUSLINK API contract (backend v0 — unversioned `/api`, localhost-only)

All endpoints return `{ ok: true, data, ... }` on success or
`{ ok: false, error, details? }` on failure. Errors never include stack
traces, SQL, or credentials. Dates are ISO-8601 strings. Enums use the exact
Prisma values (`STUDENT`, `OPEN`, `APPLIED`, …). List endpoints return
`{ data, page, limit, total }` (page ≥ 1, limit 1–50, default 20) and sort
newest-first unless stated.

**Authentication: session cookies (see below).** Every route marked 🔒
requires a live session. Required roles are **enforced server-side**.
`studentProfileId` in a request proves nothing; ownership is derived from
the session. Do not expose publicly until email verification, account
recovery, and production secrets are addressed (see Security posture).

## Authentication & sessions

- Passwords: scrypt (N=2¹⁴, r=8, p=1, 64-byte key, per-user salt;
  `scrypt$v1$…` format). Never stored or returned in plaintext.
- `POST /api/auth/login { email, password }` → 200 sets HttpOnly cookie
  `campuslink_session` (`Path=/`, `SameSite=Lax`, `Max-Age=7d`,
  `Secure` iff `COOKIE_SECURE=1` or HTTPS). Only SHA-256(token) is stored.
  Unknown email, wrong password, and inactive accounts all return the same
  401 `Invalid email or password` (no enumeration). Rate-limited: 20/15min/IP.
- `POST /api/auth/logout` 🔒 → revokes the session, clears the cookie.
- `GET /api/auth/me` 🔒 → `{ id, email, role, companyId, studentProfileId }`.
- Sessions expire absolutely after 7 days; expired/revoked/inactive-user
  sessions return 401. No session listing/rotation endpoints yet.
- Roles: `STUDENT` (owns one profile), `RECRUITER` (owns one company via
  `User.companyId`), `STAFF` = placement officer, `ADMIN` = full access.
- Public student registration (below) is the only route that creates accounts
  without an operator; everything else is still provisioned through
  `backend/scripts/Provision-User.ps1`.

### Student registration (public, no session required)

Three steps, one browser URL (`/register`). Email is proven before any account
exists: `POST /register/start` and `POST /register/verify` never write to
`User` or `StudentProfile`.

- `POST /api/auth/register/start`
  `{ fullName, enrollmentNo, graduationYear 2020–2035, branch, institution?,
  email }` → 200 `{ attemptId, emailMasked, expiresAt, resendAvailableAt,
  codeLength, maxAttempts }`. Emails a 6-digit code. 409 if the email or the
  registration number already exists (or is held by another email's in-flight
  attempt); 429 during the 60s resend cooldown or after 5 sends; 503 if mail is
  not configured. Schema is `.strict()`, so `role`, `isActive`, `companyId`
  and `studentProfileId` are rejected as unknown keys — a public caller cannot
  choose a role. Rate-limited 20/15min/IP.
- `POST /api/auth/register/verify` `{ attemptId, code }` → 200
  `{ attemptId, completionToken, emailMasked, expiresAt }`. 400 wrong code,
  404 unknown/consumed attempt, 409 code already used, 410 expired, 429 after
  5 wrong attempts. Rate-limited 60/15min/IP.
- `POST /api/auth/register/complete` `{ attemptId, completionToken, password }`
  → 201 `{ user }` **and** the same HttpOnly session cookie `POST /login` sets.
  The profile is copied from the verified attempt row, not from the request, so
  a browser cannot swap the email or registration number after verifying. 409
  duplicate email/registration number or an already-completed attempt (this is
  also the concurrency guard: two simultaneous completes yield one 201 and one
  409); 410 expired or wrong completion token; 422 email not verified. Password
  policy: 12–256 characters, at least one letter and one number. Rate-limited
  20/15min/IP.

Guarantees: codes come from `crypto.randomInt` (rejection-sampled, no modulo
bias) and are stored only as HMAC-SHA256 keyed on the attempt id; they are
single-use (cleared on success), expiry-capped (10 min), attempt-capped (5) and
resend-capped (5 sends, 60s apart). A verified email authorises account
creation only through a single-use `completionToken` valid for 20 minutes, and
  that token lives in browser memory only — never in storage. Emails are
  normalised to lower case and registration numbers to upper case; the number
  must be exactly 8 ASCII alphanumerics (for example `21BFH987`), so one
  person cannot register twice by retyping.
Passwords, codes, SMTP credentials and session secrets are never logged.
- CSRF: mutations carrying `Origin`/`Referer` must match `CORS_ORIGIN`
  (default `http://127.0.0.1:5173`), else 403. Cookie-authenticated mutations
  with neither header are also 403; headerless calls without a session cookie
  (curl, server-to-server) pass this check and remain subject to auth +
  ownership. CORS allows credentials only for that origin; other origins get
  no access headers.
- Provisioning (for placement/recruiter/staff accounts; students self-register
  via the verified flow above): prefer
  `backend/scripts/Provision-User.ps1` (masked prompt) or
  `PROVISION_PASSWORD=… npx tsx scripts/provision-user.ts --email … --role …
  [--student-profile-id … | --company-id …]`. Creates only; validates
  email/role/association; min password 12 chars. No lifecycle email flows.

## Conventions

| Item | Rule |
|---|---|
| 400 | zod validation failure, with `details: [{ path, message }]` |
| 404 | unknown student / job / application / assessment / attempt / session |
| 401 | missing/invalid/expired/revoked session, or inactive account |
| 403 | authenticated but not permitted (wrong role, foreign record, foreign transition) |
| 409 | duplicate application (pre-check or unique-constraint race); registration: duplicate email or registration number |
| 410 | registration: expired code, or expired/incorrect completion token |
| 422 | legal request, illegal state (closed posting, bad transition, corrupt session, unverified email at `register/complete`) |
| 500 | sanitized `Internal server error`; full message logged server-side only |
| 503 | `GET /api/ready` when PostgreSQL is unreachable |

## Endpoints

### Health
- `GET /api/health` → `{ service, time }`. No DB touch.
- `GET /api/ready` → `{ db: "up" }`, else 503 `{ db: "down" }`.

### Demo identity route: REMOVED
`GET /api/demo/identity` was deleted in the auth milestone — no endpoint may
suggest a hardcoded identity authenticates a caller. The demo seed user
(`demo.student@campuslink.local`) has no usable password until one is
provisioned; it confers nothing by itself.

### Students & Career Twin (🔒; STAFF/ADMIN = placement)
- `GET /api/students` 🔒 STAFF/ADMIN → profile summaries with account email and
  record creation date (placement-only; never passwords or hashes). Search covers
  name, roll number and email; filter by branch.
- `GET /api/students/:id` 🔒 owner or placement (recruiters: 403 — use
  job-scoped candidate views) → profile + `skills: [{ skill, level, evidence:
  [projectId] }]` + projects. Levels are self-reported until linked evidence
  exists; `evidence: []` means *claimed, unproven*.
- `PATCH /api/students/:id/skills` 🔒 owner or placement.
  `{ skills: [{ skill ≤60ch, level }] }` (1–30 items, case-insensitive
  dedupe) → `{ updated }`. Creates unknown skill names; transactional.
- `PATCH /api/students/:id/skills/:skillId` 🔒 owner or placement →
  rename and/or re-level one skill; duplicate names 409. `DELETE …/skills/:skillId`
  removes only the link row — projects, attempts and sessions survive.
- `POST /api/students/:id/projects` 🔒 owner or placement.
  `{ title 3–120, description ≤2000, url (valid URL), skills[] ≤15 }` → 201
  project. Named skills are created (BEGINNER) if missing so evidence links
  resolve; levels are never raised here.
- `GET /api/students/:id/matches` 🔒 owner or placement.
  `?status=OPEN&limit=&includeExpired=false` → `{ method, data: [{ job,
  score 0–100, met[], gaps[], bonuses[], factors[], nextStep }] }`.
  Past-deadline OPEN postings are excluded unless `includeExpired=true`.
  Deterministic order: score desc, deadline asc (nulls last), id asc. Jobs
  with no requirements score 0 (“no stated criteria”).
- `GET /api/students/:id/readiness` 🔒 owner or placement → `{ score,
  method, inputs: { recordedSkills, evidencedSkills, applications,
  evaluatedSprints }, skills }`.
- `GET /api/students/:id/passport` 🔒 owner or placement → profile +
  per-skill provenance (`self-reported` levels; evidence `user-submitted` vs
  `sprint-submission`) + `rubric-assessed` attempts + `verification:
  { independentlyVerifiedItems: 0 }`.

### Opportunities (🔒; writes: recruiter-own-company or placement)
- `GET /api/opportunities` 🔒 any role, but students are forced to OPEN
  non-expired (other status filters ignored); recruiters see OPEN postings
  plus their own company's any-status postings; placement sees all per filter.
- `GET /api/opportunities/:id` 🔒 same visibility (hidden → 404).
- `POST /api/opportunities` 🔒 recruiter (company forced to own —
  client-supplied company ignored) or placement; students 403.
  `{ companyId | companyName (upsert), title 3–140,
  description 10–5000, location?, type?, status? (default OPEN), seniority?
  (informational only), salary?, deadline? (ISO), requiredSkills[] ≤12
  [{ skill, minLevel }], niceToHave[] ≤12 }` → 201.
- `PATCH /api/opportunities/:id` 🔒 same authorship, checked against the
  posting's company; students 403. Partial update (at least one field);
  close/reopen via `status`. No delete endpoint: `CLOSED` is terminal.

### Applications (🔒; actors enforced per transition)
- `GET /api/applications` 🔒 students: own only (explicit other id → 403);
  recruiters: must pass `?jobId=` of their own company's posting (else 403);
  placement: all filters. Records embed job summary + applicant identity.
- `POST /api/applications` 🔒 students apply as themselves (body id must
  match own, else 403); placement may file for any profile; recruiters 403.
  → 201; 404 unknown job/profile; 422 posting not OPEN; 409 duplicate
  (incl. races via P2002).
- `PATCH /api/applications/:id` 🔒 read access required even for no-op
  same-status reads. `WITHDRAWN`: applicant or placement. `SHORTLISTED` /
  `REJECTED`: posting-company recruiter or placement. `HIRED`: placement
  only. `APPLIED`: nobody (no backward moves). Violations → 403 with the
  required permission; illegal jumps → 422. Transition matrix:
  `APPLIED → SHORTLISTED | REJECTED | WITHDRAWN`;
  `SHORTLISTED → HIRED | REJECTED | WITHDRAWN`;
  `REJECTED | HIRED | WITHDRAWN` terminal.

### Sprints (Skill Sprint) — 🔒; attempts are personal (students submit as
  themselves; placement read-only; recruiters denied)
- `GET /api/assessments` 🔒 any role → challenge catalogue + `rubric`, `rubricVersion`.
- `GET /api/attempts` 🔒 owner or placement (recruiters 403) → persisted
  submissions, newest-first, paginated.
- `POST /api/attempts` 🔒 owner only → 201 `{ attempt, promotedTo,
  evidenceProjectId }`. Checklist progress is self-attested; the link is what
  a reviewer verifies. Unlimited retries; every attempt persists. Server
  grades; clients cannot submit scores or promotions.

### Interview Arena (🔒; owner-only writes; practice only — rule-based, no AI/speech/LLM)
- `GET /api/arena/prompts` 🔒 any role → curated bank + `version`, `method`.
- `POST /api/arena/sessions` 🔒 students as themselves (placement/recruiters
  403) → 201 session (`score: null` = in progress).
- `POST /api/arena/sessions/:id/answers` 🔒 session owner only (placement
  cannot answer for a student) → 200 scored session. Rejects prompts outside
  the session, duplicates, corrupt transcripts (422).
- `GET /api/arena/sessions` 🔒 owner or placement (recruiters 403);
  `GET /api/arena/sessions/:id` 🔒 same ownership rule → sessions with
  score/feedback (null until answered).
- Question bank 🔒 STAFF/ADMIN: `GET/POST /api/arena/bank`,
  `PATCH/DELETE /api/arena/bank/:id`. Delete is 409 while any session
  references the question; deactivation preserves history. `GET /api/prompts`
  serves active managed questions, falling back to the static bank while empty.
- Practice points: `floor(score/10)` (0–10), stored per session in a ledger
  row keyed by session — re-grading updates it, never duplicates. Answers
  responses include `pointsEarned` + `totalPoints`; session lists include the
  owner's total. `GET /api/arena/activity` 🔒 STAFF/ADMIN → sessions with
  student, answers, score and points (filters: student, type, question).

### Placement Tower (🔒 STAFF/ADMIN only)
- `GET /api/tower/stats` → `{ students, openOpportunities (status OPEN),
  applications (all rows), byStatus, avgReadiness, readiness[] (per-student
  **proficiency-only** score = mean recorded level / 4 × 100 — not the full
  readiness formula), demoSeedPresent }`.
- Metric vocabulary: *applications* = rows; *students* = profiles; there are
  no offer/placement/hired-outcome metrics — `HIRED` is an application status,
  never reported as a confirmed placement. Seed rows (emails starting
  `demo.`) are flagged, never presented as outcomes.
- What-If Lab: intentionally client-side illustrative arithmetic; no server
  endpoint (a server copy would add no trust without validated outcome data).

### Announcements & notifications
- `POST /api/announcements` 🔒 STAFF/ADMIN → validates, resolves recipients
  from live records (ALL = all profiles; APPLIED/SHORTLISTED literal;
  INTERVIEW_SELECTED = HIRED), materializes recipient rows in one transaction;
  422 on empty audience. `GET /api/announcements` 🔒 placement → history with
  recipient/unread counts. `GET /api/announcements/recipients/preview` 🔒
  placement → count only.
- `GET /api/notifications`, `/unread-count` 🔒 student-own only.
  `POST /api/notifications/:id/read`, `/read-all` 🔒 caller-scoped; cross-user
  reads are 403. In-app only — no email/SMS/push.

## Business rules & formulas

- **Matching** (`MATCH_METHOD` returned per response): weight = rank(minLevel)×2;
  met = full weight + min(evidence,2)×0.5; one level below = 75%; worse = 0;
  nice-to-have at INTERMEDIATE+ = +1/+1; score = min(100, round(100×pts/max)).
  Case-insensitive skill names. Limitations: ignores location/pay/recruiter
  judgment; not calibrated, not predictive.
- **Readiness** (`READINESS_METHOD`): 50% mean recorded level + 30% evidenced
  share + 20% capped activity (4/app, 6/evaluated sprint). Empty profile = 0.
  Range 0–100 by construction.
- **Sprint rubric** (`rubric-v1`): 40 base + 25 completion + 15 verifiable link
  + 15/8 write-up depth + 5 quality-attribute mention; cap 100; ≥70 promotes
  one level (missing skill starts INTERMEDIATE) and records a
  `Sprint: <title>` project in the same transaction.
- **Arena scoring** (`arena-bank-v1`): 35 base + 30/18 substance + 15 number +
  10 reasoning + 10 structure; session = mean of answered prompts.

## Operations (localhost)

- Env: `DATABASE_URL` (secret, gitignored), `PORT` (default 4000),
  `HOST` (default 127.0.0.1 — keep), `CORS_ORIGIN` (default
  `http://127.0.0.1:5173`), `VITE_API_BASE_URL` (frontend, no secrets).
  Mail (required for registration, see `backend/.env.example`): `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Optional
  `OTP_PEPPER` sets a stable HMAC key for codes; without it a random per-process
  key is generated, so codes do not survive an API restart.
- DB: `npx prisma migrate dev` (dev) / `migrate deploy` (prod-like);
  `npm run prisma:seed` is idempotent synthetic demo content (`demo.*` ids).
  Migrations are forward-only; no reset/wipe tooling is provided on purpose.
- Run: `npm run dev` (backend :4000) + `npm run dev` (frontend :5173);
  `npm run db:check`; stop with Ctrl+C (SIGTERM/SIGINT close the listener,
  then the Prisma pool, ≤10s fallback exit).
- Limits: 100kb JSON bodies, 300 req/15min per IP, Helmet headers, CORS
  single loopback origin. Logs: errors server-side only, sanitized to clients.
- Future hosted DB: use `migrate deploy`, mínimo automated `pg_dump`
  backups, and real auth (below) before any exposure.

## Security posture: localhost-only; auth enforced, lifecycle incomplete

Enforced: loopback binds, strict CORS (credentials only for the configured
origin; others get no access headers), CSRF origin check on mutations,
validation, sanitized errors, global rate limiting (300/15min/IP) plus a
login budget (20/15min/IP), scrypt passwords, hash-only session storage,
server-side role + ownership checks on every route above (tested, including
cross-student and cross-company attempts), no secrets in Git, and email
verification on public student signup (single-use hashed codes, attempt and
resend caps, role forced to `STUDENT`).
**Remaining for public deployment:** password recovery/change, session
listing/rotation, production secrets management (`COOKIE_SECURE=1` + HTTPS),
login alerting, and periodic purge of expired sessions and consumed
registration attempts. Until then, do not expose.
