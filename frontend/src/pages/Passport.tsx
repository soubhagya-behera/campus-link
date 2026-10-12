import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Download, Link2, ShieldCheck } from "lucide-react";
import { Badge, Card, DemoTag, Empty, ErrorState, Loading, NoStudentState, SectionTitle } from "../components/ui";
import "../components/student.css";
import { useAttempts, useProfile, useSessionUser } from "../store/session";

export default function Passport() {
  const user = useSessionUser();
  const profile = useProfile();
  const attempts = useAttempts();
  const qc = useQueryClient();

  if (user && !user.studentProfileId) {
    return <NoStudentState kicker="Proof-of-Skill Passport" title="Don't list skills. Prove them." />;
  }

  if (profile.isPending) {
    return (
      <div>
        <SectionTitle kicker="Proof-of-Skill Passport" title="Don't list skills. Prove them." right={<DemoTag />} />
        <Loading label="Assembling your evidence…" />
      </div>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <div>
        <SectionTitle kicker="Proof-of-Skill Passport" title="Don't list skills. Prove them." right={<DemoTag />} />
        <ErrorState
          message={profile.error instanceof Error ? profile.error.message : "Evidence failed to load"}
          onRetry={() => void qc.invalidateQueries({ queryKey: ["profile"] })}
        />
      </div>
    );
  }

  const data = profile.data;
  const evidenced = data.skills.filter((s) => s.evidence.length > 0);
  const evaluated = (attempts.data?.data ?? []).filter((a) => a.status === "EVALUATED").length;

  return (
    <div className="sw sw-enter">
      <SectionTitle
        kicker="Proof-of-Skill Passport"
        title="Don't list skills. Prove them."
        sub="Every claim below resolves to a persisted project or a graded submission — nothing is asserted without a record."
        right={<DemoTag />}
      />

      <Card className="rise sw-card flex flex-wrap items-center gap-5">
        <div className="font-display flex h-16 w-16 items-center justify-center rounded-2xl bg-signal-400 text-2xl font-bold text-ink-950">
          {data.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold text-white">{data.fullName}</p>
          <p className="text-sm text-slate-400">
            {data.branch ?? "—"} · {data.enrollmentNo ?? "—"}
            {data.cgpa != null ? ` · CGPA ${data.cgpa}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="signal">
              <ShieldCheck size={11} /> {evidenced.length} evidenced skills
            </Badge>
            <Badge>{data.skills.length - evidenced.length} claimed · unproven</Badge>
            <Badge>{evaluated} graded submissions</Badge>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="sw-btn-secondary inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-slate-200 hover:border-white/30"
        >
          <Download size={14} /> Export
        </button>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card className="rise rise-1 sw-card">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Verified skills</p>
          {evidenced.length === 0 ? (
            <div className="mt-3">
              <Empty
                title="Nothing verified yet"
                body="Record a skill in the Twin, then link it to a project — or pass a sprint at 70+ to earn evidence automatically."
              />
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {evidenced.map((s) => (
                <li key={s.skill} className="sw-lift rounded-xl border border-white/8 bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2">
                    <BadgeCheck size={15} className="text-signal-400" />
                    <span className="font-semibold text-white">{s.skill}</span>
                    <span className="ml-auto font-mono text-[11px] text-slate-500">{s.level}</span>
                  </div>
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-400">
                    <Link2 size={12} className="mt-0.5 shrink-0" />
                    {s.evidence
                      .map((e) => data.projects.find((p) => p.id === e)?.title ?? "Linked evidence")
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="rise rise-2 sw-card">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Shipped work · {data.projects.length}
          </p>
          {data.projects.length === 0 ? (
            <div className="mt-3">
              <Empty title="No projects on record" body="Add your first evidence record from the Career Twin." />
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.projects.map((p) => (
                <li key={p.id} className="sw-lift rounded-xl border border-white/8 bg-white/[0.02] p-3">
                  <p className="font-semibold text-white">{p.title}</p>
                  {p.description && <p className="mt-0.5 text-sm text-slate-400">{p.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.skills.map((s) => (
                      <Badge key={s} tone="sky">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
