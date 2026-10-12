import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Badge, Card, Empty, ErrorState, Loading, SectionTitle } from "../components/ui";
import "../components/staff.css";
import { ApiError, request, type Level, type Opportunity } from "../lib/server";

const TYPES = ["INTERNSHIP", "FULL_TIME", "PART_TIME", "CONTRACT"] as const;
const STATUSES = ["OPEN", "DRAFT", "CLOSED"] as const;
const LEVELS: Level[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];
const FILTERS = ["All", "OPEN", "CLOSED", "DRAFT"] as const;

interface DrivePayload {
  companyName?: string;
  title: string;
  description: string;
  location?: string;
  type: string;
  status: string;
  seniority?: string;
  salary?: string;
  deadline?: string;
  requiredSkills: { skill: string; minLevel: Level }[];
  niceToHave: string[];
}

function postDrive(body: DrivePayload): Promise<void> {
  return request("/api/opportunities", { method: "POST", body: JSON.stringify(body) }).then(
    () => undefined,
  );
}

function patchDrive(id: string, body: Partial<DrivePayload>): Promise<void> {
  return request(`/api/opportunities/${id}`, { method: "PATCH", body: JSON.stringify(body) }).then(
    () => undefined,
  );
}

const EMPTY_FORM = {
  company: "",
  title: "",
  description: "",
  location: "",
  type: "FULL_TIME",
  salary: "",
  deadline: "",
  seniority: "",
  status: "OPEN",
  skillsText: "",
  niceText: "",
};

