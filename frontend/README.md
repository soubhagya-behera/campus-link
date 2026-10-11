# CAMPUSLINK frontend

React + Vite + TypeScript + Tailwind CSS student and placement app.
See the root README for setup. Quick start:

```powershell
npm install
npm run dev      # http://localhost:5173, via VITE_API_BASE_URL
npm run build    # typecheck + production build
```

All persisted data comes from the Express + PostgreSQL backend.
Challenge checklists (`src/data/challenges.ts`) and interview prompts are
curriculum content; submissions, scores, and evidence live in the database.
Rule-based scoring only — no AI predictions. No authentication yet (dev build).
