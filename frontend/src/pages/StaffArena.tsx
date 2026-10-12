import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Card, DemoTag, Empty, ErrorState, Loading, SectionTitle } from "../components/ui";
import "../components/staff.css";
import { cn } from "../lib/cn";
import {
  arenaActivity,
  arenaBank,
  createPrompt,
  deletePrompt,
  updatePrompt,
  type ManagedPrompt,
} from "../lib/arena";
import { ApiError } from "../lib/server";
import { isPlacement, useSessionUser } from "../store/session";

const CATEGORIES = ["Behavioral", "Technical", "Situational"] as const;
const TYPES = ["", "HR", "TECHNICAL", "MANAGERIAL", "MOCK"] as const;

const EMPTY_FORM = { prompt: "", category: "Behavioral", hint: "", isActive: true };

/**
 * Staff Interview Arena management: question bank CRUD plus real practice
 * activity. Deletion is refused while sessions reference a question;
 * deactivation preserves all history. Practice-only: scores and points are
 * rule-based, never hiring decisions.
 */
export default function StaffArena() {
  const user = useSessionUser();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fType, setFType] = useState("");
  const [fPrompt, setFPrompt] = useState("");

  const bank = useQuery({ queryKey: ["arena-bank"], queryFn: arenaBank, enabled: isPlacement(user) });
  const activity = useQuery({
    queryKey: ["arena-activity", fType, fPrompt],
    queryFn: () => arenaActivity({ type: fType || undefined, promptId: fPrompt || undefined }),
    enabled: isPlacement(user),
  });

  if (user && !isPlacement(user)) {
    return (
      <div>
        <SectionTitle kicker="Arena bank" title="Placement access only" right={<DemoTag />} />
        <Card className="p-6">
          <p className="text-sm text-[var(--ws-mute)]">Question management is limited to placement staff.</p>
        </Card>
      </div>
    );
  }

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["arena-bank"] });
    void qc.invalidateQueries({ queryKey: ["arena-activity"] });
    void qc.invalidateQueries({ queryKey: ["arena-prompts"] });
  };

  const set = (k: keyof typeof EMPTY_FORM, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }));
    setFormError(null);
    setNotice(null);
  };

  const save = async () => {
    if (busy) return;
    if (form.prompt.trim().length < 10) {
      setFormError("Question text needs at least 10 characters.");
      return;
    }
    if (form.hint.trim().length > 500) {
      setFormError("Hint must stay under 500 characters.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (editingId) {
        await updatePrompt(editingId, {
          prompt: form.prompt.trim(),
          category: form.category,
          hint: form.hint.trim() || null,
          isActive: form.isActive,
        });
        setNotice("Question updated — past sessions keep their own records.");
      } else {
        await createPrompt({
          prompt: form.prompt.trim(),
          category: form.category,
          hint: form.hint.trim() || undefined,
          isActive: form.isActive,
        });
        setNotice("Question added — students see it immediately.");
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      refresh();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not save this question.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (q: ManagedPrompt) => {
    if (busy) return;
    if (!window.confirm(`Delete "${q.prompt.slice(0, 60)}…"? Only unused questions can be deleted.`)) return;
    setBusy(true);
    setFormError(null);
    try {
      await deletePrompt(q.id);
      setNotice("Question deleted.");
      refresh();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not delete this question.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (q: ManagedPrompt) => {
    if (busy) return;
    setBusy(true);
    try {
      await updatePrompt(q.id, { isActive: !q.isActive });
      setNotice(q.isActive ? "Question deactivated — history preserved." : "Question reactivated.");
      refresh();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not update this question.");
    } finally {
      setBusy(false);
    }
  };

  const rows = bank.data ?? [];
  const acts = activity.data?.data ?? [];

  return (
    <div className="st st-enter">
      <SectionTitle
        kicker="Arena bank"
        title="Interview practice questions"
        sub="Staff-managed bank plus real practice activity. Scoring stays rule-based — practice only, never a hiring decision."
        right={<DemoTag />}
      />
      {notice && (
        <p role="status" className="mb-3 rounded-xl border border-[var(--ws-forest)] bg-[var(--ws-lime-wash)] p-3 text-sm text-[var(--ws-ink)]">
          {notice}
        </p>
      )}

      <Card className="st-card p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">
          {editingId ? "Edit question" : "New question"}
        </p>
        <label className="mt-3 block text-sm font-medium text-[var(--ws-ink)]">
          Question text
          <textarea value={form.prompt} onChange={(e) => set("prompt", e.target.value)} rows={3} maxLength={1000} placeholder="What should the student explain or decide?" className="st-textarea mt-1 w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm leading-relaxed" />
        </label>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <label className="block text-sm font-medium text-[var(--ws-ink)]">
            Category
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className="st-select mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm">
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-[var(--ws-ink)] md:col-span-2">
            Coaching hint (optional)
            <input value={form.hint} onChange={(e) => set("hint", e.target.value)} maxLength={500} placeholder="What a strong answer names…" className="st-input mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm" />
          </label>
        </div>
        <label className="mt-2 flex min-h-[44px] items-center gap-2 text-sm font-medium text-[var(--ws-ink)]">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-5 w-5 accent-[#173c2f]" />
          Active — visible in student practice
        </label>
        {formError && (
          <p role="alert" className="mt-2 rounded-lg border border-[#e8c6bf] bg-[var(--ws-err-bg)] p-2.5 text-sm text-[var(--ws-err)]">
            {formError}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => void save()} disabled={busy} className="st-btn-forest inline-flex min-h-[44px] items-center rounded-lg bg-[var(--ws-forest)] px-4 py-2 text-sm font-semibold text-[var(--ws-canvas)] disabled:opacity-50">
            {busy ? "Saving…" : editingId ? "Save changes" : "Add question"}
          </button>
          {editingId && (
            <button onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setFormError(null); }} disabled={busy} className="st-btn-secondary inline-flex min-h-[44px] items-center rounded-lg border border-[var(--ws-line)] px-4 py-2 text-sm font-medium text-[var(--ws-mute)]">
              Cancel
            </button>
          )}
        </div>
      </Card>

      <h2 className="font-display mt-8 text-lg font-bold text-[var(--ws-ink)]">Question bank · {rows.length}</h2>
      {bank.isPending ? (
        <div className="mt-3"><Loading label="Loading questions…" /></div>
      ) : bank.isError ? (
        <div className="mt-3"><ErrorState message="Questions failed to load" onRetry={() => void qc.invalidateQueries({ queryKey: ["arena-bank"] })} /></div>
      ) : rows.length === 0 ? (
        <div className="mt-3"><Empty title="No managed questions" body="Add the first one above. Until then, students see the built-in starter bank." /></div>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((q) => (
            <li key={q.id} className={cn("st-lift rounded-xl border bg-[var(--ws-surface)] p-4", q.isActive ? "border-[var(--ws-line)]" : "border-dashed border-[var(--ws-line)] opacity-75")}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={q.isActive ? "signal" : "neutral"}>{q.isActive ? "Active" : "Inactive"}</Badge>
                <Badge tone="sky">{q.category}</Badge>
                <p className="w-full text-sm font-semibold text-[var(--ws-ink)]">{q.prompt}</p>
                {q.hint && <p className="w-full text-xs text-[var(--ws-mute)]">Hint: {q.hint}</p>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => { setEditingId(q.id); setForm({ prompt: q.prompt, category: q.category, hint: q.hint ?? "", isActive: q.isActive }); setFormError(null); }} disabled={busy} className="st-btn-secondary inline-flex min-h-[44px] items-center rounded-lg border border-[var(--ws-line)] px-3 py-2 text-xs font-medium text-[var(--ws-forest)] disabled:opacity-50">
                  Edit
                </button>
                <button onClick={() => void toggle(q)} disabled={busy} className="st-btn-secondary inline-flex min-h-[44px] items-center rounded-lg border border-[var(--ws-line)] px-3 py-2 text-xs font-medium text-[var(--ws-mute)] disabled:opacity-50">
                  {q.isActive ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => void remove(q)} disabled={busy} className="st-btn-danger inline-flex min-h-[44px] items-center rounded-lg border border-[#e8c6bf] px-3 py-2 text-xs font-medium text-[var(--ws-err)] disabled:opacity-50">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="font-display mt-8 text-lg font-bold text-[var(--ws-ink)]">Practice activity</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        <select value={fType} onChange={(e) => setFType(e.target.value)} aria-label="Filter by session type" className="st-select min-h-[44px] rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm">
          <option value="">All types</option>
          {TYPES.slice(1).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={fPrompt} onChange={(e) => setFPrompt(e.target.value)} aria-label="Filter by question" className="st-select min-h-[44px] rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm">
          <option value="">All questions</option>
          {rows.filter((q) => q.isActive).map((q) => (
            <option key={q.id} value={q.id}>{q.prompt.slice(0, 60)}</option>
          ))}
        </select>
      </div>
      {activity.isPending ? (
        <div className="mt-3"><Loading label="Loading practice records…" /></div>
      ) : activity.isError ? (
        <div className="mt-3"><ErrorState message="Activity failed to load" onRetry={() => void qc.invalidateQueries({ queryKey: ["arena-activity"] })} /></div>
      ) : acts.length === 0 ? (
        <div className="mt-3"><Empty title="No practice records" body="Submitted student rounds appear here with scores and points." /></div>
      ) : (
        <ul className="mt-3 space-y-2">
          {acts.map((a) => (
            <li key={a.id} className="st-lift rounded-xl border border-[var(--ws-line)] bg-[var(--ws-surface)] p-4">
              <p className="text-sm font-semibold text-[var(--ws-ink)]">
                {a.student.fullName} <span className="font-normal text-[var(--ws-mute)]">· {a.type}</span>
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-[var(--ws-faint)]">
                {a.student.enrollmentNo ?? ""} · {a.createdAt.slice(0, 16).replace("T", " ")} · score {a.score ?? "—"}/100 · {a.points} pts
              </p>
              {a.answers.slice(0, 2).map((ans, i) => (
                <p key={i} className="mt-1.5 border-l-2 border-[var(--ws-line)] pl-2 text-xs leading-relaxed text-[var(--ws-mute)]">
                  {ans.text.slice(0, 280)}{ans.text.length > 280 ? "…" : ""}
                </p>
              ))}
              {a.feedback && <p className="mt-1 text-xs text-[var(--ws-mute)]">{a.feedback.split("\n")[0]}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
