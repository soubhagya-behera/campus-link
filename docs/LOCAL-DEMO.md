# CAMPUSLINK — local demo runbook (Oct 12, 2026)

Localhost-only demonstration. Everything below was verified on this machine.
**Do not expose publicly: session auth is enforced, and student signup verifies
email, but password recovery is still missing — see `docs/API-CONTRACT.md`.**

## 1. Start the backend (PowerShell terminal 1)

```powershell
cd C:\Users\Asus\Desktop\CAMPUSLINK\backend
npm run dev
```

Expect: `[api] listening on http://127.0.0.1:4000`

## 2. Start the frontend (PowerShell terminal 2)

```powershell
cd C:\Users\Asus\Desktop\CAMPUSLINK\frontend
npm run dev
```

Expect: `Local: http://127.0.0.1:5173/`. If 5173 is taken, Vite exits with
`Port 5173 is already in use` instead of silently moving ports.

## 3. Open the app

Browse to `http://127.0.0.1:5173/`. The header shows live `api`/`db` pills.
Walk the loop: Overview → Career Twin → Opportunity Mirror → Skill Sprint →
Applications → Placement Tower.

## 4. Check the database (PowerShell terminal 3)

```powershell
cd C:\Users\Asus\Desktop\CAMPUSLINK\backend
npm run db:check
```

Expect: `DB connection: OK`. Baseline seed content: 1 student, 5 open
opportunities, 2 applications, 3 assessments. Never run `migrate reset`;
migrations are forward-only.

## 4a. Student registration (`/register`) — needs SMTP once

The registration flow at `http://127.0.0.1:5173/register` emails a real
one-time code, so it needs these six keys in `backend/.env` (see
`.env.example`). With any of them blank the API answers **503** on the first
step and never pretends a code was sent.

```powershell
# backend/.env — names only; put your own values here, never in Git
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=1
SMTP_USER=your.address@gmail.com
SMTP_PASS=your-16-character-google-app-password
MAIL_FROM="CAMPUSLINK <your.address@gmail.com>"
```

`SMTP_PASS` must be a Google **app password**, not the account password:
Google Account → Security → 2-Step Verification → App passwords. Restart the
backend after editing. To prove the wiring before using the UI:

```powershell
cd C:\Users\Asus\Desktop\CAMPUSLINK\backend
curl.exe -s -X POST http://127.0.0.1:4000/api/auth/register/start `
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:5173" `
  -d '{"fullName":"Ada Lovelace","enrollmentNo":"21BFH987","graduationYear":2027,"branch":"Computer Science","institution":"Ravenscourt","email":"you@college.edu"}'
```

`200` means a code was sent; `503` means the six variables are still unset;
`409` means that email or registration number already exists. Then walk the
browser flow: details → code → password. The account is created only after the
code is verified, and the response sets the same session cookie as login.

## 5. Stop the servers

In each server terminal press `Ctrl+C`, then confirm nothing listens:

```powershell
Get-NetTCPConnection -LocalPort 4000,5173 -State Listen
```

Both ports must show `LocalAddress 127.0.0.1` while running, and no rows
after stopping.

## Safety facts (verified, not assumed)

- Express binds `127.0.0.1:4000` (`backend/src/index.ts`); Vite binds
  `127.0.0.1:5173` with `strictPort` (`frontend/vite.config.ts`).
- CORS permits browser reads only from `http://127.0.0.1:5173`
  (`backend/src/app.ts`); other origins receive no access header.
- No tunnel/proxy/publish configuration exists in this repo; no tunnel was
  created during setup. Loopback binding does not harden the machine itself —
  keep the demo on this machine, on this network, behind the deadline only.
- Scoring is rule-based (see API `method`/`rubric` strings); nothing here is
  AI. Authentication is enforced (session cookies; see
  `docs/API-CONTRACT.md`), and public student signup at `/register` verifies
  email with a single-use hashed code before creating anything. There is still
  no password recovery — keep this build on this machine regardless.
- Signing in locally: the demo seed account has no password until one is set.
  Give it one with the documented CLI (masked prompt never echoes), then sign
  in at `http://127.0.0.1:5173/login`:
  `backend/scripts/Provision-User.ps1` provisions other roles the same way
  (`--role STAFF` skips the profile association; a non-student account sees an
  explanatory notice on `/app` instead of a student workspace).
- The app shell reads its session from `GET /api/auth/me` on every entry to a
  protected route. A signed-out visitor to `/app`, `/twin`, … is redirected to
  `/login?next=…` and returned after signing in; `/`, `/login` and `/register`
  always render without a session, so no redirect loop is possible.
