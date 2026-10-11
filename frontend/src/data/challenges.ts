/**
 * Challenge content (curriculum, not data): per-assessment build checklists.
 * Submissions, scores, and evidence live in PostgreSQL; this file only
 * describes what each challenge asks for.
 */
export interface ChallengeContent {
  tasks: { title: string; detail: string }[];
  estimatedMins: number;
}

export const CHALLENGES: Record<string, ChallengeContent> = {
  "demo-assess-react-a11y": {
    estimatedMins: 180,
    tasks: [
      { title: "Scaffold + typed data model", detail: "Vite + TS table with 200+ rows of realistic mock data, typed columns." },
      { title: "Sort, filter, paginate", detail: "Client-side sort + text filter + pagination that stays fast at 5k rows." },
      { title: "Keyboard + ARIA pass", detail: "Roving tabindex, aria-sort, focus-visible styles, Esc clears filters." },
      { title: "Ship + write-up", detail: "Deployed link or screen recording plus your 5-line a11y write-up." },
    ],
  },
  "demo-assess-sql-ledger": {
    estimatedMins: 150,
    tasks: [
      { title: "Schema + seed locally", detail: "Spin up the provided ledger schema with 10k seeded rows." },
      { title: "Analytical queries", detail: "Running balances, top merchants, anomaly hunt — all with EXPLAIN." },
      { title: "Index justification", detail: "Pick one index, show before/after timings, write the paragraph." },
    ],
  },
  "demo-assess-viz-pack": {
    estimatedMins: 120,
    tasks: [
      { title: "Clean + profile the data", detail: "Handle null wards, dedupe, document every assumption." },
      { title: "Find the story", detail: "One trend with a number, a cause hypothesis, and a ward to visit." },
      { title: "Ship the pack", detail: "3 charts + 60-word recommendation a non-technical warden can act on." },
    ],
  },
};

export function challengeContent(id: string): ChallengeContent {
  return CHALLENGES[id] ?? { tasks: [], estimatedMins: 60 };
}