function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function toIsoOffset(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

/**
 * Company drive management for placement staff. Uses only the documented
 * POST/PATCH /api/opportunities fields — nothing invented, no schema change.
 * Published OPEN drives appear in Student Opportunity Mirror immediately.
 */
export default function DriveManager() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [reqRows, setReqRows] = useState<{ skill: string; minLevel: Level }[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const drives = useQuery({
    queryKey: ["drives", filter],
    queryFn: () =>
      request<{ ok: boolean; data: Opportunity[]; total: number }>(
        `/api/opportunities?${new URLSearchParams({ status: filter === "All" ? "ALL" : filter, limit: "30" })}`,
      ).then((r) => r.data),
  });

  const set = (k: keyof typeof EMPTY_FORM, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setFormError(null);
    setNotice(null);
  };

  const startEdit = (d: Opportunity) => {
    setEditingId(d.id);
    setForm({
      company: d.company,
      title: d.title,
      description: d.description,
      location: d.location ?? "",
      type: d.type,
      salary: d.salary ?? "",
      deadline: toDateInput(d.deadline),
      seniority: "",
      status: d.status,
      skillsText: "",
      niceText: (d.niceToHave ?? []).join(", "),
    });
    setReqRows(d.requiredSkills.map((r) => ({ skill: r.skill, minLevel: r.minLevel })));
    setFormError(null);
    setNotice(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setReqRows([]);
    setFormError(null);
  };

  const validate = (): DrivePayload | null => {
    if (form.title.trim().length < 3) {
      setFormError("Job title needs at least 3 characters.");
      return null;
    }
    if (form.description.trim().length < 10) {
      setFormError("Write a real description (10+ characters) — students read this before applying.");
      return null;
    }
    if (!editingId && form.company.trim().length < 2) {
      setFormError("Company name needs at least 2 characters.");
      return null;
    }
    if (form.deadline && Number.isNaN(new Date(`${form.deadline}T00:00:00`).getTime())) {
      setFormError("Deadline is not a valid date.");
      return null;
    }
    const skills = reqRows.map((r) => ({ skill: r.skill.trim(), minLevel: r.minLevel })).filter((r) => r.skill);
    if (reqRows.some((r) => !r.skill.trim())) {
      setFormError("Remove empty skill rows or fill in the skill name.");
      return null;
    }
    return {
      ...(editingId ? {} : { companyName: form.company.trim() }),
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim() || undefined,
      type: form.type,
      status: form.status,
      seniority: form.seniority.trim() || undefined,
      salary: form.salary.trim() || undefined,
      deadline: form.deadline ? toIsoOffset(form.deadline) : undefined,
      requiredSkills: skills,
      niceToHave: [...new Set(form.niceText.split(",").map((s) => s.trim()).filter(Boolean))],
    };
  };

  const save = async () => {
    if (busy) return;
    const body = validate();
    if (!body) return;
    setBusy(true);
    setFormError(null);
    setNotice(null);
    try {
      if (editingId) {
        const { ...patch } = body;
        await patchDrive(editingId, patch);
        setNotice("Drive updated — students see the change immediately.");
      } else {
        await postDrive(body);
        setNotice("Drive published — it is live in Opportunity Mirror.");
      }
      cancelEdit();
      await qc.invalidateQueries({ queryKey: ["drives"] });
      await qc.invalidateQueries({ queryKey: ["tower"] });
      // Student Mirror reads matches; staff review reads staff-applications.
      await qc.invalidateQueries({ queryKey: ["matches"] });
      await qc.invalidateQueries({ queryKey: ["staff-applications"] });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not save this drive.");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (d: Opportunity, status: string) => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    setNotice(null);
    try {
      await patchDrive(d.id, { status });
      setNotice(`“${d.title}” is now ${status}.`);
      await qc.invalidateQueries({ queryKey: ["drives"] });
      await qc.invalidateQueries({ queryKey: ["tower"] });
      await qc.invalidateQueries({ queryKey: ["matches"] });
      await qc.invalidateQueries({ queryKey: ["staff-applications"] });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not change the status.");
    } finally {
      setBusy(false);
    }
  };

  const rows = drives.data ?? [];

  return (
    <div className="st st-enter">
      <SectionTitle kicker="Company drives" title="Publish and manage drives" />
      {notice && (
        <p role="status" className="mb-3 rounded-xl border border-[var(--ws-forest)] bg-[var(--ws-lime-wash)] p-3 text-sm text-[var(--ws-ink)]">
          {notice}
        </p>
      )}

      <Card className="st-card p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">
          {editingId ? "Edit drive" : "New drive"}
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {!editingId && (
            <label className="block text-sm font-medium text-[var(--ws-ink)]">
              Company name
              <input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Zenith Pay" maxLength={120} className="st-input mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm" />
            </label>
          )}
          <label className="block text-sm font-medium text-[var(--ws-ink)]">
            Job title
              <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Frontend Engineering Intern" maxLength={140} className="st-input mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-[var(--ws-ink)]">
            Location / work arrangement
              <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Bengaluru · Hybrid" maxLength={120} className="st-input mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-[var(--ws-ink)]">
            Employment type
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className="st-select mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm">
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-[var(--ws-ink)]">
            Compensation
              <input value={form.salary} onChange={(e) => set("salary", e.target.value)} placeholder="₹45K/mo" maxLength={60} className="st-input mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-[var(--ws-ink)]">
            Application deadline
              <input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} className="st-input mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-[var(--ws-ink)]">
            Status
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className="st-select mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm">
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-2 block text-sm font-medium text-[var(--ws-ink)]">
          Full job description and responsibilities
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} maxLength={5000} placeholder="What the intern will own, how success is judged…" className="st-textarea mt-1 w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm leading-relaxed" />
        </label>
        <div className="mt-2">
          <p className="text-sm font-medium text-[var(--ws-ink)]">Required skills + levels</p>
          {reqRows.map((r, i) => (
            <div key={i} className="mt-1.5 flex gap-2">
              <input value={r.skill} onChange={(e) => setReqRows((rows) => rows.map((x, j) => (j === i ? { ...x, skill: e.target.value } : x)))} placeholder="React" maxLength={60} aria-label={`Required skill ${i + 1}`} className="st-input min-h-[44px] flex-1 rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm" />
              <select value={r.minLevel} onChange={(e) => setReqRows((rows) => rows.map((x, j) => (j === i ? { ...x, minLevel: e.target.value as Level } : x)))} aria-label={`Minimum level for skill ${i + 1}`} className="st-select min-h-[44px] rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-2 py-2 text-sm">
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              <button type="button" onClick={() => setReqRows((rows) => rows.filter((_, j) => j !== i))} aria-label={`Remove skill ${i + 1}`} className="min-h-[44px] rounded-lg border border-[var(--ws-line)] px-3 text-sm text-[var(--ws-mute)]">
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setReqRows((rows) => [...rows, { skill: "", minLevel: "INTERMEDIATE" as Level }])} className="st-btn-secondary mt-2 inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-[var(--ws-line)] px-3 py-2 text-sm font-medium text-[var(--ws-forest)]">
            <Plus size={14} /> Add required skill
          </button>
        </div>
        <label className="mt-2 block text-sm font-medium text-[var(--ws-ink)]">
          Preferred skills (comma-separated)
          <input value={form.niceText} onChange={(e) => set("niceText", e.target.value)} placeholder="Communication, DSA" className="st-input mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm" />
        </label>
        {formError && (
          <p role="alert" className="mt-2 rounded-lg border border-[#e8c6bf] bg-[var(--ws-err-bg)] p-2.5 text-sm text-[var(--ws-err)]">
            {formError}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => void save()} disabled={busy} className="st-btn-forest inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[var(--ws-forest)] px-4 py-2 text-sm font-semibold text-[var(--ws-canvas)] disabled:opacity-50">
            {busy ? "Saving…" : editingId ? "Save changes" : "Publish drive"}
          </button>
          {editingId && (
            <button onClick={cancelEdit} disabled={busy} className="st-btn-secondary inline-flex min-h-[44px] items-center rounded-lg border border-[var(--ws-line)] px-4 py-2 text-sm font-medium text-[var(--ws-mute)]">
              Cancel
            </button>
          )}
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter drives by status">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`st-tab min-h-[44px] rounded-full border px-3.5 py-1.5 text-sm font-medium ${filter === f ? "border-[var(--ws-forest)] bg-[var(--ws-forest)] text-[var(--ws-canvas)]" : "border-[var(--ws-line)] bg-[var(--ws-surface)] text-[var(--ws-mute)]"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {drives.isPending ? (
        <div className="mt-3"><Loading label="Loading drives…" /></div>
      ) : drives.isError ? (
        <div className="mt-3">
          <ErrorState message="Drives failed to load" onRetry={() => void qc.invalidateQueries({ queryKey: ["drives"] })} />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-3">
          <Empty title="No drives with this status" body="Publish the first one with the form above." />
        </div>
      ) : (
        <ul className="mt-3 space-y-3 sm:space-y-2">
          {rows.map((d) => (
            <li key={d.id} className="st-lift flex flex-col gap-2 rounded-xl border border-[var(--ws-line)] bg-[var(--ws-surface)] p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                <p className="break-words text-sm font-semibold leading-snug text-[var(--ws-ink)] sm:truncate">{d.title}</p>
                <p className="mt-0.5 break-words font-mono text-[11px] leading-relaxed text-[var(--ws-faint)] sm:truncate">
                  {d.company} · {d.type} · {d.applicationCount ?? 0} applications
                  {d.deadline ? ` · closes ${d.deadline.slice(0, 10)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={d.status === "OPEN" ? "signal" : d.status === "DRAFT" ? "neutral" : "amber"}>
                  {d.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <button onClick={() => startEdit(d)} disabled={busy} aria-label={`Edit ${d.title}`} className="st-btn-secondary inline-flex min-h-[44px] items-center justify-center gap-1 rounded-lg border border-[var(--ws-line)] px-3 py-2 text-xs font-medium text-[var(--ws-forest)] disabled:opacity-50 sm:justify-start">
                  <Pencil size={13} /> Edit
                </button>
                {d.status === "OPEN" ? (
                  <button onClick={() => void setStatus(d, "CLOSED")} disabled={busy} className="st-btn-secondary inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--ws-line)] px-3 py-2 text-xs font-medium text-[var(--ws-mute)] disabled:opacity-50 sm:justify-start">
                    Close
                  </button>
                ) : (
                  <button onClick={() => void setStatus(d, "OPEN")} disabled={busy} className="st-btn-secondary inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--ws-forest)] px-3 py-2 text-xs font-medium text-[var(--ws-forest)] disabled:opacity-50 sm:justify-start">
                    Reopen
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
