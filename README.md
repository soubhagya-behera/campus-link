# CAMPUSLINK

Monorepo for the CAMPUSLINK career and placement platform.
Local-first development: local PostgreSQL + Express/TypeScript/Prisma backend.
No Supabase or Vercel until the local app fully works.

## Layout

- `backend/` — Express + TypeScript + Prisma API (local PostgreSQL).
- `frontend/` — React + Vite + TypeScript + Tailwind app (Career Intelligence OS).

## Backend quickstart (Windows PowerShell)

```powershell
cd backend
npm install
```

Configure the local database (masked password prompt, writes gitignored
`backend/.env`, creates `campuslink` DB only if missing — never drops anything):

```powershell
.\scripts\Set-LocalEnv.ps1
```

Then migrate, generate, and verify:

```powershell
npx prisma migrate dev --name init
npm run db:check
npm run dev
```

Health checks: `GET /api/health` (no DB), `GET /api/ready` (DB probe).

Seed the development dataset (explicitly synthetic demo content, idempotent):

```powershell
npm run prisma:seed
```

Key API routes: `GET /api/students/:id[/matches|/readiness]`, `PATCH
/api/students/:id/skills`, `POST /api/students/:id/projects`, `GET|POST
/api/opportunities`, `GET|POST /api/applications`, `PATCH /api/applications/:id`
(guarded transitions), `GET /api/assessments`, `GET|POST /api/attempts`
(rule-based rubric grading), `GET /api/tower/stats`. Tests: `npm test` (vitest).

Honesty rules: match scores and readiness use the documented rule-based methods
returned by the API — never AI predictions. The demo identity
(`GET /api/demo/identity`) is not authentication; do not expose this build publicly.

## Frontend quickstart (Windows PowerShell)

```powershell
cd frontend
npm install
npm run dev      # http://localhost:5173, talks to the API via VITE_API_BASE_URL
npm run build    # typecheck + production build
```

Student loop: Overview → Career Twin → Opportunity Mirror → Skill Sprint →
submissions persist to PostgreSQL, grading follows the public rule-based rubric,
and readiness/matches refresh from server data.

## Security notes

- `backend/.env` is gitignored; only `*.example` files are committed.
- Never paste passwords in chat or commit secrets.
- API errors are sanitized — no secrets or raw DB errors leak to clients.
