# CAMPUSLINK — local demo runbook (Oct 12, 2026)

Localhost-only demonstration. Everything below was verified on this machine.
**Do not expose publicly: session auth is enforced but account lifecycle
(email verification, recovery) is missing — see `docs/API-CONTRACT.md`.**

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
  AI. Authentication is now enforced (session cookies; see
  `docs/API-CONTRACT.md`), but there is no email verification or account
  recovery, and the demo seed account has no password until provisioned —
  keep this build on this machine regardless.
