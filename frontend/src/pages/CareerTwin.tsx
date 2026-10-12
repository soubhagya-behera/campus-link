import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, CircleAlert, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, DemoTag, Empty, ErrorState, Loading, NoStudentState, SectionTitle } from "../components/ui";
import { ApiError, api, type Level } from "../lib/server";
import { useMatches, useProfile, useProfileId, useSessionUser } from "../store/session";

const LEVELS: Level[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];

export default function CareerTwin() {
  const profileId = useProfileId();
  const user = useSessionUser();
  const profile = useProfile();
  const matches = useMatches(10);
  const qc = useQueryClient();
  const [newSkill, setNewSkill] = useState("");
  const [proj, setProj] = useState({ title: "", url: "", skills: "" });
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const saveSkills = useMutation({
    mutationFn: (skills: { skill: string; level: Level }[]) => api.updateSkills(profileId as string, skills),
    onSuccess: () => {
      setNotice("Skill levels saved to PostgreSQL.");
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["readiness"] });
      void qc.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (e) => setNotice(e instanceof Error ? e.message : "Save failed"),
  });

  const addSkill = () => {
    const name = newSkill.trim();
    if (!name || !profile.data) return;
    if (profile.data.skills.some((s) => s.skill.toLowerCase() === name.toLowerCase())) {
      setNotice("That skill is already recorded — adjust its level instead.");
      return;
    }
    setNotice(null);
    saveSkills.mutate([...profile.data.skills.map((s) => ({ skill: s.skill, level: s.level })), { skill: name, level: "BEGINNER" as Level }]);
    setNewSkill("");
  };

  const addProject = async () => {
    setFormError(null);
    setNotice(null);
    if (!profileId) return;
    if (proj.title.trim().length < 3) {
      setFormError("Give the project a real title (3+ characters).");
      return;
    }
    const skills = proj.skills.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      await api.addProject(profileId, {
        title: proj.title.trim(),
        url: proj.url.trim() || undefined,
        skills,
      });
      setProj({ title: "", url: "", skills: "" });
      setNotice("Evidence saved — linked skills now show proof in matches.");
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.invalidateQueries({ queryKey: ["readiness"] });
      await qc.invalidateQueries({ queryKey: ["matches"] });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not save this evidence.");
    }
  };

  if (user && !user.studentProfileId) {
    return <NoStudentState kicker="Career Twin" title="Your skill mirror" />;
  }

  if (profile.isPending) {
    return (
      <div>
        <SectionTitle kicker="Career Twin" title="Your skill mirror" right={<DemoTag />} />
        <Loading label="Reading your persisted profile…" />
      </div>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <div>
        <SectionTitle kicker="Career Twin" title="Your skill mirror" right={<DemoTag />} />
        <ErrorState
          message={profile.error instanceof Error ? profile.error.message : "Profile failed to load"}
          onRetry={() => void qc.invalidateQueries({ queryKey: ["profile"] })}
        />
      </div>
    );
  }

  const data = profile.data;
  const demand = new Map<string, { jobs: number; need: Level }>();
  for (const m of matches.data?.data ?? []) {
    for (const g of m.gaps) {
      const cur = demand.get(g.skill);
      demand.set(g.skill, { jobs: (cur?.jobs ?? 0) + 1, need: g.minLevel });
    }
  }

  return (
    <div>
      <SectionTitle
        kicker="Career Twin"
        title="Your skill mirror"
        sub="Recorded levels from PostgreSQL. A level counts as demonstrated only where linked project evidence exists — everything else is a claim in progress."
        right={<DemoTag />}
      />

      {notice && (
        <p className="mb-4 rounded-xl border border-signal-500/30 bg-signal-400/[0.07] p-3 text-sm text-signal-200">
          {notice}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rise lg:col-span-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Recorded skills · {data.skills.length}
          </p>
          <ul className="mt-3 space-y-2">
            {data.skills.map((s) => (
              <li
                key={s.skill}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-3"
              >
                <span className="min-w-32 font-semibold text-white">{s.skill}</span>
                {s.evidence.length > 0 ? (
                  <Badge tone="signal">
                    <BadgeCheck size={11} /> evidenced ×{s.evidence.length}
                  </Badge>
                ) : (
                  <Badge tone="amber">
                    <CircleAlert size={11} /> claimed · unproven
                  </Badge>
                )}
                <select
                  value={s.level}
                  disabled={saveSkills.isPending}
                  onChange={(e) =>
                    saveSkills.mutate(
                      data.skills.map((x) => ({
                        skill: x.skill,
                        level: (x.skill === s.skill ? (e.target.value as Level) : x.level),
                      })),
                    )
                  }
                  className="ml-auto rounded-lg border border-white/10 bg-ink-800 px-2 py-1 text-sm text-white"
                  aria-label={`Recorded level for ${s.skill}`}
                >
                  {LEVELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </li>
            ))}
            {data.skills.length === 0 && (
              <li className="text-sm text-slate-400">No skills recorded yet — add your first below.</li>
            )}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSkill()}
              placeholder="Add a skill, e.g. Docker"
              className="flex-1 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder:text-slate-600"
            />
            <button
              onClick={addSkill}
              disabled={saveSkills.isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-signal-400 px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-signal-300 disabled:opacity-50"
            >
              <Plus size={14} /> Record
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            New skills start at BEGINNER. Levels are self-reported; evidence comes from linked projects.
          </p>
        </Card>

        <Card className="rise rise-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Demanded by open roles
          </p>
          {demand.size === 0 ? (
            <p className="mt-2 text-sm text-slate-400">
              No open role currently asks for skills beyond your record — or no roles exist yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {[...demand.entries()]
                .sort((a, b) => b[1].jobs - a[1].jobs)
                .slice(0, 6)
                .map(([skill, d]) => (
                  <li key={skill} className="flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="text-slate-200">{skill}</span>
                    <span className="ml-auto font-mono text-[11px] text-slate-500">
                      {d.jobs} role{d.jobs > 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
            </ul>
          )}
          <Link
            to="/mirror"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-signal-300 hover:underline"
          >
            See which roles <ArrowRight size={14} />
          </Link>
        </Card>
      </div>

      <h2 className="font-display mt-8 text-lg font-bold text-white">Evidence locker</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {data.projects.map((p) => (
          <Card key={p.id}>
            <p className="font-semibold text-white">{p.title}</p>
            {p.description && <p className="mt-1 text-sm text-slate-400">{p.description}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.skills.map((s) => (
                <Badge key={s} tone="sky">
                  {s}
                </Badge>
              ))}
            </div>
            {p.url && (
              <a href={p.url} target="_blank" rel="noreferrer" className="mt-2 block font-mono text-[11px] text-signal-300 hover:underline">
                {p.url}
              </a>
            )}
          </Card>
        ))}
        {data.projects.length === 0 && (
          <Empty title="No evidence yet" body="Add real projects below. Each one backs the skills it names." />
        )}
      </div>

      <Card className="rise mt-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
          Add genuine evidence
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input
            value={proj.title}
            onChange={(e) => setProj({ ...proj, title: e.target.value })}
            placeholder="Project title"
            className="rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder:text-slate-600"
          />
          <input
            value={proj.url}
            onChange={(e) => setProj({ ...proj, url: e.target.value })}
            placeholder="Link (https://…) — optional"
            className="rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder:text-slate-600"
          />
          <input
            value={proj.skills}
            onChange={(e) => setProj({ ...proj, skills: e.target.value })}
            placeholder="Skills it proves, comma-separated"
            className="rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder:text-slate-600"
          />
        </div>
        {formError && (
          <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-sm text-amber-200">
            {formError}
          </p>
        )}
        <button
          onClick={() => void addProject()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-signal-300"
        >
          <Plus size={14} /> Save evidence to PostgreSQL
        </button>
      </Card>
    </div>
  );
}
