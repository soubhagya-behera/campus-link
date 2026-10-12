import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Undo2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Card, DemoTag, Empty, ErrorState, Loading, NoStudentState, SectionTitle } from "../components/ui";
import "../components/student.css";
import { api } from "../lib/server";
import { useApplications, useSessionUser } from "../store/session";

const STATUS_TONE: Record<string, "signal" | "sky" | "amber" | "rose" | "neutral"> = {
  APPLIED: "sky",
  SHORTLISTED: "signal",
  REJECTED: "rose",
  HIRED: "signal",
  WITHDRAWN: "neutral",
};

export default function Applications() {
  const user = useSessionUser();
  const applications = useApplications();
  const qc = useQueryClient();

  const withdraw = useMutation({
    mutationFn: (id: string) => api.setApplicationStatus(id, "WITHDRAWN"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["applications"] });
      void qc.invalidateQueries({ queryKey: ["readiness"] });
      void qc.invalidateQueries({ queryKey: ["staff-applications"] });
      void qc.invalidateQueries({ queryKey: ["tower"] });
    },
  });

  if (user && !user.studentProfileId) {
    return <NoStudentState kicker="Applications" title="Every application, every next step" />;
  }

  if (applications.isPending) {
    return (
      <div>
        <SectionTitle kicker="Applications" title="Every application, every next step" right={<DemoTag />} />
        <Loading label="Reading your applications from PostgreSQL…" />
      </div>
    );
  }
  if (applications.isError) {
    return (
      <div>
        <SectionTitle kicker="Applications" title="Every application, every next step" right={<DemoTag />} />
        <ErrorState
          message={applications.error instanceof Error ? applications.error.message : "Applications failed to load"}
          onRetry={() => void qc.invalidateQueries({ queryKey: ["applications"] })}
        />
      </div>
    );
  }

  const apps = applications.data ?? [];

  return (
    <div className="sw sw-enter">
      <SectionTitle
        kicker="Applications"
        title="Every application, every next step"
        sub="Persisted records with guarded status transitions — duplicates rejected, backward moves refused."
        right={<DemoTag />}
      />

      {apps.length === 0 ? (
        <Empty
          title="No applications on record"
          body="Nothing is stored in PostgreSQL for this profile yet. Ranked matches are one click away — applying persists a real record."
          action={
            <Link
              to="/mirror"
              className="sw-btn inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-2 text-sm font-semibold text-ink-950"
            >
              Browse matches <ArrowRight size={14} />
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <Card key={a.id} className="rise sw-card">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{a.job.title}</p>
                  <p className="text-sm text-slate-400">
                    {a.job.company} · applied {a.appliedAt.slice(0, 10)}
                    {a.job.deadline ? ` · closes ${a.job.deadline.slice(0, 10)}` : ""}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>{a.status}</Badge>
                {(a.status === "APPLIED" || a.status === "SHORTLISTED") && (
                  <button
                    onClick={() => withdraw.mutate(a.id)}
                    disabled={withdraw.isPending}
                    className="sw-btn-danger inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:border-white/25 hover:text-white disabled:opacity-50"
                  >
                    <Undo2 size={12} /> Withdraw
                  </button>
                )}
              </div>
              <p className="mt-2 rounded-lg border border-white/8 bg-white/[0.02] p-2.5 font-mono text-[11px] text-slate-500">
                updated {a.updatedAt.slice(0, 10)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
